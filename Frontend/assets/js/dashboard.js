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
  const rankingClientes = document.getElementById("rankingClientes");
  const selectMesCliente = document.getElementById("selectMesCliente");
  const alertaPendencias = document.getElementById("alertaPendencias");
  const btnBackup = document.getElementById("btnBackup");
  const feedbackBackup = document.getElementById("feedbackBackup");

  // Charts
  let chartEvolucao = null;
  let chartPagamentos = null;
  let chartCategoriasSaidas = null;
  let chartCategoriasEntradas = null;

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
      popularSelectMeses(items);
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
  // Ranking Clientes
  // ============================
  async function carregarRankingClientes(mes = "") {
    if (!rankingClientes) return;

    rankingClientes.innerHTML = `<p style="color: var(--cor-muted);">Carregando...</p>`;

    try {
      const filtros = {};
      if (mes) filtros.mes = mes;

      const data = await jsonpRequest({
        action: "Lancamentos.PorCliente",
        filtros: JSON.stringify(filtros)
      });

      if (!data || data.ok !== true) {
        throw new Error(data?.message || "Erro ao carregar ranking.");
      }

      renderRankingClientes(data.items || [], data.total || 0);

    } catch (err) {
      rankingClientes.innerHTML = `<p style="color: #c41e3a;">${err.message || "Erro"}</p>`;
    }
  }

  function renderRankingClientes(items, totalGeral) {
    if (!rankingClientes) return;

    if (!items.length) {
      rankingClientes.innerHTML = `<p style="color: var(--cor-muted);">Nenhum cliente encontrado.</p>`;
      return;
    }

    const maxPerc = items[0]?.percentual || 100;

    let html = `
      <table class="comparativo-table">
        <thead>
          <tr>
            <th style="width: 40%;">Cliente</th>
            <th>Qtd</th>
            <th>Total</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
    `;

    items.forEach((it, idx) => {
      const barWidth = maxPerc > 0 ? (it.percentual / maxPerc) * 100 : 0;
      html += `
        <tr>
          <td>
            <strong>${idx + 1}.</strong> ${escapeHtml(it.nome)}
            <div class="ranking-bar"><div class="ranking-bar__fill" style="width: ${barWidth}%;"></div></div>
          </td>
          <td style="text-align: center;">${it.qtd}</td>
          <td>${formatMoneyBR(it.total)}</td>
          <td style="text-align: center;">${it.percentual}%</td>
        </tr>
      `;
    });

    html += `
        </tbody>
        <tfoot>
          <tr style="font-weight: 600; background: var(--cor-bg-alt, #f5f5f5);">
            <td>Total Geral</td>
            <td></td>
            <td>${formatMoneyBR(totalGeral)}</td>
            <td style="text-align: center;">100%</td>
          </tr>
        </tfoot>
      </table>
    `;

    rankingClientes.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function popularSelectMeses(items) {
    if (!selectMesCliente) return;

    // Extrair meses únicos dos dados
    const meses = new Set();
    items.forEach(it => {
      const mes = it["Mês"];
      if (mes) meses.add(mes);
    });

    const sorted = [...meses].sort().reverse();

    selectMesCliente.innerHTML = `<option value="">Todos</option>`;
    sorted.forEach(mes => {
      const opt = document.createElement("option");
      opt.value = mes;
      opt.textContent = formatMesLabel(mes);
      selectMesCliente.appendChild(opt);
    });
  }

  function bindSelectMes() {
    if (!selectMesCliente) return;
    selectMesCliente.addEventListener("change", () => {
      carregarRankingClientes(selectMesCliente.value);
    });
  }

  // ============================
  // Alerta Pendências
  // ============================
  async function carregarPendencias() {
    if (!alertaPendencias) return;

    try {
      const data = await jsonpRequest({
        action: "Lancamentos.Listar",
        filtros: JSON.stringify({ fTipo: "Entrada", fStatus: "Pendente" }),
        limit: 200
      });

      if (!data || data.ok !== true) return;

      const items = data.items || [];
      renderAlertaPendencias(items);

    } catch (err) {
      console.error("Erro ao carregar pendências:", err);
    }
  }

  function renderAlertaPendencias(items) {
    if (!alertaPendencias) return;

    if (!items.length) {
      alertaPendencias.style.display = "block";
      alertaPendencias.innerHTML = `
        <div class="alerta-pendencias alerta-pendencias--vazio">
          <div class="alerta-pendencias__icon">✓</div>
          <div class="alerta-pendencias__content">
            <div class="alerta-pendencias__title">Tudo em dia!</div>
            <div class="alerta-pendencias__desc">Não há entradas pendentes no momento.</div>
          </div>
        </div>
      `;
      return;
    }

    // Calcular total e ordenar por data mais antiga
    let totalPendente = 0;
    items.forEach(it => {
      totalPendente += toNumber(it.Valor);
    });

    // Ordenar por data mais antiga primeiro
    const sorted = [...items].sort((a, b) => {
      const da = a.Data_Competencia || "";
      const db = b.Data_Competencia || "";
      return da.localeCompare(db);
    });

    // Pegar os 5 mais antigos
    const top5 = sorted.slice(0, 5);

    alertaPendencias.style.display = "block";
    alertaPendencias.innerHTML = `
      <div class="alerta-pendencias">
        <div class="alerta-pendencias__icon">⚠️</div>
        <div class="alerta-pendencias__content">
          <div class="alerta-pendencias__title">${items.length} entrada(s) pendente(s)</div>
          <div class="alerta-pendencias__desc">Valores a receber aguardando confirmação de pagamento.</div>
        </div>
        <div class="alerta-pendencias__valor">${formatMoneyBR(totalPendente)}</div>

        <div class="alerta-pendencias__lista">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Descrição</th>
                <th style="text-align:right;">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${top5.map(it => `
                <tr>
                  <td>${escapeHtml(formatDataBR(it.Data_Competencia))}</td>
                  <td>${escapeHtml(it.NomeCliente || it.ID_Cliente || "-")}</td>
                  <td>${escapeHtml(it.Descricao || "-")}</td>
                  <td style="text-align:right;">${formatMoneyBR(it.Valor)}</td>
                </tr>
              `).join("")}
              ${items.length > 5 ? `
                <tr>
                  <td colspan="4" style="text-align:center; font-style:italic; color:#856404;">
                    ... e mais ${items.length - 5} pendência(s)
                  </td>
                </tr>
              ` : ""}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function formatDataBR(dataISO) {
    if (!dataISO) return "";
    const s = String(dataISO).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-");
      return `${d}/${m}/${y}`;
    }
    return s;
  }

  // ============================
  // Gráficos por Categoria
  // ============================
  const CORES_CATEGORIAS = [
    "#8b5ca5", "#c41e3a", "#228b22", "#4169e1", "#ff8c00",
    "#20b2aa", "#9370db", "#daa520", "#00d4aa", "#cd5c5c",
    "#6495ed", "#32cd32", "#ba55d3", "#f0e68c", "#87ceeb"
  ];

  async function carregarCategorias() {
    const mesAtual = getMesAtual();
    const [ano, mes] = mesAtual.split("-");
    const primeiroDia = `${ano}-${mes}-01`;
    const ultimoDia = `${ano}-${mes}-31`;

    try {
      const data = await jsonpRequest({
        action: "Lancamentos.Listar",
        filtros: JSON.stringify({
          fDataIni: primeiroDia,
          fDataFim: ultimoDia,
          dateField: "Data_Caixa"
        }),
        limit: 500
      });

      if (!data || data.ok !== true) return;

      const items = data.items || [];
      renderChartCategorias(items);

    } catch (err) {
      console.error("Erro ao carregar categorias:", err);
    }
  }

  function agruparPorCategoria(items, tipo) {
    const agrupado = {};

    items.forEach(item => {
      if (item.Tipo !== tipo) return;
      if (item.Status !== "Pago") return;

      const categoria = item.Categoria || "(Sem categoria)";
      const valor = toNumber(item.Valor);

      if (!agrupado[categoria]) {
        agrupado[categoria] = 0;
      }
      agrupado[categoria] += valor;
    });

    // Converter para array e ordenar por valor
    const arr = Object.keys(agrupado).map(cat => ({
      categoria: cat,
      valor: agrupado[cat]
    }));

    arr.sort((a, b) => b.valor - a.valor);

    // Limitar a 10 categorias, agrupar resto em "Outros"
    if (arr.length > 10) {
      const top10 = arr.slice(0, 10);
      const outros = arr.slice(10).reduce((sum, it) => sum + it.valor, 0);
      if (outros > 0) {
        top10.push({ categoria: "Outros", valor: outros });
      }
      return top10;
    }

    return arr;
  }

  function renderChartCategorias(items) {
    // Saídas
    const saidasAgrupadas = agruparPorCategoria(items, "Saida");
    renderChartCategoriaPie("chartCategoriasSaidas", saidasAgrupadas, "Saídas");

    // Entradas
    const entradasAgrupadas = agruparPorCategoria(items, "Entrada");
    renderChartCategoriaPie("chartCategoriasEntradas", entradasAgrupadas, "Entradas");
  }

  function renderChartCategoriaPie(canvasId, dados, titulo) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // Destruir chart anterior se existir
    if (canvasId === "chartCategoriasSaidas" && chartCategoriasSaidas) {
      chartCategoriasSaidas.destroy();
    }
    if (canvasId === "chartCategoriasEntradas" && chartCategoriasEntradas) {
      chartCategoriasEntradas.destroy();
    }

    if (!dados.length) {
      const chart = new Chart(ctx, {
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

      if (canvasId === "chartCategoriasSaidas") chartCategoriasSaidas = chart;
      if (canvasId === "chartCategoriasEntradas") chartCategoriasEntradas = chart;
      return;
    }

    const labels = dados.map(d => d.categoria);
    const values = dados.map(d => d.valor);
    const colors = dados.map((_, i) => CORES_CATEGORIAS[i % CORES_CATEGORIAS.length]);

    const chart = new Chart(ctx, {
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
              padding: 6,
              font: { size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const perc = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return `${context.label}: ${formatMoneyBR(value)} (${perc}%)`;
              }
            }
          }
        }
      }
    });

    if (canvasId === "chartCategoriasSaidas") chartCategoriasSaidas = chart;
    if (canvasId === "chartCategoriasEntradas") chartCategoriasEntradas = chart;
  }

  // ============================
  // Backup Completo
  // ============================
  function setFeedbackBackup(msg, type = "info") {
    if (!feedbackBackup) return;
    feedbackBackup.textContent = msg || "";
    feedbackBackup.dataset.type = type;
  }

  async function executarBackup() {
    if (!btnBackup) return;

    btnBackup.disabled = true;
    btnBackup.textContent = "Exportando...";
    setFeedbackBackup("Carregando dados do servidor...", "info");

    try {
      const data = await jsonpRequest({
        action: "Backup.ExportarTodos"
      });

      if (!data || data.ok !== true) {
        throw new Error(data?.message || "Erro ao carregar dados para backup.");
      }

      setFeedbackBackup("Gerando arquivo Excel...", "info");

      // Usar o EssenzaExport para gerar o arquivo
      if (typeof window.EssenzaExport?.backupExcel === "function") {
        window.EssenzaExport.backupExcel(data.sheets, "backup_essenza");
        setFeedbackBackup("Backup exportado com sucesso!", "success");
      } else {
        throw new Error("Módulo de exportação não carregado.");
      }

    } catch (err) {
      setFeedbackBackup(err.message || "Erro ao exportar backup.", "error");
    } finally {
      btnBackup.disabled = false;
      btnBackup.textContent = "Exportar Backup Excel";
    }
  }

  function bindBackup() {
    if (!btnBackup) return;
    btnBackup.addEventListener("click", executarBackup);
  }

  // ============================
  // Init
  // ============================
  bindSelectMes();
  bindBackup();
  carregarDados();
  carregarRankingClientes();
  carregarPendencias();
  carregarCategorias();
})();
