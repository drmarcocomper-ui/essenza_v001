// login.js — Lógica do formulário de login
// Requer: config.js (window.APP_CONFIG)

(() => {
  "use strict";

  const SCRIPT_URL = window.APP_CONFIG?.SCRIPT_URL || "";
  const TOKEN_KEY = window.APP_CONFIG?.AUTH?.TOKEN_KEY || "essenza_auth_token";

  // DOM
  const form = document.getElementById("formLogin");
  const inputSenha = document.getElementById("senha");
  const btnEntrar = document.getElementById("btnEntrar");
  const feedback = document.getElementById("loginFeedback");

  // ============================
  // Helpers
  // ============================
  function setFeedback(msg, type = "info") {
    if (!feedback) return;
    feedback.textContent = msg || "";
    feedback.dataset.type = type;
  }

  function setLoading(loading) {
    if (btnEntrar) {
      btnEntrar.disabled = loading;
      btnEntrar.textContent = loading ? "Entrando..." : "Entrar";
    }
    if (inputSenha) {
      inputSenha.disabled = loading;
    }
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function setToken(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token || "");
    } catch (e) {
      // localStorage não disponível
    }
  }

  // ============================
  // JSONP Request
  // ============================
  function jsonpRequest(params) {
    return new Promise((resolve, reject) => {
      const cb = "login_cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout na comunicação com o servidor."));
      }, 20000);

      let script;

      function cleanup() {
        clearTimeout(timeout);
        try { delete window[cb]; } catch (_) {}
        if (script && script.parentNode) script.parentNode.removeChild(script);
      }

      window[cb] = (data) => {
        cleanup();
        resolve(data);
      };

      const qs = new URLSearchParams({ ...params, callback: cb }).toString();
      const url = `${SCRIPT_URL}?${qs}`;

      script = document.createElement("script");
      script.src = url;
      script.onerror = () => {
        cleanup();
        reject(new Error("Falha na comunicação com o servidor."));
      };
      document.head.appendChild(script);
    });
  }

  // ============================
  // Login
  // ============================
  async function doLogin() {
    const senha = (inputSenha?.value || "").trim();

    if (!senha) {
      setFeedback("Digite sua senha.", "error");
      inputSenha?.focus();
      return;
    }

    if (!SCRIPT_URL || !SCRIPT_URL.includes("/exec")) {
      setFeedback("Erro de configuração. Contate o administrador.", "error");
      return;
    }

    setLoading(true);
    setFeedback("Verificando...", "info");

    try {
      const data = await jsonpRequest({
        action: "Auth.Login",
        password: senha
      });

      if (!data) {
        throw new Error("Resposta inválida do servidor.");
      }

      if (data.ok !== true) {
        // Login falhou
        setFeedback(data.message || "Senha incorreta.", "error");
        if (inputSenha) {
          inputSenha.value = "";
          inputSenha.focus();
        }
        setLoading(false);
        return;
      }

      // Login bem-sucedido
      if (!data.token) {
        throw new Error("Token não recebido do servidor.");
      }

      setToken(data.token);
      setFeedback("Login realizado! Redirecionando...", "success");

      // Redirecionar para página principal
      setTimeout(() => {
        window.location.href = "index.html";
      }, 500);

    } catch (err) {
      setFeedback(err.message || "Erro ao fazer login.", "error");
      setLoading(false);
    }
  }

  // ============================
  // Verificar se já está logado
  // ============================
  async function checkExistingSession() {
    const token = getToken();

    if (!token) return;

    // Verificar se token é válido
    try {
      const data = await jsonpRequest({
        action: "Auth.Validate",
        token: token
      });

      if (data && data.ok === true && data.valid === true) {
        // Já está logado, redirecionar
        window.location.href = "index.html";
      }
    } catch (_) {
      // Token inválido ou erro, continuar na página de login
    }
  }

  // ============================
  // Bind Events
  // ============================
  function bind() {
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        doLogin();
      });
    }
  }

  // ============================
  // Init
  // ============================
  bind();
  checkExistingSession();
})();
