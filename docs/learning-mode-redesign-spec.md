# Learning Mode — Redesign Spec

_For: Claude Code instance rewriting the learning flow._
_Scope: replaces the Teach/Apply/Assess/Result phase model with an adaptive four-phase tutor loop (Explain / Demonstrate / Practice / Meaning)._
_Out of scope: backend, LLM wiring, persistence — UX/views only. Hardcode demo content so the flow can be exercised end-to-end without a server._

---

## 1. What this spec replaces

The existing learning mode (documented in `learning-mode-design.md`) is being replaced. The previous four-phase model (Teach → Apply → Assess → Result) is the wrong shape for the kind of adaptive tutor we want. Most of View 2 is rewritten. View 1 and View 3 are kept with minor adjustments.

When backend/LLM integration is built later this week, the demo's hardcoded content will be replaced with live-generated content. The UI must be designed so that swap is straightforward — content is just data flowing into block components.

---

## 2. Behavior model (read this first)

The new learning loop is an adaptive tutor that walks a learner through one topic. A topic is broken into **knobits** — atomic learning units. For each knobit, the tutor runs four sub-phases **in order**:

1. **Explain** — delivers the concept in **bytes** (one or a few sentences at a time). After every byte, the learner picks one of four options that shapes the next byte.
2. **Demonstrate** — worked examples shown one at a time, with a fixed three-step button pattern.
3. **Practice** — questions one at a time, free-text answers, feedback on each, learner controls when to stop.
4. **Meaning** — a short real-world payoff: why this knobit matters, where it shows up. Uses the same four-option pattern as Explain.

Then the next knobit starts the same loop. After the final knobit's Meaning, View 3 (Unit Complete) shows.

The crucial behavior is **adaptivity by button press**. Every button is a signal that changes what comes next. The UI's job is to surface the right buttons at the right moment, attached to the right block.

---

## 3. What to keep, rewrite, add

### Keep (lightly adapt)

- The `#learning-mode` overlay, z-index stack, three-view structure.
- The `--lm-accent` / `--lm-accent-soft` color injection from `node.color`.
- View 1 — Learning Path: layout, breadcrumb, title, progress bar, knobit list, start button. The list content now comes from a dynamic `KNOBITS` array (still hardcoded for the demo, but variable-length).
- View 3 — Unit Complete: keep as-is.
- View 2 nav bar (back, label, thin progress bar, chip strip) — keep the chrome, change the chip labels and the progress stops.

### Rewrite

- All View 2 content panels. The four old panels (`#kn-teach`, `#kn-apply`, `#kn-assess`, `#kn-result`) are removed.
- Phase chip labels: **Teach/Apply/Assess/Result → Explain / Demonstrate / Practice / Meaning**.
- Progress bar stops: 0/34/67/100 → **0/25/50/75/100** (one stop per phase entry plus completion).
- The single-CTA-per-panel model. Replaced with adaptive button rows attached to individual content blocks.
- The Assess multiple-choice mechanic. Replaced with free-text input + feedback.
- The static card layout (concept/formula/example as fixed cards). Replaced with a vertical content stream where blocks accumulate as the learner progresses.

### Add

