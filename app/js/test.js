/* ══════════════════════════════════════════════
   TEST MODE  —  js/test.js
   4-Tier Knowledge Diagnostic
   #lm-test lives inside #learning-mode (shown by app.js onclick).
   Exposes: window.initTest(node, crumb)   — set up state + load Q1
            window.closeTestMode()         — called by back buttons
   ══════════════════════════════════════════════ */

(function () {

  /* ─── State ──────────────────────────────────────────────────── */
  var _node        = null;
  var _crumb       = '';
  var _questionNum = 1;
  var _history     = [];
  var _currentQ    = null;
  var _submitting  = false;

  function el(id) { return document.getElementById(id); }

  /* ─── Entry / exit ────────────────────────────────────────────── */
  window.initTest = function (node, crumb) {
    _node        = node;
    _crumb       = crumb || '';
    _questionNum = 1;
    _history     = [];
    _currentQ    = null;
    _submitting  = false;

    var stream      = el('tm-stream');
    var resultDiv   = el('tm-result');
    var inputArea   = el('tm-input-area');
    var answerInput = el('tm-answer-input');
    var nodeLabelEl = el('tm-node-label');

    if (stream)      stream.innerHTML = '';
    if (resultDiv)   resultDiv.style.display = 'none';
    if (inputArea)   inputArea.style.display = '';
    if (answerInput) { answerInput.value = ''; answerInput.disabled = false; }
    if (nodeLabelEl) nodeLabelEl.textContent = node.label || '';

    _updateProgress();
    _loadQuestion();
  };

  window.closeTestMode = function () {
    if (typeof window.closeLearningMode === 'function') window.closeLearningMode();
    _node = null;
  };

  /* ─── Load next question ─────────────────────────────────────── */
  function _loadQuestion() {
    _setInputLoading(true, 'Generating question ' + _questionNum + ' of 4');
    fetch('/api/test/question', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nodeId: _node.id, questionNum: _questionNum, history: _history }),
    })
      .then(function (r) { return r.json(); })
      .then(function (q) {
        _currentQ = q;
        _setInputLoading(false);
        _appendQuestion(q);
        _updateProgress();
        var inp = el('tm-answer-input');
        if (inp) inp.focus();
      })
      .catch(function () {
        _setInputLoading(false);
        _appendError('Could not generate question — please try again.');
      });
  }

  /* ─── Submit answer ──────────────────────────────────────────── */
  function _submitAnswer() {
    if (_submitting || !_currentQ) return;
    var answerInput = el('tm-answer-input');
    var answer = answerInput ? answerInput.value.trim() : '';
    if (!answer) return;

    _submitting = true;
    if (answerInput) answerInput.disabled = true;
    _setInputLoading(true, 'Evaluating your answer');
    _appendAnswer(answer);
    if (answerInput) answerInput.value = '';

    fetch('/api/test/evaluate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        nodeId: _node.id, questionNum: _questionNum,
        question: _currentQ.question, options: _currentQ.options || null,
        userAnswer: answer, history: _history,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (ev) {
        _history.push({ question: _currentQ.question, answer: answer, correct: ev.correct });
        _appendFeedback(ev.feedback, ev.correct);
        _setInputLoading(false);
        _submitting = false;

        if (_questionNum === 4 && ev.finalScore !== undefined) {
          setTimeout(function () { _showResult(ev.finalScore, ev.scoreBreakdown); }, 900);
        } else {
          _questionNum++;
          _updateProgress();
          if (answerInput) answerInput.disabled = false;
          var sb = el('tm-submit-btn');
          if (sb) sb.disabled = false;
          setTimeout(_loadQuestion, 600);
        }
      })
      .catch(function () {
        _appendError('Evaluation failed — please try again.');
        _setInputLoading(false);
        _submitting = false;
        var ai = el('tm-answer-input'), sb = el('tm-submit-btn');
        if (ai) ai.disabled = false;
        if (sb) sb.disabled = false;
      });
  }

  /* ─── Result screen ──────────────────────────────────────────── */
  function _showResult(score, breakdown) {
    var inputArea = el('tm-input-area');
    var resultDiv = el('tm-result');
    var scoreEl   = el('tm-result-score');
    var bdEl      = el('tm-result-breakdown');

    if (inputArea) inputArea.style.display = 'none';
    if (resultDiv) resultDiv.style.display = '';
    if (scoreEl)   scoreEl.textContent = score + '%';
    if (bdEl)      bdEl.textContent    = breakdown || '';
    if (scoreEl)   scoreEl.style.color = score >= 80 ? '#8BAD7E' : score >= 50 ? '#C4A55A' : '#C4826A';

    if (typeof window.refreshProgress === 'function') window.refreshProgress();
  }

  /* ─── Helpers ────────────────────────────────────────────────── */
  function _updateProgress() {
    var p = el('tm-progress');
    if (p) p.textContent = 'Q ' + _questionNum + ' / 4';
  }

  function _appendQuestion(q) {
    var stream = el('tm-stream');
    if (!stream) return;
    var wrap = document.createElement('div');
    wrap.className = 'tm-block tm-question';

    var tierNames = ['', 'Factual', 'Conceptual', 'Procedural', 'Analytical'];
    var lbl = document.createElement('div');
    lbl.className = 'tm-block-tier';
    lbl.textContent = 'Q' + _questionNum + ' — ' + (tierNames[_questionNum] || '');
    wrap.appendChild(lbl);

    var text = document.createElement('div');
    text.className = 'tm-block-text';
    text.textContent = q.question;
    wrap.appendChild(text);

    var inp = el('tm-answer-input');
    if (q.type === 'mcq' && q.options && q.options.length) {
      var opts = document.createElement('div');
      opts.className = 'tm-options';
      q.options.forEach(function (opt, i) {
        var row = document.createElement('div');
        row.className = 'tm-option';
        row.textContent = (i + 1) + '.  ' + opt;
        opts.appendChild(row);
      });
      wrap.appendChild(opts);
      if (inp) inp.placeholder = 'Enter the number of your answer (1–' + q.options.length + ')';
    } else {
      if (inp) inp.placeholder = 'Your answer…';
    }

    _fadeIn(wrap, stream);
    _scrollStream(stream);
  }

  function _appendAnswer(text) {
    var stream = el('tm-stream');
    if (!stream) return;
    var div = document.createElement('div');
    div.className = 'tm-block tm-user-answer';
    div.textContent = text;
    _fadeIn(div, stream);
    _scrollStream(stream);
  }

  function _appendFeedback(text, correct) {
    var stream = el('tm-stream');
    if (!stream) return;
    var div = document.createElement('div');
    div.className = 'tm-block tm-feedback ' + (correct ? 'tm-correct' : 'tm-wrong');
    div.textContent = (correct ? '✓ ' : '✗ ') + text;
    _fadeIn(div, stream);
    _scrollStream(stream);
  }

  function _appendError(text) {
    var stream = el('tm-stream');
    if (!stream) return;
    var div = document.createElement('div');
    div.className = 'tm-block tm-error';
    div.textContent = text;
    _fadeIn(div, stream);
    _scrollStream(stream);
  }

  function _setInputLoading(on, label) {
    var sb = el('tm-submit-btn');
    if (!sb) return;
    sb.disabled = on;
    if (on) {
      sb.innerHTML =
        '<span style="opacity:0.75;font-size:12px">' + (label || 'Loading') + '</span>' +
        '<span class="sb-learn-dots"><span class="sb-learn-dot"></span>' +
        '<span class="sb-learn-dot"></span><span class="sb-learn-dot"></span></span>';
    } else {
      sb.textContent = 'Submit answer';
    }
  }

  function _fadeIn(div, stream) {
    div.style.opacity = '0';
    div.style.transform = 'translateY(8px)';
    stream.appendChild(div);
    requestAnimationFrame(function () {
      div.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
      div.style.opacity = '1';
      div.style.transform = 'translateY(0)';
    });
  }

  function _scrollStream(stream) {
    if (stream.scrollHeight - stream.scrollTop - stream.clientHeight < 180) {
      stream.scrollTop = stream.scrollHeight;
    }
  }

  /* ─── Event wiring ────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    if (e.target === el('tm-submit-btn')) _submitAnswer();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && document.activeElement === el('tm-answer-input')) {
      e.preventDefault();
      _submitAnswer();
    }
  });

})();
