/* ═══════════════════════════════════════════════════════════════
   TEST MODE  —  test.js
   ───────────────────────────────────────────────────────────────
   Owns  : #lm-test view, 4-tier question flow, evaluate, result
   Exposes: window.Test.open(node, crumb)
            window.Test.close()
   Calls  : window.Learn.showView(), window.MapView.refreshProgress()
   Never  : touch app.js internals, learning.js internals,
            or any element outside #lm-test / #learning-mode
   ═══════════════════════════════════════════════════════════════ */

window.Test = (function () {

  /* ─── overlay helpers ───────────────────────────────────────── */
  function _showOverlay() {
    var lm = document.getElementById('learning-mode');
    if (lm) lm.classList.add('active');
    if (window.Learn && window.Learn.showView) window.Learn.showView('lm-test');
    var sw = document.querySelector('.topbar-search-wrap');
    if (sw) sw.style.display = 'none';
  }

  function _hideOverlay() {
    var lm = document.getElementById('learning-mode');
    if (lm) lm.classList.remove('active');
    var sw = document.querySelector('.topbar-search-wrap');
    if (sw) sw.style.display = '';
  }

  /* ─── public API ────────────────────────────────────────────── */
  function open(node, crumb) {
    _showOverlay();
    _start(node, crumb);
  }

  function close() {
    _hideOverlay();
  }

  /* ─── test flow ─────────────────────────────────────────────── */
  function _start(node, crumb) {
    var g = function(id) { return document.getElementById(id); };
    var tmLabel   = g('tm-node-label');
    var stream    = g('tm-stream');
    var result    = g('tm-result');
    var inputArea = g('tm-input-area');
    var answerInput = g('tm-answer-input');
    var submitBtn   = g('tm-submit-btn');
    var progress    = g('tm-progress');

    if (tmLabel)    tmLabel.textContent   = node.label || '';
    if (result)     result.style.display  = 'none';
    if (inputArea)  inputArea.style.display = '';
    if (stream)     stream.innerHTML      = '';
    if (progress)   progress.textContent  = 'Q 1 / 4';

    var state = {
      node:       node,
      crumb:      crumb,
      questionNum: 1,
      history:    [],
      currentQ:   null,
      submitting: false,
    };

    /* append a block to the stream and scroll */
    function block(cls, text) {
      var div = document.createElement('div');
      div.className  = cls;
      div.textContent = text;
      if (stream) {
        stream.appendChild(div);
        if (stream.scrollHeight - stream.scrollTop - stream.clientHeight < 200)
          stream.scrollTop = stream.scrollHeight;
      }
      return div;
    }

    /* fetch + render the next question */
    function loadQ() {
      if (progress)  progress.textContent  = 'Q ' + state.questionNum + ' / 4';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Generating question…'; }

      var ld = block('tm-block tm-question', 'Generating question ' + state.questionNum + ' of 4…');
      ld.style.opacity = '0.45';

      fetch('/api/test/question', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          nodeId:      state.node.id,
          questionNum: state.questionNum,
          history:     state.history,
        }),
      })
        .then(function(r) { return r.json(); })
        .then(function(q) {
          if (ld.parentNode) ld.parentNode.removeChild(ld);
          if (!q || !q.question) {
            block('tm-block tm-error', 'Server error: ' + JSON.stringify(q));
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit answer'; }
            return;
          }
          state.currentQ = q;

          var wrap = document.createElement('div');
          wrap.className = 'tm-block tm-question';

          var tierNames = ['', 'Factual', 'Conceptual', 'Procedural', 'Analytical'];
          var lbl = document.createElement('div');
          lbl.className   = 'tm-block-tier';
          lbl.textContent = 'Q' + state.questionNum + ' — ' + (tierNames[state.questionNum] || '');
          wrap.appendChild(lbl);

          var txt = document.createElement('div');
          txt.className   = 'tm-block-text';
          txt.textContent = q.question;
          wrap.appendChild(txt);

          if (q.type === 'mcq' && q.options && q.options.length) {
            var opts = document.createElement('div');
            opts.className = 'tm-options';
            q.options.forEach(function(opt, i) {
              var row = document.createElement('div');
              row.className   = 'tm-option';
              row.textContent = (i + 1) + '.  ' + opt;
              opts.appendChild(row);
            });
            wrap.appendChild(opts);
            if (answerInput) answerInput.placeholder = 'Enter number (1–' + q.options.length + ')';
          } else {
            if (answerInput) answerInput.placeholder = 'Your answer…';
          }

          if (stream) { stream.appendChild(wrap); stream.scrollTop = stream.scrollHeight; }
          if (answerInput) { answerInput.disabled = false; answerInput.value = ''; answerInput.focus(); }
          if (submitBtn)   { submitBtn.disabled = false; submitBtn.textContent = 'Submit answer'; }
        })
        .catch(function(err) {
          if (ld.parentNode) ld.parentNode.removeChild(ld);
          block('tm-block tm-error', 'Could not load question: ' + (err && err.message ? err.message : 'network error'));
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit answer'; }
        });
    }

    /* submit the typed answer */
    function submitAnswer() {
      if (state.submitting || !state.currentQ) return;
      var answer = answerInput ? answerInput.value.trim() : '';
      if (!answer) return;

      state.submitting = true;
      if (answerInput) answerInput.disabled = true;
      if (submitBtn)   { submitBtn.disabled = true; submitBtn.textContent = 'Evaluating…'; }

      block('tm-block tm-user-answer', answer);
      if (answerInput) answerInput.value = '';

      fetch('/api/test/evaluate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          nodeId:      state.node.id,
          questionNum: state.questionNum,
          question:    state.currentQ.question,
          options:     state.currentQ.options || null,
          userAnswer:  answer,
          history:     state.history,
        }),
      })
        .then(function(r) { return r.json(); })
        .then(function(ev) {
          state.history.push({ question: state.currentQ.question, answer: answer, correct: ev.correct });
          block('tm-block tm-feedback ' + (ev.correct ? 'tm-correct' : 'tm-wrong'),
                (ev.correct ? '✓ ' : '✗ ') + ev.feedback);
          state.submitting = false;

          if (state.questionNum === 4 && ev.finalScore !== undefined) {
            setTimeout(function() { _showResult(ev.finalScore, ev.scoreBreakdown, inputArea, result); }, 900);
          } else {
            state.questionNum++;
            state.currentQ = null;
            if (answerInput) answerInput.disabled = false;
            setTimeout(loadQ, 600);
          }
        })
        .catch(function() {
          block('tm-block tm-error', 'Evaluation failed — please try again.');
          state.submitting = false;
          if (answerInput) answerInput.disabled = false;
          if (submitBtn)   { submitBtn.disabled = false; submitBtn.textContent = 'Submit answer'; }
        });
    }

    /* wire input events */
    if (submitBtn)   submitBtn.onclick   = submitAnswer;
    if (answerInput) answerInput.onkeydown = function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAnswer(); }
    };

    loadQ();
  }

  /* ─── result screen ─────────────────────────────────────────── */
  function _showResult(score, breakdown, inputArea, result) {
    if (inputArea) inputArea.style.display = 'none';
    if (result)    result.style.display    = '';

    var scoreEl = document.getElementById('tm-result-score');
    var bdEl    = document.getElementById('tm-result-breakdown');
    if (scoreEl) {
      scoreEl.textContent  = score + '%';
      scoreEl.style.color  = score >= 80 ? '#8BAD7E' : score >= 50 ? '#C4A55A' : '#C4826A';
    }
    if (bdEl) bdEl.textContent = breakdown || '';

    if (window.MapView && window.MapView.refreshProgress) window.MapView.refreshProgress();
  }

  /* ─── public namespace ──────────────────────────────────────── */
  return { open: open, close: close };

})();