- Adaptive byte presentation in Explain (stacked blocks, four-option buttons under the active one).
- The Demonstrate three-step example pattern (View next → I understand/give another → ready/still don't).
- The Practice loop: free-text answer, feedback, Yes-next/No-done.
- The Meaning block with the same four-option pattern as Explain.
- A persistent "Ask anything…" input below the action buttons, available in every phase, for off-script questions.
- Block fading: once a block's choice is made, its buttons lock and dim while the content stays readable.

---

## 4. View 2 — Knobit Lesson (the rewrite)

### 4.1 Layout

```
┌──────────────────────────────────────────────────┐
│ Nav bar (kept): back · label · progress · chips  │
├──────────────────────────────────────────────────┤
│                                                  │
│   Block stream (scrollable)                      │
│   ─ older block (locked, muted buttons)          │
│   ─ older block (locked)                         │
│   ─ active block ← buttons attached here         │
│                                                  │
├──────────────────────────────────────────────────┤
│ Action area (sticky bottom)                      │
│   button row (varies by phase + position)        │
│   "Ask anything…" input        [send]            │
└──────────────────────────────────────────────────┘
```

### 4.2 Nav bar

Same DOM as before, with these changes:

- Chip labels: **Explain · Demonstrate · Practice · Meaning**
- Progress bar fill at phase entry: Explain 0%, Demonstrate 25%, Practice 50%, Meaning 75%, knobit complete 100%
- Chip states unchanged: active / done-chip / future (grey)

### 4.3 Block stream

One scrollable `.kn-stream` container per knobit. Phase transitions **do not** clear it within a knobit — Explain bytes, then Demonstrate examples, then Practice problems, then Meaning, all stack inside the same scroll. The phase boundary is visible via a thin divider with the new phase name (e.g. `── Demonstrate ──`).

When the next knobit begins, the stream clears.

**Block types:**

| Type | Class | Where it appears |
|---|---|---|
| Byte | `.block-byte` | Explain |
| Example | `.block-example` | Demonstrate |
| Practice problem | `.block-practice` | Practice |
| Practice feedback | `.block-feedback` | Practice (after answer submit) |
| Meaning | `.block-meaning` | Meaning |
| User message | `.block-user` | After learner uses "Ask anything…" |
| Note | `.block-note` | Generic info card (e.g. "Try searching YouTube for…") |

**Active vs. locked:**

- The newest block is **active** — full opacity, action buttons live.
- All earlier blocks are **locked** — content fully readable, but their buttons get `.choice-locked` (50% opacity, non-interactive, the chosen option labeled inline e.g. `✓ I understand`).

**Append animation:** fade-in + 8px slide-up, ~150ms.

**Auto-scroll:** only if the user is already near the bottom of the stream. Otherwise leave their scroll position alone.

### 4.4 Action area

Sticky at the bottom of View 2. Two rows:

**Row 1 — button row.** What appears depends on the active block (details below). Disappears when the active block has no choice attached (e.g. while learner is typing a practice answer).

**Row 2 — "Ask anything…" input.** Always present. Single-line text input + send button. On send:

1. The learner's text becomes a `.block-user` in the stream.
2. A response block (`.block-byte` style, or a `.block-note` for non-content responses) is appended underneath.
3. The previous button row reappears under the response block — the learner is still on the same step they paused at.

For the demo: hardcode a small set of recognized off-script questions (e.g. "show me a drawing", "what if the divisor is 2/4"). For unrecognized questions, append a `.block-note` saying "In the live version, the tutor would answer this." Then re-show the prior buttons.

### 4.5 Explain phase

**On phase entry:** progress 0%, Explain chip active, render Byte 1 as active block. Phase divider `── Explain ──` at top of the stream.

**Block content:**
- Container: `.block-byte`
- Small label: "Byte 1", "Byte 2", etc. (muted text)
- Body: a few sentences of prose. May embed images/diagrams (rare, only on user request).

**Button row (four-option):**

```
[I understand]  [I don't understand]  [Too simplistic]  [Too complex]
```

| Press | What happens |
|---|---|
| I understand | Lock current block. Append next byte block as active. |
| I don't understand | Lock current block. Append a rephrased byte (different metaphor/angle) as active. |
| Too simplistic | Lock current block. Append the next byte at higher complexity. |
| Too complex | Lock current block. Append a simpler restatement of the current byte. |

**When all bytes done:** advance to Demonstrate. For the demo, the populated knobit has 6 bytes and the transition happens after the 6th byte's "I understand" press.

### 4.6 Demonstrate phase

**On phase entry:** progress 25%, Explain chip → done-chip, Demonstrate chip active. Render phase divider `── Demonstrate ──` and Example 1 as active block.

**Block content:**
- Container: `.block-example`
- Label: "Example 1", "Example 2", "Example 3"
- Body: worked example, may be multi-step
- Optional "What I did:" footer in lighter weight

**Button row varies by example number:**

| After example | Buttons |
|---|---|
| 1 | `[View next example]` |
| 2 | `[I understand, no more examples needed]` `[I don't understand, give me another example]` |
| 3 | `[I understand, ready to practice]` `[Still don't understand]` |

**On "Still don't understand" after Example 3:** append a `.block-note` with suggested video search terms (e.g. `Try searching YouTube for "dividing fractions visual"`), then auto-advance to Practice after a short delay (1.5s) or on user dismissal.

**On any "I understand" variant:** advance to Practice.

### 4.7 Practice phase

**On phase entry:** progress 50%, Demonstrate chip → done-chip, Practice chip active. Render phase divider and Problem 1 as active block.

**Block content (`.block-practice`):**
- Label: "Problem 1", "Problem 2", etc.
- Question text
- Free-text input (`.practice-input`) + submit button

**Submit flow:**

1. Learner's answer is echoed inline within the practice block (slight indent, muted background).
2. The submit button is replaced with a `.block-feedback` appended directly under the problem block. Feedback content: correct/incorrect verdict + targeted feedback (where it went wrong, corrected reasoning).
3. Button row appears under the feedback: `[Yes, next problem]` `[No, I'm done]`

| Press | What happens |
|---|---|
| Yes, next problem | Lock current problem+feedback. Append Problem N+1 as active. |
| No, I'm done | Lock current. Advance to Meaning. |

No minimum or maximum problem count.

**Demo behavior:** hardcode 3 problems and 3 feedback responses (correct/incorrect mixed). The submitted answer doesn't need to be parsed — show the prepared feedback regardless of what was typed. For the very-first problem, optionally check for the expected answer string and show "correct" or "incorrect" feedback accordingly, just to make the demo feel responsive.

### 4.8 Meaning phase

**On phase entry:** progress 75%, Practice chip → done-chip, Meaning chip active. Render phase divider `── Meaning ──` and the meaning block as active.

**Block content (`.block-meaning`):**
- Visually distinct from byte blocks — slightly larger, accent-color left border
- Header: "Why this matters"
- Body: a few sentences on real-world relevance (concrete examples, professions, products, decisions)

**Button row (same as Explain — four options):**

```
[I understand]  [I don't understand]  [Too simplistic]  [Too complex]
```

Behavior identical to Explain — rephrase/simplify/complexify as needed.

**On final "I understand":**
- Progress 100%
- Mark current knobit done (status tag, will reflect in Learning Path view if user returns)
- If more knobits exist: clear the stream, increment `CURRENT_KNOBIT_IDX`, update nav label, reset progress to 0%, reset all chips, render the first byte of the next knobit.
- If no more knobits: show View 3 — Unit Complete.

---

## 5. Reusable components

### 5.1 `.four-option-row`

The four-option button group, used in Explain (every byte) and Meaning. Fixed order:

```html
<div class="four-option-row">
  <button data-opt="ok">I understand</button>
  <button data-opt="no">I don't understand</button>
  <button data-opt="simple">Too simplistic</button>
  <button data-opt="complex">Too complex</button>
</div>
```

Each button fires a single handler with `data-opt` as the argument. The parent decides what content to render next.

### 5.2 `.example-row-N`

Three variants — `.example-row-1`, `.example-row-2`, `.example-row-3` — with the buttons described in 4.6. Same handler signature.

### 5.3 `.practice-controls`

Renders the `[Yes, next problem] [No, I'm done]` pair, attached to a feedback block.

### 5.4 `.ask-bar`

The "Ask anything…" input + send button. Always rendered in the action area. Submission triggers the user-message → response flow described in 4.4.

### 5.5 `.choice-locked` modifier

Applied to button rows once a choice is made. The chosen button's label is prefixed with `✓` (or `→`) and the whole row drops to 50% opacity, pointer-events: none.

### 5.6 Phase dividers

`.phase-divider` — a thin horizontal rule with the phase name in muted text, centered. Rendered at the top of each phase's contribution to the stream.

---

## 6. State

Replace the existing module-level state with:

```js
{
  _node,                    // unchanged
  _crumb,                   // unchanged
  KNOBITS,                  // array; hardcoded for now
  CURRENT_KNOBIT_IDX,       // 0-based
  CURRENT_PHASE,            // 'explain' | 'demonstrate' | 'practice' | 'meaning'
  STREAM_BLOCKS,            // array of block objects in this knobit's stream
  KNOBIT_DONE_COUNT,
  KNOBIT_TOTAL,
}
```

Each block:

```js
{
  id: string,
  type: 'byte' | 'example' | 'practice' | 'feedback' | 'meaning' | 'user' | 'note',
  content: string | object,   // shape depends on type
  status: 'active' | 'locked',
  chosenOption?: string,      // e.g. 'I understand' (for the locked label)
  meta?: object,              // e.g. byte number, example number
}
```

Pressing a button mutates the active block to `locked` (with `chosenOption`) and appends one or more new blocks.

Phase transitions update `CURRENT_PHASE` and append a phase divider to `STREAM_BLOCKS`. They do **not** clear the stream within a knobit.

Knobit transitions (after Meaning is accepted) clear `STREAM_BLOCKS` and increment `CURRENT_KNOBIT_IDX`.

---

## 7. Demo content (hardcode)

To exercise the flow visually without a backend, hardcode one populated topic.

**Topic:** Division
**Breadcrumb:** Mathematics › Pure Mathematics › Arithmetic › Basic Operations
**Node accent color:** use whatever the Mathematics domain color is in the map.

**Knobit list (11 items, populate View 1):**

1. Division as equal sharing
2. Division as repeated subtraction
3. Division as the inverse of multiplication
4. Dividend, divisor, quotient, remainder
5. Division by 1 and by itself
6. Why division by zero is undefined
7. Exact division vs division with remainder
8. Short division (single-digit divisor)
9. Long division (multi-digit divisor)
10. Checking division using multiplication
11. Division extended to fractions and decimals

For the demo, **only knobit 11 is fully populated**. Clicking any other knobit from the Learning Path shows a placeholder: `Demo: only knobit 11 has content in this build.`

### 7.1 Populated knobit content — "Division extended to fractions and decimals"

**Explain phase — 6 bytes:**

> **Byte 1:** You know how to split 6 apples between 2 friends. You can also split half an apple. Or split 1.5 apples. The idea is the same. Just smaller pieces.

> **Byte 2:** Think of division as asking: "how many fit?" 6 ÷ 2 asks: how many 2s fit in 6? Answer: three. 6 ÷ ½ asks: how many halves fit in 6? Each apple has 2 halves. So 6 apples have 12 halves. Answer: twelve.

> **Byte 3:** This gives us a shortcut. Dividing by a fraction is the same as multiplying by its flip. Flip ½ and you get 2. So 6 ÷ ½ becomes 6 × 2 = 12. Same answer as before. The flip has a name: the reciprocal.

> **Byte 4:** The flip rule works for any fraction divided by any fraction. ½ ÷ ¼ → flip the second one (¼ becomes 4) → ½ × 4 = 2. So a half contains two quarters. Check: cut a pizza in half, then cut one half into quarters — you get two quarter-slices. ✓

> **Byte 5:** Decimals are just fractions in disguise. 0.5 = ½. 0.25 = ¼. 0.1 = 1/10. So 6 ÷ 0.5 is the same problem as 6 ÷ ½ = 12. Nothing new — just a different costume.

> **Byte 6:** There's a faster trick for decimals. Shift the decimal point in both numbers by the same amount, until the divisor is whole. 1.2 ÷ 0.4 → shift both one place → 12 ÷ 4 = **3**. Why is this allowed? You multiplied both numbers by 10. The ratio between them stays the same. So the answer doesn't change.

**Demonstrate phase — 2 examples:**

> **Example 1: fraction ÷ fraction.** Problem: ¾ ÷ ⅔. Step 1 — flip the divisor: ⅔ becomes 3/2. Step 2 — multiply: ¾ × 3/2 = (3 × 3) / (4 × 2) = 9/8. Step 3 — read it: 9/8 = 1⅛.
> *What I did:* I used the flip rule. Sanity check by intuition — "how many two-thirds fit in three-quarters?" ⅔ is about 0.67 and ¾ is 0.75, so the answer should be a little more than 1. We got 1⅛. ✓

> **Example 2: decimal ÷ decimal.** Problem: 4.5 ÷ 0.15. Step 1 — shift the decimal so the divisor becomes whole. 0.15 needs to shift two places to become 15. So shift the dividend two places too: 4.5 → 450. Step 2 — now it's a plain division: 450 ÷ 15 = 30.
> *What I did:* I multiplied both numbers by 100. The ratio between them didn't change, so the answer is the same as the original problem. Sanity check: 0.15 × 30 should give 4.5. It does. ✓

> **Example 3** (only if the learner asks for one): hardcode a third example such as ⅗ ÷ ¼ → ⅗ × 4 = 12/5 = 2⅖, with the same structure.

**Practice phase — 3 problems and corresponding feedback:**

> **Problem 1:** ⅖ ÷ ¾ = ?
> *Expected answer:* 8/15
> *Correct feedback:* "Correct! ✓ Flip ¾ to get 4/3, then ⅖ × 4/3 = 8/15."
> *Incorrect feedback:* "Close, but not quite. ⅖ ÷ ¾ → flip ¾ to get 4/3 → ⅖ × 4/3 → numerator 2 × 4 = 8 → denominator 5 × 3 = 15. So the answer is **8/15**. The rule for multiplying fractions: tops × tops, bottoms × bottoms."

> **Problem 2:** 5/6 ÷ 2/3 = ?
> *Expected answer:* 1¼ (or 15/12, or 5/4)
> *Correct feedback:* "Correct! 5/6 × 3/2 = 15/12 = 1¼. (3/12 simplifies to ¼.)"
> *Incorrect feedback:* "Not quite. Flip 2/3 → 3/2. Then 5/6 × 3/2 = 15/12 = 1¼."

> **Problem 3:** 7.2 ÷ 0.08 = ?
> *Expected answer:* 90
> *Correct feedback:* "Correct! ✓ Shift both two places: 7.2 → 720, 0.08 → 8. Then 720 ÷ 8 = 90."
> *Incorrect feedback:* "Not quite. Shift both numbers two decimal places (so the divisor becomes whole): 7.2 → 720, 0.08 → 8. Then 720 ÷ 8 = **90**."

**Meaning phase:**

> **Why this matters:** Dividing by fractions and decimals is the foundation of every real-world calculation involving rates, ratios, and scaling. Halving a recipe? You're dividing by a fraction. Converting currencies, computing unit prices ($/oz), figuring out fuel economy (miles per gallon), pacing a run (minutes per kilometer) — all division with non-whole numbers. Engineers, cooks, scientists, finance professionals, and anyone reading a nutrition label uses this daily. The flip-and-multiply rule is one of the highest-leverage shortcuts in everyday math: once you have it, you stop being afraid of fractions.

### 7.2 Hardcoded off-script Q&A (for the "Ask anything…" demo)

Recognize these inputs (case-insensitive substring match is fine) and have prepared responses:

- "drawing" / "diagram" / "picture" → respond with a brief explanatory block; for the demo a stylized SVG or a simple ASCII diagram embedded in the block is enough.
- "video" → respond with a `.block-note` suggesting YouTube search terms.
- "2/4" → respond with the same-rule-applies explanation we developed: flip 2/4 → 4/2, multiply, simplify. Reinforce that the rule never changes regardless of which fraction.

For any other input: append a generic `.block-note`: `In the live version, the tutor would answer this question. (Demo mode.)`

---

## 8. Visual / UX notes

- Active block at bottom is the focus. Locked blocks above are full-color but slightly muted (subtle background tint, ~85% text opacity).
- Button rows are the loudest element on screen when active — clear hit targets (min 44px height on mobile), accent color on hover.
- "Ask anything…" input: same height as the chip strip; muted placeholder; submits on Enter or send button click.
- Don't auto-scroll on every append unless the user is near the bottom (within ~120px). Otherwise they're reading something earlier — don't yank them.
- Append animation: 150ms fade-in + 8px slide-up. Choice-lock animation: 100ms fade on the buttons only (content stays put).
- Phase dividers are muted (small caps, ~13px, accent-color text, thin horizontal rule on either side).
- Mobile: the action area (buttons + ask bar) sticks to the bottom of the viewport above any iOS safe area. Stream scrolls behind it.

---

## 9. What's built vs. not built

| Item | Status |
|---|---|
| Overlay structure, view switching, accent color | Keep existing |
| View 1 Learning Path (with new dynamic knobit list source) | Adapt existing — render from `KNOBITS` array |
| View 2 full rewrite per this spec | **Build** |
| View 3 Unit Complete | Keep existing |
| Four-option button row component (`.four-option-row`) | **Build** |
| Example-row buttons (three states) | **Build** |
| Practice controls (`.practice-controls`) | **Build** |
| Block stream rendering, append, lock, fade | **Build** |
| Phase dividers, chip state updates, progress bar 0/25/50/75/100 | **Build** |
| Chip labels: Explain / Demonstrate / Practice / Meaning | **Build** |
| "Ask anything…" input + demo Q&A handling | **Build** |
| Hardcoded demo content (Division knobit 11) | **Build** |
| LLM-driven byte/example/problem generation | Out of scope — placeholder for now |
| Persistence (localStorage / learner passport) | Out of scope — separate task |
| Marking node done on the map after unit complete | Not built — carry forward as known gap |
| Real adaptivity from button presses (different content per choice) | UX shell only — for the demo, every "I don't understand" / "Too complex" / etc. can return a single hardcoded rephrasing per byte. Real branching content arrives with the LLM. |

---

## 10. Suggested file changes

- `index.html` — replace the inner DOM of `#lm-knobit`. Remove the four old panels and CTA bars. Add: `.kn-stream`, `.kn-action-area` (containing `.kn-button-row` + `.ask-bar`).
- `js/learning.js` — replace the phase-panel toggle logic with a block-stream renderer and a phase-state machine. Keep `openLearningMode` / `closeLearningMode` signatures. Replace `_setPhase` and the `goPhase`-style transitions with `_appendBlock(block)`, `_lockActiveBlock(chosenOption)`, `_advancePhase(nextPhase)`.
- `css/learning.css` — add styles for `.block-byte`, `.block-example`, `.block-practice`, `.block-feedback`, `.block-meaning`, `.block-user`, `.block-note`, `.four-option-row`, `.example-row-N`, `.practice-controls`, `.ask-bar`, `.phase-divider`, `.choice-locked`. Remove the four old panel-specific styles.
- `js/app.js` — no changes needed beyond what already exists.

---

## 11. Acceptance criteria for the demo

A reviewer should be able to:

1. Click any L5 node → click "Learn this" → land on View 1 with the Division knobit list and progress bar.
2. Click knobit 11 → land in Explain phase with Byte 1 active and the four-option row visible.
3. Press "I understand" → Byte 1 locks (✓ I understand shown), Byte 2 appears active.
4. Press "Too complex" on any byte → see a simpler rephrasing appear below.
5. Type "show me a drawing" into the ask bar → see a user message, a drawing-style response, and the four-option row reappear.
6. After 6 bytes → cross the phase divider into Demonstrate with Example 1.
7. View Example 1 → "View next example" → Example 2 with the new button row.
8. Press "I understand, no more examples needed" → cross into Practice with Problem 1.
9. Type an answer → submit → see feedback with Yes/No buttons.
10. After at least one problem → press "No, I'm done" → cross into Meaning.
11. Read the meaning block → press "I understand" → since knobit 11 is the last, View 3 — Unit Complete shows.
12. From View 3 → "Review this unit" or "Back to the map" exits as expected.

If all twelve steps work end-to-end with the hardcoded content, the visual demo is complete.
