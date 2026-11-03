# SPEC (v3): "What Makes It Balance?" — Number-of-Solutions Balance Activity

Standalone student web page for a Math 8 / Algebra 1 lesson on equations with one, no, or infinitely many solutions. It follows lessons on solving equations with variables on both sides. It runs alongside two paper sheets (a solving sheet and a reflection page). Destination: its own page in a GitHub repo, deployed via GitHub Pages. No backend, no accounts, no data collection.

Audience: middle schoolers. The teacher walks the whole class through the first problems on a projector. Students then run it self-paced on Chromebooks (trackpad, keyboard). Text must be large and readable from the back of a classroom.

**Design for a 1366×650 viewport. Nothing a student needs may require vertical scrolling. Also test 1366×768.**

## 0. What v3 changes (rework after classroom playtests)

v3 replaces the guess-and-record flow with a simpler one: build the equation on the balance, then explore it with one slider.

**Remove:** the five required guesses, the guess table, the number-line markers (◀ ▶ ✓), the Predict step (except in Part 3), the final two-part "What makes it balance?" question, the two-stage reveal and countdown, the second-value note, the sort count bar, the heavier-side label under the equation, and the substitution lines.

**Keep and reuse from the current build:** the exact rational arithmetic, the balance geometry and tilt scaling, the equation data file, and the paper-sheet wording.

**Add:** a Build step with +/− buttons; a vertical number-line slider with the x-box beside zero; a typed-x box for exact values; layered SVG art with balloons that rise straight up; a relation sign (> / = / <) between the two totals, gold at exact balance; a one-tap check after the slider; and worked steps to compare with.

## 1. Teaching goal

Students use "does a value make it balance?" to discover that an equation can be balanced for exactly one value of x, for every value, or for no value. The takeaway comes from solving the equation and hitting a strange result (5 = 5, or 3 = 8), with the balance as the metaphor that explains it.

The tool must NOT state the rule ("same x-terms, different constants means never"). Students build the theory from their sorted equations on the reflection page.

Sequence per equation: **Build (or look at a given model) → Slide → one-tap check → Solve on the sheet → Compare steps → Write it on the reflection page → Next.** The slider comes before solving on purpose: its imperfection (x = 4/3 never levels) is what makes algebra necessary.

## 2. Equation data

All equations have the form Ax + B = Cx + D with these constraints:
- Coefficients of x are non-negative, so x-terms are always weight, never balloons.
- x itself may be negative or fractional.

```js
// term: { kind: "x", coef: 2 } or { kind: "const", value: 3 }
{
  id: 7, part: 1,
  left:  [ {kind:"const", value:5}, {kind:"x", coef:1}, {kind:"x", coef:1} ],
  right: [ {kind:"x", coef:2}, {kind:"const", value:5} ],
  category: "always",        // "one" | "never" | "always"
  solution: null,            // rational for "one" (e.g. {n:4, d:3})
  sliderRange: [-6, 6],      // integers; solution strictly inside
  built: false,              // true = the student builds it; false = pre-built model
  steps: [ /* section 14 */ ]
}
```

| # | Part | Equation | Category | Built by student? | Solution / note |
|---|------|----------|----------|-------------------|-----------------|
| 1 | 1 | 2x + 3 = x + 7 | one | yes | x = 4 |
| 2 | 1 | 3x + 2 = x − 4 | one | yes | x = −3 (balloon on the right) |
| 3 | 1 | x + 5 = 4x + 1 | one | yes | x = 4/3; more x's on the RIGHT |
| 4 | 1 | 2x + 3 = 2x + 8 | never | yes | right always heavier by 5 |
| 5 | 1 | 4x + 2 = 4x − 6 | never | no | left always heavier by 8 |
| 6 | 1 | 3x − 5 = 3x − 5 | always | no | identical sides |
| 7 | 1 | 5 + x + x = 2x + 5 | always | no | split x's: pre-built model shows two boxes |
| 8 | 2 | 5x + 2 = 5x + 3 | never | no | right always heavier by 1 |
| 9 | 2 | 3x + 4 = 4 | one | no | x = 0; right pan has only a constant |
| 10 | 2 | 2x + 3 + x = 3x + 3 | always | no | only after combining |
| 11 | 3 | 3x − 6 + x = 4x + 1 | never | no | right always heavier by 7 |
| 12 | 3 | 5x − 2 = 2x + 10 | one | no | x = 4 |

