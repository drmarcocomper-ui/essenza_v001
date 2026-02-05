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
  const detTotalEntradas = document.getElementById("detTotalEntradas");
  const detSaidas = document.getElementById("detSaidas");
  const detResultado = document.getElementById("detResultado");

  const detPix = document.getElementById("detPix");
  const detDinheiro = document.getElementById("detDinheiro");
  const detCredito = document.getElementById("detCredito");
  const detDebito = document.getElementById("detDebito");
  const detOutros = document.getElementById("detOutros");

  // Inst + Titularidade
  const detNubankPF = document.getElementById("detNubankPF");
  const detNubankPJ = document.getElementById("detNubankPJ");
  const detPicPayPF = document.getElementById("detPicPayPF");
  const detPicPayPJ = document.getElementById("detPicPayPJ");
  const detSumUpPF = document.getElementById("detSumUpPF");
  const detSumUpPJ = document.getElementById("detSumUpPJ");
  const detTerceiroPF = document.getElementById("detTerceiroPF");
  const detTerceiroPJ = document.getElementById("detTerceiroPJ");
  const detDinheiroPF = document.getElementById("detDinheiroPF");
  const detDinheiroPJ = document.getElementById("detDinheiroPJ");
  const detCortesiaPF = document.getElementById("detCortesiaPF");
  const detCortesiaPJ = document.getElementById("detCortesiaPJ");

  // Estado para exportação
  let dadosResumoAtual = [];
  let dadosDetalhesAtual = { mes: "", items: [], resumo: null };

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

  function formatMesDisplay(mesYYYYMM) {
    if (!mesYYYYMM || !/^\d{4}-\d{2}$/.test(mesYYYYMM)) return mesYYYYMM;
    const [ano, mes] = mesYYYYMM.split("-");
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const mesNome = meses[parseInt(mes, 10) - 1] || mes;
    return `${mesNome}/${ano}`;
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
      const mesDisplay = formatMesDisplay(mes);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><button type="button" class="btn btn--secondary btn-mes" data-mes="${escapeHtml(mes)}">${escapeHtml(mesDisplay)}</button></td>

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

        <td>${escapeHtml(formatMoneyBR(it["Nubank PF"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Nubank PJ"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["PicPay PF"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["PicPay PJ"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["SumUp PF"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["SumUp PJ"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Terceiro PF"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Terceiro PJ"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Dinheiro PF"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Dinheiro PJ"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Cortesia PF"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Cortesia PJ"]))}</td>
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

    if (mesSelecionado) mesSelecionado.textContent = formatMesDisplay(mesYYYYMM);
    if (cardDetalhes) cardDetalhes.style.display = "block";

    const resumo = calcularResumoMes(sorted);

    // Salvar para exportação
    dadosDetalhesAtual = { mes: mesYYYYMM, items: sorted, resumo };

    if (detEntradasPagas) detEntradasPagas.textContent = formatMoneyBR(resumo.entradasPagas);
    if (detEntradasPend) detEntradasPend.textContent = formatMoneyBR(resumo.entradasPendentes);
    if (detTotalEntradas) detTotalEntradas.textContent = formatMoneyBR(resumo.totalEntradas);
    if (detSaidas) detSaidas.textContent = formatMoneyBR(resumo.saidas);
    if (detResultado) detResultado.textContent = formatMoneyBR(resumo.resultado);

    if (detPix) detPix.textContent = formatMoneyBR(resumo.pagPix);
    if (detDinheiro) detDinheiro.textContent = formatMoneyBR(resumo.pagDinheiro);
    if (detCredito) detCredito.textContent = formatMoneyBR(resumo.pagCredito);
    if (detDebito) detDebito.textContent = formatMoneyBR(resumo.pagDebito);
    if (detOutros) detOutros.textContent = formatMoneyBR(resumo.pagOutros);

    // Inst + Titularidade
    if (detNubankPF) detNubankPF.textContent = formatMoneyBR(resumo.instTit.Nubank_PF);
    if (detNubankPJ) detNubankPJ.textContent = formatMoneyBR(resumo.instTit.Nubank_PJ);
    if (detPicPayPF) detPicPayPF.textContent = formatMoneyBR(resumo.instTit.PicPay_PF);
    if (detPicPayPJ) detPicPayPJ.textContent = formatMoneyBR(resumo.instTit.PicPay_PJ);
    if (detSumUpPF) detSumUpPF.textContent = formatMoneyBR(resumo.instTit.SumUp_PF);
    if (detSumUpPJ) detSumUpPJ.textContent = formatMoneyBR(resumo.instTit.SumUp_PJ);
    if (detTerceiroPF) detTerceiroPF.textContent = formatMoneyBR(resumo.instTit.Terceiro_PF);
    if (detTerceiroPJ) detTerceiroPJ.textContent = formatMoneyBR(resumo.instTit.Terceiro_PJ);
    if (detDinheiroPF) detDinheiroPF.textContent = formatMoneyBR(resumo.instTit.Dinheiro_PF);
    if (detDinheiroPJ) detDinheiroPJ.textContent = formatMoneyBR(resumo.instTit.Dinheiro_PJ);
    if (detCortesiaPF) detCortesiaPF.textContent = formatMoneyBR(resumo.instTit.Cortesia_PF);
    if (detCortesiaPJ) detCortesiaPJ.textContent = formatMoneyBR(resumo.instTit.Cortesia_PJ);

    tbodyDetalhes.innerHTML = "";

    if (!Array.isArray(sorted) || sorted.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="10">Nenhum lançamento neste mês.</td>`;
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
        <td>${escapeHtml(it.Titularidade || "")}</td>
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

    // Inst + Titularidade
    const instTit = {
      Nubank_PF: 0, Nubank_PJ: 0,
      PicPay_PF: 0, PicPay_PJ: 0,
      SumUp_PF: 0, SumUp_PJ: 0,
      Terceiro_PF: 0, Terceiro_PJ: 0,
      Dinheiro_PF: 0, Dinheiro_PJ: 0,
      Cortesia_PF: 0, Cortesia_PJ: 0,
    };

    const instFixas = ["Nubank", "PicPay", "SumUp", "Terceiro", "Dinheiro", "Cortesia"];
    const titFixas = ["PF", "PJ"];

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

          // Inst + Titularidade
          const inst = String(it.Instituicao_Financeira || "").trim();
          const tit = String(it.Titularidade || "").trim();
          if (instFixas.includes(inst) && titFixas.includes(tit)) {
            const key = inst + "_" + tit;
            instTit[key] = (instTit[key] || 0) + valor;
          }

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
      pagOutros,
      instTit,
    };
  }

  function exportarDetalhesPDF(dados) {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      setFeedback("jsPDF não carregado.", "error");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    const r = dados.resumo;

    // Título
    doc.setFontSize(16);
    doc.text(`Detalhes do Mês: ${dados.mes}`, 14, 15);

    // Resumo
    doc.setFontSize(10);
    let y = 25;
    doc.text(`Entradas Pagas: ${formatMoneyBR(r.entradasPagas)}`, 14, y);
    doc.text(`Entradas Pendentes: ${formatMoneyBR(r.entradasPendentes)}`, 80, y);
    doc.text(`Total Entradas: ${formatMoneyBR(r.totalEntradas)}`, 150, y);
    doc.text(`Saídas: ${formatMoneyBR(r.saidas)}`, 220, y);
    y += 6;
    doc.text(`Resultado: ${formatMoneyBR(r.resultado)}`, 14, y);
    doc.text(`Pix: ${formatMoneyBR(r.pagPix)}`, 80, y);
    doc.text(`Dinheiro: ${formatMoneyBR(r.pagDinheiro)}`, 130, y);
    doc.text(`Crédito: ${formatMoneyBR(r.pagCredito)}`, 180, y);
    doc.text(`Débito: ${formatMoneyBR(r.pagDebito)}`, 230, y);
    y += 6;
    doc.text(`Nubank PF: ${formatMoneyBR(r.instTit.Nubank_PF)}`, 14, y);
    doc.text(`Nubank PJ: ${formatMoneyBR(r.instTit.Nubank_PJ)}`, 70, y);
    doc.text(`PicPay PF: ${formatMoneyBR(r.instTit.PicPay_PF)}`, 126, y);
    doc.text(`PicPay PJ: ${formatMoneyBR(r.instTit.PicPay_PJ)}`, 182, y);
    doc.text(`SumUp PF: ${formatMoneyBR(r.instTit.SumUp_PF)}`, 238, y);
    y += 6;
    doc.text(`SumUp PJ: ${formatMoneyBR(r.instTit.SumUp_PJ)}`, 14, y);
    doc.text(`Terceiro PF: ${formatMoneyBR(r.instTit.Terceiro_PF)}`, 70, y);
    doc.text(`Terceiro PJ: ${formatMoneyBR(r.instTit.Terceiro_PJ)}`, 126, y);

    // Tabela de lançamentos
    const headers = ["Data", "Tipo", "Categoria", "Descrição", "Cliente/Forn.", "Forma Pag.", "Instituição", "Titular.", "Valor", "Status"];
    const rows = dados.items.map(it => [
      it.Data_Caixa || "",
      it.Tipo || "",
      it.Categoria || "",
      (it.Descricao || "").substring(0, 25),
      (it.Cliente_Fornecedor || "").substring(0, 20),
      it.Forma_Pagamento || "",
      it.Instituicao_Financeira || "",
      it.Titularidade || "",
      formatMoneyBR(it.Valor),
      it.Status || "",
    ]);

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: y + 8,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [60, 60, 60] },
    });

    doc.save(`Detalhes_${dados.mes}.pdf`);
    setFeedback("PDF exportado.", "success");
  }

  function fecharDetalhes() {
    if (cardDetalhes) cardDetalhes.style.display = "none";
    if (tbodyDetalhes) tbodyDetalhes.innerHTML = "";
    if (mesSelecionado) mesSelecionado.textContent = "";
    dadosDetalhesAtual = { mes: "", items: [], resumo: null };

    if (detEntradasPagas) detEntradasPagas.textContent = "—";
    if (detEntradasPend) detEntradasPend.textContent = "—";
    if (detTotalEntradas) detTotalEntradas.textContent = "—";
    if (detSaidas) detSaidas.textContent = "—";
    if (detResultado) detResultado.textContent = "—";

    if (detPix) detPix.textContent = "—";
    if (detDinheiro) detDinheiro.textContent = "—";
    if (detCredito) detCredito.textContent = "—";
    if (detDebito) detDebito.textContent = "—";
    if (detOutros) detOutros.textContent = "—";

    // Inst + Titularidade
    if (detNubankPF) detNubankPF.textContent = "—";
    if (detNubankPJ) detNubankPJ.textContent = "—";
    if (detPicPayPF) detPicPayPF.textContent = "—";
    if (detPicPayPJ) detPicPayPJ.textContent = "—";
    if (detSumUpPF) detSumUpPF.textContent = "—";
    if (detSumUpPJ) detSumUpPJ.textContent = "—";
    if (detTerceiroPF) detTerceiroPF.textContent = "—";
    if (detTerceiroPJ) detTerceiroPJ.textContent = "—";
    if (detDinheiroPF) detDinheiroPF.textContent = "—";
    if (detDinheiroPJ) detDinheiroPJ.textContent = "—";
    if (detCortesiaPF) detCortesiaPF.textContent = "—";
    if (detCortesiaPJ) detCortesiaPJ.textContent = "—";
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

    // Imprimir detalhes
    const btnImprimirDetalhes = document.getElementById("btnImprimirDetalhes");
    if (btnImprimirDetalhes) btnImprimirDetalhes.addEventListener("click", (e) => {
      e.preventDefault();
      window.print();
    });

    // Exportar PDF detalhes
    const btnExportDetalhesPDF = document.getElementById("btnExportDetalhesPDF");
    if (btnExportDetalhesPDF) btnExportDetalhesPDF.addEventListener("click", (e) => {
      e.preventDefault();
      if (!dadosDetalhesAtual.items.length) {
        setFeedback("Nenhum dado para exportar.", "error");
        return;
      }
      exportarDetalhesPDF(dadosDetalhesAtual);
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
