/*
 * The pan balance, drawn in SVG (spec v2, section 4).
 *
 *   var view = BON.createBalance(svgElement);
 *   view.update({ eq, x: {n,d} or null, style: "decimal", tilt: "live" | "level" });
 *   x null draws plain boxes marked "x" (no value yet). tilt "level" holds the beam flat.
 *
 * Picture rules:
 * - Each x-term with coefficient k is k boxes showing the value of x. Area ∝ |x|, with a floor size.
 * - x = 0: floor-size boxes, dashed outline, shaded, labelled "0". Boxes never vanish.
 * - x < 0: each box floats on a string, labelled with the negative value.
 * - Positive numbers: green circles "+3"; negative numbers: red balloons "−6" on strings. Area ∝ |value|.
 * - Floating pieces hover beside the OUTER edge of their pan (tethered to the pan end), so they never
 *   reach the beam and the balance can be short and wide.
 * - Both pans share one size scale.
 * - Under each pan: the side's expression in colour (x-terms blue, + numbers green, − numbers red),
 *   moving up and down with the pan but never rotating. Below that, fixed in place, the substitution
 *   line ("3(5) + 2 = 17").
 * - Tilt is scaled per equation: the largest difference over the slider range reaches the cap, any
 *   nonzero difference shows at least MIN_TILT, never-balanced equations hold 60% of the cap.
 * Sizes and angles are drawing-only numbers; every value shown as text comes from exact fractions.
 */
