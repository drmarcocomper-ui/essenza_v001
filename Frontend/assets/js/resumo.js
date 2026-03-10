// resumo.js — Resumo mensal melhorado
// Requer: config.js, auth.js, api.js

(() => {
  "use strict";

  const { escapeHtml, formatMoneyBR, toNumber, calcVariacao, formatVariacao, formatDateBR, formatMesDisplay, getMesAtualYYYYMM, setFeedback: setFeedbackEl } = window.EssenzaUtils;

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
  function setFeedback(msg, type) {
    setFeedbackEl(feedback, msg, type);
  }

  // ============================
  // Tabs
  // ============================
  const btnRelatorioInst = document.getElementById("btnRelatorioInstituicoes");
  const btnImprimirInst = document.getElementById("btnImprimirInstituicoes");

  function atualizarBotoesInstituicao(tabAtiva) {
    const isInst = tabAtiva === "instituicoes";
    if (btnRelatorioInst) btnRelatorioInst.style.display = isInst ? "" : "none";
    if (btnImprimirInst) btnImprimirInst.style.display = isInst ? "" : "none";
  }

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

        // Mostrar/esconder botões de instituição
        atualizarBotoesInstituicao(targetId);
      });
    });
  }

  // ============================
  // Cards do mês atual
  // ============================
  function renderCardsResumo(items) {
    if (!resumoCards || !secaoCardsResumo) return;

    const mesAtual = getMesAtualYYYYMM();
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
      carregarProjecao().catch(function() {});

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

    const mesAtual = getMesAtualYYYYMM();

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
        <td>${formatMoneyBR(it["SumUp PJ"])}</td>
        <td>${formatMoneyBR(it["Terceiro PF"])}</td>
        <td>${formatMoneyBR(it["Terceiro PJ"])}</td>
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
        <td>${escapeHtml(formatDateBR(it.Data_Caixa))}</td>
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

  // ============================
  // Projecao de Caixa
  // ============================
  async function carregarProjecao() {
    const tbodyProj = document.querySelector("#tabelaProjecao tbody");
    const fbProj = document.getElementById("feedbackProjecao");
    if (!tbodyProj) return;

    // Need at least some resumo data
    if (!dadosResumoAtual.length) {
      tbodyProj.innerHTML = '<tr><td colspan="5">Sem dados para projecao.</td></tr>';
      return;
    }

    // Calculate averages from last 3 months of actual data
    const last3 = dadosResumoAtual.slice(0, Math.min(3, dadosResumoAtual.length));
    let avgEntradas = 0, avgSaidas = 0;
    last3.forEach(function(it) {
      avgEntradas += toNumber(it["Entradas Pagas"]);
      avgSaidas += toNumber(it["Saidas"]);
    });
    avgEntradas = avgEntradas / last3.length;
    avgSaidas = avgSaidas / last3.length;

    // Get latest month's resultado as starting saldo
    const latestResultado = toNumber(dadosResumoAtual[0]?.["Resultado (Caixa)"]);

    // Fetch pending entries for projection
    var pendingByMonth = {};
    try {
      const data = await jsonpRequest({
        action: "Lancamentos.Listar",
        sheet: "Lancamentos",
        filtros: JSON.stringify({ status: "Pendente" }),
        page: 1,
        limit: 500
      });
      if (data && data.ok && data.items) {
        data.items.forEach(function(it) {
          if (String(it.Tipo || "").trim() !== "Entrada") return;
          var mes = it.Mes_a_receber || "";
          if (!mes && it.Data_Competencia) {
            mes = String(it.Data_Competencia).substring(0, 7);
          }
          if (!mes) return;
          pendingByMonth[mes] = (pendingByMonth[mes] || 0) + toNumber(it.Valor);
        });
      }
    } catch (_) {}

    // Build next 3 months
    var now = new Date();
    var saldo = latestResultado;
    tbodyProj.innerHTML = "";

    for (var i = 1; i <= 3; i++) {
      var d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      var mesKey = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");

      var entradasPrev = avgEntradas + (pendingByMonth[mesKey] || 0);
      var saidasPrev = avgSaidas;
      var resultado = entradasPrev - saidasPrev;
      saldo += resultado;

      var trClass = resultado >= 0 ? "" : ' style="color:var(--cor-erro,#c41e3a)"';
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td>' + escapeHtml(formatMesDisplay(mesKey)) + '</td>' +
        '<td class="valor-positivo">' + formatMoneyBR(entradasPrev) + '</td>' +
        '<td class="valor-negativo">' + formatMoneyBR(saidasPrev) + '</td>' +
        '<td class="' + (resultado >= 0 ? 'valor-positivo' : 'valor-negativo') + '">' + formatMoneyBR(resultado) + '</td>' +
        '<td class="' + (saldo >= 0 ? 'valor-positivo' : 'valor-negativo') + '">' + formatMoneyBR(saldo) + '</td>';
      tbodyProj.appendChild(tr);
    }

    if (fbProj) {
      fbProj.textContent = "Baseado na media dos ultimos " + last3.length + " mes(es) + lancamentos pendentes";
    }
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
      formatDateBR(it.Data_Caixa),
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
  // Relatório Instituições (PDF)
  // ============================
  function exportarInstituicoesPDF(dados) {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      setFeedback("jsPDF não carregado.", "error");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(16);
    doc.text("Relatório por Instituição", 14, 15);

    doc.setFontSize(9);
    doc.setTextColor(100);
    const now = new Date();
    doc.text(`Gerado em: ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR")}`, 14, 22);

    const headers = ["Mês", "Nubank PF", "Nubank PJ", "PicPay PF", "SumUp PJ", "Terceiro PF", "Terceiro PJ", "Dinheiro"];
    const rows = dados.map(it => [
      formatMesDisplay(it["Mês"] || ""),
      formatMoneyBR(it["Nubank PF"]),
      formatMoneyBR(it["Nubank PJ"]),
      formatMoneyBR(it["PicPay PF"]),
      formatMoneyBR(it["SumUp PJ"]),
      formatMoneyBR(it["Terceiro PF"]),
      formatMoneyBR(it["Terceiro PJ"]),
      formatMoneyBR(toNumber(it["Dinheiro PF"]) + toNumber(it["Dinheiro PJ"]))
    ]);

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 28,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [139, 92, 165], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" }
      }
    });

    doc.save(`Relatorio_Instituicoes_${new Date().toISOString().slice(0, 10)}.pdf`);
    setFeedback("PDF de instituições exportado.", "success");
  }

  function imprimirInstituicoes() {
    document.body.classList.add("print-instituicoes");
    window.print();
    document.body.classList.remove("print-instituicoes");
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

    document.getElementById("btnImprimirDetalhes")?.addEventListener("click", () => {
      document.body.classList.add("print-detalhes");
      window.print();
      document.body.classList.remove("print-detalhes");
    });

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

    btnRelatorioInst?.addEventListener("click", () => {
      if (!dadosResumoAtual.length) {
        setFeedback("Nenhum dado para exportar.", "error");
        return;
      }
      exportarInstituicoesPDF(dadosResumoAtual);
    });

    btnImprimirInst?.addEventListener("click", imprimirInstituicoes);
  }

  // ============================
  // Init
  // ============================
  bind();
  carregarResumo();
})();
