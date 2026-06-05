const express = require('express');
const router  = express.Router();
const db      = require('../db');
const llm     = require('../services/llm');

// ── In-memory map cache (10k+ nodes — cache after first DB load) ─────────────
let mapCache = null;

router.get('/map', async (req, res) => {
  try {
    if (mapCache) return res.json(mapCache);

    const [baseNodes] = await db.execute(
      `SELECT external_id AS id, label, level
       FROM nodes WHERE layer = 'foundational' AND is_active = 1`
    );
    const [baseEdges] = await db.execute(
      `SELECT s.external_id AS source, t.external_id AS target
       FROM edges e
       JOIN nodes s ON e.source_node_id = s.id
       JOIN nodes t ON e.target_node_id = t.id
       WHERE e.edge_type = 'hierarchy'`
    );
    const [emergentNodes] = await db.execute(
      `SELECT external_id AS id, label, level
       FROM nodes WHERE layer = 'emergent' AND is_active = 1`
    );
    const [emergentEdges] = await db.execute(
      `SELECT s.external_id AS source, t.external_id AS target, e.edge_type
       FROM edges e
       JOIN nodes s ON e.source_node_id = s.id
       JOIN nodes t ON e.target_node_id = t.id
       WHERE e.edge_type IN ('hierarchy','draws_from')
         AND (s.layer = 'emergent' OR t.layer = 'emergent')`
    );

    // Frontend expects 'hierarchical' for emergent hierarchy edges
    const mappedEmergentEdges = emergentEdges.map(e => ({
      ...e,
      edge_type: e.edge_type === 'hierarchy' ? 'hierarchical' : e.edge_type,
    }));

    mapCache = {
      base:     { nodes: baseNodes,     edges: baseEdges },
      emergent: { nodes: emergentNodes, edges: mappedEmergentEdges },
    };

    res.json(mapCache);
  } catch (err) {
    console.error('[api/map]', err.message);
    res.status(500).json({ error: 'Failed to load map data' });
  }
});

// Bust cache when migration reruns
router.post('/map/bust-cache', (req, res) => {
  mapCache = null;
  res.json({ ok: true });
});

// ── Node overview (generate once, cache in DB) ───────────────────────────────
router.get('/nodes/:id/overview', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute(
      'SELECT id AS db_id, label, level, overview FROM nodes WHERE external_id = ?', [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Node not found' });
    const node = rows[0];

    if (node.overview) return res.json({ overview: node.overview });

    const domain   = await getNodeDomain(node.db_id);
    const overview = await llm.generateOverview(node.label, domain, node.level);
    await db.execute(
      'UPDATE nodes SET overview = ? WHERE external_id = ?', [overview, id]
    );
    res.json({ overview });
  } catch (err) {
    console.error('[api/nodes/overview]', err.message);
    res.status(500).json({ error: 'Failed to generate overview' });
  }
});

// ── User settings ────────────────────────────────────────────────────────────
router.get('/settings', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.json({});
  try {
    const [rows] = await db.execute(
      'SELECT key_name, value FROM user_settings WHERE user_id = ?', [userId]
    );
    const out = {};
    rows.forEach(r => { out[r.key_name] = r.value; });
    res.json(out);
  } catch (err) {
    res.json({});
  }
});

