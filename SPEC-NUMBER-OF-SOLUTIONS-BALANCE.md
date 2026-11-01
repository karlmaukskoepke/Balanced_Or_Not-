# SPEC: "Balanced or Not?" — Number-of-Solutions Balance Activity

Standalone student web page for a Math 8 / Algebra 1 lesson on equations with one, no, or infinitely many solutions. It follows lessons on solving equations with variables on both sides. It replaces the Desmos activity (slides 1–6) and runs alongside two paper sheets (a solving sheet and a reflection page). Destination: its own page in a GitHub repo, deployed via GitHub Pages. No backend, no accounts, no data collection.

Audience: middle schoolers. The teacher walks the whole class through the first problems on a projector. Students then run it self-paced on Chromebooks (trackpad, keyboard). Text must be large and readable from the back of a classroom.

## 1. Teaching goal

Students use "does a value make it balance?" to discover that an equation can be balanced for exactly one value of x, for every value, or for no value. The takeaway has to come from the experience of solving an equation and hitting a strange result (5 = 5, or 3 = 8), with the balance as the metaphor that explains it.

The tool must NOT state the rule ("same x-terms, different constants means never"). Students build the theory themselves from the sorted columns and the highlighted terms. The page only checks their choices and scaffolds mistakes.

Sequence per equation: **guess → predict → slider → sort → solve on paper → enter result.** The slider comes before solving on purpose: its imperfection (for example x = 4/3 never lands exactly) is what makes algebra necessary.

## 2. Equation form and data model

