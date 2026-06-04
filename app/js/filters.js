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
  var FILTERS = {

    'my-knowledge': {
      label: 'My Knowledge',
      color: '#9B8FB5',
      dynamic: true,      // resolved at click-time from /api/map/progress
      labels: new Set()   // populated dynamically; ≥50% knowledge threshold
    },

    'estonian-basic-school': {
      label: 'Estonian Basic School 2023',
      color: '#8BAD7E',
      // Estonian National Curriculum for Basic School (grades 1–9, ages 7–15).
      // Source: https://oppekava.ee/pohikool-2023/
      // Labels are at L3 or L4 level to avoid over-including entire academic domains.
      labels: new Set([

        /* ── MATHEMATICS ── */
        // Arithmetic (L3): all appropriate for basic school
        'Arithmetic',
        // Algebra (L4 nodes): basic concepts only — excludes Matrices, Determinants, Vectors, Logarithms, Series
        'Variables', 'Expressions', 'Equations', 'Inequalities',
        'Functions', 'Polynomials', 'Systems of equations', 'Exponents', 'Sequences',
        // Geometry (L4 nodes): Euclidean plane/solid only — excludes Trigonometry, Vectors, Projective, Non-Euclidean
        'Points, lines & planes', 'Angles', 'Polygons', 'Triangles', 'Quadrilaterals',
        'Circles', 'Perimeter & area', 'Volume & surface area',
        'Congruence', 'Similarity', 'Symmetry', 'Transformations', 'Coordinate geometry',
        // Statistics & Probability (L4): introductory only
        'Descriptive statistics',
        'Sample spaces', 'Events', 'Probability axioms',

        /* ── PHYSICS ── */
        // Mechanics, thermodynamics, sound — whole L3 appropriate
        'Classical mechanics', 'Thermodynamics', 'Acoustics',
        // Electricity & magnetism (L4): excludes Maxwell's equations and Electrodynamics
        'Electric charge & fields', 'Magnetism', 'Electromagnetic induction',
        // Optics (L4): geometric and wave optics; excludes Quantum optics
        'Geometric optics', 'Wave optics', 'Colour & perception',
        // Quantum mechanics and Relativity are NOT basic school

        /* ── CHEMISTRY ── */
        // Basic concepts only (L4); excludes Quantum chemistry, Theoretical/Computational chemistry
        'Thermochemistry', 'Chemical kinetics',   // Physical chemistry basics
        'Functional group chemistry',              // Organic chemistry basics
        'Main group chemistry',                    // Inorganic: elements, periodic table, bonding
        'Electrochemical cells', 'Electrolysis', 'Redox thermodynamics',

        /* ── BIOLOGY ── */
        // Excludes Molecular Biology (university-level)
        'Botany', 'Zoology', 'Evolutionary Biology', 'Ecology', 'Genetics',
        // Cellular Biology (L4): excludes Neurobiology
        'Cell structure', 'Cell cycle', 'Organelle function', 'Cell membrane biology',
        // Microbiology (L4): disease-relevant basics only
        'Bacteriology', 'Virology',

        /* ── GEOGRAPHY ── */
        // Whole L2: basic school covers physical + human geography, maps, water, soil
        'Geography',

        /* ── PSYCHOLOGY (inimeseõpetus) ── */
        // Human development
        'Developmental psychology',
        // Basic cognitive (L4)
        'Attention', 'Memory', 'Perception',
        // Basic social behaviour (L4)
        'Social influence', 'Group dynamics', 'Prosocial behaviour',
        // Basic biological/health (L4)
        'Sleep', 'Arousal',

        /* ── SOCIOLOGY ── */
        // Family, culture, basic stratification — excludes Social theory and Research methods
        'Family sociology', 'Culture and society', 'Social stratification',

        /* ── POLITICAL SCIENCE (ühiskonnaõpetus) ── */
        // Political systems — excludes Methodology, Political economy, IR theory
        'Comparative politics',
        // International institutions (L4): EU, UN context
        'International institutions',

        /* ── ECONOMICS (basic economic literacy in civics) ── */
        // Microeconomics basics (L4)
        'Consumer theory', 'Producer theory',
        // Macroeconomics basics (L4)
        'Money', 'Inflation', 'Unemployment', 'National income accounting',
        // Public economics basics (L4)
        'Public goods', 'Externalities', 'Taxation',

        /* ── ETHICS (moral component of inimeseõpetus) ── */
        // Normative ethics (L3): virtue, consequentialism, deontology basics
        'Normative ethics',
        // Applied ethics (L4): environmental, digital, animal — topics in curriculum
        'Environmental ethics', 'Technology ethics', 'Animal ethics', 'Bioethics',

        /* ── HISTORY (ajalugu) ── */
        // World historical periods (L3): Prehistory → Contemporary — excludes historiography/methodology
        'World historical periods',

        /* ── LINGUISTICS (keel) ── */
        // Basic grammar study only; excludes Historical linguistics, Sociolinguistics, Typology, Formal linguistics
        'Morphology', 'Syntax', 'Semantics',

        /* ── PHILOLOGY ── */
        // Only language families taught or relevant in Estonian basic school; NOT all 6000 languages
        'Uralic languages',      // Estonian, Finnish, Hungarian — Finno-Ugric family (L3)
        'Germanic languages',    // English — primary foreign language (L4)
        'Slavic languages',      // Russian — widely taught in Estonia (L4)
        'Baltic languages',      // Latvian, Lithuanian — neighbours (L4)

        /* ── LITERATURE (kirjandus) ── */
        // Practical literary skills only; excludes Literary theory (Structuralism etc.) and Comparative literature
        'Poetics', 'Rhetoric', 'Narrative theory',

        /* ── MUSIC (muusika) ── */
        // Theory and performance; excludes Conducting, Musicology, Ethnomusicology
        'Music theory', 'Performance practice',

        /* ── VISUAL ARTS (kunst) ── */
        // Practical art-making subjects; excludes Art theory and Iconography
        'Colour theory', 'Drawing', 'Painting', 'Printmaking',

        /* ── DIGITAL & ICT (digioskused) ── */
        'Digital & ICT',

        /* ── COMPUTER SCIENCE / INFORMATICS (optional, grades 7–9) ── */
        // Basic algorithmic thinking only; excludes Theory of computation, Architecture, Distributed systems
        'Algorithms',

        /* ── PHYSICAL EDUCATION (kehaline kasvatus) ── */
        'Sports Science',

        /* ── TECHNOLOGY & CRAFTS (tehnoloogia / käsitöö) ── */
        'Design',
        'Culinary Crafts',
        'Manufacturing & engineering trades',

      ])
    },

    'aws-solutions-architect': {
      label: 'AWS Solutions Architect',
      color: '#6BA8C4',
      // AWS Solutions Architect – Associate (SAA-C03) exam domain coverage.
      // Maps to the computer science and systems knowledge the credential tests.
      labels: new Set([
        /* Core CS foundations */
        'Algorithms', 'Data structures',
        'Operating systems',
        /* Networking */
        'Computer networks', 'Network protocols',
        /* Databases & storage */
        'Databases', 'Relational databases', 'Non-relational databases',
        /* Security */
        'Information security', 'Cryptography', 'Identity & access management',
        /* Systems & software engineering */
        'Distributed systems', 'Software architecture', 'Software engineering',
        'Cloud computing', 'Virtualisation',
        /* Economics of cloud */
        'Cost optimisation', 'Microeconomics',
      ])
    },

    'b-driving-licence': {
      label: 'B-Category Driving Licence',
      color: '#D4A85A',
      // Estonian B-category (car) driving licence — theory and practical exam.
      // Physics of motion, human factors, traffic law, and vehicle mechanics.
      labels: new Set([
        /* Physics */
        'Classical mechanics',  // braking distance, kinetic energy, friction
        'Geometric optics',     // visibility, mirrors, headlights
        'Thermodynamics',       // engine basics, tyre pressure
        /* Psychology / human factors */
        'Attention', 'Perception', 'Reaction time',
        'Risk assessment',
        /* Biology / health */
        'Pharmacology',         // alcohol, medication effects on driving
        /* Law */
        'Law',                  // traffic regulations sit within the legal domain
        /* Ethics */
        'Technology ethics',    // road-user responsibility
        /* Environment */
        'Environmental ethics', // emissions, fuel efficiency awareness
      ])
    },

    'abrsm-grade5-music': {
      label: 'ABRSM Grade 5 Music Theory',
      color: '#C48FA0',
      // ABRSM Grade 5 Music Theory syllabus — prerequisite for practical grades 6–8.
      // Covers notation, harmony, counterpoint, form, and music history up to the 20th century.
      labels: new Set([
        /* Music */
        'Music theory',         // harmony, rhythm, intervals, scales, modes
        'Performance practice', // articulation, dynamics, stylistic conventions
        /* Acoustics (physics of sound) */
        'Acoustics',
        /* History */
        'World historical periods', // Baroque → 20th c. contextualised in music
        /* Mathematics — rhythm as ratio */
        'Arithmetic',
        /* Language & notation */
        'Semantics',            // musical terminology (Italian, German, French markings)
      ])
    }

  };

  /* ─── Custom filters from localStorage ──────────────────────────── */
  (function loadCustomFilters() {
    var customs;
    try { customs = JSON.parse(localStorage.getItem('kq_filter_custom') || '[]'); }
    catch(e) { customs = []; }

    var list = document.querySelector('#filter-panel .fp-list');
    customs.forEach(function(cf) {
      FILTERS[cf.id] = { label: cf.label, color: cf.color, labels: new Set(cf.labels) };
      var div = document.createElement('div');
      div.className = 'fp-item';
      div.dataset.filterId = cf.id;
      div.style.setProperty('--fi-color', cf.color);
      div.innerHTML = '<div class="fp-radio"></div><div class="fp-dot"></div>'
                    + '<span class="fp-label">' + cf.label + '</span>';
      list.appendChild(div);
    });
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

  function applyToMap(labelSet) {
    /* setMapFilter is exposed by app.js after the map loads.
       If called before the map is ready, it's a no-op. */
    if (typeof window.setMapFilter === 'function') {
      window.setMapFilter(labelSet);
    }
  }

})();
