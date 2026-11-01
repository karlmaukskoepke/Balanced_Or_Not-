/*
 * The pan balance, drawn in SVG.
 *
 *   var view = BON.createBalance(svgElement);
 *   view.update({ eq, x: {n:4,d:3} or null, style: "decimal", tilt: "live" | "level", highlight: "left"|"right"|null });
 *   x null draws plain boxes marked "x" (no value yet). tilt "level" holds the beam flat (before a guess is answered).
 *   highlight marks both totals and labels the given side "greater" (feedback after a wrong answer).
 *
 * Picture rules (spec section 4):
 * - Each x-term with coefficient k is k boxes, each showing the value of x. Area ∝ |x|, with a floor size.
 * - x = 0: floor-size boxes, dashed outline, shaded, labelled "0". Boxes never vanish.
 * - x < 0: each box floats on a string above its pan, labelled with the negative value.
 * - Positive numbers: green circles "+3", area ∝ value. Negative numbers: red balloons "−6", area ∝ |value|.
 * - Both pans share one size scale, so sizes can be compared across the balance.
 * - Tilt: heavier (more positive) side goes down; capped; any nonzero difference shows at least MIN_TILT.
 * - Under each pan, in a fixed band: the side's total and a one-line substitution.
 * Sizes and angles are drawing-only numbers; values shown as text come from exact fractions.
 */
