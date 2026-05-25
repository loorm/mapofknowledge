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
