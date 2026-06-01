# Learning Mode — Design Reference

_For: Claude Code instance extending or maintaining this feature._
_Scope: everything from node selection on the map to knobit completed._

---

## 1. What the system does

A learner selects a leaf node (L5) on the knowledge map and enters a focused, full-screen learning session. The session breaks the topic into small knowledge units called **knobits**, walks through each one in four sequential phases (Teach → Apply → Assess → Result), and ends with a unit-complete screen. The map is hidden but intact underneath throughout.

---

## 2. Files

| File | Responsibility |
|---|---|
| `js/app.js` | Detects node click, opens sidebar, wires the "Learn this" button |
| `js/learning.js` | All learning-mode logic — state, view switching, phase transitions |
| `css/learning.css` | All learning-mode styles — layout, components, animations |
| `index.html` | Contains the full learning-mode DOM (static HTML, populated by JS) |

No separate page. Everything lives inside `index.html` as a hidden overlay.

---

## 3. Entry and exit

**Entry path:**

1. User clicks any node on the D3 graph.
2. `app.js` opens the sidebar and populates it with node data (`d.name`, `d.color`, breadcrumb string `crumb`).
3. User clicks the "Learn this" button (`.sb-learn-btn`).
4. `app.js` calls `closeSidebar()` then `window.openLearningMode(node, crumb)`.
5. `learning.js` sets CSS variables, populates the path view, and shows the overlay.

**Exit paths:**

| Trigger | Action |
|---|---|
| Back button in path header | `closeLearningMode()` → hides overlay, map resumes |
| "Back to the map" on unit-complete screen | same |
| (No other exit — the overlay is modal) |  |

`openLearningMode` and `closeLearningMode` are exposed on `window` by `learning.js` and called by `app.js`.

---

## 4. Overlay structure

`#learning-mode` is a `position:fixed` overlay sitting at `z-index 320`, above the map (`z-index 0`) and below the sidebar (`z-index 350`). It has `display:none` by default and switches to `display:flex` when the class `.active` is added.

It contains exactly three views. Only one is visible at a time. A view is shown by adding the class `.active` to it via `showLmView(id)` (which removes `.active` from all other views first).

```
#learning-mode
├── #lm-path      (View 1 — Learning Path)
├── #lm-knobit    (View 2 — Knobit Lesson)
└── #lm-complete  (View 3 — Unit Complete)
```

The domain-colour accent is injected per session as two CSS variables:

```
--lm-accent       hex value from node.color
--lm-accent-soft  rgba version at 13% opacity
```

These propagate to progress bars, active chips, buttons, and focus rings throughout without any class changes.

---

## 5. Data model

### 5.1 Knobit

A knobit is one atomic learning unit within a topic. Current shape (hardcoded in `learning.js`):

```js
{ id: Number, name: String, tags: String[] }
```

Tags encode status:

| Tag | Meaning |
|---|---|
| `'done'` | Learner has completed this knobit |
| `'teach'` | Learner reached the Teach phase |
| `'apply'` | Learner reached the Apply phase |
| _(empty)_ | Not started |

### 5.2 Module-level state

All state lives inside the `learning.js` IIFE. There is no localStorage persistence yet.

| Variable | Type | Role |
|---|---|---|
| `_node` | Object | The L5 node that triggered the session (`name`, `color`) |
| `_crumb` | String | Ancestor breadcrumb, e.g. `"Mathematics › Algebra"` |
| `KNOBITS` | Array | All knobits for the current unit |
| `CURRENT_KNOBIT_IDX` | Number | 0-based index of the knobit the learner is on now |
| `KNOBIT_DONE_COUNT` | Number | Count of knobits with tag `'done'` |
| `KNOBIT_TOTAL` | Number | `KNOBITS.length` |

All are hardcoded to a sample unit (Linear Equations, 7 knobits) for the current demo.

---

## 6. View 1 — Learning Path (`#lm-path`)

