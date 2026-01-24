// lancamentos.js (JSONP - sem CORS)
// Requer: config.js (window.APP_CONFIG.SCRIPT_URL)
// Backend: Code.gs (router) + Lacamentos.gs (Lancamentos_dispatch_)

(() => {
  "use strict";

  // ✅ Agora vem do config.js
  const SCRIPT_URL = window.APP_CONFIG?.SCRIPT_URL || "";

  // ✅ Deve bater com o nome da aba real
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

  // Campos do formulário de lançamento
  const el = {
    Data_Competencia: document.getElementById("Data_Competencia"),
    Data_Caixa: document.getElementById("Data_Caixa"),
    Tipo: document.getElementById("Tipo"),
    Origem: document.getElementById("Origem"),
    Categoria: document.getElementById("Categoria"),
    Descricao: document.getElementById("Descricao"),
    Cliente_Fornecedor: document.getElementById("Cliente_Fornecedor"),
    Forma_Pagamento: document.getElementById("Forma_Pagamento"),
    Instituicao_Financeira: document.getElementById("Instituicao_Financeira"),
    Titularidade: document.getElementById("Titularidade"),
    Parcelamento: document.getElementById("Parcelamento"),
    Valor: document.getElementById("Valor"),
    Status: document.getElementById("Status"),
    Observacoes: document.getElementById("Observacoes"),
    Mes_a_receber: document.getElementById("Mes_a_receber"),
  };

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
      setFeedback(feedbackLanc, "SCRIPT_URL inválida. Ajuste no config.js (precisa terminar em /exec).", "error");
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

  // ---------- Tabela ----------
  function clearTable() {
    if (!tbody) return;
    tbody.innerHTML = "";
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

      tr.addEventListener("click", () => fillForm(it));
    });
  }

  function fillForm(it) {
    if (!it) return;

    Object.keys(el).forEach((k) => {
      if (!el[k]) return;
      el[k].value = it[k] ?? "";
    });

    setFeedback(feedbackSalvar, "Lançamento carregado (salvar cria uma NOVA linha).", "info");
  }

  // ---------- Payload ----------
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

  // ✅ nomes que o Lacamentos.gs lê:
  // filtros.fDataIni, filtros.fDataFim, filtros.fTipo, filtros.fStatus, filtros.q
  function buildFiltros() {
    return {
      fDataIni: (fDataIni?.value || "").trim(),
      fDataFim: (fDataFim?.value || "").trim(),
      fTipo: (fTipo?.value || "").trim(),
      fStatus: (fStatus?.value || "").trim(),
      q: (fQ?.value || "").trim(),
    };
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

  async function salvar() {
    if (!requireScriptUrl()) return;

    const payload = buildLancPayload();

    if (!payload.Data_Competencia || !payload.Tipo || !payload.Descricao || !payload.Valor || !payload.Status) {
      setFeedback(feedbackSalvar, "Preencha: Data_Competencia, Tipo, Descricao, Valor, Status.", "error");
      return;
    }

    setFeedback(feedbackSalvar, "Salvando...", "info");
    try {
      const data = await jsonpRequest({
        action: "Lancamentos.Criar",
        sheet: SHEET_NAME,
        payload: JSON.stringify(payload),
      });

      if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao salvar.");

      setFeedback(feedbackSalvar, data.message || "Lançamento salvo.", "success");

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
  }

  function bind() {
    if (btnFiltrar) btnFiltrar.addEventListener("click", (e) => (e.preventDefault(), listar()));
    if (btnLimparFiltro) btnLimparFiltro.addEventListener("click", (e) => (e.preventDefault(), limparFiltro()));
    if (formFiltro) formFiltro.addEventListener("submit", (e) => (e.preventDefault(), listar()));
    if (formLanc) formLanc.addEventListener("submit", (e) => (e.preventDefault(), salvar()));
  }

  initDefaults();
  bind();
  listar();
})();
