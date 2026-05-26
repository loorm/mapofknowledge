# Session Notes

## Completed features (as of this session)

### Filter panel
- Opens to the right of the bottom-left control card when the Filter button is clicked
- Two radio-style filters, only one active at a time; Clear button dismisses
- `js/filters.js` — filter definitions + panel UI logic
- `window.setMapFilter(labelSet)` hook exposed by `app.js` after map loads
- Non-matching nodes → grey fill `#585858` at 0.3 opacity
- Non-matching edges → grey `#585858` at 0.06 opacity (both endpoints must pass)
- Filter re-applied after every `rebuild()` (expand/collapse) via `refreshNodeColors()`
- `resetHighlight()` now calls `refreshNodeColors()` so filter state survives deselection

**My Knowledge** — MA in Law grad, ~20 years post-graduation  
Labels: Law (L2), Political Science, Sociology, Economics, Ethics, Political philosophy, Logic, History

**Estonian Main School 2023** — grades 1–9, ages 7–15, source: oppekava.ee/pohikool-2023/  
Uses specific L3/L4 labels throughout — never the full L1/L2 domain — to avoid
over-inclusion. Key refinements:
- Mathematics: Arithmetic (L3) + specific Algebra/Geometry/Stats L4 nodes only
- Physics: Classical mechanics, Thermodynamics, Acoustics (L3) + specific Electromagnetism/Optics L4s; excludes Quantum mechanics and Relativity
- Chemistry: 7 specific L4 nodes; excludes Theoretical/Computational chemistry
- Biology: 5 L3 domains + specific Cellular/Microbiology L4s; excludes Molecular Biology
- History → `World historical periods` (L3 only); excludes Historiography/methodology
- Linguistics → `Morphology`, `Syntax`, `Semantics` only
- Philology → `Uralic languages`, `Germanic languages`, `Slavic languages`, `Baltic languages`; NOT all 6000 language families
- Literature → `Poetics`, `Rhetoric`, `Narrative theory` only
- Psychology → specific L3/L4 for human development, basic cognition, social behaviour
- Sociology → `Family sociology`, `Culture and society`, `Social stratification`
- Political Science → `Comparative politics` + `International institutions`
- Economics → specific L4 nodes (consumer/producer theory, money, inflation, taxation, etc.)
- Music → `Music theory`, `Performance practice`
- Visual arts → `Colour theory`, `Drawing`, `Painting`, `Printmaking`
- Computer Science → `Algorithms` (L3) only

### Other changes this session
- **Legend removed** — `<div id="legend">` and its JS/CSS deleted
- **Skills & Crafts color** — changed from `#9A9890` (grey, indistinguishable when filtered) to `#C4A55A` (warm amber/gold) in the `CONTINENTS` object in `app.js`
- **L4 expand + sidebar** — clicking an expandable L4 node now both expands to L5 and opens the sidebar. Implementation: `toggleExpand(d)` runs first, then highlight+sidebar is deferred via `setTimeout(0)` so the fresh D3 selections from `rebuild()` have settled. `highlightAndOpen(d)` helper extracted for reuse.
- **Expander `+`/`−` signs** — changed to `pointer-events: none` (clicks fall through to the node circle) and `font-size: 5` (≈50% reduction). Previously these text overlays were capturing clicks and preventing `onNodeClick` from running.

## Architecture notes

### Filter matching
`nodePassesFilter(nodeId)` walks the ancestor chain upward. A node is colored if its
own label OR any ancestor's label is in the active filter Set. This means specifying
`'Arithmetic'` (L3) automatically colors all L4/L5 descendants of Arithmetic.

### Rebuild cycle
`rebuild()` → recreates D3 node/link/expander/label selections → calls
`refreshNodeColors()` → calls `sim.alpha(0.4).restart()`

Any code that must run on fresh D3 selections after a rebuild should be deferred
via `setTimeout(0)` (see L4 click handler).

### Z-index layers
canvas(0) < legend removed < tooltip(200) < controls(300) < learning-mode(320) < sidebar(350) < topbar(400) < dropdown(500)
