/*
 * Test page: any of the 12 equations, pre-built, slider always on.
 * Address options: ?eq=3&x=1.33 (x may be a fraction like 4/3), &rm=1 has no effect (use the OS setting).
 */
(function () {
  "use strict";
  var BON = window.BON, E = BON.exact, M = BON.model;
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var ex = BON.createExplorer({
    svg: $("balance"), sliderHost: $("vslider"), form: $("x-form"), input: $("x-input"), msg: $("x-msg"),
    xbox: $("xbox"), totL: $("tot-left"), totR: $("tot-right"), rel: $("rel"), relSr: $("rel-sr"),
    onMove: function (x, style) { remember(x, style); }
  });
  var current = 0;
  function remember(x, style) {
    var u = new URL(location.href);
    u.searchParams.set("eq", BON.EQUATIONS[current].id);
    u.searchParams.set("x", E.fmtValueAscii(x, style));
    history.replaceState(null, "", u);
  }
  function load(i, x, style) {
    current = i;
    var eq = BON.EQUATIONS[i];
    Array.prototype.forEach.call($("picker").children, function (b, k) { b.setAttribute("aria-pressed", k === i ? "true" : "false"); });
    $("eq-number").textContent = eq.id;
    BON.renderEquation($("eq-display"), eq, { emphasis: eq.part === 2 });
    $("test-note").textContent = eq.note;
    ex.setLocked(false);
    ex.show(eq, M.modelFromEquation(eq), { build: false, x: x || ex.current().x, style: style || ex.current().style });
    remember(ex.current().x, ex.current().style);
  }
  BON.EQUATIONS.forEach(function (eq, i) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = eq.id; b.setAttribute("aria-label", "Equation " + eq.id);
    b.addEventListener("click", function () { load(i); });
    $("picker").appendChild(b);
  });
  var start = Math.max(0, Math.min(11, (parseInt(params.get("eq"), 10) || 1) - 1));
  var px = params.get("x") !== null ? E.parseNumber(params.get("x")) : null;
  if (px && px.ok && BON.flow.inRange(BON.EQUATIONS[start], px.value)) load(start, px.value, px.style);
  else load(start, E.frac(0), "int");
})();
