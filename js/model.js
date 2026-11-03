/*
 * Side values, comparisons and the strings built from an equation.
 * Pure functions (no page access), so they can be tested in Node.
 * x is an exact fraction { n, d } (see exact.js); style says how the student wrote it
 * ("int" | "decimal" | "fraction") so results are shown the same way.
 */
(function (root) {
  "use strict";
  var BON = root.BON || (root.BON = {});
  var E = BON.exact, MINUS = BON.MINUS;

  /* Value of one side (a fraction). */
  function sideValue(terms, x) {
    var total = E.frac(0);
    terms.forEach(function (t) {
      total = E.fAdd(total, t.kind === "x" ? E.fMul(E.frac(t.coef), x) : E.frac(t.value));
    });
    return total;
  }

  /* heavier: "left" | "right" | "balanced"; diff is larger − smaller (never negative). */
  function compare(eq, x) {
    var l = sideValue(eq.left, x), r = sideValue(eq.right, x);
    var c = E.fCmp(l, r);
    return {
      left: l, right: r,
      heavier: c > 0 ? "left" : c < 0 ? "right" : "balanced",
      diff: E.fAbs(E.fSub(l, r)),
      signedDiff: E.fSub(l, r)
    };
  }

  /* ---------- the equation as text pieces ---------- */

  /* One side as pieces [{ text, isX, isOp }], used to draw x-terms in blue. */
  function sidePieces(terms) {
    var out = [];
    terms.forEach(function (t, i) {
      var neg = t.kind === "const" && t.value < 0;
      if (i > 0) out.push({ text: neg ? " " + MINUS + " " : " + ", isOp: true });
      if (t.kind === "x") out.push({ text: (t.coef === 1 ? "" : t.coef) + "x", isX: true });
      else out.push({ text: (i === 0 && neg ? MINUS : "") + Math.abs(t.value) });
    });
    return out;
  }
  function sideText(terms) { return sidePieces(terms).map(function (p) { return p.text; }).join(""); }
  function equationText(eq) { return sideText(eq.left) + " = " + sideText(eq.right); }

  /* ---------- the substitution line ---------- */

  /*
   * One short line per side:
   *   3x + 2 at x = 5      ->  "3(5) + 2 = 17"
   *   5 + x + x at x = −2  ->  "5 + (−2) + (−2) = 1"
   *   4 (a lone number)    ->  "4"
   * Negatives after the first term are always in parentheses.
   */
  function substitutionLine(terms, x, style) {
    var xs = E.fmtValue(x, style);
    var neg = E.fSign(x) < 0;
    var parts = terms.map(function (t, i) {
      var s, isNegConst = t.kind === "const" && t.value < 0;
      if (t.kind === "x") s = t.coef === 1 ? (neg ? "(" + xs + ")" : xs) : t.coef + "(" + xs + ")";
      else s = (i === 0 && isNegConst ? MINUS : "") + Math.abs(t.value);
      if (i === 0) return s;
      return (isNegConst ? " " + MINUS + " " : " + ") + s;
    });
    var line = parts.join("");
    var lone = terms.length === 1 && (terms[0].kind === "const" || terms[0].coef === 1);
    return lone ? line : line + " = " + E.fmtValue(sideValue(terms, x), style);
  }

  /* "Left side is heavier by 5" / "Balanced: both sides are −7". */
  function resultText(cmp, style) {
    if (cmp.heavier === "balanced") return "Balanced: both sides are " + E.fmtValue(cmp.left, style);
    return (cmp.heavier === "left" ? "Left" : "Right") + " side is heavier by " + E.fmtValue(cmp.diff, style);
  }

  /* ---------- the model on the pans (spec v3): k boxes per x-term and one net constant ---------- */

  /* A side as the balance draws it: x-term groups in written order and the net constant. */
  function sideModel(terms) {
    var groups = [], c = 0, constFirst = false;
    terms.forEach(function (t, i) {
      if (t.kind === "x") groups.push(t.coef);
      else { c += t.value; if (i === 0) constFirst = true; }
    });
    return { groups: groups, c: c, constFirst: constFirst };
  }
  function modelFromEquation(eq) { return { left: sideModel(eq.left), right: sideModel(eq.right) }; }
  function emptyModel() { return { left: { groups: [0], c: 0, constFirst: false }, right: { groups: [0], c: 0, constFirst: false } }; }
  function xCount(side) { return side.groups.reduce(function (a, k) { return a + k; }, 0); }
  function modelSideValue(side, x) { return E.fAdd(E.fMul(E.frac(xCount(side)), x), E.frac(side.c)); }
  function compareModel(model, x) {
    var l = modelSideValue(model.left, x), r = modelSideValue(model.right, x), c = E.fCmp(l, r);
    return { left: l, right: r, heavier: c > 0 ? "left" : c < 0 ? "right" : "balanced",
      diff: E.fAbs(E.fSub(l, r)), signedDiff: E.fSub(l, r) };
  }
  /* Does a built side match the equation's side (same number of x's, same net number)? */
  function sideMatches(terms, side) {
    var m = sideModel(terms);
    return xCount(m) === xCount(side) && m.c === side.c;
  }

  /* A, B, C, D of Ax + B = Cx + D (never shown to students). */
  function abcd(eq) {
    var m = modelFromEquation(eq);
    return { A: xCount(m.left), B: m.left.c, C: xCount(m.right), D: m.right.c };
  }

  BON.model = {
    abcd: abcd, sideModel: sideModel, modelFromEquation: modelFromEquation, emptyModel: emptyModel, xCount: xCount,
    modelSideValue: modelSideValue, compareModel: compareModel, sideMatches: sideMatches,
    sideValue: sideValue, compare: compare,
    sidePieces: sidePieces, sideText: sideText, equationText: equationText,
    substitutionLine: substitutionLine, resultText: resultText
  };
})(typeof window !== "undefined" ? window : globalThis);
