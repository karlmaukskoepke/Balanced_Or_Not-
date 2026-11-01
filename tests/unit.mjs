// Unit tests for the data, the exact arithmetic and the balance layout. Run: node tests/unit.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ["exact", "equations", "model", "balance"]) {
  vm.runInContext(readFileSync(new URL(`../js/${f}.js`, import.meta.url), "utf8"), ctx, { filename: f });
}
const { BON } = ctx;
const E = BON.exact, M = BON.model, G = BON.balanceGeometry;
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
  const paper = ["2x + 3 = x + 7", "3x + 2 = x − 4", "4x + 1 = x + 5", "2x + 3 = 2x + 8", "4x + 2 = 4x − 6",
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
    const t = M.substitutionText(q.left, h) + " | " + M.substitutionText(q.right, h);
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
test("#3 near 1.33/1.34: never balanced, difference 0.01 at 1.33 (0.02 at 1.34), tilt at least the floor", () => {
  const q = EQ(3);
  const a = M.compare(q, 133), b = M.compare(q, 134);
  assert.equal(a.heavier, "right"); assert.equal(b.heavier, "left");
  assert.equal(E.fmtH(a.diffH), "0.01"); assert.equal(E.fmtH(b.diffH), "0.02");
  assert.ok(Math.abs(G.tiltFor(a.leftH - a.rightH)) >= G.MIN_TILT);
  assert.ok(G.tiltFor(a.leftH - a.rightH) > 0, "right side down at 1.33");
  assert.ok(G.tiltFor(b.leftH - b.rightH) < 0, "left side down at 1.34");
  for (const h of allSliderH(q)) assert.notEqual(M.compare(q, h).heavier, "balanced");
});
test("#9 at x = 0: balanced at 4 and 4; boxes are zero-boxes", () => {
  const c = M.compare(EQ(9), 0);
  assert.equal(c.heavier, "balanced"); assert.equal(c.leftH, 400); assert.equal(c.rightH, 400);
  const lay = G.layout(EQ(9), 0);
  const shapes = plain(lay.left.items).map((i) => i.shape + ":" + i.label);
  assert.deepEqual(shapes, ["zero-box:0", "zero-box:0", "zero-box:0", "weight:+4"]);
  assert.deepEqual(plain(lay.right.items).map((i) => i.shape + ":" + i.label), ["weight:+4"]);
  lay.left.items.filter((i) => i.shape === "zero-box").forEach((i) => assert.equal(i.w, G.FLOOR_SIDE));
});
test("#2 at x = −3: both sides −7; left 3 floating boxes −3 + a +2 weight; right a floating box and a −4 balloon", () => {
  const c = M.compare(EQ(2), -300);
  assert.equal(c.leftH, -700); assert.equal(c.rightH, -700); assert.equal(c.heavier, "balanced");
  const lay = G.layout(EQ(2), -300);
  assert.deepEqual(plain(lay.left.items).map((i) => i.shape + ":" + i.label),
    ["float-box:" + MINUS + "3", "float-box:" + MINUS + "3", "float-box:" + MINUS + "3", "weight:+2"]);
  assert.deepEqual(plain(lay.right.items).map((i) => i.shape + ":" + i.label),
    ["float-box:" + MINUS + "3", "balloon:" + MINUS + "4"]);
  assert.equal(G.tiltFor(c.leftH - c.rightH), 0);
});
test("#2 left side at any negative x: three floating boxes with the same label", () => {
  for (const h of [-1, -50, -300, -1000]) {
    const boxes = G.layout(EQ(2), h).left.items.filter((i) => i.shape === "float-box");
    assert.equal(boxes.length, 3);
    assert.ok(boxes.every((b) => b.label === E.fmtH(h)));
  }
});
test("#5 and #8 never level at any slider position", () => {
  for (const id of [5, 8]) for (const h of allSliderH(EQ(id))) {
    const c = M.compare(EQ(id), h);
    assert.notEqual(c.heavier, "balanced");
    assert.ok(Math.abs(G.tiltFor(c.leftH - c.rightH)) >= G.MIN_TILT);
  }
});
test("#6, #7, #10 level at every slider position", () => {
  for (const id of [6, 7, 10]) for (const h of allSliderH(EQ(id))) assert.equal(M.compare(EQ(id), h).heavier, "balanced");
});
test("tilt is capped and grows with the difference", () => {
  assert.equal(G.tiltFor(0), 0);
  assert.ok(Math.abs(G.tiltFor(100000)) <= G.MAX_TILT);
  assert.ok(Math.abs(G.tiltFor(100)) < Math.abs(G.tiltFor(800)));
});

console.log("Readout");
test("substitution steps", () => {
  assert.equal(M.substitutionText(EQ(2).left, -200), `3(${MINUS}2) + 2 = ${MINUS}6 + 2 = ${MINUS}4`);
  assert.equal(M.substitutionText(EQ(7).left, -200), `5 + (${MINUS}2) + (${MINUS}2) = 1`);
  assert.equal(M.substitutionText(EQ(9).right, 0), "4");
  assert.equal(M.substitutionText(EQ(11).left, 200), `3(2) ${MINUS} 6 + 2 = 6 ${MINUS} 6 + 2 = 2`);
  assert.equal(M.substitutionText(EQ(10).left, -200), `2(${MINUS}2) + 3 + (${MINUS}2) = ${MINUS}4 + 3 + (${MINUS}2) = ${MINUS}3`);
  assert.equal(M.substitutionText(EQ(1).right, 133), "1.33 + 7 = 8.33");
});

console.log("Layout");
test("pieces never pass the top of their band (so never reach the beam) for every equation and x", () => {
  for (const q of BON.EQUATIONS) for (const h of [-1000, -999, -300, -1, 0, 1, 133, 400, 800, 1000, 9999, -9999]) {
    const lay = G.layout(q, h);
    for (const s of ["left", "right"]) for (const it of lay[s].items) {
      const top = it.y - it.h / 2;
      if (it.band === "weight") assert.ok(top >= -G.WEIGHT_BAND.h - 0.01, `eq ${q.id} x ${h}: weight too tall`);
      else assert.ok(top >= G.FLOAT_BAND.top - 0.01 && it.y + it.h / 2 <= G.FLOAT_BAND.top + G.FLOAT_BAND.h + 0.01,
        `eq ${q.id} x ${h}: floater outside its band`);
      assert.ok(Math.abs(it.x) + it.w / 2 <= G.WEIGHT_BAND.w / 2 + 6, `eq ${q.id} x ${h}: too wide for the pan`);
    }
  }
});
test("5 boxes at x = 8 fit without overlapping each other", () => {
  const items = G.layout(EQ(8), 800).left.items;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    const overlap = Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 0.01 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - 0.01;
    assert.ok(!overlap, "pieces overlap");
  }
});

console.log(`\n${passed} passed` + (process.exitCode ? ", some FAILED" : ""));
