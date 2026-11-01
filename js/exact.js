/*
 * Exact arithmetic for Balanced or Not?
 *
 * No floating-point math is used for any value a student sees.
 * - Values of x on the balance are whole numbers of HUNDREDTHS (x = 1.33 is stored as 133).
 * - Solutions such as 4/3 are exact fractions { n, d } with d > 0, always in lowest terms.
 *
 * Loaded as a plain script: everything hangs off window.BON (or globalThis.BON in tests).
 */
(function (root) {
  "use strict";
  var BON = root.BON || (root.BON = {});

  var MINUS = "−"; // the real minus sign, used in everything shown on screen

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { var t = a % b; a = b; b = t; }
    return a;
  }

  /* ---------- fractions ---------- */

  function frac(n, d) {
    if (d === undefined) d = 1;
    if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) {
      throw new Error("frac needs whole numbers and a nonzero denominator");
    }
    if (d < 0) { n = -n; d = -d; }
    var g = gcd(n, d) || 1;
    n = n / g; if (n === 0) n = 0; // no −0
    return { n: n, d: d / g };
  }
  function fAdd(a, b) { return frac(a.n * b.d + b.n * a.d, a.d * b.d); }
  function fSub(a, b) { return frac(a.n * b.d - b.n * a.d, a.d * b.d); }
  function fMul(a, b) { return frac(a.n * b.n, a.d * b.d); }
  function fDiv(a, b) { return frac(a.n * b.d, a.d * b.n); }
  function fEq(a, b) { return a.n * b.d === b.n * a.d; }
  function fCmp(a, b) { var l = a.n * b.d, r = b.n * a.d; return l < r ? -1 : l > r ? 1 : 0; }
  function fromHundredths(h) { return frac(h, 100); }

  /* True when the fraction can be written exactly with at most 2 decimal places. */
  function isHundredths(f) { return (100 % f.d) === 0; }
  function toHundredths(f) {
    if (!isHundredths(f)) throw new Error("not an exact hundredths value");
    return f.n * (100 / f.d);
  }

  /* ---------- hundredths ---------- */

  /* 133 -> "1.33", -130 -> "−1.3", 400 -> "4", -5 -> "−0.05". */
  function fmtH(h) {
    var neg = h < 0, a = Math.abs(h);
    var whole = (a - (a % 100)) / 100, part = a % 100;
    var s = String(whole);
    if (part !== 0) {
      var p = (part < 10 ? "0" : "") + part;
      if (p.charAt(1) === "0") p = p.charAt(0);
      s += "." + p;
    }
    return (neg ? MINUS : "") + s;
  }
  /* Same, but with an ASCII hyphen (for <input> values, which browsers need in ASCII). */
  function fmtHAscii(h) { return fmtH(h).replace(MINUS, "-"); }

  /* A fraction for display: "4/3", "−3", "1/2". */
  function fmtFrac(f) {
    var sign = f.n < 0 ? MINUS : "";
    var n = Math.abs(f.n);
    return f.d === 1 ? sign + n : sign + n + "/" + f.d;
  }

  /*
   * Read a typed decimal ("1.33", "-2", "−0.5", "+3", ".25") as exact hundredths.
   * Digits past the hundredths place are rounded (half away from zero), using the
   * digits of the string, never floats. Returns null if it is not a number.
   */
  function parseDecimalToHundredths(str) {
    if (typeof str !== "string") return null;
    var s = str.trim().replace(/[−–—]/g, "-").replace(/\s+/g, "");
    var m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(s);
    if (!m) return null;
    var intPart = m[2], decPart = m[3] || "";
    if (intPart === "" && decPart === "") return null;
    if (intPart.length > 6) return null; // keep inside safe whole-number range
    var whole = intPart === "" ? 0 : parseInt(intPart, 10);
    var d2 = (decPart + "00").slice(0, 2);
    var h = whole * 100 + parseInt(d2, 10);
    if (decPart.length > 2 && decPart.charAt(2) >= "5") h += 1;
    if (m[1] === "-") h = -h;
    if (h === 0) h = 0; // no −0
    return h;
  }


  /* ---------- typed numbers (integers, decimals, fractions) ---------- */

  function fSign(f) { return f.n < 0 ? -1 : f.n > 0 ? 1 : 0; }
  function fAbs(f) { return { n: Math.abs(f.n), d: f.d }; }
  function fNeg(f) { return frac(-f.n, f.d); }
  function fIsInt(f) { return f.d === 1; }
  /* For drawing sizes only (never shown as text). */
  function fToFloat(f) { return f.n / f.d; }

  /* Decimal places needed to write f exactly, or -1 if it never ends (like 4/3). */
  function decimalPlaces(f) {
    var d = f.d, a = 0, b = 0;
    while (d % 2 === 0) { d /= 2; a++; }
    while (d % 5 === 0) { d /= 5; b++; }
    return d === 1 ? Math.max(a, b) : -1;
  }

  /*
   * Show a value. style "fraction": a non-whole value is written as a fraction ("−1/2").
   * Otherwise a value that ends is written as a decimal ("1.33"), and one that doesn't as a fraction ("4/3").
   */
  function fmtValue(f, style) {
    var k = decimalPlaces(f);
    if (f.d === 1) return fmtFrac(f);
    if (style === "fraction" || k < 0 || k > 6) return fmtFrac(f);
    var scale = Math.pow(10, k), scaled = Math.abs(f.n) * (scale / f.d);
    var digits = String(scaled);
    while (digits.length <= k) digits = "0" + digits;
    var s = digits.slice(0, digits.length - k) + "." + digits.slice(digits.length - k);
    return (f.n < 0 ? MINUS : "") + s;
  }
  /* ASCII version for <input> values. */
  function fmtValueAscii(f, style) { return fmtValue(f, style).replace(MINUS, "-"); }

  /*
   * Read what a student typed: "4", "-3", "−1.5", ".25", "-1/2", "8/6".
   * Returns { ok: true, value: {n,d}, style: "int"|"decimal"|"fraction", places }
   *      or { ok: false, partial: true }  when it could still become a number ("", "-", "1/", "2.")
   *      or { ok: false }                 when it is not a number.
   */
  function parseNumber(str) {
    if (typeof str !== "string") return { ok: false };
    var s = str.trim().replace(/[−–—]/g, "-").replace(/\s+/g, "");
    if (/^[+-]?$/.test(s) || /^[+-]?\d*\.$/.test(s) && !/\d/.test(s.replace(".", "")) ) return { ok: false, partial: true };
    var m = /^([+-]?)(\d+)\/(\d*)$/.exec(s);
    if (m) {
      if (m[3] === "") return { ok: false, partial: true };
      if (m[2].length > 6 || m[3].length > 4) return { ok: false };
      var den = parseInt(m[3], 10);
      if (den === 0) return { ok: false, zeroDen: true };
      var num = parseInt(m[2], 10) * (m[1] === "-" ? -1 : 1);
      return { ok: true, value: frac(num, den), style: "fraction", places: 0 };
    }
    m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(s);
    if (!m || (m[2] === "" && (m[3] === undefined || m[3] === ""))) return { ok: false };
    if (m[2].length > 6 || (m[3] || "").length > 6) return { ok: false };
    var dec = m[3] || "";
    if (m[3] !== undefined && dec === "") return { ok: false, partial: true }; // "2." not finished
    var n = parseInt((m[2] || "0") + dec, 10) * (m[1] === "-" ? -1 : 1);
    var f = frac(n, Math.pow(10, dec.length));
    return { ok: true, value: f, style: dec.length ? "decimal" : "int", places: dec.length };
  }

  BON.MINUS = MINUS;
  BON.exact = {
    gcd: gcd,
    frac: frac, fAdd: fAdd, fSub: fSub, fMul: fMul, fDiv: fDiv, fEq: fEq, fCmp: fCmp,
    fromHundredths: fromHundredths, isHundredths: isHundredths, toHundredths: toHundredths,
    fmtH: fmtH, fmtHAscii: fmtHAscii, fmtFrac: fmtFrac,
    parseDecimalToHundredths: parseDecimalToHundredths,
    fSign: fSign, fAbs: fAbs, fNeg: fNeg, fIsInt: fIsInt, fToFloat: fToFloat, decimalPlaces: decimalPlaces,
    fmtValue: fmtValue, fmtValueAscii: fmtValueAscii, parseNumber: parseNumber
  };
})(typeof window !== "undefined" ? window : globalThis);