**Why #3 is flipped:** in the other one-solution equations the larger x-coefficient is on the left. Without a flip, students could learn "left heavier means move down" and fail when it reverses. Do not hint at this on screen.

Free play (section 11) may use any A, B, C, D within small bounds.

## 3. Arithmetic (do not use floats)

Use exact rationals (or integers in hundredths). Typed fractions like −1/2 are exact. "Balanced" means left − right is exactly 0. Typed values must be within the equation's `sliderRange`; otherwise show "Try a value between −6 and 6."

## 4. Screen layout

```
 What Makes It Balance?     [Build ▸ Slide ▸ Check ▸ Solve ▸ Compare]
 ┌────────────┬───────────────────────────────────┬──────────────────────┐
 │ heavier    │        2x + 3  =  x + 7            │ PROMPT PANEL         │
 │   6        │      (large, centered)             │ (instructions,       │
 │   :        │   [ x ][+1][-1]    [ x ][+1][-1]   │  buttons, the check, │
 │  [x box]―0 │     (Build step only)              │  worked steps)       │
 │   :        │        the balance                 │                      │
 │  -6        │    left total  >  right total      │                      │
 │ lighter    │                                    │                      │
 │ x=[   ] Go │                                    │                      │
 └────────────┴───────────────────────────────────┴──────────────────────┘
```

- **Left column:** the vertical number-line slider (section 5) with the x-box beside zero, and the typed "x =" box beneath it.
- **Center:** the equation (large, centered), then the balance, then the readout row: **left total, relation sign, right total** (section 6).
- **Right column:** one prompt panel for everything the student reads or presses: step instructions, the one-tap check, the "I solved it" button, the worked steps, and Next. It grows when showing steps.
- Step strip across the top. No heavier-side label under the equation.
- **Build palettes** (Build step only): one small button group above each pan: `x`, `+1`, `−1`. They must not cover the pans or the pieces; if needed, place them below the pans during Build.

## 5. The slider (vertical number line)

- **Vertical**, from the equation's `sliderRange` (−6 to 6 for the 12 equations). Zero in the middle. **Tick mark and label at every integer.** The top is labeled **Heavier** and the bottom **Lighter**. No directional arrows and no markers.
- The thumb moves up and down. The **x-box sits in a fixed slot beside the zero mark** and does not follow the thumb; it only changes size (or style) with the current value. Label it "x" above it, and show the value inside.
- **Drag** snaps to whole numbers (a magnetic capture of about 0.15 units, tunable), but lets go easily so students can leave an integer and move between them. Between integers the value is continuous (0.01).
- **Arrow keys** (up/down or left/right) move by **0.01**. **Shift + arrow** moves by 0.1. Page Up/Down moves by 1.
- **Typed box:** "x = [ ]" with Enter/Go. Accepts integers, decimals, and fractions (−1/2, 4/3). It moves the thumb there (travel animation of about 1 s, then the thumb settles). There is no log and no guess counting.
- Under `prefers-reduced-motion` the thumb jumps.
- Everything (beam, boxes, balloons, totals, relation sign) updates live while dragging, on the `input` event. Easing is short (about 0.07 s).
- The slider is **locked** during Build and in Part 3 (where it is shown disabled and flickering; sparks are optional polish).

## 6. The balance

### Art and layering
Draw the balance as **layered SVG** (not a single image, so parts can move): base and post; back layer (back chains, some balloons); the beam, which rotates about the pivot; the pans and chains, which follow the beam ends and stay level; the items on the pans; and a front layer (front balloons and strings, and any single large balloon). Use gradients and soft shadows for a 3D feel.

**Balloons rise straight up** from their pan on a visible string tethered to the pan rim, never out to the side. Alternate balloons between the back and front layers so some sit behind the balance and some in front. A single large balloon (for example a negative x-box) always sits in front. Reserve headroom above the pans so balloons never run into the equation; clip or cap their string length if needed.

