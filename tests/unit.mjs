// Unit tests for the data, the exact arithmetic and the balance layout. Run: node tests/unit.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ["exact", "equations", "model", "flow", "balance"]) {
  vm.runInContext(readFileSync(new URL(`../js/${f}.js`, import.meta.url), "utf8"), ctx, { filename: f });
}
const { BON } = ctx;
const E = BON.exact, M = BON.model, G = BON.balanceGeometry, F = BON.flow;
const X = (h) => E.frac(h, 100);                 // slider position in hundredths -> exact x
const cmpH = (q, h) => M.compare(q, X(h));
const EQ = (id) => BON.EQUATIONS.find((q) => q.id === id);
const plain = (v) => JSON.parse(JSON.stringify(v)); // values from the script realm
const MINUS = "−";

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.log("  FAIL " + name + "\n       " + e.message); process.exitCode = 1; }
}
const allSliderH = (q) => {
  const out = [];
  for (let h = q.sliderRange[0] * 100; h <= q.sliderRange[1] * 100; h++) out.push(h);
  return out;
};

console.log("Data");
test("12 equations, numbered 1-12, parts as in the table", () => {
  assert.deepEqual(plain(BON.EQUATIONS).map((q) => q.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(plain(BON.EQUATIONS).map((q) => q.part), [1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3]);
});
test("display strings match the paper sheet", () => {
  const paper = ["2x + 3 = x + 7", "3x + 2 = x − 4", "x + 5 = 4x + 1", "2x + 3 = 2x + 8", "4x + 2 = 4x − 6",
    "3x − 5 = 3x − 5", "5 + x + x = 2x + 5", "5x + 2 = 5x + 3", "3x + 4 = 4", "2x + 3 + x = 3x + 3",
    "3x − 6 + x = 4x + 1", "5x − 2 = 2x + 10"];
  assert.deepEqual(plain(BON.EQUATIONS.map((q) => M.equationText(q))), paper);
});
test("x coefficients are never negative", () => {
  for (const q of BON.EQUATIONS) for (const t of [...q.left, ...q.right]) if (t.kind === "x") assert.ok(t.coef > 0);
});
test("stored categories agree with the algebra (a check on the data, not used by the page)", () => {
  for (const q of BON.EQUATIONS) {
    const A = q.left.filter((t) => t.kind === "x").reduce((s, t) => s + t.coef, 0);
    const C = q.right.filter((t) => t.kind === "x").reduce((s, t) => s + t.coef, 0);
    const B = q.left.filter((t) => t.kind === "const").reduce((s, t) => s + t.value, 0);
    const D = q.right.filter((t) => t.kind === "const").reduce((s, t) => s + t.value, 0);
    const cat = A !== C ? "one" : B === D ? "always" : "never";
    assert.equal(q.category, cat, "equation " + q.id);
    if (cat === "one") {
      const sol = E.frac(D - B, A - C);
      assert.ok(E.fEq(sol, q.solution), "solution of " + q.id);
      assert.ok(E.fCmp(sol, E.frac(q.sliderRange[0])) > 0 && E.fCmp(sol, E.frac(q.sliderRange[1])) < 0,
        "solution strictly inside the slider range, equation " + q.id);
    } else assert.equal(q.solution, null);
  }
});

console.log("Exact arithmetic");
test("typed decimals become exact hundredths", () => {
  const cases = { "4": 400, "-3": -300, "−3": -300, "1.33": 133, "1.3": 130, ".25": 25, "-0.05": -5, "+2": 200,
    "1.335": 134, "-1.335": -134, "1.334": 133, " 7 ": 700, "0": 0, "-0": 0 };
  for (const [s, h] of Object.entries(cases)) assert.equal(E.parseDecimalToHundredths(s), h, s);
  for (const s of ["", "-", "abc", "1.2.3", "4/3", "1e2"]) assert.equal(E.parseDecimalToHundredths(s), null, s);
});
test("0.1 + 0.2 shows 0.3 (no float artifacts)", () => {
  assert.equal(E.fmtH(E.parseDecimalToHundredths("0.1") + E.parseDecimalToHundredths("0.2")), "0.3");
  // every slider position on every equation: readouts are short exact decimals
  for (const q of BON.EQUATIONS) for (const h of allSliderH(q)) {
    const t = M.substitutionLine(q.left, X(h), "decimal") + " | " + M.substitutionLine(q.right, X(h), "decimal");
    assert.ok(!/\d\.\d{3,}|e[+-]?\d|NaN|Infinity/.test(t), t);
  }
});
test("hundredths formatting", () => {
  assert.equal(E.fmtH(133), "1.33"); assert.equal(E.fmtH(-130), MINUS + "1.3");
  assert.equal(E.fmtH(-5), MINUS + "0.05"); assert.equal(E.fmtH(0), "0"); assert.equal(E.fmtH(-700), MINUS + "7");
});
test("fractions stay exact", () => {
  assert.ok(E.fEq(E.frac(8, 6), E.frac(4, 3)));
  assert.equal(E.fmtFrac(E.frac(-8, 6)), MINUS + "4/3");
  assert.ok(E.fEq(E.fAdd(E.frac(1, 10), E.frac(2, 10)), E.frac(3, 10)));
});

console.log("Spec section 13 (numbers)");
test("#3 (flipped x + 5 = 4x + 1): left heavier at 0, right heavier at 3", () => {
  assert.equal(cmpH(EQ(3), 0).heavier, "left");
  assert.equal(cmpH(EQ(3), 300).heavier, "right");
  assert.equal(cmpH(EQ(1), 0).heavier, "right", "the opposite of #1 for a low guess");
});
test("#3 near 1.33/1.34: never balanced, difference 0.01 at 1.33 (0.02 at 1.34), tilt at least the floor", () => {
  const q = EQ(3);
  const a = cmpH(q, 133), b = cmpH(q, 134);
  assert.equal(a.heavier, "left"); assert.equal(b.heavier, "right");
  assert.equal(E.fmtValue(a.diff), "0.01"); assert.equal(E.fmtValue(b.diff), "0.02");
  assert.ok(Math.abs(G.tiltFor(q, a.signedDiff)) >= G.MIN_TILT);
  assert.ok(G.tiltFor(q, a.signedDiff) < 0, "left side down at 1.33 (flipped)");
  assert.ok(G.tiltFor(q, b.signedDiff) > 0, "right side down at 1.34 (flipped)");
  for (const h of allSliderH(q)) assert.notEqual(cmpH(q, h).heavier, "balanced");
});
test("#9 at x = 0: balanced at 4 and 4; boxes are zero-boxes", () => {
  const c = cmpH(EQ(9), 0);
  assert.equal(c.heavier, "balanced"); assert.equal(E.fmtValue(c.left), "4"); assert.equal(E.fmtValue(c.right), "4");
  const lay = G.layout(EQ(9), X(0));
  const shapes = plain(lay.left.items).map((i) => i.shape + ":" + i.label);
  assert.deepEqual(shapes, ["zero-box:0", "zero-box:0", "zero-box:0", "weight:+4"]);
  assert.deepEqual(plain(lay.right.items).map((i) => i.shape + ":" + i.label), ["weight:+4"]);
  lay.left.items.filter((i) => i.shape === "zero-box").forEach((i) => assert.equal(i.w, G.FLOOR_SIDE));
});
test("#2 at x = −3: both sides −7; left 3 floating boxes −3 + a +2 weight; right a floating box and a −4 balloon", () => {
  const c = cmpH(EQ(2), -300);
  assert.equal(E.fmtValue(c.left), MINUS + "7"); assert.equal(E.fmtValue(c.right), MINUS + "7"); assert.equal(c.heavier, "balanced");
  const lay = G.layout(EQ(2), X(-300));
  assert.deepEqual(plain(lay.left.items).map((i) => i.shape + ":" + i.label),
    ["float-box:" + MINUS + "3", "float-box:" + MINUS + "3", "float-box:" + MINUS + "3", "weight:+2"]);
  assert.deepEqual(plain(lay.right.items).map((i) => i.shape + ":" + i.label),
    ["float-box:" + MINUS + "3", "balloon:" + MINUS + "4"]);
  assert.equal(G.tiltFor(EQ(2), c.signedDiff), 0);
});
test("#2 left side at any negative x: three floating boxes with the same label", () => {
  for (const h of [-1, -50, -300, -1000]) {
    const boxes = G.layout(EQ(2), X(h)).left.items.filter((i) => i.shape === "float-box");
    assert.equal(boxes.length, 3);
    assert.ok(boxes.every((b) => b.label === E.fmtValue(X(h))));
  }
});
test("#5 and #8 never level at any slider position", () => {
  for (const id of [5, 8]) for (const h of allSliderH(EQ(id))) {
    const c = cmpH(EQ(id), h);
    assert.notEqual(c.heavier, "balanced");
    assert.ok(Math.abs(G.tiltFor(EQ(id), c.signedDiff)) >= G.MIN_TILT);
  }
});
test("#6, #7, #10 level at every slider position", () => {
  for (const id of [6, 7, 10]) for (const h of allSliderH(EQ(id))) assert.equal(cmpH(EQ(id), h).heavier, "balanced");
});
test("tilt per equation: the largest difference on the slider reaches the cap; closer guesses are flatter", () => {
  for (const q of BON.EQUATIONS) {
    const ends = q.sliderRange.map((v) => Math.abs(G.tiltFor(q, M.compare(q, E.frac(v)).signedDiff)));
    if (q.category === "one") {
      assert.ok(Math.abs(Math.max(...ends) - G.MAX_TILT) < 1e-9, "cap reached at an end, equation " + q.id);
      const sol = q.solution.n / q.solution.d;
      let prev = 0;
      for (let k = 1; k <= 5; k++) {         // moving away from the solution never makes the beam flatter
        const t = Math.abs(G.tiltFor(q, M.compare(q, E.frac(Math.round((sol + k) * 100), 100)).signedDiff));
        assert.ok(t >= prev, "equation " + q.id); prev = t;
      }
    }
    if (q.category === "never") for (const h of allSliderH(q).filter((h) => h % 50 === 0))
      assert.ok(Math.abs(Math.abs(G.tiltFor(q, cmpH(q, h).signedDiff)) - G.MAX_TILT * G.NEVER_SHARE) < 1e-9, "never: constant 60% tilt");
  }
  assert.equal(G.tiltFor(EQ(1), E.frac(0)), 0);
});

console.log("Readout");
test("one-line substitution per side, negatives in parentheses", () => {
  const L = (id, side, x, st) => M.substitutionLine(EQ(id)[side], x, st);
  assert.equal(L(2, "left", E.frac(5)), "3(5) + 2 = 17");
  assert.equal(L(2, "left", E.frac(-2)), `3(${MINUS}2) + 2 = ${MINUS}4`);
  assert.equal(L(7, "left", E.frac(-2)), `5 + (${MINUS}2) + (${MINUS}2) = 1`);
  assert.equal(L(9, "right", E.frac(0)), "4");
  assert.equal(L(11, "left", E.frac(2)), `3(2) ${MINUS} 6 + 2 = 2`);
  assert.equal(L(1, "right", X(133), "decimal"), "1.33 + 7 = 8.33");
  assert.equal(L(1, "left", E.frac(-1, 2), "fraction"), `2(${MINUS}1/2) + 3 = 2`);
  assert.equal(L(1, "right", E.frac(-1, 2), "fraction"), `(${MINUS}1/2) + 7 = 13/2`);
});

console.log("Typed numbers");
test("integers, decimals and fractions; '-' alone is 'not yet'", () => {
  const v = (s) => { const p = E.parseNumber(s); return p.ok ? E.fmtFrac(p.value) : p.partial ? "partial" : "bad"; };
  assert.equal(v("4"), "4"); assert.equal(v("-3"), MINUS + "3"); assert.equal(v("\u22123"), MINUS + "3");
  assert.equal(v("-1/2"), MINUS + "1/2"); assert.equal(v("8/6"), "4/3"); assert.equal(v("1.25"), "5/4"); assert.equal(v(".5"), "1/2");
  for (const s of ["", "-", "1/", "2.", "."]) assert.equal(v(s), "partial", s);
  for (const s of ["abc", "1.2.3", "x", "--1", "1/2/3"]) assert.equal(v(s), "bad", s);
  assert.ok(E.parseNumber("3/0").zeroDen);
});
test("values are shown the way they were typed", () => {
  assert.equal(E.fmtValue(E.frac(13, 2), "fraction"), "13/2");
  assert.equal(E.fmtValue(E.frac(13, 2), "decimal"), "6.5");
  assert.equal(E.fmtValue(E.frac(4, 3), "decimal"), "4/3");
  assert.equal(E.fmtValue(E.frac(-1, 100)), MINUS + "0.01");
});

console.log("Guesses");
test("seeds: #1 1 and 7, #2 −5 and 1, #3 0 and 3; none from #4 on; each pair brackets the solution", () => {
  const want = { 1: "1,7", 2: `${MINUS}5,1`, 3: "0,3" };
  for (const q of BON.EQUATIONS) {
    const seeds = F.seedsFor(q).map((f) => E.fmtFrac(f)).join(",");
    assert.equal(seeds, want[q.id] || "", "equation " + q.id);
    if (want[q.id]) {
      const [a, b] = F.seedsFor(q).map((x) => M.compare(q, x).heavier);
      assert.ok(a !== b && a !== "balanced" && b !== "balanced", "seeds land on opposite sides, equation " + q.id);
    }
  }
});
test("reading a typed guess: range, duplicates, unfinished input", () => {
  const q = EQ(1), g = [{ x: E.frac(4) }];
  assert.ok(F.readGuess(q, g, "-1/2").ok);
  assert.equal(F.readGuess(q, g, "4").message, "You already tried that one.");
  assert.equal(F.readGuess(q, g, "8/2").message, "You already tried that one.");
  assert.equal(F.readGuess(q, g, "11").message, `Try a value between ${MINUS}10 and 10.`);
  assert.equal(F.readGuess(q, g, "-10.01").message, `Try a value between ${MINUS}10 and 10.`);
  assert.ok(F.readGuess(q, g, "-10").ok && F.readGuess(q, g, "10").ok, "the ends are allowed");
  assert.equal(F.readGuess(q, g, "-").message, "Keep typing: that isn't a number yet.");
  assert.ok(!F.readGuess(q, g, "abc").ok);
});
test("duplicate guesses are caught exactly (2 = 2.0 = 4/2)", () => {
  const g = [{ x: E.frac(2) }];
  assert.ok(F.isDuplicate(g, E.parseNumber("2.0").value));
  assert.ok(F.isDuplicate(g, E.parseNumber("4/2").value));
  assert.ok(!F.isDuplicate(g, E.parseNumber("2.01").value));
});

console.log("Sorting and the solve entry");
test("sorting accepts only the right column", () => {
  for (const q of BON.EQUATIONS) for (const c of ["one", "always", "never"]) assert.equal(F.checkSort(q, c), q.category === c);
});
test("solve entry: x = 4, 4 = x, 5 = 5, 10 = 10, 3 = 8, 4/3, 8/6, 1.33, wrong values", () => {
  const S = (id, a, b) => F.checkSolve(EQ(id), a, b).status;
  assert.equal(S(1, "x", "4"), "agree"); assert.equal(S(1, "4", "x"), "agree"); assert.equal(S(12, "x", "4.0"), "agree");
  assert.equal(S(1, "x", "5"), "disagree");
  assert.equal(S(6, "5", "5"), "agree"); assert.equal(S(7, "10", "10"), "agree"); assert.equal(S(1, "5", "5"), "disagree");
  assert.equal(S(4, "3", "8"), "agree"); assert.equal(S(5, "0", "8"), "agree"); assert.equal(S(6, "3", "8"), "disagree");
  assert.equal(S(3, "x", "4/3"), "agree"); assert.equal(S(3, "8/6", "x"), "agree");
  assert.equal(S(3, "x", "1.33"), "rounded"); assert.equal(S(3, "x", "1.3"), "rounded"); assert.equal(S(3, "x", "1.333"), "rounded");
  assert.equal(S(3, "x", "1"), "disagree"); assert.equal(S(9, "x", "0"), "agree"); assert.equal(S(2, "-3", "x"), "agree");
  assert.equal(S(1, "x", ""), "incomplete"); assert.equal(S(1, "x", "x"), "invalid"); assert.equal(S(1, "y", "4"), "invalid");
  const msg = F.checkSolve(EQ(3), "x", "1.33").message;
  assert.ok(msg.includes("5/4") && !msg.includes("4/3"), "rounded hint uses an example that is not the answer");
});
test("no feedback text states the rule or names A or C", () => {
  const all = JSON.stringify(F.TEXT) + F.checkSolve(EQ(4), "x", "1").message;
  assert.ok(!/\bA\b|\bC\b/.test(all) && !/coefficient|same number of x|plain numbers/i.test(all));
});

console.log("Layout");
test("pieces never pass the top of their band (so never reach the beam) for every equation and x", () => {
  for (const q of BON.EQUATIONS) for (const h of [-1000, -999, -300, -1, 0, 1, 133, 400, 800, 1000, 9999, -9999]) {
    const lay = G.layout(q, X(h));
    for (const s of ["left", "right"]) for (const it of lay[s].items) {
      const top = it.y - it.h / 2;
      if (it.band === "weight") assert.ok(top >= -G.WEIGHT_BAND.h - 0.01, `eq ${q.id} x ${h}: weight too tall`);
      else {
        const Z = G.FLOAT_ZONE, out = s === "left" ? -1 : 1;
        assert.ok(top >= Z.top - 0.01 && it.y + it.h / 2 <= Z.top + Z.h + 0.01, `eq ${q.id} x ${h}: floater outside its zone (height)`);
        assert.ok(out * it.x - it.w / 2 >= Z.inner - 0.01 && out * it.x + it.w / 2 <= Z.inner + Z.w + 0.01,
          `eq ${q.id} x ${h}: floater outside its zone (beside the pan's outer edge)`);
      }
      if (it.band === "weight") assert.ok(Math.abs(it.x) + it.w / 2 <= G.WEIGHT_BAND.w / 2 + 6, `eq ${q.id} x ${h}: too wide for the pan`);
    }
  }
});
test("5 boxes at x = 8 fit without overlapping each other", () => {
  const items = G.layout(EQ(8), X(800)).left.items;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    const overlap = Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 0.01 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - 0.01;
    assert.ok(!overlap, "pieces overlap");
  }
});

console.log(`\n${passed} passed` + (process.exitCode ? ", some FAILED" : ""));
