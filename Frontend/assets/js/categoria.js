// categoria.js (JSONP - sem CORS)
// Requer: config.js, auth.js, api.js
// Backend: Categoria.gs (via Api/Registry)
// Actions esperadas:
// - Categoria.Criar
// - Categoria.Editar
// - Categoria.Listar

(() => {
  "use strict";

  const SHEET_NAME = "Categoria";
  const jsonpRequest = window.EssenzaApi?.request || (() => Promise.reject(new Error("EssenzaApi não carregado")));

  // ---------- DOM ----------
  const form = document.getElementById("formCategoria");
  const feedbackSalvar = document.getElementById("feedbackCategoriaSalvar");

  const btnNovo = document.getElementById("btnNovoCategoria");

  const formFiltro = document.getElementById("formFiltroCategoria");
  const btnFiltrar = document.getElementById("btnFiltrarCategoria");
  const btnLimparFiltro = document.getElementById("btnLimparFiltroCategoria");
  const feedbackLista = document.getElementById("feedbackCategoriaLista");

  const tabela = document.getElementById("tabelaCategorias");
  const tbody = tabela ? tabela.querySelector("tbody") : null;

  // Campos
  const el = {
    ID_Categoria: document.getElementById("ID_Categoria"),
    Tipo: document.getElementById("Tipo"),
    Categoria: document.getElementById("Categoria"),
    Descricao_Padrao: document.getElementById("Descricao_Padrao"),
    Ativo: document.getElementById("Ativo"),
    Ordem: document.getElementById("Ordem"),

    fTipo: document.getElementById("fTipo"),
    fQ: document.getElementById("fQ"),
  };

  // Estado
  let selectedId = null;

  // ---------- Helpers ----------
  function setFeedback(node, msg, type = "info") {
    if (!node) return;
    node.textContent = msg || "";
    node.dataset.type = type;
  }

  function requireScriptUrl() {
    const url = window.EssenzaApi?.getScriptUrl?.() || "";
    if (!url || !url.includes("/exec")) {
      setFeedback(feedbackLista, "SCRIPT_URL inválida. Ajuste em config.js.", "error");
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


  // ---------- Form ----------
  function clearForm() {
    selectedId = null;
    if (el.ID_Categoria) el.ID_Categoria.value = "";
    if (el.Tipo) el.Tipo.value = "";
    if (el.Categoria) el.Categoria.value = "";
    if (el.Descricao_Padrao) el.Descricao_Padrao.value = "";
    if (el.Ativo) el.Ativo.value = "Sim";
    if (el.Ordem) el.Ordem.value = "";

    setFeedback(feedbackSalvar, "Novo cadastro", "info");
    setTimeout(() => setFeedback(feedbackSalvar, "", "info"), 1500);
  }

  function fillForm(it) {
    if (!it) return;

    selectedId = String(it.ID_Categoria || "").trim() || null;
    if (el.ID_Categoria) el.ID_Categoria.value = selectedId || "";
    if (el.Tipo) el.Tipo.value = it.Tipo || "";
    if (el.Categoria) el.Categoria.value = it.Categoria || "";
    if (el.Descricao_Padrao) el.Descricao_Padrao.value = it.Descricao_Padrao || "";
    if (el.Ativo) el.Ativo.value = it.Ativo || "Sim";
    if (el.Ordem) el.Ordem.value = it.Ordem ?? "";

    setFeedback(feedbackSalvar, `Editando: ${it.Categoria || ""}`, "info");
  }

  function buildPayload() {
    return {
      ID_Categoria: (el.ID_Categoria?.value || "").trim(),
      Tipo: (el.Tipo?.value || "").trim(),
      Categoria: (el.Categoria?.value || "").trim(),
      Descricao_Padrao: (el.Descricao_Padrao?.value || "").trim(),
      Ativo: (el.Ativo?.value || "Sim").trim(),
      Ordem: (el.Ordem?.value || "").trim(),
    };
  }

  function buildFiltros() {
    return {
      fTipo: (el.fTipo?.value || "").trim(),
      q: (el.fQ?.value || "").trim(),
    };
  }

  function validate(payload) {
    if (!payload.Tipo || !payload.Categoria) {
      setFeedback(feedbackSalvar, "Preencha: Tipo e Categoria.", "error");
      return false;
    }
    return true;
  }

  // ---------- Lista ----------
  function clearTable() {
    if (!tbody) return;
    tbody.innerHTML = "";
  }

  function renderTable(items) {
    clearTable();
    if (!tbody) return;

    if (!Array.isArray(items) || items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5">Nenhuma categoria encontrada.</td>`;
      tbody.appendChild(tr);
      return;
    }

    items.forEach((it) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(it.Tipo || "")}</td>
        <td>${escapeHtml(it.Categoria || "")}</td>
        <td>${escapeHtml(it.Descricao_Padrao || "")}</td>
        <td>${escapeHtml(it.Ativo || "")}</td>
        <td>${escapeHtml(String(it.Ordem ?? ""))}</td>
      `;
      tbody.appendChild(tr);

      tr.addEventListener("click", () => fillForm(it));
    });
  }

  // ---------- Actions ----------
  async function listar() {
    if (!requireScriptUrl()) return;

    setFeedback(feedbackLista, "Carregando...", "info");
    try {
      const filtros = buildFiltros();

      const data = await jsonpRequest({
        action: "Categoria.Listar",
        sheet: SHEET_NAME,
        filtros: JSON.stringify(filtros),
      });

      if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao listar.");

      renderTable(data.items || []);
      setFeedback(feedbackLista, `OK • ${(data.items || []).length} item(ns)`, "success");
    } catch (err) {
      setFeedback(feedbackLista, err.message || "Erro ao listar.", "error");
    }
  }

  async function criar(payload) {
    const data = await jsonpRequest({
      action: "Categoria.Criar",
      sheet: SHEET_NAME,
      payload: JSON.stringify(payload),
    });
    if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao salvar.");
    return data;
  }

  async function editar(payload) {
    const data = await jsonpRequest({
      action: "Categoria.Editar",
      sheet: SHEET_NAME,
      payload: JSON.stringify(payload),
    });
    if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao editar.");
    return data;
  }

  async function salvar() {
    if (!requireScriptUrl()) return;

    const payload = buildPayload();
    if (!validate(payload)) return;

    setFeedback(feedbackSalvar, "Salvando...", "info");
    try {
      let resp;
      if (selectedId) resp = await editar(payload);
      else resp = await criar(payload);

      setFeedback(feedbackSalvar, resp.message || "OK", "success");
      await listar();
    } catch (err) {
      setFeedback(feedbackSalvar, err.message || "Erro ao salvar.", "error");
    }
  }

  function limparFiltro() {
    if (formFiltro) formFiltro.reset();
    setFeedback(feedbackLista, "", "info");
    listar();
  }

  // ---------- Bind ----------
  function bind() {
    if (form) form.addEventListener("submit", (e) => (e.preventDefault(), salvar()));
    if (btnNovo) btnNovo.addEventListener("click", (e) => (e.preventDefault(), clearForm()));

    if (btnFiltrar) btnFiltrar.addEventListener("click", (e) => (e.preventDefault(), listar()));
    if (btnLimparFiltro) btnLimparFiltro.addEventListener("click", (e) => (e.preventDefault(), limparFiltro()));
    if (formFiltro) formFiltro.addEventListener("submit", (e) => (e.preventDefault(), listar()));
  }

  // init
  clearForm();
  bind();
  listar();
})();
