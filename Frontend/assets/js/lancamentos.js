// lancamentos.js (JSONP - sem CORS)
// Requer: assets/js/config.js, auth.js, api.js
// Backend: Api.gs (Registry) + Categoria.gs + Lancamentos.gs + Clientes.gs
//
// ✅ Categoria padronizada:
// - Categoria obrigatória (datalist vindo da aba Categoria, somenteAtivos=1 e por Tipo)
// - Descricao com opções (datalist) agregando TODAS as linhas da categoria (mesmo Tipo+Categoria)
// - Descricao_Padrao pode ter várias opções separadas por |, quebra de linha, ; ou ,
// - Valida que Categoria existe

(() => {
  "use strict";

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

  const tabela = document.getElementById("tabelaLancamentos");
  const tbody = tabela ? tabela.querySelector("tbody") : null;

  const formLanc = document.getElementById("formLancamento");
  const feedbackSalvar = document.getElementById("feedbackSalvar");
  const btnNovo = document.getElementById("btnNovoLancamento");
  const btnExcluir = document.getElementById("btnExcluirLanc");

  // Novos elementos do formulário
  const cardFormulario = document.getElementById("cardFormulario");
  const btnAbrirNovoLanc = document.getElementById("btnAbrirNovoLanc");
  const btnFecharForm = document.getElementById("btnFecharForm");
  const tituloFormulario = document.getElementById("tituloFormulario");
  const descFormulario = document.getElementById("descFormulario");
  const btnDuplicar = document.getElementById("btnDuplicar");
  const btnMarcarPago = document.getElementById("btnMarcarPago");
  const btnCancelarLanc = document.getElementById("btnCancelarLanc");

  // Modal
  const modalExcluir = document.getElementById("modalExcluir");
  const modalExcluirInfo = document.getElementById("modalExcluirInfo");
  const btnCancelarExcluir = document.getElementById("btnCancelarExcluir");
  const btnConfirmarExcluir = document.getElementById("btnConfirmarExcluir");

  // Clientes (opcional)
  const inputCliente = document.getElementById("ID_Cliente");
  const datalistClientes = document.getElementById("listaClientes");
  const fieldCliente = document.getElementById("fieldCliente");

  // Fornecedores (opcional)
  const inputFornecedor = document.getElementById("ID_Fornecedor");
  const datalistFornecedores = document.getElementById("listaFornecedores");
  const fieldFornecedor = document.getElementById("fieldFornecedor");

  // Categoria (padronização)
  const inputCategoria = document.getElementById("Categoria");
  const datalistCategorias = document.getElementById("listaCategorias");

  // Descrições por categoria
  const datalistDescricoes = document.getElementById("listaDescricoes");

  // Campos do formulário
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
  let dadosListaAtual = []; // para exportação
  let paginaAtual = 1;
  let totalPaginas = 1;
  const ITENS_POR_PAGINA = 50;

  // Ordenação
  let sortCol = "Data_Competencia";
  let sortDir = "desc";

  // Clientes
  let clientesDebounce = null;

  // Fornecedores
  let fornecedoresDebounce = null;

  // Categorias
  let categoriasCache = [];
  let ultimaDescricaoAuto = "";

  // ---------- Helpers ----------
  function setFeedback(node, msg, type = "info") {
    if (!node) return;
    node.textContent = msg || "";
    node.dataset.type = type;
  }

  function hojeISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function requireScriptUrl() {
    const url = window.EssenzaApi?.getScriptUrl?.() || "";
    if (!url || !url.includes("/exec")) {
      setFeedback(feedbackLanc, "SCRIPT_URL inválida. Ajuste em config.js.", "error");
      return false;
    }
    return true;
  }

  const jsonpRequest = window.EssenzaApi?.request || (() => Promise.reject(new Error("EssenzaApi não carregado")));

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatMoneyBR(v) {
    const s = String(v ?? "").trim();
    if (!s) return "";
    const num = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(",", "."));
    if (Number.isNaN(num)) return s;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function toNumberBR(v) {
    const s = String(v ?? "").trim();
    if (!s) return 0;
    const clean = s.replace(/r\$\s?/gi, "");
    const num = Number(clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(",", "."));
    return Number.isNaN(num) ? 0 : num;
  }

  function formatDateBR(v) {
    if (!v) return "";
    const s = String(v).trim();
    // ISO format: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y, m, d] = s.substring(0, 10).split("-");
      return `${d}/${m}/${y}`;
    }
    return s;
  }

  // Converte qualquer formato de data para YYYY-MM-DD (para inputs type="date")
  function toISODate(v) {
    if (!v) return "";
    const s = String(v).trim();
    if (!s) return "";

    // Já está em YYYY-MM-DD (possivelmente com hora)
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      return s.substring(0, 10);
    }

    // DD/MM/YYYY
    const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brMatch) {
      const d = brMatch[1].padStart(2, "0");
      const m = brMatch[2].padStart(2, "0");
      const y = brMatch[3];
      return `${y}-${m}-${d}`;
    }

    // Tenta parse genérico
    const date = new Date(s);
    if (!isNaN(date.getTime())) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
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
  // DESCRICOES (datalist) — agrega todas as descrições
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
      String(raw || "")
        .split(/\r?\n|[|;,]/g) // aceita | \n ; ,
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => parts.push(s));
    });

    const uniq = new Set(parts);
    [...uniq].slice(0, 80).forEach((txt) => {
      const opt = document.createElement("option");
      opt.value = txt;
      datalistDescricoes.appendChild(opt);
    });
  }

  // ============================================================
  // CATEGORIAS — padronização
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

    // Também preenche o datalist do filtro
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

    if (!data || data.ok !== true) {
      console.error("Categoria.Listar falhou:", data);
      return;
    }

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
    if (!matches.length) {
      clearDescricoesDatalist();
      return;
    }

    const padroes = matches
      .map((m) => String(m.Descricao_Padrao || "").trim())
      .filter(Boolean);

    if (!padroes.length) {
      clearDescricoesDatalist();
      return;
    }

    // ✅ monta opções no datalist
    renderDescricoesFromPadrao(padroes);

    const atual = String(el.Descricao.value || "").trim();
    const primeira = padroes
      .join("|")
      .split(/\r?\n|[|;,]/g)
      .map((s) => s.trim())
      .filter(Boolean)[0] || "";

    if ((force || !atual || atual === ultimaDescricaoAuto) && primeira) {
      el.Descricao.value = primeira;
      ultimaDescricaoAuto = primeira;

      setFeedback(feedbackSalvar, "Descrição sugerida pela categoria.", "info");
      setTimeout(() => setFeedback(feedbackSalvar, "", "info"), 1200);
    }
  }

  function validarCategoriaSelecionada(payload) {
    const tipo = String(payload.Tipo || "").trim();
    const cat = String(payload.Categoria || "").trim();
    if (!tipo || !cat) return false;

    const matches = findCategoriaAll(tipo, cat);
    if (!matches.length) {
      setFeedback(feedbackSalvar, "Selecione uma Categoria válida (da lista).", "error");
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

    el.Categoria.addEventListener("change", () => {
      aplicarDescricaoDaCategoria(true);
    });

    el.Categoria.addEventListener("blur", () => {
      aplicarDescricaoDaCategoria(false);
    });

    // ✅ se clicar no campo Descricao, garante que o datalist já está populado
    if (el.Descricao) {
      el.Descricao.addEventListener("focus", () => {
        aplicarDescricaoDaCategoria(false);
      });
    }
  }

  // ============================================================
  // CLIENTES — autocomplete (mantido)
  // ============================================================
  function isTipoEntrada() {
    return getTipoAtual() === "Entrada";
  }

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

    const data = await jsonpRequest({
      action: "Clientes.Buscar",
      q: String(q ?? ""),
    });

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
  // FORNECEDORES — autocomplete
  // ============================================================
  function isTipoSaida() {
    return getTipoAtual() === "Saida";
  }

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

    const data = await jsonpRequest({
      action: "Fornecedores.Buscar",
      q: String(q ?? ""),
    });

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
  // VISIBILIDADE CAMPOS CLIENTE/FORNECEDOR
  // ============================================================
  function atualizarVisibilidadeCampos() {
    const tipo = getTipoAtual();

    // Sem tipo: esconde ambos
    // Entrada: mostra Cliente, esconde Fornecedor
    // Saida: mostra Fornecedor, esconde Cliente
    // Outros (Transferência): esconde ambos
    if (fieldCliente) {
      fieldCliente.style.display = (tipo === "Entrada") ? "" : "none";
    }
    if (fieldFornecedor) {
      fieldFornecedor.style.display = (tipo === "Saida") ? "" : "none";
    }
  }

  // ============================================================
  // FORM / LISTA / SALVAR
  // ============================================================
  function clearForm() {
    Object.keys(el).forEach((k) => {
      if (!el[k]) return;
      el[k].value = "";
    });

    selectedRowIndex = null;
    ultimaDescricaoAuto = "";

    if (el.Data_Competencia) el.Data_Competencia.value = hojeISO();

    setFeedback(feedbackSalvar, "Novo lançamento", "info");
    setTimeout(() => setFeedback(feedbackSalvar, "", "info"), 1200);

    clearClientesDatalist();
    clearFornecedoresDatalist();
    clearDescricoesDatalist();
    atualizarVisibilidadeCampos();

    // Esconder botões de edição
    if (btnExcluir) btnExcluir.style.display = "none";
    if (btnNovo) btnNovo.style.display = "none";
    if (btnDuplicar) btnDuplicar.style.display = "none";
    if (btnMarcarPago) btnMarcarPago.style.display = "none";
    if (btnCancelarLanc) btnCancelarLanc.style.display = "none";
  }

  // ============================================================
  // MOSTRAR / OCULTAR FORMULÁRIO
  // ============================================================
  function abrirFormulario(modoEdicao = false) {
    if (!cardFormulario) return;

    cardFormulario.style.display = "block";
    cardFormulario.classList.toggle("modo-edicao", modoEdicao);

    if (tituloFormulario) {
      tituloFormulario.textContent = modoEdicao ? "Editar Lançamento" : "Novo Lançamento";
    }
    if (descFormulario) {
      descFormulario.textContent = modoEdicao
        ? "Altere os dados e clique em Salvar."
        : "Preencha os dados do lançamento.";
    }

    // Scroll suave para o formulário
    cardFormulario.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function fecharFormulario() {
    if (!cardFormulario) return;
    cardFormulario.style.display = "none";
    clearForm();
  }

  function mostrarBotoesEdicao(item) {
    // Mostrar botões de edição
    if (btnNovo) btnNovo.style.display = "inline-block";
    if (btnDuplicar) btnDuplicar.style.display = "inline-block";
    if (btnExcluir) btnExcluir.style.display = "inline-block";

    // Mostrar "Marcar Pago" se status for Pendente
    if (btnMarcarPago) {
      btnMarcarPago.style.display = (item?.Status === "Pendente") ? "inline-block" : "none";
    }

    // Mostrar "Cancelar" se não estiver cancelado
    if (btnCancelarLanc) {
      btnCancelarLanc.style.display = (item?.Status !== "Cancelado") ? "inline-block" : "none";
    }
  }

  let itemAtualEdicao = null; // Guardar item sendo editado

  function fillForm(it) {
    if (!it) return;

    itemAtualEdicao = it; // Guardar referência

    Object.keys(el).forEach((k) => {
      if (!el[k]) return;

      // Mostrar nome do cliente/fornecedor em vez do ID
      if (k === "ID_Cliente") {
        el[k].value = it.NomeCliente || it[k] || "";
      } else if (k === "ID_Fornecedor") {
        el[k].value = it.NomeFornecedor || it[k] || "";
      } else if (k === "Data_Competencia" || k === "Data_Caixa" || k === "Mes_a_receber") {
        // Converter datas para formato ISO (YYYY-MM-DD) para inputs type="date"
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

    // ao carregar, tentar popular descrições
    aplicarDescricaoDaCategoria(false);
    atualizarVisibilidadeCampos();

    // Abrir formulário em modo edição
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

  function validateRequired(payload) {
    if (
      !payload.Data_Competencia ||
      !payload.Tipo ||
      !payload.Categoria ||
      !payload.Descricao ||
      !payload.Valor ||
      !payload.Status
    ) {
      setFeedback(feedbackSalvar, "Preencha: Data_Competencia, Tipo, Categoria, Descricao, Valor, Status.", "error");
      return false;
    }

    if (!validarCategoriaSelecionada(payload)) return false;
    return true;
  }

  function clearTable() {
    if (!tbody) return;
    tbody.innerHTML = "";
  }

  function atualizarResumoRapido(items) {
    const resumoEl = document.getElementById("resumoRapido");
    const entradasEl = document.getElementById("resumoEntradas");
    const saidasEl = document.getElementById("resumoSaidas");
    const saldoEl = document.getElementById("resumoSaldo");

    if (!resumoEl) return;

    let entradas = 0;
    let saidas = 0;

    items.forEach(it => {
      const valor = toNumberBR(it.Valor);
      if (it.Tipo === "Entrada" && it.Status !== "Cancelado") {
        entradas += valor;
      } else if (it.Tipo === "Saida" && it.Status !== "Cancelado") {
        saidas += valor;
      }
    });

    const saldo = entradas - saidas;

    if (entradasEl) entradasEl.textContent = formatMoneyBR(entradas);
    if (saidasEl) saidasEl.textContent = formatMoneyBR(saidas);
    if (saldoEl) {
      saldoEl.textContent = formatMoneyBR(saldo);
      saldoEl.style.color = saldo >= 0 ? "#228b22" : "#c41e3a";
    }

    resumoEl.style.display = items.length > 0 ? "grid" : "none";
  }

  function markSelectedRow(tr) {
    if (!tbody) return;
    [...tbody.querySelectorAll("tr")].forEach((x) => x.classList.remove("is-selected"));
    if (tr) tr.classList.add("is-selected");
  }

  function sortItems(items) {
    if (!sortCol) return items;

    const sorted = [...items].sort((a, b) => {
      let va = a[sortCol] ?? "";
      let vb = b[sortCol] ?? "";

      // Para Valor, converter para número
      if (sortCol === "Valor") {
        va = toNumberBR(va);
        vb = toNumberBR(vb);
      } else {
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
      }

      let cmp = 0;
      if (va < vb) cmp = -1;
      else if (va > vb) cmp = 1;

      return sortDir === "desc" ? -cmp : cmp;
    });

    return sorted;
  }

  function updateSortIcons() {
    if (!tabela) return;
    const ths = tabela.querySelectorAll("th.sortable");
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
    updateSortIcons();
    renderTable(dadosListaAtual);
  }

  function bindSortHeaders() {
    if (!tabela) return;
    const ths = tabela.querySelectorAll("th.sortable");
    ths.forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.col;
        if (col) handleSort(col);
      });
    });
    updateSortIcons();
  }

  function renderTable(items) {
    clearTable();
    if (!tbody) return;

    if (!Array.isArray(items) || items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="8">Nenhum lançamento encontrado.</td>`;
      tbody.appendChild(tr);
      return;
    }

    const sorted = sortItems(items);

    sorted.forEach((it) => {
      const tr = document.createElement("tr");
      tr.dataset.rowIndex = String(it.rowIndex ?? "");

      // Mostrar Cliente ou Fornecedor dependendo do Tipo
      let clienteFornecedor = "";
      if (it.Tipo === "Entrada") {
        clienteFornecedor = it.NomeCliente || it.ID_Cliente || "";
      } else if (it.Tipo === "Saida") {
        clienteFornecedor = it.NomeFornecedor || it.ID_Fornecedor || "";
      } else {
        // Transferência ou outro: mostrar o que tiver
        clienteFornecedor = it.NomeCliente || it.ID_Cliente || it.NomeFornecedor || it.ID_Fornecedor || "";
      }

      // Classes para cores
      const tipoClass = it.Tipo === "Entrada" ? "tipo-entrada" : it.Tipo === "Saida" ? "tipo-saida" : "";
      const statusClass = it.Status === "Pago" ? "status-pago" : it.Status === "Pendente" ? "status-pendente" : it.Status === "Cancelado" ? "status-cancelado" : "";
      const valorClass = it.Tipo === "Entrada" ? "valor-positivo" : it.Tipo === "Saida" ? "valor-negativo" : "";

      tr.innerHTML = `
        <td>${escapeHtml(formatDateBR(it.Data_Competencia) || "")}</td>
        <td class="${tipoClass}">${escapeHtml(it.Tipo || "")}</td>
        <td>${escapeHtml(it.Categoria || "")}</td>
        <td title="${escapeHtml(it.Descricao || "")}">${escapeHtml((it.Descricao || "").substring(0, 30))}${(it.Descricao || "").length > 30 ? "..." : ""}</td>
        <td>${escapeHtml(clienteFornecedor)}</td>
        <td>${escapeHtml(it.Forma_Pagamento || "")}</td>
        <td class="${valorClass}">${escapeHtml(formatMoneyBR(it.Valor))}</td>
        <td class="${statusClass}">${escapeHtml(it.Status || "")}</td>
      `;
      tbody.appendChild(tr);

      tr.addEventListener("click", () => {
        markSelectedRow(tr);
        fillForm(it);
      });
    });
  }

  async function listar(page = 1) {
    if (!requireScriptUrl()) return;

    setFeedback(feedbackLanc, "Carregando...", "info");
    try {
      const filtros = buildFiltros();

      const data = await jsonpRequest({
        action: "Lancamentos.Listar",
        sheet: SHEET_NAME,
        filtros: JSON.stringify(filtros),
        page: page,
        limit: ITENS_POR_PAGINA
      });

      if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao listar.");

      dadosListaAtual = data.items || [];
      renderTable(dadosListaAtual);
      atualizarResumoRapido(dadosListaAtual);

      // Atualizar paginação
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
    const btnPrev = document.getElementById("btnPrevPage");
    const btnNext = document.getElementById("btnNextPage");
    const paginaInfo = document.getElementById("paginaInfo");
    const totalInfo = document.getElementById("totalInfo");

    if (paginaInfo) {
      paginaInfo.textContent = `Página ${pagination.page} de ${pagination.totalPages}`;
    }

    if (totalInfo) {
      totalInfo.textContent = `Total: ${pagination.total}`;
    }

    if (btnPrev) {
      btnPrev.disabled = pagination.page <= 1;
    }

    if (btnNext) {
      btnNext.disabled = pagination.page >= pagination.totalPages;
    }
  }

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
      `Serão criadas ${n} parcelas (1/${n}...${n}/${n}).\n` +
      `Total: ${formatMoneyBR(total)}\n` +
      `Aprox/parcela: ${formatMoneyBR(each)}\n` +
      `Data base: ${base || "(vazia)"}\n\n` +
      `Continuar?`;

    return window.confirm(msg);
  }

  async function salvar() {
    if (!requireScriptUrl()) return;

    aplicarDescricaoDaCategoria(false);

    const payload = buildLancPayload();
    if (!validateRequired(payload)) return;

    if (!confirmParcelamentoSeNovo(payload)) {
      setFeedback(feedbackSalvar, "Operação cancelada.", "info");
      return;
    }

    setFeedback(feedbackSalvar, "Salvando...", "info");
    try {
      if (selectedRowIndex && Number(selectedRowIndex) >= 2) {
        const resp = await editar(selectedRowIndex, payload);
        setFeedback(feedbackSalvar, resp.message || "Atualizado.", "success");
        await listar(paginaAtual); // mantém na página atual ao editar
        fecharFormulario(); // fecha o formulário após salvar
      } else {
        const resp = await criar(payload);
        setFeedback(feedbackSalvar, resp.message || "Salvo.", "success");
        await listar(1); // vai para primeira página ao criar
        fecharFormulario(); // fecha o formulário após salvar
      }
    } catch (err) {
      setFeedback(feedbackSalvar, err.message || "Erro ao salvar.", "error");
    }
  }

  function limparFiltro() {
    if (formFiltro) formFiltro.reset();
    setFeedback(feedbackLanc, "", "info");
    paginaAtual = 1;
    listar(1);
  }

  // ============================================================
  // EXCLUIR com Modal de Confirmação
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

    fecharModalExcluir();
    setFeedback(feedbackSalvar, "Excluindo...", "info");

    try {
      const data = await jsonpRequest({
        action: "Lancamentos.Excluir",
        rowIndex: selectedRowIndex
      });

      if (!data || data.ok !== true) {
        throw new Error(data?.message || "Erro ao excluir.");
      }

      setFeedback(feedbackLanc, "Lançamento excluído.", "success");
      fecharFormulario();
      await listar(paginaAtual);

    } catch (err) {
      setFeedback(feedbackSalvar, err.message || "Erro ao excluir.", "error");
    }
  }

  // ============================================================
  // AÇÕES RÁPIDAS
  // ============================================================
  function duplicarLancamento() {
    if (!itemAtualEdicao) return;

    // Limpar rowIndex para criar novo
    selectedRowIndex = null;

    // Manter dados mas mudar título
    if (tituloFormulario) tituloFormulario.textContent = "Duplicar Lançamento";
    if (descFormulario) descFormulario.textContent = "Cópia criada. Altere os dados e salve.";

    // Limpar data de caixa se quiser nova data
    if (el.Data_Competencia) el.Data_Competencia.value = hojeISO();
    if (el.Data_Caixa) el.Data_Caixa.value = "";

    // Esconder botões de edição, mostrar como novo
    if (btnNovo) btnNovo.style.display = "none";
    if (btnDuplicar) btnDuplicar.style.display = "none";
    if (btnExcluir) btnExcluir.style.display = "none";
    if (btnMarcarPago) btnMarcarPago.style.display = "none";
    if (btnCancelarLanc) btnCancelarLanc.style.display = "none";

    setFeedback(feedbackSalvar, "Lançamento duplicado. Clique em Salvar para criar.", "info");
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

    if (!confirm("Deseja marcar este lançamento como Cancelado?")) return;

    el.Status.value = "Cancelado";

    setFeedback(feedbackSalvar, "Cancelando lançamento...", "info");
    await salvar();
  }

  function initDefaults() {
    if (el.Data_Competencia && !el.Data_Competencia.value) el.Data_Competencia.value = hojeISO();

    if (el.Status && el.Data_Caixa) {
      el.Status.addEventListener("change", () => {
        if (String(el.Status.value || "").trim() === "Pago" && !el.Data_Caixa.value) {
          el.Data_Caixa.value = hojeISO();
        }
      });
    }
  }

  function bind() {
    if (btnFiltrar) btnFiltrar.addEventListener("click", (e) => (e.preventDefault(), listar(1)));
    if (btnLimparFiltro) btnLimparFiltro.addEventListener("click", (e) => (e.preventDefault(), limparFiltro()));
    if (formFiltro) formFiltro.addEventListener("submit", (e) => (e.preventDefault(), listar(1)));
    if (formLanc) formLanc.addEventListener("submit", (e) => (e.preventDefault(), salvar()));

    // Botão Novo Lançamento (abre formulário vazio)
    if (btnAbrirNovoLanc) btnAbrirNovoLanc.addEventListener("click", (e) => {
      e.preventDefault();
      clearForm();
      abrirFormulario(false);
    });

    // Fechar formulário
    if (btnFecharForm) btnFecharForm.addEventListener("click", (e) => {
      e.preventDefault();
      fecharFormulario();
    });

    // Limpar / Novo (quando em edição)
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

    // Cancelar Lançamento
    if (btnCancelarLanc) btnCancelarLanc.addEventListener("click", (e) => {
      e.preventDefault();
      cancelarLancamento();
    });

    // Excluir
    if (btnExcluir) btnExcluir.addEventListener("click", (e) => (e.preventDefault(), abrirModalExcluir()));
    if (btnCancelarExcluir) btnCancelarExcluir.addEventListener("click", (e) => (e.preventDefault(), fecharModalExcluir()));
    if (btnConfirmarExcluir) btnConfirmarExcluir.addEventListener("click", (e) => (e.preventDefault(), confirmarExcluir()));

    // Fechar modal clicando fora
    if (modalExcluir) {
      modalExcluir.addEventListener("click", (e) => {
        if (e.target === modalExcluir) fecharModalExcluir();
      });
    }

    // Paginação
    const btnPrevPage = document.getElementById("btnPrevPage");
    const btnNextPage = document.getElementById("btnNextPage");

    if (btnPrevPage) {
      btnPrevPage.addEventListener("click", (e) => {
        e.preventDefault();
        if (paginaAtual > 1) {
          listar(paginaAtual - 1);
        }
      });
    }

    if (btnNextPage) {
      btnNextPage.addEventListener("click", (e) => {
        e.preventDefault();
        if (paginaAtual < totalPaginas) {
          listar(paginaAtual + 1);
        }
      });
    }

    // Exportação
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

  // init
  initDefaults();
  bind();
  bindAutocompleteClientes();
  bindAutocompleteFornecedores();
  bindCategoriaPadrao();
  bindSortHeaders();
  atualizarVisibilidadeCampos();

  // carrega categorias pro tipo atual (se vazio, carrega geral ao focar)
  carregarCategoriasAtivas(getTipoAtual()).catch(() => {});
  // carrega categorias para o filtro
  carregarTodasCategorias().catch(() => {});
  listar(1);
})();
