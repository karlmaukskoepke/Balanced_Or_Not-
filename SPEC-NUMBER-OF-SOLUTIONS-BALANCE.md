# SPEC (v2.1): "What Makes It Balance?" — Number-of-Solutions Balance Activity

Standalone student web page for a Math 8 / Algebra 1 lesson on equations with one, no, or infinitely many solutions. It follows lessons on solving equations with variables on both sides. It replaces the Desmos activity and runs alongside two paper sheets (a solving sheet and a reflection page). Destination: its own page in a GitHub repo, deployed via GitHub Pages. No backend, no accounts, no data collection.

Audience: middle schoolers. The teacher walks the whole class through the first problems on a projector. Students then run it self-paced on Chromebooks (trackpad, keyboard). Text must be large and readable from the back of a classroom.

**Design for a 1366×650 viewport (a Chromebook browser window). Nothing a student needs may require vertical scrolling. Also test 1366×768.**

## 0. What changed since v1 (for the existing build)

- **Renamed** to "What Makes It Balance?" (page title, headers, paper sheets).
- **Equation #3 is flipped** to `x + 5 = 4x + 1` (see section 2).
- **Per-guess questions are removed** (no "which side is heavier?" prompt, no typed difference, no Difference column). The page shows the result instead: markers on the number line and a guess table (see v2.1).
- **The beam moves live** as the slider travels to a guessed value (no more "level until answered").
- **New screen layout** (section 5; superseded by the v2.1 three-column layout).
- **Number-line slider** with ticks, separate typed-guess box, and a live x-box beside it.
- **New step flow** (section 6): Guess → Predict → Slide → Solve (stop screen) → Answer. The old sort step and the old `a = b` entry are replaced by the final two-part question.
- **Active-step highlighting** and a one-time coach-mark walkthrough on equation 1.
- **Two-stage reveal** with worked solution steps and a wait timer after a second wrong answer.

### v2.1 changes (after the Stage A playtest)
- **New three-column layout** (section 5): x input and a growing x-box on the left, the equation centered above the balance in the middle, a prompt panel and a stacked guess **table** on the right, the number line and slider along the bottom.
- **The guess cards and mini beams are replaced by a table** (x, left value, right value, "heavier by"). The page computes and shows the difference; the student never types one.
- **The heavier-side label under the equation is removed.** The result lives in the table and in the number-line markers.
- **The substitution lines are removed** (`3(5) + 2 = 17`). Each pan shows only its expression and total.
- **The number line labels every integer** when there is room.
- **Prompts move out of the bottom banner** into a prompt panel, plus small anchored callouts for step cues.

## 1. Teaching goal

Students use "does a value make it balance?" to discover that an equation can be balanced for exactly one value of x, for every value, or for no value. The takeaway has to come from the experience of solving an equation and hitting a strange result (5 = 5, or 3 = 8), with the balance as the metaphor that explains it.

The tool must NOT state the rule ("same x-terms, different constants means never"). Students build the theory themselves from their sorted equations, the number-line markers, and the highlighted terms. The page only checks their answers and scaffolds mistakes.

Guessing must be **quick and fun**. Students should be able to use each result to adjust their next guess. The slider comes before solving on purpose: its imperfection (for example x = 4/3 never lands exactly) is what makes algebra necessary.

## 2. Equation form and data model

All equations have the form Ax + B = Cx + D, with these constraints:
- Coefficients of x are non-negative, so x-terms are always weight, never balloons.
- x itself may be negative or fractional.
- Some equations display unsimplified (split terms, reordered terms, combine-like-terms disguises).

Store each side as an ordered list of terms so split terms render faithfully:

```js
// term: { kind: "x", coef: 2 } or { kind: "const", value: 3 }
{
  id: 7, part: 1,
  left:  [ {kind:"const", value:5}, {kind:"x", coef:1}, {kind:"x", coef:1} ],
  right: [ {kind:"x", coef:2}, {kind:"const", value:5} ],
  category: "always",        // "one" | "never" | "always"
  solution: null,            // rational for "one" (e.g. {n:4, d:3})
  sliderRange: [-10, 10],    // integers; the solution must fall strictly inside
  seeds: null,               // or [x1, x2] for given guesses
  steps: [ /* worked solution steps, section 16 */ ]
}
```

### The 12 equations