(function (root) {
  "use strict";
  var BON = root.BON || (root.BON = {});
  var NS = "http://www.w3.org/2000/svg";

  // Geometry (SVG user units; viewBox is 0 0 VB_W VB_H)
  var VB_W = 1300, VB_H = 470;
  var PIVOT = { x: 650, y: 92 };
  var BEAM_HALF = 250;        // pivot to the point a pan hangs from
  var HANG = 190;             // beam end down to the top of the pan
  var PAN_HALF = 150;
  var WEIGHT_BAND = { w: 280, h: 150 };                         // on the pan, growing upward
  var FLOAT_ZONE = { inner: PAN_HALF + 14, w: 224, top: -152, h: 150 }; // beside the pan's outer edge
  var MIN_TILT = 4, MAX_TILT = 18, NEVER_SHARE = 0.6;
  var UNIT_SIDE = 46;         // side of a box worth 1 at full scale
  var FLOOR_SIDE = 70;        // smallest box side (fits a label like "−1.33")
  var FLOOR_R = 36;           // smallest circle/balloon radius
  var GAP_IN_TERM = 6, GAP_BETWEEN_TERMS = 18, ROW_GAP = 8;
  var FOLLOW_MS = 70;         // the beam closes most of the gap to its target in about this time
  var EXPR_DY = 50, SUB_Y = 456, TEXT_ROOM = { left: [8, 560], right: [740, 1292] };

  var COLORS = {
    blue: "#1F5FBF", boxFill: "#E4ECFA", zeroFill: "#EDEDED", zeroHatch: "#C9C9C9",
    green: "#1E7A36", red: "#C0262D", ink: "#111111", string: "#333333", hanger: "#9AA5B1", metal: "#3B4652"
  };

  /* A, B, C, D of Ax + B = Cx + D (drawing only; the page never shows these letters). */
  function abcd(eq) {
    var o = { A: 0, B: 0, C: 0, D: 0 };
    eq.left.forEach(function (t) { if (t.kind === "x") o.A += t.coef; else o.B += t.value; });
    eq.right.forEach(function (t) { if (t.kind === "x") o.C += t.coef; else o.D += t.value; });
    return o;
  }

  /*
   * Degrees of tilt for the equation at a signed difference (left − right, a fraction). Negative = left side down.
   * Scaled so the largest difference across the slider range reaches MAX_TILT.
   */
  function tiltFor(eq, signedDiff) {
    if (signedDiff.n === 0) return 0;
    var k = abcd(eq), sign = signedDiff.n > 0 ? -1 : 1, t;
    if (k.A === k.C) t = MAX_TILT * NEVER_SHARE;
    else {
      var lo = eq.sliderRange[0], hi = eq.sliderRange[1];
      var f = function (x) { return Math.abs((k.A - k.C) * x + (k.B - k.D)); };
      var maxDiff = Math.max(f(lo), f(hi)) || 1;
      t = MAX_TILT * Math.abs(signedDiff.n / signedDiff.d) / maxDiff;
      t = Math.min(MAX_TILT, Math.max(MIN_TILT, t));
    }
    return sign * t;
  }

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* Rough width of bold sans text, to keep labels inside their shapes. */
  function textWidth(s, size) {
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      w += ch === "." || ch === " " ? 0.3 : ch === "(" || ch === ")" ? 0.36 : ch === "/" ? 0.3 :
        ch === "+" || ch === "=" || ch === BON.MINUS ? 0.6 : 0.58;
    }
    return w * size;
  }
  function fitFont(label, room, preferred) {
    var size = preferred, w = textWidth(label, size);
    if (w > room) size = size * room / w;
    return Math.max(18, size);
  }

  /* ---------- turning a side into pieces ---------- */

  function isBox(it) { return /box$/.test(it.shape); }

  function sideItems(terms, x, style) {
    var items = [], E = BON.exact;
    var sign = x ? E.fSign(x) : 0;
    terms.forEach(function (t, termIndex) {
      if (t.kind === "x") {
        for (var k = 0; k < t.coef; k++) {
          items.push({
            term: termIndex,
            shape: !x ? "unknown-box" : sign > 0 ? "box" : sign === 0 ? "zero-box" : "float-box",
            band: x && sign < 0 ? "float" : "weight",
            units: x ? Math.abs(E.fToFloat(x)) : 0,
            label: x ? E.fmtValue(x, style) : "x"
          });
        }
      } else if (t.value !== 0) {
        var pos = t.value > 0;
        items.push({
          term: termIndex, shape: pos ? "weight" : "balloon", band: pos ? "weight" : "float",
          units: Math.abs(t.value), label: (pos ? "+" : BON.MINUS) + Math.abs(t.value)
        });
      }
    });
    return items;
  }

  function sizeItem(it, f, floorK) {
    var FS = FLOOR_SIDE * floorK, FR = FLOOR_R * floorK;
    var area = UNIT_SIDE * UNIT_SIDE * it.units * f * f;
    if (isBox(it)) {
      var side = it.shape === "zero-box" || it.shape === "unknown-box" ? FS : Math.max(FS, Math.sqrt(area));
      it.w = side; it.h = side;
    } else {
      var r = Math.max(FR, Math.sqrt(area / Math.PI));
      it.r = r;
      if (it.shape === "balloon") { it.rx = r * 0.9; it.ry = r / 0.9; it.w = 2 * it.rx; it.h = 2 * it.ry + 12; }
      else { it.w = 2 * r; it.h = 2 * r; }
    }
  }

  /* Shelf packing: in written order, wrapping into rows. */
  function pack(items, maxW) {
    var rows = [], row = null;
    items.forEach(function (it, i) {
      var gap = i === 0 ? 0 : (items[i - 1].term === it.term ? GAP_IN_TERM : GAP_BETWEEN_TERMS);
      if (!row || (row.w + gap + it.w > maxW && row.items.length)) {
        row = { items: [], w: 0, h: 0, gaps: [] }; rows.push(row); gap = 0;
      }
      row.gaps.push(gap); row.items.push(it);
      row.w += gap + it.w; row.h = Math.max(row.h, it.h);
    });
    var h = 0, w = 0;
    rows.forEach(function (r, i) { h += r.h + (i ? ROW_GAP : 0); w = Math.max(w, r.w); });
    return { rows: rows, h: h, w: w };
  }

  /* One shared scale that fits every band on both pans; then place the pieces (pan coordinates). */
  function layout(eq, x, style) {
    var sides = { left: sideItems(eq.left, x, style), right: sideItems(eq.right, x, style) };
    // shrink everything together; if even floor-size pieces don't fit (many floating boxes), shrink the floor a little
    var f = 1, floorK = 1, result, ok = false;
    for (var tries = 0; tries < 120 && !ok; tries++) {
      if (tries === 60) { f = 1; floorK = 0.86; }
      if (tries === 90) { f = 1; floorK = 0.74; }
      ok = true;
      result = {};
      ["left", "right"].forEach(function (s) {
        var all = sides[s];
        all.forEach(function (it) { sizeItem(it, f, floorK); });
        var weights = pack(all.filter(function (it) { return it.band === "weight"; }), WEIGHT_BAND.w);
        var floats = pack(all.filter(function (it) { return it.band === "float"; }), FLOAT_ZONE.w);
        if (weights.h > WEIGHT_BAND.h || weights.w > WEIGHT_BAND.w) ok = false;
        if (floats.h > FLOAT_ZONE.h || floats.w > FLOAT_ZONE.w) ok = false;
        result[s] = { items: all, weights: weights, floats: floats };
      });
      if (!ok) f *= 0.93;
    }
    result.scale = f; result.floorK = floorK;
    ["left", "right"].forEach(function (s) {
      var y = 0;
      result[s].weights.rows.forEach(function (row, ri) {
        var px = -row.w / 2;
        if (ri) y -= ROW_GAP;
        row.items.forEach(function (it, k) {
          px += row.gaps[k];
          it.x = px + it.w / 2; it.y = y - it.h / 2;
          px += it.w;
        });
        y -= row.h;
      });
      // floating pieces: outside the pan, rows from the top of the zone, packed toward the pan
      var out = s === "left" ? -1 : 1, top = FLOAT_ZONE.top;
      result[s].floats.rows.forEach(function (row) {
        var px = 0; // distance from the zone's inner edge
        row.items.forEach(function (it, k) {
          px += row.gaps[k];
          it.x = out * (FLOAT_ZONE.inner + px + it.w / 2);
          it.y = top + it.h / 2;
          px += it.w;
        });
        top += row.h + ROW_GAP;
      });
    });
    return result;
  }

  /* ---------- drawing ---------- */

  function drawItem(it, g, strings, side) {
    var item = el("g", { "data-shape": it.shape, "data-label": it.label }, g);
    if (it.band === "float") {
      // string from the piece's bottom to the pan's outer end
      var bottom = it.shape === "balloon" ? it.y - 6 + it.ry + 9 : it.y + it.h / 2;
      var endX = (side === "left" ? -1 : 1) * (PAN_HALF - 4);
      el("path", { d: "M" + it.x + "," + bottom + " Q" + it.x + "," + (bottom + 30) + " " + endX + ",0",
        fill: "none", stroke: COLORS.string, "stroke-width": 2.5, "data-string": "1" }, strings);
    }
    var fontPref;
    if (isBox(it)) {
      var zero = it.shape === "zero-box", unknown = it.shape === "unknown-box";
      el("rect", {
        x: it.x - it.w / 2, y: it.y - it.h / 2, width: it.w, height: it.h, rx: 4,
        fill: zero ? "url(#bon-hatch)" : it.shape === "float-box" ? "#FFFFFF" : COLORS.boxFill,
        stroke: COLORS.blue, "stroke-width": 4, "stroke-dasharray": zero ? "9 7" : undefined
      }, item);
      fontPref = Math.min(40, Math.max(26, it.w * 0.42));
      el("text", { x: it.x, y: it.y, "font-size": unknown ? 42 : fitFont(it.label, it.w - 10, fontPref),
        fill: unknown ? COLORS.blue : COLORS.ink, "class": "bon-label" + (unknown ? " bon-label-x" : "") }, item)
        .textContent = it.label;
    } else if (it.shape === "weight") {
      el("circle", { cx: it.x, cy: it.y, r: it.r, fill: COLORS.green, stroke: "#14501F", "stroke-width": 2 }, item);
      fontPref = Math.min(40, Math.max(26, it.r * 0.8));
      el("text", { x: it.x, y: it.y, "font-size": fitFont(it.label, it.r * 1.7, fontPref), fill: "#FFFFFF",
        "class": "bon-label" }, item).textContent = it.label;
    } else if (it.shape === "balloon") {
      var by = it.y - 6;
      el("ellipse", { cx: it.x, cy: by, rx: it.rx, ry: it.ry, fill: COLORS.red, stroke: "#7E1519", "stroke-width": 2 }, item);
      el("path", { d: "M" + (it.x - 6) + "," + (by + it.ry + 9) + " L" + it.x + "," + (by + it.ry - 2) +
        " L" + (it.x + 6) + "," + (by + it.ry + 9) + " Z", fill: "#7E1519" }, item);
      el("ellipse", { cx: it.x - it.rx * 0.4, cy: by - it.ry * 0.45, rx: it.rx * 0.18, ry: it.ry * 0.12,
        fill: "#FFFFFF", opacity: 0.45 }, item);
      fontPref = Math.min(40, Math.max(26, it.rx * 0.8));
      el("text", { x: it.x, y: by, "font-size": fitFont(it.label, it.rx * 1.7, fontPref), fill: "#FFFFFF",
        "class": "bon-label" }, item).textContent = it.label;
    }
  }

  /* The side's expression as coloured pieces: x-terms blue, + numbers green, − numbers red. */
  function exprPieces(terms) {
    var out = [];
    terms.forEach(function (t, i) {
      if (t.kind === "x") {
        if (i > 0) out.push({ text: " + ", color: COLORS.blue });
        out.push({ text: (t.coef === 1 ? "" : t.coef) + "x", color: COLORS.blue });
      } else {
        var neg = t.value < 0, color = neg ? COLORS.red : COLORS.green;
        out.push({ text: (i > 0 ? (neg ? " " + BON.MINUS + " " : " + ") : (neg ? BON.MINUS : "")) + Math.abs(t.value), color: color });
      }
    });
    return out;
  }

  function createBalance(svg, options) {
    options = options || {};
    svg.setAttribute("viewBox", "0 0 " + VB_W + " " + VB_H);
    svg.setAttribute("role", "img");
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var title = el("title", {}, svg);
    var defs = el("defs", {}, svg);
    var hatch = el("pattern", { id: "bon-hatch", width: 10, height: 10, patternUnits: "userSpaceOnUse",
      patternTransform: "rotate(45)" }, defs);
    el("rect", { width: 10, height: 10, fill: COLORS.zeroFill }, hatch);
    el("line", { x1: 0, y1: 0, x2: 0, y2: 10, stroke: COLORS.zeroHatch, "stroke-width": 4 }, hatch);

    // Stand
    el("path", { d: "M570,420 L730,420 L705,396 L595,396 Z", fill: COLORS.metal, "class": "bon-stand" }, svg);
    el("rect", { x: PIVOT.x - 10, y: PIVOT.y, width: 20, height: 306, fill: COLORS.metal, "class": "bon-stand" }, svg);
    el("path", { d: "M" + PIVOT.x + "," + (PIVOT.y - 62) + " l-8,-14 l16,0 Z", fill: COLORS.metal }, svg);

    var pans = { left: el("g", { "class": "bon-pan", "data-side": "left" }, svg),
                 right: el("g", { "class": "bon-pan", "data-side": "right" }, svg) };

    var beam = el("g", { "class": "bon-beam" }, svg);
    el("rect", { x: PIVOT.x - BEAM_HALF - 12, y: PIVOT.y - 8, width: 2 * BEAM_HALF + 24, height: 16, rx: 8,
      fill: COLORS.metal }, beam);
    el("path", { d: "M" + (PIVOT.x - 6) + "," + PIVOT.y + " L" + PIVOT.x + "," + (PIVOT.y - 58) + " L" +
      (PIVOT.x + 6) + "," + PIVOT.y + " Z", fill: COLORS.metal }, beam);
    el("circle", { cx: PIVOT.x - BEAM_HALF, cy: PIVOT.y, r: 6, fill: "#FFFFFF", stroke: COLORS.metal, "stroke-width": 3 }, beam);
    el("circle", { cx: PIVOT.x + BEAM_HALF, cy: PIVOT.y, r: 6, fill: "#FFFFFF", stroke: COLORS.metal, "stroke-width": 3 }, beam);
    el("circle", { cx: PIVOT.x, cy: PIVOT.y, r: 13, fill: "#FFFFFF", stroke: COLORS.metal, "stroke-width": 5 }, svg);

    var info = el("g", { "class": "bon-info" }, svg);
    var state = { angle: 0, target: 0, anim: null, last: null };

    function reducedMotion() {
      if (options.reducedMotion !== undefined) return !!options.reducedMotion;
      return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }

    function place(angle) {
      state.angle = angle;
      var rad = angle * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
      beam.setAttribute("transform", "rotate(" + angle.toFixed(3) + " " + PIVOT.x + " " + PIVOT.y + ")");
      var lx = PIVOT.x - BEAM_HALF * cos, ly = PIVOT.y - BEAM_HALF * sin;
      var rx = PIVOT.x + BEAM_HALF * cos, ry = PIVOT.y + BEAM_HALF * sin;
      pans.left.setAttribute("transform", "translate(" + lx.toFixed(2) + " " + (ly + HANG).toFixed(2) + ")");
      pans.right.setAttribute("transform", "translate(" + rx.toFixed(2) + " " + (ry + HANG).toFixed(2) + ")");
      svg.setAttribute("data-angle", angle.toFixed(3));
    }

    /* The beam follows its target with short easing, so it keeps up with the slider. */
    function animateTo(target) {
      state.target = target;
      svg.setAttribute("data-target-angle", target.toFixed(3));
      if (reducedMotion()) {
        if (state.anim) { root.cancelAnimationFrame(state.anim); state.anim = null; }
        place(target); return;
      }
      if (state.anim) return;
      var lastTs = null;
      function step(ts) {
        var dt = lastTs === null ? 16 : Math.min(64, ts - lastTs);
        lastTs = ts;
        var gap = state.target - state.angle;
        if (Math.abs(gap) < 0.02) { place(state.target); state.anim = null; return; }
        place(state.angle + gap * (1 - Math.exp(-dt / FOLLOW_MS)));
        state.anim = root.requestAnimationFrame(step);
      }
      state.anim = root.requestAnimationFrame(step);
    }

    function drawPan(g, side, data, terms) {
      while (g.firstChild) g.removeChild(g.firstChild);
      el("line", { x1: 0, y1: -HANG, x2: -PAN_HALF + 6, y2: 0, stroke: COLORS.hanger, "stroke-width": 2.5 }, g);
      el("line", { x1: 0, y1: -HANG, x2: PAN_HALF - 6, y2: 0, stroke: COLORS.hanger, "stroke-width": 2.5 }, g);
      var strings = el("g", { "class": "bon-strings" }, g);
      el("path", { d: "M" + -PAN_HALF + ",0 L" + PAN_HALF + ",0 L" + (PAN_HALF - 30) + ",20 L" + (-PAN_HALF + 30) +
        ",20 Z", fill: COLORS.metal }, g);
      var pieces = el("g", { "class": "bon-pieces" }, g);
      data.items.forEach(function (it) { drawItem(it, pieces, strings, side); });
      // the side's expression, in colour, riding with the pan (translate only)
      var ex = el("text", { x: 0, y: EXPR_DY, "font-size": 40, "class": "bon-expr", "data-expr": side }, g);
      exprPieces(terms).forEach(function (p) {
        var ts = el("tspan", { fill: p.color }, ex);
        ts.textContent = p.text;
      });
    }

    /* The substitution line under a pan, fixed in place so it is readable while the beam moves. */
    function drawSub(side, line) {
      var room = TEXT_ROOM[side], cx = side === "left" ? PIVOT.x - BEAM_HALF : PIVOT.x + BEAM_HALF;
      var size = 36, w = textWidth(line, size);
      var attrs = { y: SUB_Y, "font-size": size, "class": "bon-sub", "data-sub": side };
      if (w > room[1] - room[0]) { attrs.textLength = room[1] - room[0]; attrs.lengthAdjust = "spacingAndGlyphs"; w = room[1] - room[0]; }
      attrs.x = Math.min(room[1] - w / 2, Math.max(room[0] + w / 2, cx));
      el("text", attrs, info).textContent = line;
    }

    function update(opts) {
      var E = BON.exact, M = BON.model;
      var eq = opts.eq, x = opts.x || null, style = opts.style;
      var cmp = x ? M.compare(eq, x) : null;
      var lay = layout(eq, x, style);
      drawPan(pans.left, "left", lay.left, eq.left);
      drawPan(pans.right, "right", lay.right, eq.right);
      while (info.firstChild) info.removeChild(info.firstChild);
      ["left", "right"].forEach(function (side) {
        drawSub(side, x ? M.substitutionLine(eq[side], x, style) : "");
      });
      var target = !cmp || opts.tilt === "level" ? 0 : tiltFor(eq, cmp.signedDiff);
      title.textContent = !cmp ? "Balance with " + M.equationText(eq) + " on its pans. No value of x yet." :
        "Balance at x = " + E.fmtValue(x, style) + ". Left side " + E.fmtValue(cmp.left, style) + ", right side " +
        E.fmtValue(cmp.right, style) + ". " + (opts.tilt === "level" ? "The beam is held level." :
        cmp.heavier === "balanced" ? "The beam is level." : (cmp.heavier === "left" ? "Left" : "Right") + " side is down.");
      state.last = { cmp: cmp, layout: lay, target: target };
      svg.setAttribute("data-heavier", cmp ? cmp.heavier : "none");
      animateTo(target);
      return state.last;
    }

    place(0);
    return { update: update, getAngle: function () { return state.angle; }, getLast: function () { return state.last; } };
  }

  /* A tiny tilted-beam picture for guess cards (same tilt rule as the big balance). */
  function miniBeam(svg, eq, x) {
    svg.setAttribute("viewBox", "0 0 64 36");
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var c = BON.model.compare(eq, x), a = tiltFor(eq, c.signedDiff);
    el("path", { d: "M26,34 L38,34 L32,18 Z", fill: COLORS.metal }, svg);
    var g = el("g", { transform: "rotate(" + a.toFixed(2) + " 32 18)" }, svg);
    el("rect", { x: 4, y: 15, width: 56, height: 6, rx: 3, fill: COLORS.metal }, g);
    el("rect", { x: 1, y: 21, width: 14, height: 5, rx: 2, fill: COLORS.metal }, g);
    el("rect", { x: 49, y: 21, width: 14, height: 5, rx: 2, fill: COLORS.metal }, g);
    return c;
  }

  BON.createBalance = createBalance;
  BON.miniBeam = miniBeam;
  BON.balanceGeometry = { tiltFor: tiltFor, layout: layout, abcd: abcd, exprPieces: exprPieces,
    MIN_TILT: MIN_TILT, MAX_TILT: MAX_TILT, NEVER_SHARE: NEVER_SHARE,
    FLOAT_ZONE: FLOAT_ZONE, WEIGHT_BAND: WEIGHT_BAND, PAN_HALF: PAN_HALF, FLOOR_SIDE: FLOOR_SIDE };
})(typeof window !== "undefined" ? window : globalThis);
