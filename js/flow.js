/*
 * Checking rules for the per-equation flow (guesses, sorting, the solve entry).
 * Pure functions with no page access, so they can be tested in Node. Wording lives here too,
 * so feedback is consistent and can be reviewed in one place. None of it states the A = C rule.
 */
(function (root) {
  "use strict";
  var BON = root.BON || (root.BON = {});
  var E = BON.exact, M = BON.model, MINUS = BON.MINUS;

  var GUESSES = 5;

  var TEXT = {
    notNumberYet: "Keep typing: that isn't a number yet.",
    notNumber: "Type a number, like 3, −2, 1.5 or −1/2.",
    zeroDen: "The bottom of a fraction can't be 0.",
    duplicate: "You already tried that one.",
    outOfRange: function (lo, hi) { return "Try a value between " + lo + " and " + hi + "."; },
    secondValue: "That balances. Can you find a different value that also balances?",
    checkSlider: "Check the slider again.",
    rounded: "That's a rounded value. Write the exact answer as an improper fraction, like 5/4 or 6/5.",
    disagree: "Your algebra and the slider disagree. Check your solving, and check the slider.",
    agree: "Your algebra agrees with the slider.",
    solveNeedsBoth: "Fill in both sides of your result.",
    solveOneX: "Use x on one side at most, and a number on the other."
  };

  /* The page-supplied first guesses for an equation, as fractions. */
  function seedsFor(eq) {
    return (eq.seeds || []).map(function (n) { return E.frac(n); });
  }

  function isDuplicate(guesses, x) {
    return guesses.some(function (g) { return E.fEq(g.x, x); });
  }


  /* Is x inside the equation's slider range (ends included)? */
  function inRange(eq, x) {
    return E.fCmp(x, E.frac(eq.sliderRange[0])) >= 0 && E.fCmp(x, E.frac(eq.sliderRange[1])) <= 0;
  }

  /*
   * Read a typed guess. Returns { ok: true, value, style } or { ok: false, message }.
   */
  function readGuess(eq, guesses, text) {
    var p = E.parseNumber(text);
    if (!p.ok) {
      return { ok: false, message: p.partial ? (String(text).trim() === "" ? TEXT.notNumber : TEXT.notNumberYet)
        : p.zeroDen ? TEXT.zeroDen : TEXT.notNumber };
    }
    if (!inRange(eq, p.value)) {
      return { ok: false, message: TEXT.outOfRange(E.fmtValue(E.frac(eq.sliderRange[0])), E.fmtValue(E.frac(eq.sliderRange[1]))) };
    }
    if (isDuplicate(guesses, p.value)) return { ok: false, message: TEXT.duplicate };
    return { ok: true, value: p.value, style: p.style };
  }

  /* Sorting: the page only accepts the right column. */
  function checkSort(eq, choice) { return eq.category === choice; }

  /*
   * The solve entry: two fields with "=" between them.
   * Returns { status: "agree"|"disagree"|"rounded"|"incomplete"|"invalid", message, kind, summary }
   *   kind: "value" (x = number), "identity" (5 = 5), "contradiction" (3 = 8)
   */
  function checkSolve(eq, leftText, rightText) {
    function side(t) {
      var s = (t || "").trim().replace(/\s+/g, "");
      if (s === "") return { empty: true };
      if (/^[xX]$/.test(s) || /^1[xX]$/.test(s)) return { isX: true };
      var p = E.parseNumber(s);
      return p.ok ? { num: p } : { bad: true, partial: !!p.partial };
    }
    var a = side(leftText), b = side(rightText);
    if (a.empty || b.empty) return { status: "incomplete", message: TEXT.solveNeedsBoth };
    if (a.bad || b.bad) return { status: "invalid", message: TEXT.notNumber };
    if (a.isX && b.isX) return { status: "invalid", message: TEXT.solveOneX };

    var kind, value, entered;
    if (a.isX || b.isX) {
      var n = a.isX ? b.num : a.num;
      kind = "value"; value = n;
      entered = "x = " + E.fmtValue(n.value, n.style);
    } else {
      var eqv = E.fEq(a.num.value, b.num.value);
      kind = eqv ? "identity" : "contradiction";
      entered = E.fmtValue(a.num.value, a.num.style) + " = " + E.fmtValue(b.num.value, b.num.style);
    }

    var status;
    if (kind === "value") {
      if (eq.category !== "one") status = "disagree";
      else {
        var sol = E.frac(eq.solution.n, eq.solution.d);
        if (E.fEq(value.value, sol)) status = "agree";
        else if (value.style === "decimal" &&
          E.fCmp(E.fAbs(E.fSub(value.value, sol)), E.frac(1, Math.pow(10, value.places))) < 0) status = "rounded";
        else status = "disagree";
      }
    } else if (kind === "identity") status = eq.category === "always" ? "agree" : "disagree";
    else status = eq.category === "never" ? "agree" : "disagree";

    return { status: status, kind: kind, entered: entered,
      message: status === "agree" ? TEXT.agree : status === "rounded" ? TEXT.rounded : TEXT.disagree };
  }

  BON.flow = {
    GUESSES: GUESSES, TEXT: TEXT,
    seedsFor: seedsFor, isDuplicate: isDuplicate, inRange: inRange, readGuess: readGuess, checkSort: checkSort, checkSolve: checkSolve
  };
})(typeof window !== "undefined" ? window : globalThis);
