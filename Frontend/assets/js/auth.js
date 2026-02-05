// auth.js — Utilitários de autenticação (compartilhado)
// Requer: config.js (window.APP_CONFIG)
// Deve ser carregado ANTES dos scripts de página

(() => {
  "use strict";

  const SCRIPT_URL = window.APP_CONFIG?.SCRIPT_URL || "";
  const TOKEN_KEY = window.APP_CONFIG?.AUTH?.TOKEN_KEY || "essenza_auth_token";
  const LOGIN_PAGE = window.APP_CONFIG?.AUTH?.LOGIN_PAGE || "login.html";

  // ============================
  // Token Storage
  // ============================
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

  function clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      // localStorage não disponível
    }
  }

  // ============================
  // JSONP Request (interno)
  // ============================
  function jsonpRequest(params) {
    return new Promise((resolve, reject) => {
      const cb = "auth_cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout na verificação de autenticação."));
      }, 15000);

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
        reject(new Error("Falha na requisição de autenticação."));
      };
      document.head.appendChild(script);
    });
  }

  // ============================
  // Verificar Sessão (Server-side)
  // ============================
  async function validateSession() {
    const token = getToken();

    if (!token) {
      return { valid: false, reason: "no_token" };
    }

    try {
      const data = await jsonpRequest({
        action: "Auth.Validate",
        token: token
      });

      if (data && data.ok === true && data.valid === true) {
        return { valid: true };
      }

      return { valid: false, reason: data?.message || "invalid" };
    } catch (err) {
      return { valid: false, reason: err.message || "error" };
    }
  }

  // ============================
  // Redirecionar para Login
  // ============================
  function redirectToLogin() {
    clearToken();

    // Evitar loop se já estiver no login
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    if (currentPage === LOGIN_PAGE || currentPage === "login.html") {
      return;
    }

    window.location.href = LOGIN_PAGE;
  }

  // ============================
  // Logout
  // ============================
  async function logout() {
    const token = getToken();

    // Fire & forget - chamar logout no servidor
    if (token && SCRIPT_URL) {
      try {
        jsonpRequest({
          action: "Auth.Logout",
          token: token
        }).catch(() => {}); // Ignorar erros
      } catch (_) {}
    }

    clearToken();
    redirectToLogin();
  }

  // ============================
  // Verificar Auth no Carregamento
  // ============================
  async function checkAuthOnLoad() {
    // Não verificar na página de login
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    if (currentPage === LOGIN_PAGE || currentPage === "login.html") {
      return;
    }

    const result = await validateSession();

    if (!result.valid) {
      redirectToLogin();
    }
  }

  // ============================
  // Injetar Botão de Logout na Nav
  // ============================
  function injectLogoutButton() {
    const nav = document.querySelector(".app-nav");
    if (!nav) return;

    // Verificar se já existe
    if (nav.querySelector(".app-nav__link--logout")) return;

    const btn = document.createElement("a");
    btn.href = "#";
    btn.className = "app-nav__link app-nav__link--logout";
    btn.textContent = "Sair";
    btn.style.marginLeft = "auto";

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });

    nav.appendChild(btn);
  }

  // ============================
  // Expor para uso global
  // ============================
  window.EssenzaAuth = {
    getToken,
    setToken,
    clearToken,
    validateSession,
    redirectToLogin,
    logout,
    checkAuthOnLoad,
    injectLogoutButton
  };

  // ============================
  // Auto-init ao carregar DOM
  // ============================
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      checkAuthOnLoad();
      injectLogoutButton();
    });
  } else {
    // DOM já carregado
    checkAuthOnLoad();
    injectLogoutButton();
  }
})();