router.post('/settings', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(400).json({ error: 'Not authenticated' });
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  try {
    await db.execute(
      `INSERT INTO user_settings (user_id, key_name, value) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [userId, key, value]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[api/settings POST]', err.message);
    res.status(500).json({ error: 'Failed to save setting' });
  }
});

// ── Most recent in-progress learning path ────────────────────────────────────
router.get('/learn/resume', async (req, res) => {
  const passportId = req.user?.passport_id;
  const locale     = req.user?.locale || 'en';
  if (!passportId) return res.json({});

  try {
    const [rows] = await db.execute(
      `SELECT n.external_id AS nodeId, n.label,
              COUNT(k.id)          AS total,
              COUNT(kp.knobit_id)  AS done,
              MAX(kp.completed_at) AS last_activity
       FROM knobits k
       JOIN nodes n ON k.node_id = n.id
       LEFT JOIN knobit_progress kp
              ON k.id = kp.knobit_id AND kp.passport_id = ?
       WHERE k.locale = ?
       GROUP BY n.id, n.external_id, n.label
       HAVING done > 0 AND done < total
       ORDER BY last_activity DESC
       LIMIT 1`,
      [passportId, locale]
    );
    res.json(rows.length ? rows[0] : {});
  } catch (err) {
    console.error('[api/learn/resume]', err.message);
    res.json({});
  }
});

// ── Knobit progress for current user ─────────────────────────────────────────
router.get('/nodes/:id/learn-progress', async (req, res) => {
  const { id }      = req.params;
  const passportId  = req.user?.passport_id;
  if (!passportId) return res.json({ done: 0, total: 0 });

  try {
    const [nodes] = await db.execute(
      'SELECT id AS db_id FROM nodes WHERE external_id = ?', [id]
    );
    if (!nodes.length) return res.json({ done: 0, total: 0 });
    const locale = req.user?.locale || 'en';

    const [[{ total }]] = await db.execute(
      'SELECT COUNT(*) AS total FROM knobits WHERE node_id = ? AND locale = ?',
      [nodes[0].db_id, locale]
    );
    if (!total) return res.json({ done: 0, total: 0 });

    const [[{ done }]] = await db.execute(
      `SELECT COUNT(*) AS done
       FROM knobit_progress kp
       JOIN knobits k ON kp.knobit_id = k.id
       WHERE kp.passport_id = ? AND k.node_id = ? AND k.locale = ? AND kp.phase_reached = 'done'`,
      [passportId, nodes[0].db_id, locale]
    );

    res.json({ done, total });
  } catch (err) {
    res.json({ done: 0, total: 0 });
  }
});

// ── User knowledge percentage ────────────────────────────────────────────────
router.get('/nodes/:id/knowledge', async (req, res) => {
  const { id }      = req.params;
  const passportId  = req.user?.passport_id;
  if (!passportId) return res.json({ percentage: 0, source: null });

  try {
    const [rows] = await db.execute(
      `SELECT percentage, source
       FROM user_node_knowledge WHERE passport_id = ? AND node_external_id = ?`,
      [passportId, id]
    );
    res.json(rows.length ? rows[0] : { percentage: 0, source: null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get knowledge' });
  }
});

router.post('/nodes/:id/knowledge', async (req, res) => {
  const { id }                          = req.params;
  const { percentage, source = 'self_reported' } = req.body;
  const passportId                      = req.user?.passport_id;
  if (!passportId) return res.status(400).json({ error: 'No passport linked to account' });

  try {
    const [nodes] = await db.execute(
      'SELECT id AS db_id, level FROM nodes WHERE external_id = ?', [id]
    );
    if (!nodes.length) return res.status(404).json({ error: 'Node not found' });
    const { db_id, level } = nodes[0];

    await db.execute(
      `INSERT INTO user_node_knowledge
         (passport_id, node_external_id, percentage, source, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         percentage = VALUES(percentage),
         source = VALUES(source),
         updated_at = NOW()`,
      [passportId, id, percentage, source]
    );

    // Cascade to L5 children server-side to avoid client race condition
    if (level === 4) {
      const [children] = await db.execute(
        'SELECT external_id FROM nodes WHERE parent_id = ? AND level = 5',
        [db_id]
      );
      for (const child of children) {
        await db.execute(
          `INSERT INTO user_node_knowledge
             (passport_id, node_external_id, percentage, source, updated_at)
           VALUES (?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE
             percentage = VALUES(percentage), source = VALUES(source), updated_at = NOW()`,
          [passportId, child.external_id, percentage, source]
        );
      }
    }

    // Single ancestor update after all writes are done
    updateAncestorKnowledge(passportId, id).catch(() => {});
    res.json({ ok: true, percentage, source });
  } catch (err) {
    console.error('[api/nodes/knowledge POST]', err.message);
    res.status(500).json({ error: 'Failed to update knowledge' });
  }
});

// ── Generate / return knobits for a node ─────────────────────────────────────
router.post('/nodes/:id/learn', async (req, res) => {
  const { id }   = req.params;
  const locale   = req.user?.locale || 'en';

  try {
    const [nodes] = await db.execute(
      'SELECT id AS db_id, label, level FROM nodes WHERE external_id = ?', [id]
    );
    if (!nodes.length) return res.status(404).json({ error: 'Node not found' });
    const node = nodes[0];

    if (node.level !== 5) {
      return res.status(400).json({ error: 'Learn mode is only available for L5 leaf concepts' });
    }

    // Return cached knobits if they exist
    const [existing] = await db.execute(
      `SELECT id, sequence, title
       FROM knobits WHERE node_id = ? AND locale = ? ORDER BY sequence`,
      [node.db_id, locale]
    );
    if (existing.length) return res.json({ knobits: existing });

    // Generate via LLM
    const domain     = await getNodeDomain(node.db_id);
    const breadcrumb = await getNodeBreadcrumb(node.db_id);
    const generated  = await llm.generateKnobits(node.label, domain, breadcrumb);

    for (const k of generated) {
      await db.execute(
        'INSERT INTO knobits (node_id, sequence, locale, title) VALUES (?, ?, ?, ?)',
        [node.db_id, k.sequence, locale, k.title]
      );
    }

    const [knobits] = await db.execute(
      `SELECT id, sequence, title
       FROM knobits WHERE node_id = ? AND locale = ? ORDER BY sequence`,
      [node.db_id, locale]
    );

    // Log learning start event
    const passportId = req.user?.passport_id;
    if (passportId) {
      await db.execute(
        `INSERT INTO passport_events
           (passport_id, event_date, title, institution, result, node_external_id, type, sort_order)
         VALUES (?, CURDATE(), ?, 'Map of Knowledge · KaiQ Platform', NULL, ?, 'assessment', 0)`,
        [passportId, `Started learning: ${node.label}`, id]
      ).catch(() => {});
    }

    res.json({ knobits });
  } catch (err) {
    console.error('[api/nodes/learn]', err.message);
    res.status(500).json({ error: 'Failed to prepare learning session' });
  }
});

// ── LLM learning interactions ────────────────────────────────────────────────
router.post('/learn/interact', async (req, res) => {
  const {
    knobitId, phase, action,
    byteIndex = 0, answer, priorChoices = [],
    original = '', question = '', expected = '', userAnswer = '',
    context = '',
  } = req.body;

  try {
    const [rows] = await db.execute(
      `SELECT k.title, n.label AS nodeLabel
       FROM knobits k JOIN nodes n ON k.node_id = n.id
       WHERE k.id = ?`,
      [knobitId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Knobit not found' });
    const { title, nodeLabel } = rows[0];

    let result;

    if (phase === 'explain') {
      if (action === 'rephrase' || action === 'simpler' || action === 'complex') {
        // Adapt the CURRENT byte — original holds what was shown
        result = { text: await llm.generateRephrase(nodeLabel, title, original, action) };
      } else {
        // Advance forward — original holds the previous byte so LLM can build on it
        result = { text: await llm.generateExplainByte(nodeLabel, title, byteIndex, original) };
      }
    } else if (phase === 'demonstrate') {
      result = { demonstrate: await llm.generateDemonstrate(nodeLabel, title, byteIndex) };
    } else if (phase === 'practice') {
      if (action === 'grade') {
        result = { grade: await llm.gradePractice(nodeLabel, title, question, expected, userAnswer) };
      } else {
        result = { practice: await llm.generatePractice(nodeLabel, title, byteIndex) };
      }
    } else if (phase === 'meaning') {
      if (action === 'rephrase' || action === 'simpler' || action === 'complex') {
        result = { text: await llm.generateRephrase(nodeLabel, title, original, action) };
      } else {
        result = { text: await llm.generateMeaning(nodeLabel, title) };
      }
    } else if (phase === 'ask') {
      result = { text: await llm.answerQuestion(nodeLabel, title, action || 'general', question, context) };
    } else {
      return res.status(400).json({ error: `Unknown phase: ${phase}` });
    }

    res.json(result);
  } catch (err) {
    console.error('[api/learn/interact]', err.message);
    res.status(500).json({ error: 'LLM interaction failed: ' + err.message });
  }
});

// ── Mark knobit complete ─────────────────────────────────────────────────────
router.post('/learn/knobit/:id/complete', async (req, res) => {
  const knobitId   = req.params.id;
  const passportId = req.user?.passport_id;
  if (!passportId) return res.status(400).json({ error: 'No passport' });

  try {
    await db.execute(
      `INSERT INTO knobit_progress (passport_id, knobit_id, phase_reached, completed_at)
       VALUES (?, ?, 'done', NOW())
       ON DUPLICATE KEY UPDATE phase_reached = 'done', completed_at = NOW()`,
      [passportId, knobitId]
    );

    // Recompute node knowledge %
    const [krow] = await db.execute(
      `SELECT k.node_id, n.external_id AS nodeExtId, n.label AS nodeLabel, k.locale
       FROM knobits k JOIN nodes n ON k.node_id = n.id
       WHERE k.id = ?`,
      [knobitId]
    );
    if (krow.length) {
      const { node_id, nodeExtId, nodeLabel, locale } = krow[0];
      const [[{ total }]] = await db.execute(
        'SELECT COUNT(*) AS total FROM knobits WHERE node_id = ? AND locale = ?',
        [node_id, locale]
      );
      const [[{ done }]] = await db.execute(
        `SELECT COUNT(*) AS done
         FROM knobit_progress kp JOIN knobits k ON kp.knobit_id = k.id
         WHERE kp.passport_id = ? AND k.node_id = ? AND kp.phase_reached = 'done'`,
        [passportId, node_id]
      );
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      await db.execute(
        `INSERT INTO user_node_knowledge
           (passport_id, node_external_id, percentage, source, updated_at)
         VALUES (?, ?, ?, 'tested', NOW())
         ON DUPLICATE KEY UPDATE
           percentage = VALUES(percentage), source = 'tested', updated_at = NOW()`,
        [passportId, nodeExtId, pct]
      );
      updateAncestorKnowledge(passportId, nodeExtId).catch(() => {});

      if (pct === 100) {
        // Check if credential already exists
        const credTitle = `${nodeLabel} — Completed`;
        const [[existing]] = await db.execute(
          `SELECT id FROM passport_credentials
           WHERE passport_id = ? AND type = 'platform' AND title = ?`,
          [passportId, credTitle]
        );
        if (!existing) {
          const crypto = require('crypto');
          const hash = crypto.createHash('sha256')
            .update(`${passportId}-${nodeExtId}-${Date.now()}`)
            .digest('hex')
            .substring(0, 16);
          await db.execute(
            `INSERT INTO passport_credentials
               (passport_id, type, title, issuer, awarded_date, score_pct, threshold_pct,
                blockchain_hash, sort_order)
             VALUES (?, 'platform', ?, 'Map of Knowledge · KaiQ Platform', CURDATE(), 100, 80, ?, 0)`,
            [passportId, credTitle, '0x' + hash]
          );
          // Also add a learning event
          await db.execute(
            `INSERT INTO passport_events
               (passport_id, event_date, title, institution, result, node_external_id, type, sort_order)
             VALUES (?, CURDATE(), ?, 'Map of Knowledge · KaiQ Platform', 'Score: 100%', ?, 'assessment', 0)`,
            [passportId, `Completed: ${nodeLabel}`, nodeExtId]
          );
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[api/learn/knobit/complete]', err.message);
    res.status(500).json({ error: 'Failed to save knobit completion' });
  }
});

// ── Map progress for current user ────────────────────────────────────────────
router.get('/map/progress', async (req, res) => {
  const passportId = req.user?.passport_id;
  if (!passportId) return res.json({});
  try {
    const [rows] = await db.execute(
      `SELECT node_external_id AS id, percentage
       FROM user_node_knowledge WHERE passport_id = ? AND percentage > 0`,
      [passportId]
    );
    const map = {};
    rows.forEach(r => { map[r.id] = r.percentage; });
    res.json(map);
  } catch (err) {
    res.status(500).json({});
  }
});

// ── Full profile data for current user ───────────────────────────────────────
router.get('/profile', async (req, res) => {
  const passportId = req.user?.passport_id;
  if (!passportId) return res.status(400).json({ error: 'No passport' });

  try {
    const [[passport]] = await db.execute(
      'SELECT * FROM learner_passports WHERE id = ?', [passportId]
    );

    const [credentials] = await db.execute(
      `SELECT * FROM passport_credentials WHERE passport_id = ? ORDER BY awarded_date DESC, id DESC`,
      [passportId]
    );

    const [competence] = await db.execute(
      `SELECT * FROM passport_competence WHERE passport_id = ? ORDER BY type, sort_order`,
      [passportId]
    );

    // Top learned nodes as competence items derived from map progress
    const [mapKnowledge] = await db.execute(
      `SELECT n.label, n.level, u.percentage, u.source,
              (SELECT n2.label FROM nodes n2 WHERE n2.id = n.parent_id) AS parent_label
       FROM user_node_knowledge u
       JOIN nodes n ON n.external_id = u.node_external_id
       WHERE u.passport_id = ? AND u.percentage >= 50
       ORDER BY u.percentage DESC, n.level ASC
       LIMIT 20`,
      [passportId]
    );

    const [events] = await db.execute(
      `SELECT * FROM passport_events WHERE passport_id = ? ORDER BY event_date DESC, id DESC`,
      [passportId]
    );

    const [tags] = await db.execute(
      'SELECT * FROM passport_tags WHERE passport_id = ? ORDER BY sort_order',
      [passportId]
    );

    const [learningStyle] = await db.execute(
      'SELECT * FROM passport_learning_style WHERE passport_id = ?',
      [passportId]
    );

    const [aspirations] = await db.execute(
      'SELECT * FROM passport_aspirations WHERE passport_id = ? ORDER BY sort_order',
      [passportId]
    );

    const [objectives] = await db.execute(
      'SELECT * FROM passport_objectives WHERE passport_id = ? ORDER BY sort_order',
      [passportId]
    );

    const [plans] = await db.execute(
      'SELECT * FROM passport_plans WHERE passport_id = ? ORDER BY sort_order',
      [passportId]
    );

    res.json({
      passport,
      credentials,
      competence,
      mapKnowledge,
      events,
      tags,
      learningStyle: learningStyle[0] || null,
      aspirations,
      objectives,
      plans,
    });
  } catch (err) {
    console.error('[api/profile]', err.message);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// ── Update basic passport identity ───────────────────────────────────────────
router.post('/profile/identity', async (req, res) => {
  const passportId = req.user?.passport_id;
  if (!passportId) return res.status(400).json({ error: 'No passport' });
  const { display_name, pronouns, birth_year, location, cultural_background, tagline, about } = req.body;
  try {
    await db.execute(
      `UPDATE learner_passports
       SET display_name=?, pronouns=?, birth_year=?, location=?,
           cultural_background=?, tagline=?, about=?, updated_at=NOW()
       WHERE id=?`,
      [display_name||null, pronouns||null, birth_year||null, location||null,
       cultural_background||null, tagline||null, about||null, passportId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update identity' });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

// Recompute and store estimated knowledge % for all ancestors of a node.
// Called fire-and-forget after any knowledge write. Never overwrites
// explicit self_reported or tested entries.
async function updateAncestorKnowledge(passportId, nodeExtId) {
  if (!passportId) return;
  try {
    const [ancestors] = await db.execute(
      `WITH RECURSIVE anc AS (
         SELECT id AS db_id, external_id, level, parent_id
         FROM nodes WHERE external_id = ?
         UNION ALL
         SELECT n.id, n.external_id, n.level, n.parent_id
         FROM nodes n JOIN anc a ON n.id = a.parent_id
       )
       SELECT db_id, external_id FROM anc
       WHERE external_id != ? AND level >= 1
       ORDER BY level DESC`,
      [nodeExtId, nodeExtId]
    );

    for (const anc of ancestors) {
      // Compute average % from all L5 descendants
      const [[{ total, sumPct }]] = await db.execute(
        `WITH RECURSIVE desc_tree AS (
           SELECT id, external_id, level FROM nodes WHERE id = ?
           UNION ALL
           SELECT n.id, n.external_id, n.level
           FROM nodes n JOIN desc_tree d ON n.parent_id = d.id
         )
         SELECT COUNT(d.id) AS total,
                COALESCE(SUM(unk.percentage), 0) AS sumPct
         FROM desc_tree d
         LEFT JOIN user_node_knowledge unk
                ON unk.node_external_id = d.external_id
               AND unk.passport_id = ?
         WHERE d.level = 5`,
        [anc.db_id, passportId]
      );

      if (!total) continue;

      // Never touch explicit self_reported or tested entries
      const [existing] = await db.execute(
        `SELECT source FROM user_node_knowledge WHERE passport_id = ? AND node_external_id = ?`,
        [passportId, anc.external_id]
      );
      if (existing.length && ['self_reported', 'tested'].includes(existing[0].source)) continue;

      const estPct = Math.round(sumPct / total);

      if (estPct > 0) {
        await db.execute(
          `INSERT INTO user_node_knowledge
             (passport_id, node_external_id, percentage, source, updated_at)
           VALUES (?, ?, ?, 'estimated', NOW())
           ON DUPLICATE KEY UPDATE percentage = VALUES(percentage), source = 'estimated', updated_at = NOW()`,
          [passportId, anc.external_id, estPct]
        );
      } else {
        // Drop estimated row when % falls back to 0
        await db.execute(
          `DELETE FROM user_node_knowledge WHERE passport_id = ? AND node_external_id = ? AND source = 'estimated'`,
          [passportId, anc.external_id]
        );
      }
    }
  } catch (err) {
    console.error('[updateAncestorKnowledge]', err.message);
  }
}

async function getNodeDomain(nodeDbId) {
  // Walk up to level-1 ancestor via recursive CTE
  const [rows] = await db.execute(
    `WITH RECURSIVE anc AS (
       SELECT id, label, level, parent_id FROM nodes WHERE id = ?
       UNION ALL
       SELECT n.id, n.label, n.level, n.parent_id
       FROM nodes n JOIN anc a ON n.id = a.parent_id
     )
     SELECT label FROM anc WHERE level = 1 LIMIT 1`,
    [nodeDbId]
  );
  return rows.length ? rows[0].label : 'Unknown';
}

async function getNodeBreadcrumb(nodeDbId) {
  const [rows] = await db.execute(
    `WITH RECURSIVE anc AS (
       SELECT id, label, level, parent_id FROM nodes WHERE id = ?
       UNION ALL
       SELECT n.id, n.label, n.level, n.parent_id
       FROM nodes n JOIN anc a ON n.id = a.parent_id
     )
     SELECT label, level FROM anc ORDER BY level ASC`,
    [nodeDbId]
  );
  return rows.map(r => r.label).join(' › ');
}

// ── 4-tier diagnostic: generate question ─────────────────────────────────────
router.post('/test/question', async (req, res) => {
  const { nodeId, questionNum, history = [] } = req.body;
  try {
    const [nodes] = await db.execute(
      'SELECT id AS db_id, label, level FROM nodes WHERE external_id = ?', [nodeId]
    );
    if (!nodes.length) return res.status(404).json({ error: 'Node not found' });
    const { db_id, label, level } = nodes[0];
    if (level < 4) return res.status(400).json({ error: 'Test only available for L4 and L5 nodes' });
    const breadcrumb = await getNodeBreadcrumb(db_id);
    const result = await llm.generateTestQuestion(label, breadcrumb, questionNum, history);
    res.json(result);
  } catch (err) {
    console.error('[api/test/question]', err.message);
    res.status(500).json({ error: 'Failed to generate question' });
  }
});

// ── 4-tier diagnostic: evaluate answer ───────────────────────────────────────
router.post('/test/evaluate', async (req, res) => {
  const { nodeId, questionNum, question, options, userAnswer, history = [] } = req.body;
  const passportId = req.user?.passport_id;

  try {
    const [nodes] = await db.execute(
      'SELECT id AS db_id, label, level FROM nodes WHERE external_id = ?', [nodeId]
    );
    if (!nodes.length) return res.status(404).json({ error: 'Node not found' });
    const { db_id, label } = nodes[0];
    const breadcrumb = await getNodeBreadcrumb(db_id);

    const evaluation = await llm.evaluateTestAnswer(
      label, breadcrumb, questionNum, question, options, userAnswer, history
    );

    if (questionNum === 4 && evaluation.finalScore !== undefined && passportId) {
      await db.execute(
        `INSERT INTO user_node_knowledge
           (passport_id, node_external_id, percentage, source, updated_at)
         VALUES (?, ?, ?, 'tested', NOW())
         ON DUPLICATE KEY UPDATE
           percentage = VALUES(percentage), source = 'tested', updated_at = NOW()`,
        [passportId, nodeId, evaluation.finalScore]
      );
      updateAncestorKnowledge(passportId, nodeId).catch(() => {});
      await db.execute(
        `INSERT INTO passport_events
           (passport_id, event_date, title, institution, result, node_external_id, type, sort_order)
         VALUES (?, CURDATE(), ?, 'Map of Knowledge · KaiQ Platform', ?, ?, 'assessment', 0)`,
        [passportId, `Knowledge test: ${label}`, `Score: ${evaluation.finalScore}%`, nodeId]
      );
    }

    res.json(evaluation);
  } catch (err) {
    console.error('[api/test/evaluate]', err.message);
    res.status(500).json({ error: 'Evaluation failed' });
  }
});

module.exports = router;
