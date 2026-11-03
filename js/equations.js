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

  /* Worked solution steps (spec section 14; wording pending teacher review). how: add | divide | combine. */
  var STEPS = {
    1: { start: ["2x + 3", "x + 7"],
      lines: [
        {"how": "add", "term": "−x", "eq": ["x + 3", "7"]},
        {"how": "add", "term": "−3", "eq": ["x", "4"]}
      ],
      check: "Check: 2(4) + 3 = 11 and 4 + 7 = 11 ✓" },
    2: { start: ["3x + 2", "x − 4"],
      lines: [
        {"how": "add", "term": "−x", "eq": ["2x + 2", "−4"]},
        {"how": "add", "term": "−2", "eq": ["2x", "−6"]},
        {"how": "divide", "by": "2", "eq": ["x", "−3"]}
      ],
      check: "Check: 3(−3) + 2 = −7 and −3 − 4 = −7 ✓" },
    3: { start: ["x + 5", "4x + 1"],
      lines: [
        {"how": "add", "term": "−x", "eq": ["5", "3x + 1"]},
        {"how": "add", "term": "−1", "eq": ["4", "3x"]},
        {"how": "divide", "by": "3", "eq": ["4/3", "x"]}
      ],
      check: "Check: 4/3 + 5 = 19/3 and 4(4/3) + 1 = 19/3 ✓" },
    4: { start: ["2x + 3", "2x + 8"],
      lines: [
        {"how": "add", "term": "−2x", "eq": ["3", "8"]}
      ],
      end: "All the boxes cancel and 3 = 8 is left. That is never true, so no value of x can balance this.",
      check: "Check: x = 1 gives 5 and 10. The right side is 5 heavier for any x." },
    5: { start: ["4x + 2", "4x − 6"],
      lines: [
        {"how": "add", "term": "−4x", "eq": ["2", "−6"]}
      ],
      end: "All the boxes cancel and 2 = −6 is left. That is never true, so no value of x can balance this.",
      check: "Check: x = 1 gives 6 and −2. The left side is 8 heavier for any x." },
    6: { start: ["3x − 5", "3x − 5"],
      lines: [
        {"how": "add", "term": "−3x", "eq": ["−5", "−5"]}
      ],
      end: "All the boxes cancel and −5 = −5 is left. That is always true, so every value of x balances this.",
      check: "Check: x = 2 gives 1 and 1 ✓" },
    7: { start: ["5 + x + x", "2x + 5"],
      lines: [
        {"how": "combine", "note": "x + x = 2x", "eq": ["5 + 2x", "2x + 5"]},
        {"how": "add", "term": "−2x", "eq": ["5", "5"]}
      ],
      end: "All the boxes cancel and 5 = 5 is left. That is always true, so every value of x balances this.",
      check: "Check: x = 3 gives 11 and 11 ✓" },
    8: { start: ["5x + 2", "5x + 3"],
      lines: [
        {"how": "add", "term": "−5x", "eq": ["2", "3"]}
      ],
      end: "All the boxes cancel and 2 = 3 is left. That is never true, so no value of x can balance this.",
      check: "Check: x = 1 gives 7 and 8. The right side is 1 heavier for any x." },
    9: { start: ["3x + 4", "4"],
      lines: [
        {"how": "add", "term": "−4", "eq": ["3x", "0"]},
        {"how": "divide", "by": "3", "eq": ["x", "0"]}
      ],
      check: "Check: 3(0) + 4 = 4 and 4 = 4 ✓",
      extra: "x = 0 is a real answer: the equation balances when x is 0. That’s different from no solution." },
    10: { start: ["2x + 3 + x", "3x + 3"],
      lines: [
        {"how": "combine", "note": "2x + x = 3x", "eq": ["3x + 3", "3x + 3"]},
        {"how": "add", "term": "−3x", "eq": ["3", "3"]}
      ],
      end: "All the boxes cancel and 3 = 3 is left. That is always true, so every value of x balances this.",
      check: "Check: x = 2 gives 9 and 9 ✓" },
    11: { start: ["3x − 6 + x", "4x + 1"],
      lines: [
        {"how": "combine", "note": "3x + x = 4x", "eq": ["4x − 6", "4x + 1"]},
        {"how": "add", "term": "−4x", "eq": ["−6", "1"]}
      ],
      end: "All the boxes cancel and −6 = 1 is left. That is never true, so no value of x can balance this.",
      check: "Check: x = 1 gives −2 and 5. The right side is 7 heavier for any x." },
    12: { start: ["5x − 2", "2x + 10"],
      lines: [
        {"how": "add", "term": "−2x", "eq": ["3x − 2", "10"]},
        {"how": "add", "term": "+2", "eq": ["3x", "12"]},
        {"how": "divide", "by": "3", "eq": ["x", "4"]}
      ],
      check: "Check: 5(4) − 2 = 18 and 2(4) + 10 = 18 ✓" }
  };
  BON.EQUATIONS.forEach(function (q) { q.steps = STEPS[q.id]; });

  /* Reflection breaks: after these equations, a stop screen with the prompt from the paper page (text exactly as printed). */
  BON.REFLECTIONS = {
    7: [{ n: "1", text: "Look at the equations in your \u201cNo solutions\u201d column. What is the same about the two sides? What is different?" }],
    9: [{ n: "2", text: "Equation 9 has a solution of 0. Explain why \u201cthe solution is 0\u201d is not the same as \u201cthere is no solution.\u201d" }],
    10: [{ n: "3", text: "Look at the blue terms in each of your three columns. What do you notice?" }],
    12: [{ n: "4a", text: "The slider broke. How can you tell just by looking that an equation has only one solution?" },
         { n: "4b", text: "How can you tell just by looking that an equation has infinite solutions?" },
         { n: "4c", text: "How can you tell just by looking that an equation has no solutions?" }]
  };

  /* Part 3 reasons (they appear only in Part 3). fits(k) says whether a reason describes an equation (k = its A, B, C, D). */
  BON.REASONS = [
    { id: "same-same", text: "The number of x\u2019s matches on both sides and the plain numbers match.",
      fits: function (k) { return k.A === k.C && k.B === k.D; } },
    { id: "same-diff", text: "The number of x\u2019s matches on both sides but the plain numbers are different.",
      fits: function (k) { return k.A === k.C && k.B !== k.D; } },
    { id: "diff", text: "The number of x\u2019s is different on the two sides.",
      fits: function (k) { return k.A !== k.C; } }
  ];

  /* Column wording, matching the reflection page. */
  BON.CATEGORIES = {
    one:    { title: "One solution",       sub: "Balanced for exactly one value", slider: "Sometimes balanced" },
    always: { title: "Infinite solutions", sub: "Always balanced",                slider: "Always balanced" },
    never:  { title: "No solutions",       sub: "Never balanced",                 slider: "Never balanced" }
  };
})(typeof window !== "undefined" ? window : globalThis);
