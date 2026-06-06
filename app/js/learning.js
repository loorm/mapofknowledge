/* ═══════════════════════════════════════════════════════════════
   LEARNING MODE  —  learning.js
   ───────────────────────────────────────────────────────────────
   Owns  : #learning-mode overlay, lm-path / lm-knobit / lm-complete
           views, knobit flow (explain → demonstrate → practice → meaning)
   Exposes: window.Learn.open(node, crumb, knobits)
            window.Learn.close()
            window.Learn.showView(id)
   Calls  : window.MapView.refreshProgress()
   Never  : touch app.js map rendering, test.js, or #lm-test
   ═══════════════════════════════════════════════════════════════ */

(function () {

  /* ─── State ──────────────────────────────────────────────────── */
  var _node             = null;
  var _crumb            = '';
  var KNOBITS           = [];
  var KNOBIT_TOTAL      = 0;
  var KNOBIT_DONE_COUNT = 0;
  var CURRENT_KNOBIT_IDX = 0;

  var _phase        = null;
  var _byteIdx      = 0;
  var _demoIdx      = 0;
  var _practiceIdx  = 0;
  var _streamBlocks = [];
  var _priorChoices = [];
  var _loading      = false;
  var _starting     = false;   // guard against double-start
  var _pendingPractice = null;

  var _PHASES = ['explain', 'demonstrate', 'practice', 'meaning'];
  var MAX_EXPLAIN_BYTES = 6;

  var _knobitStarted  = false;
  var _streamButtonEl = null;
  var _quitCallback   = null;

  /* ─── API helper ──────────────────────────────────────────────── */
  function apiInteract(params) {
    var knobit = KNOBITS[CURRENT_KNOBIT_IDX];
    if (!knobit) return Promise.reject(new Error('No knobit'));
    var body = Object.assign({ knobitId: knobit.id }, params);
    return fetch('/api/learn/interact', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function apiComplete(knobitId) {
    return fetch('/api/learn/knobit/' + knobitId + '/complete', { method: 'POST' })
      .catch(function () {});
  }

  /* ─── Entry / exit ────────────────────────────────────────────── */
  var _searchWrap = null;

  window.openLearningMode = function (node, crumb, knobits) {
    // Hide search box — meaningless in learning view
    _searchWrap = document.querySelector('.topbar-search-wrap');
    if (_searchWrap) _searchWrap.style.display = 'none';
    _node             = node;
    _crumb            = crumb || '';
    KNOBITS           = Array.isArray(knobits) && knobits.length ? knobits : [];
    KNOBIT_TOTAL      = KNOBITS.length;
    KNOBIT_DONE_COUNT = 0;
    CURRENT_KNOBIT_IDX = 0;

    // Accent colours from node
    var hex = (node && node.color) ? node.color : '#C4826A';
    var r   = parseInt(hex.slice(1,3), 16);
    var g   = parseInt(hex.slice(3,5), 16);
    var b   = parseInt(hex.slice(5,7), 16);
    document.documentElement.style.setProperty('--lm-accent', hex);
    document.documentElement.style.setProperty('--lm-accent-soft', 'rgba('+r+','+g+','+b+',0.13)');

    _buildPathView();
    showLmView('lm-path');
    var overlay = document.getElementById('learning-mode');
    if (overlay) overlay.classList.add('active');
  };

  window.closeLearningMode = function () {
    _knobitStarted = false;
    var overlay = document.getElementById('learning-mode');
    if (overlay) overlay.classList.remove('active');
    // Restore search box — always, whether hidden by learning or test mode
    var sw = _searchWrap || document.querySelector('.topbar-search-wrap');
    if (sw) sw.style.display = '';
    _searchWrap = null;
    _node   = null;
    KNOBITS = [];
  };

  /* ─── View switching ──────────────────────────────────────────── */
  window.showLmView = function (id) {
    ['lm-path', 'lm-knobit', 'lm-complete'].forEach(function (v) {
      var el = document.getElementById(v);
      if (el) el.classList.toggle('active', v === id);
    });
  };

  /* ─── View 1 — Learning Path ──────────────────────────────────── */
  function _buildPathView() {
    var crumbEl = document.getElementById('lm-path-crumb');
    var titleEl = document.getElementById('lm-path-title');
    var fillEl  = document.getElementById('lm-progress-fill');
    var labelEl = document.getElementById('lm-progress-label');
    var listEl  = document.getElementById('lm-knobit-list');

    if (crumbEl) crumbEl.textContent = _crumb;
    if (titleEl) titleEl.textContent = _node ? _node.label : '';

    var pct = KNOBIT_TOTAL ? Math.round((KNOBIT_DONE_COUNT / KNOBIT_TOTAL) * 100) : 0;
    if (fillEl)  fillEl.style.width   = pct + '%';
    if (labelEl) labelEl.textContent  = pct + '% complete' + (pct < 100 ? ' — keep going!' : '');

    if (!listEl) return;
    listEl.innerHTML = '';

    if (!KNOBITS.length) {
      listEl.innerHTML = '<div style="color:#8A7E72;font-size:13px;padding:14px 0">No content available yet — try again in a moment.</div>';
      return;
    }

    KNOBITS.forEach(function (k, i) {
      var done    = i < KNOBIT_DONE_COUNT;
      var current = i === CURRENT_KNOBIT_IDX;
      var locked  = !done && !current;
      var item    = document.createElement('div');
      item.className = 'lm-knobit-item' + (done ? ' done' : '') + (current ? ' current' : '') + (locked ? ' locked' : '');

      var num       = document.createElement('div');
      num.className = 'lm-knobit-num';
      num.textContent = done ? '✓' : String(i + 1);
      item.appendChild(num);

      var name       = document.createElement('div');
      name.className = 'lm-knobit-name';
      name.textContent = k.title || ('Knobit ' + (i + 1));
      item.appendChild(name);

      if (current) {
        item.addEventListener('click', window.startKnobit);
      }
      listEl.appendChild(item);
    });
  }

  /* ─── View 2 — Knobit lesson ──────────────────────────────────── */
  window.startKnobit = function () {
    if (!KNOBITS.length || _starting) return;
    _starting = true;
    _knobitStarted  = true;
    _streamButtonEl = null;
    var k = KNOBITS[CURRENT_KNOBIT_IDX];

    _streamBlocks   = [];
    _priorChoices   = [];
    _byteIdx        = 0;
    _demoIdx        = 0;
    _practiceIdx    = 0;
    _pendingPractice = null;

    var stream = document.getElementById('kn-stream');
    if (stream) stream.innerHTML = '';
    var navLabel = document.getElementById('lm-knobit-nav-label');
    if (navLabel) navLabel.textContent = k.title || '';

    _setPhase('explain');
    showLmView('lm-knobit');

    _setButtonRow('');
    _appendPhaseDivider('Step 1 of 4: Read all explanations');
    _showLoadingBlock();

    apiInteract({ phase: 'explain', byteIndex: 0, priorChoices: [] })
      .then(function (d) {
        _starting = false;
        _removeLoadingBlock();
        _appendBlock({ type: 'byte', content: d.text || '' });
        _setButtonRow('explain-options');
      }).catch(function () {
        _starting = false;
        _onApiError();
      });
  };

  /* ─── Phase chip management ───────────────────────────────────── */
  function _setPhase(phase) {
    _phase = phase;
    var pcts = { explain: 0, demonstrate: 25, practice: 50, meaning: 75 };
    var bar  = document.getElementById('kn-progress-fill-bar');
    if (bar) bar.style.width = (pcts[phase] || 0) + '%';

    document.querySelectorAll('#lm-knobit .kn-chip').forEach(function (chip) {
      var cp  = chip.dataset.phase;
      var pi  = _PHASES.indexOf(phase);
      var ci  = _PHASES.indexOf(cp);
      chip.classList.remove('active', 'done-chip', 'locked-chip');
      if (cp === phase)   chip.classList.add('active');
      else if (ci < pi)   chip.classList.add('done-chip');
      else if (ci > pi)   chip.classList.add('locked-chip');
    });
  }

  /* ─── Button rows ─────────────────────────────────────────────── */
  function _setButtonRow(type) {
    // Leave locked (already-chosen) rows in stream; only remove an active unlocked one
    if (_streamButtonEl && !_streamButtonEl.classList.contains('row-locked')) {
      if (_streamButtonEl.parentNode) _streamButtonEl.parentNode.removeChild(_streamButtonEl);
    }
    _streamButtonEl = null;
    if (!type) return;

    var s = document.getElementById('kn-stream');
    if (!s) return;

    var area = document.createElement('div');
    area.className = 'kn-button-row';
    _streamButtonEl = area;

    function btn(label, handler, cls) {
      var b = document.createElement('button');
      b.className   = 'kn-option-btn' + (cls ? ' ' + cls : '');
      b.textContent = label;
      b.addEventListener('click', handler);
      area.appendChild(b);
      return b;
    }

    if (type === 'explain-options') {
      btn('I understand',       function () { window.explainOpt('ok');      }, 'btn-understand');
      btn("I don't understand", function () { window.explainOpt('no');      }, 'btn-other');
      btn('Too simplistic',     function () { window.explainOpt('simpler'); }, 'btn-adjust');
      btn('Too complex',        function () { window.explainOpt('complex'); }, 'btn-adjust');
    } else if (type === 'demo-1') {
      btn('View next example',  function () { window.demoOpt('next');    }, 'btn-other');
    } else if (type === 'demo-2') {
      btn('I understand, no more needed', function () { window.demoOpt('ok');      }, 'btn-understand');
      btn('Give me another',              function () { window.demoOpt('another'); }, 'btn-other');
    } else if (type === 'demo-3') {
      btn('I understand — ready to practice', function () { window.demoOpt('ok');       }, 'btn-understand');
      btn("Still don't understand",           function () { window.demoOpt('still-no'); }, 'btn-other');
    } else if (type === 'practice-submit') {
      btn('Submit answer', function () { window.practiceSubmit(); });
    } else if (type === 'practice-next') {
      btn('Yes, next problem', function () { window.practiceNext(); }, 'btn-other');
      btn("No, I'm done",      function () { window.practiceDone(); }, 'btn-understand');
    } else if (type === 'meaning-options') {
      btn('I understand',       function () { window.meaningOpt('ok');      }, 'btn-understand');
      btn("I don't understand", function () { window.meaningOpt('no');      }, 'btn-other');
      btn('Too simplistic',     function () { window.meaningOpt('simpler'); }, 'btn-adjust');
      btn('Too complex',        function () { window.meaningOpt('complex'); }, 'btn-adjust');
    }

    s.appendChild(area);
    _scrollStream();
  }

  /* ─── Explain ─────────────────────────────────────────────────── */
  window.explainOpt = function (opt) {
    var label = { ok: 'I understand', no: "I don't understand", simpler: 'Too simplistic', complex: 'Too complex' }[opt];
    _lockButtons(label);
    _priorChoices.push(opt);
    _setButtonRow('');

    if (opt === 'ok') {
      _byteIdx++;
      if (_byteIdx >= MAX_EXPLAIN_BYTES) {
        _enterDemonstrate();
        return;
      }
    }

    var lastContent = _getLastContent(['byte']);
    _showLoadingBlock();
    // action mapping: 'ok' → advance (undefined), 'no' → 'rephrase', 'simpler'/'complex' → pass through
    var action = opt === 'ok' ? undefined : (opt === 'no' ? 'rephrase' : opt);
    apiInteract({
      phase:        'explain',
      action:       action,
      byteIndex:    _byteIdx,
      priorChoices: _priorChoices,
      original:     lastContent,
    }).then(function (d) {
      _removeLoadingBlock();
      _appendBlock({ type: 'byte', content: d.text || '' });
      _setButtonRow('explain-options');
    }).catch(_onApiError);
  };

  /* ─── Demonstrate ─────────────────────────────────────────────── */
  function _enterDemonstrate() {
    _appendPhaseDivider('Step 2 of 4: Review the demonstration');
    _demoIdx = 0;
    _setPhase('demonstrate');
    _fetchDemo();
  }

  function _fetchDemo() {
    _showLoadingBlock();
    apiInteract({ phase: 'demonstrate', byteIndex: _demoIdx })
      .then(function (d) {
        _removeLoadingBlock();
        var ex   = d.demonstrate || {};
        var html = '<strong>Example ' + (_demoIdx + 1) + '</strong><br>' +
                   _escHtml(ex.body || '') +
                   (ex.whatIDid ? '<br><em style="opacity:0.55;font-size:0.95em">What I did: ' + _escHtml(ex.whatIDid) + '</em>' : '');
        _appendBlock({ type: 'example', rawHtml: html });
        var rowType = _demoIdx === 0 ? 'demo-1' : _demoIdx === 1 ? 'demo-2' : 'demo-3';
        _setButtonRow(rowType);
      }).catch(_onApiError);
  }

  window.demoOpt = function (opt) {
    if (opt === 'ok') {
      _lockButtons('I understand');
      _setButtonRow('');
      _enterPractice();
    } else if (opt === 'next' || opt === 'another') {
      _lockButtons(opt === 'next' ? 'View next' : 'Give me another');
      _demoIdx++;
      _setButtonRow('');
      _fetchDemo();
    } else {
      _lockButtons("Still don't understand");
      _appendBlock({ type: 'note', content: 'Try YouTube: "' + (_node ? _node.label : '') + ' explained"' });
      _setButtonRow('');
      setTimeout(_enterPractice, 1200);
    }
  };

  /* ─── Practice ────────────────────────────────────────────────── */
  function _enterPractice() {
    _appendPhaseDivider('Step 3 of 4: Practice it yourself');
    _practiceIdx = 0;
    _setPhase('practice');
    _fetchPractice();
  }

  function _fetchPractice() {
    _showLoadingBlock();
    apiInteract({ phase: 'practice', byteIndex: _practiceIdx })
      .then(function (d) {
        _removeLoadingBlock();
        var prob = d.practice || {};
        _pendingPractice = prob;

        var wrapper = _appendBlock({ type: 'practice', content: 'Problem ' + (_practiceIdx + 1) + ': ' + (prob.question || '') });
        if (wrapper) {
          var inp         = document.createElement('textarea');
          inp.id          = 'kn-practice-input';
          inp.className   = 'kn-answer-input';
          inp.placeholder = 'Your answer…';
          inp.rows        = 2;
          wrapper.appendChild(inp);
        }
        _setButtonRow('practice-submit');
      }).catch(_onApiError);
  }

  window.practiceSubmit = function () {
    var inp = document.getElementById('kn-practice-input');
    var ans = inp ? inp.value.trim() : '';
    if (!ans) return;
    if (inp) inp.disabled = true;
    _lockButtons('Submit answer');
    _setButtonRow('');
    _showLoadingBlock();

    var prob = _pendingPractice || {};
    apiInteract({
      phase:      'practice',
      action:     'grade',
      question:   prob.question   || '',
      expected:   prob.expected   || '',
      userAnswer: ans,
    }).then(function (d) {
      _removeLoadingBlock();
      var g  = d.grade || {};
      var fb = (g.correct ? '✓ ' : '✗ ') + (g.feedback || '');
      _appendBlock({ type: 'feedback', content: fb });
      _setButtonRow('practice-next');
    }).catch(_onApiError);
  };

  window.practiceNext = function () {
    _lockButtons('Yes, next problem');
    _practiceIdx++;
    _setButtonRow('');
    _fetchPractice();
  };

  window.practiceDone = function () {
    _lockButtons("I'm done");
    _setButtonRow('');
    _enterMeaning();
  };

  /* ─── Meaning ─────────────────────────────────────────────────── */
  function _enterMeaning() {
    _appendPhaseDivider('Step 4 of 4: Discover the Meaning');
    _setPhase('meaning');
    _showLoadingBlock();
    apiInteract({ phase: 'meaning' })
      .then(function (d) {
        _removeLoadingBlock();
        _appendBlock({ type: 'meaning', content: d.text || '' });
        _setButtonRow('meaning-options');
      }).catch(_onApiError);
  }

  window.meaningOpt = function (opt) {
    if (opt === 'ok') {
      _lockButtons('I understand');
      _setButtonRow('');
      _completeKnobit();
      return;
    }
    var label = { no: "I don't understand", simpler: 'Too simplistic', complex: 'Too complex' }[opt];
    _lockButtons(label);
    var lastContent = _getLastContent(['meaning']);
    _showLoadingBlock();
    apiInteract({ phase: 'meaning', action: opt, original: lastContent })
      .then(function (d) {
        _removeLoadingBlock();
        _appendBlock({ type: 'meaning', content: d.text || '' });
        _setButtonRow('meaning-options');
      }).catch(_onApiError);
  };

  /* ─── Knobit completion ───────────────────────────────────────── */
  function _completeKnobit() {
    _knobitStarted = false;
    var k = KNOBITS[CURRENT_KNOBIT_IDX];
    KNOBIT_DONE_COUNT++;
    apiComplete(k.id);

    if (CURRENT_KNOBIT_IDX + 1 >= KNOBIT_TOTAL) {
      _showUnitComplete();
    } else {
      CURRENT_KNOBIT_IDX++;
      _buildPathView();
      showLmView('lm-path');
    }
  }

  function _showUnitComplete() {
    var t = document.querySelector('.lm-complete-title');
    var s = document.querySelector('.lm-complete-sub');
    if (t) t.textContent = 'Unit complete!';
    if (s) s.textContent = _node ? _node.label : '';

    var stat = document.querySelector('.lm-complete-stats');
    if (stat) {
      var cards = stat.querySelectorAll('.lm-complete-stat');
      if (cards[0]) cards[0].innerHTML = '<div class="lm-stat-num">' + KNOBIT_TOTAL + '</div><div class="lm-stat-label">Knobits</div>';
    }
    showLmView('lm-complete');
  }

  /* ─── Ask bar ─────────────────────────────────────────────────── */
  window.sendAsk = function () {
    var inp = document.getElementById('kn-ask-input');
    var q   = inp ? inp.value.trim() : '';
    if (!q) return;
    if (inp) inp.value = '';

    _appendBlock({ type: 'user', content: q });
    _showLoadingBlock();

    var context = _streamBlocks.slice(-3).map(function (b) { return b.content || ''; }).join(' ');
    apiInteract({ phase: 'ask', question: q, context: context })
      .then(function (d) {
        _removeLoadingBlock();
        _appendBlock({ type: 'note', content: d.text || '' });
        if (_phase === 'explain')  _setButtonRow('explain-options');
        if (_phase === 'meaning')  _setButtonRow('meaning-options');
      }).catch(_onApiError);
  };

  /* ─── Block stream ────────────────────────────────────────────── */
  function _appendPhaseDivider(name) {
    var s = document.getElementById('kn-stream');
    if (!s) return;
    var d    = document.createElement('div');
    d.className = 'phase-divider';
    var span = document.createElement('span');
    span.textContent = name;
    d.appendChild(span);
    s.appendChild(d);
    _scrollStream();
  }

  function _appendBlock(block) {
    var s = document.getElementById('kn-stream');
    if (!s) return null;
    _streamBlocks.push(block);

    var el       = document.createElement('div');
    el.className = 'block block-' + block.type;

    if (block.rawHtml) {
      el.innerHTML = block.rawHtml;
    } else {
      el.textContent = block.content || '';
    }

    el.style.opacity   = '0';
    el.style.transform = 'translateY(8px)';
    s.appendChild(el);
    requestAnimationFrame(function () {
      el.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
      el.style.opacity    = '1';
      el.style.transform  = 'translateY(0)';
    });
    _scrollStream();
    return el;
  }

  function _showLoadingBlock() {
    if (_loading) return;
    _loading = true;
    var s = document.getElementById('kn-stream');
    if (!s) return;
    var d       = document.createElement('div');
    d.id        = 'loading-block';
    d.className = 'block block-loading';
    d.innerHTML = '<span class="loading-dot"></span><span class="loading-dot"></span><span class="loading-dot"></span>';
    s.appendChild(d);
    _scrollStream();
  }

  function _removeLoadingBlock() {
    _loading = false;
    var el = document.getElementById('loading-block');
    if (el) el.remove();
  }

  function _lockButtons(chosenLabel) {
    if (!_streamButtonEl) return;
    _streamButtonEl.classList.add('row-locked');
    _streamButtonEl.querySelectorAll('button').forEach(function (b) {
      b.classList.add('choice-locked');
      b.disabled = true;
    });
  }

  function _getLastContent(types) {
    for (var i = _streamBlocks.length - 1; i >= 0; i--) {
      if (!types || types.indexOf(_streamBlocks[i].type) !== -1) {
        return _streamBlocks[i].content || '';
      }
    }
    return '';
  }

  function _scrollStream() {
    var s = document.getElementById('kn-stream');
    if (!s) return;
    if (s.scrollHeight - s.scrollTop - s.clientHeight < 160) {
      s.scrollTop = s.scrollHeight;
    }
  }

  function _escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _onApiError() {
    _removeLoadingBlock();
    _appendBlock({ type: 'note', content: 'Connection error — please try again.' });
  }

  /* ─── Quit guard ──────────────────────────────────────────────── */
  function _quitGuard(callback) {
    if (!_knobitStarted) { callback(); return; }
    _quitCallback = callback;
    var modal = document.getElementById('quit-knobit-modal');
    if (modal) modal.style.display = 'flex';
  }

  window.tryLeaveKnobit = function () {
    _quitGuard(function () {
      _buildPathView();
      showLmView('lm-path');
    });
  };

  window.tryCloseLearningMode = function () {
    _quitGuard(window.closeLearningMode);
  };

  /* ─── Static event wiring ─────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    var askInp = document.getElementById('kn-ask-input');
    if (askInp) askInp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.sendAsk(); }
    });

    var askSend = document.getElementById('kn-ask-send');
    if (askSend) askSend.addEventListener('click', window.sendAsk);

    var startBtn = document.querySelector('.lm-start-btn');
    if (startBtn) startBtn.addEventListener('click', window.startKnobit);

    var mapBtn = document.querySelector('.lm-complete-btn-primary');
    if (mapBtn) mapBtn.addEventListener('click', window.closeLearningMode);

    var reviewBtn = document.querySelector('.lm-complete-btn-ghost');
    if (reviewBtn) reviewBtn.addEventListener('click', function () { showLmView('lm-path'); });

    var quitConfirm = document.getElementById('quit-modal-confirm');
    if (quitConfirm) quitConfirm.addEventListener('click', function () {
      var modal = document.getElementById('quit-knobit-modal');
      if (modal) modal.style.display = 'none';
      _knobitStarted = false;
      if (_quitCallback) { _quitCallback(); _quitCallback = null; }
    });

    var quitCancel = document.getElementById('quit-modal-cancel');
    if (quitCancel) quitCancel.addEventListener('click', function () {
      var modal = document.getElementById('quit-knobit-modal');
      if (modal) modal.style.display = 'none';
      _quitCallback = null;
    });

    window.addEventListener('beforeunload', function (e) {
      if (_knobitStarted) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  });

})();

/* ─── public namespace ──────────────────────────────────────────
   Other modules call window.Learn.*  — never openLearningMode directly */
window.Learn = {
  open:     window.openLearningMode,
  close:    window.closeLearningMode,
  showView: window.showLmView,
};