### Pieces and sizing
- **x-box:** weight with a heavy look (shading, bevel, a shadow where it sits on the pan), blue outline, the value written inside. Each x-term of coefficient k renders as k separate boxes. Split terms render separately as written (a pre-built model for x + x shows two boxes).
- **Constants:** each side holds one **net constant**, drawn as a single ball (positive, green) or a single balloon (negative, red) whose size grows with |value|. Label it with a sign ("+5", "−6"). Zero shows nothing.
- **One size function for everything:** side length of a box (and diameter of a ball or balloon) for value v is `s(v) = s1 · sqrt(|v|)` (area ∝ |value|), with a minimum floor so a piece never vanishes. The **left x-box and every x-box on the pans must be exactly the same size** at any value (add a test that compares their rendered sizes). A ball of value v has the same diameter as a box of side s(v).
- **Sizing budget:** pans are sized so five boxes at the largest allowed |x| (6) fit at true scale without shrinking. Choose s1 accordingly (for example s(6) ≈ 44 px). In free play, if the range is larger, apply one **uniform scale factor** to every piece, including the left x-box, and show a small "scale" tag, so sizes still match.
- **x = 0:** boxes use the floor size with a dashed outline, a light shaded fill, and a "0" label.
- **Negative x:** the x-box becomes a balloon: slightly rounded corners, a balloon look, a string. In the left slot it floats on a short tether anchored at the zero mark (it does not follow the thumb). On the pans, each rises straight up like the other balloons.
- Never rely on color alone: every piece shows its sign or value as text.

### Tilt
- The side with the greater value goes down. Tilt is capped (about 18°) with a floor of 3–4° for any nonzero difference. Exactly 0 is level.
- Scale per equation so the largest difference across the range reaches the cap; for never-balanced equations hold a constant, clearly visible tilt (about 60% of the cap).
- During Build the beam stays **level**.

### Readout row (below the balance)
Show **only totals, no substitution lines**: `left total  [sign]  right total`. The relation sign sits **between the totals, not on the beam**.
- Left bigger: a large `>` that glows in one color (for example orange). Right bigger: a large `<` in a different color (for example purple). The color snaps when the direction flips. Do not use red, green, or blue for these (those are taken by constants and x).
- Exactly equal: a large **gold, embossed `=`** with a glow, plus a short settle on the beam. This should feel like an arrival.
- The sign carries meaning by shape, not color alone, and is announced for screen readers ("left is heavier").

### Colors
x-terms and x-boxes are blue. Constants are green (positive) and red (negative) **only where they label a piece**. Expression labels under each pan use the same colors (`2x` blue, `+ 5` green, `− 2` red) and slide up and down with the pan, staying horizontal. In the big equation at the top, x-terms are blue and constants black (matching the paper).

## 7. Per-equation flow

Step strip: **Build ▸ Slide ▸ Check ▸ Solve ▸ Compare.** Whatever step the student is on is lit; the rest dims (reduced opacity, never hidden). The balance stays lit whenever x or the build is involved. The strip itself always shows the step, so dimming is never the only cue.

### Build (equations with `built: true`)
- The equation is given. The student builds it with the buttons: `x` adds one x-box to that pan; `+1` and `−1` change that side's net constant (the ball or balloon grows or shrinks by one). Clicking a piece removes it. A "clear side" button resets a pan.
- When the model is finished, the student presses **"I built the equation."** If either side doesn't match, show a gentle highlight and "Look at the left side again" (do not reveal the answer). Retry freely.
- For equations with `built: false`, the model is already on the balance. Show "Look at the model. Does it match the equation?" and a Continue button.

### Slide
- The slider unlocks. The student drags, nudges, or types x to find where it balances.
- A "**I've seen enough**" button appears after the student has moved the slider to at least three distinct positions (a tunable minimum, to stop instant click-through).

### Check (one tap)
- The page asks: **"What did the slider show?"** with three buttons: **Sometimes balanced / Always balanced / Never balanced** (the same words as the paper sheet). It does not ask for the x value.
- Correct: continue. Wrong: everything dims except the slider, with "**Check the slider again.**" As soon as the student uses the slider, the screen relights and the question reopens. No retry limit, no scolding.

### Solve
- Stop screen, prompt panel only: "On your sheet: circle what the slider showed and write where it balances (x = ___, x is any number, or not possible). Then solve it. Press **'I solved it'** when you have an answer."

