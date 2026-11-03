/*
 * The pan balance, drawn as layered SVG (spec v3, section 6).
 *
 *   var view = BON.createBalance(svgElement);
 *   view.update({ eq, model, x: {n,d} or null, style, tilt: "live" | "level" });
 *     model: { left: { groups: [2], c: 3, constFirst: false }, right: {...} }  (see BON.model.sideModel)
 *     x null draws plain "x" boxes (no value yet, e.g. during Build).
 *
 * Layers, back to front: stand (base and post) · back layer (back chains, back balloons) · beam (rotates
 * about the pivot) · pans (follow the beam ends, stay level) and the pieces on them · front chains ·
 * front layer (front balloons) · the expression under each pan.
 *
 * One size rule for every piece: s(v) = S1 · sqrt(|v|), never below FLOOR. A box of value v has side s(v);
 * a ball or balloon of value v has diameter s(v). The x-box beside the slider uses the same rule (sizeOf),
 * so on screen it matches the pan boxes exactly. Pans are wide enough for five boxes at |x| = 6 plus a ball.
 *
 * Each side holds k boxes per x-term (in written order, split terms as separate groups) and ONE net constant:
 * a green ball (positive) or a red balloon (negative). Negative x turns every box into a balloon.
 * Balloons rise straight up from the pan rim on a visible string, alternating behind and in front of the
 * balance; a single balloon sits in front. String lengths are capped so no balloon leaves the drawing.
 *
 * Sizes and angles are drawing-only numbers; every value shown as text comes from exact fractions.
 */
