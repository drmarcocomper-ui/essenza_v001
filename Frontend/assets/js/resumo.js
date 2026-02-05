// resumo.js (JSONP - sem CORS) — Resumo mensal + Drill-down
// Requer: config.js, auth.js, api.js

(() => {
  "use strict";

  const jsonpRequest = window.EssenzaApi?.request || (() => Promise.reject(new Error("EssenzaApi não carregado")));

  const btnAtualizarLista = document.getElementById("btnAtualizarLista");
  const btnFiltrarMes = document.getElementById("btnFiltrarMes");
  const btnLimparMes = document.getElementById("btnLimparMes");
  const mesInput = document.getElementById("mes");
  const feedback = document.getElementById("feedbackResumo");

  const tabelaResumo = document.getElementById("tabelaResumo");
  const tbodyResumo = tabelaResumo ? tabelaResumo.querySelector("tbody") : null;

  const cardDetalhes = document.getElementById("cardDetalhes");
  const mesSelecionado = document.getElementById("mesSelecionado");
  const tabelaDetalhes = document.getElementById("tabelaDetalhes");
  const tbodyDetalhes = tabelaDetalhes ? tabelaDetalhes.querySelector("tbody") : null;
  const btnFecharDetalhes = document.getElementById("btnFecharDetalhes");

  const detEntradasPagas = document.getElementById("detEntradasPagas");
  const detEntradasPend = document.getElementById("detEntradasPend");
  const detSaidas = document.getElementById("detSaidas");
  const detResultado = document.getElementById("detResultado");

  const detPix = document.getElementById("detPix");
  const detDinheiro = document.getElementById("detDinheiro");
  const detCredito = document.getElementById("detCredito");
  const detDebito = document.getElementById("detDebito");
  const detOutros = document.getElementById("detOutros");

  // Estado para exportação
  let dadosResumoAtual = [];

  function setFeedback(msg, type = "info") {
    if (!feedback) return;
    feedback.textContent = msg || "";
    feedback.dataset.type = type;
  }

  function requireScriptUrl() {
    const url = window.EssenzaApi?.getScriptUrl?.() || "";
    if (!url || !url.includes("/exec")) {
      setFeedback("SCRIPT_URL inválida. Ajuste em config.js.", "error");
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


  async function carregarResumo(mesYYYYMM) {
    if (!requireScriptUrl()) return;

    setFeedback("Carregando...", "info");
    const params = { action: "ResumoMensal.Calcular" };
    if (mesYYYYMM) params.mes = mesYYYYMM;

    const data = await jsonpRequest(params);
    if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao calcular resumo.");

    dadosResumoAtual = data.items || [];
    renderResumo(dadosResumoAtual);
    setFeedback(`OK • ${dadosResumoAtual.length} mês(es)`, "success");
  }

  function renderResumo(items) {
    if (!tbodyResumo) return;
    tbodyResumo.innerHTML = "";

    if (!Array.isArray(items) || items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="20">Sem dados.</td>`;
      tbodyResumo.appendChild(tr);
      return;
    }

    items.forEach((it) => {
      const mes = it["Mês"] || "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><button type="button" class="btn btn--secondary btn-mes" data-mes="${escapeHtml(mes)}">${escapeHtml(mes)}</button></td>

        <td>${escapeHtml(formatMoneyBR(it["Entradas Pagas"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entradas Pendentes"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Total Entradas"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Saidas"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Resultado (Caixa)"]))}</td>

        <td>${escapeHtml(formatMoneyBR(it["Entrada Pix"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada Dinheiro"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada Cartao_Debito"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada Cartao_Credito"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada Boleto"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada Transferencia"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada Confianca"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada Cortesia"]))}</td>

        <td>${escapeHtml(formatMoneyBR(it["Entrada Nubank"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada PicPay"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada SumUp"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada Terceiro"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada Dinheiro Inst"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada Cortesia Inst"]))}</td>
      `;
      tbodyResumo.appendChild(tr);

      const btn = tr.querySelector(".btn-mes");
      if (btn) {
        btn.addEventListener("click", () => {
          carregarDetalhesMes(mes).catch((err) => setFeedback(err.message || "Erro ao detalhar mês.", "error"));
        });
      }
    });
  }

  async function carregarDetalhesMes(mesYYYYMM) {
    if (!requireScriptUrl()) return;

    setFeedback("Carregando detalhes...", "info");
    const data = await jsonpRequest({ action: "ResumoMensal.DetalharMes", mes: mesYYYYMM });
    if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao carregar detalhes.");

    renderDetalhes(mesYYYYMM, data.items || []);
    setFeedback(`Detalhes: ${(data.items || []).length} lançamento(s)`, "success");
  }

  function renderDetalhes(mesYYYYMM, items) {
    if (!tbodyDetalhes) return;

    const sorted = sortByDataDesc(items || []);

    if (mesSelecionado) mesSelecionado.textContent = mesYYYYMM;
    if (cardDetalhes) cardDetalhes.style.display = "block";

    const resumo = calcularResumoMes(sorted);

    if (detEntradasPagas) detEntradasPagas.textContent = formatMoneyBR(resumo.entradasPagas);
    if (detEntradasPend) detEntradasPend.textContent = formatMoneyBR(resumo.entradasPendentes);
    if (detSaidas) detSaidas.textContent = formatMoneyBR(resumo.saidas);
    if (detResultado) detResultado.textContent = formatMoneyBR(resumo.resultado);

    if (detPix) detPix.textContent = formatMoneyBR(resumo.pagPix);
    if (detDinheiro) detDinheiro.textContent = formatMoneyBR(resumo.pagDinheiro);
    if (detCredito) detCredito.textContent = formatMoneyBR(resumo.pagCredito);
    if (detDebito) detDebito.textContent = formatMoneyBR(resumo.pagDebito);
    if (detOutros) detOutros.textContent = formatMoneyBR(resumo.pagOutros);

    tbodyDetalhes.innerHTML = "";

    if (!Array.isArray(sorted) || sorted.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="9">Nenhum lançamento neste mês.</td>`;
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
        <td>${escapeHtml(it.Instituicao_Financeira || "")}</td>
        <td>${escapeHtml(formatMoneyBR(it.Valor))}</td>
        <td>${escapeHtml(it.Status || "")}</td>
      `;
      tbodyDetalhes.appendChild(tr);
    });

    cardDetalhes.scrollIntoView({ behavior: "smooth" });
  }

  function sortByDataDesc(items) {
    const arr = Array.isArray(items) ? [...items] : [];
    arr.sort((a, b) => (parseDateToTime(b?.Data_Caixa) ?? 0) - (parseDateToTime(a?.Data_Caixa) ?? 0));
    return arr;
  }

  function parseDateToTime(v) {
    const s = String(v ?? "").trim();
    if (!s) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d).getTime();
    }

    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }

  function calcularResumoMes(items) {
    let entradasPagas = 0;
    let entradasPendentes = 0;
    let saidas = 0;

    let pagPix = 0;
    let pagDinheiro = 0;
    let pagCredito = 0;
    let pagDebito = 0;
    let pagOutros = 0;

    (items || []).forEach((it) => {
      const tipo = String(it.Tipo || "").trim();
      const status = String(it.Status || "").trim();
      const valor = toNumber(it.Valor);

      if (tipo === "Entrada") {
        if (status === "Pago") {
          entradasPagas += valor;

          const fp = String(it.Forma_Pagamento || "").trim();
          if (fp === "Pix") pagPix += valor;
          else if (fp === "Dinheiro") pagDinheiro += valor;
          else if (fp === "Cartao_Credito") pagCredito += valor;
          else if (fp === "Cartao_Debito") pagDebito += valor;
          else pagOutros += valor;

        } else if (status === "Pendente") {
          entradasPendentes += valor;
        }
      } else if (tipo === "Saida") {
        saidas += valor;
      }
    });

    return {
      entradasPagas,
      entradasPendentes,
      saidas,
      resultado: entradasPagas - saidas,
      pagPix,
      pagDinheiro,
      pagCredito,
      pagDebito,
      pagOutros,
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
    if (detDinheiro) detDinheiro.textContent = "—";
    if (detCredito) detCredito.textContent = "—";
    if (detDebito) detDebito.textContent = "—";
    if (detOutros) detOutros.textContent = "—";
  }

  function bind() {
    if (btnAtualizarLista) btnAtualizarLista.addEventListener("click", (e) => {
      e.preventDefault();
      fecharDetalhes();
      carregarResumo().catch((err) => setFeedback(err.message || "Erro.", "error"));
    });

    if (btnFiltrarMes) btnFiltrarMes.addEventListener("click", (e) => {
      e.preventDefault();
      fecharDetalhes();
      const v = (mesInput?.value || "").trim();
      if (!v) return setFeedback("Escolha um mês ou clique em Limpar.", "error");
      carregarResumo(v).catch((err) => setFeedback(err.message || "Erro.", "error"));
    });

    if (btnLimparMes) btnLimparMes.addEventListener("click", (e) => {
      e.preventDefault();
      if (mesInput) mesInput.value = "";
      fecharDetalhes();
      carregarResumo().catch((err) => setFeedback(err.message || "Erro.", "error"));
    });

    if (btnFecharDetalhes) btnFecharDetalhes.addEventListener("click", (e) => {
      e.preventDefault();
      fecharDetalhes();
    });

    // Exportação
    const btnExportExcel = document.getElementById("btnExportExcel");
    const btnExportPDF = document.getElementById("btnExportPDF");

    if (btnExportExcel) {
      btnExportExcel.addEventListener("click", (e) => {
        e.preventDefault();
        if (!dadosResumoAtual.length) {
          setFeedback("Nenhum dado para exportar.", "error");
          return;
        }
        window.EssenzaExport?.resumoExcel(dadosResumoAtual);
      });
    }

    if (btnExportPDF) {
      btnExportPDF.addEventListener("click", (e) => {
        e.preventDefault();
        if (!dadosResumoAtual.length) {
          setFeedback("Nenhum dado para exportar.", "error");
          return;
        }
        window.EssenzaExport?.resumoPDF(dadosResumoAtual);
      });
    }
  }

  bind();
  carregarResumo().catch((err) => setFeedback(err.message || "Erro ao carregar.", "error"));
})();