### Compare
- After "I solved it," show the **worked solution steps** (section 14) with "Compare with your work. Copy the correct steps onto your sheet." There is no wait timer, because the page no longer knows whether the student got it wrong.
- Then: "Write this equation under **[One solution / Infinite solutions / No solutions]** on your reflection page." Then **Next equation**.

### Coach marks (equation 1 only, replayable with a "?")
Short callouts, one element each: the equation, the palettes ("click to build each side"), the pans, the x-box ("this is x"), the slider ("heavier at the top, lighter at the bottom"), and the readout.

## 8. Part 3 — "the slider broke" (#11–12)

- The model is pre-built. The slider is disabled and flickering; typed entry is disabled.
- The student predicts the category (**Sometimes / Always / Never balanced**) and picks a reason. Reason choices appear only here (they would give the rule away earlier):
  - "The number of x's matches on both sides and the plain numbers match."
  - "The number of x's matches on both sides but the plain numbers are different."
  - "The number of x's is different on the two sides."
- **Wrong reasoning:** do not just say "try again." Show a counterexample from an equation they already did (for example, for "plain numbers match so always," show #9). Do not state the rule.
- Then the Solve and Compare steps as above.

## 9. Paper companion sheets

- **Solving sheet (2 pages, 12 problems), titled "What Makes It Balance?":** each of #1–10 has a circle line (**Sometimes balanced / Always balanced / Never balanced**), then "**Balanced when:** x = ___ / x is any number / not possible," open solving space, and "Result: ___ = ___". #11–12 use "My prediction: Sometimes / Always / Never balanced" and "because ___". Problem 3 is `x + 5 = 4x + 1`.
- **Reflection page:** one box split into three columns headed **One solution / Infinite solutions / No solutions** (subtext under review: Balanced for exactly one value / Always balanced / Never balanced), where students write the actual equations. Prompts 1, 2, 3, then 4a, 4b, 4c.

Equation numbers and display strings must match the paper exactly.

## 10. Navigation and state

- Self-paced. A Back button revisits earlier equations without losing progress.
- Teacher walkthrough: works on a projector. Keyboard shortcuts for next/back; large type.
- State persists in `localStorage` (progress, check results) with a "Start over" button. Wrap storage in try/catch.
- **Completion screen (version 1, on the student's own screen only):** for each of the 12 equations, show the category and whether the one-tap check was right on the first try. Nothing is sent anywhere.

## 11. Free play with A, B, C, D (after #12; build later)

Controls for Ax + B = Cx + D; A, C in 0–5, B, D in −9 to 9. Same balance, slider, typed box, and relation sign. Compute category from the numbers. Include both A > C and C > A cases among suggested starting equations. Range: integer endpoints containing the solution, with uniform scaling if it exceeds ±6. Do not state the A/C rule anywhere.

## 12. Accessibility and design

- Never rely on color alone (signs in text, symbols carry direction).
- Large, bold type; strong contrast; trackpad-friendly targets; keyboard operable throughout.
- Respect `prefers-reduced-motion` (no travel animation, no flicker, no sparks).
- Visual style: clean, consistent with the paper sheets (blue accents, light outlines).

## 13. Test cases to verify

- The left x-box and every pan x-box have identical rendered sizes at x = −6, −1, 0, 0.5, 1, 6.
- #3 (flipped): left heavier at x = 0, right heavier at x = 3; dragging near 1.33 never reaches `=`; typing 4/3 reaches gold `=`.
- #9 at x = 0: boxes dashed with "0", both totals 4, gold `=`.
- #2 at x = −3: both totals −7; x-boxes are balloons on the left pan; the right pan has a balloon (−4) and a floating x-box.
- #4, #5, #8, #11: the sign is never `=` at any slider position and the tilt is constant. #6, #7, #10: always `=`.
- Balloons rise straight up with a visible string, and none overlaps the equation at the extreme values.
- Drag snaps to integers and leaves them easily; arrow keys move 0.01; Shift+arrow 0.1.
- Wrong one-tap answer dims everything except the slider; using the slider relights it.
- Build: "I built the equation" accepts a correct model and rejects an incorrect one without revealing the answer.
- Nothing scrolls at 1366×650 in the busiest moments (steps showing, five boxes on a pan with a ball and a balloon on the other).
- No float artifacts in any readout.

## 14. Worked solution steps (wording pending teacher review)

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
