// categoria.js (JSONP - sem CORS)
// Requer: config.js, auth.js, api.js

(() => {
  "use strict";

  const SHEET_NAME = "Categoria";
  const jsonpRequest = window.EssenzaApi?.request || (() => Promise.reject(new Error("EssenzaApi não carregado")));

  // ========== DOM ==========
  const form = document.getElementById("formCategoria");
  const feedbackSalvar = document.getElementById("feedbackSalvar");
  const feedbackLista = document.getElementById("feedbackLista");

  // Formulário
  const cardFormulario = document.getElementById("cardFormulario");
  const btnAbrirNovaCategoria = document.getElementById("btnAbrirNovaCategoria");
  const btnFecharForm = document.getElementById("btnFecharForm");
  const tituloFormulario = document.getElementById("tituloFormulario");
  const descFormulario = document.getElementById("descFormulario");

  // Botões de ação
  const btnSalvar = document.getElementById("btnSalvar");
  const btnLimpar = document.getElementById("btnLimpar");
  const btnInativar = document.getElementById("btnInativar");
  const btnAtivar = document.getElementById("btnAtivar");
  const btnExcluir = document.getElementById("btnExcluir");

  // Filtro
  const formFiltro = document.getElementById("formFiltroCategoria");
  const btnFiltrar = document.getElementById("btnFiltrar");
  const btnLimparFiltro = document.getElementById("btnLimparFiltro");

  // Tabela
  const tabela = document.getElementById("tabelaCategorias");
  const tbody = tabela ? tabela.querySelector("tbody") : null;

  // Resumo
  const resumoCategorias = document.getElementById("resumoCategorias");
  const resumoTotal = document.getElementById("resumoTotal");
  const resumoEntradas = document.getElementById("resumoEntradas");
  const resumoSaidas = document.getElementById("resumoSaidas");
  const resumoInativos = document.getElementById("resumoInativos");

  // Campos
  const el = {
    ID_Categoria: document.getElementById("ID_Categoria"),
    rowIndex: document.getElementById("rowIndex"),
    Tipo: document.getElementById("Tipo"),
    Categoria: document.getElementById("Categoria"),
    Descricao_Padrao: document.getElementById("Descricao_Padrao"),
    Ativo: document.getElementById("Ativo"),
    Ordem: document.getElementById("Ordem"),
    fTipo: document.getElementById("fTipo"),
    fQ: document.getElementById("fQ"),
  };

  // ========== Estado ==========
  let categoriaAtual = null;
  let dadosListaAtual = [];

  // ========== Helpers ==========
  function setFeedback(node, msg, type = "info") {
    if (!node) return;
    node.textContent = msg || "";
    node.dataset.type = type;
  }

  function requireScriptUrl() {
    const url = window.EssenzaApi?.getScriptUrl?.() || "";
    if (!url || !url.includes("/exec")) {
      setFeedback(feedbackLista, "SCRIPT_URL inválida.", "error");
      return false;
    }
    return true;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  // ========== Formulário: Abrir/Fechar ==========
  function abrirFormulario(modoEdicao = false) {
    if (!cardFormulario) return;

    cardFormulario.style.display = "block";
    cardFormulario.classList.toggle("modo-edicao", modoEdicao);

    if (tituloFormulario) {
      tituloFormulario.textContent = modoEdicao ? "Editar Categoria" : "Nova Categoria";
    }
    if (descFormulario) {
      descFormulario.textContent = modoEdicao
        ? "Altere os dados e clique em Salvar."
        : "Crie categorias para organizar seus lançamentos.";
    }

    cardFormulario.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function fecharFormulario() {
    if (!cardFormulario) return;
    cardFormulario.style.display = "none";
    limparFormulario();
  }

  function limparFormulario() {
    if (form) form.reset();
    if (el.ID_Categoria) el.ID_Categoria.value = "";
    if (el.rowIndex) el.rowIndex.value = "";
    if (el.Ativo) el.Ativo.value = "Sim";

    categoriaAtual = null;

    // Esconder botões de edição
    if (btnLimpar) btnLimpar.style.display = "none";
    if (btnInativar) btnInativar.style.display = "none";
    if (btnAtivar) btnAtivar.style.display = "none";
    if (btnExcluir) btnExcluir.style.display = "none";

    setFeedback(feedbackSalvar, "", "info");
  }

  function mostrarBotoesEdicao(categoria) {
    if (btnLimpar) btnLimpar.style.display = "inline-block";
    if (btnExcluir) btnExcluir.style.display = "inline-block";

    const isInativo = categoria?.Ativo === "Nao";
    if (btnInativar) btnInativar.style.display = isInativo ? "none" : "inline-block";
    if (btnAtivar) btnAtivar.style.display = isInativo ? "inline-block" : "none";
  }

  // ========== Preencher Formulário ==========
  function fillFormFromItem(it) {
    if (!it) return;

    categoriaAtual = it;

    if (el.ID_Categoria) el.ID_Categoria.value = it.ID_Categoria ?? "";
    if (el.rowIndex) el.rowIndex.value = it.rowIndex ?? "";
    if (el.Tipo) el.Tipo.value = it.Tipo ?? "";
    if (el.Categoria) el.Categoria.value = it.Categoria ?? "";
    if (el.Descricao_Padrao) el.Descricao_Padrao.value = it.Descricao_Padrao ?? "";
    if (el.Ativo) el.Ativo.value = it.Ativo ?? "Sim";
    if (el.Ordem) el.Ordem.value = it.Ordem ?? "";

    abrirFormulario(true);
    mostrarBotoesEdicao(it);
  }

  // ========== Payload ==========
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
      setFeedback(feedbackSalvar, "Preencha Tipo e Categoria.", "error");
      return false;
    }
    return true;
  }

  // ========== Tabela ==========
  function clearTable() {
    if (!tbody) return;
    tbody.innerHTML = "";
  }

  function renderTable(items) {
    clearTable();
    if (!tbody) return;

    dadosListaAtual = items || [];

    if (!Array.isArray(items) || items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5">Nenhuma categoria encontrada.</td>`;
      tbody.appendChild(tr);
      return;
    }

    items.forEach((it) => {
      const isInativo = it.Ativo === "Nao";
      const tr = document.createElement("tr");
      if (isInativo) tr.classList.add("categoria-inativa");

      const tipoClass = it.Tipo === "Entrada" ? "tipo-entrada" : it.Tipo === "Saida" ? "tipo-saida" : "";

      tr.innerHTML = `
        <td class="${tipoClass}">${escapeHtml(it.Tipo || "")}</td>
        <td>${escapeHtml(it.Categoria || "")}</td>
        <td title="${escapeHtml(it.Descricao_Padrao || "")}">${escapeHtml((it.Descricao_Padrao || "").substring(0, 40))}${(it.Descricao_Padrao || "").length > 40 ? "..." : ""}</td>
        <td>${isInativo ? "Inativo" : "Ativo"}</td>
        <td>${escapeHtml(String(it.Ordem ?? ""))}</td>
      `;
      tbody.appendChild(tr);

      tr.addEventListener("click", () => {
        // Remover seleção anterior
        tbody.querySelectorAll("tr").forEach(r => r.classList.remove("selecionada"));
        tr.classList.add("selecionada");
        fillFormFromItem(it);
      });
    });

    atualizarResumo(items);
  }

  function atualizarResumo(items) {
    if (!resumoCategorias) return;

    const total = items.length;
    const entradas = items.filter(i => i.Tipo === "Entrada").length;
    const saidas = items.filter(i => i.Tipo === "Saida").length;
    const inativos = items.filter(i => i.Ativo === "Nao").length;

    if (resumoTotal) resumoTotal.textContent = total;
    if (resumoEntradas) resumoEntradas.textContent = entradas;
    if (resumoSaidas) resumoSaidas.textContent = saidas;
    if (resumoInativos) resumoInativos.textContent = inativos;

    resumoCategorias.style.display = total > 0 ? "grid" : "none";
  }

  // ========== Ações ==========
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
      setFeedback(feedbackLista, `${(data.items || []).length} categoria(s)`, "success");
    } catch (err) {
      setFeedback(feedbackLista, err.message || "Erro ao listar.", "error");
    }
  }

  async function salvar() {
    if (!requireScriptUrl()) return;

    const payload = buildPayload();
    if (!validate(payload)) return;

    setFeedback(feedbackSalvar, "Salvando...", "info");

    try {
      const isEdit = Boolean(payload.ID_Categoria);
      const action = isEdit ? "Categoria.Editar" : "Categoria.Criar";

      const data = await jsonpRequest({
        action: action,
        sheet: SHEET_NAME,
        payload: JSON.stringify(payload),
      });

      if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao salvar.");

      setFeedback(feedbackSalvar, data.message || "Salvo com sucesso!", "success");

      setTimeout(() => {
        fecharFormulario();
        listar();
      }, 500);

    } catch (err) {
      setFeedback(feedbackSalvar, err.message || "Erro ao salvar.", "error");
    }
  }

  async function inativarCategoria() {
    if (!categoriaAtual?.ID_Categoria) return;

    if (!confirm("Deseja inativar esta categoria?")) return;

    setFeedback(feedbackSalvar, "Inativando...", "info");

    try {
      const payload = {
        ID_Categoria: categoriaAtual.ID_Categoria,
        Ativo: "Nao"
      };

      const data = await jsonpRequest({
        action: "Categoria.Editar",
        sheet: SHEET_NAME,
        payload: JSON.stringify(payload),
      });

      if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao inativar.");

      setFeedback(feedbackSalvar, "Categoria inativada.", "success");
      fecharFormulario();
      listar();

    } catch (err) {
      setFeedback(feedbackSalvar, err.message || "Erro ao inativar.", "error");
    }
  }

  async function ativarCategoria() {
    if (!categoriaAtual?.ID_Categoria) return;

    setFeedback(feedbackSalvar, "Ativando...", "info");

    try {
      const payload = {
        ID_Categoria: categoriaAtual.ID_Categoria,
        Ativo: "Sim"
      };

      const data = await jsonpRequest({
        action: "Categoria.Editar",
        sheet: SHEET_NAME,
        payload: JSON.stringify(payload),
      });

      if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao ativar.");

      setFeedback(feedbackSalvar, "Categoria ativada.", "success");
      fecharFormulario();
      listar();

    } catch (err) {
      setFeedback(feedbackSalvar, err.message || "Erro ao ativar.", "error");
    }
  }

  async function excluirCategoria() {
    if (!categoriaAtual?.rowIndex) return;

    if (!confirm("Tem certeza que deseja EXCLUIR esta categoria permanentemente?")) return;

    setFeedback(feedbackSalvar, "Excluindo...", "info");

    try {
      const data = await jsonpRequest({
        action: "Categoria.Excluir",
        sheet: SHEET_NAME,
        rowIndex: categoriaAtual.rowIndex,
      });

      if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao excluir.");

      setFeedback(feedbackLista, "Categoria excluída.", "success");
      fecharFormulario();
      listar();

    } catch (err) {
      setFeedback(feedbackSalvar, err.message || "Erro ao excluir.", "error");
    }
  }

  function limparFiltro() {
    if (formFiltro) formFiltro.reset();
    setFeedback(feedbackLista, "", "info");
    listar();
  }

  // ========== Bind ==========
  function bindEvents() {
    // Formulário
    if (form) form.addEventListener("submit", (e) => (e.preventDefault(), salvar()));

    // Botões do formulário
    if (btnAbrirNovaCategoria) btnAbrirNovaCategoria.addEventListener("click", () => {
      limparFormulario();
      abrirFormulario(false);
    });
    if (btnFecharForm) btnFecharForm.addEventListener("click", fecharFormulario);
    if (btnLimpar) btnLimpar.addEventListener("click", () => {
      limparFormulario();
      abrirFormulario(false);
    });
    if (btnInativar) btnInativar.addEventListener("click", inativarCategoria);
    if (btnAtivar) btnAtivar.addEventListener("click", ativarCategoria);
    if (btnExcluir) btnExcluir.addEventListener("click", excluirCategoria);

    // Filtro
    if (btnFiltrar) btnFiltrar.addEventListener("click", (e) => (e.preventDefault(), listar()));
    if (btnLimparFiltro) btnLimparFiltro.addEventListener("click", (e) => (e.preventDefault(), limparFiltro()));
    if (formFiltro) formFiltro.addEventListener("submit", (e) => (e.preventDefault(), listar()));
  }

  // ========== Init ==========
  function init() {
    bindEvents();
    listar();
  }

  init();
})();
