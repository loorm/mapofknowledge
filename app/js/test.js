/* ══════════════════════════════════════════════
   TEST MODE  —  js/test.js
   4-Tier Knowledge Diagnostic
   Exposes: window.openTestMode(node, crumb)
            window.closeTestMode()
   ══════════════════════════════════════════════ */

(function () {

  /* ─── State ──────────────────────────────────────────────────── */
  var _node         = null;
  var _crumb        = '';
  var _questionNum  = 1;
  var _history      = [];          // [{question, answer, correct}]
  var _currentQ     = null;        // {question, type, options}
  var _searchWrap   = null;
  var _submitting   = false;

  /* ─── DOM refs ────────────────────────────────────────────────── */
  var overlay    = document.getElementById('test-mode');
  var stream     = document.getElementById('tm-stream');
  var inputArea  = document.getElementById('tm-input-area');
  var answerInput= document.getElementById('tm-answer-input');
  var submitBtn  = document.getElementById('tm-submit-btn');
  var resultDiv  = document.getElementById('tm-result');
  var progressEl = document.getElementById('tm-progress');
  var nodeLabelEl= document.getElementById('tm-node-label');

  /* ─── Entry / exit ────────────────────────────────────────────── */
  window.openTestMode = function (node, crumb) {
    _node        = node;
    _crumb       = crumb || '';
    _questionNum = 1;
    _history     = [];
    _currentQ    = null;

    // Hide search box (same as learning mode)
    _searchWrap = document.querySelector('.topbar-search-wrap');
    if (_searchWrap) _searchWrap.style.display = 'none';

    // Reset UI
    stream.innerHTML      = '';
    resultDiv.style.display = 'none';
    inputArea.style.display = '';
    answerInput.value     = '';
    answerInput.disabled  = false;

    if (nodeLabelEl) nodeLabelEl.textContent = node.label || '';
    _updateProgress();

    overlay.classList.add('active');
    _loadQuestion();
  };

  window.closeTestMode = function () {
    overlay.classList.remove('active');
    if (_searchWrap) { _searchWrap.style.display = ''; _searchWrap = null; }
    _node = null;
  };

  /* ─── Load next question ─────────────────────────────────────── */
  function _loadQuestion() {
    _setInputLoading(true, 'Generating question ' + _questionNum + ' of 4');
    fetch('/api/test/question', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        nodeId:      _node.id,
        questionNum: _questionNum,
        history:     _history,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (q) {
        _currentQ = q;
        _setInputLoading(false);
        _appendQuestion(q);
        _updateProgress();
        answerInput.focus();
      })
      .catch(function () {
        _setInputLoading(false);
        _appendError('Could not generate question — please try again.');
      });
  }

  /* ─── Submit answer ──────────────────────────────────────────── */
  function _submitAnswer() {
    if (_submitting || !_currentQ) return;
    var answer = answerInput.value.trim();
    if (!answer) return;

    _submitting = true;
    answerInput.disabled = true;
    submitBtn.disabled   = true;

    _appendAnswer(answer);
    answerInput.value = '';
    _setInputLoading(true, 'Evaluating your answer');

    fetch('/api/test/evaluate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        nodeId:      _node.id,
        questionNum: _questionNum,
        question:    _currentQ.question,
        options:     _currentQ.options || null,
        userAnswer:  answer,
        history:     _history,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (ev) {
        _history.push({
          question: _currentQ.question,
          answer:   answer,
          correct:  ev.correct,
        });

        _appendFeedback(ev.feedback, ev.correct);
        _setInputLoading(false);
        _submitting = false;

        if (_questionNum === 4 && ev.finalScore !== undefined) {
          // Test complete
          setTimeout(function () { _showResult(ev.finalScore, ev.scoreBreakdown); }, 900);
        } else {
          _questionNum++;
          _updateProgress();
          answerInput.disabled = false;
          submitBtn.disabled   = false;
          setTimeout(_loadQuestion, 600);
        }
      })
      .catch(function () {
        _appendError('Evaluation failed — please try again.');
        _setInputLoading(false);
        _submitting   = false;
        answerInput.disabled = false;
        submitBtn.disabled   = false;
      });
  }

  /* ─── Result screen ──────────────────────────────────────────── */
  function _showResult(score, breakdown) {
    inputArea.style.display = 'none';
    resultDiv.style.display = '';

    var scoreEl = document.getElementById('tm-result-score');
    var bdEl    = document.getElementById('tm-result-breakdown');

    if (scoreEl) scoreEl.textContent = score + '%';
    if (bdEl)    bdEl.textContent    = breakdown || '';

    // Colour score by bracket
    if (scoreEl) {
      scoreEl.style.color = score >= 80 ? '#8BAD7E' : score >= 50 ? '#C4A55A' : '#C4826A';
    }

    // Refresh map progress overlay if available
    if (typeof window.refreshProgress === 'function') window.refreshProgress();
  }

  /* ─── Progress indicator ─────────────────────────────────────── */
  function _updateProgress() {
    if (progressEl) progressEl.textContent = 'Q ' + _questionNum + ' / 4';
  }

  /* ─── Stream block builders ──────────────────────────────────── */
  function _appendQuestion(q) {
    var wrap = document.createElement('div');
    wrap.className = 'tm-block tm-question';

    var tierNames = ['', 'Factual', 'Conceptual', 'Procedural', 'Analytical'];
    var label = document.createElement('div');
    label.className   = 'tm-block-tier';
    label.textContent = 'Q' + _questionNum + ' — ' + (tierNames[_questionNum] || '');
    wrap.appendChild(label);

    var text = document.createElement('div');
    text.className   = 'tm-block-text';
    text.textContent = q.question;
    wrap.appendChild(text);

    if (q.type === 'mcq' && q.options && q.options.length) {
      var opts = document.createElement('div');
      opts.className = 'tm-options';
      q.options.forEach(function (opt, i) {
        var row = document.createElement('div');
        row.className   = 'tm-option';
        row.textContent = (i + 1) + '.  ' + opt;
        opts.appendChild(row);
      });
      wrap.appendChild(opts);
      answerInput.placeholder = 'Enter the number of your answer (1–' + q.options.length + ')';
    } else {
      answerInput.placeholder = 'Your answer…';
    }

    _fadeIn(wrap);
    stream.appendChild(wrap);
    _scrollStream();
  }

  function _appendAnswer(text) {
    var el = document.createElement('div');
    el.className   = 'tm-block tm-user-answer';
    el.textContent = text;
    _fadeIn(el);
    stream.appendChild(el);
    _scrollStream();
  }

  function _appendFeedback(text, correct) {
    var el = document.createElement('div');
    el.className   = 'tm-block tm-feedback ' + (correct ? 'tm-correct' : 'tm-wrong');
    el.textContent = (correct ? '✓ ' : '✗ ') + text;
    _fadeIn(el);
    stream.appendChild(el);
    _scrollStream();
  }

  function _appendError(text) {
    var el = document.createElement('div');
    el.className   = 'tm-block tm-error';
    el.textContent = text;
    _fadeIn(el);
    stream.appendChild(el);
    _scrollStream();
  }

  function _setInputLoading(on, label) {
    submitBtn.disabled = on;
    if (on) {
      submitBtn.innerHTML =
        '<span style="opacity:0.75;font-size:12px">' + (label || 'Loading') + '</span>' +
        '<span class="sb-learn-dots">' +
        '<span class="sb-learn-dot"></span>' +
        '<span class="sb-learn-dot"></span>' +
        '<span class="sb-learn-dot"></span>' +
        '</span>';
    } else {
      submitBtn.textContent = 'Submit answer';
    }
  }

  function _fadeIn(el) {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(8px)';
    stream.appendChild(el);
    requestAnimationFrame(function () {
      el.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
      el.style.opacity    = '1';
      el.style.transform  = 'translateY(0)';
    });
  }

  function _scrollStream() {
    if (stream.scrollHeight - stream.scrollTop - stream.clientHeight < 180) {
      stream.scrollTop = stream.scrollHeight;
    }
  }

  /* ─── Event wiring ────────────────────────────────────────────── */
  document.getElementById('tm-back').addEventListener('click', window.closeTestMode);
  document.getElementById('tm-result-back').addEventListener('click', window.closeTestMode);

  submitBtn.addEventListener('click', _submitAnswer);
  answerInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _submitAnswer(); }
  });

})();
