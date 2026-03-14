// login.js — Lógica do formulário de login
// Requer: config.js, utils.js, api.js, auth.js

(() => {
  "use strict";

  const SCRIPT_URL = window.APP_CONFIG?.SCRIPT_URL || "";
  let _logging = false;

  // DOM
  const form = document.getElementById("formLogin");
  const inputSenha = document.getElementById("senha");
  const btnEntrar = document.getElementById("btnEntrar");
  const feedback = document.getElementById("loginFeedback");

  // ============================
  // Helpers (delegam para módulos compartilhados)
  // ============================
  function setFeedback(msg, type) {
    window.EssenzaUtils?.setFeedback(feedback, msg, type || "info");
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

  // ============================
  // Login
  // ============================
  async function doLogin() {
    if (_logging) return;
    _logging = true;
    const senha = (inputSenha?.value || "").trim();

    if (!senha) {
      setFeedback("Digite sua senha.", "error");
      inputSenha?.focus();
      _logging = false;
      return;
    }

    if (!SCRIPT_URL || !SCRIPT_URL.includes("/exec")) {
      setFeedback("Erro de configuração. Contate o administrador.", "error");
      _logging = false;
      return;
    }

    setLoading(true);
    setFeedback("Verificando...", "info");

    try {
      const data = await window.EssenzaApi.request({
        action: "Auth.Login",
        password: senha
      }, { skipAuth: true });

      if (!data) {
        throw new Error("Resposta inválida do servidor.");
      }

      if (data.ok !== true) {
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

      window.EssenzaAuth.setToken(data.token);
      setFeedback("Login realizado! Redirecionando...", "success");

      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 500);

    } catch (err) {
      setFeedback(err.message || "Erro ao fazer login.", "error");
      setLoading(false);
    } finally {
      _logging = false;
    }
  }

  // ============================
  // Verificar se já está logado
  // ============================
  async function checkExistingSession() {
    const token = window.EssenzaAuth?.getToken();
    if (!token) return;

    try {
      const data = await window.EssenzaApi.request({
        action: "Auth.Validate",
        token: token
      }, { skipAuth: true });

      if (data && data.ok === true && data.valid === true) {
        window.location.href = "dashboard.html";
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
