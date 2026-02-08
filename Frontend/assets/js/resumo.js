// resumo.js — Resumo mensal melhorado
// Requer: config.js, auth.js, api.js

(() => {
  "use strict";

  const jsonpRequest = window.EssenzaApi?.request || (() => Promise.reject(new Error("EssenzaApi não carregado")));

  // DOM Elements
  const btnFiltrarMes = document.getElementById("btnFiltrarMes");
  const btnLimparMes = document.getElementById("btnLimparMes");
  const mesInput = document.getElementById("mes");
  const feedback = document.getElementById("feedbackResumo");

  const secaoCardsResumo = document.getElementById("secaoCardsResumo");
  const resumoCards = document.getElementById("resumoCards");

  const tbodyPrincipal = document.querySelector("#tabelaResumoPrincipal tbody");
  const tbodyPagamentos = document.querySelector("#tabelaResumoPagamentos tbody");
  const tbodyInstituicoes = document.querySelector("#tabelaResumoInstituicoes tbody");

  const cardDetalhes = document.getElementById("cardDetalhes");
  const mesSelecionado = document.getElementById("mesSelecionado");
  const tbodyDetalhes = document.querySelector("#tabelaDetalhes tbody");
  const btnFecharDetalhes = document.getElementById("btnFecharDetalhes");

  const detEntradasPagas = document.getElementById("detEntradasPagas");
  const detEntradasPend = document.getElementById("detEntradasPend");
  const detSaidas = document.getElementById("detSaidas");
  const detResultado = document.getElementById("detResultado");
  const detResultadoWrap = document.getElementById("detResultadoWrap");

  const detPix = document.getElementById("detPix");
  const detDinheiro = document.getElementById("detDinheiro");
  const detCredito = document.getElementById("detCredito");
  const detDebito = document.getElementById("detDebito");
  const detOutros = document.getElementById("detOutros");

  // Estado
  let dadosResumoAtual = [];
  let dadosDetalhesAtual = { mes: "", items: [], resumo: null };

  // ============================
  // Helpers
  // ============================
  function setFeedback(msg, type = "info") {
    if (!feedback) return;
    feedback.textContent = msg || "";
    feedback.dataset.type = type;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatMoneyBR(v) {
    const s = String(v ?? "").trim();
    if (!s) return "R$ 0,00";
    const num = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(",", "."));
    if (Number.isNaN(num)) return s;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatMesDisplay(mesYYYYMM) {
    if (!mesYYYYMM || !/^\d{4}-\d{2}$/.test(mesYYYYMM)) return mesYYYYMM;
    const [ano, mes] = mesYYYYMM.split("-");
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${meses[parseInt(mes, 10) - 1]}/${ano}`;
  }

  function toNumber(v) {
    const s = String(v ?? "").trim();
    if (!s) return 0;
    const num = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(",", "."));
    return Number.isNaN(num) ? 0 : num;
  }

  function getMesAtual() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function calcVariacao(atual, anterior) {
    if (!anterior || anterior === 0) return null;
    return ((atual - anterior) / Math.abs(anterior)) * 100;
  }

  function formatVariacao(v) {
    if (v === null) return "";
    const sinal = v >= 0 ? "+" : "";
    return `${sinal}${v.toFixed(1)}%`;
  }

  function formatDataBR(dataISO) {
    if (!dataISO) return "";
    const s = String(dataISO).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y, m, d] = s.substring(0, 10).split("-");
      return `${d}/${m}/${y}`;
    }
    return s;
  }

  // ============================
  // Tabs
  // ============================
  function initTabs() {
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        const targetId = tab.dataset.tab;

        // Atualizar tabs ativas
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        // Mostrar conteúdo correto
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        document.getElementById(`tab-${targetId}`)?.classList.add("active");
      });
    });
  }

  // ============================
  // Cards do mês atual
  // ============================
  function renderCardsResumo(items) {
    if (!resumoCards || !secaoCardsResumo) return;

    const mesAtual = getMesAtual();
    const dadosAtual = items.find(x => x["Mês"] === mesAtual);
    const mesAnterior = items.find((x, i, arr) => {
      const idx = arr.findIndex(a => a["Mês"] === mesAtual);
      return i === idx + 1;
    });

    if (!dadosAtual) {
      secaoCardsResumo.style.display = "none";
      return;
    }

    secaoCardsResumo.style.display = "block";

    const entradas = toNumber(dadosAtual["Entradas Pagas"]);
    const pendentes = toNumber(dadosAtual["Entradas Pendentes"]);
    const saidas = toNumber(dadosAtual["Saidas"]);
    const resultado = toNumber(dadosAtual["Resultado (Caixa)"]);

    const entAnterior = toNumber(mesAnterior?.["Entradas Pagas"]);
    const saiAnterior = toNumber(mesAnterior?.["Saidas"]);

    const varEnt = calcVariacao(entradas, entAnterior);
    const varSai = calcVariacao(saidas, saiAnterior);

    resumoCards.innerHTML = `
      <div class="resumo-card resumo-card--positivo">
        <div class="resumo-card__label">Entradas ${formatMesDisplay(mesAtual)}</div>
        <div class="resumo-card__value">${formatMoneyBR(entradas)}</div>
        ${varEnt !== null ? `<div class="resumo-card__var ${varEnt >= 0 ? 'var-up' : 'var-down'}">${formatVariacao(varEnt)} vs anterior</div>` : ''}
      </div>
      <div class="resumo-card resumo-card--pendente">
        <div class="resumo-card__label">Pendentes</div>
        <div class="resumo-card__value">${formatMoneyBR(pendentes)}</div>
      </div>
      <div class="resumo-card resumo-card--negativo">
        <div class="resumo-card__label">Saídas</div>
        <div class="resumo-card__value">${formatMoneyBR(saidas)}</div>
        ${varSai !== null ? `<div class="resumo-card__var ${varSai <= 0 ? 'var-up' : 'var-down'}">${formatVariacao(varSai)} vs anterior</div>` : ''}
      </div>
      <div class="resumo-card ${resultado >= 0 ? 'resumo-card--positivo' : 'resumo-card--negativo'}">
        <div class="resumo-card__label">Resultado</div>
        <div class="resumo-card__value">${formatMoneyBR(resultado)}</div>
      </div>
    `;
  }

  // ============================
  // Carregar dados
  // ============================
  async function carregarResumo(mesYYYYMM) {
    setFeedback("Carregando...", "info");

    try {
      const params = { action: "ResumoMensal.Calcular" };
      if (mesYYYYMM) params.mes = mesYYYYMM;

      const data = await jsonpRequest(params);
      if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao calcular resumo.");

      dadosResumoAtual = data.items || [];
      renderCardsResumo(dadosResumoAtual);
      renderTabelaPrincipal(dadosResumoAtual);
      renderTabelaPagamentos(dadosResumoAtual);
      renderTabelaInstituicoes(dadosResumoAtual);
      setFeedback(`${dadosResumoAtual.length} mês(es) carregados`, "success");

    } catch (err) {
      setFeedback(err.message || "Erro ao carregar.", "error");
    }
  }

  // ============================
  // Tabela Principal
  // ============================
  function renderTabelaPrincipal(items) {
    if (!tbodyPrincipal) return;
    tbodyPrincipal.innerHTML = "";

    if (!items.length) {
      tbodyPrincipal.innerHTML = `<tr><td colspan="6">Sem dados.</td></tr>`;
      return;
    }

    const mesAtual = getMesAtual();

    items.forEach((it, idx) => {
      const mes = it["Mês"] || "";
      const entradas = toNumber(it["Entradas Pagas"]);
      const pendentes = toNumber(it["Entradas Pendentes"]);
      const saidas = toNumber(it["Saidas"]);
      const resultado = toNumber(it["Resultado (Caixa)"]);

      // Calcular variação vs mês anterior
      const anterior = items[idx + 1];
      const resAnterior = toNumber(anterior?.["Resultado (Caixa)"]);
      const variacao = calcVariacao(resultado, resAnterior);

      const isMesAtual = mes === mesAtual;

      const tr = document.createElement("tr");
      if (isMesAtual) tr.classList.add("mes-atual");

      tr.innerHTML = `
        <td><button type="button" class="btn btn--secondary btn-mes" data-mes="${escapeHtml(mes)}">${escapeHtml(formatMesDisplay(mes))}</button></td>
        <td class="valor-positivo">${formatMoneyBR(entradas)}</td>
        <td class="valor-pendente">${formatMoneyBR(pendentes)}</td>
        <td class="valor-negativo">${formatMoneyBR(saidas)}</td>
        <td class="${resultado >= 0 ? 'valor-positivo' : 'valor-negativo'}">${formatMoneyBR(resultado)}</td>
        <td class="${variacao !== null ? (variacao >= 0 ? 'var-up' : 'var-down') : ''}">${formatVariacao(variacao)}</td>
      `;

      tbodyPrincipal.appendChild(tr);

      tr.querySelector(".btn-mes")?.addEventListener("click", () => {
        carregarDetalhesMes(mes);
      });
    });
  }

  // ============================
  // Tabela Pagamentos
  // ============================
  function renderTabelaPagamentos(items) {
    if (!tbodyPagamentos) return;
    tbodyPagamentos.innerHTML = "";

    if (!items.length) {
      tbodyPagamentos.innerHTML = `<tr><td colspan="7">Sem dados.</td></tr>`;
      return;
    }

    items.forEach(it => {
      const mes = it["Mês"] || "";
      const pix = toNumber(it["Entrada Pix"]);
      const dinheiro = toNumber(it["Entrada Dinheiro"]);
      const credito = toNumber(it["Entrada Cartao_Credito"]);
      const debito = toNumber(it["Entrada Cartao_Debito"]);
      const boleto = toNumber(it["Entrada Boleto"]);
      const outros = toNumber(it["Entrada Transferencia"]) + toNumber(it["Entrada Confianca"]) + toNumber(it["Entrada Cortesia"]);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><button type="button" class="btn btn--secondary btn-mes" data-mes="${escapeHtml(mes)}">${escapeHtml(formatMesDisplay(mes))}</button></td>
        <td>${formatMoneyBR(pix)}</td>
        <td>${formatMoneyBR(dinheiro)}</td>
        <td>${formatMoneyBR(credito)}</td>
        <td>${formatMoneyBR(debito)}</td>
        <td>${formatMoneyBR(boleto)}</td>
        <td>${formatMoneyBR(outros)}</td>
      `;

      tbodyPagamentos.appendChild(tr);

      tr.querySelector(".btn-mes")?.addEventListener("click", () => {
        carregarDetalhesMes(mes);
      });
    });
  }

  // ============================
  // Tabela Instituições
  // ============================
  function renderTabelaInstituicoes(items) {
    if (!tbodyInstituicoes) return;
    tbodyInstituicoes.innerHTML = "";

    if (!items.length) {
      tbodyInstituicoes.innerHTML = `<tr><td colspan="8">Sem dados.</td></tr>`;
      return;
    }

    items.forEach(it => {
      const mes = it["Mês"] || "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><button type="button" class="btn btn--secondary btn-mes" data-mes="${escapeHtml(mes)}">${escapeHtml(formatMesDisplay(mes))}</button></td>
        <td>${formatMoneyBR(it["Nubank PF"])}</td>
        <td>${formatMoneyBR(it["Nubank PJ"])}</td>
        <td>${formatMoneyBR(it["PicPay PF"])}</td>
        <td>${formatMoneyBR(it["PicPay PJ"])}</td>
        <td>${formatMoneyBR(it["SumUp PF"])}</td>
        <td>${formatMoneyBR(it["SumUp PJ"])}</td>
        <td>${formatMoneyBR(toNumber(it["Dinheiro PF"]) + toNumber(it["Dinheiro PJ"]))}</td>
      `;

      tbodyInstituicoes.appendChild(tr);

      tr.querySelector(".btn-mes")?.addEventListener("click", () => {
        carregarDetalhesMes(mes);
      });
    });
  }

  // ============================
  // Detalhes do mês
  // ============================
  async function carregarDetalhesMes(mesYYYYMM) {
    setFeedback("Carregando detalhes...", "info");

    try {
      const data = await jsonpRequest({ action: "ResumoMensal.DetalharMes", mes: mesYYYYMM });
      if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao carregar detalhes.");

      renderDetalhes(mesYYYYMM, data.items || []);
      setFeedback(`${(data.items || []).length} lançamento(s)`, "success");

    } catch (err) {
      setFeedback(err.message || "Erro.", "error");
    }
  }

  function renderDetalhes(mesYYYYMM, items) {
    if (!tbodyDetalhes) return;

    const sorted = sortByDataDesc(items);

    if (mesSelecionado) mesSelecionado.textContent = formatMesDisplay(mesYYYYMM);
    if (cardDetalhes) cardDetalhes.style.display = "block";

    const resumo = calcularResumoMes(sorted);
    dadosDetalhesAtual = { mes: mesYYYYMM, items: sorted, resumo };

    // Preencher cards de resumo
    if (detEntradasPagas) detEntradasPagas.textContent = formatMoneyBR(resumo.entradasPagas);
    if (detEntradasPend) detEntradasPend.textContent = formatMoneyBR(resumo.entradasPendentes);
    if (detSaidas) detSaidas.textContent = formatMoneyBR(resumo.saidas);
    if (detResultado) {
      detResultado.textContent = formatMoneyBR(resumo.resultado);
      detResultado.style.color = resumo.resultado >= 0 ? "#228b22" : "#c41e3a";
    }

    if (detPix) detPix.textContent = formatMoneyBR(resumo.pagPix);
    if (detDinheiro) detDinheiro.textContent = formatMoneyBR(resumo.pagDinheiro);
    if (detCredito) detCredito.textContent = formatMoneyBR(resumo.pagCredito);
    if (detDebito) detDebito.textContent = formatMoneyBR(resumo.pagDebito);
    if (detOutros) detOutros.textContent = formatMoneyBR(resumo.pagOutros);

    // Tabela de lançamentos
    tbodyDetalhes.innerHTML = "";

    if (!sorted.length) {
      tbodyDetalhes.innerHTML = `<tr><td colspan="8">Nenhum lançamento.</td></tr>`;
      cardDetalhes.scrollIntoView({ behavior: "smooth" });
      return;
    }

    sorted.forEach(it => {
      const tipo = it.Tipo || "";
      const isEntrada = tipo === "Entrada";
      const isSaida = tipo === "Saida";

      // Mostrar nome do cliente/fornecedor se disponível
      let clienteForn = "";
      if (isEntrada) {
        clienteForn = it.NomeCliente || it.ID_Cliente || "";
      } else if (isSaida) {
        clienteForn = it.NomeFornecedor || it.ID_Fornecedor || it.Categoria || "";
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(formatDataBR(it.Data_Caixa))}</td>
        <td class="${isEntrada ? 'valor-positivo' : 'valor-negativo'}">${escapeHtml(tipo)}</td>
        <td>${escapeHtml(it.Categoria || "")}</td>
        <td>${escapeHtml((it.Descricao || "").substring(0, 40))}${(it.Descricao || "").length > 40 ? '...' : ''}</td>
        <td>${escapeHtml(clienteForn)}</td>
        <td>${escapeHtml(it.Forma_Pagamento || "")}</td>
        <td class="${isEntrada ? 'valor-positivo' : 'valor-negativo'}">${formatMoneyBR(it.Valor)}</td>
        <td>${escapeHtml(it.Status || "")}</td>
      `;
      tbodyDetalhes.appendChild(tr);
    });

    cardDetalhes.scrollIntoView({ behavior: "smooth" });
  }

  function sortByDataDesc(items) {
    return [...items].sort((a, b) => {
      const da = parseDateToTime(a?.Data_Caixa) ?? 0;
      const db = parseDateToTime(b?.Data_Caixa) ?? 0;
      return db - da;
    });
  }

  function parseDateToTime(v) {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y, m, d] = s.substring(0, 10).split("-").map(Number);
      return new Date(y, m - 1, d).getTime();
    }
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }

  function calcularResumoMes(items) {
    let entradasPagas = 0, entradasPendentes = 0, saidas = 0;
    let pagPix = 0, pagDinheiro = 0, pagCredito = 0, pagDebito = 0, pagOutros = 0;

    items.forEach(it => {
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
      totalEntradas: entradasPagas + entradasPendentes,
      saidas,
      resultado: entradasPagas - saidas,
      pagPix,
      pagDinheiro,
      pagCredito,
      pagDebito,
      pagOutros
    };
  }

  function fecharDetalhes() {
    if (cardDetalhes) cardDetalhes.style.display = "none";
    if (tbodyDetalhes) tbodyDetalhes.innerHTML = "";
    dadosDetalhesAtual = { mes: "", items: [], resumo: null };
  }

  // ============================
  // Exportação
  // ============================
  function exportarDetalhesPDF(dados) {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      setFeedback("jsPDF não carregado.", "error");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    const r = dados.resumo;

    doc.setFontSize(16);
    doc.text(`Detalhes: ${formatMesDisplay(dados.mes)}`, 14, 15);

    doc.setFontSize(10);
    let y = 25;
    doc.text(`Entradas: ${formatMoneyBR(r.entradasPagas)}`, 14, y);
    doc.text(`Pendentes: ${formatMoneyBR(r.entradasPendentes)}`, 80, y);
    doc.text(`Saídas: ${formatMoneyBR(r.saidas)}`, 140, y);
    doc.text(`Resultado: ${formatMoneyBR(r.resultado)}`, 200, y);

    const headers = ["Data", "Tipo", "Categoria", "Descrição", "Cliente/Forn.", "Pagamento", "Valor", "Status"];
    const rows = dados.items.map(it => [
      formatDataBR(it.Data_Caixa),
      it.Tipo || "",
      it.Categoria || "",
      (it.Descricao || "").substring(0, 25),
      it.NomeCliente || it.ID_Cliente || it.NomeFornecedor || "",
      it.Forma_Pagamento || "",
      formatMoneyBR(it.Valor),
      it.Status || ""
    ]);

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: y + 10,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [139, 92, 165] }
    });

    doc.save(`Detalhes_${dados.mes}.pdf`);
    setFeedback("PDF exportado.", "success");
  }

  // ============================
  // Bind
  // ============================
  function bind() {
    initTabs();

    btnFiltrarMes?.addEventListener("click", () => {
      fecharDetalhes();
      const v = mesInput?.value?.trim();
      if (!v) {
        setFeedback("Escolha um mês.", "error");
        return;
      }
      carregarResumo(v);
    });

    btnLimparMes?.addEventListener("click", () => {
      if (mesInput) mesInput.value = "";
      fecharDetalhes();
      carregarResumo();
    });

    btnFecharDetalhes?.addEventListener("click", fecharDetalhes);

    document.getElementById("btnImprimirDetalhes")?.addEventListener("click", () => window.print());

    document.getElementById("btnExportDetalhesPDF")?.addEventListener("click", () => {
      if (!dadosDetalhesAtual.items.length) {
        setFeedback("Nenhum dado para exportar.", "error");
        return;
      }
      exportarDetalhesPDF(dadosDetalhesAtual);
    });

    document.getElementById("btnExportExcel")?.addEventListener("click", () => {
      if (!dadosResumoAtual.length) {
        setFeedback("Nenhum dado para exportar.", "error");
        return;
      }
      window.EssenzaExport?.resumoExcel?.(dadosResumoAtual);
    });

    document.getElementById("btnExportPDF")?.addEventListener("click", () => {
      if (!dadosResumoAtual.length) {
        setFeedback("Nenhum dado para exportar.", "error");
        return;
      }
      window.EssenzaExport?.resumoPDF?.(dadosResumoAtual);
    });
  }

  // ============================
  // Init
  // ============================
  bind();
  carregarResumo();
})();
