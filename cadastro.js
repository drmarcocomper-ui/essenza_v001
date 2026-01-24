// cadastro.js (JSONP - sem CORS)
// Requer Code.gs com doGet que responde JSONP (callback)

(() => {
  "use strict";

  // ✅ COLE AQUI SEU /exec (use o mesmo que você está testando no navegador)
  const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbwPmF0ebcKJJi3S-2qTyWUIjEVQKDK607ptKxsj8jNNXDVJ_-tdr9pCyehQSuAR9Q1pEw/exec";

  const SHEET_NAME = "Cadastro";

  // =========================
  // DOM
  // =========================
  const formCadastro = document.getElementById("formCadastro");
  const formBusca = document.getElementById("formBusca");

  const btnGerarId = document.getElementById("btnGerarId");
  const btnBuscar = document.getElementById("btnBuscar");

  const feedback = document.getElementById("feedback");

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
  // UI helpers
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
    return `${y}-${m}-${day}`; // value do input[type=date] deve ser YYYY-MM-DD
  }

  function sanitizePhone(v) {
    return (v || "").replace(/[^\d()+\-\s]/g, "").trim();
  }

  function normalizeText(v) {
    return (v || "").toString().trim();
  }

  function requireScriptUrl() {
    if (!SCRIPT_URL || !SCRIPT_URL.includes("/exec")) {
      setFeedback("SCRIPT_URL inválida. Cole a URL do Web App terminando em /exec.", "error");
      return false;
    }
    return true;
  }

  // =========================
  // JSONP (sem CORS)
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
        try {
          delete window[cb];
        } catch (_) {}
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
        reject(new Error("Falha ao carregar JSONP (script)."));
      };
      document.head.appendChild(script);
    });
  }

  // =========================
  // Payload (colunas)
  // =========================
  function buildCadastroPayload() {
    return {
      ID_Cliente: normalizeText(elIdCliente.value),
      NomeCliente: normalizeText(elNome.value),
      Telefone: sanitizePhone(elTelefone.value),
      "E-mail": normalizeText(elEmail.value),
      DataNascimento: normalizeText(elDataNascimento.value),
      Municipio: normalizeText(elMunicipio.value),
      Bairro: normalizeText(elBairro.value),
      DataCadastro: normalizeText(elDataCadastro.value),
      "Profissão": normalizeText(elProfissao.value),
      "Preferências": normalizeText(elPreferencias.value),
      Origem: normalizeText(elOrigem.value),
      "Observação": normalizeText(elObservacao.value),
    };
  }

  // =========================
  // Results table
  // =========================
  function clearResults() {
    if (!tbodyResultados) return;
    tbodyResultados.innerHTML = "";
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderResults(items) {
    clearResults();
    if (!tbodyResultados) return;

    if (!Array.isArray(items) || items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5">Nenhum resultado.</td>`;
      tbodyResultados.appendChild(tr);
      return;
    }

    items.forEach((it) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(it.ID_Cliente ?? "")}</td>
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

    elIdCliente.value = it.ID_Cliente ?? "";
    elNome.value = it.NomeCliente ?? "";
    elTelefone.value = it.Telefone ?? "";
    elEmail.value = it["E-mail"] ?? it.Email ?? "";
    elDataNascimento.value = it.DataNascimento ?? "";
    elMunicipio.value = it.Municipio ?? "";
    elBairro.value = it.Bairro ?? "";
    elDataCadastro.value = it.DataCadastro ?? "";
    elProfissao.value = it["Profissão"] ?? it.Profissao ?? "";
    elPreferencias.value = it["Preferências"] ?? it.Preferencias ?? "";
    elOrigem.value = it.Origem ?? "";
    elObservacao.value = it["Observação"] ?? it.Observacao ?? "";

    setFeedback("Cliente carregado no formulário (clique em salvar para gravar um novo).", "info");
  }

  // =========================
  // Actions
  // =========================
  async function gerarIdNoBackend() {
    if (!requireScriptUrl()) return;

    setFeedback("Gerando ID...", "info");
    try {
      const data = await jsonpRequest({
        action: "Clientes.GerarID",
        sheet: SHEET_NAME,
      });

      if (!data || data.ok !== true) throw new Error((data && data.message) || "Falha ao gerar ID.");
      if (!data.id) throw new Error("Backend não retornou 'id'.");

      elIdCliente.value = data.id;
      setFeedback("ID gerado.", "success");
    } catch (err) {
      setFeedback(err.message || "Erro ao gerar ID.", "error");
    }
  }

  async function salvarCadastro() {
    if (!requireScriptUrl()) return;

    const nome = normalizeText(elNome.value);
    const tel = sanitizePhone(elTelefone.value);

    if (!nome || !tel) {
      setFeedback("Preencha Nome e Telefone.", "error");
      return;
    }

    if (!elDataCadastro.value) elDataCadastro.value = hojeISO();

    setFeedback("Salvando...", "info");
    try {
      const payload = buildCadastroPayload();

      const data = await jsonpRequest({
        action: "Clientes.Criar",
        sheet: SHEET_NAME,
        payload: JSON.stringify(payload),
      });

      if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao salvar.");

      // se backend gerou ID, refletir
      if (data.id) elIdCliente.value = data.id;

      setFeedback(data.message || "Cadastro salvo.", "success");
    } catch (err) {
      setFeedback(err.message || "Erro ao salvar cadastro.", "error");
    }
  }

  async function buscarClientes() {
    if (!requireScriptUrl()) return;

    const q = normalizeText(elQuery.value);
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
    if (btnGerarId) btnGerarId.addEventListener("click", (e) => (e.preventDefault(), gerarIdNoBackend()));
    if (formCadastro) formCadastro.addEventListener("submit", (e) => (e.preventDefault(), salvarCadastro()));
    if (btnBuscar) btnBuscar.addEventListener("click", (e) => (e.preventDefault(), buscarClientes()));
    if (formBusca) formBusca.addEventListener("submit", (e) => (e.preventDefault(), buscarClientes()));
  }

  initDefaults();
  bindEvents();
})();
