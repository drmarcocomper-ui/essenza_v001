// cadastro.js (JSONP - sem CORS)
// Requer: assets/js/config.js (window.APP_CONFIG.SCRIPT_URL)
// Requer: assets/js/auth.js (window.EssenzaAuth)
// ✅ ID_Cliente é gerado automaticamente AO SALVAR (sem botão Gerar ID)
// ✅ ID não é exibido ao usuário (input hidden no HTML)

(() => {
  "use strict";

  const SCRIPT_URL = window.APP_CONFIG?.SCRIPT_URL || "";
  const SHEET_NAME = "Cadastro";

  // =========================
  // DOM
  // =========================
  const formCadastro = document.getElementById("formCadastro");
  const formBusca = document.getElementById("formBusca");
  const btnBuscar = document.getElementById("btnBuscar");

  const feedback = document.getElementById("feedback");

  // ID (hidden)
  const elIdCliente = document.getElementById("idCliente");

  const elNome = document.getElementById("nomeCliente");
  const elTelefone = document.getElementById("telefone");
  const elEmail = document.getElementById("email");
  const elDataNascimento = document.getElementById("dataNascimento");
  const elMunicipio = document.getElementById("municipio");
  const elBairro = document.getElementById("bairro");
  const elDataCadastro = document.getElementById("dataCadastro");
  const elProfissao = document.getElementById("profissao");
  const elPreferencias = document.getElementById("preferencias");
  const elOrigem = document.getElementById("origem");
  const elObservacao = document.getElementById("observacao");

  const elQuery = document.getElementById("q");
  const tabelaResultados = document.getElementById("tabelaResultados");
  const tbodyResultados = tabelaResultados ? tabelaResultados.querySelector("tbody") : null;

  // =========================
  // Helpers
  // =========================
  function setFeedback(msg, type = "info") {
    if (!feedback) return;
    feedback.textContent = msg || "";
    feedback.dataset.type = type;
  }

  function hojeISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function sanitizePhone(v) {
    return (v || "").replace(/[^\d()+\-\s]/g, "").trim();
  }

  function normalizeText(v) {
    return (v || "").toString().trim();
  }

  function requireScriptUrl() {
    if (!SCRIPT_URL || !SCRIPT_URL.includes("/exec")) {
      setFeedback("SCRIPT_URL inválida. Ajuste no assets/js/config.js (precisa terminar em /exec).", "error");
      return false;
    }
    return true;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // =========================
  // JSONP
  // =========================
  function jsonpRequest(params) {
    return new Promise((resolve, reject) => {
      const cb = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout na chamada ao Apps Script."));
      }, 20000);

      let script;

      function cleanup() {
        clearTimeout(timeout);
        try { delete window[cb]; } catch (_) {}
        if (script && script.parentNode) script.parentNode.removeChild(script);
      }

      window[cb] = (data) => {
        cleanup();

        // Verificar se erro de autenticação
        if (data && data.code === "AUTH_ERROR" && window.EssenzaAuth) {
          window.EssenzaAuth.redirectToLogin();
          return;
        }

        resolve(data);
      };

      // Injetar token de autenticação
      const token = window.EssenzaAuth?.getToken?.() || "";
      const paramsWithToken = { ...params, token, callback: cb };

      const qs = new URLSearchParams(paramsWithToken).toString();
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

  // =========================
  // Payload
  // =========================
  function buildCadastroPayload() {
    return {
      // ✅ NÃO envia ID_Cliente (backend gera)
      NomeCliente: normalizeText(elNome?.value),
      Telefone: sanitizePhone(elTelefone?.value),
      "E-mail": normalizeText(elEmail?.value),
      DataNascimento: normalizeText(elDataNascimento?.value),
      Municipio: normalizeText(elMunicipio?.value),
      Bairro: normalizeText(elBairro?.value),
      DataCadastro: normalizeText(elDataCadastro?.value),
      "Profissão": normalizeText(elProfissao?.value),
      "Preferências": normalizeText(elPreferencias?.value),
      Origem: normalizeText(elOrigem?.value),
      "Observação": normalizeText(elObservacao?.value),
    };
  }

  // =========================
  // Results table
  // =========================
  function clearResults() {
    if (!tbodyResultados) return;
    tbodyResultados.innerHTML = "";
  }

  function renderResults(items) {
    clearResults();
    if (!tbodyResultados) return;

    if (!Array.isArray(items) || items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="4">Nenhum resultado.</td>`;
      tbodyResultados.appendChild(tr);
      return;
    }

    items.forEach((it) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(it.NomeCliente ?? "")}</td>
        <td>${escapeHtml(it.Telefone ?? "")}</td>
        <td>${escapeHtml(it.Municipio ?? "")}</td>
        <td>${escapeHtml(it.Bairro ?? "")}</td>
      `;
      tbodyResultados.appendChild(tr);
      tr.addEventListener("click", () => fillFormFromItem(it));
    });
  }

  function fillFormFromItem(it) {
    if (!it) return;

    // mantém o ID no hidden (para referência interna, se quiser)
    if (elIdCliente) elIdCliente.value = it.ID_Cliente ?? "";

    if (elNome) elNome.value = it.NomeCliente ?? "";
    if (elTelefone) elTelefone.value = it.Telefone ?? "";
    if (elEmail) elEmail.value = it["E-mail"] ?? it.Email ?? "";
    if (elDataNascimento) elDataNascimento.value = it.DataNascimento ?? "";
    if (elMunicipio) elMunicipio.value = it.Municipio ?? "";
    if (elBairro) elBairro.value = it.Bairro ?? "";
    if (elDataCadastro) elDataCadastro.value = it.DataCadastro ?? "";
    if (elProfissao) elProfissao.value = it["Profissão"] ?? it.Profissao ?? "";
    if (elPreferencias) elPreferencias.value = it["Preferências"] ?? it.Preferencias ?? "";
    if (elOrigem) elOrigem.value = it.Origem ?? "";
    if (elObservacao) elObservacao.value = it["Observação"] ?? it.Observacao ?? "";

    setFeedback("Cliente carregado no formulário.", "info");
  }

  // =========================
  // Actions
  // =========================
  async function salvarCadastro() {
    if (!requireScriptUrl()) return;

    const nome = normalizeText(elNome?.value);
    const tel = sanitizePhone(elTelefone?.value);

    if (!nome || !tel) {
      setFeedback("Preencha Nome e Telefone.", "error");
      return;
    }

    if (elDataCadastro && !elDataCadastro.value) elDataCadastro.value = hojeISO();

    // ✅ limpa o hidden ID antes de salvar (para garantir que o backend gere)
    if (elIdCliente) elIdCliente.value = "";

    setFeedback("Salvando...", "info");
    try {
      const payload = buildCadastroPayload();

      const data = await jsonpRequest({
        action: "Clientes.Criar",
        sheet: SHEET_NAME,
        payload: JSON.stringify(payload),
      });

      if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao salvar.");

      // backend retorna id gerado (mantemos no hidden)
      if (data.id && elIdCliente) elIdCliente.value = data.id;

      // ✅ não mostra ID para o usuário
      setFeedback(data.message || "Cadastro salvo.", "success");

      // opcional: limpar campos após salvar (mantém DataCadastro)
      // formCadastro?.reset(); initDefaults();

    } catch (err) {
      setFeedback(err.message || "Erro ao salvar cadastro.", "error");
    }
  }

  async function buscarClientes() {
    if (!requireScriptUrl()) return;

    const q = normalizeText(elQuery?.value);
    if (!q) {
      setFeedback("Digite algo para buscar (nome/telefone/email).", "error");
      return;
    }

    setFeedback("Buscando...", "info");
    try {
      const data = await jsonpRequest({
        action: "Clientes.Buscar",
        sheet: SHEET_NAME,
        q,
      });

      if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro na busca.");

      renderResults(data.items || []);
      setFeedback(`Resultados: ${(data.items || []).length}`, "success");
    } catch (err) {
      setFeedback(err.message || "Erro na busca.", "error");
    }
  }

  // =========================
  // Init
  // =========================
  function initDefaults() {
    if (elDataCadastro && !elDataCadastro.value) elDataCadastro.value = hojeISO();
  }

  function bindEvents() {
    if (formCadastro) formCadastro.addEventListener("submit", (e) => (e.preventDefault(), salvarCadastro()));
    if (btnBuscar) btnBuscar.addEventListener("click", (e) => (e.preventDefault(), buscarClientes()));
    if (formBusca) formBusca.addEventListener("submit", (e) => (e.preventDefault(), buscarClientes()));
  }

  initDefaults();
  bindEvents();
})();
