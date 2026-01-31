// resumo.js (JSONP - sem CORS) — OPÇÃO A (cálculo em tempo real) + DRILL-DOWN + TOPs
// Requer: config.js (window.APP_CONFIG.SCRIPT_URL)

(() => {
  "use strict";

  const SCRIPT_URL = window.APP_CONFIG?.SCRIPT_URL || "";

  // Ações / filtro
  const btnAtualizarLista = document.getElementById("btnAtualizarLista");
  const btnFiltrarMes = document.getElementById("btnFiltrarMes");
  const btnLimparMes = document.getElementById("btnLimparMes");
  const mesInput = document.getElementById("mes");

  // Feedback
  const feedback = document.getElementById("feedbackResumo");

  // Tabela resumo
  const tabelaResumo = document.getElementById("tabelaResumo");
  const tbodyResumo = tabelaResumo ? tabelaResumo.querySelector("tbody") : null;

  // Detalhes
  const cardDetalhes = document.getElementById("cardDetalhes");
  const mesSelecionado = document.getElementById("mesSelecionado");
  const tabelaDetalhes = document.getElementById("tabelaDetalhes");
  const tbodyDetalhes = tabelaDetalhes ? tabelaDetalhes.querySelector("tbody") : null;
  const btnFecharDetalhes = document.getElementById("btnFecharDetalhes");

  // Resumo do mês (detalhes)
  const detEntradasPagas = document.getElementById("detEntradasPagas");
  const detEntradasPend = document.getElementById("detEntradasPend");
  const detSaidas = document.getElementById("detSaidas");
  const detResultado = document.getElementById("detResultado");

  // Formas de pagamento (entradas pagas)
  const detPix = document.getElementById("detPix");
  const detCredito = document.getElementById("detCredito");
  const detDebito = document.getElementById("detDebito");
  const detOutros = document.getElementById("detOutros");

  // Top categoria / instituição (entradas pagas)
  const detTopCategorias = document.getElementById("detTopCategorias");
  const detTopInstituicoes = document.getElementById("detTopInstituicoes");

  function setFeedback(msg, type = "info") {
    if (!feedback) return;
    feedback.textContent = msg || "";
    feedback.dataset.type = type;
  }

  function requireScriptUrl() {
    if (!SCRIPT_URL || !SCRIPT_URL.includes("/exec")) {
      setFeedback("SCRIPT_URL inválida. Ajuste no config.js (precisa terminar em /exec).", "error");
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

  function toNumber(v) {
    const s = String(v ?? "").trim();
    if (!s) return 0;
    const num = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(",", "."));
    return Number.isNaN(num) ? 0 : num;
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

  // =========================
  // RESUMO (tempo real)
  // =========================
  async function carregarResumo(mesYYYYMM) {
    if (!requireScriptUrl()) return;

    setFeedback("Carregando...", "info");
    const params = { action: "ResumoMensal.Calcular" };
    if (mesYYYYMM) params.mes = mesYYYYMM;

    const data = await jsonpRequest(params);
    if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao calcular resumo.");

    renderResumo(data.items || []);
    setFeedback(`OK • ${(data.items || []).length} mês(es)`, "success");
  }

  function renderResumo(items) {
    if (!tbodyResumo) return;
    tbodyResumo.innerHTML = "";

    if (!Array.isArray(items) || items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="11">Sem dados.</td>`;
      tbodyResumo.appendChild(tr);
      return;
    }

    items.forEach((it) => {
      const mes = it["Mês"] || "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <button type="button" class="btn btn--secondary btn-mes" data-mes="${escapeHtml(mes)}">
            ${escapeHtml(mes)}
          </button>
        </td>
        <td>${escapeHtml(formatMoneyBR(it["Entradas Pagas"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entradas Pendentes"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Total Entradas"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Saidas"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Resultado (Caixa)"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Resultado (Caixa Real)"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada. SumUp PJ"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada Nubank PJ"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada Nubank PF"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada PicPay PF"]))}</td>
      `;
      tbodyResumo.appendChild(tr);

      const btn = tr.querySelector(".btn-mes");
      if (btn) {
        btn.addEventListener("click", () => {
          carregarDetalhesMes(mes).catch((err) =>
            setFeedback(err.message || "Erro ao detalhar mês.", "error")
          );
        });
      }
    });
  }

  // =========================
  // DETALHES (drill-down)
  // =========================
  async function carregarDetalhesMes(mesYYYYMM) {
    if (!requireScriptUrl()) return;

    setFeedback("Carregando detalhes...", "info");
    const data = await jsonpRequest({
      action: "ResumoMensal.DetalharMes",
      mes: mesYYYYMM,
    });

    if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao carregar detalhes.");

    renderDetalhes(mesYYYYMM, data.items || []);
    setFeedback(`Detalhes: ${(data.items || []).length} lançamento(s)`, "success");
  }

  function renderDetalhes(mesYYYYMM, items) {
    if (!tbodyDetalhes) return;

    const sorted = sortByDataCaixaDesc(items || []);

    if (mesSelecionado) mesSelecionado.textContent = mesYYYYMM;
    if (cardDetalhes) cardDetalhes.style.display = "block";

    const resumo = calcularResumoMes(sorted);

    if (detEntradasPagas) detEntradasPagas.textContent = formatMoneyBR(resumo.entradasPagas);
    if (detEntradasPend) detEntradasPend.textContent = formatMoneyBR(resumo.entradasPendentes);
    if (detSaidas) detSaidas.textContent = formatMoneyBR(resumo.saidas);
    if (detResultado) detResultado.textContent = formatMoneyBR(resumo.resultado);

    if (detPix) detPix.textContent = formatMoneyBR(resumo.pagPix);
    if (detCredito) detCredito.textContent = formatMoneyBR(resumo.pagCredito);
    if (detDebito) detDebito.textContent = formatMoneyBR(resumo.pagDebito);
    if (detOutros) detOutros.textContent = formatMoneyBR(resumo.pagOutros);

    renderTopMap(detTopCategorias, resumo.porCategoria, 5);
    renderTopMap(detTopInstituicoes, resumo.porInstituicao, 5);

    tbodyDetalhes.innerHTML = "";

    if (!Array.isArray(sorted) || sorted.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="8">Nenhum lançamento neste mês.</td>`;
      tbodyDetalhes.appendChild(tr);
      cardDetalhes.scrollIntoView({ behavior: "smooth" });
      return;
    }

    sorted.forEach((it) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(it.Data_Caixa || "")}</td>
        <td>${escapeHtml(it.Tipo || "")}</td>
        <td>${escapeHtml(it.Categoria || "")}</td>
        <td>${escapeHtml(it.Descricao || "")}</td>
        <td>${escapeHtml(it.Cliente_Fornecedor || "")}</td>
        <td>${escapeHtml(it.Forma_Pagamento || "")}</td>
        <td>${escapeHtml(formatMoneyBR(it.Valor))}</td>
        <td>${escapeHtml(it.Status || "")}</td>
      `;
      tbodyDetalhes.appendChild(tr);
    });

    cardDetalhes.scrollIntoView({ behavior: "smooth" });
  }

  function renderTopMap(node, mapObj, limit) {
    if (!node) return;

    const entries = Object.entries(mapObj || {})
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, limit);

    if (entries.length === 0) {
      node.textContent = "—";
      return;
    }

    node.innerHTML = entries
      .map(([k, v]) => `${escapeHtml(k)}: <strong>${escapeHtml(formatMoneyBR(v))}</strong>`)
      .join(" • ");
  }

  // =========================
  // CÁLCULOS
  // =========================
  function sortByDataCaixaDesc(items) {
    const arr = Array.isArray(items) ? [...items] : [];
    arr.sort((a, b) => {
      const da = parseDateToTime(a?.Data_Caixa);
      const db = parseDateToTime(b?.Data_Caixa);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return db - da;
    });
    return arr;
  }

  function parseDateToTime(v) {
    const s = String(v ?? "").trim();
    if (!s) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d).getTime();
    }

    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const d = Number(m[1]);
      const mo = Number(m[2]);
      const y = Number(m[3]);
      return new Date(y, mo - 1, d).getTime();
    }

    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }

  function calcularResumoMes(items) {
    let entradasPagas = 0;
    let entradasPendentes = 0;
    let saidas = 0;

    let pagPix = 0;
    let pagCredito = 0;
    let pagDebito = 0;
    let pagOutros = 0;

    const porCategoria = {};
    const porInstituicao = {};

    (items || []).forEach((it) => {
      const tipo = String(it.Tipo || "").trim();
      const status = String(it.Status || "").trim();
      const valor = toNumber(it.Valor);

      const fp = String(it.Forma_Pagamento || "").toLowerCase().trim();
      const cat = String(it.Categoria || "").trim() || "Sem categoria";
      const inst = String(it.Instituicao_Financeira || "").trim() || "Sem instituição";

      if (tipo === "Receita") {
        if (status === "Pago") {
          entradasPagas += valor;

          if (fp.includes("pix")) pagPix += valor;
          else if (fp.includes("cr") || fp.includes("cred") || fp.includes("crédito") || fp.includes("credito")) pagCredito += valor;
          else if (fp.includes("deb") || fp.includes("déb") || fp.includes("débito") || fp.includes("debito")) pagDebito += valor;
          else pagOutros += valor;

          porCategoria[cat] = (porCategoria[cat] || 0) + valor;
          porInstituicao[inst] = (porInstituicao[inst] || 0) + valor;

        } else if (status === "Pendente") {
          entradasPendentes += valor;
        }
      } else if (tipo === "Despesa") {
        saidas += valor;
      }
    });

    const resultado = entradasPagas - saidas;

    return {
      entradasPagas,
      entradasPendentes,
      saidas,
      resultado,
      pagPix,
      pagCredito,
      pagDebito,
      pagOutros,
      porCategoria,
      porInstituicao,
    };
  }

  function fecharDetalhes() {
    if (cardDetalhes) cardDetalhes.style.display = "none";
    if (tbodyDetalhes) tbodyDetalhes.innerHTML = "";
    if (mesSelecionado) mesSelecionado.textContent = "";

    if (detEntradasPagas) detEntradasPagas.textContent = "—";
    if (detEntradasPend) detEntradasPend.textContent = "—";
    if (detSaidas) detSaidas.textContent = "—";
    if (detResultado) detResultado.textContent = "—";

    if (detPix) detPix.textContent = "—";
    if (detCredito) detCredito.textContent = "—";
    if (detDebito) detDebito.textContent = "—";
    if (detOutros) detOutros.textContent = "—";

    if (detTopCategorias) detTopCategorias.textContent = "—";
    if (detTopInstituicoes) detTopInstituicoes.textContent = "—";
  }

  // =========================
  // BIND
  // =========================
  function bind() {
    if (btnAtualizarLista) {
      btnAtualizarLista.addEventListener("click", (e) => {
        e.preventDefault();
        fecharDetalhes();
        carregarResumo().catch((err) => setFeedback(err.message || "Erro.", "error"));
      });
    }

    if (btnFiltrarMes) {
      btnFiltrarMes.addEventListener("click", (e) => {
        e.preventDefault();
        fecharDetalhes();
        const v = (mesInput?.value || "").trim();
        if (!v) return setFeedback("Escolha um mês ou clique em Limpar.", "error");
        carregarResumo(v).catch((err) => setFeedback(err.message || "Erro.", "error"));
      });
    }

    if (btnLimparMes) {
      btnLimparMes.addEventListener("click", (e) => {
        e.preventDefault();
        if (mesInput) mesInput.value = "";
        fecharDetalhes();
        carregarResumo().catch((err) => setFeedback(err.message || "Erro.", "error"));
      });
    }

    if (btnFecharDetalhes) {
      btnFecharDetalhes.addEventListener("click", (e) => {
        e.preventDefault();
        fecharDetalhes();
      });
    }
  }

  bind();
  carregarResumo().catch((err) => setFeedback(err.message || "Erro ao carregar.", "error"));
})();
