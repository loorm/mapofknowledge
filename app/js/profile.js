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
    const name     = passport.display_name || 'Your Name';
    const about    = passport.about || '';
    const location = passport.location || '';
    const tagline  = [passport.tagline, location].filter(Boolean).join(' · ');

    // Top-bar banner
    const banner = document.querySelector('.topbar-banner-inner');
    if (banner) banner.innerHTML = `<span class="topbar-banner-dot"></span>Learner Passport — ${esc(name)}`;

    // Left nav
    const avatarCircle = document.querySelector('.pnav-avatar-circle');
    if (avatarCircle) avatarCircle.textContent = initials(name);
    const navName = document.querySelector('.pnav-name');
    if (navName) navName.textContent = name;
    const navTagline = document.querySelector('.pnav-tagline');
    if (navTagline) navTagline.innerHTML = esc(tagline || 'Learner on Map of Knowledge');

    // Identity card
    const idCard = document.getElementById('identity-card');
    if (idCard) {
      idCard.innerHTML = `
        <div class="p-kv">
          <div class="p-kv-label">Full name</div>
          <div class="p-kv-value" data-field="display_name">${esc(passport.display_name || '')}</div>
          <div class="p-kv-label">Pronouns</div>
          <div class="p-kv-value" data-field="pronouns">${esc(passport.pronouns || '')}</div>
          <div class="p-kv-label">Year of birth</div>
          <div class="p-kv-value" data-field="birth_year">${esc(passport.birth_year || '')}</div>
          <div class="p-kv-label">Location</div>
          <div class="p-kv-value" data-field="location">${esc(passport.location || '')}</div>
          <div class="p-kv-label">Cultural background</div>
          <div class="p-kv-value" data-field="cultural_background">${esc(passport.cultural_background || '')}</div>
          <div class="p-kv-label">Tagline</div>
          <div class="p-kv-value" data-field="tagline">${esc(passport.tagline || '')}</div>
        </div>
        <button class="p-edit-btn" onclick="window.editIdentity()">Edit identity</button>`;
    }

    // About card
    const aboutCard = document.getElementById('about-card');
    if (aboutCard) {
      aboutCard.innerHTML = about
        ? `<div class="p-kv-value" style="font-size:13px;color:#4A4038;line-height:1.75">${esc(about)}</div>
           <button class="p-edit-btn" onclick="window.editAbout()">Edit</button>`
        : `${empty('Tell your story — who you are as a learner, what drives you.')}
           <button class="p-edit-btn" onclick="window.editAbout()">Add about text</button>`;
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
        <div style="font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#8A7E72;margin-bottom:8px">What matters</div>
        <div class="p-tags">${vHtml}</div>
      </div>`;
  }

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

  function renderEvents(events) {
    const ledger = document.getElementById('events-ledger');
    if (!ledger) return;
    if (!events || !events.length) {
      ledger.innerHTML = empty('Your learning events will appear here as you complete nodes and knobits.');
      return;
    }
    ledger.innerHTML = events.slice(0, 10).map(ev => `
      <div class="p-ledger-row">
        <div class="p-ledger-date">${fmtDate(ev.event_date)}</div>
        <div class="p-ledger-info">
          <div class="p-ledger-title">${esc(ev.title)}</div>
          ${ev.institution ? `<div class="p-ledger-sub">${esc(ev.institution)}</div>` : ''}
          ${ev.result ? `<div class="p-ledger-result">${esc(ev.result)}</div>` : ''}
        </div>
        <span class="p-type ${esc(ev.type)}">${esc(ev.type.charAt(0).toUpperCase() + ev.type.slice(1))}</span>
      </div>`).join('') +
      (events.length > 10
        ? `<div class="p-view-more"><span>+ ${events.length - 10} more events</span></div>`
        : '');
  }

  function renderCredentials(credentials, mapKnowledge) {
    // Platform credentials (auto-generated from learning)
    const platform = (credentials || []).filter(c => c.type === 'platform');
    const platformCard = document.getElementById('platform-credentials-card');
    if (platformCard) {
      if (!platform.length) {
        platformCard.innerHTML = empty('Complete all knobits for a node to earn a platform credential here.');
      } else {
        platformCard.innerHTML = platform.map(c => `
          <div class="p-cred">
            <div class="p-cred-icon internal">🗺️</div>
            <div>
              <div class="p-cred-title">${esc(c.title)}</div>
              <div class="p-cred-issuer">${esc(c.issuer || 'Map of Knowledge · KaiQ Platform')}</div>
              <div class="p-cred-date">${fmtDate(c.awarded_date)}${c.score_pct ? ` · Score: ${c.score_pct}%` : ''}</div>
              ${c.blockchain_hash ? `<div class="p-cred-hash">${esc(c.blockchain_hash)}…</div>` : ''}
            </div>
          </div>`).join('');
      }
    }

    // External qualifications
    const quals = (credentials || []).filter(c => c.type === 'qualification');
    const qualCard = document.getElementById('qualifications-card');
    if (qualCard) {
      qualCard.innerHTML = quals.length
        ? quals.map(c => `<div class="p-cred">
            <div class="p-cred-icon qual">🎓</div>
            <div>
              <div class="p-cred-title">${esc(c.title)}</div>
              <div class="p-cred-issuer">${esc(c.issuer || '')}</div>
              <div class="p-cred-date">${fmtDate(c.awarded_date)}${c.grade ? ` · ${esc(c.grade)}` : ''}</div>
            </div>
          </div>`).join('')
        : empty('Add your formal qualifications (degrees, diplomas).');
    }

    // Certifications
    const certs = (credentials || []).filter(c => c.type === 'certification' || c.type === 'award');
    const certsCard = document.getElementById('certifications-card');
    if (certsCard) {
      certsCard.innerHTML = certs.length
        ? certs.map(c => `<div class="p-cred">
            <div class="p-cred-icon cert">${c.type === 'award' ? '⭐' : '📋'}</div>
            <div>
              <div class="p-cred-title">${esc(c.title)}</div>
              <div class="p-cred-issuer">${esc(c.issuer || '')}</div>
              <div class="p-cred-date">${fmtDate(c.awarded_date)}${c.grade ? ` · ${esc(c.grade)}` : ''}</div>
            </div>
          </div>`).join('')
        : empty('Add certifications, badges, and awards.');
    }
  }

  function renderCompetence(competence, mapKnowledge) {
    // Knowledge domains from manual passport entries + map data
    const knowledgeCard = document.getElementById('knowledge-card');
    if (knowledgeCard) {
      const mapItems = (mapKnowledge || []).map(k => ({
        name: k.label,
        description: k.parent_label ? `${k.parent_label}` : '',
        level: Math.round(k.percentage / 20),  // 0-100% → 0-5 dots
        source: k.source,
        fromMap: true,
      }));

      const manualKnowledge = (competence || []).filter(c => c.type === 'knowledge');

      // Merge: manual entries first, then map items not already in manual
      const manualNames = new Set(manualKnowledge.map(k => k.name.toLowerCase()));
      const merged = [
        ...manualKnowledge,
        ...mapItems.filter(k => !manualNames.has(k.name.toLowerCase())),
      ];

      if (!merged.length) {
        knowledgeCard.innerHTML = empty('Knowledge domains will appear here as you learn and self-report.');
      } else {
        const legend = `<div style="font-size:11px;color:#9A8E86;margin-bottom:14px">
          ● ● ● ● ● expert &nbsp;·&nbsp; ● ● ● ● ○ advanced &nbsp;·&nbsp;
          ● ● ● ○ ○ working &nbsp;·&nbsp; ● ● ○ ○ ○ developing &nbsp;·&nbsp; ● ○ ○ ○ ○ introductory
        </div>`;

        const rows = merged.slice(0, 12).map(k => {
          const lvl  = Math.min(5, Math.max(0, k.level || 1));
          const dots = Array.from({length: 5}, (_, i) =>
            `<div class="p-dot ${i < lvl ? 'on s5' : 'off'}"></div>`).join('');
          const srcClass = k.source === 'tested' ? 'tested' : 'self-reported';
          const srcLabel = k.source === 'tested' ? 'Tested' : 'Self-reported';
          return `<div class="p-prof-row">
            <div class="p-prof-info">
              <div class="p-prof-name">${esc(k.name)}</div>
              ${k.description ? `<div class="p-prof-sub">${esc(k.description)}</div>` : ''}
              <span class="p-source ${srcClass}">${srcLabel}</span>
            </div>
            <div class="p-dots">${dots}</div>
          </div>`;
        }).join('');

        knowledgeCard.innerHTML = legend + rows +
          (merged.length > 12
            ? `<div class="p-view-more"><span>+ ${merged.length - 12} more tracked</span></div>`
            : '');

        // Languages section
        const langs = (competence || []).filter(c => c.type === 'language');
        if (langs.length) {
          knowledgeCard.innerHTML += `<div class="p-card-sub-label">Languages</div>` +
            langs.map(l => `<div class="p-lang">
              <div class="p-lang-pair"><span class="p-lang-name">${esc(l.name)}</span></div>
              <span class="p-lang-level">${esc(l.proficiency_label || '')}</span>
            </div>`).join('');
        }
      }
    }

    // Skills
    const skillsCard = document.getElementById('skills-card');
    if (skillsCard) {
      const skills = (competence || []).filter(c => c.type === 'skill');
      if (!skills.length) {
        skillsCard.innerHTML = empty('Add technical skills and learning practices here.');
      } else {
        skillsCard.innerHTML = skills.map(k => {
          const lvl  = Math.min(5, Math.max(0, k.level || 1));
          const dots = Array.from({length: 5}, (_, i) =>
            `<div class="p-dot ${i < lvl ? 'on s5' : 'off'}"></div>`).join('');
          return `<div class="p-prof-row">
            <div class="p-prof-info">
              <div class="p-prof-name">${esc(k.name)}</div>
              ${k.description ? `<div class="p-prof-sub">${esc(k.description)}</div>` : ''}
              <span class="p-source self-reported">Self-reported</span>
            </div>
            <div class="p-dots">${dots}</div>
          </div>`;
        }).join('');
      }
    }
  }

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
    card.innerHTML = `
      <div class="p-kv">
        ${[['display_name','Full name'],['pronouns','Pronouns'],['birth_year','Year of birth'],
           ['location','Location'],['cultural_background','Cultural background'],['tagline','Tagline']]
          .map(([f, label]) => `
            <div class="p-kv-label">${esc(label)}</div>
            <div class="p-kv-value">
              <input class="p-edit-input" data-field="${f}" value="${esc(vals[f] || '')}" placeholder="${esc(label)}">
            </div>`).join('')}
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
      <textarea class="p-edit-input" style="width:100%;min-height:120px;resize:vertical" placeholder="Tell your story…">${esc(current)}</textarea>
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
        renderLearningStyle(d.learningStyle);
        renderEvents(d.events);
        renderCredentials(d.credentials, d.mapKnowledge);
        renderCompetence(d.competence, d.mapKnowledge);
        renderGoals(d.aspirations, d.objectives, d.plans);
      })
      .catch(err => {
        console.error('Profile load failed:', err);
      });
  };

  // Boot
  window.loadProfile();

})();
