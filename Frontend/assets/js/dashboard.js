// dashboard.js — Dashboard com gráficos
// Requer: config.js, auth.js, api.js, Chart.js (CDN)

(() => {
  "use strict";

  const jsonpRequest = window.EssenzaApi?.request || (() => Promise.reject(new Error("EssenzaApi não carregado")));

  // DOM
  const dashboardCards = document.getElementById("dashboardCards");
  const feedback = document.getElementById("feedbackDash");
  const comparativoResumo = document.getElementById("comparativoResumo");
  const comparativoInstituicao = document.getElementById("comparativoInstituicao");

  // Charts
  let chartEvolucao = null;
  let chartPagamentos = null;

  // ============================
  // Helpers
  // ============================
  function setFeedback(msg, type = "info") {
    if (!feedback) return;
    feedback.textContent = msg || "";
    feedback.dataset.type = type;
  }

  function formatMoneyBR(v) {
    const num = parseFloat(v) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function toNumber(v) {
    const s = String(v ?? "").trim();
    if (!s) return 0;
    const num = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(",", "."));
    return Number.isNaN(num) ? 0 : num;
  }

  function getMesAtual() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function getMesAnterior() {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function calcVariacao(atual, anterior) {
    if (!anterior || anterior === 0) return null;
    return ((atual - anterior) / anterior) * 100;
  }

  function formatVariacao(variacao) {
    if (variacao === null) return "";
    const sinal = variacao >= 0 ? "+" : "";
    return `${sinal}${variacao.toFixed(1)}%`;
  }


  // ============================
  // Carregar Dados
  // ============================
  async function carregarDados() {
    setFeedback("Carregando dados...", "info");

    try {
      const data = await jsonpRequest({
        action: "ResumoMensal.Calcular"
      });

      if (!data || data.ok !== true) {
        throw new Error(data?.message || "Erro ao carregar dados.");
      }

      const items = data.items || [];
      processarDados(items);
      setFeedback("", "info");

    } catch (err) {
      setFeedback(err.message || "Erro ao carregar dashboard.", "error");
    }
  }

  // ============================
  // Processar Dados
  // ============================
  function processarDados(items) {
    const mesAtual = getMesAtual();
    const mesAnterior = getMesAnterior();

    // Ordenar por mês decrescente
    const sorted = [...items].sort((a, b) => {
      const ma = a["Mês"] || "";
      const mb = b["Mês"] || "";
      return mb.localeCompare(ma);
    });

    // Encontrar dados do mês atual e anterior
    const dadosAtual = sorted.find(x => x["Mês"] === mesAtual) || null;
    const dadosAnterior = sorted.find(x => x["Mês"] === mesAnterior) || null;

    // Últimos 6 meses para gráficos
    const ultimos6 = sorted.slice(0, 6).reverse();

    renderCards(dadosAtual, dadosAnterior, mesAtual);
    renderChartEvolucao(ultimos6);
    renderChartPagamentos(dadosAtual);
    renderComparativoResumo(dadosAtual, dadosAnterior, mesAtual, mesAnterior);
    renderComparativoInstituicao(dadosAtual, dadosAnterior, mesAtual, mesAnterior);
  }

  // ============================
  // Renderizar Cards
  // ============================
  function renderCards(atual, anterior, mesLabel) {
    if (!dashboardCards) return;

    const entradasPagas = toNumber(atual?.["Entradas Pagas"]);
    const entradasPend = toNumber(atual?.["Entradas Pendentes"]);
    const saidas = toNumber(atual?.["Saidas"]);
    const resultado = toNumber(atual?.["Resultado (Caixa)"]);

    const entAnterior = toNumber(anterior?.["Entradas Pagas"]);
    const saiAnterior = toNumber(anterior?.["Saidas"]);
    const resAnterior = toNumber(anterior?.["Resultado (Caixa)"]);

    const varEntradas = calcVariacao(entradasPagas, entAnterior);
    const varSaidas = calcVariacao(saidas, saiAnterior);
    const varResultado = calcVariacao(resultado, resAnterior);

    const mesFormatado = mesLabel.replace("-", "/");

    dashboardCards.innerHTML = `
      <div class="dash-card dash-card--positive">
        <div class="dash-card__label">Entradas Pagas (${mesFormatado})</div>
        <div class="dash-card__value">${formatMoneyBR(entradasPagas)}</div>
        <div class="dash-card__compare ${varEntradas >= 0 ? 'compare-up' : 'compare-down'}">
          ${varEntradas !== null ? formatVariacao(varEntradas) + ' vs anterior' : ''}
        </div>
      </div>

      <div class="dash-card dash-card--neutral">
        <div class="dash-card__label">Entradas Pendentes</div>
        <div class="dash-card__value">${formatMoneyBR(entradasPend)}</div>
        <div class="dash-card__compare compare-neutral">a receber</div>
      </div>

      <div class="dash-card dash-card--negative">
        <div class="dash-card__label">Saidas (${mesFormatado})</div>
        <div class="dash-card__value">${formatMoneyBR(saidas)}</div>
        <div class="dash-card__compare ${varSaidas <= 0 ? 'compare-up' : 'compare-down'}">
          ${varSaidas !== null ? formatVariacao(varSaidas) + ' vs anterior' : ''}
        </div>
      </div>

      <div class="dash-card ${resultado >= 0 ? 'dash-card--positive' : 'dash-card--negative'}">
        <div class="dash-card__label">Resultado</div>
        <div class="dash-card__value">${formatMoneyBR(resultado)}</div>
        <div class="dash-card__compare ${varResultado >= 0 ? 'compare-up' : 'compare-down'}">
          ${varResultado !== null ? formatVariacao(varResultado) + ' vs anterior' : ''}
        </div>
      </div>
    `;
  }

  // ============================
  // Gráfico Evolução (Linha)
  // ============================
  function renderChartEvolucao(dados) {
    const ctx = document.getElementById("chartEvolucao");
    if (!ctx) return;

    if (chartEvolucao) {
      chartEvolucao.destroy();
    }

    const labels = dados.map(d => {
      const mes = d["Mês"] || "";
      return mes.replace("-", "/");
    });

    const entradas = dados.map(d => toNumber(d["Entradas Pagas"]));
    const saidas = dados.map(d => toNumber(d["Saidas"]));
    const resultado = dados.map(d => toNumber(d["Resultado (Caixa)"]));

    chartEvolucao = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Entradas",
            data: entradas,
            borderColor: "#228b22",
            backgroundColor: "rgba(34, 139, 34, 0.1)",
            fill: true,
            tension: 0.3
          },
          {
            label: "Saidas",
            data: saidas,
            borderColor: "#c41e3a",
            backgroundColor: "rgba(196, 30, 58, 0.1)",
            fill: true,
            tension: 0.3
          },
          {
            label: "Resultado",
            data: resultado,
            borderColor: "#4169e1",
            backgroundColor: "rgba(65, 105, 225, 0.1)",
            fill: false,
            tension: 0.3,
            borderDash: [5, 5]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom"
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return "R$ " + value.toLocaleString("pt-BR");
              }
            }
          }
        }
      }
    });
  }

  // ============================
  // Gráfico Pagamentos (Donut)
  // ============================
  function renderChartPagamentos(dados) {
    const ctx = document.getElementById("chartPagamentos");
    if (!ctx) return;

    if (chartPagamentos) {
      chartPagamentos.destroy();
    }

    if (!dados) {
      chartPagamentos = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["Sem dados"],
          datasets: [{
            data: [1],
            backgroundColor: ["#e0e0e0"]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
      return;
    }

    const formas = [
      { key: "Entrada Pix", label: "Pix", color: "#00d4aa" },
      { key: "Entrada Dinheiro", label: "Dinheiro", color: "#228b22" },
      { key: "Entrada Cartao_Credito", label: "Credito", color: "#4169e1" },
      { key: "Entrada Cartao_Debito", label: "Debito", color: "#9370db" },
      { key: "Entrada Boleto", label: "Boleto", color: "#ff8c00" },
      { key: "Entrada Transferencia", label: "Transf.", color: "#20b2aa" },
      { key: "Entrada Confianca", label: "Confianca", color: "#daa520" },
      { key: "Entrada Cortesia", label: "Cortesia", color: "#808080" }
    ];

    const labels = [];
    const values = [];
    const colors = [];

    formas.forEach(f => {
      const v = toNumber(dados[f.key]);
      if (v > 0) {
        labels.push(f.label);
        values.push(v);
        colors.push(f.color);
      }
    });

    if (values.length === 0) {
      labels.push("Sem dados");
      values.push(1);
      colors.push("#e0e0e0");
    }

    chartPagamentos = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: "#fff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              boxWidth: 12,
              padding: 8
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw || 0;
                return context.label + ": " + formatMoneyBR(value);
              }
            }
          }
        }
      }
    });
  }

  // ============================
  // Comparativo Resumo
  // ============================
  function formatMesLabel(mesYYYYMM) {
    if (!mesYYYYMM) return "";
    const [ano, mes] = mesYYYYMM.split("-");
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${meses[parseInt(mes, 10) - 1]}/${ano}`;
  }

  function renderVarCell(atual, anterior, inverter = false) {
    const var_ = calcVariacao(atual, anterior);
    if (var_ === null) return `<td class="var-neutral">--</td>`;

    const isUp = inverter ? var_ <= 0 : var_ >= 0;
    const cls = isUp ? "var-up" : "var-down";
    const arrow = var_ >= 0 ? "▲" : "▼";

    return `<td class="${cls}"><span class="arrow">${arrow}</span>${formatVariacao(var_)}</td>`;
  }

  function renderComparativoResumo(atual, anterior, mesAtual, mesAnterior) {
    if (!comparativoResumo) return;

    const mesAtualLabel = formatMesLabel(mesAtual);
    const mesAnteriorLabel = formatMesLabel(mesAnterior);

    const campos = [
      { label: "Entradas Pagas", key: "Entradas Pagas", inverter: false },
      { label: "Entradas Pendentes", key: "Entradas Pendentes", inverter: false },
      { label: "Total Entradas", key: "Total Entradas", inverter: false },
      { label: "Saídas", key: "Saidas", inverter: true },
      { label: "Resultado", key: "Resultado (Caixa)", inverter: false },
    ];

    let html = `
      <table class="comparativo-table">
        <thead>
          <tr>
            <th>Métrica</th>
            <th>${mesAnteriorLabel}</th>
            <th>${mesAtualLabel}</th>
            <th>Variação</th>
          </tr>
        </thead>
        <tbody>
    `;

    campos.forEach(c => {
      const valAtual = toNumber(atual?.[c.key]);
      const valAnterior = toNumber(anterior?.[c.key]);

      html += `
        <tr>
          <td>${c.label}</td>
          <td>${formatMoneyBR(valAnterior)}</td>
          <td>${formatMoneyBR(valAtual)}</td>
          ${renderVarCell(valAtual, valAnterior, c.inverter)}
        </tr>
      `;
    });

    html += `</tbody></table>`;
    comparativoResumo.innerHTML = html;
  }

  // ============================
  // Comparativo Instituição
  // ============================
  function renderComparativoInstituicao(atual, anterior, mesAtual, mesAnterior) {
    if (!comparativoInstituicao) return;

    const mesAtualLabel = formatMesLabel(mesAtual);
    const mesAnteriorLabel = formatMesLabel(mesAnterior);

    const instituicoes = [
      { label: "Nubank PF", key: "Nubank PF" },
      { label: "Nubank PJ", key: "Nubank PJ" },
      { label: "PicPay PF", key: "PicPay PF" },
      { label: "PicPay PJ", key: "PicPay PJ" },
      { label: "SumUp PF", key: "SumUp PF" },
      { label: "SumUp PJ", key: "SumUp PJ" },
      { label: "Terceiro PF", key: "Terceiro PF" },
      { label: "Terceiro PJ", key: "Terceiro PJ" },
    ];

    let html = `
      <table class="comparativo-table">
        <thead>
          <tr>
            <th>Instituição</th>
            <th>${mesAnteriorLabel}</th>
            <th>${mesAtualLabel}</th>
            <th>Variação</th>
          </tr>
        </thead>
        <tbody>
    `;

    let temDados = false;
    instituicoes.forEach(inst => {
      const valAtual = toNumber(atual?.[inst.key]);
      const valAnterior = toNumber(anterior?.[inst.key]);

      if (valAtual > 0 || valAnterior > 0) {
        temDados = true;
        html += `
          <tr>
            <td>${inst.label}</td>
            <td>${formatMoneyBR(valAnterior)}</td>
            <td>${formatMoneyBR(valAtual)}</td>
            ${renderVarCell(valAtual, valAnterior, false)}
          </tr>
        `;
      }
    });

    if (!temDados) {
      html += `<tr><td colspan="4" style="text-align:center; color: var(--cor-muted);">Sem dados de Instituição+Titularidade</td></tr>`;
    }

    html += `</tbody></table>`;
    comparativoInstituicao.innerHTML = html;
  }

  // ============================
  // Init
  // ============================
  carregarDados();
})();
