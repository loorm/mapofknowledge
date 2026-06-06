/* ═══════════════════════════════════════════════════════════════
   CUSTOM MAP — REVIEW MODULE
   Owns: staging table, per-row accept/reject, commit.
   Entry point: window.CMReview.show(subsetId, stagingRows)
   ═══════════════════════════════════════════════════════════════ */

window.CMReview = (function () {

  var _subsetId = null;
  var _rows     = [];     // working copy with current user decisions
  var _isAdmin  = false;

  /* ── Entry point ───────────────────────────────────────────── */
  function show(subsetId, stagingRows) {
    _subsetId = subsetId;
    _rows = stagingRows.map(function (r) { return Object.assign({}, r); });

    // Auto-accept exact / breadcrumb matches; leave others as-is
    _rows.forEach(function (r) {
      if (r.status === 'accepted') r._decision = 'accept';
      else if (r.status === 'no_match') r._decision = 'none';
      else r._decision = 'pending';
    });

    document.getElementById('cm-upload-view').style.display = 'none';
    document.getElementById('cm-review-view').style.display = '';

    // Check admin status
    fetch('/auth/me').then(function (r) { return r.json(); }).then(function (user) {
      _isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
      var publicRow = document.getElementById('cm-public-row');
      if (publicRow) publicRow.style.display = _isAdmin ? '' : 'none';
    }).catch(function () {});

    _renderSummary();
    _renderTable();
    _bindActions();
  }

  /* ── Summary pills ─────────────────────────────────────────── */
  function _renderSummary() {
    var counts = { exact: 0, pending: 0, ambiguous: 0, no_match: 0 };
    _rows.forEach(function (r) {
      if (r.status === 'accepted')  counts.exact++;
      else if (r.status === 'pending')   counts.pending++;
      else if (r.status === 'ambiguous') counts.ambiguous++;
      else if (r.status === 'no_match')  counts.no_match++;
    });
    var el = document.getElementById('cm-summary');
    el.innerHTML = '';
    _pill(el, counts.exact + ' matched',    'p-exact',     counts.exact);
    _pill(el, counts.pending + ' review',   'p-pending',   counts.pending);
    _pill(el, counts.ambiguous + ' ambiguous', 'p-ambiguous', counts.ambiguous);
    _pill(el, counts.no_match + ' not found', 'p-no-match', counts.no_match);
  }

  function _pill(parent, text, cls, count) {
    if (!count) return;
    var span = document.createElement('span');
    span.className = 'cm-pill ' + cls;
    span.textContent = text;
    parent.appendChild(span);
  }

  /* ── Table ─────────────────────────────────────────────────── */
  function _renderTable() {
    var tbody = document.getElementById('cm-tbody');
    tbody.innerHTML = '';
    _rows.forEach(function (row, idx) {
      tbody.appendChild(_buildRow(row, idx));
    });
  }

  function _buildRow(row, idx) {
    var tr = document.createElement('tr');
    tr.dataset.idx = idx;
    tr.className = _rowClass(row);

    // Term
    var tdTerm = document.createElement('td');
    tdTerm.innerHTML = '<span class="cm-term">' + _esc(row.input_term) + '</span>';
    tr.appendChild(tdTerm);

    // Matched node
    var tdNode = document.createElement('td');
    if (row.status === 'ambiguous') {
      tdNode.appendChild(_buildCandidateDropdown(row, idx));
    } else if (row.matched_node_id) {
      tdNode.innerHTML =
        '<div class="cm-node-label">' + _esc(row.node_label) + '</div>' +
        (row.node_breadcrumb ? '<div class="cm-node-path">' + _esc(row.node_breadcrumb) + '</div>' : '');
    } else {
      tdNode.innerHTML = '<span class="cm-no-match-text">Not found on map</span>';
    }
    tr.appendChild(tdNode);

    // Level
    var tdLevel = document.createElement('td');
    if (row.node_level) {
      tdLevel.innerHTML = '<span class="cm-level">L' + row.node_level + '</span>';
    }
    tr.appendChild(tdLevel);

    // Method
    var tdMethod = document.createElement('td');
    tdMethod.appendChild(_buildMethodBadge(row));
    tr.appendChild(tdMethod);

    // Actions
    var tdAct = document.createElement('td');
    tdAct.appendChild(_buildActions(row, idx));
    tr.appendChild(tdAct);

    return tr;
  }

  function _buildMethodBadge(row) {
    var span = document.createElement('span');
    var map = {
      exact:      ['Exact',      'm-exact'],
      breadcrumb: ['Path',       'm-breadcrumb'],
      llm:        ['AI ' + (row.confidence || '') + '%', 'm-llm'],
      ambiguous:  ['Ambiguous',  'm-ambiguous'],
      no_match:   ['No match',   'm-no-match'],
    };
    var key = row.status === 'ambiguous' ? 'ambiguous'
            : row.status === 'no_match'  ? 'no_match'
            : row.match_method           ? row.match_method
            : 'no_match';
    var info = map[key] || ['—', ''];
    span.className = 'cm-method ' + info[1];
    span.textContent = info[0];
    return span;
  }

  function _buildCandidateDropdown(row, idx) {
    var wrap = document.createElement('div');
    var sel  = document.createElement('select');
    sel.className = 'cm-candidate-select';
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '— pick one —';
    sel.appendChild(opt0);
    (row.candidates || []).forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.label + (c.level ? ' (L' + c.level + ')' : '');
      sel.appendChild(opt);
    });
    sel.addEventListener('change', function () {
      if (sel.value) {
        var chosen = (row.candidates || []).find(function (c) { return String(c.id) === sel.value; });
        if (chosen) {
          _rows[idx].matched_node_id = chosen.id;
          _rows[idx].node_label = chosen.label;
          _rows[idx].status = 'pending';
          _rows[idx]._decision = 'accept';
          _updateRow(idx);
          _renderSummary();
        }
      }
    });
    wrap.appendChild(sel);
    return wrap;
  }

  function _buildActions(row, idx) {
    var wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.gap = '6px';

    if (row.status === 'no_match') {
      var span = document.createElement('span');
      span.style.cssText = 'font-size:11px;color:#B0A496;';
      span.textContent = 'Cannot add';
      wrap.appendChild(span);
      return wrap;
    }

    if (row._decision === 'accept') {
      var undo = _makeBtn('Undo', 'undo', function () {
        _rows[idx]._decision = 'pending';
        _updateRow(idx);
        _renderSummary();
      });
      wrap.appendChild(undo);
    } else if (row._decision === 'pending') {
      var acc = _makeBtn('Accept', 'accept', function () {
        _rows[idx]._decision = 'accept';
        _updateRow(idx);
        _renderSummary();
      });
      var rej = _makeBtn('Reject', 'reject', function () {
        _rows[idx]._decision = 'reject';
        _updateRow(idx);
        _renderSummary();
      });
      wrap.appendChild(acc);
      wrap.appendChild(rej);
    } else {
      var unrej = _makeBtn('Undo', 'undo', function () {
        _rows[idx]._decision = 'pending';
        _updateRow(idx);
        _renderSummary();
      });
      wrap.appendChild(unrej);
    }

    return wrap;
  }

  function _makeBtn(label, cls, handler) {
    var b = document.createElement('button');
    b.className = 'cm-row-btn ' + cls;
    b.textContent = label;
    b.addEventListener('click', handler);
    return b;
  }

  function _rowClass(row) {
    if (row._decision === 'accept') return 'cm-row-accepted';
    if (row._decision === 'reject') return 'cm-row-rejected';
    if (row.status === 'no_match')  return 'cm-row-no-match';
    return '';
  }

  function _updateRow(idx) {
    var tbody = document.getElementById('cm-tbody');
    var old   = tbody.querySelector('tr[data-idx="' + idx + '"]');
    var fresh = _buildRow(_rows[idx], idx);
    if (old) tbody.replaceChild(fresh, old);
  }

  /* ── Global actions ────────────────────────────────────────── */
  function _bindActions() {
    document.getElementById('cm-accept-all').addEventListener('click', function () {
      _rows.forEach(function (r, i) {
        if (r.matched_node_id && r.status !== 'no_match') r._decision = 'accept';
      });
      _renderTable();
      _renderSummary();
    });

    document.getElementById('cm-reject-all').addEventListener('click', function () {
      _rows.forEach(function (r, i) {
        if (r.status !== 'no_match') r._decision = 'reject';
      });
      _renderTable();
      _renderSummary();
    });

    document.getElementById('cm-commit-btn').addEventListener('click', _commit);

    document.getElementById('cm-review-back').addEventListener('click', function () {
      document.getElementById('cm-upload-view').style.display = '';
      document.getElementById('cm-review-view').style.display = 'none';
    });

    document.getElementById('cm-discard-btn').addEventListener('click', function () {
      if (!confirm('Discard this map? It will be permanently deleted.')) return;
      fetch('/api/subsets/' + _subsetId, { method: 'DELETE' })
        .then(function () { window.location.href = 'settings.html#filters'; })
        .catch(function () { _showMsg('error', 'Could not discard map.'); });
    });
  }

  /* ── Commit ────────────────────────────────────────────────── */
  async function _commit() {
    var nodeIds = _rows
      .filter(function (r) { return r._decision === 'accept' && r.matched_node_id; })
      .map(function (r) { return r.matched_node_id; });

    if (!nodeIds.length) {
      _showMsg('error', 'Accept at least one node before saving.');
      return;
    }

    var makePublic = _isAdmin && document.getElementById('cm-public-toggle')?.checked;

    var btn = document.getElementById('cm-commit-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      await _fetch('POST', '/api/subsets/' + _subsetId + '/commit', {
        nodeIds: nodeIds,
        makePublic: !!makePublic,
      });
      // Return to settings
      window.location.href = 'settings.html#filters';
    } catch (err) {
      _showMsg('error', 'Save failed: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Save map';
    }
  }

  function _showMsg(type, text) {
    var el = document.getElementById('cm-review-message');
    if (!el) return;
    el.className = 'cm-message ' + type;
    el.textContent = text;
    el.style.display = 'block';
  }

  async function _fetch(method, url, body) {
    var r = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      var err = await r.json().catch(function () { return {}; });
      throw new Error(err.error || r.status);
    }
    return r.json();
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { show: show };

})();
