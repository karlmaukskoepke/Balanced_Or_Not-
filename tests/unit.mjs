// Unit tests (spec v3): data, exact arithmetic, the model, build checking, sizes, layout and tilt.
// Run: node tests/unit.mjs
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
const EQ = (id) => BON.EQUATIONS.find((q) => q.id === id);
const plain = (v) => JSON.parse(JSON.stringify(v));
const MINUS = "−";
const X = (h) => E.frac(h, 100);
const cmp = (q, x) => M.compareModel(M.modelFromEquation(q), x);
const hundredths = (q) => { const o = []; for (let h = q.sliderRange[0] * 100; h <= q.sliderRange[1] * 100; h++) o.push(h); return o; };

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.log("  FAIL " + name + "\n       " + e.message); process.exitCode = 1; }
}

console.log("Data");
test("12 equations, display strings match the paper", () => {
  assert.deepEqual(plain(BON.EQUATIONS.map((q) => M.equationText(q))), ["2x + 3 = x + 7", "3x + 2 = x − 4", "x + 5 = 4x + 1",
    "2x + 3 = 2x + 8", "4x + 2 = 4x − 6", "3x − 5 = 3x − 5", "5 + x + x = 2x + 5", "5x + 2 = 5x + 3", "3x + 4 = 4",
    "2x + 3 + x = 3x + 3", "3x − 6 + x = 4x + 1", "5x − 2 = 2x + 10"]);
});
test("parts, built flags (1-4 built by the student) and the −6..6 range", () => {
  assert.deepEqual(plain(BON.EQUATIONS.map((q) => q.part)), [1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3]);
  assert.deepEqual(plain(BON.EQUATIONS.map((q) => q.built)), [true, true, true, true, false, false, false, false, false, false, false, false]);
  for (const q of BON.EQUATIONS) assert.deepEqual(plain(q.sliderRange), [-6, 6]);
});
test("stored categories and solutions agree with the algebra; solutions strictly inside the range", () => {
  for (const q of BON.EQUATIONS) {
    const k = G.abcd(q), cat = k.A !== k.C ? "one" : k.B === k.D ? "always" : "never";
    assert.equal(q.category, cat, "equation " + q.id);
    if (cat === "one") {
      assert.ok(E.fEq(E.frac(k.D - k.B, k.A - k.C), q.solution));
      assert.ok(F.inRange(q, q.solution) && !E.fEq(q.solution, E.frac(-6)) && !E.fEq(q.solution, E.frac(6)));
    }
  }
});

console.log("Model on the pans");
test("one net constant per side; split x-terms stay separate groups", () => {
  assert.deepEqual(plain(M.sideModel(EQ(7).left)), { groups: [1, 1], c: 5, constFirst: true });
  assert.deepEqual(plain(M.sideModel(EQ(11).left)), { groups: [3, 1], c: -6, constFirst: false });
  assert.deepEqual(plain(M.sideModel(EQ(9).right)), { groups: [], c: 4, constFirst: true });
});
test("building: a correct model is accepted, a wrong one names the side but not the answer", () => {
  const q = EQ(1), ok = { left: { groups: [2], c: 3 }, right: { groups: [1], c: 7 } };
  assert.ok(F.checkBuild(q, ok).ok);
  const r = F.checkBuild(q, { left: { groups: [2], c: 3 }, right: { groups: [1], c: -1 } });
  assert.equal(r.ok, false); assert.equal(r.wrong, "right"); assert.equal(r.message, "Look at the right side again.");
  assert.ok(!/7|x/.test(r.message), "no answer in the message");
  assert.equal(F.checkBuild(q, { left: { groups: [1], c: 3 }, right: { groups: [0], c: 7 } }).wrong, "both");
  assert.ok(F.checkBuild(EQ(2), { left: { groups: [3], c: 2 }, right: { groups: [1], c: -4 } }).ok);
});

console.log("Exact arithmetic");
test("typed values: integers, decimals, fractions; range message", () => {
  assert.ok(F.readX(EQ(3), "4/3").ok && E.fEq(F.readX(EQ(3), "4/3").value, E.frac(4, 3)));
  assert.ok(F.readX(EQ(1), "-1/2").ok && F.readX(EQ(1), "0.5").ok && F.readX(EQ(1), "-6").ok);
  assert.equal(F.readX(EQ(1), "7").message, `Try a value between ${MINUS}6 and 6.`);
  assert.equal(F.readX(EQ(1), "-").message, "Keep typing: that isn't a number yet.");
});
test("no float artifacts at any slider position", () => {
  for (const q of BON.EQUATIONS) for (const h of hundredths(q)) {
    const c = cmp(q, X(h)), t = E.fmtValue(c.left) + " " + E.fmtValue(c.right);
    assert.ok(!/\d\.\d{3,}|e[+-]?\d|NaN/.test(t), t);
  }
  assert.equal(E.fmtValue(E.fAdd(X(10), X(20))), "0.3");
});