Display strings keep the author's order. Do not recompute categories from the display strings; use the table.

| # | Part | Equation | Category | Solution / note |
|---|------|----------|----------|-----------------|
| 1 | 1 | 2x + 3 = x + 7 | one | x = 4 (more x's on the left) |
| 2 | 1 | 3x + 2 = x − 4 | one | x = −3 (right side holds a balloon at the solution) |
| 3 | 1 | x + 5 = 4x + 1 | one | x = 4/3 (slider never lands exactly). **More x's on the RIGHT**, so the arrow means the opposite of #1 and #2. |
| 4 | 1 | 2x + 3 = 2x + 8 | never | right always heavier by 5 |
| 5 | 1 | 4x + 2 = 4x − 6 | never | left always heavier by 8 |
| 6 | 1 | 3x − 5 = 3x − 5 | always | identical sides |
| 7 | 1 | 5 + x + x = 2x + 5 | always | split x's, swapped order |
| 8 | 2 | 5x + 2 = 5x + 3 | never | right always heavier by 1 |
| 9 | 2 | 3x + 4 = 4 | one | x = 0; the right pan has only a constant |
| 10 | 2 | 2x + 3 + x = 3x + 3 | always | only after combining |
| 11 | 3 | 3x − 6 + x = 4x + 1 | never | right always heavier by 7 |
| 12 | 3 | 5x − 2 = 2x + 10 | one | x = 4 |

**Why #3 is flipped:** in every other one-solution equation the larger x-coefficient is on the left. Without a flip, students could learn "left heavier means guess lower" and fail when it reverses. Do not hint at this on screen.

Given (seed) guesses: #1 → 1 and 7. #2 → −5 and 1. #3 → 0 and 3 (left heavier at 0, right heavier at 3). Each pair brackets the solution. Other equations have no seeds.

Free-play mode (section 12) may use any A, B, C, D within small bounds.

## 3. Arithmetic (do not use floats)

Floating-point errors will make 0.1 + 0.2 miss 0.3 and break "balanced." Compute all values as exact rationals (or integers in hundredths). The slider and typed values are quantized to 0.01; typed fractions like −1/2 are exact. "Balanced" means left − right is exactly 0. Solutions like 4/3 are stored as rationals and compared exactly in the final question.

Typed guesses must fall within the equation's `sliderRange`. Outside it, show: "Try a value between −10 and 10."

## 4. The balance visual

A classic pan balance: a central post, a beam that tilts, and a pan hanging from each end. Make the balance smaller than in v1 so it shares the center column with the equation.

**Weights (positive terms):**
- Each x-term of coefficient k renders as k separate boxes, each showing the substituted value of x. The pan shows the structure of the equation as written (split terms render as separate groups). Do not simplify for the student.
- Box size scales with the value of x, by area, not side length. Use a minimum floor size so a box never vanishes.
- At x = 0: boxes use the floor size with a dashed outline, a light shaded fill, and a "0" label, to show they exist but weigh nothing.
- Positive constants render as green circles labeled with a sign ("+3"). Circle area scales with the value.
- If many boxes overflow a pan, scale them down uniformly or tile them in a grid. Never overlap the beam.

**Negative terms (lift):**
- Negative constants render as red balloons tethered to the pan end, floating up, with a visible string. Balloon area scales with |value|. Label with a sign ("−6").
- When x is negative, each x-box becomes a floating box with the negative number inside, tethered the same way. It still counts as one box.
- Do not rely on color alone: every weight and balloon shows its sign in text.

**Colors:** x-terms and x-boxes are blue (box outline blue). Positive constants green, negative red, **only where they label a pan object**. In the big equation at the top, constants stay **black** (matching the paper); x-terms are blue.

**Expression and total under each pan:** beneath each pan, show that side's algebraic expression in the matching colors, for example `2x + 5` with `2x` in blue and `+ 5` in green, or `3x − 2` with `3x` in blue and `− 2` in red. Below the expression, show that side's single total value in a clear box. Do **not** show the substitution line (`3(5) + 2 = 17`); the total alone is enough. The expression and total slide up and down with their pan but stay horizontal (translate only, no rotation).

**x-box and pan boxes share a scale:** the x-box in the left column and the boxes on the pans use the same size scale and the same blue outline, so students see that the pan boxes are the x value. When the value changes, the pan boxes may pulse briefly. If a crowded pan has to shrink its boxes, that is allowed, but the left x-box keeps the true scale.

**Tilt:**
- The side with the greater value (more positive) is "heavier" and goes down.
- Tilt is capped (about 18°) with a floor of about 3–4° for any nonzero difference. Exactly 0 is level.
- **Scale per equation** so the largest difference across the slider range reaches the cap. Then a flatter beam reliably means a closer guess. For never-balanced equations, hold a constant, clearly visible tilt (about 60% of the cap) across the whole range.
- Short easing (about 0.07 s while dragging; slightly longer for travel animation).

**Heavier-side result:** do not put a label or arrow under or beside the equation. The heavier side is shown by the beam tilt, by the number-line marker (◀ / ▶ / ✓), and by the "Heavier" column of the guess table. Each carries text, not color alone.

## 5. Screen layout

```
 What Makes It Balance?   [Guess ▸ Predict ▸ Slide ▸ Solve ▸ Answer]    Sorted: 1 · 0 · 0
 ┌──────────────┬──────────────────────────────┬──────────────────────────┐
 │ x = [ 5 ] Go │      2x + 3  =  x + 7        │ PROMPT PANEL             │
 │              │   (centered above balance)   │ (current question,       │
 │   ┌────┐     │                              │  buttons, worked steps)  │
 │   │ 5  │     │        the balance           ├──────────────────────────┤
 │   └────┘     │   2x + 3 [13]  x + 7 [12]    │ GUESS TABLE (stacked)    │
 │  (x box,     │                              │ # │ x │ L │ R │ heavier  │
 │   grows)     │                              │ 1 │ 1 │ 5 │ 8 │ R by 3   │
 ├──────────────┴──────────────────────────────┴──────────────────────────┤
 │ number line: −10 −9 … −1 0 1 … 9 10, slider thumb, ◀ ▶ ✓ guess markers │
 └─────────────────────────────────────────────────────────────────────────┘
```

- **Left column:** the "x =" typed-guess box (with a Go/Enter button) and, directly beneath it, the x-box. The x-box shows the current value (labeled "x"), grows and shrinks as the value changes, and follows the slider live. It sits left of the balance so students connect it to the boxes on the pans.
- **Center:** the equation, large and centered above the balance. Then the balance, with the expression and total under each pan (section 4). No heavier-side label under the equation.
- **Right column, top: prompt panel.** All questions, buttons, notes, and worked steps appear here (Predict, the Solve stop screen, the Answer question, hints, the second-value note, the reveal and countdown). It grows when it needs to (for example when showing worked steps) and the table shrinks to fit; the table never scrolls (it holds at most 5 rows in Parts 1–2).
- **Right column, below: guess table.** Stacked vertically, one row per guess, chronological, numbered. Columns: **#**, **x**, **Left**, **Right**, **Heavier**. The page computes the last column; the student never enters it. Examples: `◀ Left heavier by 3`, `Right heavier by 2 ▶`, `✓ Balanced`. Values show exactly as typed (fractions stay fractions). Given guesses are marked "given." The slider never adds rows.
- **Bottom: number line.** −10 to 10, zero in the center, tick marks at every integer, **a label at every integer** when the line is wide enough to show them without crowding (if not, label every 2). Slider thumb on the line. Drag is continuous (0.01); ticks are visual only. Arrow-key nudging stays. Under `prefers-reduced-motion` the thumb jumps.
- **Guess markers on the number line:** each past guess leaves a marker at its x: ◀ left heavier, ▶ right heavier, ✓ balanced (shape and text, not color alone). For a one-solution equation the solution sits in the gap between the nearest opposite markers. For never equations all markers point the same way. For always equations all are ✓. Do not shade or label the gap.
- **Guess box vs current x:** the typed-guess input is separate from the slider's current value. When a student enters a guess, the slider thumb **animates** from its current position to that value (balance, boxes, totals, and the left x-box update along the way; cap the travel at about 1 s), then turns green on arrival.
- **Anchored callouts:** short step cues ("Type a value for x") appear as small, non-blocking callouts with a pointer to the control that is lit. They disappear when the student acts and never cover the balance. Questions and anything that needs a decision live in the prompt panel, not in popups.
- **Step strip** at the top and a compact **sort count bar** at top right (expands to show sorted equations).
- No ± button. x entry is a plain text input (not type=number); students type a leading "-" themselves. Accept integers, decimals, and fractions. Typing just "-" shows "Keep typing: that isn't a number yet."

## 6. Per-equation flow (Parts 1 and 2: #1–10)

Step strip at the top shows: **Guess ▸ Predict ▸ Slide ▸ Solve ▸ Answer**, with the current step highlighted.

### Step 1 — Guess (5 guesses)
- On #1–3, the first two guesses are given: the slider travels to each, the beam moves, the number-line marker appears, and a row is added to the guess table. A button advances from the first given guess to the second. Then the student makes guesses 3–5 by typing.
- On #4 and up, all five guesses are the student's own.
- **No per-guess questions.** The student types an x, the slider travels, the marker and table row appear, and they pick the next x.
- A repeated x is refused ("You already tried that one").
- **Second-value note:** the first time a guess balances on an equation, show "That balances. Can you find a different value that also balances?" Show it once and keep it visible for that equation's remaining guesses. Do not reveal whether another value exists.

### Step 2 — Predict
- After 5 guesses, the student picks a prediction: **One solution / Infinite solutions / No solutions.** The page does not say whether it's right. It records it.

### Step 3 — Slide
- The slider unlocks (it is **locked until 5 guesses and a prediction**). Live update on the `input` event; the beam, boxes, totals, arrow, and x-box all follow in real time. Typed entry and arrow keys stay available.
- The slider's imperfection is intentional. Do not add snapping or a "close enough" band.

### Step 4 — Solve (stop screen)
- A clear stop panel: "On your sheet: (1) circle what the slider showed and write x is about ___. (2) Solve it. Press 'I solved it' when you have an answer."
- Everything else dims. The button enables immediately.

### Step 5 — Answer: "What makes it balance?"
**Part 1:** three ways to answer:
- a text box, `x = [   ]`, for a value;
- a button: **No value of x makes it balance**;
- a button: **Any value of x makes it balance**.

Accept `x = 4` or `4 = x` forms, integers and exact fractions (any equivalent fraction, for example 8/6 for 4/3), and exact decimals (0.5, 2.25). **Rounded or repeating decimals (for example 1.33) are not accepted**; show "That's a rounded value. Write the exact answer as an improper fraction, like 5/4 or 6/5." Use an example that is not the actual answer (not 4/3). This hint does not count as an attempt.

**Part 2** (after a correct Part 1): "Which one is it?" **Exactly one solution / Infinitely many solutions / No solution.** This is the sort: it adds the equation to the count bar. Wrong picks give feedback tied to the Part 1 answer ("You said any value of x balances it. Which of these means that?"). Retry freely.

Then show: "Write this equation in the matching column on your reflection page."

**Wrong Part 1 answers (two-stage reveal):**
1. First wrong answer: "That doesn't match. Check your solving and the slider." The student retries (no penalty; this covers typos). Do not reveal the answer.
2. Second wrong answer: show the **worked solution steps** (section 16) on screen with "Compare with your work. Copy the correct steps onto your sheet." The Next button shows a countdown ("Next in 20s") and is disabled until it finishes. The wait is one adjustable constant, default **20 seconds** (range 15–20 as taught). If Next is clicked early, show an inline message: "Find the error in your solving and correct your paper first."
3. After the reveal, the student still completes Part 2 so the equation is sorted. Record the mismatch.

**Correct Part 1 on the first or second try:** show the worked steps as "Compare with your work" with Next available immediately. No wait.

### Spotlight rule (applies to every step)
Whatever the student is working on is lit; everything else dims (reduced opacity, still visible, not hidden). The balance stays lit whenever x is involved. Guess: x input, x-box, balance, equation, number line, guess table. Predict: the prompt panel (prediction buttons), the guess table, and the number-line markers. Slide: number line and slider, balance, x-box. Solve: prompt panel only. Answer: prompt panel plus the equation. The step strip always shows the current step, so dimming is never the only cue.

### Coach marks (equation 1 only, replayable with a "?" button)
A short sequence of callouts, each spotlighting one element: the equation, the x box ("this box is x"), the pans, a green circle ("a +3 ball"), the number line and slider, and the guess table. Keep each to one sentence.

## 7. Highlighting of x-terms and constants

- From equation 1, x-terms in the displayed equation are blue and constants black. Every x-term is blue, including split terms.
- The x-boxes on the balance have a matching blue outline.
- In Part 2, add extra emphasis (a light blue tint behind each x-term) so the x-coefficients and constants pop while students look for a pattern.
- Do not label anything "A" or "C" for students.

## 8. Part 3 — "the slider broke" (#11–12)

- No guesses and no slider. Show the number line and slider flickering and disabled (sparks are optional second-pass polish). The "test a value" box is disabled.
- The student picks a category and a reason from choices. Reason choices appear only here (they would give away the answer earlier):
  - "The number of x's matches on both sides and the plain numbers match."
  - "The number of x's matches on both sides but the plain numbers are different."
  - "The number of x's is different on the two sides."
  (Final wording to be refined.)
- **Wrong reasoning:** do not just say "try again." Show a counterexample from an equation they already sorted (for example, if they pick "plain numbers match so always," show #9 in its column). Do not state the rule.
- #11 requires totaling the x's first (3x + x = 4x), so the pan shows the structure and lets them count boxes.
- Then the Solve stop screen and the same Step 5 flow (Part 1, Part 2, two-stage reveal).

## 9. Paper companion sheets

- **Solving sheet (2 pages, 12 problems):** each has a "Slider:" circle line (Left heavier / Right heavier / Balanced), "x is about ___ (or: none / all x)", open solving space, and "Result: ___ = ___". #11–12 use "My prediction: Never / One value / Always" and "because ___". Titled "What Makes It Balance?" Problem 3 is `x + 5 = 4x + 1`.
- **Reflection page:** one box split into three columns, headed **One solution / Infinite solutions / No solutions**, with gray subtext (Balanced for exactly one value / Always balanced / Never balanced). Students write the actual equations in each column. Prompts 1, 2, 3, then 4a (only one solution), 4b (infinite solutions), 4c (no solutions), each asking how to tell just by looking.

Equation numbers and display strings must match the paper exactly.

## 10. Navigation and state

- Self-paced. A Back button revisits earlier equations without losing the guess table, prediction, or sort.
- Teacher walkthrough: works on a projector. Keyboard shortcuts for next/back; large type.
- State persists in `localStorage` (guesses, predictions, sorts, answers, attempts) so a refresh doesn't lose progress, with a "Start over" button. Wrap all reads and writes in try/catch.

## 11. Completion screen (version 1: on the student's own screen only)

At the end, show a summary: for each of the 12 equations, the student's prediction and whether it matched, the final category, their Part 1 answer, how many tries, and whether the steps were revealed after a mismatch. The student shows it to the teacher or takes a screenshot. Nothing is sent anywhere. A later version could add a "Copy my results" button.

## 12. Free play with A, B, C, D (after #12)

Controls for Ax + B = Cx + D. Keep values small: A, C in 0–9, B, D in −9 to 9.
- Same balance, number line, typed guesses, arrow, markers, and cards.
- Compute category from the numbers (A ≠ C → one; A = C and B = D → always; A = C and B ≠ D → never).
- Include both A > C and C > A cases among suggested starting equations.
- Slider range: integer endpoints containing the solution (ceil/floor ± a margin); −10..10 for never/always.
- Do not state the A/C rule anywhere.

## 13. Accessibility and design

- Never convey meaning by color alone (signs shown as text; arrows and markers carry shapes and text).
- Large, bold type; strong contrast; trackpad-friendly targets.
- Respect `prefers-reduced-motion` (no travel animation, no flicker).
- Keyboard operable throughout (slider arrow keys, tab order through the controls of the active step).
- Visual style: clean, uncluttered, consistent with the paper sheets (blue accents, light outlines).

## 14. Tech

- Static site: plain HTML/CSS/JS with SVG for the balance. Deployable on GitHub Pages. No build step unless the repo already has one.
- Own page in its own repo. Stands alone from The Mat and other practice sites.
- Equation data (including solution steps) in one data file, separate from rendering code.

## 15. Test cases to verify

- #3 (flipped): left heavier at x = 0, right heavier at x = 3; the arrow points opposite to #1 for a low guess; slider near 1.33/1.34 never shows "Balanced" but still tips visibly.
- #9 at x = 0: boxes dashed with "0", pans balanced at 4 and 4.
- #2 at x = −3: both sides equal −7; the left shows floating boxes, the right a balloon (−4) and a floating box.
- #4, #5, #8: the beam never goes level at any slider position; markers all point the same way.
- #6, #7, #10: level at every position, including 0 and negatives; markers all ✓.
- Typing a guess moves the slider thumb to it, turns it green on arrival, and updates the beam and the left x-box along the way.
- The left x-box and the pan boxes show the same value at the same scale; the table "Heavier" column is page-computed and correct for negative and fractional x.
- No substitution line anywhere; each pan shows only its expression and total.
- Typed x outside the range is refused with a gentle message.
- The pan expressions and totals slide with the pans and stay horizontal.
- The number line labels every integer at 1366 wide without overlap.
- Final question: `x = 4`, `4 = x`, `4/3`, `8/6`, `0.5`, "No value", "Any value" behave as specified; `1.33` triggers the improper-fraction hint without using an attempt.
- Two-stage reveal: first wrong → retry; second wrong → steps and countdown; early Next → inline message; correct → steps with no wait.
- Nothing scrolls at 1366×650 in the busiest moments (second-value note showing, steps showing with countdown, five table rows, completion screen). The prompt panel and table share the right column without overlap.
- No float artifacts in any readout.

## 16. Worked solution steps (wording pending teacher review)

Notation follows the teacher's "Variables on Both Sides" sheet: "Add the same to both sides" with the added term under each side, collecting boxes on the side with more x's so they stay positive. Never and always equations end on a balance-language statement, and their Check line uses a test value.

1. `2x + 3 = x + 7`: + (−x) → `x + 3 = 7`; + (−3) → `x = 4`. Check: 2(4)+3 = 11 and 4+7 = 11 ✓.
2. `3x + 2 = x − 4`: + (−x) → `2x + 2 = −4`; + (−2) → `2x = −6`; ÷ 2 → `x = −3`. Check: 3(−3)+2 = −7 and −3−4 = −7 ✓.
3. `x + 5 = 4x + 1`: + (−x) → `5 = 3x + 1`; + (−1) → `4 = 3x`; ÷ 3 → `4/3 = x`. Check: 4/3+5 = 19/3 and 4(4/3)+1 = 19/3 ✓.
4. `2x + 3 = 2x + 8`: + (−2x) → `3 = 8`. "All the boxes cancel and 3 = 8 is left. That is never true, so no value of x can balance this." Check: x = 1 gives 5 and 10; the right side is 5 heavier for any x.
5. `4x + 2 = 4x − 6`: + (−4x) → `2 = −6`. Same statement (never true). Check: x = 1 gives 6 and −2; the left is 8 heavier for any x.
6. `3x − 5 = 3x − 5`: + (−3x) → `−5 = −5`. "All the boxes cancel and −5 = −5 is left. That is always true, so every value of x balances this." Check: x = 2 gives 1 and 1 ✓.
7. `5 + x + x = 2x + 5`: combine like terms → `5 + 2x = 2x + 5`; + (−2x) → `5 = 5`. Always statement. Check: x = 3 gives 11 and 11 ✓.
8. `5x + 2 = 5x + 3`: + (−5x) → `2 = 3`. Never statement. Check: x = 1 gives 7 and 8; the right is 1 heavier for any x.
9. `3x + 4 = 4`: + (−4) → `3x = 0`; ÷ 3 → `x = 0`. Check: 3(0)+4 = 4 and 4 = 4 ✓. Add: "x = 0 is a real answer: the equation balances when x is 0. That's different from no solution."
10. `2x + 3 + x = 3x + 3`: combine like terms → `3x + 3 = 3x + 3`; + (−3x) → `3 = 3`. Always statement. Check: x = 2 gives 9 and 9 ✓.
11. `3x − 6 + x = 4x + 1`: combine like terms → `4x − 6 = 4x + 1`; + (−4x) → `−6 = 1`. Never statement. Check: x = 1 gives −2 and 5; the right is 7 heavier for any x.
12. `5x − 2 = 2x + 10`: + (−2x) → `3x − 2 = 10`; + (+2) → `3x = 12`; ÷ 3 → `x = 4`. Check: 5(4)−2 = 18 and 2(4)+10 = 18 ✓.

The divide step is written "Divide both sides by __" with ÷ under each side, matching the "+ (−x)" style. Confirm the teacher's preferred notation.
