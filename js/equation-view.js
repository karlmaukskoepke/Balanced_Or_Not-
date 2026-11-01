/*
 * Draws an equation as HTML text with x-terms in the sheet's blue (and, in Part 2, a light tint behind them).
 * Blue is never the only cue: x-terms are also the only terms containing the letter x.
 */
(function (root) {
  "use strict";
  var BON = root.BON || (root.BON = {});

  function renderEquation(container, eq, opts) {
    opts = opts || {};
    container.textContent = "";
    container.classList.add("eqn");
    container.classList.toggle("eqn--emphasis", !!opts.emphasis);
    function side(terms) {
      BON.model.sidePieces(terms).forEach(function (p) {
        var span = document.createElement("span");
        span.textContent = p.text;
        span.className = p.isX ? "eqn-x" : p.isOp ? "eqn-op" : "eqn-c";
        container.appendChild(span);
      });
    }
    side(eq.left);
    var eqSign = document.createElement("span");
    eqSign.className = "eqn-eq";
    eqSign.textContent = " = ";
    container.appendChild(eqSign);
    side(eq.right);
  }

  BON.renderEquation = renderEquation;
})(typeof window !== "undefined" ? window : globalThis);