All equations have the form Ax + B = Cx + D, with these constraints:
- Coefficients of x are non-negative (never negative), so x-terms are always weight, never balloons.
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
  sliderRange: [-10, 10]     // integers; the solution must fall strictly inside
}
```

### The 12 equations

Display strings keep the author's order. A–D values are for reference. Do not recompute categories from the display strings; use the table.

| # | Part | Equation | Category | Solution / note |
|---|------|----------|----------|-----------------|
| 1 | 1 | 2x + 3 = x + 7 | one | x = 4 |
| 2 | 1 | 3x + 2 = x − 4 | one | x = −3 (right side holds a balloon at the solution) |
| 3 | 1 | 4x + 1 = x + 5 | one | x = 4/3 (slider never lands exactly) |
| 4 | 1 | 2x + 3 = 2x + 8 | never | right always heavier by 5 |
| 5 | 1 | 4x + 2 = 4x − 6 | never | left always heavier by 8 |
| 6 | 1 | 3x − 5 = 3x − 5 | always | identical sides |
| 7 | 1 | 5 + x + x = 2x + 5 | always | split x's, swapped order |
| 8 | 2 | 5x + 2 = 5x + 3 | never | right always heavier by 1 |
| 9 | 2 | 3x + 4 = 4 | one | x = 0; the right pan has only a constant (C = 0) |
| 10 | 2 | 2x + 3 + x = 3x + 3 | always | only after combining |
| 11 | 3 | 3x − 6 + x = 4x + 1 | never | right always heavier by 7 |
| 12 | 3 | 5x − 2 = 2x + 10 | one | x = 4 |

Free-play mode (section 9) may use any A, B, C, D within small bounds.

## 3. Arithmetic (do not use floats)

Floating-point errors will make 0.1 + 0.2 miss 0.3 and break "balanced." Compute all values as integers in hundredths (or exact rationals). Slider and typed values are quantized to 0.01. "Balanced" means left − right is exactly 0 in that representation. Solutions like 4/3 are stored as rationals and compared exactly in the solve-entry step.

## 4. The balance visual

A classic pan balance: a central post, a beam that tilts, and a pan hanging from each end. The equation appears above it, with the same blue/black styling as the paper sheet.

**Weights (positive terms):**
- Each x-term of coefficient k renders as k separate boxes, each showing the substituted value of x. The pan shows the structure of the equation as written (split terms render as separate groups). Do not simplify for the student.
- Box size scales with the value of x, by area, not side length. Use a minimum floor size so a box never vanishes.
- At x = 0: boxes use the floor size with a dashed outline, a light shaded fill, and a "0" label, to show they exist but weigh nothing. Boxes never disappear.
- Positive constants render as green circles labeled with a sign ("+3"). Circle area scales with the value.
- If many boxes overflow a pan (for example 5 boxes at x = 8), scale them down uniformly or tile them in a grid. Never let them overlap the beam.

**Negative terms (lift):**
- Negative constants render as red balloons tethered to the pan end, floating up, with a visible string. Balloon area scales with |value|. Label with a sign ("−6").
- When x is negative (coefficients are positive), each x-box becomes a floating box with the negative number inside, tethered the same way. Because the coefficient is positive, the box still counts as one box.
- Do not rely on color alone: every weight and balloon shows its sign in text. (Colorblind students.)

**Colors:** x-boxes get a blue outline. Positive constants are green, negative are red. Match the paper sheet's blue for x-terms.

**Tilt:**
- The side with the greater value (more positive) is "heavier" and goes down.
- Value of a side = total of its terms with signs, using the current x.
- Tilt angle is capped and scaled: nonzero differences must always show a visible tilt (a floor of about 3–4°), up to a maximum (about 15–20°). Exactly 0 is level.
- Use ease animation when the value changes.

**Readout:** show the substitution step by step. Example, for x = −2 in 3x + 2: `3(−2) + 2 = −4`. Negatives are always parenthesized. Show both side totals under the pans.

## 5. Per-equation flow

### Step A — Guesses (5 required)
- The beam starts level. The student enters a value for x (typed, with ± and arrow nudging).
- The page shows the substituted values for both sides, but the beam stays level until the student answers the prompt, then tips as the reveal.
- The 5 guesses and their results stay in a persistent on-screen log (x, left value, right value, heavier side, difference). Compact; do not crowd the balance.
- Don't let a student re-enter the same x twice (it wastes a guess).

**Prompts fade by part** (scaffold fades as the skill sticks):
- **Part 1 (#1–7):** the student chooses Left / Right / Balanced for the heavier side AND types the difference. The difference is always larger minus smaller, so it is positive (0 if balanced). The student first decides which side is larger, then subtracts.
- **Part 2 (#8–10):** heavier side only (choose Left / Right / Balanced).
- **Part 3 (#11–12):** no guess prompts (the slider is broken here; see section 7).

**Wrong answer:** highlight both side values and point at the more positive one ("−2 is greater than −7"). Don't just say "try again." Let them retry.

### Step A2 — Prediction (Parts 1–2)
- After the 5 guesses are logged, the student predicts a column: **One solution / Infinite solutions / No solutions.**
- The page does not say whether the prediction is right. It just records it, and the slider then unlocks so the student can test it.
- Part 3 has no separate prediction step; the category pick and reasoning choice in section 7 serve that role.

### Step B — Slider
- **Locked until 5 guesses are logged and a prediction has been made.**
- Range: integer endpoints from `sliderRange`, containing the solution strictly inside. Step 0.01. Also provide a typed entry box and left/right arrow-key nudging, because 2,000 steps is hard to hit with a trackpad.
- The beam tilts live as the slider moves. A running readout shows x, left, right, heavier side, and difference.
- The slider's imperfection is intentional. For x = 4/3, the student sees the tilt flip between 1.33 and 1.34 and never balances exactly. Do not add snapping or a "close enough" band. Students learn the exact answer needs algebra.

### Step C — Sort
- After using the slider, the student sorts the equation into one of three columns: **Never balanced / Balanced for exactly one value / Always balanced.**
- Sort as they go, one equation at a time. Keep the sort panel compact (chips or count bar, expandable). Do not take much screen space.
- Earlier equations stay in their columns and remain visible on demand, so students can compare.
- **Wrong sort:** no scolding. The slider is spotlighted, the rest of the screen grays out, with a message "Check the slider again." As soon as the student uses the slider, the screen relights and the sort reopens. No retry limit.
- Students can't mis-sort permanently (the page enforces the correct column), but the slider detour is the learning moment.

### Step D — Solve and enter result
- The student solves on paper. The page then asks for their result in two fields with a static "=" between them.
- Accept `x = 4` or `4 = x`. Accept integers and exact fractions (any equivalent fraction, for example 8/6 for 4/3).
- Accept terminating decimals that are exact (0.5, 2.25).
- **Rounded or repeating decimals (for example 1.33) are not accepted.** Show: "That's a rounded value. Write the exact answer as an improper fraction, like 5/4 or 6/5." Use an example that is not the actual answer. Do not use 4/3.
- Accept any `a = b` with a and b numeric and equal (5 = 5, 10 = 10) as "always." Accept any `a = b` with a and b numeric and unequal (3 = 8, 0 = 8) as "never."
- If the result contradicts the sorted category, show a gentle prompt: "Your algebra and the slider disagree. Check your solving, and check the slider." Do not reveal the answer.
- Then enable Next.

## 6. Highlighting of x-terms and constants

- From equation 1, x-terms in the displayed equation are blue; constants are black. Every x-term is blue, including split terms.
- The x-boxes on the balance have a matching blue outline.
- In Part 2, add extra emphasis (for example a light blue tint behind each x-term) so the x-coefficients and constants pop while students look for a pattern.
- Do not label anything "A" or "C" for students.

## 7. Part 3 — "the slider broke"

- For #11 and #12, the slider is unavailable. Show it flickering, optionally with small random sparks (CSS animation; second-pass polish, not required).
- The student must decide the category and explain why, without testing.
- **Reasoning choices** appear here and only here (they would give away the answer earlier). The student picks the category, then picks a reason from choices like these (final wording to be refined together):
  - "The number of x's matches on both sides and the plain numbers match."
  - "The number of x's matches on both sides but the plain numbers are different."
  - "The number of x's is different on the two sides."
- **Wrong reasoning:** do not just say "try again." Show a counterexample from equations they've already sorted (for example, if they say "plain numbers match so always," show #9 in its column). Don't state the rule.
- For #11, students must total the x's first (3x + x = 4x), so the pan should show the structure and let them count boxes.
- Even in Part 3, students still solve on paper and enter their result (Step D).

## 8. Paper companion sheets (already designed; do not duplicate)

- **Solving sheet (2 pages):** 12 problems. Each has a "Slider:" circle line (Left/Right/Balanced) and "x is about ___", then open solving space and a "Result: ___ = ___" line. #11–12 use "My prediction: Never / One value / Always" and "because ___".
- **Reflection page:** one box split into three columns, headed **One solution / Infinite solutions / No solutions**, with gray subtext (Balanced for exactly one value / Always balanced / Never balanced). Students write the actual equations in each column. Below are prompts 1, 2, 3, then 4A (only one solution), 4B (infinite solutions), and 4C (no solutions), each asking how to tell just by looking. The page's column labels should match this wording.

Equation numbers and display strings must match the paper exactly.

## 9. Final step — free play with A, B, C, D

After equation 12, unlock an exploration mode: Ax + B = Cx + D with controls (inputs or steppers) for A, B, C, D. Keep values small: A, C in 0–9 (non-negative), B, D in −9–9.
- The same balance and slider (and typed entry) apply.
- Compute the category from the numbers (A ≠ C → one value; A = C and B = D → always; A = C and B ≠ D → never).
- A solution that is a repeating decimal is allowed (the slider is imperfect on purpose).
- Slider range: integer endpoints that contain the solution (for example ceil/floor of the solution ± a margin); fall back to −10..10 for never/always.
- The page must not state the A/C rule anywhere in this mode.

## 10. Navigation and state

- Self-paced: each student moves on their own. A Back button revisits earlier equations without losing the guess log or sort.
- Teacher walkthrough: it should work well on a projector. Keyboard shortcuts for next/back; large type; the balance fills most of the screen.
- State persists in `localStorage` (guess logs, sorts, solve entries) so a refresh doesn't lose progress, with a "Start over" button. Wrap storage reads/writes in try/catch.
- Optional nice-to-have: a completion screen listing all 12 equations, the student's sort, and their solve results, so the teacher can check at a glance. (This partly replaces the Desmos teacher dashboard, which the teacher loses.)

## 11. Accessibility and design

- Never convey meaning by color alone (signs shown as text; blue also differs by outline).
- Large, bold type; strong contrast; touch/trackpad-friendly targets.
- Respect `prefers-reduced-motion` (tilt snaps instead of easing; no flicker/sparks).
- Keyboard operable throughout (slider arrow keys, tab order through prompts).
- Visual style: clean, uncluttered, consistent with the paper sheets (blue accents, light outlines).

## 12. Tech

- Static site: plain HTML/CSS/JS (or a small framework) with SVG for the balance. Deployable on GitHub Pages. No build step required unless the repo already has one.
- Where it lives: its own page in the repo. It stands alone from The Mat and the other practice sites.
- Keep the equation data in one data file so equations can be edited without touching rendering code.

## 13. Test cases to verify

- #3: slider near 1.33/1.34 never shows "Balanced"; the difference is 0.01 and the beam still visibly tips (tilt floor).
- #9 at x = 0: boxes dashed with "0", pans balanced at 4 and 4.
- #2 at x = −3: both sides equal −7; the left shows floating boxes, the right has a balloon (−4) and a floating box.
- Negative x with 3 boxes (#2 left side): three floating boxes, each labeled with the same negative value.
- #5 and #8: the beam never goes level at any slider position.
- #6, #7, #10: level at every position, including 0 and negatives.
- Wrong-sort and wrong-reasoning flows never reveal the answer.
- Solve entry: `x = 4`, `4 = x`, `5 = 5`, `10 = 10`, `3 = 8`, and `4/3` all behave as specified.
- No float artifacts (for example 0.1 + 0.2) in any readout.

## 14. Decisions made and remaining items

Decided:
- **Fractional answers:** accept exact fractions only (section 5, Step D). A rounded decimal triggers the improper-fraction prompt.
- **Prediction:** students predict a column before the slider unlocks (section 5, Step A2).
- **Part 3 testing:** the "test a value" box is disabled in Part 3.

To decide after the teacher playtests the built page:
- Whether the prompt fading (section 5, Step A) feels right.
- Free-play mode details (one equation at a time, or a gallery of saved examples).

### Completion screen (optional, version 1 = on the student's own screen only)
- At the end, the student sees a summary on their own screen: the 12 equations, the column they sorted each into, and what they entered as their result.
- The student shows it to the teacher or takes a screenshot. Nothing is sent anywhere, no sign-in, no spreadsheet.
- A later version could add a "Copy my results" button so a student can paste the summary into a Google Form or assignment. Sending results to a spreadsheet automatically would require sign-in and a backend, so it is out of scope.
