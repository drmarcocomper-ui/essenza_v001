// lancamentos.js — Orquestrador (carrega por último)
// Requer: config.js, utils.js, api.js, auth.js
// Requer: lancamentos-form.js, lancamentos-table.js, lancamentos-actions.js
(() => {
  "use strict";

  const { escapeHtml, hojeISO, formatMoneyBR, toNumber: toNumberUtil, formatDateBR: formatDateBRUtil, formatMesDisplay, getMesAtualYYYYMM, setFeedback, skeletonRows, showToast } = window.EssenzaUtils;

  const SHEET_NAME = "Lancamentos";
  const jsonpRequest = window.EssenzaApi?.request || (() => Promise.reject(new Error("EssenzaApi nao carregado")));

  // ---------- Helpers ----------
  function requireScriptUrl() {
    const url = window.EssenzaApi?.getScriptUrl?.() || "";
    if (!url || !url.includes("/exec")) {
      setFeedback(dom.feedbackLanc, "SCRIPT_URL invalida. Ajuste em config.js.", "error");
      return false;
    }
    return true;
  }

  function toISODate(v) {
    if (!v) return "";
    const s = String(v).trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brMatch) {
      return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
    }
    const date = new Date(s);
    if (!isNaN(date.getTime())) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
    return "";
  }

  function parseParcelCount(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return 0;
    if (/^\d+\s*\/\s*\d+$/.test(s)) return 0;
    if (/^\d+$/.test(s)) return Number(s) || 0;
    const m = s.match(/^(\d+)\s*x$/i);
    if (m) return Number(m[1]) || 0;
    return 0;
  }

  // ---------- DOM refs ----------
  const inputCliente = document.getElementById("ID_Cliente");
  const inputFornecedor = document.getElementById("ID_Fornecedor");
  const inputCategoria = document.getElementById("Categoria");

  const tabelaTodos = document.getElementById("tabelaLancamentos");
  const tabelaMes = document.getElementById("tabelaMes");

  const el = {
    Data_Competencia: document.getElementById("Data_Competencia"),
    Data_Caixa: document.getElementById("Data_Caixa"),
    Tipo: document.getElementById("Tipo"),
    Origem: document.getElementById("Origem"),
    Categoria: inputCategoria,
    Descricao: document.getElementById("Descricao"),
    ID_Cliente: inputCliente,
    ID_Fornecedor: inputFornecedor,
    Forma_Pagamento: document.getElementById("Forma_Pagamento"),
    Instituicao_Financeira: document.getElementById("Instituicao_Financeira"),
    Titularidade: document.getElementById("Titularidade"),
    Parcelamento: document.getElementById("Parcelamento"),
    Valor: document.getElementById("Valor"),
    Status: document.getElementById("Status"),
    Observacoes: document.getElementById("Observacoes"),
    Mes_a_receber: document.getElementById("Mes_a_receber"),
  };

  const dom = {
    formFiltro: document.getElementById("formFiltro"),
    btnFiltrar: document.getElementById("btnFiltrar"),
    btnLimparFiltro: document.getElementById("btnLimparFiltro"),
    feedbackLanc: document.getElementById("feedbackLanc"),
    fDataIni: document.getElementById("fDataIni"),
    fDataFim: document.getElementById("fDataFim"),
    fTipo: document.getElementById("fTipo"),
    fStatus: document.getElementById("fStatus"),
    fCategoria: document.getElementById("fCategoria"),
    fFormaPagamento: document.getElementById("fFormaPagamento"),
    fInstituicao: document.getElementById("fInstituicao"),
    fTitularidade: document.getElementById("fTitularidade"),
    fQ: document.getElementById("fQ"),
    datalistCategoriasF: document.getElementById("listaCategoriasF"),
    tabelaTodos,
    tbodyTodos: tabelaTodos ? tabelaTodos.querySelector("tbody") : null,
    tabelaMes,
    tbodyMes: tabelaMes ? tabelaMes.querySelector("tbody") : null,
    tbodyPendentes: document.querySelector("#tabelaPendentes tbody"),
    formLanc: document.getElementById("formLancamento"),
    feedbackSalvar: document.getElementById("feedbackSalvar"),
    btnNovo: document.getElementById("btnNovoLancamento"),
    btnExcluir: document.getElementById("btnExcluirLanc"),
    cardFormulario: document.getElementById("cardFormulario"),
    btnAbrirNovoLanc: document.getElementById("btnAbrirNovoLanc"),
    btnFecharForm: document.getElementById("btnFecharForm"),
    tituloFormulario: document.getElementById("tituloFormulario"),
    descFormulario: document.getElementById("descFormulario"),
    btnDuplicar: document.getElementById("btnDuplicar"),
    btnMarcarPago: document.getElementById("btnMarcarPago"),
    btnCancelarLanc: document.getElementById("btnCancelarLanc"),
    modalExcluir: document.getElementById("modalExcluir"),
    modalExcluirInfo: document.getElementById("modalExcluirInfo"),
    btnCancelarExcluir: document.getElementById("btnCancelarExcluir"),
    btnConfirmarExcluir: document.getElementById("btnConfirmarExcluir"),
    inputCliente,
    datalistClientes: document.getElementById("listaClientes"),
    fieldCliente: document.getElementById("fieldCliente"),
    inputFornecedor,
    datalistFornecedores: document.getElementById("listaFornecedores"),
    fieldFornecedor: document.getElementById("fieldFornecedor"),
    datalistCategorias: document.getElementById("listaCategorias"),
    datalistDescricoes: document.getElementById("listaDescricoes"),
    tabsLista: document.getElementById("tabsLista"),
    tabMesDiv: document.getElementById("tabMes"),
    tabPendentesDiv: document.getElementById("tabPendentes"),
    tabTodosDiv: document.getElementById("tabTodos"),
    tabRecorrentesDiv: document.getElementById("tabRecorrentes"),
    badgePendentes: document.getElementById("badgePendentes"),
    mesSelecionadoInput: document.getElementById("mesSelecionado"),
    btnMesAnterior: document.getElementById("btnMesAnterior"),
    btnMesSeguinte: document.getElementById("btnMesSeguinte"),
    btnMesAtual: document.getElementById("btnMesAtual"),
    feedbackMes: document.getElementById("feedbackMes"),
    feedbackPendentes: document.getElementById("feedbackPendentes"),
  };

  // ---------- Shared state ----------
  const state = {
    selectedRowIndex: null,
    dadosListaAtual: [],
    dadosMesAtual: [],
    dadosPendentesAtual: [],
    paginaAtual: 1,
    totalPaginas: 1,
    _pageSize: 25,
    abaAtiva: "mes",
    sortCol: "Data_Competencia",
    sortDir: "desc",
    clientesDebounce: null,
    fornecedoresDebounce: null,
    categoriasCache: [],
    ultimaDescricaoAuto: "",
    _saving: false,
    itemAtualEdicao: null,
    _clientesMap: {},
    _fornecedoresMap: {},
  };

  // ---------- Build context ----------
  const ctx = {
    el,
    dom,
    state,
    helpers: {
      escapeHtml, hojeISO, formatMoneyBR, toNumberBR: toNumberUtil, formatDateBR: formatDateBRUtil,
      formatMesDisplay, getMesAtualYYYYMM, setFeedback, skeletonRows, showToast,
      jsonpRequest, toISODate, parseParcelCount, requireScriptUrl, SHEET_NAME,
    },
  };

  // ---------- Register sub-modules ----------
  window._LancFormRegister(ctx);
  window._LancTableRegister(ctx);
  window._LancActionsRegister(ctx);

  const { form, table, actions } = ctx;

  // ============================================================
  // TABS
  // ============================================================
  function ativarTab(tab) {
    state.abaAtiva = tab;
    document.querySelectorAll(".tab-lista-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    if (dom.tabMesDiv) dom.tabMesDiv.style.display = tab === "mes" ? "" : "none";
    if (dom.tabPendentesDiv) dom.tabPendentesDiv.style.display = tab === "pendentes" ? "" : "none";
    if (dom.tabTodosDiv) dom.tabTodosDiv.style.display = tab === "todos" ? "" : "none";
    if (dom.tabRecorrentesDiv) dom.tabRecorrentesDiv.style.display = tab === "recorrentes" ? "" : "none";

    if (tab === "mes") table.carregarMes();
    else if (tab === "pendentes") table.carregarPendentes();
    else if (tab === "todos") table.listarTodos(1);
    else if (tab === "recorrentes") actions.carregarRecorrentes();
  }

  // ============================================================
  // INIT DEFAULTS
  // ============================================================
  function initDefaults() {
    if (el.Data_Competencia && !el.Data_Competencia.value) el.Data_Competencia.value = hojeISO();
    if (dom.mesSelecionadoInput && !dom.mesSelecionadoInput.value) dom.mesSelecionadoInput.value = getMesAtualYYYYMM();

    if (el.Status && el.Data_Caixa) {
      el.Status.addEventListener("change", () => {
        if (String(el.Status.value || "").trim() === "Pago" && !el.Data_Caixa.value) {
          el.Data_Caixa.value = hojeISO();
        }
      });
    }
  }

  // ============================================================
  // BIND
  // ============================================================
  function bind() {
    if (dom.btnFiltrar) dom.btnFiltrar.addEventListener("click", (e) => (e.preventDefault(), table.listarTodos(1)));
    if (dom.btnLimparFiltro) dom.btnLimparFiltro.addEventListener("click", (e) => (e.preventDefault(), table.limparFiltro()));
    if (dom.formFiltro) dom.formFiltro.addEventListener("submit", (e) => (e.preventDefault(), table.listarTodos(1)));
    if (dom.formLanc) dom.formLanc.addEventListener("submit", (e) => (e.preventDefault(), actions.salvar()));

    if (dom.btnAbrirNovoLanc) dom.btnAbrirNovoLanc.addEventListener("click", (e) => {
      e.preventDefault();
      form.clearForm();
      form.abrirFormulario(false);
    });

    if (dom.btnFecharForm) dom.btnFecharForm.addEventListener("click", (e) => {
      e.preventDefault();
      form.fecharFormulario();
    });

    if (dom.btnNovo) dom.btnNovo.addEventListener("click", (e) => {
      e.preventDefault();
      form.clearForm();
      form.abrirFormulario(false);
    });

    if (dom.btnDuplicar) dom.btnDuplicar.addEventListener("click", (e) => (e.preventDefault(), actions.duplicarLancamento()));
    if (dom.btnMarcarPago) dom.btnMarcarPago.addEventListener("click", (e) => (e.preventDefault(), actions.marcarComoPago()));
    if (dom.btnCancelarLanc) dom.btnCancelarLanc.addEventListener("click", (e) => (e.preventDefault(), actions.cancelarLancamento()));

    if (dom.btnExcluir) dom.btnExcluir.addEventListener("click", (e) => (e.preventDefault(), actions.abrirModalExcluir()));
    if (dom.btnCancelarExcluir) dom.btnCancelarExcluir.addEventListener("click", (e) => (e.preventDefault(), actions.fecharModalExcluir()));
    if (dom.btnConfirmarExcluir) dom.btnConfirmarExcluir.addEventListener("click", (e) => (e.preventDefault(), actions.confirmarExcluir()));
    if (dom.modalExcluir) {
      dom.modalExcluir.addEventListener("click", (e) => {
        if (e.target === dom.modalExcluir) actions.fecharModalExcluir();
      });
    }

    if (dom.tabsLista) {
      dom.tabsLista.addEventListener("click", (e) => {
        const btn = e.target.closest(".tab-lista-btn");
        if (!btn) return;
        const tab = btn.dataset.tab;
        if (tab) ativarTab(tab);
      });
    }

    if (dom.btnMesAnterior) dom.btnMesAnterior.addEventListener("click", () => actions.navegarMes(-1));
    if (dom.btnMesSeguinte) dom.btnMesSeguinte.addEventListener("click", () => actions.navegarMes(1));
    if (dom.btnMesAtual) dom.btnMesAtual.addEventListener("click", () => {
      if (dom.mesSelecionadoInput) dom.mesSelecionadoInput.value = getMesAtualYYYYMM();
      table.carregarMes();
    });
    if (dom.mesSelecionadoInput) dom.mesSelecionadoInput.addEventListener("change", () => table.carregarMes());

    const btnImprimirMes = document.getElementById("btnImprimirMes");
    const btnExportMesPDF = document.getElementById("btnExportMesPDF");
    if (btnImprimirMes) btnImprimirMes.addEventListener("click", actions.imprimirMes);
    if (btnExportMesPDF) btnExportMesPDF.addEventListener("click", actions.exportarMesPDF);

    const btnNovaRec = document.getElementById("btnNovaRecorrencia");
    const btnGerarRec = document.getElementById("btnGerarRecorrentes");
    const btnSalvarRec = document.getElementById("btnSalvarRecorrencia");
    const btnCancelarRec = document.getElementById("btnCancelarRecorrencia");
    if (btnNovaRec) btnNovaRec.addEventListener("click", function() { actions.abrirFormRecorrencia(null); });
    if (btnGerarRec) btnGerarRec.addEventListener("click", actions.gerarRecorrentes);
    if (btnSalvarRec) btnSalvarRec.addEventListener("click", actions.salvarRecorrente);
    if (btnCancelarRec) btnCancelarRec.addEventListener("click", actions.fecharFormRecorrencia);

    const btnExportExcel = document.getElementById("btnExportExcel");
    const btnExportPDF = document.getElementById("btnExportPDF");
    if (btnExportExcel) {
      btnExportExcel.addEventListener("click", (e) => {
        e.preventDefault();
        if (!state.dadosListaAtual.length) {
          setFeedback(dom.feedbackLanc, "Nenhum dado para exportar.", "error");
          return;
        }
        window.EssenzaExport?.lancamentosExcel(state.dadosListaAtual);
      });
    }
    if (btnExportPDF) {
      btnExportPDF.addEventListener("click", (e) => {
        e.preventDefault();
        if (!state.dadosListaAtual.length) {
          setFeedback(dom.feedbackLanc, "Nenhum dado para exportar.", "error");
          return;
        }
        window.EssenzaExport?.lancamentosPDF(state.dadosListaAtual);
      });
    }
  }

  // ============================================================
  // INIT
  // ============================================================
  initDefaults();
  bind();
  form.bindAutocompleteClientes();
  form.bindAutocompleteFornecedores();
  form.bindCategoriaPadrao();
  form.bindMascaraValor();
  form.bindAutoMesReceber();
  table.bindSortHeaders();
  form.atualizarVisibilidadeCampos();

  table.loadFiltersFromURL();

  form.carregarCategoriasAtivas(form.getTipoAtual()).catch(() => {});
  form.carregarTodasCategorias().catch(() => {});

  table.carregarMes();
  table.carregarPendentes();
})();