Shows the full list of knobits for the unit, the learner's position within it, and an entry point into the lesson.

**Components:**

| Element | ID / class | Content |
|---|---|---|
| Breadcrumb | `#lm-path-crumb` | Set from `_crumb` |
| Title | `#lm-path-title` | Set from `_node.name` |
| Progress bar fill | `#lm-progress-fill` | Width = `KNOBIT_DONE_COUNT / KNOBIT_TOTAL * 100%` |
| Progress label | `#lm-progress-label` | `"X% complete — keep going!"` |
| Knobit list | `#lm-knobit-list` | Built by `_buildPathView()` |
| Start button | `.lm-start-btn` | Calls `startKnobit()` |

**Knobit list rendering (`_buildPathView`):**

Each `KNOBITS` entry becomes a `.lm-knobit-item`. The item receives additional classes based on state:

| State | Class | Visual |
|---|---|---|
| Completed | `.done` | Checkmark in index circle, green tint, faded |
| Current | `.current` | Accent-coloured index circle, card shadow, clickable |
| Not started | _(none)_ | Plain number, not interactive |

Only the `.current` item has a click handler (`startKnobit()`). All others are inert.

---

## 7. View 2 — Knobit Lesson (`#lm-knobit`)

A four-phase linear sequence. The learner must pass through all four phases in order to complete one knobit.

### 7.1 Navigation bar (`.kn-nav`)

Persistent across all four phases. Contains:

- Back button → `showLmView('lm-path')`
- Knobit name label (`#lm-knobit-nav-label`)
- Thin progress bar (`#kn-progress-fill-bar`): advances 0 → 34 → 67 → 100% as phases progress
- Phase chips: Teach / Apply / Assess / Result

Chip states (managed by `_setPhase(activeId)`):

| Chip | State class |
|---|---|
| Current phase | `.active` (accent colour) |
| Earlier phase | `.done-chip` (green) |
| Later phase | _(none)_ (grey) |

### 7.2 Phase panels

All four panels (`#kn-teach`, `#kn-apply`, `#kn-assess`, `#kn-result`) exist in the DOM simultaneously. Only the `.active` one is shown. `_setPhase(id)` handles the toggle.

Each panel has:
- `.kn-content` — scrollable area with learning content
- `.kn-action-bar` — sticky bottom bar with one CTA button

**Phase transitions are triggered by the CTA buttons:**

```
startKnobit()           → _setPhase('kn-teach'),  progress 0%
goPhase('kn-apply',  34)  → _setPhase('kn-apply'),  progress 34%
goPhase('kn-assess', 67)  → _setPhase('kn-assess'), progress 67%
goPhase('kn-result', 100) → _setPhase('kn-result'), progress 100%
```

`goPhase` also scrolls the entering panel back to the top.

### 7.3 Phase — Teach

Static content cards. No interaction required to advance.

| Card type | Class | Purpose |
|---|---|---|
| Concept | `.kn-concept-card` | Prose explanation |
| Formula | `.kn-formula-card` | Centred symbolic expression (Georgia serif) |
| Example | `.kn-example-card` | Numbered steps via `.kn-steps` / `.kn-step` |

CTA: "Got it — let me try" (no validation).

### 7.4 Phase — Apply

The learner chooses a real-world context and works through a problem.

- Context picker: `.kn-context-strip` containing `.kn-context-pill` buttons.
  - `pickContext(el)` deselects all siblings and toggles `.selected` on the clicked pill.
  - Context selection is currently cosmetic — the scenario card does not change.
- Scenario card (`.kn-scenario-card`): shows a word problem with a free-text input (`.kn-answer-input`).
- Answer input has no validation — CTA advances unconditionally.

CTA: "Check my answer" (no validation).

### 7.5 Phase — Assess

Multiple-choice question. One correct answer, validated on selection.

- Question card: `.kn-question-card` with `.kn-question-text` and `.kn-answer-grid` (2 × 2 tiles).
- Each tile calls `pickAnswer(el)` on click.

