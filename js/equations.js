/*
 * THE EQUATIONS — the only file to edit to change the activity's problems (spec v3, section 2).
 *
 * Each side is an ordered list of terms, in the order printed on the paper sheet:
 *   { kind: "x", coef: 2 }        means 2x   (coef is always a positive whole number)
 *   { kind: "const", value: -6 }  means − 6
 *
 * category: "one" | "never" | "always"   (taken from the teacher's table; never recomputed)
 * solution: for "one", an exact fraction { n, d }  (4/3 is { n: 4, d: 3 }); otherwise null
 * sliderRange: whole-number endpoints; a "one" solution must sit strictly inside
 * built: true = the student builds it with the x / +1 / −1 buttons; false = the model is already on the balance
 * steps: worked solution steps (section 14; used in Stage 2)
 * note: for the teacher reading this file; not shown to students
 */
(function (root) {
  "use strict";
  var BON = root.BON || (root.BON = {});

  function x(coef) { return { kind: "x", coef: coef }; }
  function c(value) { return { kind: "const", value: value }; }
  var R = [-6, 6];

  BON.EQUATIONS = [
    { id: 1, part: 1, left: [x(2), c(3)], right: [x(1), c(7)], built: true,
      category: "one", solution: { n: 4, d: 1 }, sliderRange: R, note: "x = 4" },
    { id: 2, part: 1, left: [x(3), c(2)], right: [x(1), c(-4)], built: true,
      category: "one", solution: { n: -3, d: 1 }, sliderRange: R, note: "x = −3; balloon on the right" },
    { id: 3, part: 1, left: [x(1), c(5)], right: [x(4), c(1)], built: true,
      category: "one", solution: { n: 4, d: 3 }, sliderRange: R,
      note: "x = 4/3; never levels on the slider; more x's on the RIGHT (flipped on purpose)" },
    { id: 4, part: 1, left: [x(2), c(3)], right: [x(2), c(8)], built: true,
      category: "never", solution: null, sliderRange: R, note: "right always heavier by 5" },
    { id: 5, part: 1, left: [x(4), c(2)], right: [x(4), c(-6)], built: false,
      category: "never", solution: null, sliderRange: R, note: "left always heavier by 8" },
    { id: 6, part: 1, left: [x(3), c(-5)], right: [x(3), c(-5)], built: false,
      category: "always", solution: null, sliderRange: R, note: "identical sides" },
    { id: 7, part: 1, left: [c(5), x(1), x(1)], right: [x(2), c(5)], built: false,
      category: "always", solution: null, sliderRange: R, note: "split x's: the model shows two separate boxes" },
    { id: 8, part: 2, left: [x(5), c(2)], right: [x(5), c(3)], built: false,
      category: "never", solution: null, sliderRange: R, note: "right always heavier by 1" },
    { id: 9, part: 2, left: [x(3), c(4)], right: [c(4)], built: false,
      category: "one", solution: { n: 0, d: 1 }, sliderRange: R, note: "x = 0; the right pan has only a number" },
    { id: 10, part: 2, left: [x(2), c(3), x(1)], right: [x(3), c(3)], built: false,
      category: "always", solution: null, sliderRange: R, note: "only after combining" },
    { id: 11, part: 3, left: [x(3), c(-6), x(1)], right: [x(4), c(1)], built: false,
      category: "never", solution: null, sliderRange: R, note: "right always heavier by 7" },
    { id: 12, part: 3, left: [x(5), c(-2)], right: [x(2), c(10)], built: false,
      category: "one", solution: { n: 4, d: 1 }, sliderRange: R, note: "x = 4" }
  ];

  /* Column wording, matching the reflection page. */
  BON.CATEGORIES = {
    one:    { title: "One solution",       sub: "Balanced for exactly one value", slider: "Sometimes balanced" },
    always: { title: "Infinite solutions", sub: "Always balanced",                slider: "Always balanced" },
    never:  { title: "No solutions",       sub: "Never balanced",                 slider: "Never balanced" }
  };
})(typeof window !== "undefined" ? window : globalThis);
