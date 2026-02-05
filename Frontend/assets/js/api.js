// api.js — Cliente JSONP centralizado
// Requer: config.js (window.APP_CONFIG)
// Requer: auth.js (window.EssenzaAuth) - opcional, para injeção de token

(() => {
  "use strict";

  const SCRIPT_URL = window.APP_CONFIG?.SCRIPT_URL || "";

  /**
   * Faz requisição JSONP para o Apps Script
   * - Injeta token de autenticação automaticamente
   * - Redireciona para login em caso de AUTH_ERROR
   *
   * @param {Object} params - Parâmetros da requisição
   * @param {Object} options - Opções adicionais
   * @param {number} options.timeout - Timeout em ms (default: 20000)
   * @param {boolean} options.skipAuth - Não injetar token (default: false)
   * @returns {Promise<Object>} Resposta do servidor
   */
  function jsonpRequest(params, options = {}) {
    const timeout = options.timeout || 20000;
    const skipAuth = options.skipAuth || false;

    return new Promise((resolve, reject) => {
      if (!SCRIPT_URL || !SCRIPT_URL.includes("/exec")) {
        reject(new Error("SCRIPT_URL inválida. Ajuste em config.js."));
        return;
      }

      const cb = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout na chamada ao Apps Script."));
      }, timeout);

      let script;

      function cleanup() {
        clearTimeout(timeoutId);
        try { delete window[cb]; } catch (_) {}
        if (script && script.parentNode) script.parentNode.removeChild(script);
      }

      window[cb] = (data) => {
        cleanup();

        // Verificar erro de autenticação
        if (data && data.code === "AUTH_ERROR" && window.EssenzaAuth) {
          window.EssenzaAuth.redirectToLogin();
          return;
        }

        resolve(data);
      };

      // Montar parâmetros
      const finalParams = { ...params, callback: cb };

      // Injetar token (exceto se skipAuth)
      if (!skipAuth && window.EssenzaAuth?.getToken) {
        const token = window.EssenzaAuth.getToken();
        if (token) {
          finalParams.token = token;
        }
      }

      const qs = new URLSearchParams(finalParams).toString();
      const url = `${SCRIPT_URL}?${qs}`;

      script = document.createElement("script");
      script.src = url;
      script.onerror = () => {
        cleanup();
        reject(new Error("Falha ao carregar JSONP (script)."));
      };
      document.head.appendChild(script);
    });
  }

  // Expor globalmente
  window.EssenzaApi = {
    request: jsonpRequest,
    getScriptUrl: () => SCRIPT_URL
  };
})();
