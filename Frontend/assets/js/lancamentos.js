// lancamentos.js (JSONP - sem CORS)
// Requer: assets/js/config.js (window.APP_CONFIG.SCRIPT_URL)
// Backend: Api.gs (Registry) + Clientes.gs + Lancamentos.gs
// ✅ Suporta: Criar (com parcelas), Listar (rowIndex), Editar (rowIndex), Autocomplete de clientes (Clientes.Buscar)

(() => {
  "use strict";

  const SCRIPT_URL = window.APP_CONFIG?.SCRIPT_URL || "";
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
  const fQ = document.getElementById("fQ");

  const tabela = document.getElementById("tabelaLancamentos");
  const tbody = tabela ? tabela.querySelector("tbody") : null;

  const formLanc = document.getElementById("formLancamento");
  const feedbackSalvar = document.getElementById("feedbackSalvar");

  const btnNovo = document.getElementById("btnNovoLancamento");

  // Clientes (datalist)
  const inputCliente = document.getElementById("Cliente_Fornecedor");
  const datalistClientes = document.getElementById("listaClientes");

  // Campos do formulário de lançamento
  const el = {
    Data_Competencia: document.getElementById("Data_Competencia"),
    Data_Caixa: document.getElementById("Data_Caixa"),
    Tipo: document.getElementById("Tipo"),
    Origem: document.getElementById("Origem"),
    Categoria: document.getElementById("Categoria"),
    Descricao: document.getElementById("Descricao"),
    Cliente_Fornecedor: inputCliente,
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
    if (!SCRIPT_URL || !SCRIPT_URL.includes("/exec")) {
      setFeedback(feedbackLanc, "SCRIPT_URL inválida. Ajuste no assets/js/config.js (precisa terminar em /exec).", "error");
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

  function parseParcelCount(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return 0;
    if (/^\d+\s*\/\s*\d+$/.test(s)) return 0;
    if (/^\d+$/.test(s)) return Number(s) || 0;
    const m = s.match(/^(\d+)\s*x$/i);
    if (m) return Number(m[1]) || 0;
    return 0;
  }

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

  // ---------- Clientes (Autocomplete) ----------
  let clientesDebounce = null;

  function isTipoEntrada() {
    return String(el.Tipo?.value || "").trim() === "Entrada";
  }

  function clearDatalist() {
    if (!datalistClientes) return;
    datalistClientes.innerHTML = "";
  }

  function renderClientesDatalist(items) {
    if (!datalistClientes) return;
    clearDatalist();

    const nomes = new Set();
    (items || []).forEach((it) => {
      const nome = String(it?.NomeCliente || "").trim();
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
    const query = String(q || "").trim();
    if (!query) {
      clearDatalist();
      return;
    }

    const data = await jsonpRequest({
      action: "Clientes.Buscar",
      q: query
    });

    if (!data || data.ok !== true) return;
    renderClientesDatalist(data.items || []);
  }

  function bindAutocompleteClientes() {
    if (!inputCliente) return;

    // Só faz sentido quando Tipo = Entrada
    const schedule = (q) => {
      if (!isTipoEntrada()) return;

      clearTimeout(clientesDebounce);
      clientesDebounce = setTimeout(() => {
        buscarClientes(q).catch(() => {});
      }, 250);
    };

    inputCliente.addEventListener("focus", () => {
      if (!isTipoEntrada()) return;
      schedule(inputCliente.value || "");
    });

    inputCliente.addEventListener("input", () => {
      if (!isTipoEntrada()) return;
      schedule(inputCliente.value || "");
    });

    if (el.Tipo) {
      el.Tipo.addEventListener("change", () => {
        // Se não for Entrada, limpa sugestões
        if (!isTipoEntrada()) clearDatalist();
      });
    }
  }

  // ---------- Form ----------
  function clearForm() {
    Object.keys(el).forEach((k) => {
      if (!el[k]) return;
      el[k].value = "";
    });
    selectedRowIndex = null;

    if (el.Data_Competencia) el.Data_Competencia.value = hojeISO();

    setFeedback(feedbackSalvar, "Novo lançamento", "info");
    setTimeout(() => setFeedback(feedbackSalvar, "", "info"), 2000);

    clearDatalist();
  }

  function fillForm(it) {
    if (!it) return;

    Object.keys(el).forEach((k) => {
      if (!el[k]) return;
      el[k].value = it[k] ?? "";
    });

    const ri = Number(it.rowIndex || 0);
    selectedRowIndex = ri > 0 ? ri : null;

    if (selectedRowIndex) {
      setFeedback(feedbackSalvar, `Modo: EDITAR (rowIndex ${selectedRowIndex}). Salvar atualiza a linha.`, "info");
    } else {
      setFeedback(feedbackSalvar, "Este item não possui rowIndex. Atualize o backend para retornar rowIndex no Listar.", "error");
    }

    // Ajuste: se não for Entrada, não precisa sugestões
    if (!isTipoEntrada()) clearDatalist();
  }

  function buildLancPayload() {
    return {
      Data_Competencia: (el.Data_Competencia?.value || "").trim(),
      Data_Caixa: (el.Data_Caixa?.value || "").trim(),
      Tipo: (el.Tipo?.value || "").trim(),
      Origem: (el.Origem?.value || "").trim(),
      Categoria: (el.Categoria?.value || "").trim(),
      Descricao: (el.Descricao?.value || "").trim(),
      Cliente_Fornecedor: (el.Cliente_Fornecedor?.value || "").trim(),
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
      q: (fQ?.value || "").trim(),
    };
  }

  function validateRequired(payload) {
    if (!payload.Data_Competencia || !payload.Tipo || !payload.Descricao || !payload.Valor || !payload.Status) {
      setFeedback(feedbackSalvar, "Preencha: Data_Competencia, Tipo, Descricao, Valor, Status.", "error");
      return false;
    }
    return true;
  }

  // ---------- Tabela ----------
  function clearTable() {
    if (!tbody) return;
    tbody.innerHTML = "";
  }

  function markSelectedRow(tr) {
    if (!tbody) return;
    [...tbody.querySelectorAll("tr")].forEach((x) => x.classList.remove("is-selected"));
    if (tr) tr.classList.add("is-selected");
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

    items.forEach((it) => {
      const tr = document.createElement("tr");
      tr.dataset.rowIndex = String(it.rowIndex ?? "");
      tr.innerHTML = `
        <td>${escapeHtml(it.Data_Competencia || "")}</td>
        <td>${escapeHtml(it.Tipo || "")}</td>
        <td>${escapeHtml(it.Categoria || "")}</td>
        <td>${escapeHtml(it.Descricao || "")}</td>
        <td>${escapeHtml(it.Cliente_Fornecedor || "")}</td>
        <td>${escapeHtml(it.Forma_Pagamento || "")}</td>
        <td>${escapeHtml(formatMoneyBR(it.Valor))}</td>
        <td>${escapeHtml(it.Status || "")}</td>
      `;
      tbody.appendChild(tr);

      tr.addEventListener("click", () => {
        markSelectedRow(tr);
        fillForm(it);
      });
    });
  }

  // ---------- Ações ----------
  async function listar() {
    if (!requireScriptUrl()) return;

    setFeedback(feedbackLanc, "Carregando...", "info");
    try {
      const filtros = buildFiltros();

      const data = await jsonpRequest({
        action: "Lancamentos.Listar",
        sheet: SHEET_NAME,
        filtros: JSON.stringify(filtros),
      });

      if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao listar.");

      renderTable(data.items || []);
      setFeedback(feedbackLanc, `OK • ${(data.items || []).length} itens`, "success");
    } catch (err) {
      setFeedback(feedbackLanc, err.message || "Erro ao listar.", "error");
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
    const each = n ? (total / n) : 0;

    const base = payload.Data_Caixa || payload.Data_Competencia;
    const msg =
      `Você informou Parcelamento = ${n}.\n\n` +
      `O sistema vai criar ${n} parcelas (1/${n} ... ${n}/${n}).\n` +
      `Valor total: ${formatMoneyBR(total)}\n` +
      `Aproximadamente por parcela: ${formatMoneyBR(each)}\n` +
      `Data base: ${base || "(vazia)"}\n\n` +
      `Deseja continuar?`;

    return window.confirm(msg);
  }

  async function salvar() {
    if (!requireScriptUrl()) return;

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
        setFeedback(feedbackSalvar, resp.message || "Lançamento atualizado.", "success");
      } else {
        const resp = await criar(payload);
        if (resp && typeof resp.parcelas === "number" && resp.parcelas >= 2) {
          setFeedback(feedbackSalvar, resp.message || `Parcelamento criado: ${resp.parcelas} parcelas.`, "success");
        } else {
          setFeedback(feedbackSalvar, resp.message || "Lançamento salvo.", "success");
        }
      }

      await listar();
    } catch (err) {
      setFeedback(feedbackSalvar, err.message || "Erro ao salvar.", "error");
    }
  }

  function limparFiltro() {
    if (formFiltro) formFiltro.reset();
    setFeedback(feedbackLanc, "", "info");
    listar();
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
    if (btnFiltrar) btnFiltrar.addEventListener("click", (e) => (e.preventDefault(), listar()));
    if (btnLimparFiltro) btnLimparFiltro.addEventListener("click", (e) => (e.preventDefault(), limparFiltro()));
    if (formFiltro) formFiltro.addEventListener("submit", (e) => (e.preventDefault(), listar()));
    if (formLanc) formLanc.addEventListener("submit", (e) => (e.preventDefault(), salvar()));
    if (btnNovo) btnNovo.addEventListener("click", (e) => (e.preventDefault(), clearForm()));
  }

  initDefaults();
  bind();
  bindAutocompleteClientes();
  listar();
})();