(function (root) {
  "use strict";
  var BON = root.BON || (root.BON = {});
  var NS = "http://www.w3.org/2000/svg";

  // Geometry (SVG user units; viewBox is 0 0 VB_W VB_H)
  var VB_W = 1300, VB_H = 836;
  var PIVOT = { x: 650, y: 96 };
  var BEAM_HALF = 440;        // pivot to the point a pan hangs from
  var HANG = 440;             // beam end down to the top of the pan
  var PAN_HALF = 200;
  var WEIGHT_BAND = { w: 370, h: 180 };             // on the pan, growing upward
  var FLOAT_BAND = { w: 380, top: -350, h: 160 };   // above the weights, below the beam
  var MIN_TILT = 4, MAX_TILT = 18, FULL_TILT_DIFF = 30;
  var UNIT_SIDE = 50;         // side of a box worth 1 at full scale
  var FLOOR_SIDE = 64;        // smallest box side (fits a label like "−1.33")
  var FLOOR_R = 34;           // smallest circle/balloon radius
  var GAP_IN_TERM = 6, GAP_BETWEEN_TERMS = 18, ROW_GAP = 8;
  var FOLLOW_MS = 70;          // the beam closes most of the gap to its target in about this time
  var TOTAL_Y = 764, SUB_Y = 818, TEXT_ROOM = { left: [12, 560], right: [740, 1288] };

  var COLORS = {
    blue: "#1F5FBF", boxFill: "#E4ECFA", zeroFill: "#EDEDED", zeroHatch: "#C9C9C9",
    green: "#1E7A36", red: "#C0262D", ink: "#111111", string: "#333333", hanger: "#9AA5B1", metal: "#3B4652"
  };

  /* Degrees of tilt for a signed difference (left − right, a fraction). Negative = left side down. */
  function tiltFor(signedDiff) {
    if (signedDiff.n === 0) return 0;
    var d = Math.abs(signedDiff.n / signedDiff.d);
    var t = MIN_TILT + (MAX_TILT - MIN_TILT) * Math.log(1 + d) / Math.log(1 + FULL_TILT_DIFF);
    t = Math.min(MAX_TILT, Math.max(MIN_TILT, t));
    return signedDiff.n > 0 ? -t : t;
  }

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* Rough width of bold sans digits, to keep labels inside their shapes. */
  function textWidth(s, size) {
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      w += ch === "." ? 0.3 : ch === "+" || ch === BON.MINUS ? 0.6 : 0.58;
    }
    return w * size;
  }
  function fitFont(label, room, preferred) {
    var size = preferred;
    var w = textWidth(label, size);
    if (w > room) size = size * room / w;
    return Math.max(17, size);
  }

  /* ---------- turning a side into pieces ---------- */

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
          term: termIndex,
          shape: pos ? "weight" : "balloon",
          band: pos ? "weight" : "float",
          units: Math.abs(t.value),
          label: (pos ? "+" : BON.MINUS) + Math.abs(t.value)
        });
      }
    });
    return items;
  }

  function isBox(it) { return /box$/.test(it.shape); }

  function sizeItem(it, f) {
    var area = UNIT_SIDE * UNIT_SIDE * it.units * f * f;
    if (isBox(it)) {
      var side = it.shape === "zero-box" || it.shape === "unknown-box" ? FLOOR_SIDE : Math.max(FLOOR_SIDE, Math.sqrt(area));
      it.w = side; it.h = side;
    } else {
      var r = Math.max(FLOOR_R, Math.sqrt(area / Math.PI));
      it.r = r;
      if (it.shape === "balloon") { it.rx = r * 0.9; it.ry = r / 0.9; it.w = 2 * it.rx; it.h = 2 * it.ry + 12; }
      else { it.w = 2 * r; it.h = 2 * r; }
    }
  }

  /* Shelf packing: left to right in written order, wrapping into rows. */
  function pack(items, maxW) {
    var rows = [], row = null;
    items.forEach(function (it, i) {
      var gap = i === 0 ? 0 : (items[i - 1].term === it.term ? GAP_IN_TERM : GAP_BETWEEN_TERMS);
      if (!row || (row.w + gap + it.w > maxW && row.items.length)) {
        row = { items: [], w: 0, h: 0, gaps: [] }; rows.push(row); gap = 0;
      }
      row.gaps.push(gap);
      row.items.push(it);
      row.w += gap + it.w;
      row.h = Math.max(row.h, it.h);
    });
    var h = 0, w = 0;
    rows.forEach(function (r, i) { h += r.h + (i ? ROW_GAP : 0); w = Math.max(w, r.w); });
    return { rows: rows, h: h, w: w };
  }

  /* Find one shared scale that fits every band on both pans; place the pieces. */
  function layout(eq, x, style) {
    var sides = { left: sideItems(eq.left, x, style), right: sideItems(eq.right, x, style) };
    var f = 1, result;
    for (var tries = 0; tries < 80; tries++) {
      var ok = true;
      result = {};
      ["left", "right"].forEach(function (s) {
        var all = sides[s];
        all.forEach(function (it) { sizeItem(it, f); });
        var weights = pack(all.filter(function (it) { return it.band === "weight"; }), WEIGHT_BAND.w);
        var floats = pack(all.filter(function (it) { return it.band === "float"; }), FLOAT_BAND.w);
        if (weights.h > WEIGHT_BAND.h || weights.w > WEIGHT_BAND.w) ok = false;
        if (floats.h > FLOAT_BAND.h || floats.w > FLOAT_BAND.w) ok = false;
        result[s] = { items: all, weights: weights, floats: floats };
      });
      if (ok) break;
      f *= 0.93;
    }
    result.scale = f;
    // Positions, in pan coordinates (0,0 = middle of the pan's top edge; y grows downward)
    ["left", "right"].forEach(function (s) {
      var y = 0;
      result[s].weights.rows.forEach(function (row, ri) {
        var x = -row.w / 2;
        if (ri) y -= ROW_GAP;
        row.items.forEach(function (it, k) {
          x += row.gaps[k];
          it.x = x + it.w / 2;           // centre x
          it.y = y - it.h / 2;           // centre y (sitting on the row's floor)
          x += it.w;
        });
        y -= row.h;
      });
      var top = FLOAT_BAND.top;
      result[s].floats.rows.forEach(function (row) {
        var x = -row.w / 2;
        row.items.forEach(function (it, k) {
          x += row.gaps[k];
          it.x = x + it.w / 2;
          it.y = top + it.h / 2;
          x += it.w;
        });
        top += row.h + ROW_GAP;
      });
    });
    return result;
  }

  /* ---------- drawing ---------- */

  function drawItem(it, g, strings) {
    var item = el("g", { "data-shape": it.shape, "data-label": it.label }, g);
    var labelColor = COLORS.ink, fontPref;
    if (it.band === "float") {
      // string from the piece's bottom down to the pan
      var bottom = it.shape === "balloon" ? it.y + it.ry + 12 : it.y + it.h / 2;
      el("line", { x1: it.x, y1: bottom, x2: it.x, y2: 0, stroke: COLORS.string, "stroke-width": 3,
        "data-string": "1" }, strings);
    }
    if (isBox(it)) {
      var zero = it.shape === "zero-box", unknown = it.shape === "unknown-box";
      el("rect", {
        x: it.x - it.w / 2, y: it.y - it.h / 2, width: it.w, height: it.h, rx: 4,
        fill: zero ? "url(#bon-hatch)" : COLORS.boxFill,
        stroke: COLORS.blue, "stroke-width": 4,
        "stroke-dasharray": zero ? "9 7" : undefined
      }, item);
      fontPref = Math.min(38, Math.max(24, it.w * 0.4));
      var size = fitFont(it.label, it.w - 10, fontPref);
      el("text", { x: it.x, y: it.y, "font-size": unknown ? 40 : size, fill: unknown ? COLORS.blue : labelColor,
        "class": "bon-label" + (unknown ? " bon-label-x" : "") }, item).textContent = it.label;
    } else if (it.shape === "weight") {
      el("circle", { cx: it.x, cy: it.y, r: it.r, fill: COLORS.green, stroke: "#14501F", "stroke-width": 2 }, item);
      fontPref = Math.min(38, Math.max(24, it.r * 0.8));
      el("text", { x: it.x, y: it.y, "font-size": fitFont(it.label, it.r * 1.7, fontPref), fill: "#FFFFFF",
        "class": "bon-label" }, item).textContent = it.label;
    } else if (it.shape === "balloon") {
      var by = it.y - 6;
      el("ellipse", { cx: it.x, cy: by, rx: it.rx, ry: it.ry, fill: COLORS.red, stroke: "#7E1519", "stroke-width": 2 }, item);
      // knot
      el("path", { d: "M" + (it.x - 6) + "," + (by + it.ry + 9) + " L" + it.x + "," + (by + it.ry - 2) +
        " L" + (it.x + 6) + "," + (by + it.ry + 9) + " Z", fill: "#7E1519" }, item);
      // shine
      el("ellipse", { cx: it.x - it.rx * 0.4, cy: by - it.ry * 0.45, rx: it.rx * 0.18, ry: it.ry * 0.12,
        fill: "#FFFFFF", opacity: 0.45 }, item);
      fontPref = Math.min(38, Math.max(24, it.rx * 0.8));
      el("text", { x: it.x, y: by, "font-size": fitFont(it.label, it.rx * 1.7, fontPref), fill: "#FFFFFF",
        "class": "bon-label" }, item).textContent = it.label;
    }
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
    el("path", { d: "M540,830 L760,830 L730,800 L570,800 Z", fill: COLORS.metal }, svg);
    el("rect", { x: PIVOT.x - 11, y: PIVOT.y, width: 22, height: 710, fill: COLORS.metal }, svg);
    // Fixed "level" mark above the pivot
    el("path", { d: "M" + PIVOT.x + "," + (PIVOT.y - 74) + " l-9,-16 l18,0 Z", fill: COLORS.metal }, svg);

    var pans = { left: el("g", { "class": "bon-pan", "data-side": "left" }, svg),
                 right: el("g", { "class": "bon-pan", "data-side": "right" }, svg) };

    // Beam (rotates about the pivot) with its pointer
    var beam = el("g", { "class": "bon-beam" }, svg);
    el("rect", { x: PIVOT.x - BEAM_HALF - 14, y: PIVOT.y - 9, width: 2 * BEAM_HALF + 28, height: 18, rx: 9,
      fill: COLORS.metal }, beam);
    el("path", { d: "M" + (PIVOT.x - 7) + "," + PIVOT.y + " L" + PIVOT.x + "," + (PIVOT.y - 70) + " L" +
      (PIVOT.x + 7) + "," + PIVOT.y + " Z", fill: COLORS.metal }, beam);
    el("circle", { cx: PIVOT.x - BEAM_HALF, cy: PIVOT.y, r: 7, fill: "#FFFFFF", stroke: COLORS.metal, "stroke-width": 3 }, beam);
    el("circle", { cx: PIVOT.x + BEAM_HALF, cy: PIVOT.y, r: 7, fill: "#FFFFFF", stroke: COLORS.metal, "stroke-width": 3 }, beam);
    el("circle", { cx: PIVOT.x, cy: PIVOT.y, r: 15, fill: "#FFFFFF", stroke: COLORS.metal, "stroke-width": 5 }, svg);

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

    /*
     * The beam follows its target with short easing (exponential approach, about FOLLOW_MS),
     * so it keeps up while the slider is dragged: each new target just redirects the motion.
     */
    function animateTo(target) {
      state.target = target;
      svg.setAttribute("data-target-angle", target.toFixed(3));
      if (reducedMotion()) {
        if (state.anim) { root.cancelAnimationFrame(state.anim); state.anim = null; }
        place(target); return;
      }
      if (state.anim) return; // the running loop picks up the new target
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

    function drawPan(g, side, data) {
      while (g.firstChild) g.removeChild(g.firstChild);
      // hanger strings
      el("line", { x1: 0, y1: -HANG, x2: -PAN_HALF + 6, y2: 0, stroke: COLORS.hanger, "stroke-width": 2.5 }, g);
      el("line", { x1: 0, y1: -HANG, x2: PAN_HALF - 6, y2: 0, stroke: COLORS.hanger, "stroke-width": 2.5 }, g);
      var strings = el("g", { "class": "bon-strings" }, g);
      // the pan itself
      el("path", { d: "M" + -PAN_HALF + ",0 L" + PAN_HALF + ",0 L" + (PAN_HALF - 34) + ",24 L" + (-PAN_HALF + 34) +
        ",24 Z", fill: COLORS.metal }, g);
      var pieces = el("g", { "class": "bon-pieces" }, g);
      data.items.forEach(function (it) { drawItem(it, pieces, strings); });
    }

    /* Total and substitution under a pan (fixed place, so they stay readable while the beam moves). */
    function drawInfo(side, total, sub, mark) {
      var room = TEXT_ROOM[side], cx = side === "left" ? PIVOT.x - BEAM_HALF : PIVOT.x + BEAM_HALF;
      function placeText(label, y, size, cls, attr) {
        var w = textWidth(label, size), x = cx;
        var attrs = { y: y, "font-size": size, "class": cls };
        if (w > room[1] - room[0]) { attrs.textLength = room[1] - room[0]; attrs.lengthAdjust = "spacingAndGlyphs"; w = room[1] - room[0]; }
        x = Math.min(room[1] - w / 2, Math.max(room[0] + w / 2, x));
        attrs.x = x;
        attrs[attr] = side;
        var t = el("text", attrs, info);
        t.textContent = label;
        return { x: x, w: w };
      }
      var tw = textWidth(total, 56);
      if (mark) {
        el("rect", { x: cx - tw / 2 - 16, y: TOTAL_Y - 50, width: tw + 32, height: 64, rx: 10,
          fill: "#FFF1B8", stroke: COLORS.ink, "stroke-width": 3, "data-highlight": side }, info);
      }
      placeText(total, TOTAL_Y, 56, "bon-total", "data-total");
      if (mark === "greater") {
        var gt = el("text", { x: cx + tw / 2 + 26, y: TOTAL_Y - 6, "font-size": 30, "class": "bon-greater",
          "data-greater": side }, info);
        gt.textContent = "\u25C0 greater";
      }
      placeText(sub, SUB_Y, 34, "bon-sub", "data-sub");
    }

    function update(opts) {
      var E = BON.exact, M = BON.model;
      var eq = opts.eq, x = opts.x || null, style = opts.style;
      var cmp = x ? M.compare(eq, x) : null;
      var lay = layout(eq, x, style);
      drawPan(pans.left, "left", lay.left);
      drawPan(pans.right, "right", lay.right);
      while (info.firstChild) info.removeChild(info.firstChild);
      ["left", "right"].forEach(function (side) {
        var mark = opts.highlight ? (opts.highlight === side ? "greater" : "plain") : null;
        drawInfo(side, cmp ? E.fmtValue(cmp[side], style) : "?",
          x ? M.substitutionLine(eq[side], x, style) : M.sideText(eq[side]), mark);
      });
      var target = !cmp || opts.tilt === "level" ? 0 : tiltFor(cmp.signedDiff);
      title.textContent = !cmp ? "Balance with " + M.equationText(eq) + " on its pans. No value of x yet." :
        "Balance. Left side " + E.fmtValue(cmp.left, style) + ", right side " + E.fmtValue(cmp.right, style) + ". " +
        (opts.tilt === "level" ? "The beam is held level." :
        cmp.heavier === "balanced" ? "The beam is level." : (cmp.heavier === "left" ? "Left" : "Right") + " side is down.");
      state.last = { cmp: cmp, layout: lay, target: target };
      svg.setAttribute("data-heavier", cmp ? cmp.heavier : "none");
      svg.setAttribute("data-held", !cmp || opts.tilt === "level" ? "1" : "0");
      animateTo(target);
      return state.last;
    }

    place(0);
    return {
      update: update,
      getAngle: function () { return state.angle; },
      getLast: function () { return state.last; }
    };
  }

  BON.createBalance = createBalance;
  BON.balanceGeometry = { tiltFor: tiltFor, layout: layout, MIN_TILT: MIN_TILT, MAX_TILT: MAX_TILT,
    FLOAT_BAND: FLOAT_BAND, WEIGHT_BAND: WEIGHT_BAND, FLOOR_SIDE: FLOOR_SIDE };
})(typeof window !== "undefined" ? window : globalThis);
