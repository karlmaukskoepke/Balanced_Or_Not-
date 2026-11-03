/*
 * The explorer: the vertical slider, the typed "x =" box, the balance, the x-box beside zero and the
 * readout row (left total, sign, right total), kept in step with each other. Used by the student page and
 * by the test page.
 *
 *   var ex = BON.createExplorer({ svg, sliderHost, form, input, msg, xbox, totL, totR, rel, relSr,
 *                                 onMove: function (x, style, how) {} });
 *   ex.show(eq, model, { build: true|false })   build: beam held level, boxes marked "x", no totals
 *   ex.setLocked(bool), ex.setFlicker(bool), ex.setX(x, style), ex.travelTo(x, style)
 */
(function (root) {
  "use strict";
  var BON = root.BON || (root.BON = {});
  var E = BON.exact, M = BON.model, F = BON.flow, G = BON.balanceGeometry;
  var TRAVEL_MAX_MS = 1000;

  function reducedMotion() { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); }

  function createExplorer(o) {
    var view = BON.createBalance(o.svg);
    var cur = { eq: null, model: null, build: false, x: E.frac(0), style: "int", locked: false };
    var travel = null, lastRel = null;
    var vs = BON.createVSlider(o.sliderHost, {
      min: -6, max: 6,
      onInput: function (x, style, how) { if (!cur.locked) { stopTravel(); setX(x, style); if (o.onMove) o.onMove(x, style, how); } }
    });
    o.sliderHost.querySelector(".vs-slot").appendChild(o.xbox);

    /* ---------- drawing ---------- */

    function drawXBox() {
      var box = o.xbox, px = view.unitPx() || 0.85;
      box.className = "xbox";
      if (cur.build || !cur.x) {
        box.classList.add("is-unknown");
        setSize(box, G.UNKNOWN_SIDE * px);
        box.firstChild.textContent = "x";
        box.setAttribute("aria-label", "x (no value yet)");
        return;
      }
      var s = E.fSign(cur.x), side = G.sizeOf(cur.x.n / cur.x.d) * px;
      if (s === 0) box.classList.add("is-zero");
      if (s < 0) box.classList.add("is-balloon");
      setSize(box, side);
      var t = E.fmtValue(cur.x, cur.style);
      box.firstChild.textContent = t;
      box.firstChild.style.fontSize = Math.max(10, Math.min(side * 0.5, (side - 6) / (t.length * 0.58))).toFixed(1) + "px";
      box.setAttribute("aria-label", "x = " + t);
    }
    function setSize(box, side) {
      box.style.width = box.style.height = side.toFixed(2) + "px";
      box.style.setProperty("--side", side.toFixed(2) + "px");
    }

    function drawReadout(cmp) {
      if (cur.build || !cmp) {
        o.totL.textContent = "?"; o.totR.textContent = "?";
        o.rel.textContent = ""; o.rel.className = "rel"; o.relSr.textContent = "";
        lastRel = null;
        return;
      }
      o.totL.textContent = E.fmtValue(cmp.left, cur.style);
      o.totR.textContent = E.fmtValue(cmp.right, cur.style);
      var r = cmp.heavier === "left" ? ">" : cmp.heavier === "right" ? "<" : "=";
      o.rel.textContent = r;
      o.rel.className = "rel " + (r === ">" ? "is-gt" : r === "<" ? "is-lt" : "is-eq");
      o.rel.setAttribute("data-rel", r);
      if (r === "=" && lastRel !== "=" && lastRel !== null && !reducedMotion()) {
        o.rel.classList.add("is-arriving");
      }
      if (r !== lastRel) {
        o.relSr.textContent = cmp.heavier === "balanced" ? "Balanced: both sides are " + o.totL.textContent + "." :
          (cmp.heavier === "left" ? "Left" : "Right") + " is heavier.";
      }
      lastRel = r;
    }

    function redraw() {
      if (!cur.eq) return;
      var last = view.update({ eq: cur.eq, model: cur.model, x: cur.build ? null : cur.x, style: cur.style,
        tilt: cur.build ? "level" : "live", settle: true });
      drawXBox();
      drawReadout(last.cmp);
    }

    /* ---------- moving x ---------- */

    function setX(x, style) {
      cur.x = x; cur.style = style;
      vs.setValue(x, style);
      redraw();
    }
    function stopTravel() { if (travel) { cancelAnimationFrame(travel.id); travel = null; } }

    /* The thumb travels to a typed value (about 1 s at most), the balance following; then it lands exactly. */
    function travelTo(x, style, done) {
      stopTravel();
      var from = cur.x.n / cur.x.d, to = x.n / x.d;
      var land = function () { travel = null; setX(x, style); if (done) done(); };
      if (reducedMotion() || Math.abs(to - from) < 0.005) { land(); return; }
      var ms = Math.min(TRAVEL_MAX_MS, 300 + 60 * Math.abs(to - from)), start = null;
      travel = { id: 0 };
      var step = function (ts) {
        if (start === null) start = ts;
        var t = Math.min(1, (ts - start) / ms);
        if (t >= 1) { land(); return; }
        var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        var h = Math.round((from + (to - from) * e) * 100);
        cur.x = E.frac(h, 100); cur.style = "decimal";
        vs.setPos(h / 100);
        redraw();
        travel.id = requestAnimationFrame(step);
      };
      travel.id = requestAnimationFrame(step);
    }

    o.form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (cur.locked || !cur.eq) return;
      var r = F.readX(cur.eq, o.input.value);
      if (!r.ok) { o.msg.textContent = r.message; o.input.select(); return; }
      o.msg.textContent = "";
      travelTo(r.value, r.style, function () { if (o.onMove) o.onMove(r.value, r.style, "typed"); });
    });
    o.input.addEventListener("input", function () {
      var p = E.parseNumber(o.input.value);
      o.msg.textContent = !p.ok && p.partial && o.input.value.trim() !== "" ? F.TEXT.notNumberYet : "";
    });
    o.rel.addEventListener("animationend", function () { o.rel.classList.remove("is-arriving"); });
    root.addEventListener("resize", drawXBox);

    function show(eq, model, opts) {
      opts = opts || {};
      stopTravel();
      cur.eq = eq; cur.model = model; cur.build = !!opts.build;
      if (opts.x) { cur.x = opts.x; cur.style = opts.style || "decimal"; }
      vs.setValue(cur.x, cur.style);
      lastRel = null;
      redraw();
    }
    function setLocked(l) {
      cur.locked = !!l;
      vs.setDisabled(!!l);
      o.input.disabled = !!l;
      o.form.querySelector("button").disabled = !!l;
      if (l) o.msg.textContent = "";
    }

    return {
      show: show, setX: setX, travelTo: travelTo, setLocked: setLocked, redraw: redraw,
      setFlicker: function (f) { vs.setFlicker(f && !reducedMotion()); o.sliderHost.classList.toggle("is-broken", !!f); },
      current: function () { return { x: cur.x, style: cur.style }; },
      view: view, slider: vs
    };
  }

  BON.createExplorer = createExplorer;
})(typeof window !== "undefined" ? window : globalThis);
