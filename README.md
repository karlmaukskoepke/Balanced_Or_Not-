# What Makes It Balance?

A static student page for a Math 8 / Algebra 1 lesson on equations with one, no, or infinitely many solutions.
The full design is in [SPEC-NUMBER-OF-SOLUTIONS-BALANCE.md](SPEC-NUMBER-OF-SOLUTIONS-BALANCE.md).

Plain HTML, CSS and JavaScript, with SVG for the balance. No build step, no backend. GitHub Pages can serve it
straight from the `main` branch (Settings → Pages → Deploy from a branch → `main`, folder `/ (root)`).

## Pages

- `index.html`: the student activity (spec v2.1; Stage A: the three-column screen and the Guess step). Address options: `?all=1` unlocks every equation,
  `?eq=4` opens equation 4, `?reset=1` clears this browser's saved progress.
- `balance-test.html`: Stage 1 test page. Pick an equation, type or slide x. Address options: `?eq=3&x=1.33`, and
  `&rm=1` to pretend reduce-motion is on.
- `teachers.html`: printable sheets to download.

## Files

- `js/equations.js`: **the 12 equations** (the only file to edit to change the problems).
- `js/exact.js`: exact arithmetic (every value is a fraction of whole numbers; no floating-point values shown).
- `js/model.js`: side values, comparisons, the equation text and the substitution readout.
- `js/balance.js`: the SVG balance.
- `js/flow.js`: checking rules and feedback wording (typed guesses, sorting, the answer entry).
- `js/activity.js`: the student page (state, saving, the prompts).
- `js/equation-view.js`: draws an equation with blue x-terms.
- `reference/`: the paper sheets (solving sheet, reflection page) as PDFs.

## Tests

```
node tests/unit.mjs        # data, arithmetic, spec section 13 checks, layout
node tests/browser.cjs     # real-browser walk at 1366x650 and 1366x768, screenshots (needs Playwright)
```
