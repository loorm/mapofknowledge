/* ═══════════════════════════════════════════════════════════════
   ONBOARDING TOUR  —  tour.js
   ───────────────────────────────────────────────────────────────
   Self-contained 5-step product tour. No external dependencies.
   Roll back: remove tour.css + tour.js from index.html.
   Exposes: window.Tour.start()  window.Tour.restart()
            window._tourCheckAutoStart(settings)
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var _step = 0;
  var _overlay, _spot, _tip;

  /* ─── Step definitions ─────────────────────────────────────── */
  var STEPS = [
    {
      target:   null,
      position: 'bottom-center',
      title:    'Welcome to the Map of Knowledge',
      text:     'Every concept humans have ever studied — over 10,000 of them — organised as a living, interactive graph. Zoom in to explore, drag nodes, and click anything that catches your eye.',
    },
    {
      target:   '#ctrl-left-stack',
      position: 'right',
      title:    'Navigate the map',
      text:     '<strong>Layers</strong> shows or hides entire knowledge domains. <strong>Filters</strong> focuses the map on a specific curriculum or learning goal. The <strong>Search box</strong> at the top finds any of the 10,000+ topics instantly and jumps straight to it.',
      padding:  14,
    },
    {
      target:   '#sidebar',
      position: 'left',
      title:    'Learn anything. In any order.',
      text:     'Click any node to open its sidebar. From here you can <strong>mark it as known</strong>, run a <strong>4-question knowledge test</strong>, or start a <strong>guided learning session</strong>.<br><br>No curriculum. No prerequisites. No one telling you what to study next. Complete freedom.',
      before: function() {
        if (window.MapView && window.MapView.openDemoNode) {
          window.MapView.openDemoNode();
        }
      },
      after: function() {
        if (window.MapView && window.MapView.closeSidebar) {
          window.MapView.closeSidebar();
        }
      },
      padding: 0,
    },
    {
      target:   '#learning-mode',
      position: 'overlay-center',
      title:    'Learning mode &amp; knobits',
      text:     'Guided learning breaks each topic into <strong>knobits</strong> — small, focused units you master one at a time. Each knobit walks you through four phases:<br><br><em>Explain → Demonstrate → Practice → Meaning</em><br><br>You set the pace. You can ask anything at any time using the field at the bottom.',
      before: function () {
        // Raise learning-mode above the tour overlay so it shows through
        var lm = document.getElementById('learning-mode');
        if (lm) lm.style.zIndex = '9500';
        // Open with mock content — no API calls (negative IDs never match)
        if (window.Learn && window.Learn.open) {
          window.Learn.open(
            { id: 'tour-demo', label: 'Quantum Mechanics', color: '#5BC8D8' },
            'Natural Sciences › Physics',
            [
              { id: -1, sequence: 1, title: 'What is a quantum state?' },
              { id: -2, sequence: 2, title: 'Wave-particle duality' },
              { id: -3, sequence: 3, title: 'The uncertainty principle' },
              { id: -4, sequence: 4, title: 'Quantum superposition' },
              { id: -5, sequence: 5, title: 'Measurement and collapse' },
            ]
          );
        }
      },
      after: function () {
        if (window.Learn && window.Learn.close) window.Learn.close();
        var lm = document.getElementById('learning-mode');
        if (lm) lm.style.zIndex = '';
      },
    },
    {
      target:   '.topbar-burger-wrap',
      position: 'bottom-left',
      title:    'Your Learner Passport',
      text:     'Tap the menu icon above, then click <strong>Account</strong> to open your Learner Passport — a living record of everything you learn. It stores credentials, your knowledge map, reflections, and goals.<br><br>Exportable in internationally recognised formats and verifiable via blockchain.',
      padding:  10,
    },
  ];

  /* ─── DOM setup ────────────────────────────────────────────── */
  function _createDOM() {
    _overlay = document.createElement('div');
    _overlay.className = 'tour-overlay';

    _spot = document.createElement('div');
    _spot.className = 'tour-spotlight';

    _tip = document.createElement('div');
    _tip.className = 'tour-tooltip';

    document.body.appendChild(_overlay);
    document.body.appendChild(_spot);
    document.body.appendChild(_tip);
  }

  /* ─── Positioning ──────────────────────────────────────────── */
  function _positionSpot(rect, padding) {
    // Use class only — no inline style.display, so _hide() always works cleanly
    if (!rect) { _spot.classList.remove('visible'); return; }
    var p = padding || 0;
    _spot.style.left   = (rect.left   - p) + 'px';
    _spot.style.top    = (rect.top    - p) + 'px';
    _spot.style.width  = (rect.width  + p * 2) + 'px';
    _spot.style.height = (rect.height + p * 2) + 'px';
    _spot.classList.add('visible');
  }

  function _positionTip(rect, position) {
    var TW = 340, M = 18;
    var vw = window.innerWidth, vh = window.innerHeight;
    var TH = 340; // conservative tooltip height estimate
    var left, top;

    if (position === 'bottom-center') {
      left = (vw - TW) / 2;
      top  = vh - TH - 20;
    } else if (!rect || position === 'center-right') {
      left = Math.min(vw * 0.52, vw - TW - M);
      top  = 90;
    } else if (position === 'overlay-center') {
      left = (vw - TW) / 2;
      top  = 90;
    } else if (position === 'right') {
      left = rect.right + M;
      top  = Math.max(70, rect.top);
    } else if (position === 'left') {
      left = rect.left - TW - M;
      top  = Math.max(70, rect.top);
    } else if (position === 'bottom-left') {
      left = Math.max(M, rect.left);
      top  = rect.bottom + M;
    } else {
      left = (vw - TW) / 2;
      top  = rect.bottom + M;
    }

    // Clamp so tooltip never runs off bottom
    left = Math.max(M, Math.min(left, vw - TW - M));
    top  = Math.max(70, Math.min(top, vh - TH - M));

    _tip.style.left = left + 'px';
    _tip.style.top  = top  + 'px';
  }

  /* ─── Render a step ────────────────────────────────────────── */
  function _show(idx) {
    var s    = STEPS[idx];
    _step    = idx;
    var n    = STEPS.length;
    var last = (idx === n - 1);

    // Before hook
    if (s.before) s.before();

    // Re-read rect after before hook may have changed DOM
    var targetEl = s.target ? document.querySelector(s.target) : null;
    var rect     = targetEl ? targetEl.getBoundingClientRect() : null;

    // Re-position after transitions settle (sidebar slide-in, learning mode open)
    if (s.target === '#sidebar' || s.position === 'overlay-center') {
      setTimeout(function () {
        var el2   = s.target ? document.querySelector(s.target) : null;
        var rect2 = el2 ? el2.getBoundingClientRect() : null;
        _positionSpot(rect2, s.padding || 0);
        _positionTip(rect2, s.position);
      }, 380);
    }

    _positionSpot(rect, s.padding || 0);
    _positionTip(rect, s.position);

    // Progress dots
    var dots = '';
    for (var i = 0; i < n; i++) {
      dots += '<div class="tour-dot' + (i === idx ? ' active' : '') + '"></div>';
    }

    _tip.innerHTML =
      '<div class="tour-dots">' + dots + '</div>' +
      '<div class="tour-step-num">Step ' + (idx + 1) + ' of ' + n + '</div>' +
      '<div class="tour-title">' + s.title + '</div>' +
      '<div class="tour-text">'  + s.text  + '</div>' +
      '<div class="tour-actions">' +
        '<button class="tour-skip" onclick="window.Tour.skip()">Skip tour</button>' +
        '<div style="display:flex;gap:8px">' +
          (idx > 0 ? '<button class="tour-btn tour-btn-secondary" onclick="window.Tour.prev()">← Back</button>' : '') +
          '<button class="tour-btn tour-btn-primary" onclick="window.Tour.next()">' +
            (last ? 'Done ✓' : 'Next →') +
          '</button>' +
        '</div>' +
      '</div>';

    _overlay.classList.add('visible');
    _spot.classList.add('visible');
    _tip.classList.add('visible');
  }

  /* ─── Leave a step (run after hook) ───────────────────────── */
  function _leave(idx) {
    var s = STEPS[idx];
    if (s && s.after) s.after();
  }

  function _hide() {
    if (_overlay) _overlay.classList.remove('visible');
    if (_spot)    { _spot.classList.remove('visible'); _spot.style.cssText = ''; }
    if (_tip)     _tip.classList.remove('visible');
  }

  function _markDone(done) {
    localStorage.setItem('kq_tour_done', done ? '1' : '0');
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'tour_completed', value: done ? '1' : '' }),
    }).catch(function () {});
  }

  /* ─── Public API ───────────────────────────────────────────── */
  window.Tour = {
    start: function () {
      if (!_overlay) _createDOM();
      _show(0);
    },
    restart: function () {
      _markDone(false);
      if (!_overlay) _createDOM();
      _show(0);
    },
    next: function () {
      _leave(_step);
      if (_step < STEPS.length - 1) {
        _show(_step + 1);
      } else {
        _hide();
        _markDone(true);
      }
    },
    prev: function () {
      if (_step > 0) { _leave(_step); _show(_step - 1); }
    },
    skip: function () {
      _leave(_step);
      _hide();
      _markDone(true);
    },
  };

  /* ─── Auto-start logic ─────────────────────────────────────── */
  // Called by app.js after settings are loaded
  window._tourCheckAutoStart = function (settings) {
    // Forced restart from settings page
    if (localStorage.getItem('kq_force_tour') === '1') {
      localStorage.removeItem('kq_force_tour');
      setTimeout(function () { window.Tour.start(); }, 1800);
      return;
    }
    // Already completed
    if (localStorage.getItem('kq_tour_done') === '1') return;
    if (settings && settings.tour_completed === '1') return;
    // First visit — start after map settles
    setTimeout(function () { window.Tour.start(); }, 2200);
  };

}());
