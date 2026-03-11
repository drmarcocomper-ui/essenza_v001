// lancamentos.js (JSONP - sem CORS)
// Requer: assets/js/config.js, auth.js, api.js
// Backend: Api.gs (Registry) + Categoria.gs + Lancamentos.gs + Clientes.gs

(() => {
  "use strict";

  const { escapeHtml, hojeISO, formatMoneyBR, toNumber: toNumberUtil, formatDateBR: formatDateBRUtil, formatMesDisplay, getMesAtualYYYYMM, setFeedback, skeletonRows, showToast } = window.EssenzaUtils;

  const SHEET_NAME = "Lancamentos";

  // ---------- DOM ----------
  const formFiltro = document.getElementById("formFiltro");
  const btnFiltrar = document.getElementById("btnFiltrar");
  const btnLimparFiltro = document.getElementById("btnLimparFiltro");
  const feedbackLanc = document.getElementById("feedbackLanc");

  const fDataIni = document.getElementById("fDataIni");
  const fDataFim = document.getElementById("fDataFim");
  const fTipo = document.getElementById("fTipo");
  const fStatus = document.getElementById("fStatus");
  const fCategoria = document.getElementById("fCategoria");
  const fFormaPagamento = document.getElementById("fFormaPagamento");
  const fInstituicao = document.getElementById("fInstituicao");
  const fTitularidade = document.getElementById("fTitularidade");
  const fQ = document.getElementById("fQ");
  const datalistCategoriasF = document.getElementById("listaCategoriasF");

  const tabelaTodos = document.getElementById("tabelaLancamentos");
  const tbodyTodos = tabelaTodos ? tabelaTodos.querySelector("tbody") : null;

  const tabelaMes = document.getElementById("tabelaMes");
  const tbodyMes = tabelaMes ? tabelaMes.querySelector("tbody") : null;

  const tabelaPendentes = document.getElementById("tabelaPendentes");
  const tbodyPendentes = tabelaPendentes ? tabelaPendentes.querySelector("tbody") : null;

  const formLanc = document.getElementById("formLancamento");
  const feedbackSalvar = document.getElementById("feedbackSalvar");
  const btnNovo = document.getElementById("btnNovoLancamento");
  const btnExcluir = document.getElementById("btnExcluirLanc");

  const cardFormulario = document.getElementById("cardFormulario");
  const btnAbrirNovoLanc = document.getElementById("btnAbrirNovoLanc");
  const btnFecharForm = document.getElementById("btnFecharForm");
  const tituloFormulario = document.getElementById("tituloFormulario");
  const descFormulario = document.getElementById("descFormulario");
  const btnDuplicar = document.getElementById("btnDuplicar");
  const btnMarcarPago = document.getElementById("btnMarcarPago");
  const btnCancelarLanc = document.getElementById("btnCancelarLanc");

  const modalExcluir = document.getElementById("modalExcluir");
  const modalExcluirInfo = document.getElementById("modalExcluirInfo");
  const btnCancelarExcluir = document.getElementById("btnCancelarExcluir");
  const btnConfirmarExcluir = document.getElementById("btnConfirmarExcluir");

  const inputCliente = document.getElementById("ID_Cliente");
  const datalistClientes = document.getElementById("listaClientes");
  const fieldCliente = document.getElementById("fieldCliente");

  const inputFornecedor = document.getElementById("ID_Fornecedor");
  const datalistFornecedores = document.getElementById("listaFornecedores");
  const fieldFornecedor = document.getElementById("fieldFornecedor");

  const inputCategoria = document.getElementById("Categoria");
  const datalistCategorias = document.getElementById("listaCategorias");
  const datalistDescricoes = document.getElementById("listaDescricoes");

  // Tabs
  const tabsLista = document.getElementById("tabsLista");
  const tabMesDiv = document.getElementById("tabMes");
  const tabPendentesDiv = document.getElementById("tabPendentes");
  const tabTodosDiv = document.getElementById("tabTodos");
  const badgePendentes = document.getElementById("badgePendentes");

  // Mes nav
  const mesSelecionadoInput = document.getElementById("mesSelecionado");
  const btnMesAnterior = document.getElementById("btnMesAnterior");
  const btnMesSeguinte = document.getElementById("btnMesSeguinte");
  const btnMesAtual = document.getElementById("btnMesAtual");

  // Feedback mes/pendentes
  const feedbackMes = document.getElementById("feedbackMes");
  const feedbackPendentes = document.getElementById("feedbackPendentes");

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

  // ---------- Estado ----------
  let selectedRowIndex = null;
  let dadosListaAtual = [];
  let dadosMesAtual = [];
  let dadosPendentesAtual = [];
  let paginaAtual = 1;
  let totalPaginas = 1;
  let _pageSize = 25;
  let abaAtiva = "mes"; // "mes" | "pendentes" | "todos"

  let sortCol = "Data_Competencia";
  let sortDir = "desc";

  let clientesDebounce = null;
  let fornecedoresDebounce = null;
  let categoriasCache = [];
  let ultimaDescricaoAuto = "";
  let _saving = false;

  // ---------- Helpers ----------

  function requireScriptUrl() {
    const url = window.EssenzaApi?.getScriptUrl?.() || "";
    if (!url || !url.includes("/exec")) {
      setFeedback(feedbackLanc, "SCRIPT_URL invalida. Ajuste em config.js.", "error");
      return false;
    }
    return true;
  }

  const jsonpRequest = window.EssenzaApi?.request || (() => Promise.reject(new Error("EssenzaApi nao carregado")));

  const toNumberBR = toNumberUtil;
  const formatDateBR = formatDateBRUtil;

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

  // ============================================================
  // URL FILTERS
  // ============================================================
  function syncFiltersToURL() {
    var params = new URLSearchParams();
    var fields = { fDataIni: fDataIni, fDataFim: fDataFim, fTipo: fTipo, fStatus: fStatus, fCategoria: fCategoria, fFormaPagamento: fFormaPagamento, fInstituicao: fInstituicao, fTitularidade: fTitularidade, q: fQ };
    Object.keys(fields).forEach(function(key) {
      var val = (fields[key]?.value || "").trim();
      if (val) params.set(key, val);
    });
    var qs = params.toString();
    var newUrl = window.location.pathname + (qs ? "?" + qs : "");
    history.replaceState(null, "", newUrl);
  }

  function loadFiltersFromURL() {
    var params = new URLSearchParams(window.location.search);
    if (fDataIni && params.get("fDataIni")) fDataIni.value = params.get("fDataIni");
    if (fDataFim && params.get("fDataFim")) fDataFim.value = params.get("fDataFim");
    if (fTipo && params.get("fTipo")) fTipo.value = params.get("fTipo");
    if (fStatus && params.get("fStatus")) fStatus.value = params.get("fStatus");
    if (fCategoria && params.get("fCategoria")) fCategoria.value = params.get("fCategoria");
    if (fFormaPagamento && params.get("fFormaPagamento")) fFormaPagamento.value = params.get("fFormaPagamento");
    if (fInstituicao && params.get("fInstituicao")) fInstituicao.value = params.get("fInstituicao");
    if (fTitularidade && params.get("fTitularidade")) fTitularidade.value = params.get("fTitularidade");
    if (fQ && params.get("q")) fQ.value = params.get("q");
  }

  // ============================================================
  // DESCRICOES (datalist)
  // ============================================================
  function clearDescricoesDatalist() {
    if (!datalistDescricoes) return;
    datalistDescricoes.innerHTML = "";
  }

  function renderDescricoesFromPadrao(padroes) {
    clearDescricoesDatalist();
    if (!datalistDescricoes) return;
    const all = Array.isArray(padroes) ? padroes : [padroes];
    const parts = [];
    all.forEach((raw) => {
      String(raw || "").split(/\r?\n|[|;,]/g).map((s) => s.trim()).filter(Boolean).forEach((s) => parts.push(s));
    });
    const uniq = new Set(parts);
    [...uniq].slice(0, 80).forEach((txt) => {
      const opt = document.createElement("option");
      opt.value = txt;
      datalistDescricoes.appendChild(opt);
    });
  }

  // ============================================================
  // CATEGORIAS
  // ============================================================
  function getTipoAtual() {
    return String(el.Tipo?.value || "").trim();
  }

  function clearCategoriasDatalist() {
    if (!datalistCategorias) return;
    datalistCategorias.innerHTML = "";
  }

  function renderCategoriasDatalist(items) {
    if (!datalistCategorias) return;
    clearCategoriasDatalist();
    const set = new Set();
    (items || []).forEach((it) => {
      const cat = String(it?.Categoria || "").trim();
      if (cat) set.add(cat);
    });
    [...set].slice(0, 200).forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      datalistCategorias.appendChild(opt);
    });
    if (datalistCategoriasF) {
      datalistCategoriasF.innerHTML = "";
      [...set].slice(0, 200).forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat;
        datalistCategoriasF.appendChild(opt);
      });
    }
  }

  async function carregarCategoriasAtivas(tipo) {
    if (!requireScriptUrl()) return;
    const filtros = { somenteAtivos: "1" };
    if (tipo) filtros.fTipo = tipo;
    const data = await jsonpRequest({
      action: "Categoria.Listar",
      sheet: "Categoria",
      filtros: JSON.stringify(filtros),
    });
    if (!data || data.ok !== true) return;
    categoriasCache = Array.isArray(data.items) ? data.items : [];
    renderCategoriasDatalist(categoriasCache);
  }

  async function carregarTodasCategorias() {
    if (!requireScriptUrl()) return;
    const data = await jsonpRequest({
      action: "Categoria.Listar",
      sheet: "Categoria",
      filtros: JSON.stringify({ somenteAtivos: "1" }),
    });
    if (!data || data.ok !== true) return;
    const items = Array.isArray(data.items) ? data.items : [];
    if (datalistCategoriasF) {
      datalistCategoriasF.innerHTML = "";
      const set = new Set();
      items.forEach((it) => {
        const cat = String(it?.Categoria || "").trim();
        if (cat) set.add(cat);
      });
      [...set].slice(0, 200).forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat;
        datalistCategoriasF.appendChild(opt);
      });
    }
  }

  function findCategoriaAll(tipo, categoriaNome) {
    const t = String(tipo || "").trim();
    const c = String(categoriaNome || "").trim();
    if (!t || !c) return [];
    return categoriasCache.filter((x) =>
      String(x.Tipo || "").trim() === t &&
      String(x.Categoria || "").trim() === c &&
      String(x.Ativo || "Sim").trim() !== "Nao"
    );
  }

  function aplicarDescricaoDaCategoria(force = false) {
    if (!el.Descricao || !el.Categoria || !el.Tipo) return;
    const tipo = getTipoAtual();
    const cat = String(el.Categoria.value || "").trim();
    if (!tipo || !cat) return;
    const matches = findCategoriaAll(tipo, cat);
    if (!matches.length) { clearDescricoesDatalist(); return; }
    const padroes = matches.map((m) => String(m.Descricao_Padrao || "").trim()).filter(Boolean);
    if (!padroes.length) { clearDescricoesDatalist(); return; }
    renderDescricoesFromPadrao(padroes);
    const atual = String(el.Descricao.value || "").trim();
    const primeira = padroes.join("|").split(/\r?\n|[|;,]/g).map((s) => s.trim()).filter(Boolean)[0] || "";
    if ((force || !atual || atual === ultimaDescricaoAuto) && primeira) {
      el.Descricao.value = primeira;
      ultimaDescricaoAuto = primeira;
      setFeedback(feedbackSalvar, "Descricao sugerida pela categoria.", "info");
      setTimeout(() => setFeedback(feedbackSalvar, "", "info"), 1200);
    }
  }

  async function validarCategoriaSelecionada(payload) {
    const tipo = String(payload.Tipo || "").trim();
    const cat = String(payload.Categoria || "").trim();
    if (!tipo || !cat) return false;
    // Se cache vazio, recarregar antes de validar
    if (!categoriasCache.length) {
      try { await carregarCategoriasAtivas(tipo); } catch (_) {}
    }
    if (!findCategoriaAll(tipo, cat).length) {
      setFeedback(feedbackSalvar, "Selecione uma Categoria valida (da lista).", "error");
      showToast("Categoria invalida. Selecione da lista.", { type: "error", duration: 4000 });
      return false;
    }
    return true;
  }

  function bindCategoriaPadrao() {
    if (!el.Tipo || !el.Categoria) return;
    el.Tipo.addEventListener("change", () => {
      if (el.Categoria) el.Categoria.value = "";
      if (el.Descricao) el.Descricao.value = "";
      ultimaDescricaoAuto = "";
      clearDescricoesDatalist();
      carregarCategoriasAtivas(getTipoAtual()).catch(() => {});
    });
    el.Categoria.addEventListener("focus", () => {
      carregarCategoriasAtivas(getTipoAtual()).catch(() => {});
    });
    el.Categoria.addEventListener("change", () => { aplicarDescricaoDaCategoria(true); });
    el.Categoria.addEventListener("blur", () => { aplicarDescricaoDaCategoria(false); });
    if (el.Descricao) {
      el.Descricao.addEventListener("focus", () => { aplicarDescricaoDaCategoria(false); });
    }
  }

  // ============================================================
  // CLIENTES
  // ============================================================
  function isTipoEntrada() { return getTipoAtual() === "Entrada"; }

  function clearClientesDatalist() {
    if (!datalistClientes) return;
    datalistClientes.innerHTML = "";
  }

  function renderClientesDatalist(items) {
    if (!datalistClientes) return;
    datalistClientes.innerHTML = "";
    const nomes = new Set();
    (items || []).forEach((it) => {
      const nome = String(it?.NomeSugestao || it?.NomeCliente || "").trim();
      if (nome) nomes.add(nome);
    });
    [...nomes].slice(0, 50).forEach((nome) => {
      const opt = document.createElement("option");
      opt.value = nome;
      datalistClientes.appendChild(opt);
    });
  }

  async function buscarClientes(q) {
    if (!requireScriptUrl()) return;
    const data = await jsonpRequest({ action: "Clientes.Buscar", q: String(q ?? "") });
    if (!data || data.ok !== true) return;
    renderClientesDatalist(data.items || []);
  }

  function bindAutocompleteClientes() {
    if (!inputCliente) return;
    inputCliente.addEventListener("focus", () => {
      if (!isTipoEntrada()) return;
      buscarClientes(inputCliente.value || "").catch(() => {});
    });
    inputCliente.addEventListener("input", () => {
      if (!isTipoEntrada()) return;
      clearTimeout(clientesDebounce);
      clientesDebounce = setTimeout(() => {
        buscarClientes(inputCliente.value || "").catch(() => {});
      }, 250);
    });
    if (el.Tipo) {
      el.Tipo.addEventListener("change", () => {
        if (!isTipoEntrada()) clearClientesDatalist();
        atualizarVisibilidadeCampos();
      });
    }
  }

  // ============================================================
  // FORNECEDORES
  // ============================================================
  function isTipoSaida() { return getTipoAtual() === "Saida"; }

  function clearFornecedoresDatalist() {
    if (!datalistFornecedores) return;
    datalistFornecedores.innerHTML = "";
  }

  function renderFornecedoresDatalist(items) {
    if (!datalistFornecedores) return;
    datalistFornecedores.innerHTML = "";
    const nomes = new Set();
    (items || []).forEach((it) => {
      const nome = String(it?.NomeFornecedor || "").trim();
      if (nome) nomes.add(nome);
    });
    [...nomes].slice(0, 50).forEach((nome) => {
      const opt = document.createElement("option");
      opt.value = nome;
      datalistFornecedores.appendChild(opt);
    });
  }

  async function buscarFornecedores(q) {
    if (!requireScriptUrl()) return;
    const data = await jsonpRequest({ action: "Fornecedores.Buscar", q: String(q ?? "") });
    if (!data || data.ok !== true) return;
    renderFornecedoresDatalist(data.items || []);
  }

  function bindAutocompleteFornecedores() {
    if (!inputFornecedor) return;
    inputFornecedor.addEventListener("focus", () => {
      if (!isTipoSaida()) return;
      buscarFornecedores(inputFornecedor.value || "").catch(() => {});
    });
    inputFornecedor.addEventListener("input", () => {
      if (!isTipoSaida()) return;
      clearTimeout(fornecedoresDebounce);
      fornecedoresDebounce = setTimeout(() => {
        buscarFornecedores(inputFornecedor.value || "").catch(() => {});
      }, 250);
    });
    if (el.Tipo) {
      el.Tipo.addEventListener("change", () => {
        if (!isTipoSaida()) clearFornecedoresDatalist();
      });
    }
  }

  // ============================================================
  // VISIBILIDADE CAMPOS
  // ============================================================
  function atualizarVisibilidadeCampos() {
    const tipo = getTipoAtual();
    if (fieldCliente) fieldCliente.style.display = (tipo === "Entrada") ? "" : "none";
    if (fieldFornecedor) fieldFornecedor.style.display = (tipo === "Saida") ? "" : "none";
  }

  // ============================================================
  // TABS
  // ============================================================
  const tabRecorrentesDiv = document.getElementById("tabRecorrentes");

  function ativarTab(tab) {
    abaAtiva = tab;
    // Update tab buttons
    document.querySelectorAll(".tab-lista-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    // Show/hide content
    if (tabMesDiv) tabMesDiv.style.display = tab === "mes" ? "" : "none";
    if (tabPendentesDiv) tabPendentesDiv.style.display = tab === "pendentes" ? "" : "none";
    if (tabTodosDiv) tabTodosDiv.style.display = tab === "todos" ? "" : "none";
    if (tabRecorrentesDiv) tabRecorrentesDiv.style.display = tab === "recorrentes" ? "" : "none";

    // Load data for active tab
    if (tab === "mes") {
      carregarMes();
    } else if (tab === "pendentes") {
      carregarPendentes();
    } else if (tab === "todos") {
      listarTodos(1);
    } else if (tab === "recorrentes") {
      carregarRecorrentes();
    }
  }

  // ============================================================
  // RECORRENTES
  // ============================================================
  let dadosRecorrentes = [];
  let recorrenteEditando = null;

  async function carregarRecorrentes() {
    const tbodyRec = document.querySelector("#tabelaRecorrentes tbody");
    const fbRec = document.getElementById("feedbackRecorrentes");
    if (!tbodyRec) return;
    tbodyRec.innerHTML = skeletonRows(3, 8);

    try {
      const data = await jsonpRequest({ action: "Recorrentes.Listar" });
      if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao listar recorrentes.");

      dadosRecorrentes = data.items || [];
      tbodyRec.innerHTML = "";

      if (!dadosRecorrentes.length) {
        tbodyRec.innerHTML = '<tr><td colspan="8">Nenhum template recorrente.</td></tr>';
        setFeedback(fbRec, "", "info");
        return;
      }

      dadosRecorrentes.forEach(function(it) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          '<td>' + escapeHtml(it.Tipo || "") + '</td>' +
          '<td>' + escapeHtml(it.Categoria || "") + '</td>' +
          '<td>' + escapeHtml(it.Descricao || "") + '</td>' +
          '<td>' + formatMoneyBR(it.Valor) + '</td>' +
          '<td>' + escapeHtml(it.Frequencia || "") + '</td>' +
          '<td>' + escapeHtml(it.Dia_Vencimento || "") + '</td>' +
          '<td>' + escapeHtml(it.Ativo || "") + '</td>' +
          '<td><button class="btn btn--secondary btn-edit-rec" data-row="' + it.rowIndex + '" style="font-size:.75rem;padding:.25rem .5rem;">Editar</button> ' +
          '<button class="btn btn--danger btn-del-rec" data-row="' + it.rowIndex + '" style="font-size:.75rem;padding:.25rem .5rem;">Excluir</button></td>';
        tbodyRec.appendChild(tr);
      });

      // Bind edit/delete
      tbodyRec.querySelectorAll(".btn-edit-rec").forEach(function(btn) {
        btn.addEventListener("click", function() {
          var ri = parseInt(btn.dataset.row, 10);
          var item = dadosRecorrentes.find(function(x) { return x.rowIndex === ri; });
          if (item) editarRecorrente(item);
        });
      });
      tbodyRec.querySelectorAll(".btn-del-rec").forEach(function(btn) {
        btn.addEventListener("click", function() {
          var ri = parseInt(btn.dataset.row, 10);
          excluirRecorrente(ri);
        });
      });

      setFeedback(fbRec, dadosRecorrentes.length + " template(s)", "success");
    } catch (err) {
      tbodyRec.innerHTML = "";
      setFeedback(fbRec, err.message || "Erro.", "error");
    }
  }

  function abrirFormRecorrencia(item) {
    var formRec = document.getElementById("formRecorrencia");
    var titulo = document.getElementById("tituloRecorrencia");
    if (!formRec) return;

    formRec.style.display = "block";
    recorrenteEditando = item || null;

    if (titulo) titulo.textContent = item ? "Editar Recorrencia" : "Nova Recorrencia";

    document.getElementById("recTipo").value = item?.Tipo || "Saida";
    document.getElementById("recCategoria").value = item?.Categoria || "";
    document.getElementById("recDescricao").value = item?.Descricao || "";
    document.getElementById("recValor").value = item?.Valor || "";
    document.getElementById("recFrequencia").value = item?.Frequencia || "Mensal";
    document.getElementById("recDiaVencimento").value = item?.Dia_Vencimento || "1";
    document.getElementById("recFormaPagamento").value = item?.Forma_Pagamento || "";
    document.getElementById("recAtivo").value = item?.Ativo || "Sim";
  }

  function fecharFormRecorrencia() {
    var formRec = document.getElementById("formRecorrencia");
    if (formRec) formRec.style.display = "none";
    recorrenteEditando = null;
  }

  function editarRecorrente(item) {
    abrirFormRecorrencia(item);
  }

  async function salvarRecorrente() {
    var payload = {
      Tipo: document.getElementById("recTipo")?.value || "Saida",
      Categoria: document.getElementById("recCategoria")?.value || "",
      Descricao: document.getElementById("recDescricao")?.value || "",
      Valor: document.getElementById("recValor")?.value || "0",
      Frequencia: document.getElementById("recFrequencia")?.value || "Mensal",
      Dia_Vencimento: document.getElementById("recDiaVencimento")?.value || "1",
      Forma_Pagamento: document.getElementById("recFormaPagamento")?.value || "",
      Ativo: document.getElementById("recAtivo")?.value || "Sim"
    };

    if (!payload.Descricao) {
      showToast("Preencha a descricao.", { type: "error", duration: 3000 });
      return;
    }

    try {
      var action, reqPayload;
      if (recorrenteEditando) {
        payload.rowIndex = recorrenteEditando.rowIndex;
        payload.data = payload;
        action = "Recorrentes.Editar";
      } else {
        action = "Recorrentes.Criar";
      }

      const data = await jsonpRequest({
        action: action,
        payload: JSON.stringify(payload)
      });

      if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao salvar.");

      showToast(data.message || "Salvo!", { type: "success", duration: 3000 });
      fecharFormRecorrencia();
      carregarRecorrentes();
    } catch (err) {
      showToast(err.message || "Erro ao salvar.", { type: "error", duration: 4000 });
    }
  }

  async function excluirRecorrente(rowIndex) {
    if (!confirm("Excluir este template recorrente?")) return;
    try {
      const data = await jsonpRequest({ action: "Recorrentes.Excluir", rowIndex: rowIndex });
      if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao excluir.");
      showToast("Template excluido.", { type: "success", duration: 3000 });
      carregarRecorrentes();
    } catch (err) {
      showToast(err.message || "Erro.", { type: "error" });
    }
  }

  async function gerarRecorrentes() {
    if (!confirm("Gerar lancamentos pendentes do mes atual a partir dos templates ativos?")) return;
    try {
      const data = await jsonpRequest({ action: "Recorrentes.Gerar" });
      if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao gerar.");
      showToast(data.message || "Gerado!", { type: "success", duration: 5000 });
    } catch (err) {
      showToast(err.message || "Erro ao gerar.", { type: "error" });
    }
  }

  // ============================================================
  // FORM
  // ============================================================
  function clearForm() {
    Object.keys(el).forEach((k) => {
      if (!el[k]) return;
      el[k].value = "";
    });
    selectedRowIndex = null;
    ultimaDescricaoAuto = "";
    if (el.Data_Competencia) el.Data_Competencia.value = hojeISO();
    setFeedback(feedbackSalvar, "", "info");
    clearClientesDatalist();
    clearFornecedoresDatalist();
    clearDescricoesDatalist();
    atualizarVisibilidadeCampos();
    if (btnExcluir) btnExcluir.style.display = "none";
    if (btnNovo) btnNovo.style.display = "none";
    if (btnDuplicar) btnDuplicar.style.display = "none";
    if (btnMarcarPago) btnMarcarPago.style.display = "none";
    if (btnCancelarLanc) btnCancelarLanc.style.display = "none";
  }

  function abrirFormulario(modoEdicao = false) {
    if (!cardFormulario) return;
    cardFormulario.style.display = "block";
    cardFormulario.classList.toggle("modo-edicao", modoEdicao);
    if (tituloFormulario) {
      tituloFormulario.textContent = modoEdicao ? "Editar Lancamento" : "Novo Lancamento";
    }
    if (descFormulario) {
      descFormulario.textContent = modoEdicao
        ? "Altere os dados e clique em Salvar."
        : "Preencha os dados do lancamento.";
    }
    cardFormulario.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function fecharFormulario() {
    if (!cardFormulario) return;
    cardFormulario.style.display = "none";
    clearForm();
  }

  function mostrarBotoesEdicao(item) {
    if (btnNovo) btnNovo.style.display = "inline-block";
    if (btnDuplicar) btnDuplicar.style.display = "inline-block";
    if (btnExcluir) btnExcluir.style.display = "inline-block";
    if (btnMarcarPago) btnMarcarPago.style.display = (item?.Status === "Pendente") ? "inline-block" : "none";
    if (btnCancelarLanc) btnCancelarLanc.style.display = (item?.Status !== "Cancelado") ? "inline-block" : "none";
  }

  let itemAtualEdicao = null;

  function fillForm(it) {
    if (!it) return;
    itemAtualEdicao = it;
    Object.keys(el).forEach((k) => {
      if (!el[k]) return;
      if (k === "ID_Cliente") {
        el[k].value = it.NomeCliente || it[k] || "";
      } else if (k === "ID_Fornecedor") {
        el[k].value = it.NomeFornecedor || it[k] || "";
      } else if (k === "Data_Competencia" || k === "Data_Caixa" || k === "Mes_a_receber") {
        el[k].value = toISODate(it[k]);
      } else {
        el[k].value = it[k] ?? "";
      }
    });
    const ri = Number(it.rowIndex || 0);
    selectedRowIndex = ri > 0 ? ri : null;
    ultimaDescricaoAuto = "";
    clearDescricoesDatalist();
    if (!isTipoEntrada()) clearClientesDatalist();
    if (!isTipoSaida()) clearFornecedoresDatalist();
    aplicarDescricaoDaCategoria(false);
    atualizarVisibilidadeCampos();
    abrirFormulario(true);
    mostrarBotoesEdicao(it);
  }

  function buildLancPayload() {
    return {
      Data_Competencia: (el.Data_Competencia?.value || "").trim(),
      Data_Caixa: (el.Data_Caixa?.value || "").trim(),
      Tipo: (el.Tipo?.value || "").trim(),
      Origem: (el.Origem?.value || "").trim(),
      Categoria: (el.Categoria?.value || "").trim(),
      Descricao: (el.Descricao?.value || "").trim(),
      ID_Cliente: (el.ID_Cliente?.value || "").trim(),
      ID_Fornecedor: (el.ID_Fornecedor?.value || "").trim(),
      Forma_Pagamento: (el.Forma_Pagamento?.value || "").trim(),
      Instituicao_Financeira: (el.Instituicao_Financeira?.value || "").trim(),
      Titularidade: (el.Titularidade?.value || "").trim(),
      Parcelamento: (el.Parcelamento?.value || "").trim(),
      Valor: (el.Valor?.value || "").trim(),
      Status: (el.Status?.value || "").trim(),
      Observacoes: (el.Observacoes?.value || "").trim(),
      Mes_a_receber: (el.Mes_a_receber?.value || "").trim(),
    };
  }

  function buildFiltros() {
    return {
      fDataIni: (fDataIni?.value || "").trim(),
      fDataFim: (fDataFim?.value || "").trim(),
      fTipo: (fTipo?.value || "").trim(),
      fStatus: (fStatus?.value || "").trim(),
      fCategoria: (fCategoria?.value || "").trim(),
      fFormaPagamento: (fFormaPagamento?.value || "").trim(),
      fInstituicao: (fInstituicao?.value || "").trim(),
      fTitularidade: (fTitularidade?.value || "").trim(),
      q: (fQ?.value || "").trim(),
    };
  }

  async function validateRequired(payload) {
    if (!payload.Data_Competencia || !payload.Tipo || !payload.Categoria ||
        !payload.Descricao || !payload.Valor || !payload.Status) {
      const msg = "Preencha: Data, Tipo, Categoria, Descricao, Valor, Status.";
      setFeedback(feedbackSalvar, msg, "error");
      showToast(msg, { type: "error", duration: 4000 });
      return false;
    }
    if (!(await validarCategoriaSelecionada(payload))) return false;
    return true;
  }

  // ============================================================
  // RESUMO RAPIDO
  // ============================================================
  function atualizarResumoRapido(items) {
    const resumoEl = document.getElementById("resumoRapido");
    const entradasEl = document.getElementById("resumoEntradas");
    const saidasEl = document.getElementById("resumoSaidas");
    const pendentesEl = document.getElementById("resumoPendentes");
    const saldoEl = document.getElementById("resumoSaldo");

    if (!resumoEl) return;

    let entradas = 0, saidas = 0, pendentes = 0;

    items.forEach(it => {
      const valor = toNumberBR(it.Valor);
      if (it.Status === "Cancelado") return;
      if (it.Tipo === "Entrada") {
        if (it.Status === "Pago") entradas += valor;
        else if (it.Status === "Pendente") pendentes += valor;
      } else if (it.Tipo === "Saida") {
        saidas += valor;
      }
    });

    const saldo = entradas - saidas;

    if (entradasEl) entradasEl.textContent = formatMoneyBR(entradas);
    if (saidasEl) saidasEl.textContent = formatMoneyBR(saidas);
    if (pendentesEl) pendentesEl.textContent = formatMoneyBR(pendentes);
    if (saldoEl) {
      saldoEl.textContent = formatMoneyBR(saldo);
      saldoEl.style.color = saldo >= 0 ? "#228b22" : "#c41e3a";
    }

    resumoEl.style.display = items.length > 0 ? "grid" : "none";
  }

  // ============================================================
  // RENDER TABLE HELPERS
  // ============================================================
  function getClienteFornecedor(it) {
    if (it.Tipo === "Entrada") return it.NomeCliente || it.ID_Cliente || "";
    if (it.Tipo === "Saida") return it.NomeFornecedor || it.ID_Fornecedor || "";
    return it.NomeCliente || it.ID_Cliente || it.NomeFornecedor || it.ID_Fornecedor || "";
  }

  function sortItems(items) {
    if (!sortCol) return items;
    return [...items].sort((a, b) => {
      let va = a[sortCol] ?? "";
      let vb = b[sortCol] ?? "";
      if (sortCol === "Valor") {
        va = toNumberBR(va);
        vb = toNumberBR(vb);
      } else {
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
      }
      let cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "desc" ? -cmp : cmp;
    });
  }

  function criarLinhaTabela(it, options = {}) {
    const tr = document.createElement("tr");
    tr.dataset.rowIndex = String(it.rowIndex ?? "");

    const tipoClass = it.Tipo === "Entrada" ? "tipo-entrada" : it.Tipo === "Saida" ? "tipo-saida" : "";
    const statusClass = it.Status === "Pago" ? "status-pago" : it.Status === "Pendente" ? "status-pendente" : it.Status === "Cancelado" ? "status-cancelado" : "";
    const valorClass = it.Tipo === "Entrada" ? "valor-positivo" : it.Tipo === "Saida" ? "valor-negativo" : "";

    if (options.showAcoes) {
      // Tabela de pendentes - com botoes de acao
      tr.innerHTML = `
        <td>${escapeHtml(formatDateBR(it.Data_Competencia) || "")}</td>
        <td class="${tipoClass}">${escapeHtml(it.Tipo || "")}</td>
        <td>${escapeHtml(it.Categoria || "")}</td>
        <td title="${escapeHtml(it.Descricao || "")}">${escapeHtml((it.Descricao || "").substring(0, 25))}${(it.Descricao || "").length > 25 ? "..." : ""}</td>
        <td>${escapeHtml(getClienteFornecedor(it))}</td>
        <td class="${valorClass}">${escapeHtml(formatMoneyBR(it.Valor))}</td>
        <td>${escapeHtml(it.Mes_a_receber ? formatMesDisplay(toISODate(it.Mes_a_receber).substring(0, 7)) : "")}</td>
        <td class="acoes-linha"></td>
      `;
      const tdAcoes = tr.querySelector(".acoes-linha");

      const btnPago = document.createElement("button");
      btnPago.type = "button";
      btnPago.className = "btn-pago-rapido";
      btnPago.textContent = "Pago";
      btnPago.addEventListener("click", (e) => {
        e.stopPropagation();
        marcarPagoRapido(it);
      });
      tdAcoes.appendChild(btnPago);

      const btnEditar = document.createElement("button");
      btnEditar.type = "button";
      btnEditar.className = "btn-editar-rapido";
      btnEditar.textContent = "Editar";
      btnEditar.addEventListener("click", (e) => {
        e.stopPropagation();
        fillForm(it);
      });
      tdAcoes.appendChild(btnEditar);
    } else {
      // Tabela normal
      tr.innerHTML = `
        <td>${escapeHtml(formatDateBR(it.Data_Competencia) || "")}</td>
        <td class="${tipoClass}">${escapeHtml(it.Tipo || "")}</td>
        <td>${escapeHtml(it.Categoria || "")}</td>
        <td title="${escapeHtml(it.Descricao || "")}">${escapeHtml((it.Descricao || "").substring(0, 30))}${(it.Descricao || "").length > 30 ? "..." : ""}</td>
        <td>${escapeHtml(getClienteFornecedor(it))}</td>
        <td>${escapeHtml(it.Forma_Pagamento || "")}</td>
        <td class="${valorClass}">${escapeHtml(formatMoneyBR(it.Valor))}</td>
        <td class="${statusClass}">${escapeHtml(it.Status || "")}</td>
      `;
    }

    tr.addEventListener("click", () => {
      fillForm(it);
    });

    return tr;
  }

  function renderTableInto(tbody, items, options = {}) {
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!Array.isArray(items) || items.length === 0) {
      const cols = options.showAcoes ? 8 : 8;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="${cols}">Nenhum lancamento encontrado.</td>`;
      tbody.appendChild(tr);
      return;
    }

    const sorted = sortItems(items);
    sorted.forEach((it) => {
      tbody.appendChild(criarLinhaTabela(it, options));
    });
  }

  // ============================================================
  // CARREGAR MES
  // ============================================================
  async function carregarMes() {
    if (!requireScriptUrl()) return;

    const mesValue = mesSelecionadoInput?.value || getMesAtualYYYYMM();
    if (mesSelecionadoInput && !mesSelecionadoInput.value) {
      mesSelecionadoInput.value = getMesAtualYYYYMM();
    }

    const [ano, mes] = mesValue.split("-");
    const dataIni = `${ano}-${mes}-01`;
    const ultimoDia = new Date(Number(ano), Number(mes), 0).getDate();
    const dataFim = `${ano}-${mes}-${String(ultimoDia).padStart(2, "0")}`;

    setFeedback(feedbackMes, "Carregando...", "info");
    if (tbodyMes) tbodyMes.innerHTML = skeletonRows(5, 8);

    try {
      const data = await jsonpRequest({
        action: "Lancamentos.Listar",
        sheet: SHEET_NAME,
        filtros: JSON.stringify({ fDataIni: dataIni, fDataFim: dataFim }),
        page: 1,
        limit: 500
      });

      if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao listar.");

      dadosMesAtual = data.items || [];
      renderTableInto(tbodyMes, dadosMesAtual);
      atualizarResumoRapido(dadosMesAtual);

      const total = data.pagination?.total || dadosMesAtual.length;
      setFeedback(feedbackMes, `${total} lancamento(s) em ${formatMesDisplay(mesValue)}`, "success");
    } catch (err) {
      setFeedback(feedbackMes, err.message || "Erro ao carregar.", "error");
    }
  }

  // ============================================================
  // CARREGAR PENDENTES
  // ============================================================
  async function carregarPendentes() {
    if (!requireScriptUrl()) return;

    setFeedback(feedbackPendentes, "Carregando pendentes...", "info");
    if (tbodyPendentes) tbodyPendentes.innerHTML = skeletonRows(5, 8);

    try {
      const data = await jsonpRequest({
        action: "Lancamentos.Listar",
        sheet: SHEET_NAME,
        filtros: JSON.stringify({ fStatus: "Pendente" }),
        page: 1,
        limit: 500
      });

      if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao listar.");

      dadosPendentesAtual = data.items || [];
      renderTableInto(tbodyPendentes, dadosPendentesAtual, { showAcoes: true });

      const total = data.pagination?.total || dadosPendentesAtual.length;
      if (badgePendentes) {
        badgePendentes.textContent = String(total);
        badgePendentes.style.display = total > 0 ? "inline-block" : "none";
      }

      setFeedback(feedbackPendentes, `${total} pendente(s)`, "success");
    } catch (err) {
      setFeedback(feedbackPendentes, err.message || "Erro.", "error");
    }
  }

  // ============================================================
  // MARCAR PAGO RAPIDO (da tabela de pendentes)
  // ============================================================
  async function marcarPagoRapido(it) {
    if (!it?.rowIndex) return;

    const payload = {
      Data_Competencia: it.Data_Competencia || "",
      Data_Caixa: it.Data_Caixa || hojeISO(),
      Tipo: it.Tipo || "",
      Origem: it.Origem || "",
      Categoria: it.Categoria || "",
      Descricao: it.Descricao || "",
      ID_Cliente: it.ID_Cliente || "",
      ID_Fornecedor: it.ID_Fornecedor || "",
      Forma_Pagamento: it.Forma_Pagamento || "",
      Instituicao_Financeira: it.Instituicao_Financeira || "",
      Titularidade: it.Titularidade || "",
      Parcelamento: it.Parcelamento || "",
      Valor: it.Valor || "",
      Status: "Pago",
      Observacoes: it.Observacoes || "",
      Mes_a_receber: it.Mes_a_receber || "",
    };

    if (!payload.Data_Caixa) payload.Data_Caixa = hojeISO();

    try {
      const data = await jsonpRequest({
        action: "Lancamentos.Editar",
        sheet: SHEET_NAME,
        payload: JSON.stringify({ rowIndex: it.rowIndex, data: payload }),
      });
      if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao marcar pago.");

      // Recarregar pendentes
      await carregarPendentes();
      // Tambem recarregar mes se estiver visivel
      if (abaAtiva === "pendentes") {
        // Pre-carregar mes em background
        carregarMes().catch(() => {});
      }
    } catch (err) {
      setFeedback(feedbackPendentes, err.message || "Erro.", "error");
    }
  }

  // ============================================================
  // LISTAR TODOS (com filtros e paginacao)
  // ============================================================
  async function listarTodos(page = 1) {
    if (!requireScriptUrl()) return;

    setFeedback(feedbackLanc, "Carregando...", "info");
    if (tbodyTodos) tbodyTodos.innerHTML = skeletonRows(5, 8);
    try {
      const filtros = buildFiltros();
      syncFiltersToURL();
      const data = await jsonpRequest({
        action: "Lancamentos.Listar",
        sheet: SHEET_NAME,
        filtros: JSON.stringify(filtros),
        page: page,
        limit: _pageSize
      });

      if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao listar.");

      dadosListaAtual = data.items || [];
      renderTableInto(tbodyTodos, dadosListaAtual);

      const pagination = data.pagination || { page: 1, totalPages: 1, total: 0 };
      paginaAtual = pagination.page;
      totalPaginas = pagination.totalPages;
      atualizarControlesPaginacao(pagination);

      setFeedback(feedbackLanc, `${dadosListaAtual.length} de ${pagination.total} itens`, "success");
    } catch (err) {
      setFeedback(feedbackLanc, err.message || "Erro ao listar.", "error");
    }
  }

  function atualizarControlesPaginacao(pagination) {
    const container = document.getElementById("paginationLancamentos");
    if (!container) return;
    const page = pagination.page || 1;
    const pages = pagination.totalPages || 1;
    const total = pagination.total || 0;

    var html = "";

    // Per-page selector
    html += '<div class="pagination__per-page"><label>Itens:</label><select id="selPageSize">';
    [10, 25, 50, 100].forEach(function(n) {
      html += '<option value="' + n + '"' + (n === _pageSize ? ' selected' : '') + '>' + n + '</option>';
    });
    html += '</select></div>';

    // Prev button
    html += '<button class="pagination__btn" data-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>&laquo;</button>';

    // Page buttons with ellipsis
    var range = buildPageRange(page, pages);
    range.forEach(function(p) {
      if (p === "...") {
        html += '<span class="pagination__ellipsis">...</span>';
      } else {
        html += '<button class="pagination__btn' + (p === page ? ' pagination__btn--active' : '') + '" data-page="' + p + '">' + p + '</button>';
      }
    });

    // Next button
    html += '<button class="pagination__btn" data-page="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + '>&raquo;</button>';

    // Total info
    html += '<span class="pagination__info">Total: ' + total + '</span>';

    container.innerHTML = html;

    // Bind events
    container.querySelectorAll(".pagination__btn[data-page]").forEach(function(btn) {
      btn.addEventListener("click", function(e) {
        e.preventDefault();
        var p = parseInt(btn.dataset.page, 10);
        if (p >= 1 && p <= pages) listarTodos(p);
      });
    });

    var selPageSize = document.getElementById("selPageSize");
    if (selPageSize) {
      selPageSize.addEventListener("change", function() {
        _pageSize = parseInt(selPageSize.value, 10) || 25;
        paginaAtual = 1;
        listarTodos(1);
      });
    }
  }

  function buildPageRange(current, total) {
    if (total <= 7) {
      var arr = [];
      for (var i = 1; i <= total; i++) arr.push(i);
      return arr;
    }
    var pages = [1];
    var start = Math.max(2, current - 1);
    var end = Math.min(total - 1, current + 1);
    if (start > 2) pages.push("...");
    for (var j = start; j <= end; j++) pages.push(j);
    if (end < total - 1) pages.push("...");
    pages.push(total);
    return pages;
  }

  // ============================================================
  // SALVAR
  // ============================================================
  async function criar(payload) {
    const data = await jsonpRequest({
      action: "Lancamentos.Criar",
      sheet: SHEET_NAME,
      payload: JSON.stringify(payload),
    });
    if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao salvar (criar).");
    return data;
  }

  async function editar(rowIndex, payload) {
    const data = await jsonpRequest({
      action: "Lancamentos.Editar",
      sheet: SHEET_NAME,
      payload: JSON.stringify({ rowIndex, data: payload }),
    });
    if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao salvar (editar).");
    return data;
  }

  function confirmParcelamentoSeNovo(payload) {
    if (selectedRowIndex) return true;
    const n = parseParcelCount(payload.Parcelamento);
    if (!n || n < 2) return true;
    const total = toNumberBR(payload.Valor);
    const each = n ? total / n : 0;
    const base = payload.Data_Caixa || payload.Data_Competencia;
    const msg =
      `Parcelamento = ${n}\n\n` +
      `Serao criadas ${n} parcelas (1/${n}...${n}/${n}).\n` +
      `Total: ${formatMoneyBR(total)}\n` +
      `Aprox/parcela: ${formatMoneyBR(each)}\n` +
      `Data base: ${base || "(vazia)"}\n\n` +
      `Continuar?`;
    return window.confirm(msg);
  }

  async function salvar() {
    if (_saving) return;
    _saving = true;
    try {
      if (!requireScriptUrl()) return;
      aplicarDescricaoDaCategoria(false);
      const payload = buildLancPayload();
      if (!(await validateRequired(payload))) return;
      if (!confirmParcelamentoSeNovo(payload)) {
        setFeedback(feedbackSalvar, "Operacao cancelada.", "info");
        return;
      }

      setFeedback(feedbackSalvar, "Salvando...", "info");
      const desc = payload.Descricao || "";
      const valor = payload.Valor || "";
      if (selectedRowIndex && Number(selectedRowIndex) >= 2) {
        const resp = await editar(selectedRowIndex, payload);
        setFeedback(feedbackSalvar, resp.message || "Atualizado!", "success");
        showToast("Lancamento atualizado: " + desc + (valor ? " - R$ " + valor : ""), { type: "success", duration: 4000 });
        clearForm();
        abrirFormulario(false);
      } else {
        const resp = await criar(payload);
        setFeedback(feedbackSalvar, resp.message || "Salvo!", "success");
        showToast("Lancamento salvo: " + desc + (valor ? " - R$ " + valor : ""), { type: "success", duration: 4000 });
        clearForm();
        abrirFormulario(false);
      }

      // Recarregar dados da aba ativa
      await recarregarAbaAtiva();

    } catch (err) {
      const msg = err.message || "Erro ao salvar.";
      setFeedback(feedbackSalvar, msg, "error");
      showToast(msg, { type: "error", duration: 5000 });
    } finally {
      _saving = false;
    }
  }

  async function recarregarAbaAtiva() {
    if (abaAtiva === "mes") {
      await carregarMes();
      carregarPendentes().catch(() => {}); // atualiza badge
    } else if (abaAtiva === "pendentes") {
      await carregarPendentes();
      carregarMes().catch(() => {}); // atualiza resumo
    } else {
      await listarTodos(paginaAtual);
      carregarPendentes().catch(() => {}); // atualiza badge
    }
  }

  function limparFiltro() {
    if (formFiltro) formFiltro.reset();
    history.replaceState(null, "", window.location.pathname);
    setFeedback(feedbackLanc, "", "info");
    paginaAtual = 1;
    listarTodos(1);
  }

  // ============================================================
  // EXCLUIR
  // ============================================================
  function abrirModalExcluir() {
    if (!modalExcluir || !selectedRowIndex) return;
    const desc = el.Descricao?.value || "";
    const valor = el.Valor?.value || "";
    const data = el.Data_Competencia?.value || "";
    if (modalExcluirInfo) {
      modalExcluirInfo.textContent = `${data} - ${desc} - R$ ${valor}`;
    }
    modalExcluir.classList.add("is-open");
  }

  function fecharModalExcluir() {
    if (modalExcluir) modalExcluir.classList.remove("is-open");
  }

  async function confirmarExcluir() {
    if (!selectedRowIndex) return;
    const rowIdx = selectedRowIndex;
    const desc = el.Descricao?.value || "";
    const valor = el.Valor?.value || "";
    fecharModalExcluir();
    fecharFormulario();

    setFeedback(feedbackLanc, "Excluindo...", "info");

    try {
      const data = await jsonpRequest({
        action: "Lancamentos.Excluir",
        sheet: SHEET_NAME,
        rowIndex: rowIdx
      });
      if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao excluir.");

      showToast("Lancamento excluido: " + (desc || "item") + (valor ? " - R$ " + valor : ""), {
        type: "success",
        duration: 4000
      });
      setFeedback(feedbackLanc, "Lancamento excluido com sucesso.", "success");
      await recarregarAbaAtiva();
    } catch (err) {
      showToast(err.message || "Erro ao excluir.", { type: "error" });
      setFeedback(feedbackLanc, err.message || "Erro ao excluir.", "error");
    }
  }

  // ============================================================
  // ACOES RAPIDAS
  // ============================================================
  function duplicarLancamento() {
    if (!itemAtualEdicao) return;
    selectedRowIndex = null;
    if (tituloFormulario) tituloFormulario.textContent = "Duplicar Lancamento";
    if (descFormulario) descFormulario.textContent = "Copia criada. Altere os dados e salve.";
    if (el.Data_Competencia) el.Data_Competencia.value = hojeISO();
    if (el.Data_Caixa) el.Data_Caixa.value = "";
    if (btnNovo) btnNovo.style.display = "none";
    if (btnDuplicar) btnDuplicar.style.display = "none";
    if (btnExcluir) btnExcluir.style.display = "none";
    if (btnMarcarPago) btnMarcarPago.style.display = "none";
    if (btnCancelarLanc) btnCancelarLanc.style.display = "none";
    setFeedback(feedbackSalvar, "Lancamento duplicado. Clique em Salvar para criar.", "info");
  }

  async function marcarComoPago() {
    if (!selectedRowIndex) return;
    el.Status.value = "Pago";
    if (!el.Data_Caixa.value) el.Data_Caixa.value = hojeISO();
    setFeedback(feedbackSalvar, "Salvando como Pago...", "info");
    await salvar();
  }

  async function cancelarLancamento() {
    if (!selectedRowIndex) return;
    if (!confirm("Deseja marcar este lancamento como Cancelado?")) return;
    el.Status.value = "Cancelado";
    setFeedback(feedbackSalvar, "Cancelando lancamento...", "info");
    await salvar();
  }

  // ============================================================
  // MES NAVEGACAO
  // ============================================================
  function navegarMes(delta) {
    const valor = mesSelecionadoInput?.value || getMesAtualYYYYMM();
    const [ano, mes] = valor.split("-").map(Number);
    const d = new Date(ano, mes - 1 + delta, 1);
    const novoMes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (mesSelecionadoInput) mesSelecionadoInput.value = novoMes;
    carregarMes();
  }

  // ============================================================
  // IMPRIMIR / EXPORTAR MES
  // ============================================================
  function imprimirMes() {
    const mesValue = mesSelecionadoInput?.value || getMesAtualYYYYMM();
    const printTitulo = document.getElementById("printTitulo");
    const printSubtitulo = document.getElementById("printSubtitulo");

    if (printTitulo) printTitulo.textContent = `Lancamentos - ${formatMesDisplay(mesValue)}`;
    if (printSubtitulo) printSubtitulo.textContent = `Gerado em ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`;

    window.print();
  }

  function exportarMesPDF() {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      setFeedback(feedbackMes, "jsPDF nao carregado.", "error");
      return;
    }
    if (!dadosMesAtual.length) {
      setFeedback(feedbackMes, "Nenhum dado para exportar.", "error");
      return;
    }

    const mesValue = mesSelecionadoInput?.value || getMesAtualYYYYMM();
    const doc = new jsPDF({ orientation: "landscape" });

    // Titulo
    doc.setFontSize(16);
    doc.text(`Lancamentos - ${formatMesDisplay(mesValue)}`, 14, 15);

    // Resumo
    let entradas = 0, saidas = 0, pendentes = 0;
    dadosMesAtual.forEach(it => {
      const valor = toNumberBR(it.Valor);
      if (it.Status === "Cancelado") return;
      if (it.Tipo === "Entrada") {
        if (it.Status === "Pago") entradas += valor;
        else if (it.Status === "Pendente") pendentes += valor;
      } else if (it.Tipo === "Saida") saidas += valor;
    });

    doc.setFontSize(10);
    doc.text(`Entradas: ${formatMoneyBR(entradas)}`, 14, 24);
    doc.text(`Saidas: ${formatMoneyBR(saidas)}`, 80, 24);
    doc.text(`Pendentes: ${formatMoneyBR(pendentes)}`, 140, 24);
    doc.text(`Saldo: ${formatMoneyBR(entradas - saidas)}`, 200, 24);

    const headers = ["Data", "Tipo", "Categoria", "Descricao", "Cliente/Forn.", "Pagamento", "Valor", "Status"];
    const rows = sortItems(dadosMesAtual).map(it => [
      formatDateBR(it.Data_Competencia),
      it.Tipo || "",
      it.Categoria || "",
      (it.Descricao || "").substring(0, 25),
      getClienteFornecedor(it),
      it.Forma_Pagamento || "",
      formatMoneyBR(it.Valor),
      it.Status || ""
    ]);

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [139, 92, 165] }
    });

    doc.save(`Lancamentos_${mesValue}.pdf`);
    setFeedback(feedbackMes, "PDF exportado.", "success");
  }

  // ============================================================
  // SORT (para tabela "Todos")
  // ============================================================
  function updateSortIcons(table) {
    if (!table) return;
    const ths = table.querySelectorAll("th.sortable");
    ths.forEach(th => {
      th.classList.remove("sort-asc", "sort-desc");
      if (th.dataset.col === sortCol) {
        th.classList.add(sortDir === "asc" ? "sort-asc" : "sort-desc");
      }
    });
  }

  function handleSort(col) {
    if (sortCol === col) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortCol = col;
      sortDir = "asc";
    }

    // Re-render active tab
    if (abaAtiva === "mes") {
      renderTableInto(tbodyMes, dadosMesAtual);
      updateSortIcons(tabelaMes);
    } else if (abaAtiva === "todos") {
      renderTableInto(tbodyTodos, dadosListaAtual);
      updateSortIcons(tabelaTodos);
    }
  }

  function bindSortHeaders() {
    [tabelaMes, tabelaTodos].forEach(table => {
      if (!table) return;
      table.querySelectorAll("th.sortable").forEach(th => {
        th.style.cursor = "pointer";
        th.addEventListener("click", () => {
          const col = th.dataset.col;
          if (col) handleSort(col);
        });
      });
    });
  }

  // ============================================================
  // INIT DEFAULTS
  // ============================================================
  function initDefaults() {
    if (el.Data_Competencia && !el.Data_Competencia.value) el.Data_Competencia.value = hojeISO();
    if (mesSelecionadoInput && !mesSelecionadoInput.value) mesSelecionadoInput.value = getMesAtualYYYYMM();

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
    // Filtros (aba Todos)
    if (btnFiltrar) btnFiltrar.addEventListener("click", (e) => (e.preventDefault(), listarTodos(1)));
    if (btnLimparFiltro) btnLimparFiltro.addEventListener("click", (e) => (e.preventDefault(), limparFiltro()));
    if (formFiltro) formFiltro.addEventListener("submit", (e) => (e.preventDefault(), listarTodos(1)));
    if (formLanc) formLanc.addEventListener("submit", (e) => (e.preventDefault(), salvar()));

    // Abrir novo lancamento
    if (btnAbrirNovoLanc) btnAbrirNovoLanc.addEventListener("click", (e) => {
      e.preventDefault();
      clearForm();
      abrirFormulario(false);
    });

    // Fechar formulario
    if (btnFecharForm) btnFecharForm.addEventListener("click", (e) => {
      e.preventDefault();
      fecharFormulario();
    });

    // Limpar / Novo
    if (btnNovo) btnNovo.addEventListener("click", (e) => {
      e.preventDefault();
      clearForm();
      abrirFormulario(false);
    });

    // Duplicar
    if (btnDuplicar) btnDuplicar.addEventListener("click", (e) => {
      e.preventDefault();
      duplicarLancamento();
    });

    // Marcar como Pago
    if (btnMarcarPago) btnMarcarPago.addEventListener("click", (e) => {
      e.preventDefault();
      marcarComoPago();
    });

    // Cancelar Lancamento
    if (btnCancelarLanc) btnCancelarLanc.addEventListener("click", (e) => {
      e.preventDefault();
      cancelarLancamento();
    });

    // Excluir
    if (btnExcluir) btnExcluir.addEventListener("click", (e) => (e.preventDefault(), abrirModalExcluir()));
    if (btnCancelarExcluir) btnCancelarExcluir.addEventListener("click", (e) => (e.preventDefault(), fecharModalExcluir()));
    if (btnConfirmarExcluir) btnConfirmarExcluir.addEventListener("click", (e) => (e.preventDefault(), confirmarExcluir()));
    if (modalExcluir) {
      modalExcluir.addEventListener("click", (e) => {
        if (e.target === modalExcluir) fecharModalExcluir();
      });
    }

    // Tabs
    if (tabsLista) {
      tabsLista.addEventListener("click", (e) => {
        const btn = e.target.closest(".tab-lista-btn");
        if (!btn) return;
        const tab = btn.dataset.tab;
        if (tab) ativarTab(tab);
      });
    }

    // Mes navegacao
    if (btnMesAnterior) btnMesAnterior.addEventListener("click", () => navegarMes(-1));
    if (btnMesSeguinte) btnMesSeguinte.addEventListener("click", () => navegarMes(1));
    if (btnMesAtual) btnMesAtual.addEventListener("click", () => {
      if (mesSelecionadoInput) mesSelecionadoInput.value = getMesAtualYYYYMM();
      carregarMes();
    });
    if (mesSelecionadoInput) mesSelecionadoInput.addEventListener("change", () => carregarMes());

    // Imprimir / Exportar mes
    const btnImprimirMes = document.getElementById("btnImprimirMes");
    const btnExportMesPDF = document.getElementById("btnExportMesPDF");
    if (btnImprimirMes) btnImprimirMes.addEventListener("click", imprimirMes);
    if (btnExportMesPDF) btnExportMesPDF.addEventListener("click", exportarMesPDF);

    // Paginacao is now dynamically rendered by atualizarControlesPaginacao()

    // Recorrentes
    var btnNovaRec = document.getElementById("btnNovaRecorrencia");
    var btnGerarRec = document.getElementById("btnGerarRecorrentes");
    var btnSalvarRec = document.getElementById("btnSalvarRecorrencia");
    var btnCancelarRec = document.getElementById("btnCancelarRecorrencia");
    if (btnNovaRec) btnNovaRec.addEventListener("click", function() { abrirFormRecorrencia(null); });
    if (btnGerarRec) btnGerarRec.addEventListener("click", gerarRecorrentes);
    if (btnSalvarRec) btnSalvarRec.addEventListener("click", salvarRecorrente);
    if (btnCancelarRec) btnCancelarRec.addEventListener("click", fecharFormRecorrencia);

    // Exportacao (aba Todos)
    const btnExportExcel = document.getElementById("btnExportExcel");
    const btnExportPDF = document.getElementById("btnExportPDF");
    if (btnExportExcel) {
      btnExportExcel.addEventListener("click", (e) => {
        e.preventDefault();
        if (!dadosListaAtual.length) {
          setFeedback(feedbackLanc, "Nenhum dado para exportar.", "error");
          return;
        }
        window.EssenzaExport?.lancamentosExcel(dadosListaAtual);
      });
    }
    if (btnExportPDF) {
      btnExportPDF.addEventListener("click", (e) => {
        e.preventDefault();
        if (!dadosListaAtual.length) {
          setFeedback(feedbackLanc, "Nenhum dado para exportar.", "error");
          return;
        }
        window.EssenzaExport?.lancamentosPDF(dadosListaAtual);
      });
    }
  }

  // ============================================================
  // INIT
  // ============================================================
  initDefaults();
  bind();
  bindAutocompleteClientes();
  bindAutocompleteFornecedores();
  bindCategoriaPadrao();
  bindSortHeaders();
  atualizarVisibilidadeCampos();

  loadFiltersFromURL();

  carregarCategoriasAtivas(getTipoAtual()).catch(() => {});
  carregarTodasCategorias().catch(() => {});

  // Carregar mes atual + pendentes em paralelo
  carregarMes();
  carregarPendentes();
})();
