/* ══════════════════════════════════════════════
   TILT  —  js/tilt.js
   Drives the tilt-more / tilt-less buttons in
   the Zoom Panel. Calls window.setTilt()
   exposed by app.js once the map is loaded.
   ══════════════════════════════════════════════ */

(function () {

  const TILT_STEP = Math.PI / 12;       // 15° per click
  const TILT_MAX  = Math.PI * 5 / 12;  // 75° maximum

  function applyTilt(angle) {
    if (typeof window.setTilt === 'function') {
      window.setTilt(angle);
    }
    updateDisplay(angle);
  }

  function updateDisplay(angle) {
    const deg = Math.round(angle * 180 / Math.PI);
    const el  = document.getElementById('zoom-level');
    if (!el) return;
    const cur = el.textContent.match(/zoom:\s*([\d.]+)/);
    const zStr = cur ? cur[1] : '—';
    el.textContent = deg > 0 ? `zoom: ${zStr}  tilt: ${deg}°` : `zoom: ${zStr}`;
  }

  document.getElementById('tilt-more').addEventListener('click', function () {
    const cur  = window.currentTilt || 0;
    const next = Math.min(cur + TILT_STEP, TILT_MAX);
    applyTilt(next);
  });

  document.getElementById('tilt-less').addEventListener('click', function () {
    const cur  = window.currentTilt || 0;
    const next = Math.max(cur - TILT_STEP, 0);
    applyTilt(next);
  });

})();
