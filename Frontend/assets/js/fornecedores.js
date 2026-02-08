// fornecedores.js (JSONP - sem CORS)
// Requer: assets/js/config.js (window.APP_CONFIG)
// Requer: assets/js/auth.js (window.EssenzaAuth)
// Requer: assets/js/api.js (window.EssenzaApi)

(() => {
  "use strict";

  const SHEET_NAME = "Fornecedores";

  // =========================
  // DOM
  // =========================
  const formFornecedor = document.getElementById("formFornecedor");
  const formBusca = document.getElementById("formBusca");
  const btnBuscar = document.getElementById("btnBuscar");

  const feedback = document.getElementById("feedback");

  // ID (hidden)
  const elIdFornecedor = document.getElementById("idFornecedor");

  const elNome = document.getElementById("nomeFornecedor");
  const elTelefone = document.getElementById("telefone");
  const elEmail = document.getElementById("email");
  const elCnpjCpf = document.getElementById("cnpjCpf");
  const elCategoria = document.getElementById("categoria");
  const elEndereco = document.getElementById("endereco");
  const elDataCadastro = document.getElementById("dataCadastro");
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
    const url = window.EssenzaApi?.getScriptUrl?.() || "";
    if (!url || !url.includes("/exec")) {
      setFeedback("SCRIPT_URL inválida. Ajuste no assets/js/config.js.", "error");
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
  // API
  // =========================
  const jsonpRequest = window.EssenzaApi?.request || (() => Promise.reject(new Error("EssenzaApi não carregado")));

  // =========================
  // Payload
  // =========================
  function buildFornecedorPayload() {
    return {
      NomeFornecedor: normalizeText(elNome?.value),
      Telefone: sanitizePhone(elTelefone?.value),
      "E-mail": normalizeText(elEmail?.value),
      CNPJ_CPF: normalizeText(elCnpjCpf?.value),
      Categoria: normalizeText(elCategoria?.value),
      Endereco: normalizeText(elEndereco?.value),
      DataCadastro: normalizeText(elDataCadastro?.value),
      Observacao: normalizeText(elObservacao?.value),
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
        <td>${escapeHtml(it.NomeFornecedor ?? "")}</td>
        <td>${escapeHtml(it.Telefone ?? "")}</td>
        <td>${escapeHtml(it.CNPJ_CPF ?? "")}</td>
        <td>${escapeHtml(it.Categoria ?? "")}</td>
      `;
      tbodyResultados.appendChild(tr);
      tr.addEventListener("click", () => fillFormFromItem(it));
    });
  }

  function fillFormFromItem(it) {
    if (!it) return;

    if (elIdFornecedor) elIdFornecedor.value = it.ID_Fornecedor ?? "";
    if (elNome) elNome.value = it.NomeFornecedor ?? "";
    if (elTelefone) elTelefone.value = it.Telefone ?? "";
    if (elEmail) elEmail.value = it["E-mail"] ?? it.Email ?? "";
    if (elCnpjCpf) elCnpjCpf.value = it.CNPJ_CPF ?? "";
    if (elCategoria) elCategoria.value = it.Categoria ?? "";
    if (elEndereco) elEndereco.value = it.Endereco ?? "";
    if (elDataCadastro) elDataCadastro.value = it.DataCadastro ?? "";
    if (elObservacao) elObservacao.value = it.Observacao ?? "";

    setFeedback("Fornecedor carregado no formulário.", "info");
  }

  // =========================
  // Actions
  // =========================
  async function salvarFornecedor() {
    if (!requireScriptUrl()) return;

    const nome = normalizeText(elNome?.value);

    if (!nome) {
      setFeedback("Preencha o Nome do Fornecedor.", "error");
      return;
    }

    if (elDataCadastro && !elDataCadastro.value) elDataCadastro.value = hojeISO();

    // Limpa o hidden ID antes de salvar (para garantir que o backend gere)
    if (elIdFornecedor) elIdFornecedor.value = "";

    setFeedback("Salvando...", "info");
    try {
      const payload = buildFornecedorPayload();

      const data = await jsonpRequest({
        action: "Fornecedores.Criar",
        sheet: SHEET_NAME,
        payload: JSON.stringify(payload),
      });

      if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao salvar.");

      // Backend retorna id gerado
      if (data.id && elIdFornecedor) elIdFornecedor.value = data.id;

      setFeedback(data.message || "Fornecedor salvo.", "success");

    } catch (err) {
      setFeedback(err.message || "Erro ao salvar fornecedor.", "error");
    }
  }

  async function buscarFornecedores() {
    if (!requireScriptUrl()) return;

    const q = normalizeText(elQuery?.value);

    setFeedback("Buscando...", "info");
    try {
      const data = await jsonpRequest({
        action: "Fornecedores.Buscar",
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
    // Carregar lista inicial de fornecedores
    buscarFornecedores();
  }

  function bindEvents() {
    if (formFornecedor) formFornecedor.addEventListener("submit", (e) => (e.preventDefault(), salvarFornecedor()));
    if (btnBuscar) btnBuscar.addEventListener("click", (e) => (e.preventDefault(), buscarFornecedores()));
    if (formBusca) formBusca.addEventListener("submit", (e) => (e.preventDefault(), buscarFornecedores()));
  }

  initDefaults();
  bindEvents();
})();
