/* ══════════════════════════════════════════════
   LEARNING MODE  —  js/learning.js
   Block-stream adaptive tutor.
   Exposes: openLearningMode, closeLearningMode,
            showLmView, startKnobit,
            explainOpt, demoOpt,
            practiceNext, practiceDone, meaningOpt
   ══════════════════════════════════════════════ */

(function () {

  /* ─── State ──────────────────────────────────────────────────── */
  var _node  = null;
  var _crumb = '';

  var KNOBITS = [
    { id: 1,  name: 'Division as equal sharing',                   done: true  },
    { id: 2,  name: 'Division as repeated subtraction',            done: true  },
    { id: 3,  name: 'Division as the inverse of multiplication',   done: true  },
    { id: 4,  name: 'Dividend, divisor, quotient, remainder',      done: true  },
    { id: 5,  name: 'Division by 1 and by itself',                 done: true  },
    { id: 6,  name: 'Why division by zero is undefined',           done: true  },
    { id: 7,  name: 'Exact division vs division with remainder',   done: true  },
    { id: 8,  name: 'Short division (single-digit divisor)',       done: true  },
    { id: 9,  name: 'Long division (multi-digit divisor)',         done: true  },
    { id: 10, name: 'Checking division using multiplication',      done: true  },
    { id: 11, name: 'Division extended to fractions and decimals', done: false },
  ];
  var KNOBIT_TOTAL       = 11;
  var KNOBIT_DONE_COUNT  = 10;
  var CURRENT_KNOBIT_IDX = 10;  // 0-based; knobit 11 is the demo knobit
  var DEMO_IDX           = 10;

  var _phase          = null;
  var _blockCounter   = 0;
  var _currentButtons = [];
  var _activeIdx      = null;
  var _byteIdx        = 0;
  var _demoIdx        = 0;
  var _practiceIdx    = 0;

  /* ─── Demo content ───────────────────────────────────────────── */

  var BYTES = [
    'You know how to split 6 apples between 2 friends. You can also split half an apple. Or split 1.5 apples. The idea is the same. Just smaller pieces.',
    'Think of division as asking: “how many fit?” 6 ÷ 2 asks: how many 2s fit in 6? Three. 6 ÷ ½ asks: how many halves fit in 6? Each apple has 2 halves, so 6 apples have 12 halves. Answer: twelve.',
    'This gives us a shortcut. Dividing by a fraction is the same as multiplying by its flip. Flip ½ and you get 2. So 6 ÷ ½ becomes 6 × 2 = 12. Same answer. The flip has a name: the <strong>reciprocal</strong>.',
    'The flip rule works for any fraction divided by any fraction. ½ ÷ ¼ → flip ¼ to get 4 → ½ × 4 = 2. Check: cut a pizza in half, then cut one half into quarters — you get two quarter-slices. ✓',
    'Decimals are just fractions in disguise. 0.5 = ½. 0.25 = ¼. 0.1 = 1⁄10. So 6 ÷ 0.5 is the same problem as 6 ÷ ½ = 12. Nothing new — just a different costume.',
    'There is a faster trick for decimals. Shift the decimal point in both numbers by the same amount until the divisor is whole. 1.2 ÷ 0.4 → shift both one place → 12 ÷ 4 = <strong>3</strong>. You multiplied both by 10. The ratio stays the same, so the answer does not change.'
  ];

  var BYTES_NO = [
    'Think of it this way: if you can cut a pizza into whole slices, you can also cut it into half-slices. Division works the same whether the group size is a whole number or a fraction.',
    'Try a number line. How many groups of 2 fit between 0 and 6? Three. Now count half-steps from 0 to 6: you land on 12. That is 6 ÷ ½ = 12.',
    'The reciprocal is the fraction turned upside down. ½ becomes 2. ¼ becomes 4. ¾ becomes 4/3. Flip it, then multiply. No hidden steps.',
    'Try whole numbers first. 10 ÷ 2 = 5. And 10 × ½ = 5. Same answer. Dividing by 2 is multiplying by ½. The flip rule extends this to every fraction.',
    'Write 0.5 as 5/10 = ½. Every decimal has a fraction twin. Once you see that, decimal division is just fraction division in a different costume.',
    'Think of it as rescaling. 1.2 ÷ 0.4 and 12 ÷ 4 describe the same ratio — one is ten times bigger on both sides. Same factor top and bottom, same answer.'
  ];

  var BYTES_SIMPLE = [
    'One sentence: dividing splits things into equal groups. The group size can be a fraction. That is all.',
    'Core: 6 ÷ ½ asks how many halves are in 6. There are 12. That is division.',
    'Flip the second fraction, then multiply. That is the full rule.',
    'To divide two fractions: flip the one you are dividing by, then multiply.',
    'One line: 0.5 is the same as ½. Dividing by 0.5 and dividing by ½ give the same answer.',
    'Core trick: make the divisor a whole number by shifting both decimal points the same amount.'
  ];

  var BYTES_COMPLEX = [
    'More precisely: division is the inverse of multiplication. For any real a ≠ 0, dividing by a is equivalent to multiplying by its multiplicative inverse 1/a.',
    'Formally: for rationals p/q and r/s (r ≠ 0), (p/q) ÷ (r/s) = (p×s)/(q×r). This is the definition of division as multiplication by the multiplicative inverse.',
    'In field theory: every non-zero rational has a multiplicative inverse. The reciprocal of a/b is b/a, since (a/b)×(b/a) = 1. The flip rule is a direct consequence of this field axiom.',
    'The rationals form a field under + and ×. Division is always defined for non-zero divisors. The flip rule is the field axiom: every non-zero element has a multiplicative inverse.',
    'Formally: 0.d₁d₂…dₙ = (d₁d₂…dₙ)/10ⁿ. Every terminating decimal is rational. Conversion to fraction form and the flip rule are always valid in ℚ.',
    'This applies a÷b = (a·k)÷(b·k) for any k≠0. Choosing k=10ⁿ clears the decimal in the divisor. Equivalent to multiplying the expression by k/k = 1.'
  ];

  var EXAMPLES = [
    {
      label: 'Example 1',
      body:
        'Problem: ¾ ÷ ⅔.<br><br>' +
        '<strong>Step 1</strong> — Flip the divisor: ⅔ becomes <strong>3/2</strong>.<br>' +
        '<strong>Step 2</strong> — Multiply: ¾ × 3/2 = (3×3)/(4×2) = <strong>9/8</strong>.<br>' +
        '<strong>Step 3</strong> — Read it: 9/8 = <strong>1⅛</strong>.',
      footer:
        'What I did: used the flip rule. Sanity check — ⅔ ≈ 0.67 and ¾ = 0.75, so the answer should be just over 1. We got 1⅛. ✓'
    },
    {
      label: 'Example 2',
      body:
        'Problem: 4.5 ÷ 0.15.<br><br>' +
        '<strong>Step 1</strong> — Shift the decimal so the divisor becomes whole. 0.15 needs two places: 0.15 → 15. Shift the dividend the same: 4.5 → 450.<br>' +
        '<strong>Step 2</strong> — Plain division: 450 ÷ 15 = <strong>30</strong>.',
      footer:
        'What I did: multiplied both by 100. The ratio did not change. Sanity check: 0.15 × 30 = 4.5. ✓'
    },
    {
      label: 'Example 3',
      body:
        'Problem: ⅗ ÷ ¼.<br><br>' +
        '<strong>Step 1</strong> — Flip the divisor: ¼ becomes <strong>4</strong>.<br>' +
        '<strong>Step 2</strong> — Multiply: ⅗ × 4 = 12/5.<br>' +
        '<strong>Step 3</strong> — Convert: 12/5 = <strong>2⅖</strong>.',
      footer:
        'What I did: same flip-and-multiply. Check: ⅗ = 0.6, ¼ = 0.25, 0.6/0.25 = 2.4 = 2⅖. ✓'
    }
  ];

  var PROBLEMS = [
    {
      q:        '⅖ ÷ ¾ = ?',
      accepted: ['8/15'],
      correct:  'Correct! ✓ Flip ¾ to get 4/3, then ⅖ × 4/3 = 8/15.',
      wrong:    'Not quite. ⅖ ÷ ¾ → flip ¾ to get 4/3 → ⅖ × 4/3 → numerator 2×4 = 8 → denominator 5×3 = 15. Answer: <strong>8/15</strong>.'
    },
    {
      q:        '5/6 ÷ 2/3 = ?',
      accepted: ['5/4', '1.25', '11/4', '1 1/4', '1¼'],
      correct:  'Correct! 5/6 × 3/2 = 15/12 = 1¼.',
      wrong:    'Not quite. Flip 2/3 → 3/2. Then 5/6 × 3/2 = 15/12 = <strong>1¼</strong>.'
    },
    {
      q:        '7.2 ÷ 0.08 = ?',
      accepted: ['90'],
      correct:  'Correct! ✓ Shift both two places: 7.2 → 720, 0.08 → 8. Then 720 ÷ 8 = 90.',
      wrong:    'Not quite. Shift both two decimal places (divisor becomes whole): 7.2 → 720, 0.08 → 8. Then 720 ÷ 8 = <strong>90</strong>.'
    }
  ];

  var MEANING_BODY =
    'Dividing by fractions and decimals is the foundation of every real-world calculation involving rates, ratios, and scaling. ' +
    'Halving a recipe? You are dividing by a fraction. Converting currencies, computing unit prices (€/kg), ' +
    'figuring out fuel economy (km per litre), pacing a run (min per km) — all of these are division with non-whole numbers. ' +
    'Engineers, cooks, scientists, and anyone reading a nutrition label uses this daily. ' +
    'The flip-and-multiply rule is one of the highest-leverage shortcuts in everyday mathematics: ' +
    'once you have it, you stop being afraid of fractions.';

  var MEANING_NO =
    'Put it this way: almost every quantity outside a classroom is a rate or a ratio — speed, price per unit, concentration, percentage. ' +
    'All of those involve dividing non-whole numbers. The flip-and-multiply rule is the tool for every one of them.';

  var MEANING_SIMPLE =
    'In short: this knobit gives you the arithmetic for real-world rates and ratios. Recipes, prices, speeds, distances — all of them.';

  var MEANING_COMPLEX =
    'Formally: rational arithmetic underpins all measurement. Every physical quantity expressed as a ratio ' +
    '(speed = distance/time, density = mass/volume, pressure = force/area) requires division of non-integer reals. ' +
    'These rules extend directly to dimensional analysis in physics and engineering.';

  var ASK_RULES = [
    {
      keys: ['drawing', 'diagram', 'picture', 'visual', 'show me'],
      fn: function () { _appendDiagram(); }
    },
    {
      keys: ['video', 'youtube'],
      fn: function () {
        _appendBlock('note',
          '<div class="block-body">Try searching YouTube for <strong>“dividing fractions visual”</strong> ' +
          'or <strong>“fraction division explained”</strong>. ' +
          'Khan Academy and 3Blue1Brown both have short, clear explanations.</div>');
      }
    },
    {
      keys: ['2/4', '2 / 4', '2 over 4'],
      fn: function () {
        _appendBlock('byte',
          '<div class="block-label">Your question — dividing by 2/4</div>' +
          '<div class="block-body">Same rule, no exceptions. Dividing by 2/4 means flipping it: 2/4 becomes 4/2 = 2. ' +
          'So x ÷ (2/4) = x × 2. You can also simplify first: 2/4 = ½, so you are dividing by ½, which gives x × 2. ' +
          'Either way, same answer.</div>');
      }
    }
  ];

  /* ─── DOM helper ─────────────────────────────────────────────── */
  function $id(id) { return document.getElementById(id); }

  /* ─── PUBLIC: overlay ────────────────────────────────────────── */
  window.openLearningMode = function (node, crumb) {
    _node  = node;
    _crumb = crumb || '';
    var lm  = $id('learning-mode');
    var hex = (node && node.color) ? node.color : '#C4826A';
    lm.style.setProperty('--lm-accent', hex);
    lm.style.setProperty('--lm-accent-soft', _rgba(hex, 0.13));
    _buildPathView();
    lm.classList.add('active');
    showLmView('lm-path');
  };

  window.closeLearningMode = function () {
    $id('learning-mode').classList.remove('active');
  };

  window.showLmView = function (id) {
    document.querySelectorAll('.lm-view').forEach(function (v) {
      v.classList.remove('active');
    });
    var t = $id(id);
    if (t) t.classList.add('active');
  };

  /* ─── VIEW 1: path ───────────────────────────────────────────── */
  function _buildPathView() {
    $id('lm-path-crumb').textContent =
      _crumb || 'Mathematics › Pure Mathematics › Arithmetic › Basic Operations';
    $id('lm-path-title').textContent =
      (_node && _node.name) ? _node.name : 'Division';

    var pct = Math.round(KNOBIT_DONE_COUNT / KNOBIT_TOTAL * 100);
    $id('lm-progress-fill').style.width = pct + '%';
    $id('lm-progress-label').textContent = pct + '% complete — keep going!';

    $id('lm-start-btn-label').textContent =
      'Start · Knobit ' + KNOBITS[CURRENT_KNOBIT_IDX].id;

    var list = $id('lm-knobit-list');
    list.innerHTML = '';
    KNOBITS.forEach(function (kb, i) {
      var isDone    = kb.done;
      var isCurrent = (i === CURRENT_KNOBIT_IDX);
      var isLocked  = !isDone && !isCurrent;

      var item = document.createElement('div');
      item.className = 'lm-knobit-item' +
        (isDone ? ' done' : '') +
        (isCurrent ? ' current' : '') +
        (isLocked  ? ' locked' : '');

      var ix = document.createElement('div');
      ix.className = 'kn-index';
      ix.innerHTML = isDone
        ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none">' +
          '<path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.6" ' +
          'stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : String(kb.id);

      var info = document.createElement('div');
      info.className = 'kn-info';
      info.innerHTML = '<div class="kn-name">' + _esc(kb.name) + '</div>';

      item.appendChild(ix);
      item.appendChild(info);

      if (!isLocked) {
        var arr = document.createElement('svg');
        arr.setAttribute('class', 'kn-arrow');
        arr.setAttribute('width', '14'); arr.setAttribute('height', '14');
        arr.setAttribute('viewBox', '0 0 14 14'); arr.setAttribute('fill', 'none');
        arr.innerHTML = '<path d="M5 3l4 4-4 4" stroke="currentColor" ' +
          'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>';
        item.appendChild(arr);

        (function (idx) {
          item.addEventListener('click', function () { window.startKnobit(idx); });
        })(i);
      }

      list.appendChild(item);
    });
  }

  /* ─── PUBLIC: start knobit ───────────────────────────────────── */
  window.startKnobit = function (idx) {
    _activeIdx = (idx !== undefined) ? idx : CURRENT_KNOBIT_IDX;
    showLmView('lm-knobit');
    _initKnobit(_activeIdx);
  };

  /* ─── VIEW 2 INIT ────────────────────────────────────────────── */
  function _initKnobit(idx) {
    $id('kn-stream').innerHTML = '';
    _clearButtons();
    _blockCounter = 0;
    _byteIdx      = 0;
    _demoIdx      = 0;
    _practiceIdx  = 0;

    var kb = KNOBITS[idx];
    $id('lm-knobit-nav-label').textContent = kb.name;
    $id('kn-progress-fill-bar').style.width = '0%';
    _setChips(null);

    if (idx === DEMO_IDX) {
      _startExplain();
    } else {
      _appendBlock('note',
        '<div class="block-body">Review content for this knobit is not yet in the demo build. ' +
        'The full version will allow you to revisit any completed knobit.</div>');
      _setButtons([
        { text: '← Back to path', action: function () { showLmView('lm-path'); } }
      ]);
    }
  }

  /* ─── BLOCK STREAM ───────────────────────────────────────────── */
  function _bid() { return 'blk-' + (++_blockCounter); }

  function _appendBlock(type, html) {
    var el  = document.createElement('div');
    var cls = 'block';
    if      (type === 'byte')     cls += ' block-byte';
    else if (type === 'example')  cls += ' block-example';
    else if (type === 'practice') cls += ' block-practice';
    else if (type === 'feedback-ok')  cls += ' block-feedback feedback-correct';
    else if (type === 'feedback-no')  cls += ' block-feedback feedback-incorrect';
    else if (type === 'meaning')  cls += ' block-meaning';
    else if (type === 'user')     cls += ' block-user';
    else if (type === 'note')     cls += ' block-note';
    else if (type === 'diagram')  cls += ' block-diagram';
    el.className = cls;
    el.id = _bid();
    if (type === 'user') el.textContent = html;
    else el.innerHTML = html;
    $id('kn-stream').appendChild(el);
    _autoScroll();
    return el;
  }

  function _appendDivider(label) {
    var el = document.createElement('div');
    el.className = 'phase-divider';
    el.innerHTML = '<span>' + _esc(label) + '</span>';
    $id('kn-stream').appendChild(el);
    _autoScroll();
  }

  function _lockLast(chosenText) {
    var stream   = $id('kn-stream');
    var selector = '.block-byte,.block-example,.block-feedback,.block-meaning';
    var all  = stream.querySelectorAll(selector);
    var last = all[all.length - 1];
    if (!last) {
      /* fallback: any .block that is not user/note */
      var blocks = stream.querySelectorAll('.block');
      for (var i = blocks.length - 1; i >= 0; i--) {
        if (!blocks[i].classList.contains('block-user') &&
            !blocks[i].classList.contains('block-note') &&
            !blocks[i].classList.contains('block-diagram')) {
          last = blocks[i]; break;
        }
      }
    }
    if (last) {
      var ind = document.createElement('div');
      ind.className = 'choice-indicator';
      ind.innerHTML = '✓ ' + _esc(chosenText);
      last.appendChild(ind);
    }
  }

  function _autoScroll() {
    var s = $id('kn-stream');
    if ((s.scrollHeight - s.scrollTop - s.clientHeight) < 120) {
      setTimeout(function () { s.scrollTop = s.scrollHeight; }, 160);
    }
  }

  /* ─── BUTTONS ────────────────────────────────────────────────── */
  function _setButtons(cfg) {
    _currentButtons = cfg;
    var row = $id('kn-button-row');
    row.innerHTML = '';
    cfg.forEach(function (b) {
      var el = document.createElement('button');
      el.className = 'btn' +
        (b.primary   ? ' btn-primary'   : '') +
        (b.secondary ? ' btn-secondary' : '');
      el.textContent = b.text;
      el.addEventListener('click', b.action);
      row.appendChild(el);
    });
  }

  function _clearButtons() {
    _currentButtons = [];
    var row = $id('kn-button-row');
    if (row) row.innerHTML = '';
  }

  /* ─── CHIPS ──────────────────────────────────────────────────── */
  var _PHASES = ['explain', 'demonstrate', 'practice', 'meaning'];

  function _setChips(active) {
    var ai = _PHASES.indexOf(active);
    _PHASES.forEach(function (ph, i) {
      var c = $id('chip-' + ph);
      if (!c) return;
      c.classList.remove('active', 'done-chip');
      if (i === ai)     c.classList.add('active');
      else if (i < ai)  c.classList.add('done-chip');
    });
  }

  function _setProgress(pct) {
    var f = $id('kn-progress-fill-bar');
    if (f) f.style.width = pct + '%';
  }

  function _enterPhase(phase) {
    _phase = phase;
    _setChips(phase);
    var p = { explain: 0, demonstrate: 25, practice: 50, meaning: 75 };
    _setProgress(p[phase] || 0);
    var l = { explain: 'Explain', demonstrate: 'Demonstrate', practice: 'Practice', meaning: 'Meaning' };
    _appendDivider(l[phase]);
  }

  /* ─── PHASE: EXPLAIN ─────────────────────────────────────────── */
  function _startExplain() {
    _byteIdx = 0;
    _enterPhase('explain');
    _showByte(_byteIdx, 'main');
  }

  function _showByte(idx, variant) {
    var text = (variant === 'no')      ? BYTES_NO[idx]
             : (variant === 'simple')  ? BYTES_SIMPLE[idx]
             : (variant === 'complex') ? BYTES_COMPLEX[idx]
             : BYTES[idx];
    var suffix = (variant !== 'main') ? ' — alternate' : '';
    _appendBlock('byte',
      '<div class="block-label">Byte ' + (idx + 1) + suffix + '</div>' +
      '<div class="block-body">' + text + '</div>');
    _setButtons([
      { text: 'I understand',         primary: true, action: function () { window.explainOpt('ok'); } },
      { text: 'I don’t understand',           action: function () { window.explainOpt('no'); } },
      { text: 'Too simplistic',                    action: function () { window.explainOpt('simple'); } },
      { text: 'Too complex',                       action: function () { window.explainOpt('complex'); } }
    ]);
  }

  window.explainOpt = function (opt) {
    var labels = { ok: 'I understand', no: 'I don’t understand', simple: 'Too simplistic', complex: 'Too complex' };
    _lockLast(labels[opt]);
    _clearButtons();
    if (opt === 'ok') {
      _byteIdx++;
      if (_byteIdx < BYTES.length) _showByte(_byteIdx, 'main');
      else _startDemonstrate();
    } else {
      _showByte(_byteIdx, opt);
    }
  };

  /* ─── PHASE: DEMONSTRATE ─────────────────────────────────────── */
  function _startDemonstrate() {
    _demoIdx = 0;
    _enterPhase('demonstrate');
    _showExample(0);
  }

  function _showExample(idx) {
    var ex = EXAMPLES[idx];
    _appendBlock('example',
      '<div class="block-label">' + _esc(ex.label) + '</div>' +
      '<div class="block-body">' + ex.body + '</div>' +
      '<div class="block-example-footer">' + ex.footer + '</div>');
    if (idx === 0) {
      _setButtons([
        { text: 'View next example', primary: true, action: function () { window.demoOpt('next'); } }
      ]);
    } else if (idx === 1) {
      _setButtons([
        { text: 'I understand, no more examples needed', primary: true,  action: function () { window.demoOpt('ok'); } },
        { text: 'I don’t understand, give me another', secondary: true, action: function () { window.demoOpt('another'); } }
      ]);
    } else {
      _setButtons([
        { text: 'I understand, ready to practice', primary: true,  action: function () { window.demoOpt('ok'); } },
        { text: 'Still don’t understand',        secondary: true, action: function () { window.demoOpt('stuck'); } }
      ]);
    }
  }

  window.demoOpt = function (opt) {
    var choiceMap = {
      next:    'View next example',
      another: 'I don’t understand, give me another',
      ok:      _demoIdx === 1 ? 'I understand, no more examples needed' : 'I understand, ready to practice',
      stuck:   'Still don’t understand'
    };
    _lockLast(choiceMap[opt] || opt);
    _clearButtons();

    if (opt === 'next') {
      _demoIdx = 1; _showExample(1);
    } else if (opt === 'another') {
      _demoIdx = 2; _showExample(2);
    } else if (opt === 'ok') {
      _startPractice();
    } else if (opt === 'stuck') {
      _appendBlock('note',
        '<div class="block-body">Try searching YouTube for ' +
        '<strong>“dividing fractions visual”</strong>. ' +
        'Continuing to Practice — you can return to Demonstrate any time.</div>');
      setTimeout(function () { _startPractice(); }, 1500);
    }
  };

  /* ─── PHASE: PRACTICE ────────────────────────────────────────── */
  function _startPractice() {
    _practiceIdx = 0;
    _enterPhase('practice');
    _showProblem(0);
  }

  function _showProblem(idx) {
    var p   = PROBLEMS[idx];
    var bid = 'pblk-' + (++_blockCounter);
    var el  = document.createElement('div');
    el.className = 'block block-practice';
    el.id = bid;
    el.innerHTML =
      '<div class="block-label">Problem ' + (idx + 1) + '</div>' +
      '<div class="block-body">' + p.q + '</div>' +
      '<div class="practice-input-wrap">' +
        '<input class="practice-input" type="text" placeholder="Your answer…" autocomplete="off">' +
        '<button class="practice-submit">Check</button>' +
      '</div>';
    $id('kn-stream').appendChild(el);
    _autoScroll();
    _clearButtons();

    var inp = el.querySelector('.practice-input');
    var btn = el.querySelector('.practice-submit');
    btn.addEventListener('click', function () { _submitAnswer(idx, el, inp); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') _submitAnswer(idx, el, inp);
    });
  }

  function _submitAnswer(probIdx, blockEl, inp) {
    if (inp.disabled) return;
    var raw = inp.value.trim();
    inp.disabled = true;
    blockEl.querySelector('.practice-submit').disabled = true;

    var echo = document.createElement('div');
    echo.className = 'practice-echo';
    echo.textContent = raw || '(no answer)';
    blockEl.appendChild(echo);

    var prob       = PROBLEMS[probIdx];
    var normalised = raw.toLowerCase().replace(/\s/g, '');
    var correct    = prob.accepted.some(function (a) {
      return normalised === a.toLowerCase().replace(/\s/g, '');
    });

    _appendBlock(correct ? 'feedback-ok' : 'feedback-no',
      '<div class="block-label">' + (correct ? 'Correct ✓' : 'Not quite') + '</div>' +
      '<div class="block-body">' + (correct ? prob.correct : prob.wrong) + '</div>');

    _setButtons([
      { text: 'Yes, next problem', primary: true, action: function () { window.practiceNext(); } },
      { text: 'No, I’m done',               action: function () { window.practiceDone(); } }
    ]);
    _autoScroll();
  }

  window.practiceNext = function () {
    _lockLast('Yes, next problem');
    _clearButtons();
    _practiceIdx++;
    if (_practiceIdx < PROBLEMS.length) _showProblem(_practiceIdx);
    else _startMeaning();
  };

  window.practiceDone = function () {
    _lockLast('No, I’m done');
    _clearButtons();
    _startMeaning();
  };

  /* ─── PHASE: MEANING ─────────────────────────────────────────── */
  function _startMeaning() {
    _enterPhase('meaning');
    _appendBlock('meaning',
      '<div class="block-label">Why this matters</div>' +
      '<div class="block-body">' + MEANING_BODY + '</div>');
    _showMeaningButtons();
  }

  function _showMeaningButtons() {
    _setButtons([
      { text: 'I understand',         primary: true, action: function () { window.meaningOpt('ok'); } },
      { text: 'I don’t understand',           action: function () { window.meaningOpt('no'); } },
      { text: 'Too simplistic',                    action: function () { window.meaningOpt('simple'); } },
      { text: 'Too complex',                       action: function () { window.meaningOpt('complex'); } }
    ]);
  }

  window.meaningOpt = function (opt) {
    var labels = { ok: 'I understand', no: 'I don’t understand', simple: 'Too simplistic', complex: 'Too complex' };
    _lockLast(labels[opt]);
    _clearButtons();
    if (opt === 'ok') {
      _completeKnobit();
    } else {
      var t = (opt === 'no') ? MEANING_NO : (opt === 'simple') ? MEANING_COMPLEX : MEANING_SIMPLE;
      _appendBlock('meaning',
        '<div class="block-label">Why this matters — alternate</div>' +
        '<div class="block-body">' + t + '</div>');
      _showMeaningButtons();
    }
  };

  /* ─── COMPLETE ───────────────────────────────────────────────── */
  function _completeKnobit() {
    _setProgress(100);
    KNOBITS[_activeIdx].done = true;
    KNOBIT_DONE_COUNT = KNOBITS.filter(function (k) { return k.done; }).length;

    var next = null;
    for (var i = 0; i < KNOBITS.length; i++) {
      if (!KNOBITS[i].done) { next = i; break; }
    }
    CURRENT_KNOBIT_IDX = (next !== null) ? next : KNOBITS.length - 1;
    setTimeout(function () { showLmView('lm-complete'); }, 400);
  }

  /* ─── ASK BAR ────────────────────────────────────────────────── */
  function _handleAsk(text) {
    if (!text || !text.trim()) return;
    $id('ask-input').value = '';

    _appendBlock('user', text);

    var saved = _currentButtons.slice();
    _clearButtons();

    var lower   = text.toLowerCase();
    var matched = false;
    for (var i = 0; i < ASK_RULES.length; i++) {
      if (ASK_RULES[i].keys.some(function (k) { return lower.indexOf(k) !== -1; })) {
        ASK_RULES[i].fn();
        matched = true;
        break;
      }
    }
    if (!matched) {
      _appendBlock('note',
        '<div class="block-body">In the live version, the tutor would answer this. ' +
        '<em>(Demo mode — only a few specific questions are recognised.)</em></div>');
    }

    setTimeout(function () { _setButtons(saved); }, 60);
  }

  function _appendDiagram() {
    _appendBlock('diagram',
      '<div class="block-label">Visual — 6 ÷ ½</div>' +
      '<div class="block-body" style="margin-bottom:10px">6 whole apples, each split into halves:</div>' +
      '<pre>' +
'  Apples:  [ 1 ]  [ 2 ]  [ 3 ]  [ 4 ]  [ 5 ]  [ 6 ]\n' +
'\n' +
'  Halves:  [½½] [½½] [½½] [½½] [½½] [½½]  = 12 halves\n' +
'\n' +
'  6 ÷ ½  =  6 × 2  =  12  ✓' +
      '</pre>' +
      '<div class="block-body">Flip rule: dividing by ½ is multiplying by 2.</div>');
  }

  /* ─── Wire ask bar ───────────────────────────────────────────── */
  var _askInput = $id('ask-input');
  var _askSend  = $id('ask-send');
  if (_askSend)  _askSend.addEventListener('click', function () { _handleAsk(_askInput.value); });
  if (_askInput) _askInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') _handleAsk(_askInput.value);
  });

  /* ─── Util ───────────────────────────────────────────────────── */
  function _rgba(hex, a) {
    var r = parseInt(hex.slice(1,3), 16);
    var g = parseInt(hex.slice(3,5), 16);
    var b = parseInt(hex.slice(5,7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

})();
