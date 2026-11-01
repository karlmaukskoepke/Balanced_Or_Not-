/*
 * Side values, comparisons and the words/strings built from an equation.
 * Pure functions (no page access), so they can be tested in Node.
 * x is always whole hundredths (see exact.js).
 */
(function (root) {
  "use strict";
  var BON = root.BON || (root.BON = {});
  var E = BON.exact, MINUS = BON.MINUS;

  /* Value of one side, in hundredths. */
  function sideValueH(terms, xh) {
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      total += t.kind === "x" ? t.coef * xh : t.value * 100;
    }
    return total;
  }

  /* Compare the sides at x. heavier: "left" | "right" | "balanced"; diffH is larger − smaller (≥ 0). */
  function compare(eq, xh) {
    var l = sideValueH(eq.left, xh), r = sideValueH(eq.right, xh);
    return {
      leftH: l, rightH: r,
      heavier: l > r ? "left" : r > l ? "right" : "balanced",
      diffH: Math.abs(l - r)
    };
  }

  /* ---------- the equation as text pieces ---------- */

  /*
   * One side as pieces: [{ text, isX, isOp }]. Used to draw the equation with x-terms in blue.
   * 3x − 6 + x  ->  "3x" (x) " − " (op) "6" " + " (op) "x" (x)
   */
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

  /* ---------- the substitution readout ---------- */

  function paren(h) { return h < 0 ? "(" + E.fmtH(h) + ")" : E.fmtH(h); }

  /*
   * Step-by-step substitution for one side.
   *   3x + 2 at x = −2   ->  "3(−2) + 2 = −6 + 2 = −4"
   *   5 + x + x at −2    ->  "5 + (−2) + (−2) = 1"
   *   4 (a lone number)  ->  "4"
   * Negatives are always in parentheses after the first term; a product step appears
   * only when some x-term has a coefficient of 2 or more.
   */
  function substitutionSteps(terms, xh) {
    var subst = [], products = [], hasProduct = false;
    terms.forEach(function (t, i) {
      if (t.kind === "x") {
        if (t.coef === 1) {
          subst.push({ i: i, s: paren(xh), neg: false });
          products.push({ i: i, s: paren(xh), neg: false });
        } else {
          hasProduct = true;
          subst.push({ i: i, s: t.coef + "(" + E.fmtH(xh) + ")", neg: false });
          var p = t.coef * xh;
          products.push({ i: i, s: i === 0 ? E.fmtH(p) : paren(p), neg: false });
        }
      } else {
        var neg = t.value < 0;
        var s = String(Math.abs(t.value));
        var item = { i: i, s: (i === 0 && neg ? MINUS : "") + s, neg: neg };
        subst.push(item); products.push(item);
      }
    });
    function join(list) {
      return list.map(function (it, k) {
        if (k === 0) return it.s;
        return (it.neg ? " " + MINUS + " " : " + ") + it.s;
      }).join("");
    }
    var total = sideValueH(terms, xh);
    var steps = [join(subst)];
    if (hasProduct) steps.push(join(products));
    var single = terms.length === 1 && !hasProduct;
    if (!single) steps.push(E.fmtH(total));
    return steps;
  }
  function substitutionText(terms, xh) { return substitutionSteps(terms, xh).join(" = "); }

  /* "Left side is heavier by 5" / "Balanced: both sides are −7". */
  function resultText(cmp) {
    if (cmp.heavier === "balanced") return "Balanced: both sides are " + E.fmtH(cmp.leftH);
    var side = cmp.heavier === "left" ? "Left" : "Right";
    return side + " side is heavier by " + E.fmtH(cmp.diffH);
  }

  BON.model = {
    sideValueH: sideValueH, compare: compare,
    sidePieces: sidePieces, sideText: sideText, equationText: equationText,
    substitutionSteps: substitutionSteps, substitutionText: substitutionText,
    resultText: resultText
  };
})(typeof window !== "undefined" ? window : globalThis);
