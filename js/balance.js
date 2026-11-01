/*
 * The pan balance, drawn in SVG.
 *
 *   var view = BON.createBalance(svgElement);
 *   view.update({ eq: equation, xh: 133, tilt: "live" });   // tilt "level" keeps the beam flat
 *
 * Picture rules (spec section 4):
 * - Each x-term with coefficient k is k boxes, each showing the value of x. Area ∝ |x|, with a floor size.
 * - x = 0: floor-size boxes, dashed outline, shaded, labelled "0". Boxes never vanish.
 * - x < 0: each box floats on a string above its pan, labelled with the negative value.
 * - Positive numbers: green circles "+3", area ∝ value. Negative numbers: red balloons "−6", area ∝ |value|.
 * - Both pans share one size scale, so sizes can be compared across the balance.
 * - Tilt: heavier (more positive) side goes down; capped; any nonzero difference shows at least MIN_TILT.
 * Sizes and angles are drawing-only numbers; values shown as text come from exact hundredths.
 */
(function (root) {
  "use strict";
  var BON = root.BON || (root.BON = {});
  var NS = "http://www.w3.org/2000/svg";

  // Geometry (SVG user units; viewBox is 0 0 VB_W VB_H)
  var VB_W = 1300, VB_H = 830;
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
  var ANIM_MS = 520;

  var COLORS = {
    blue: "#1F5FBF", boxFill: "#E4ECFA", zeroFill: "#EDEDED", zeroHatch: "#C9C9C9",
    green: "#1E7A36", red: "#C0262D", ink: "#111111", string: "#333333", hanger: "#9AA5B1", metal: "#3B4652"
  };

  /* Degrees of tilt for a signed difference (left − right, hundredths). Negative = left side down. */
  function tiltFor(leftMinusRightH) {
    if (leftMinusRightH === 0) return 0;
    var d = Math.abs(leftMinusRightH) / 100;
    var t = MIN_TILT + (MAX_TILT - MIN_TILT) * Math.log(1 + d) / Math.log(1 + FULL_TILT_DIFF);
    t = Math.min(MAX_TILT, Math.max(MIN_TILT, t));
    return leftMinusRightH > 0 ? -t : t;
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

  function sideItems(terms, xh) {
    var items = [], E = BON.exact;
    terms.forEach(function (t, termIndex) {
      if (t.kind === "x") {
        for (var k = 0; k < t.coef; k++) {
          items.push({
            term: termIndex,
            shape: xh > 0 ? "box" : xh === 0 ? "zero-box" : "float-box",
            band: xh < 0 ? "float" : "weight",
            units: Math.abs(xh) / 100,
            label: E.fmtH(xh)
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

  function sizeItem(it, f) {
    var area = UNIT_SIDE * UNIT_SIDE * it.units * f * f;
    if (it.shape === "box" || it.shape === "float-box" || it.shape === "zero-box") {
      var side = it.shape === "zero-box" ? FLOOR_SIDE : Math.max(FLOOR_SIDE, Math.sqrt(area));
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
  function layout(eq, xh) {
    var sides = { left: sideItems(eq.left, xh), right: sideItems(eq.right, xh) };
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
    if (it.shape === "box" || it.shape === "float-box" || it.shape === "zero-box") {
      var zero = it.shape === "zero-box";
      el("rect", {
        x: it.x - it.w / 2, y: it.y - it.h / 2, width: it.w, height: it.h, rx: 4,
        fill: zero ? "url(#bon-hatch)" : COLORS.boxFill,
        stroke: COLORS.blue, "stroke-width": 4,
        "stroke-dasharray": zero ? "9 7" : undefined
      }, item);
      fontPref = Math.min(38, Math.max(24, it.w * 0.4));
      var size = fitFont(it.label, it.w - 10, fontPref);
      el("text", { x: it.x, y: it.y, "font-size": size, fill: labelColor, "class": "bon-label" }, item)
        .textContent = it.label;
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
    el("path", { d: "M520,818 L780,818 L740,782 L560,782 Z", fill: COLORS.metal }, svg);
    el("rect", { x: PIVOT.x - 11, y: PIVOT.y, width: 22, height: 690, fill: COLORS.metal }, svg);
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

    function animateTo(target) {
      state.target = target;
      svg.setAttribute("data-target-angle", target.toFixed(3));
      if (state.anim) { root.cancelAnimationFrame(state.anim.id); state.anim = null; }
      if (reducedMotion() || Math.abs(target - state.angle) < 0.001) { place(target); return; }
      var from = state.angle, start = null;
      var anim = { id: 0 };
      function step(ts) {
        if (start === null) start = ts;
        var t = Math.min(1, (ts - start) / ANIM_MS);
        var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        place(from + (target - from) * e);
        if (t < 1) anim.id = root.requestAnimationFrame(step); else state.anim = null;
      }
      anim.id = root.requestAnimationFrame(step);
      state.anim = anim;
    }

    function drawPan(g, side, data, total) {
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
      el("text", { x: 0, y: 86, "font-size": 50, "class": "bon-total", "data-total": side }, g)
        .textContent = BON.exact.fmtH(total);
    }

    function update(opts) {
      var eq = opts.eq, xh = opts.xh;
      var cmp = BON.model.compare(eq, xh);
      var lay = layout(eq, xh);
      drawPan(pans.left, "left", lay.left, cmp.leftH);
      drawPan(pans.right, "right", lay.right, cmp.rightH);
      var target = opts.tilt === "level" ? 0 : tiltFor(cmp.leftH - cmp.rightH);
      title.textContent = "Balance. Left side " + BON.exact.fmtH(cmp.leftH) + ", right side " +
        BON.exact.fmtH(cmp.rightH) + ". " + (opts.tilt === "level" ? "The beam is held level." :
        cmp.heavier === "balanced" ? "The beam is level." : (cmp.heavier === "left" ? "Left" : "Right") + " side is down.");
      state.last = { cmp: cmp, layout: lay, target: target };
      svg.setAttribute("data-heavier", cmp.heavier);
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
