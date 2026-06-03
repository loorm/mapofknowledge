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
      if (action === 'simpler' || action === 'complex' || action === 'rephrase') {
        result = { text: await llm.generateRephrase(nodeLabel, title, original, action) };
      } else {
        result = { text: await llm.generateExplainByte(nodeLabel, title, byteIndex, priorChoices) };
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
      result = { text: await llm.generateMeaning(nodeLabel, title) };
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
      `SELECT k.node_id, n.external_id AS nodeExtId, k.locale
       FROM knobits k JOIN nodes n ON k.node_id = n.id
       WHERE k.id = ?`,
      [knobitId]
    );
    if (krow.length) {
      const { node_id, nodeExtId, locale } = krow[0];
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
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[api/learn/knobit/complete]', err.message);
    res.status(500).json({ error: 'Failed to save knobit completion' });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
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

module.exports = router;
