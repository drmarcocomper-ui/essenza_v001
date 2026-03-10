// lazy-cdn.js — Carregamento sob demanda de bibliotecas CDN
// Carrega Chart.js, XLSX, jsPDF apenas quando necessário
(() => {
  "use strict";

  var loaded = {};

  function loadScript(src, integrity) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise(function(resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      if (integrity) s.integrity = integrity;
      s.crossOrigin = "anonymous";
      s.onload = resolve;
      s.onerror = function() { reject(new Error("Falha ao carregar: " + src)); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }

  var CDN = {
    chartjs: {
      src: "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js",
      integrity: "sha384-9nhczxUqK87bcKHh20fSQcTGD4qq5GhayNYSYWqwBkINBhOfQLg/P5HG5lF1urn4",
      check: function() { return typeof Chart !== "undefined"; }
    },
    xlsx: {
      src: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
      integrity: "sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw",
      check: function() { return typeof XLSX !== "undefined"; }
    },
    jspdf: {
      src: "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
      integrity: "sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk",
      check: function() { return typeof jspdf !== "undefined"; }
    },
    jspdfAutotable: {
      src: "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.1/dist/jspdf.plugin.autotable.min.js",
      integrity: "sha384-b8MpgG2ZzWN6OPAtiB1JiBmDr9MpTt3NKK6KQf61hC/L7X4wJrvoTeVmMFPgp3nL",
      check: function() { return typeof jspdf !== "undefined" && typeof jspdf.jsPDF !== "undefined" && typeof jspdf.jsPDF.prototype.autoTable === "function"; }
    }
  };

  /**
   * Carrega uma biblioteca CDN sob demanda.
   * @param {string} name - Nome: "chartjs", "xlsx", "jspdf", "jspdfAutotable"
   * @returns {Promise}
   */
  function requireLib(name) {
    var lib = CDN[name];
    if (!lib) return Promise.reject(new Error("Biblioteca desconhecida: " + name));
    if (lib.check()) return Promise.resolve();
    return loadScript(lib.src, lib.integrity);
  }

  /**
   * Carrega múltiplas bibliotecas CDN.
   * @param {...string} names - Nomes das bibliotecas
   * @returns {Promise}
   */
  function requireLibs() {
    var promises = [];
    for (var i = 0; i < arguments.length; i++) {
      promises.push(requireLib(arguments[i]));
    }
    return Promise.all(promises);
  }

  window.EssenzaLazy = {
    require: requireLib,
    requireAll: requireLibs
  };
})();
