/* ══════════════════════════════════════════════
   LAYERS  —  js/layers.js
   Controls the Layer Panel UI. Calls
   window.setLayerVisible() exposed by app.js.
   ══════════════════════════════════════════════ */

(function () {

  const panel     = document.getElementById('layer-panel');
  const layersBtn = document.getElementById('layers-btn');

  /* ─── Layer Panel toggle ─────────────────────────────────────────── */
  layersBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    // close Filter Panel if open
    const fp = document.getElementById('filter-panel');
    const fb = document.getElementById('filter-btn');
    if (fp) fp.classList.remove('open');
    if (fb) fb.classList.remove('active');

    panel.classList.toggle('open');
    layersBtn.classList.toggle('active', panel.classList.contains('open'));
  });

  document.addEventListener('click', function (e) {
    if (!panel.contains(e.target) && e.target !== layersBtn) {
      panel.classList.remove('open');
      layersBtn.classList.remove('active');
    }
  });

  /* ─── Checkbox item clicks ───────────────────────────────────────── */
  document.querySelectorAll('.layer-item').forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.stopPropagation();
      const layerId = this.dataset.layer;
      const cb      = this.querySelector('.layer-checkbox');
      const nowOn   = !cb.classList.contains('checked');
      cb.classList.toggle('checked', nowOn);
      if (typeof window.setLayerVisible === 'function') {
        window.setLayerVisible(layerId, nowOn);
      }
    });
  });

})();
