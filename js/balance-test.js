/*
 * Stage 1 test page: pick any of the 12 equations, type or slide x, watch the balance.
 * Address options (for sharing a ready-made check): ?eq=3&x=1.33&rm=1  (rm=1 pretends reduce-motion is on)
 */
(function () {
  "use strict";
  var BON = window.BON, E = BON.exact, M = BON.model;
  var MAX_ABS_H = 9999; // typed values are kept within −99.99 … 99.99

  var $ = function (id) { return document.getElementById(id); };
  var picker = $("picker"), input = $("x-input"), slider = $("x-slider"), err = $("x-error");
  var balanceOptions = {};
  var view = BON.createBalance($("balance"), balanceOptions);

  var params = new URLSearchParams(location.search);
  var state = { eqIndex: 0, xh: 0 };
  var startEq = parseInt(params.get("eq"), 10);
  if (startEq >= 1 && startEq <= BON.EQUATIONS.length) state.eqIndex = startEq - 1;
  var startX = params.get("x") !== null ? E.parseDecimalToHundredths(params.get("x")) : null;
  if (startX !== null) state.xh = clampH(startX);
  if (params.get("rm") === "1") { $("opt-reduced").checked = true; balanceOptions.reducedMotion = true; }

  function clampH(h) { return Math.max(-MAX_ABS_H, Math.min(MAX_ABS_H, h)); }
  function eq() { return BON.EQUATIONS[state.eqIndex]; }

  BON.EQUATIONS.forEach(function (q, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "eq-pick";
    b.textContent = q.id;
    b.setAttribute("aria-label", "Equation " + q.id);
    b.addEventListener("click", function () { state.eqIndex = i; render({ fromPicker: true }); });
    picker.appendChild(b);
  });

  function render(how) {
    how = how || {};
    var q = eq();
    Array.prototype.forEach.call(picker.children, function (b, i) {
      b.setAttribute("aria-pressed", i === state.eqIndex ? "true" : "false");
    });
    $("eq-number").textContent = q.id;
    BON.renderEquation($("eq-display"), q, { emphasis: q.part === 2 });
    slider.min = q.sliderRange[0]; slider.max = q.sliderRange[1];
    $("slider-min").textContent = E.fmtH(q.sliderRange[0] * 100);
    $("slider-max").textContent = E.fmtH(q.sliderRange[1] * 100);
    if (!how.fromSlider) {
      var lo = q.sliderRange[0] * 100, hi = q.sliderRange[1] * 100;
      slider.value = E.fmtHAscii(Math.max(lo, Math.min(hi, state.xh)));
    }
    if (!how.fromTyping) { input.value = E.fmtH(state.xh); err.textContent = ""; }

    var x = E.fromHundredths(state.xh);
    var last = view.update({ eq: q, x: x, style: "decimal", tilt: "live" });
    $("readout-left").textContent = M.substitutionLine(q.left, x, "decimal");
    $("readout-right").textContent = M.substitutionLine(q.right, x, "decimal");
    $("readout-result").textContent = "x = " + E.fmtH(state.xh) + ". " + M.resultText(last.cmp, "decimal") + ".";

    var u = new URL(location.href);
    u.searchParams.set("eq", q.id);
    u.searchParams.set("x", E.fmtHAscii(state.xh));
    history.replaceState(null, "", u);
  }

  input.addEventListener("input", function () {
    var h = E.parseDecimalToHundredths(input.value);
    if (h === null) {
      err.textContent = input.value.trim() === "" || input.value.trim() === "-" || input.value.trim() === "−"
        ? "" : "Type a number, like 2 or −1.5";
      return;
    }
    err.textContent = Math.abs(h) > MAX_ABS_H ? "Keep x between −99.99 and 99.99 here." : "";
    state.xh = clampH(h);
    render({ fromTyping: true });
  });
  input.addEventListener("blur", function () { input.value = E.fmtH(state.xh); err.textContent = ""; });
  input.addEventListener("keydown", function (e) {
    var step = 0;
    if (e.key === "ArrowUp") step = e.shiftKey ? 1 : 100;
    if (e.key === "ArrowDown") step = e.shiftKey ? -1 : -100;
    if (e.key === "Enter") { input.value = E.fmtH(state.xh); return; }
    if (!step) return;
    e.preventDefault();
    state.xh = clampH(state.xh + step);
    render();
  });

  slider.addEventListener("input", function () {
    var h = E.parseDecimalToHundredths(slider.value);
    if (h === null) return;
    state.xh = h;
    render({ fromSlider: true });
  });
  // Page Up / Page Down move the slider by 1 (browsers differ on their own big step)
  slider.addEventListener("keydown", function (e) {
    var step = e.key === "PageUp" ? 100 : e.key === "PageDown" ? -100 : 0;
    if (!step) return;
    e.preventDefault();
    var q = eq();
    state.xh = Math.max(q.sliderRange[0] * 100, Math.min(q.sliderRange[1] * 100, state.xh + step));
    render();
  });

  $("opt-reduced").addEventListener("change", function (e) {
    balanceOptions.reducedMotion = e.target.checked ? true : undefined;
  });

  render();
})();