console.log("Section 13 (numbers)");
test("#3 flipped: left heavier at 0, right at 3; 1.33 and 1.34 not balanced; 4/3 balances exactly", () => {
  assert.equal(cmp(EQ(3), E.frac(0)).heavier, "left");
  assert.equal(cmp(EQ(3), E.frac(3)).heavier, "right");
  for (const h of hundredths(EQ(3))) assert.notEqual(cmp(EQ(3), X(h)).heavier, "balanced");
  assert.equal(cmp(EQ(3), E.frac(4, 3)).heavier, "balanced");
});
test("#9 at 0: both totals 4, balanced", () => {
  const c = cmp(EQ(9), E.frac(0));
  assert.equal(E.fmtValue(c.left), "4"); assert.equal(E.fmtValue(c.right), "4"); assert.equal(c.heavier, "balanced");
});
test("#2 at −3: both −7; x-balloons on the left, a −4 balloon and an x-balloon on the right", () => {
  const c = cmp(EQ(2), E.frac(-3));
  assert.equal(E.fmtValue(c.left), MINUS + "7"); assert.equal(c.heavier, "balanced");
  const m = M.modelFromEquation(EQ(2));
  const L = G.layoutSide(m.left, E.frac(-3), "int", "left"), R = G.layoutSide(m.right, E.frac(-3), "int", "right");
  assert.deepEqual(plain(L.floats.map((p) => p.shape)), ["x-balloon", "x-balloon", "x-balloon"]);
  assert.deepEqual(plain(L.weights.map((p) => p.shape + p.label)), ["ball+2"]);
  assert.deepEqual(plain(R.floats.map((p) => p.shape + p.label).sort()), ["balloon" + MINUS + "4", "x-balloon" + MINUS + "3"].sort());
});
test("#4, #5, #8, #11 never balance and hold one tilt; #6, #7, #10 always balance", () => {
  for (const id of [4, 5, 8, 11]) {
    const tilts = new Set();
    for (const h of hundredths(EQ(id))) {
      const c = cmp(EQ(id), X(h));
      assert.notEqual(c.heavier, "balanced", "equation " + id);
      tilts.add(G.tiltFor(EQ(id), c.signedDiff).toFixed(6));
    }
    assert.equal(tilts.size, 1, "constant tilt, equation " + id);
  }
  for (const id of [6, 7, 10]) for (const h of hundredths(EQ(id))) assert.equal(cmp(EQ(id), X(h)).heavier, "balanced");
});
test("tilt per equation: the end of the range reaches the cap; any nonzero difference shows the floor", () => {
  for (const q of BON.EQUATIONS.filter((q) => q.category === "one")) {
    const ends = q.sliderRange.map((v) => Math.abs(G.tiltFor(q, cmp(q, E.frac(v)).signedDiff)));
    assert.ok(Math.abs(Math.max(...ends) - G.MAX_TILT) < 1e-9, "equation " + q.id);
  }
  assert.ok(Math.abs(G.tiltFor(EQ(3), cmp(EQ(3), X(133)).signedDiff)) >= G.MIN_TILT);
});

console.log("Sizes and layout");
test("one size rule: s(v) = S1·sqrt|v| with a floor; a ball of v matches a box of v", () => {
  assert.equal(G.sizeOf(4), 2 * G.S1);
  assert.equal(G.sizeOf(0), G.FLOOR);
  const m = { groups: [1], c: 4, constFirst: false };
  const lay = G.layoutSide(m, E.frac(4), "int", "left");
  assert.equal(lay.weights[0].size, lay.weights[1].size, "box of 4 and ball of 4 are the same size");
  const nb = G.layoutSide({ groups: [1], c: -4 }, E.frac(-4), "int", "left");
  assert.equal(nb.floats[0].size, G.sizeOf(4));
});
test("five boxes at |x| = 6 plus a ball fit on one pan at true size (one row)", () => {
  for (const c of [2, 3, 10]) {
    const lay = G.layoutSide({ groups: [5], c, constFirst: false }, E.frac(6), "int", "left");
    const ys = new Set(lay.weights.map((p) => p.cy + p.size / 2));
    if (c <= 3) assert.equal(ys.size, 1, "one row with a ball of " + c); // the largest in the 12 equations: 5x + 3

    for (const p of lay.weights) assert.ok(Math.abs(p.cx) + p.size / 2 <= G.PAN_HALF, "inside the pan");
    assert.ok(lay.weights.filter((p) => p.shape === "box").every((p) => p.size === G.sizeOf(6)), "true size");
  }
});
test("balloons rise straight up and never leave the top of the drawing, at the extreme values", () => {
  const raised = G.PIVOT.y + G.HANG - G.BEAM_HALF * Math.sin(G.MAX_TILT * Math.PI / 180); // highest a pan can be
  for (const q of BON.EQUATIONS) for (const v of [-6, -3, -1, 6]) for (const s of ["left", "right"]) {
    const lay = G.layoutSide(M.modelFromEquation(q)[s], E.frac(v), "int", s);
    for (const p of lay.floats) {
      assert.ok(Math.abs(p.cx) <= G.PAN_HALF, "tethered on the rim");
      assert.ok(raised + p.cy - p.size / 2 >= 0, `eq ${q.id} x ${v} ${s}: balloon top inside the drawing`);
      assert.ok(p.cy + p.size / 2 < -lay.weightTop, "above the weights");
    }
  }
});

console.log(`\n${passed} passed` + (process.exitCode ? ", some FAILED" : ""));
