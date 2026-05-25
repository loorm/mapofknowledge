/* ══════════════════════════════════════════════
   FILTERS  —  js/filters.js
   Defines filter sets and controls the filter
   panel UI. Calls window.setMapFilter() which
   is exposed by app.js once the map is loaded.
   ══════════════════════════════════════════════ */

(function () {

  /* ─── Filter definitions ─────────────────────────────────────────────
   Each filter specifies a Set of node LABEL strings at any level.
   The ancestry-chain walk in app.js means matching any ancestor
   also colours all its descendants.
   ──────────────────────────────────────────────────────────────────── */
  const FILTERS = {

    'my-knowledge': {
      label: 'My Knowledge',
      color: '#9B8FB5',
      // MA in Law graduate, ~20 years post-graduation.
      // Core: all of Law (L2) and its full descendant tree.
      // Adjacent: fields a lawyer necessarily studies.
      labels: new Set([
        /* Social Sciences */
        'Law',                   // L2 — entire law domain + all children
        'Political Science',     // constitutional law, governance
        'Sociology',             // sociology of law, criminology
        'Economics',             // commercial law, economic analysis of law
        /* Philosophy */
        'Ethics',                // legal ethics, moral philosophy, rights theory
        'Political philosophy',  // jurisprudence, social contract, theory of state
        'Logic',                 // legal reasoning, formal argumentation
        /* Humanities */
        'History',               // Roman law, legal history, comparative law
      ])
    },

    'estonian-main-school': {
      label: 'Estonian Main School 2023',
      color: '#8BAD7E',
      // Estonian National Curriculum for Basic School (grades 1–9, ages 7–15).
      // Source: https://oppekava.ee/pohikool-2023/
      // 8 subject areas: Language & Literature, Foreign Languages, Mathematics,
      // Natural Sciences, Social Studies, Arts, Technology, Physical Education.
      labels: new Set([
        /* Mathematics — entire domain (matemaatika) */
        'Mathematics',           // L1 — catches Pure Mathematics + Applied mathematics
        /* Natural Sciences (loodusained) */
        'Biology',               // bioloogia
        'Chemistry',             // keemia
        'Physics',               // füüsika
        'Geography',             // geograafia (loodusõpetus / maateadus)
        /* Social Studies (sotsiaalained) */
        'History',               // ajalugu
        'Political Science',     // ühiskonnaõpetus (civics)
        'Sociology',             // social structure component of ühiskonnaõpetus
        'Psychology',            // inimeseõpetus (human studies)
        'Ethics',                // moral component of inimeseõpetus
        /* Arts (kunstiained) */
        'Music',                 // muusika
        'Visual arts',           // kunst (visual arts)
        /* Language & Literature (keel ja kirjandus) */
        'Linguistics',           // keeleteadus — Estonian language study
        'Literature',            // kirjandus
        'Philology',             // filoloogia — language arts, text study
        /* Technology & Crafts (tehnoloogia) */
        'Design',                // tööõpetus / disain
        'Culinary Crafts',       // käsitöö ja kodundus
        'Manufacturing & engineering trades', // tööõpetus
        /* Physical Education (kehaline kasvatus) */
        'Sports Science',        // kehaline kasvatus
        /* Informatics — optional subject (informaatika) */
        'Computer Science',      // informaatika
        'Digital & ICT',         // digioskused
      ])
    }

  };

  /* ─── State ──────────────────────────────────────────────────────── */
  let activeFilterId = null;

  /* ─── DOM refs ───────────────────────────────────────────────────── */
  const panel    = document.getElementById('filter-panel');
  const filterBtn= document.getElementById('filter-btn');
  const clearBtn = document.getElementById('fp-clear');

  /* ─── Filter panel toggle ────────────────────────────────────────── */
  filterBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    panel.classList.toggle('open');
    filterBtn.classList.toggle('active', panel.classList.contains('open'));
  });

  document.addEventListener('click', function (e) {
    if (!panel.contains(e.target) && e.target !== filterBtn) {
      panel.classList.remove('open');
      filterBtn.classList.remove('active');
    }
  });

  /* ─── Filter item clicks ─────────────────────────────────────────── */
  document.querySelectorAll('.fp-item').forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.stopPropagation();
      const fid = this.dataset.filterId;

      if (activeFilterId === fid) {
        /* clicking the active filter → deactivate */
        deactivate();
      } else {
        /* activate this filter */
        activeFilterId = fid;
        document.querySelectorAll('.fp-item').forEach(function (el) {
          el.classList.toggle('active', el.dataset.filterId === fid);
        });
        if (clearBtn) clearBtn.classList.remove('hidden');
        applyToMap(FILTERS[fid].labels);
      }
    });
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
  }

  function applyToMap(labelSet) {
    /* setMapFilter is exposed by app.js after the map loads.
       If called before the map is ready, it's a no-op. */
    if (typeof window.setMapFilter === 'function') {
      window.setMapFilter(labelSet);
    }
  }

})();
