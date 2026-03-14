// auth.js — Utilitários de autenticação (compartilhado)
// Requer: config.js (window.APP_CONFIG), api.js (window.EssenzaApi)
// Deve ser carregado APÓS api.js e ANTES dos scripts de página

(() => {
  "use strict";

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
  // Verificar Sessão (Server-side)
  // ============================
  async function validateSession() {
    const token = getToken();

    if (!token) {
      return { valid: false, reason: "no_token" };
    }

    try {
      const data = await window.EssenzaApi.request({
        action: "Auth.Validate",
        token: token
      }, { skipAuth: true, timeout: 15000 });

      if (data && data.ok === true && data.valid === true) {
        return { valid: true };
      }

      // Servidor respondeu explicitamente que token e invalido
      return { valid: false, reason: data?.message || "invalid" };
    } catch (err) {
      // Falha de rede/timeout — não permitir acesso sem validação
      return { valid: false, reason: "network_error" };
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
    if (token && window.EssenzaApi) {
      try {
        window.EssenzaApi.request({
          action: "Auth.Logout",
          token: token
        }, { skipAuth: true }).catch(() => {});
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

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "app-nav__link app-nav__link--logout";
    btn.textContent = "Sair";
    btn.style.marginLeft = "auto";
    btn.setAttribute("aria-label", "Sair do sistema");

    btn.addEventListener("click", () => {
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
