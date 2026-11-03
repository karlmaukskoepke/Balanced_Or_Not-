/*
 * Checking rules and wording for the per-equation flow (spec v3). Pure functions, testable in Node.
 * None of it states the rule about x-terms and numbers.
 */
(function (root) {
  "use strict";
  var BON = root.BON || (root.BON = {});
  var E = BON.exact, M = BON.model;

  var MIN_POSITIONS = 3; // distinct slider positions before "I've seen enough" appears (tunable)

  var TEXT = {
    notNumberYet: "Keep typing: that isn't a number yet.",
    notNumber: "Type a number, like 3, −2, 1.5 or −1/2.",
    zeroDen: "The bottom of a fraction can't be 0.",
    outOfRange: function (lo, hi) { return "Try a value between " + lo + " and " + hi + "."; },
    buildLeft: "Look at the left side again.",
    buildRight: "Look at the right side again.",
    buildBoth: "Look at both sides again.",
    lookModel: "Look at the model. Does it match the equation?",
    checkQ: "What did the slider show?",
    checkSlider: "Check the slider again."
  };

  /* The one-tap check: the slider words for each category (the same words as the paper sheet). */
  var SLIDER_WORDS = [["one", "Sometimes balanced"], ["always", "Always balanced"], ["never", "Never balanced"]];
  function checkSlider(eq, cat) { return eq.category === cat; }

  /*
   * Part 3: a predicted category and a reason. Wrong reasoning gets a counterexample from an earlier
   * equation (one that fits the chosen reason), never the rule itself.
   *   earlier: equations the student has already done (in order), most recent last
   * Returns { ok: true } or { ok: false, reasonFits, example, exampleCat }.
   */
  function checkPart3(eq, cat, reasonId, earlier) {
    var R = BON.REASONS, k = M.abcd(eq);
    var chosen = R.filter(function (r) { return r.id === reasonId; })[0];
    var right = R.filter(function (r) { return r.fits(k); })[0];
    if (chosen && chosen === right && cat === eq.category) return { ok: true };
    var reasonFits = !!chosen && chosen.fits(k);
    var pool = (earlier && earlier.length ? earlier : BON.EQUATIONS.filter(function (q) { return q.id < eq.id; }));
    var fitting = pool.filter(function (q) { return chosen && chosen.fits(M.abcd(q)); });
    // prefer an example whose result differs from the student's predicted category (a true counterexample)
    var example = fitting.filter(function (q) { return q.category !== cat; }).pop() || fitting.pop() || null;
    return { ok: false, reasonFits: reasonFits, example: example, exampleCat: example ? example.category : null };
  }

  function inRange(eq, x) {
    return E.fCmp(x, E.frac(eq.sliderRange[0])) >= 0 && E.fCmp(x, E.frac(eq.sliderRange[1])) <= 0;
  }

  /* A typed x: { ok: true, value, style } or { ok: false, message }. */
  function readX(eq, text) {
    var p = E.parseNumber(text);
    if (!p.ok) {
      return { ok: false, message: p.partial ? (String(text).trim() === "" ? TEXT.notNumber : TEXT.notNumberYet)
        : p.zeroDen ? TEXT.zeroDen : TEXT.notNumber };
    }
    if (!inRange(eq, p.value)) {
      return { ok: false, message: TEXT.outOfRange(E.fmtValue(E.frac(eq.sliderRange[0])), E.fmtValue(E.frac(eq.sliderRange[1]))) };
    }
    return { ok: true, value: p.value, style: p.style };
  }

  /* "I built the equation": does each side have the right number of x's and the right net number? */
  function checkBuild(eq, model) {
    var l = M.sideMatches(eq.left, model.left), r = M.sideMatches(eq.right, model.right);
    if (l && r) return { ok: true };
    var wrong = !l && !r ? "both" : !l ? "left" : "right";
    return { ok: false, wrong: wrong, message: wrong === "both" ? TEXT.buildBoth : wrong === "left" ? TEXT.buildLeft : TEXT.buildRight };
  }

  BON.flow = { MIN_POSITIONS: MIN_POSITIONS, TEXT: TEXT, SLIDER_WORDS: SLIDER_WORDS, inRange: inRange, readX: readX,
    checkBuild: checkBuild, checkSlider: checkSlider, checkPart3: checkPart3 };
})(typeof window !== "undefined" ? window : globalThis);