(function (root) {
  "use strict";
  var BON = root.BON || (root.BON = {});
  var NS = "http://www.w3.org/2000/svg";

  var VB_W = 900, VB_H = 430;
  var PIVOT = { x: 450, y: 150 };
  var BEAM_HALF = 255, HANG = 120, PAN_HALF = 185;
  var S1 = 24, FLOOR = 30, UNKNOWN_SIDE = 36;
  var GAP_IN_GROUP = 4, GAP_BETWEEN = 10;
  var MAX_TILT = 18, NEVER_SHARE = 0.6, TILT_POWER = 0.6;
  var FOLLOW_MS = 70;
  var TOP_MARGIN = 4;
  var EXPR_DY = 62;

  var C = {
    blue: "#1F5FBF", green: "#1E7A36", red: "#C0262D", ink: "#111111", string: "#4A4A4A", chain: "#8A96A3"
  };

  /* ---------- sizes ---------- */

  /* Side of a box (or diameter of a ball/balloon) for value v, in drawing units. */
  function sizeOf(v) { return Math.max(FLOOR, S1 * Math.sqrt(Math.abs(v))); }
  function fv(f) { return f.n / f.d; }

  /* ---------- tilt (reused from v2: scaled per equation) ---------- */

  function abcd(eq) {
    var o = { A: 0, B: 0, C: 0, D: 0 };
    eq.left.forEach(function (t) { if (t.kind === "x") o.A += t.coef; else o.B += t.value; });
    eq.right.forEach(function (t) { if (t.kind === "x") o.C += t.coef; else o.D += t.value; });
    return o;
  }
  function tiltFor(eq, signedDiff) {
    if (signedDiff.n === 0) return 0;
    var k = abcd(eq), sign = signedDiff.n > 0 ? -1 : 1, t;
    if (k.A === k.C) t = MAX_TILT * NEVER_SHARE;
    else {
      var lo = eq.sliderRange[0], hi = eq.sliderRange[1];
      var f = function (x) { return Math.abs((k.A - k.C) * x + (k.B - k.D)); };
      var maxDiff = Math.max(f(lo), f(hi)) || 1;
      // tilt = cap * (|d| / dmax)^0.6: every change in x changes the tilt; only d = 0 is level (no floor, no clamp
      // below the cap, so the beam keeps responding all the way to the solution)
      t = MAX_TILT * Math.pow(Math.min(1, Math.abs(signedDiff.n / signedDiff.d) / maxDiff), TILT_POWER);
    }
    return sign * t;
  }

  /* ---------- SVG helpers ---------- */

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clear(g) { while (g.firstChild) g.removeChild(g.firstChild); }
  function textWidth(s, size) {
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      w += ch === "." || ch === " " ? 0.3 : ch === "/" ? 0.32 : ch === "+" || ch === BON.MINUS ? 0.6 : 0.58;
    }
    return w * size;
  }
  function fitFont(label, room, pref) {
    var w = textWidth(label, pref);
    return Math.max(10, w > room ? pref * room / w : pref);
  }

  /* ---------- pieces for one side ---------- */

  /*
   * Returns { weights: [...], floats: [...] } with sizes; weights sit on the pan in written order,
   * floats are balloons. Each piece: { shape, label, size, group }.
   */
  function sidePieces(side, x, style) {
    var E = BON.exact, sign = x ? E.fSign(x) : 0;
    var weights = [], floats = [];
    var xLabel = x ? E.fmtValue(x, style) : "x";
    function pushX(group, k) {
      for (var i = 0; i < k; i++) {
        var p = { group: group, order: i, label: xLabel, value: x ? fv(x) : null };
        if (!x) { p.shape = "unknown-box"; p.size = UNKNOWN_SIDE; weights.push(p); }
        else if (sign > 0) { p.shape = "box"; p.size = sizeOf(fv(x)); weights.push(p); }
        else if (sign === 0) { p.shape = "zero-box"; p.size = FLOOR; weights.push(p); }
        else { p.shape = "x-balloon"; p.size = sizeOf(fv(x)); floats.push(p); }
      }
    }
    function pushC(group) {
      if (!side.c) return;
      var p = { group: group, order: 0, value: side.c, label: (side.c > 0 ? "+" : BON.MINUS) + Math.abs(side.c), size: sizeOf(side.c) };
      p.shape = side.c > 0 ? "ball" : "balloon";
      (side.c > 0 ? weights : floats).push(p);
    }
    var g = 0;
    if (side.constFirst) pushC(g++);
    side.groups.forEach(function (k) { pushX(g++, k); });
    if (!side.constFirst) pushC(g++);
    var all = weights.concat(floats).sort(function (a, b) { return a.group - b.group || a.order - b.order; });
    return { weights: weights, floats: floats, all: all };
  }

  /*
   * Place pieces in pan coordinates (0,0 = centre of the pan rim; y grows downward).
   * The x-boxes (or x-balloons) and the net constant form ONE group, in written order, centred on the pan:
   * weights sit on the rim, balloons float straight up from their own spot in the row. Only when that row is
   * too wide for the pan does the constant move to the far side (a balloon above the boxes, a ball on a
   * second row).
   */
  var STRING = 30;
  function rowWidth(list) {
    return list.reduce(function (w, p, i) {
      return w + p.size + (i === 0 ? 0 : (list[i - 1].group === p.group ? GAP_IN_GROUP : GAP_BETWEEN));
    }, 0);
  }
  function maxRiseFor() { return (PIVOT.y + HANG - BEAM_HALF * Math.sin(MAX_TILT * Math.PI / 180)) - TOP_MARGIN; }

  function layoutSide(side, x, style, where) {
    var ps = sidePieces(side, x, style);
    var maxW = 2 * PAN_HALF - 8, out = where === "left" ? -1 : 1;
    var row = ps.all, aside = null;
    if (rowWidth(row) > maxW) {
      aside = row.filter(function (p) { return p.shape === "ball" || p.shape === "balloon"; })[0] || null;
      if (aside) row = row.filter(function (p) { return p !== aside; });
    }
    if (rowWidth(row) > maxW) return layoutCrowded(ps, where); // only with very large free-play values
    var px = -rowWidth(row) / 2, weightTop = 0;
    row.forEach(function (p, i) {
      px += i === 0 ? 0 : (row[i - 1].group === p.group ? GAP_IN_GROUP : GAP_BETWEEN);
      p.cx = px + p.size / 2;
      px += p.size;
      if (p.shape !== "x-balloon" && p.shape !== "balloon") { p.cy = -p.size / 2; weightTop = Math.max(weightTop, p.size); }
    });
    if (aside && aside.shape === "ball") {           // a ball that doesn't fit goes on top, at the far side
      aside.cx = out * (PAN_HALF - 8 - aside.size / 2);
      aside.cy = -weightTop - 4 - aside.size / 2;
    }
    var floats = row.filter(function (p) { return p.shape === "x-balloon" || p.shape === "balloon"; });
    var rowFloatTop = floats.reduce(function (t, p) { return Math.max(t, STRING + 6 + p.size); }, 0);
    if (aside && aside.shape === "balloon") {          // too wide: the constant floats at the far side, above the others
      aside.cx = out * (PAN_HALF - aside.size / 2);
      aside.above = Math.max(weightTop + 8, rowFloatTop + 8);
      floats.push(aside);
    }
    var maxRise = maxRiseFor();
    floats.forEach(function (p, i) {
      var base = p.above || 0;
      var string = Math.max(12, Math.min(STRING, maxRise - base - 6 - p.size));
      p.stringTop = -(base + string);
      p.cy = p.stringTop - p.size / 2 - 6;
      p.layer = floats.length === 1 ? "front" : (i % 2 === 0 ? "back" : "front");
    });
    var weights = ps.weights.slice();
    return { weights: weights, floats: floats, weightTop: weightTop, centred: !aside };
  }

  /* Fallback for very crowded pans: weights in rows, balloons spread across the rim at two heights. */
  function layoutCrowded(ps, where) {
    var maxW = 2 * PAN_HALF - 8, rows = [], row = null;
    ps.weights.forEach(function (p, i) {
      var gap = i === 0 ? 0 : (ps.weights[i - 1].group === p.group ? GAP_IN_GROUP : GAP_BETWEEN);
      if (!row || row.w + gap + p.size > maxW) { row = { items: [], gaps: [], w: 0, h: 0 }; rows.push(row); gap = 0; }
      row.items.push(p); row.gaps.push(gap); row.w += gap + p.size; row.h = Math.max(row.h, p.size);
    });
    var y = 0;
    rows.forEach(function (r) {
      var px = -r.w / 2;
      r.items.forEach(function (p, k) { px += r.gaps[k]; p.cx = px + p.size / 2; p.cy = y - p.size / 2; px += p.size; });
      y -= r.h + 4;
    });
    var weightTop = rows.length ? -y - 4 : 0, n = ps.floats.length, span = 2 * PAN_HALF - 50, maxRise = maxRiseFor();
    ps.floats.forEach(function (p, i) {
      p.cx = n === 1 ? 0 : -span / 2 + span * (i + 0.5) / n;
      var string = Math.max(12, Math.min(i % 2 === 0 ? 26 : 72, maxRise - weightTop - 14 - p.size));
      p.stringTop = -(weightTop + 8 + string);
      p.cy = p.stringTop - p.size / 2 - 6;
      p.layer = n === 1 ? "front" : (i % 2 === 0 ? "back" : "front");
    });
    return { weights: ps.weights, floats: ps.floats, weightTop: weightTop, centred: false };
  }

  /* ---------- drawing ---------- */

  function defs(svg) {
    var d = el("defs", {}, svg);
    function lin(id, stops, x2, y2) {
      var g = el("linearGradient", { id: id, x1: 0, y1: 0, x2: x2 === undefined ? 0 : x2, y2: y2 === undefined ? 1 : y2 }, d);
      stops.forEach(function (s) { el("stop", { offset: s[0], "stop-color": s[1] }, g); });
    }
    function rad(id, stops) {
      var g = el("radialGradient", { id: id, cx: "35%", cy: "30%", r: "75%" }, d);
      stops.forEach(function (s) { el("stop", { offset: s[0], "stop-color": s[1] }, g); });
    }
    lin("bon-metal", [[0, "#7D8996"], [0.5, "#4A5562"], [1, "#2C343D"]]);
    lin("bon-post", [[0, "#56616D"], [0.5, "#8995A2"], [1, "#3A444F"]], 1, 0);
    lin("bon-box", [[0, "#F4F8FE"], [1, "#BFD1F0"]], 1, 1);
    lin("bon-pan", [[0, "#9AA6B3"], [1, "#4A5562"]]);
    rad("bon-ball", [[0, "#7FD49A"], [0.55, "#2E9A4E"], [1, "#145A28"]]);
    rad("bon-balloon", [[0, "#FF9B9B"], [0.5, "#D6323C"], [1, "#8E141C"]]);
    rad("bon-xballoon", [[0, "#FFFFFF"], [0.6, "#D7E4FA"], [1, "#9FB9E6"]]);
    var hatch = el("pattern", { id: "bon-hatch", width: 8, height: 8, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, d);
    el("rect", { width: 8, height: 8, fill: "#EDEDED" }, hatch);
    el("line", { x1: 0, y1: 0, x2: 0, y2: 8, stroke: "#C9C9C9", "stroke-width": 3 }, hatch);
    var f = el("filter", { id: "bon-shadow", x: "-30%", y: "-30%", width: "160%", height: "160%" }, d);
    el("feDropShadow", { dx: 0, dy: 2, stdDeviation: 2, "flood-color": "#000000", "flood-opacity": 0.3 }, f);
  }

  function label(g, p, cx, cy, size, color, italic) {
    var t = el("text", { x: cx, y: cy, "font-size": italic ? Math.min(30, size * 0.7) : fitFont(p.label, size - 6, Math.min(30, size * 0.5)),
      fill: color, "class": "bon-label" + (italic ? " bon-label-x" : "") }, g);
    t.textContent = p.label;
  }

  function drawWeight(g, p) {
    var item = el("g", { "data-shape": p.shape, "data-label": p.label, "data-layer": "pan" }, g);
    var s = p.size, x0 = p.cx - s / 2, y0 = p.cy - s / 2;
    el("ellipse", { cx: p.cx, cy: 1, rx: s * 0.48, ry: 4, fill: "#000000", opacity: 0.18 }, item); // shadow on the pan
    if (p.shape === "ball") {
      el("circle", { cx: p.cx, cy: p.cy, r: s / 2, fill: "url(#bon-ball)", stroke: "#0F4A20", "stroke-width": 1.5, "data-measure": "1" }, item);
      label(item, p, p.cx, p.cy, s, "#FFFFFF");
      return;
    }
    var zero = p.shape === "zero-box", unknown = p.shape === "unknown-box";
    el("rect", { x: x0, y: y0, width: s, height: s, rx: 3, fill: zero ? "url(#bon-hatch)" : "url(#bon-box)",
      stroke: C.blue, "stroke-width": 3, "stroke-dasharray": zero ? "6 4" : undefined, "data-measure": "1",
      filter: zero ? undefined : "url(#bon-shadow)" }, item);
    if (!zero) el("path", { d: "M" + (x0 + 4) + "," + (y0 + s - 5) + " L" + (x0 + 4) + "," + (y0 + 4) + " L" + (x0 + s - 5) + "," + (y0 + 4),
      fill: "none", stroke: "#FFFFFF", "stroke-width": 2, opacity: 0.8 }, item); // bevel highlight
    label(item, p, p.cx, p.cy, s, unknown ? C.blue : C.ink, unknown);
  }

  function drawFloat(g, p) {
    var item = el("g", { "data-shape": p.shape, "data-label": p.label, "data-layer": p.layer }, g);
    var s = p.size;
    el("line", { x1: p.cx, y1: 0, x2: p.cx, y2: p.cy + s / 2 + 6, stroke: C.string, "stroke-width": 2, "data-string": "1" }, item);
    el("path", { d: "M" + (p.cx - 5) + "," + (p.cy + s / 2 + 7) + " L" + p.cx + "," + (p.cy + s / 2 - 1) + " L" + (p.cx + 5) + "," + (p.cy + s / 2 + 7) + " Z",
      fill: p.shape === "balloon" ? "#8E141C" : C.blue }, item); // knot
    if (p.shape === "balloon") {
      el("circle", { cx: p.cx, cy: p.cy, r: s / 2, fill: "url(#bon-balloon)", stroke: "#7A1016", "stroke-width": 1.5, "data-measure": "1" }, item);
      label(item, p, p.cx, p.cy, s, "#FFFFFF");
    } else {
      el("rect", { x: p.cx - s / 2, y: p.cy - s / 2, width: s, height: s, rx: s * 0.28, fill: "url(#bon-xballoon)",
        stroke: C.blue, "stroke-width": 3, "data-measure": "1" }, item);
      label(item, p, p.cx, p.cy, s, C.ink);
    }
  }

  /* The side's expression as coloured pieces: x-terms blue, + numbers green, − numbers red. */
  function exprPieces(side) {
    var out = [];
    function xs(k, first) {
      if (!first) out.push({ text: " + ", color: C.blue });
      out.push({ text: (k === 1 ? "" : k) + "x", color: C.blue });
    }
    function cs(first) {
      var neg = side.c < 0;
      out.push({ text: (first ? (neg ? BON.MINUS : "") : (neg ? " " + BON.MINUS + " " : " + ")) + Math.abs(side.c), color: neg ? C.red : C.green });
    }
    var first = true;
    if (side.constFirst && side.c) { cs(true); first = false; }
    side.groups.forEach(function (k) { if (k > 0) { xs(k, first); first = false; } });
    if (!side.constFirst && side.c) { cs(first); first = false; }
    if (first) out.push({ text: "0", color: C.ink });
    return out;
  }

  function createBalance(svg, options) {
    options = options || {};
    svg.setAttribute("viewBox", "0 0 " + VB_W + " " + VB_H);
    svg.setAttribute("role", "img");
    clear(svg);
    var title = el("title", {}, svg);
    defs(svg);

    // stand
    el("ellipse", { cx: PIVOT.x, cy: 422, rx: 110, ry: 7, fill: "#000000", opacity: 0.15 }, svg);
    el("path", { d: "M368,422 L532,422 L508,394 L392,394 Z", fill: "url(#bon-metal)", "class": "bon-stand" }, svg);
    el("rect", { x: PIVOT.x - 9, y: PIVOT.y, width: 18, height: 246, fill: "url(#bon-post)", "class": "bon-stand" }, svg);

    var back = { left: el("g", { "class": "bon-back", "data-side": "left" }, svg), right: el("g", { "class": "bon-back", "data-side": "right" }, svg) };
    var beam = el("g", { "class": "bon-beam" }, svg);
    el("rect", { x: PIVOT.x - BEAM_HALF - 10, y: PIVOT.y - 7, width: 2 * BEAM_HALF + 20, height: 14, rx: 7, fill: "url(#bon-metal)" }, beam);
    el("path", { d: "M" + (PIVOT.x - 5) + "," + PIVOT.y + " L" + PIVOT.x + "," + (PIVOT.y - 46) + " L" + (PIVOT.x + 5) + "," + PIVOT.y + " Z", fill: "#3A444F" }, beam);
    [-1, 1].forEach(function (d) {
      el("circle", { cx: PIVOT.x + d * BEAM_HALF, cy: PIVOT.y, r: 5, fill: "#FFFFFF", stroke: "#3A444F", "stroke-width": 2.5 }, beam);
    });
    el("circle", { cx: PIVOT.x, cy: PIVOT.y, r: 12, fill: "url(#bon-post)", stroke: "#2C343D", "stroke-width": 3 }, svg);
    var pan = { left: el("g", { "class": "bon-pan", "data-side": "left" }, svg), right: el("g", { "class": "bon-pan", "data-side": "right" }, svg) };
    var front = { left: el("g", { "class": "bon-front", "data-side": "left" }, svg), right: el("g", { "class": "bon-front", "data-side": "right" }, svg) };
    var labels = { left: el("g", { "class": "bon-under", "data-side": "left" }, svg), right: el("g", { "class": "bon-under", "data-side": "right" }, svg) };

    var state = { angle: 0, target: 0, anim: null, last: null, wobble: null };

    function reducedMotion() {
      if (options.reducedMotion !== undefined) return !!options.reducedMotion;
      return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }

    function place(angle) {
      state.angle = angle;
      var rad = angle * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
      beam.setAttribute("transform", "rotate(" + angle.toFixed(3) + " " + PIVOT.x + " " + PIVOT.y + ")");
      var pos = {
        left: [PIVOT.x - BEAM_HALF * cos, PIVOT.y - BEAM_HALF * sin + HANG],
        right: [PIVOT.x + BEAM_HALF * cos, PIVOT.y + BEAM_HALF * sin + HANG]
      };
      ["left", "right"].forEach(function (s) {
        var t = "translate(" + pos[s][0].toFixed(2) + " " + pos[s][1].toFixed(2) + ")";
        back[s].setAttribute("transform", t); pan[s].setAttribute("transform", t);
        front[s].setAttribute("transform", t); labels[s].setAttribute("transform", t);
      });
      svg.setAttribute("data-angle", angle.toFixed(3));
    }

    /* Short easing toward the target; a little settle when the beam arrives at level. */
    function animateTo(target, settle) {
      var prev = state.target;
      state.target = target;
      svg.setAttribute("data-target-angle", target.toFixed(3));
      if (reducedMotion()) {
        if (state.anim) { root.cancelAnimationFrame(state.anim); state.anim = null; }
        state.wobble = null; place(target); return;
      }
      if (settle && target === 0 && prev !== 0) state.wobble = { start: null, amp: prev > 0 ? 1.6 : -1.6 };
      if (state.anim) return;
      var lastTs = null;
      function step(ts) {
        var dt = lastTs === null ? 16 : Math.min(64, ts - lastTs);
        lastTs = ts;
        var gap = state.target - state.angle;
        var base = Math.abs(gap) < 0.02 ? state.target : state.angle + gap * (1 - Math.exp(-dt / FOLLOW_MS));
        var off = 0;
        if (state.wobble) {
          if (state.wobble.start === null) state.wobble.start = ts;
          var t = ts - state.wobble.start;
          if (t > 650) state.wobble = null;
          else off = state.wobble.amp * Math.exp(-t / 170) * Math.sin(2 * Math.PI * t / 300);
        }
        place(base + off);
        state.angle = base;
        if (Math.abs(state.target - base) < 0.02 && !state.wobble) { place(state.target); state.anim = null; return; }
        state.anim = root.requestAnimationFrame(step);
      }
      state.anim = root.requestAnimationFrame(step);
    }

    function drawSide(s, side, x, style) {
      clear(back[s]); clear(pan[s]); clear(front[s]); clear(labels[s]);
      var lay = layoutSide(side, x, style, s);
      var bowlD = "M" + -PAN_HALF + ",0 Q0,44 " + PAN_HALF + ",0 Z";
      // back chains and back balloons
      [-0.55, 0.55].forEach(function (k) {
        el("line", { x1: 0, y1: -HANG, x2: k * PAN_HALF, y2: -9, stroke: C.chain, "stroke-width": 2.5, "stroke-dasharray": "5 3" }, back[s]);
      });
      lay.floats.filter(function (p) { return p.layer === "back"; }).forEach(function (p) { drawFloat(back[s], p); });
      // the pan: bowl, rim, then the weights
      el("path", { d: bowlD, fill: "url(#bon-pan)" }, pan[s]);
      el("ellipse", { cx: 0, cy: 0, rx: PAN_HALF, ry: 10, fill: "#B9C3CE", stroke: "#4A5562", "stroke-width": 2 }, pan[s]);
      lay.weights.forEach(function (p) { drawWeight(pan[s], p); });
      // front chains and front balloons
      [-1, 1].forEach(function (k) {
        el("line", { x1: 0, y1: -HANG, x2: k * (PAN_HALF - 4), y2: 0, stroke: C.chain, "stroke-width": 2.5, "stroke-dasharray": "5 3" }, front[s]);
      });
      el("circle", { cx: 0, cy: -HANG, r: 5, fill: "#3A444F" }, front[s]);
      lay.floats.filter(function (p) { return p.layer === "front"; }).forEach(function (p) { drawFloat(front[s], p); });
      // the expression under the pan (rides with it, never rotates)
      var ex = el("text", { x: 0, y: EXPR_DY, "font-size": 30, "class": "bon-expr", "data-expr": s }, labels[s]);
      exprPieces(side).forEach(function (pc) { el("tspan", { fill: pc.color }, ex).textContent = pc.text; });
      return lay;
    }

    function update(opts) {
      var E = BON.exact, M = BON.model, eq = opts.eq, model = opts.model;
      var x = opts.x || null, style = opts.style;
      var layL = drawSide("left", model.left, x, style), layR = drawSide("right", model.right, x, style);
      var cmp = x ? M.compareModel(model, x) : null;
      var target = !cmp || opts.tilt === "level" ? 0 : tiltFor(eq, cmp.signedDiff);
      title.textContent = !cmp ? "Balance with the model on its pans. No value of x yet." :
        "Balance at x = " + E.fmtValue(x, style) + ". Left " + E.fmtValue(cmp.left, style) + ", right " + E.fmtValue(cmp.right, style) + ".";
      svg.setAttribute("data-heavier", cmp ? cmp.heavier : "none");
      state.last = { cmp: cmp, target: target, left: layL, right: layR };
      animateTo(target, !!opts.settle);
      return state.last;
    }

    /* Screen pixels per drawing unit (the drawing keeps its proportions inside the svg box). */
    function unitPx() {
      var r = svg.getBoundingClientRect();
      return Math.min(r.width / VB_W, r.height / VB_H) || 0;
    }

    place(0);
    return { update: update, unitPx: unitPx, getAngle: function () { return state.angle; } };
  }

  BON.createBalance = createBalance;
  BON.balanceGeometry = {
    sizeOf: sizeOf, tiltFor: tiltFor, abcd: abcd, layoutSide: layoutSide, exprPieces: exprPieces,
    S1: S1, FLOOR: FLOOR, UNKNOWN_SIDE: UNKNOWN_SIDE, PAN_HALF: PAN_HALF, TILT_POWER: TILT_POWER, MAX_TILT: MAX_TILT, NEVER_SHARE: NEVER_SHARE,
    VB_W: VB_W, VB_H: VB_H, PIVOT: PIVOT, HANG: HANG, BEAM_HALF: BEAM_HALF, TOP_MARGIN: TOP_MARGIN
  };
})(typeof window !== "undefined" ? window : globalThis);