`pickAnswer(el)` behaviour:
1. Disables all tiles in the grid (sets `onclick = null`).
2. Finds the tile with `data-correct` attribute — marks it `.correct`.
3. If the selected tile is wrong — marks it `.wrong`.
4. Enables the CTA button (`disabled → enabled`).

The CTA is `disabled` by default and only becomes active after a selection.

CTA: "Submit answers".

### 7.6 Phase — Result

Shows outcome of the knobit.

| Element | Class | Content |
|---|---|---|
| Badge | `.kn-result-badge` | Checkmark, animated with `badge-pop` keyframe |
| Title | `.kn-result-title` | "Knobit complete!" |
| Stats row | `.kn-result-stats` | Three `.kn-stat-card` tiles: score, time, XP |
| Next preview | `.kn-next-preview` | Name and type of the following knobit |

When `goPhase('kn-result', 100)` is called, `_showComplete(false)` is also invoked. Currently `false` is always passed, so the unit-complete view never auto-triggers — `showUnitComplete()` must be called manually (wired to the "Next knobit" button for the final knobit).

---

## 8. View 3 — Unit Complete (`#lm-complete`)

Shown after the learner finishes the last knobit. Centred, full-height layout.

| Element | Class | Content |
|---|---|---|
| Badge | `.lm-complete-badge` | Star/check icon, larger `badge-pop` animation |
| Title | `.lm-complete-title` | "Unit complete!" |
| Subtitle | `.lm-complete-sub` | Unit name embedded |
| Stats | `.lm-complete-stats` | Three `.lm-complete-stat` tiles: knobit count, score %, XP |
| Primary CTA | `.lm-complete-btn-primary` | "Back to the map" → `closeLearningMode()` |
| Secondary CTA | `.lm-complete-btn-ghost` | "Review this unit" → `showLmView('lm-path')` |

---

## 9. What is built vs. what is hardcoded

| Aspect | Status |
|---|---|
| Overlay structure, view switching | Built |
| Phase transitions (Teach → Apply → Assess → Result) | Built |
| Answer validation in Assess (correct/wrong tiles) | Built |
| Accent colour from node | Built |
| Progress bar in path view | Built |
| Progress bar in knobit nav | Built |
| Phase chip states | Built |
| Knobit list rendering (done / current / future) | Built |
| Knobit content (concept, formula, example, scenario, question) | Hardcoded HTML — one sample knobit only |
| Context picker changing the scenario | Wired visually, scenario does not actually change |
| Apply phase answer validation | Not built — CTA advances unconditionally |
| `KNOBITS` array populated from node data | Not built — hardcoded static array |
| Persistence of knobit completion (`tags`, `CURRENT_KNOBIT_IDX`) | Not built — resets on every page load |
| Marking node as done on the map after unit complete | Not built |
| Linking learner passport competence state to completion | Not built |

---

## 10. Extension points

**Dynamic knobit content:**
Replace the hardcoded `KNOBITS` array and the static HTML inside `#kn-teach`, `#kn-apply`, `#kn-assess`, `#kn-result` with data-driven rendering. The knobit object will need `content.teach`, `content.applyScenarios[]`, and `content.assessQuestion` fields.

**Persistence:**
`kq_learning_progress` in localStorage is the natural home. Shape:
```json
{
  "nodeId": {
    "knobits": [{ "id": 1, "tags": ["done"] }, ...],
    "currentIdx": 3
  }
}
```
Read on `openLearningMode`, write after each phase completion and after each knobit result.

**Map feedback:**
After `closeLearningMode()` following a unit-complete, call `window.setMapFilter` or a new `window.markNodeDone(nodeId)` hook in `app.js` to visually reflect completion on the graph.

**Context-adaptive Apply phase:**
`pickContext(el)` already identifies the selected pill. Add a `data-scenario` attribute to each pill and swap the `.kn-scenario-card` content on selection.
