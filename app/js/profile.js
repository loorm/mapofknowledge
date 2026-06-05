/* ══════════════════════════════════════════════
   LEARNER PASSPORT  —  js/profile.js
   Loads real data from /api/profile and renders
   each section, replacing the static mockup.
   ══════════════════════════════════════════════ */

(function () {

  /* ─── Helpers ─────────────────────────────────────────────────── */
  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  function fmtDate(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short' }); }
    catch { return String(d).substring(0, 7); }
  }

  function empty(msg) {
    return `<div class="p-empty">${esc(msg)}</div>`;
  }

  /* ─── Render functions ────────────────────────────────────────── */

  function renderIdentity(passport) {
    const name  = passport.display_name || 'Your Name';
    const about = passport.about || '';

    // Top-bar banner
    const banner = document.querySelector('.topbar-banner-inner');
    if (banner) banner.innerHTML = `<span class="topbar-banner-dot"></span>Learner Passport — ${esc(name)}`;

    // Left nav
    const avatarCircle = document.querySelector('.pnav-avatar-circle');
    if (avatarCircle) avatarCircle.textContent = initials(name);
    const navName = document.querySelector('.pnav-name');
    if (navName) navName.textContent = name;
    const navTagline = document.querySelector('.pnav-tagline');
    if (navTagline) navTagline.textContent = passport.location || '';

    // Identity card
    const idCard = document.getElementById('identity-card');
    if (idCard) {
      idCard.innerHTML = `
        <div class="p-card-title">Identity</div>
        <div class="p-kv">
          <div class="p-kv-label">Full name</div>
          <div class="p-kv-value" data-field="display_name">${esc(passport.display_name || '')}</div>
          <div class="p-kv-label">Year of birth</div>
          <div class="p-kv-value" data-field="birth_year">${esc(passport.birth_year || '')}</div>
          <div class="p-kv-label">Language</div>
          <div class="p-kv-value" data-field="location">${esc(passport.location || '')}</div>
          <div class="p-kv-label">Culture</div>
          <div class="p-kv-value" data-field="cultural_background">${esc(passport.cultural_background || '')}</div>
          <div class="p-kv-label">ID number</div>
          <div class="p-kv-value" data-field="id_number">${esc(passport.id_number || '')}</div>
        </div>
        <button class="p-edit-btn" onclick="window.editIdentity()">Edit</button>`;
    }

    // Learning needs and preferences card
    const aboutCard = document.getElementById('about-card');
    if (aboutCard) {
      aboutCard.innerHTML = `<div class="p-card-title">Learning needs and preferences</div>` + (about
        ? `<div class="p-kv-value" style="font-size:13px;color:#4A4038;line-height:1.75;white-space:pre-wrap">${esc(about)}</div>
           <button class="p-edit-btn" onclick="window.editAbout()">Edit</button>`
        : `${empty('Describe how and when and where you learn best, and any special needs that impact your learning.')}
           <button class="p-edit-btn" onclick="window.editAbout()">Add</button>`);
    }
  }

  function renderInterests(tags) {
    const interests = (tags || []).filter(t => t.type === 'interest');
    const values    = (tags || []).filter(t => t.type === 'value');

    const card = document.getElementById('interests-card');
    if (!card) return;

    const iHtml = interests.length
      ? interests.map(t => `<span class="p-tag interest">${esc(t.text)}</span>`).join('')
      : '<span style="color:#9A8E86;font-size:12px">None added yet</span>';
    const vHtml = values.length
      ? values.map(t => `<span class="p-tag value">${esc(t.text)}</span>`).join('')
      : '<span style="color:#9A8E86;font-size:12px">None added yet</span>';

    card.innerHTML = `
      <div style="margin-bottom:13px">
        <div style="font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#8A7E72;margin-bottom:8px">Core interests</div>
        <div class="p-tags">${iHtml}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#8A7E72;margin-bottom:8px">Values</div>
        <div class="p-tags">${vHtml}</div>
      </div>
      <button class="p-edit-btn" onclick="window.editInterests()">Edit</button>`;
  }

  window.editInterests = function () {
    const card = document.getElementById('interests-card');
    if (!card) return;

    function tagRow(t) {
      return `<span class="p-tag ${esc(t.type)}" style="display:inline-flex;align-items:center;gap:5px">
        ${esc(t.text)}
        <button onclick="window.deleteTag(${t.id})" style="background:none;border:none;cursor:pointer;color:inherit;opacity:0.6;font-size:11px;padding:0;line-height:1" title="Remove">×</button>
      </span>`;
    }

    function addRow(type) {
      return `<div style="display:flex;gap:6px;margin-top:8px">
        <input id="tag-input-${type}" class="p-edit-input" style="flex:1" placeholder="Add ${type}…" onkeydown="if(event.key==='Enter')window.addTag('${type}')">
        <button class="p-edit-btn primary" onclick="window.addTag('${type}')" style="margin-top:0;white-space:nowrap">+ Add</button>
      </div>`;
    }

    function rebuild() {
      fetch('/api/profile').then(r => r.json()).then(d => {
        const interests = (d.tags || []).filter(t => t.type === 'interest');
        const values    = (d.tags || []).filter(t => t.type === 'value');
        document.getElementById('tag-list-interest').innerHTML =
          interests.length ? interests.map(tagRow).join('') : '<span style="color:#9A8E86;font-size:12px">None yet</span>';
        document.getElementById('tag-list-value').innerHTML =
          values.length ? values.map(tagRow).join('') : '<span style="color:#9A8E86;font-size:12px">None yet</span>';
      });
    }
    window._rebuildTags = rebuild;

    fetch('/api/profile').then(r => r.json()).then(d => {
      const interests = (d.tags || []).filter(t => t.type === 'interest');
      const values    = (d.tags || []).filter(t => t.type === 'value');
      card.innerHTML = `
        <div style="margin-bottom:16px">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#8A7E72;margin-bottom:8px">Core interests</div>
          <div class="p-tags" id="tag-list-interest">${interests.length ? interests.map(tagRow).join('') : '<span style="color:#9A8E86;font-size:12px">None yet</span>'}</div>
          ${addRow('interest')}
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#8A7E72;margin-bottom:8px">Values</div>
          <div class="p-tags" id="tag-list-value">${values.length ? values.map(tagRow).join('') : '<span style="color:#9A8E86;font-size:12px">None yet</span>'}</div>
          ${addRow('value')}
        </div>
        <button class="p-edit-btn" onclick="window.loadProfile()" style="margin-top:14px">Done</button>`;
    });
  };

  window.addTag = function (type) {
    const inp = document.getElementById('tag-input-' + type);
    const text = inp ? inp.value.trim() : '';
    if (!text) return;
    inp.value = '';
    fetch('/api/profile/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, text }),
    }).then(() => { if (window._rebuildTags) window._rebuildTags(); })
      .catch(() => {});
  };

  window.deleteTag = function (id) {
    fetch('/api/profile/tags/' + id, { method: 'DELETE' })
      .then(() => { if (window._rebuildTags) window._rebuildTags(); })
      .catch(() => {});
  };

  function renderLearningStyle(style) {
    const card = document.getElementById('learning-style-card');
    if (!card) return;
    if (!style) {
      card.innerHTML = `${empty('How do you learn best? Modalities, peak times, accessibility needs.')}
        <button class="p-edit-btn" onclick="window.editLearningStyle()">Add learning style</button>`;
      return;
    }
    const rows = [
      ['Modalities',   style.modalities],
      ['Peak time',    style.peak_time],
      ['Session length', style.session_length],
      ['Works best',   style.works_best],
      ['Needs',        style.needs],
      ['Accessibility', style.accessibility],
    ].filter(([, v]) => v);
    card.innerHTML = `<div class="p-kv">
      ${rows.map(([k, v]) => `<div class="p-kv-label">${esc(k)}</div><div class="p-kv-value">${esc(v)}</div>`).join('')}
    </div>
    <button class="p-edit-btn" onclick="window.editLearningStyle()">Edit</button>`;
  }

  // ── Events state ──────────────────────────────────────────────────
  var _allEvents  = [];
  var _evShowing  = 5;
  var _evFilter   = { type: 'all', dateFrom: '', dateTo: '' };

  function _evDate(ev) { return (ev.event_date || '').toString().split('T')[0]; }

  function _filteredEvents() {
    return _allEvents.filter(function(ev) {
      if (_evFilter.type !== 'all' && ev.type !== _evFilter.type) return false;
      const d = _evDate(ev);
      if (_evFilter.dateFrom && d < _evFilter.dateFrom) return false;
      if (_evFilter.dateTo   && d > _evFilter.dateTo)   return false;
      return true;
    });
  }

  function _renderEventsWithState() {
    const ledger = document.getElementById('events-ledger');
    if (!ledger) return;

    const filtered = _filteredEvents();

    // Type filter pills
    const typePills = ['all','activity','assessment','evidence'].map(function(t) {
      const label  = t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1);
      const active = _evFilter.type === t;
      return `<button onclick="window.setEvTypeFilter('${t}')"
        style="padding:3px 10px;border-radius:20px;border:1.5px solid ${active ? '#C4826A' : 'rgba(58,48,40,0.12)'};
        background:${active ? 'rgba(196,130,106,0.10)' : 'transparent'};
        color:${active ? '#C4826A' : '#8A7E72'};font-size:11px;font-weight:600;font-family:inherit;cursor:pointer">${label}</button>`;
    }).join('');

    const hasDates  = _evFilter.dateFrom || _evFilter.dateTo;
    const clearBtn  = hasDates
      ? `<button onclick="window.clearEvDates()" title="Clear date filter"
           style="width:18px;height:18px;border-radius:50%;background:rgba(58,48,40,0.10);
           border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;
           color:#8A7E72;font-size:10px;line-height:1;flex-shrink:0;transition:background 0.12s">✕</button>`
      : '';

    const filterRow = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;flex-wrap:wrap">
        <div style="display:flex;gap:4px">${typePills}</div>
        <div style="display:flex;gap:4px;margin-left:auto;align-items:center">
          <input type="date" class="p-edit-input" style="padding:3px 6px;font-size:11px;width:100px"
            value="${_evFilter.dateFrom}" onblur="window.setEvDateFilter('from',this.value)">
          <span style="font-size:11px;color:#9A8E86">–</span>
          <input type="date" class="p-edit-input" style="padding:3px 6px;font-size:11px;width:100px"
            value="${_evFilter.dateTo}" onblur="window.setEvDateFilter('to',this.value)">
          ${clearBtn}
        </div>
      </div>`;

    const rowsHtml = !filtered.length
      ? empty(_allEvents.length ? 'No events match your filter.' : 'Your learning events will appear here.')
      : filtered.map(function(ev) {
          var titleHtml = esc(ev.title);
          if (ev.node_external_id) {
            var sep = ev.title.indexOf(': ');
            if (sep !== -1) {
              titleHtml = esc(ev.title.slice(0, sep + 2)) +
                `<a class="p-event-node-link" href="/app/?node=${esc(ev.node_external_id)}">${esc(ev.title.slice(sep + 2))}</a>`;
            }
          }
          var delBtn = ev.user_created
            ? `<button onclick="window.deleteEvent(${ev.id})" title="Remove"
                 style="background:none;border:none;cursor:pointer;color:#B0A496;font-size:15px;padding:0 0 0 6px;line-height:1;vertical-align:middle">×</button>`
            : '';
          return `<div class="p-ledger-row">
            <div class="p-ledger-date">${fmtDate(ev.event_date)}</div>
            <div class="p-ledger-info">
              <div class="p-ledger-title">${titleHtml}${delBtn}</div>
              ${ev.institution ? `<div class="p-ledger-sub">${esc(ev.institution)}</div>` : ''}
              ${ev.result ? `<div class="p-ledger-result">${esc(ev.result)}</div>` : ''}
            </div>
            <span class="p-type ${esc(ev.type)}">${esc(ev.type.charAt(0).toUpperCase() + ev.type.slice(1))}</span>
          </div>`;
        }).join('');

    const scrollList = `<div style="max-height:380px;overflow-y:auto">${rowsHtml}</div>`;
    const moreBtn = '';

    const today   = new Date().toISOString().split('T')[0];
    const srcOpts = ['Book','YouTube video','Conference','Workshop','Self-study period','Other']
      .map(function(s) { return `<option value="${s}">${s}</option>`; }).join('');

    ledger.innerHTML = `<div class="p-card-title">Events</div>` + filterRow + scrollList + `
      <button class="p-edit-btn" id="ev-add-btn" style="margin-top:10px"
        onclick="document.getElementById('ev-form').style.display='';this.style.display='none';document.getElementById('ev-title').focus()">
        + Add activity
      </button>
      <div id="ev-form" style="display:none;margin-top:14px;padding-top:14px;border-top:1px solid rgba(58,48,40,0.07)">
        <div style="display:grid;gap:8px">
          <input id="ev-title" class="p-edit-input" placeholder="What you studied or attended (required)">
          <div style="display:flex;gap:8px">
            <select id="ev-source" class="p-edit-input" style="flex:1">${srcOpts}</select>
            <input id="ev-provider" class="p-edit-input" style="flex:1.5" placeholder="Author / Channel / Organiser (optional)">
          </div>
          <div style="display:flex;gap:8px">
            <input id="ev-date" type="date" class="p-edit-input" style="flex:1" value="${today}">
            <input id="ev-notes" class="p-edit-input" style="flex:2" placeholder="Test score or other outcome (optional)">
          </div>
          <textarea id="ev-reflection" class="p-edit-input" style="width:100%;min-height:80px;resize:vertical;box-sizing:border-box"
            placeholder="Reflection — what did you learn, what surprised you, what would you do differently? (optional)"></textarea>
          <div style="display:flex;gap:8px">
            <button class="p-edit-btn primary" onclick="window.saveManualEvent()" style="margin-top:0">Add</button>
            <button class="p-edit-btn" onclick="document.getElementById('ev-form').style.display='none';document.getElementById('ev-add-btn').style.display=''" style="margin-top:0">Cancel</button>
          </div>
        </div>
      </div>`;
  }

  function renderEvents(events) {
    _allEvents  = events || [];
    _evShowing  = 5;
    _renderEventsWithState();
  }

  window.setEvTypeFilter = function(type) {
    _evFilter.type = type; _renderEventsWithState();
  };
  window.setEvDateFilter = function(which, val) {
    if (which === 'from') _evFilter.dateFrom = val;
    else _evFilter.dateTo = val;
    _renderEventsWithState();
  };
  window.clearEvDates = function() {
    _evFilter.dateFrom = ''; _evFilter.dateTo = ''; _renderEventsWithState();
  };

  window.saveManualEvent = function () {
    const title      = document.getElementById('ev-title').value.trim();
    if (!title) { document.getElementById('ev-title').focus(); return; }
    const source     = document.getElementById('ev-source').value;
    const provider   = document.getElementById('ev-provider').value.trim();
    const date       = document.getElementById('ev-date').value;
    const notes      = document.getElementById('ev-notes').value.trim();
    const reflection = document.getElementById('ev-reflection').value.trim();
    const institution = source + (provider ? ' — ' + provider : '');
    fetch('/api/profile/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, institution, result: notes || null, event_date: date, reflection: reflection || null }),
    }).then(() => window.loadProfile()).catch(() => {});
  };

  window.deleteEvent = function (id) {
    fetch('/api/profile/events/' + id, { method: 'DELETE' })
      .then(() => window.loadProfile()).catch(() => {});
  };

  function renderRelationships(relationships) {
    var individuals = (relationships || []).filter(function(r) { return r.type === 'individual'; });
    var groups      = (relationships || []).filter(function(r) { return r.type === 'group'; });
    var providers   = (relationships || []).filter(function(r) { return r.type === 'institution' || r.type === 'tool'; });

    function delBtn(id) {
      return `<button onclick="window.deleteRelationship(${id})" title="Remove"
        style="background:none;border:none;cursor:pointer;color:#B0A496;font-size:15px;padding:0 0 0 6px;line-height:1;vertical-align:middle">×</button>`;
    }

    function addForm(type, fields, btnLabel) {
      var inputs = fields.map(function(f) {
        if (f.type === 'select') {
          var opts = f.options.map(function(o) { return `<option value="${o.v}">${o.l}</option>`; }).join('');
          return `<select id="rel-${f.id}" class="p-edit-input">${opts}</select>`;
        }
        return `<input id="rel-${f.id}" class="p-edit-input" placeholder="${esc(f.label)}">`;
      }).join('');
      return `
        <button class="p-edit-btn" id="rel-add-btn-${type}" style="margin-top:10px"
          onclick="document.getElementById('rel-form-${type}').style.display='';this.style.display='none';document.getElementById('rel-f0-${type}').focus()">
          + Add
        </button>
        <div id="rel-form-${type}" style="display:none;margin-top:10px;display:none">
          <div style="display:grid;gap:6px">${inputs}
            <div style="display:flex;gap:6px">
              <button class="p-edit-btn primary" onclick="window.saveRelationship('${type}')" style="margin-top:0">${btnLabel}</button>
              <button class="p-edit-btn" onclick="document.getElementById('rel-form-${type}').style.display='none';document.getElementById('rel-add-btn-${type}').style.display=''" style="margin-top:0">Cancel</button>
            </div>
          </div>
        </div>`;
    }

    // ── Profs, mentors, role models ──
    var indCard = document.getElementById('individuals-card');
    if (indCard) {
      var indRows = !individuals.length
        ? empty('Add professors, mentors, and role models who shaped your learning.')
        : individuals.map(function(r) {
            return `<div class="p-person" style="display:flex;align-items:center;gap:10px">
              <div class="p-person-avatar">${esc(r.name.split(' ').map(function(w){return w[0];}).slice(0,2).join('').toUpperCase())}</div>
              <div style="flex:1;min-width:0">
                <div class="p-person-name">${esc(r.name)}${delBtn(r.id)}</div>
                ${r.role_description ? `<div class="p-person-role">${esc(r.role_description)}</div>` : ''}
              </div>
            </div>`;
          }).join('');
      indCard.innerHTML = `<div class="p-card-title">Profs, mentors, role models</div>
        <div style="max-height:340px;overflow-y:auto">${indRows}</div>` +
        addForm('individual', [
          {id:'f0-individual', label:'Full name'},
          {id:'f1-individual', label:'Role or connection (e.g. PhD supervisor, Author)'},
        ], 'Add');
    }

    // ── Study Groups ──
    var grpCard = document.getElementById('groups-card');
    if (grpCard) {
      var grpRows = !groups.length
        ? empty('Add study groups, reading circles, and communities.')
        : groups.map(function(r) {
            var badge = r.status === 'active'
              ? `<span class="p-badge active">Active</span>`
              : r.status === 'concluded' ? `<span class="p-badge done">Concluded</span>` : '';
            return `<div class="p-entry">
              <div class="p-entry-header">
                <div class="p-entry-title">${esc(r.name)}${delBtn(r.id)}</div>
                ${badge}
              </div>
              ${r.role_description ? `<div class="p-entry-sub">${esc(r.role_description)}</div>` : ''}
            </div>`;
          }).join('');
      grpCard.innerHTML = `<div class="p-card-title">Study Groups</div>
        <div style="max-height:340px;overflow-y:auto">${grpRows}</div>` +
        addForm('group', [
          {id:'f0-group', label:'Group name'},
          {id:'f1-group', label:'Description (frequency, size, focus…)'},
          {id:'f2-group', type:'select', options:[{v:'',l:'Status (optional)'},{v:'active',l:'Active'},{v:'concluded',l:'Concluded'}]},
        ], 'Add');
    }

    // ── Learning providers ──
    var provCard = document.getElementById('providers-card');
    if (provCard) {
      var provRows = !providers.length
        ? empty('Add universities, courses, apps, and tools that shaped your learning.')
        : providers.map(function(r) {
            var catBadge = `<span style="font-size:10px;color:#9A8E86;margin-left:6px">${r.type === 'tool' ? 'Tool' : 'Institution'}</span>`;
            return `<div class="p-entry">
              <div class="p-entry-header">
                <div class="p-entry-title">${esc(r.name)}${catBadge}${delBtn(r.id)}</div>
              </div>
              ${r.role_description ? `<div class="p-entry-sub">${esc(r.role_description)}</div>` : ''}
            </div>`;
          }).join('');
      provCard.innerHTML = `<div class="p-card-title">Learning providers</div>
        <div style="max-height:340px;overflow-y:auto">${provRows}</div>` +
        addForm('provider', [
          {id:'f0-provider', label:'Name'},
          {id:'f1-provider', label:'Description (course, dates, how used…)'},
          {id:'f2-provider', type:'select', options:[{v:'institution',l:'Institution'},{v:'tool',l:'Tool'}]},
        ], 'Add');
    }
  }

  window.saveRelationship = function(type) {
    var name = document.getElementById('rel-f0-' + type);
    if (!name || !name.value.trim()) { if (name) name.focus(); return; }
    var roleEl   = document.getElementById('rel-f1-' + type);
    var statusEl = document.getElementById('rel-f2-' + type);
    var actualType = type === 'provider'
      ? (statusEl ? statusEl.value : 'institution')
      : type;
    var status = type === 'group' && statusEl ? statusEl.value : null;
    fetch('/api/profile/relationships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: actualType,
        name: name.value.trim(),
        role_description: roleEl ? roleEl.value.trim() || null : null,
        status: status || null,
      }),
    }).then(() => window.loadProfile()).catch(() => {});
  };

  window.deleteRelationship = function(id) {
    fetch('/api/profile/relationships/' + id, { method: 'DELETE' })
      .then(() => window.loadProfile()).catch(() => {});
  };

  function renderCredentials(credentials, mapKnowledge) {
    var creds = credentials || [];

    function credDelBtn(id) {
      return `<button onclick="window.deleteCredential(${id})" title="Remove"
        style="background:none;border:none;cursor:pointer;color:#B0A496;font-size:15px;padding:0 0 0 6px;line-height:1;vertical-align:middle">×</button>`;
    }

    function credAddForm(type, hasMonth) {
      var dateField = hasMonth
        ? `<input id="cred-date-${type}" type="month" class="p-edit-input" placeholder="Month and year">`
        : `<input id="cred-date-${type}" type="number" class="p-edit-input" min="1900" max="2099" placeholder="Year">`;
      return `
        <button class="p-edit-btn" id="cred-add-btn-${type}" style="margin-top:10px"
          onclick="document.getElementById('cred-form-${type}').style.display='';this.style.display='none';document.getElementById('cred-title-${type}').focus()">
          + Add
        </button>
        <div id="cred-form-${type}" style="display:none;margin-top:10px">
          <div style="display:grid;gap:6px">
            <input id="cred-title-${type}" class="p-edit-input" placeholder="Title (required)">
            <input id="cred-issuer-${type}" class="p-edit-input" placeholder="Issuer / Institution">
            <div style="display:flex;gap:6px">
              ${dateField}
              <input id="cred-grade-${type}" class="p-edit-input" style="flex:1" placeholder="Grade / score / note">
            </div>
            <div style="display:flex;gap:6px">
              <button class="p-edit-btn primary" onclick="window.saveCredential('${type}')" style="margin-top:0">Add</button>
              <button class="p-edit-btn" onclick="document.getElementById('cred-form-${type}').style.display='none';document.getElementById('cred-add-btn-${type}').style.display=''" style="margin-top:0">Cancel</button>
            </div>
          </div>
        </div>`;
    }

    // ── Map of Knowledge Credentials (platform, read-only) ──
    var platform = creds.filter(function(c) { return c.type === 'platform'; });
    var platformCard = document.getElementById('platform-credentials-card');
    if (platformCard) {
      var platRows = !platform.length
        ? empty('Complete all knobits for a node to earn a platform credential here.')
        : platform.map(function(c) {
            return `<div class="p-cred">
              <div class="p-cred-icon internal">🗺️</div>
              <div>
                <div class="p-cred-title">${esc(c.title)}</div>
                <div class="p-cred-issuer">${esc(c.issuer || 'Map of Knowledge · KaiQ Platform')}</div>
                <div class="p-cred-date">${fmtDate(c.awarded_date)}${c.score_pct ? ` · Score: ${c.score_pct}%` : ''}</div>
                ${c.blockchain_hash ? `<div class="p-cred-hash">${esc(c.blockchain_hash)}…</div>` : ''}
              </div>
            </div>`;
          }).join('');
      platformCard.innerHTML = `<div class="p-card-title">Map of Knowledge Credentials</div>
        <div style="max-height:300px;overflow-y:auto">${platRows}</div>`;
    }

    // ── Qualifications ──
    var quals = creds.filter(function(c) { return c.type === 'qualification'; });
    var qualCard = document.getElementById('qualifications-card');
    if (qualCard) {
      var qualRows = !quals.length
        ? empty('Add your formal qualifications — degrees and diplomas.')
        : quals.map(function(c) {
            return `<div class="p-cred">
              <div class="p-cred-icon qual">🎓</div>
              <div style="flex:1;min-width:0">
                <div class="p-cred-title">${esc(c.title)}${credDelBtn(c.id)}</div>
                ${c.issuer ? `<div class="p-cred-issuer">${esc(c.issuer)}</div>` : ''}
                <div class="p-cred-date">${fmtDate(c.awarded_date)}${c.grade ? ` · ${esc(c.grade)}` : ''}</div>
              </div>
            </div>`;
          }).join('');
      qualCard.innerHTML = `<div class="p-card-title">Qualifications</div>
        <div style="max-height:300px;overflow-y:auto">${qualRows}</div>` + credAddForm('qualification', false);
    }

    // ── Awards & Endorsements ──
    var awards = creds.filter(function(c) { return c.type === 'award'; });
    var awardsCard = document.getElementById('awards-card');
    if (awardsCard) {
      var awardsRows = !awards.length
        ? empty('Add awards, honours, and endorsements.')
        : awards.map(function(c) {
            return `<div class="p-cred">
              <div class="p-cred-icon award">⭐</div>
              <div style="flex:1;min-width:0">
                <div class="p-cred-title">${esc(c.title)}${credDelBtn(c.id)}</div>
                ${c.issuer ? `<div class="p-cred-issuer">${esc(c.issuer)}</div>` : ''}
                <div class="p-cred-date">${fmtDate(c.awarded_date)}${c.grade ? ` · ${esc(c.grade)}` : ''}</div>
              </div>
            </div>`;
          }).join('');
      awardsCard.innerHTML = `<div class="p-card-title">Awards &amp; Endorsements</div>
        <div style="max-height:300px;overflow-y:auto">${awardsRows}</div>` + credAddForm('award', false);
    }

    // ── Certifications & Badges ──
    var certs = creds.filter(function(c) { return c.type === 'certification'; });
    var certsCard = document.getElementById('certifications-card');
    if (certsCard) {
      var certRows = !certs.length
        ? empty('Add certifications, online courses, and badges.')
        : certs.map(function(c) {
            return `<div class="p-cred">
              <div class="p-cred-icon cert">📋</div>
              <div style="flex:1;min-width:0">
                <div class="p-cred-title">${esc(c.title)}${credDelBtn(c.id)}</div>
                ${c.issuer ? `<div class="p-cred-issuer">${esc(c.issuer)}</div>` : ''}
                <div class="p-cred-date">${fmtDate(c.awarded_date)}${c.grade ? ` · ${esc(c.grade)}` : ''}</div>
              </div>
            </div>`;
          }).join('');
      certsCard.innerHTML = `<div class="p-card-title">Certifications &amp; Badges</div>
        <div style="max-height:300px;overflow-y:auto">${certRows}</div>` + credAddForm('certification', true);
    }
  }

  window.saveCredential = function(type) {
    var titleEl  = document.getElementById('cred-title-' + type);
    var issuerEl = document.getElementById('cred-issuer-' + type);
    var dateEl   = document.getElementById('cred-date-' + type);
    var gradeEl  = document.getElementById('cred-grade-' + type);
    if (!titleEl || !titleEl.value.trim()) { if (titleEl) titleEl.focus(); return; }
    var dateVal = dateEl ? dateEl.value.trim() : '';
    // month input gives YYYY-MM; year input gives YYYY — normalise to YYYY-MM for API
    if (dateVal && dateVal.length === 4) dateVal = dateVal + '-01';
    fetch('/api/profile/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: type,
        title:        titleEl.value.trim(),
        issuer:       issuerEl ? issuerEl.value.trim() || null : null,
        awarded_date: dateVal || null,
        grade:        gradeEl ? gradeEl.value.trim() || null : null,
      }),
    }).then(function() { window.loadProfile(); }).catch(function() {});
  };

  window.deleteCredential = function(id) {
    fetch('/api/profile/credentials/' + id, { method: 'DELETE' })
      .then(function() { window.loadProfile(); }).catch(function() {});
  };

  function renderCompetence(competence, mapKnowledge) {
    // Hide Skills card — no longer shown
    var skillsCard = document.getElementById('skills-card');
    if (skillsCard) skillsCard.style.display = 'none';

    var knowledgeCard = document.getElementById('knowledge-card');
    if (!knowledgeCard) return;

    var items = mapKnowledge || [];
    if (!items.length) {
      knowledgeCard.innerHTML = `<div class="p-card-title">Knowledge</div>` +
        empty('Your knowledge map will appear here as you learn and self-assess topics.');
      return;
    }

    var BAR_COLORS = {
      tested:        '#8BAD7E',
      self_reported: '#C4826A',
      estimated:     '#B0A496',
    };
    var SRC_LABELS = {
      tested:        'Tested',
      self_reported: 'Self-reported',
      estimated:     'Estimated',
    };

    var rows = items.map(function(k) {
      var pct      = Math.round(k.percentage) || 0;
      var barColor = BAR_COLORS[k.source] || BAR_COLORS.estimated;
      var srcClass = k.source === 'tested' ? 'tested' : k.source === 'self_reported' ? 'self-reported' : 'self-reported';
      var srcLabel = SRC_LABELS[k.source] || '';
      return `<div class="p-prof-row">
        <div class="p-prof-info" style="flex:1;min-width:0">
          <div class="p-prof-name">${esc(k.label)}</div>
          ${k.breadcrumb ? `<div class="p-prof-sub">${esc(k.breadcrumb)}</div>` : ''}
          <span class="p-source ${srcClass}">${srcLabel}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <div style="width:72px;height:4px;background:rgba(58,48,40,0.09);border-radius:2px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${barColor};border-radius:2px"></div>
          </div>
          <span style="font-size:12px;font-weight:650;color:#2C2820;width:34px;text-align:right">${pct}%</span>
        </div>
      </div>`;
    }).join('');

    knowledgeCard.innerHTML = `<div class="p-card-title">Knowledge</div>
      <div style="max-height:480px;overflow-y:auto">${rows}</div>`;
  }

  var _allReflections = [];
  var _reflShowing    = 5;

  function _renderReflectionsWithState() {
    const card = document.getElementById('reflections-card');
    if (!card) return;
    const showing   = _allReflections.slice(0, _reflShowing);
    const remaining = Math.max(0, _allReflections.length - _reflShowing);

    const rowsHtml = !showing.length
      ? empty('Reflections on your learning will appear here. You can add one when logging an activity.')
      : showing.map(function(r) {
          var eventLine = r.event_title
            ? `<div style="font-size:11px;color:#9A8E86;margin-top:8px">
                 On: <em>${esc(r.event_title)}</em>${r.event_date ? ' · ' + fmtDate(r.event_date) : ''}
               </div>`
            : '';
          return `<div class="p-quote" style="margin-bottom:14px">
            <div style="font-size:10px;color:#B0A496;margin-bottom:6px">${fmtDate(r.created_at)}</div>
            "${esc(r.text)}"
            ${eventLine}
          </div>`;
        }).join('');

    const moreBtn = remaining > 0
      ? `<button class="p-edit-btn" onclick="window.loadMoreReflections()" style="margin-top:4px">
           Load more (${remaining} remaining)
         </button>`
      : '';

    card.innerHTML = `<div class="p-card-title">Reflections</div>
      <div style="max-height:380px;overflow-y:auto">${rowsHtml}</div>` + moreBtn;
  }

  function renderReflections(reflections) {
    _allReflections = reflections || [];
    _reflShowing    = 5;
    _renderReflectionsWithState();
  }

  window.loadMoreReflections = function() {
    _reflShowing += 5; _renderReflectionsWithState();
  };

  function renderGoals(aspirations, objectives, plans) {
    const aspCard = document.getElementById('aspirations-card');
    if (aspCard) {
      aspCard.innerHTML = (aspirations || []).length
        ? aspirations.map(a => `<div class="p-aspiration">
            <span class="p-aspiration-arrow">→</span><span>${esc(a.text)}</span>
          </div>`).join('')
        : empty('What do you want to become as a learner? Your long-term direction.');
    }

    const objCard = document.getElementById('objectives-card');
    if (objCard) {
      objCard.innerHTML = (objectives || []).length
        ? objectives.map(o => `<div class="p-objective">
            <div class="p-objective-dot"></div>
            <div>
              <div class="p-objective-title">${esc(o.title)}</div>
              ${o.target_description ? `<div class="p-objective-target">${esc(o.target_description)}</div>` : ''}
            </div>
          </div>`).join('')
        : empty('Specific learning outcomes you want to achieve.');
    }

    const planCard = document.getElementById('plans-card');
    if (planCard) {
      planCard.innerHTML = (plans || []).length
        ? plans.map(p => `<div class="p-plan">
            <div class="p-plan-when">${esc(p.frequency)}</div>
            <div class="p-plan-body">
              <div class="p-plan-title">${esc(p.title)}</div>
              ${p.description ? `<div class="p-plan-desc">${esc(p.description)}</div>` : ''}
            </div>
          </div>`).join('')
        : empty('Concrete next steps with timeframes.');
    }
  }

  /* ─── Inline edit for identity ───────────────────────────────── */
  window.editIdentity = function () {
    const card = document.getElementById('identity-card');
    if (!card) return;
    const vals = {};
    card.querySelectorAll('[data-field]').forEach(el => { vals[el.dataset.field] = el.textContent.trim(); });

    // Year of birth dropdown
    const curYear = new Date().getFullYear();
    var yearOpts = '<option value="">—</option>';
    for (var y = curYear - 14; y >= 1930; y--) {
      yearOpts += '<option value="' + y + '"' + (String(vals.birth_year) === String(y) ? ' selected' : '') + '>' + y + '</option>';
    }

    // Language dropdown (extend list as platform adds language support)
    var LANGUAGES = ['English'];
    var langOpts = '<option value="">—</option>' + LANGUAGES.map(function(l) {
      return '<option value="' + l + '"' + (vals.location === l ? ' selected' : '') + '>' + l + '</option>';
    }).join('');

    card.innerHTML = `
      <div class="p-kv">
        <div class="p-kv-label">Full name</div>
        <div class="p-kv-value">
          <input class="p-edit-input" data-field="display_name" value="${esc(vals.display_name || '')}" placeholder="Full name">
        </div>
        <div class="p-kv-label">Year of birth</div>
        <div class="p-kv-value">
          <select class="p-edit-input" data-field="birth_year">${yearOpts}</select>
        </div>
        <div class="p-kv-label">Language</div>
        <div class="p-kv-value">
          <select class="p-edit-input" data-field="location">${langOpts}</select>
        </div>
        <div class="p-kv-label">
          Culture
          <span class="p-tip" data-tip="We use this to personalise your learning content. It can indicate your nationality, geographic region, religion, or other cultural context — leave blank if you prefer not to share.">ⓘ</span>
        </div>
        <div class="p-kv-value">
          <input class="p-edit-input" data-field="cultural_background" value="${esc(vals.cultural_background || '')}" placeholder="Optional">
        </div>
        <div class="p-kv-label">
          ID number
          <span class="p-tip" data-tip="Your national ID, social security, driver's licence or similar. Used to resolve identity disputes, if needed.">ⓘ</span>
        </div>
        <div class="p-kv-value">
          <input class="p-edit-input" data-field="id_number" value="${esc(vals.id_number || '')}" placeholder="Optional">
        </div>
      </div>
      <button class="p-edit-btn primary" onclick="window.saveIdentity()">Save</button>
      <button class="p-edit-btn" onclick="window.loadProfile()">Cancel</button>`;
  };

  window.saveIdentity = function () {
    const card = document.getElementById('identity-card');
    if (!card) return;
    const data = {};
    card.querySelectorAll('.p-edit-input[data-field]').forEach(el => { data[el.dataset.field] = el.value.trim(); });
    fetch('/api/profile/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(() => window.loadProfile()).catch(() => alert('Save failed — please try again.'));
  };

  window.editAbout = function () {
    const card = document.getElementById('about-card');
    if (!card) return;
    const current = card.querySelector('[style]')?.textContent.trim() || '';
    card.innerHTML = `
      <textarea class="p-edit-input" style="width:100%;min-height:140px;resize:vertical" placeholder="Describe how and when and where you learn best, and any special needs that impact your learning…">${esc(current)}</textarea>
      <button class="p-edit-btn primary" onclick="window.saveAbout(this)">Save</button>
      <button class="p-edit-btn" onclick="window.loadProfile()">Cancel</button>`;
  };

  window.saveAbout = function (btn) {
    const card = document.getElementById('about-card');
    const about = card.querySelector('textarea').value.trim();
    fetch('/api/profile/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ about }),
    }).then(() => window.loadProfile()).catch(() => alert('Save failed.'));
  };

  /* ─── Main load ───────────────────────────────────────────────── */
  window.loadProfile = function () {
    fetch('/api/profile')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => {
        renderIdentity(d.passport || {});
        renderInterests(d.tags);
        renderRelationships(d.relationships);
        renderEvents(d.events);
        renderCredentials(d.credentials, d.mapKnowledge);
        renderCompetence(d.competence, d.mapKnowledge);
        renderReflections(d.reflections);
        renderGoals(d.aspirations, d.objectives, d.plans);
      })
      .catch(err => {
        console.error('Profile load failed:', err);
      });
  };

  // Boot
  window.loadProfile();

})();
