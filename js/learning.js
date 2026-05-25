/* ══════════════════════════════════════════════
   LEARNING MODE  —  js/learning.js
   Depends on: app.js exposes nothing special;
   all DOM manipulation is self-contained here.
   ══════════════════════════════════════════════ */

(function () {

  /* ─── state ─────────────────────────────── */
  let _node   = null;   // the L5 node that triggered learning mode
  let _crumb  = '';     // breadcrumb string, e.g. "Mathematics › Algebra"

  /* knobits for the currently-open unit  */
  const KNOBITS = [
    { id: 1, name: 'What is a variable?',              tags: ['done']  },
    { id: 2, name: 'Expressions vs. equations',        tags: ['done']  },
    { id: 3, name: 'The equals sign as balance',       tags: ['done']  },
    { id: 4, name: 'Solving one-step equations',       tags: ['teach', 'apply'] },
    { id: 5, name: 'Solving two-step equations',       tags: []        },
    { id: 6, name: 'Equations with variables on both sides', tags: [] },
    { id: 7, name: 'Writing equations from word problems',   tags: [] },
  ];
  const CURRENT_KNOBIT_IDX = 3; // 0-based index of the "current" knobit (id 4)

  const KNOBIT_DONE_COUNT = 3;
  const KNOBIT_TOTAL      = KNOBITS.length;

  /* ─── DOM refs (resolved lazily after page load) ─── */
  function $id(id) { return document.getElementById(id); }

  /* ─── PUBLIC: called from app.js ─────────── */
  window.openLearningMode = function (node, crumb) {
    _node  = node;
    _crumb = crumb || '';

    /* apply domain accent colour */
    const lm = $id('learning-mode');
    const hex = node && node.color ? node.color : '#C4826A';
    lm.style.setProperty('--lm-accent', hex);
    lm.style.setProperty('--lm-accent-soft', hexToRgba(hex, 0.13));

    /* populate path view */
    _buildPathView(node, crumb);

    /* show learning mode, default to path view */
    lm.classList.add('active');
    showLmView('lm-path');
  };

  window.closeLearningMode = function () {
    $id('learning-mode').classList.remove('active');
  };

  /* ─── view switching ─────────────────────── */
  window.showLmView = function (id) {
    document.querySelectorAll('.lm-view').forEach(v => v.classList.remove('active'));
    const target = $id(id);
    if (target) target.classList.add('active');
  };

  /* ─── PATH VIEW ──────────────────────────── */
  function _buildPathView(node, crumb) {
    /* breadcrumb + title */
    $id('lm-path-crumb').textContent  = crumb || '';
    $id('lm-path-title').textContent  = (node && node.name) ? node.name : 'Learning Path';

    /* progress bar */
    const pct = Math.round((KNOBIT_DONE_COUNT / KNOBIT_TOTAL) * 100);
    $id('lm-progress-fill').style.width = pct + '%';
    $id('lm-progress-label').textContent = pct + '% complete — keep going!';

    /* knobit list */
    const list = $id('lm-knobit-list');
    list.innerHTML = '';
    KNOBITS.forEach(function (kb, i) {
      const isDone    = kb.tags.includes('done');
      const isCurrent = i === CURRENT_KNOBIT_IDX;
      const item = document.createElement('div');
      item.className = 'lm-knobit-item' +
        (isDone ? ' done' : '') + (isCurrent ? ' current' : '');
      item.innerHTML =
        '<div class="kn-index">' +
          (isDone
            ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            : kb.id) +
        '</div>' +
        '<div class="kn-info">' +
          '<div class="kn-name">' + _esc(kb.name) + '</div>' +
        '</div>' +
        '<svg class="kn-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none">' +
          '<path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';

      if (isCurrent) {
        item.addEventListener('click', function () { startKnobit(); });
      }
      list.appendChild(item);
    });
  }

  /* ─── KNOBIT VIEW: start / phases ────────── */
  window.startKnobit = function () {
    /* reset phase chips and fill */
    _setPhase('kn-teach');
    $id('lm-knobit-nav-label').textContent = KNOBITS[CURRENT_KNOBIT_IDX].name;
    _updateKnProgress(0);
    showLmView('lm-knobit');
  };

  /* called by inline onclick in HTML */
  window.goPhase = function (phaseId, fillPct, label) {
    _setPhase(phaseId);
    _updateKnProgress(fillPct);
    if (label !== undefined) {
      $id('lm-knobit-nav-label').textContent = label;
    }
    /* scroll panel back to top */
    const panel = $id(phaseId);
    if (panel) {
      const content = panel.querySelector('.kn-content');
      if (content) content.scrollTop = 0;
    }
    if (phaseId === 'kn-result') {
      _showComplete(false);
    }
  };

  function _setPhase(activeId) {
    const phases = ['kn-teach', 'kn-apply', 'kn-assess', 'kn-result'];
    phases.forEach(function (pid, i) {
      const panel = $id(pid);
      if (panel) panel.classList.toggle('active', pid === activeId);

      const chip = $id('chip-' + pid);
      if (chip) {
        chip.classList.remove('active', 'done-chip');
        const activeIdx = phases.indexOf(activeId);
        if (i === activeIdx) chip.classList.add('active');
        else if (i < activeIdx) chip.classList.add('done-chip');
      }
    });
  }

  function _updateKnProgress(pct) {
    const fill = $id('kn-progress-fill-bar');
    if (fill) fill.style.width = pct + '%';
  }

  /* ─── Apply: context picker ──────────────── */
  window.pickContext = function (el) {
    el.closest('.kn-context-strip')
      .querySelectorAll('.kn-context-pill')
      .forEach(function (p) { p.classList.remove('selected'); });
    el.classList.toggle('selected');
    /* update scenario to match context pill — placeholder, just shows selection */
  };

  /* ─── Assess: answer selection ───────────── */
  window.pickAnswer = function (el) {
    const grid = el.closest('.kn-answer-grid');
    grid.querySelectorAll('.kn-answer-tile').forEach(function (t) {
      t.classList.remove('selected', 'correct', 'wrong');
      t.onclick = null; /* lock after first pick */
    });
    /* tile with data-correct gets "correct", picked wrong tile gets "wrong" */
    const correct = grid.querySelector('[data-correct]');
    if (el === correct) {
      el.classList.add('correct');
    } else {
      el.classList.add('wrong');
      if (correct) correct.classList.add('correct');
    }
    /* enable Continue button */
    const btn = el.closest('.kn-phase').querySelector('.kn-action-btn');
    if (btn) btn.disabled = false;
  };

  /* ─── COMPLETE VIEW ──────────────────────── */
  function _showComplete(isUnit) {
    /* after a short pause (result panel first), then unit-complete if isUnit */
    if (isUnit) {
      setTimeout(function () { showLmView('lm-complete'); }, 400);
    }
  }

  window.showUnitComplete = function () {
    showLmView('lm-complete');
  };

  /* ─── util ───────────────────────────────── */
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function _esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();
