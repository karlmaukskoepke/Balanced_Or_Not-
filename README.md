# What Makes It Balance?

A static student page for a Math 8 / Algebra 1 lesson on equations with one, no, or infinitely many solutions.
The full design is in [SPEC-NUMBER-OF-SOLUTIONS-BALANCE.md](SPEC-NUMBER-OF-SOLUTIONS-BALANCE.md).

Plain HTML, CSS and JavaScript, with SVG for the balance. No build step, no backend. GitHub Pages can serve it
straight from the `main` branch (Settings → Pages → Deploy from a branch → `main`, folder `/ (root)`).

## Pages

- `index.html`: the student activity (spec v3; Stage 1: Build and Slide). Address options: `?all=1` unlocks every
  equation, `?eq=4` opens equation 4.
- `balance-test.html`: test page. Any of the 12 equations, pre-built, slider always on. `?eq=3&x=4/3`.
- `teachers.html`: printable sheets to download.

## Files

- `js/equations.js`: **the 12 equations** (the only file to edit to change the problems).
- `js/exact.js`: exact arithmetic (every value is a fraction of whole numbers; no floating-point values shown).
- `js/model.js`: side values, the model on the pans (x-boxes and one net number per side), equation text.
- `js/flow.js`: checking rules and wording (typed x, the build check).
- `js/balance.js`: the layered SVG balance and the one size rule for every piece.
- `js/vslider.js`: the vertical number-line slider (snap, keys).
- `js/explore.js`: keeps the slider, typed box, balance, x-box and readout in step.
- `js/activity.js`: the student page. `js/balance-test.js`: the test page.
- `reference/`: the paper sheets (solving sheet, reflection page) as PDFs.

## Tests

```
node tests/unit.mjs        # data, arithmetic, the model, build check, sizes, layout, tilt
node tests/browser.cjs     # real-browser checks at 1366x650 and 1366x768 (needs Playwright)
```
