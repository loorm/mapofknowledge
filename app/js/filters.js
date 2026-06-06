/* ═══════════════════════════════════════════════════════════════
   FILTERS  —  filters.js  (Map View sub-module)
   ───────────────────────────────────────────────────────────────
   Owns  : filter panel UI, filter set definitions
   Calls : window.MapView.setFilter(), window.MapView.setKnowledgeFilter(),
           window.MapView.clearKnowledgeFilter()
   Never : touch D3 internals, learning.js, test.js
   ═══════════════════════════════════════════════════════════════ */

(function () {

  /* ─── Filter definitions ─────────────────────────────────────────────
   Each filter specifies a Set of node LABEL strings at any level.
   The ancestry-chain walk in app.js means matching any ancestor
   also colours all its descendants.
   ──────────────────────────────────────────────────────────────────── */
  var FILTERS = {
    'my-knowledge': {
      label: 'My Knowledge',
      color: '#9B8FB5',
      dynamic: true,
      labels: new Set()
    }
  };

  /* ─── DB-backed subsets (personal + public) ─────────────────────── */
  var COLOR_HEX = { terra: '#C4826A', sage: '#8BAD7E', amber: '#C4A55A', lavender: '#9B8FB5' };

  (function loadDBSubsets() {
    fetch('/api/subsets')
      .then(function(r) { return r.json(); })
      .then(function(subsets) {
        var list = document.querySelector('#filter-panel .fp-list');
        subsets.forEach(function(s) {
          var filterId = 'db-' + s.id;
          var color = COLOR_HEX[s.icon_color] || COLOR_HEX.terra;
          FILTERS[filterId] = { label: s.name, color: color, dbId: s.id, labels: null };
          var div = document.createElement('div');
          div.className = 'fp-item';
          div.dataset.filterId = filterId;
          div.style.setProperty('--fi-color', color);
          div.innerHTML = '<div class="fp-radio"></div><div class="fp-dot"></div>'
                        + '<span class="fp-label">' + s.name + '</span>';
          list.appendChild(div);
        });
      })
      .catch(function() {});
  })();

  /* ─── Apply visibility from localStorage ────────────────────────── */
  (function applyVisibility() {
    var hidden;
    try { hidden = JSON.parse(localStorage.getItem('kq_filter_hidden') || '[]'); }
    catch(e) { hidden = []; }
    if (!hidden.length) return;
    document.querySelectorAll('.fp-item').forEach(function(item) {
      if (hidden.indexOf(item.dataset.filterId) !== -1) {
        item.style.display = 'none';
      }
    });
  })();

  /* ─── State ──────────────────────────────────────────────────────── */
  var activeFilterId = null;

  /* ─── DOM refs ───────────────────────────────────────────────────── */
  var panel     = document.getElementById('filter-panel');
  var filterBtn = document.getElementById('filter-btn');
  var clearBtn  = document.getElementById('fp-clear');
  var list      = document.querySelector('#filter-panel .fp-list');

  /* ─── Filter panel toggle ────────────────────────────────────────── */
  filterBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    // close Layer Panel if open
    var lp = document.getElementById('layer-panel');
    var lb = document.getElementById('layers-btn');
    if (lp) lp.classList.remove('open');
    if (lb) lb.classList.remove('active');
    panel.classList.toggle('open');
    filterBtn.classList.toggle('active', panel.classList.contains('open'));
  });

  document.addEventListener('click', function (e) {
    if (!panel.contains(e.target) && e.target !== filterBtn) {
      panel.classList.remove('open');
      filterBtn.classList.remove('active');
    }
  });

  /* ─── Filter item clicks (delegated) ────────────────────────────── */
  list.addEventListener('click', function (e) {
    var item = e.target.closest('.fp-item');
    if (!item) return;
    e.stopPropagation();
    var fid = item.dataset.filterId;

    if (activeFilterId === fid) {
      deactivate();
    } else {
      activeFilterId = fid;
      document.querySelectorAll('.fp-item').forEach(function (el) {
        el.classList.toggle('active', el.dataset.filterId === fid);
      });
      if (clearBtn) clearBtn.classList.remove('hidden');

      var filter = FILTERS[fid];
      if (filter && filter.dynamic) {
        // "My Knowledge" — use ID-based filter, not label-based
        fetch('/api/map/progress')
          .then(function (r) { return r.json(); })
          .then(function (progress) {
            if (typeof window.setKnowledgeFilter === 'function') {
              window.setKnowledgeFilter(progress, 50);
            }
          })
          .catch(function () {});
      } else if (filter && filter.dbId) {
        // DB-backed subset — fetch node labels on first activation
        if (filter.labels) {
          applyToMap(filter.labels);
        } else {
          fetch('/api/subsets/' + filter.dbId + '/nodes')
            .then(function (r) { return r.json(); })
            .then(function (labels) {
              filter.labels = new Set(labels);
              applyToMap(filter.labels);
            })
            .catch(function () {});
        }
      } else {
        applyToMap(filter ? filter.labels : null);
      }
    }
  });

  /* ─── Clear button ───────────────────────────────────────────────── */
  if (clearBtn) {
    clearBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      deactivate();
    });
  }

  /* ─── Helpers ────────────────────────────────────────────────────── */
  function deactivate() {
    activeFilterId = null;
    document.querySelectorAll('.fp-item').forEach(function (el) {
      el.classList.remove('active');
    });
    if (clearBtn) clearBtn.classList.add('hidden');
    applyToMap(null);
    if (typeof window.clearKnowledgeFilter === 'function') window.clearKnowledgeFilter();
  }

  window.clearActiveFilter = deactivate;

  function applyToMap(labelSet) {
    /* setMapFilter is exposed by app.js after the map loads.
       If called before the map is ready, it's a no-op. */
    if (typeof window.setMapFilter === 'function') {
      window.setMapFilter(labelSet);
    }
  }

})();
