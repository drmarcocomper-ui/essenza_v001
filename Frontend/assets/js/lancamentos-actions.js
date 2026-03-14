// lancamentos-actions.js — Recorrentes, exclusão, ações rápidas, export, navegação
// Requer: lancamentos-form.js, lancamentos-table.js (registrados antes)
(() => {
  "use strict";

  function register(ctx) {
    const { el, dom, state, helpers, form, table } = ctx;
    const { escapeHtml, hojeISO, formatMoneyBR, toNumberBR, formatDateBR, formatMesDisplay, getMesAtualYYYYMM, setFeedback, skeletonRows, showToast, jsonpRequest, toISODate, parseToYYYYMM, parseParcelCount, requireScriptUrl, SHEET_NAME } = helpers;

    // ============================================================
    // RECORRENTES
    // ============================================================
    let dadosRecorrentes = [];
    let recorrenteEditando = null;

    async function carregarRecorrentes() {
      const tbodyRec = document.querySelector("#tabelaRecorrentes tbody");
      const fbRec = document.getElementById("feedbackRecorrentes");
      if (!tbodyRec) return;
      tbodyRec.innerHTML = skeletonRows(3, 8);

      try {
        const data = await jsonpRequest({ action: "Recorrentes.Listar" });
        if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao listar recorrentes.");

        dadosRecorrentes = data.items || [];
        tbodyRec.innerHTML = "";

        if (!dadosRecorrentes.length) {
          tbodyRec.innerHTML = '<tr><td colspan="8">Nenhum template recorrente.</td></tr>';
          setFeedback(fbRec, "", "info");
          return;
        }

        dadosRecorrentes.forEach(function(it) {
          const tr = document.createElement("tr");
          tr.innerHTML =
            '<td>' + escapeHtml(it.Tipo || "") + '</td>' +
            '<td>' + escapeHtml(it.Categoria || "") + '</td>' +
            '<td>' + escapeHtml(it.Descricao || "") + '</td>' +
            '<td>' + formatMoneyBR(it.Valor) + '</td>' +
            '<td>' + escapeHtml(it.Frequencia || "") + '</td>' +
            '<td>' + escapeHtml(it.Dia_Vencimento || "") + '</td>' +
            '<td>' + escapeHtml(it.Ativo || "") + '</td>' +
            '<td><button class="btn btn--secondary btn-edit-rec" data-row="' + it.rowIndex + '" style="font-size:.75rem;padding:.25rem .5rem;">Editar</button> ' +
            '<button class="btn btn--danger btn-del-rec" data-row="' + it.rowIndex + '" style="font-size:.75rem;padding:.25rem .5rem;">Excluir</button></td>';
          tbodyRec.appendChild(tr);
        });

        tbodyRec.querySelectorAll(".btn-edit-rec").forEach(function(btn) {
          btn.addEventListener("click", function() {
            const ri = parseInt(btn.dataset.row, 10);
            const item = dadosRecorrentes.find(function(x) { return x.rowIndex === ri; });
            if (item) editarRecorrente(item);
          });
        });
        tbodyRec.querySelectorAll(".btn-del-rec").forEach(function(btn) {
          btn.addEventListener("click", function() {
            const ri = parseInt(btn.dataset.row, 10);
            excluirRecorrente(ri);
          });
        });

        setFeedback(fbRec, dadosRecorrentes.length + " template(s)", "success");
      } catch (err) {
        tbodyRec.innerHTML = "";
        setFeedback(fbRec, err.message || "Erro.", "error");
      }
    }

    function abrirFormRecorrencia(item) {
      const formRec = document.getElementById("formRecorrencia");
      const titulo = document.getElementById("tituloRecorrencia");
      if (!formRec) return;

      formRec.style.display = "block";
      recorrenteEditando = item || null;

      if (titulo) titulo.textContent = item ? "Editar Recorrencia" : "Nova Recorrencia";

      document.getElementById("recTipo").value = item?.Tipo || "Saida";
      document.getElementById("recCategoria").value = item?.Categoria || "";
      document.getElementById("recDescricao").value = item?.Descricao || "";
      document.getElementById("recValor").value = item?.Valor || "";
      document.getElementById("recFrequencia").value = item?.Frequencia || "Mensal";
      document.getElementById("recDiaVencimento").value = item?.Dia_Vencimento || "1";
      document.getElementById("recFormaPagamento").value = item?.Forma_Pagamento || "";
      document.getElementById("recAtivo").value = item?.Ativo || "Sim";
    }

    function fecharFormRecorrencia() {
      const formRec = document.getElementById("formRecorrencia");
      if (formRec) formRec.style.display = "none";
      recorrenteEditando = null;
    }

    function editarRecorrente(item) {
      abrirFormRecorrencia(item);
    }

    async function salvarRecorrente() {
      const payload = {
        Tipo: document.getElementById("recTipo")?.value || "Saida",
        Categoria: document.getElementById("recCategoria")?.value || "",
        Descricao: document.getElementById("recDescricao")?.value || "",
        Valor: document.getElementById("recValor")?.value || "0",
        Frequencia: document.getElementById("recFrequencia")?.value || "Mensal",
        Dia_Vencimento: document.getElementById("recDiaVencimento")?.value || "1",
        Forma_Pagamento: document.getElementById("recFormaPagamento")?.value || "",
        Ativo: document.getElementById("recAtivo")?.value || "Sim"
      };

      if (!payload.Descricao) {
        showToast("Preencha a descricao.", { type: "error", duration: 3000 });
        return;
      }

      try {
        let action;
        if (recorrenteEditando) {
          payload.rowIndex = recorrenteEditando.rowIndex;
          payload.data = payload;
          action = "Recorrentes.Editar";
        } else {
          action = "Recorrentes.Criar";
        }

        const data = await jsonpRequest({
          action: action,
          payload: JSON.stringify(payload)
        });

        if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao salvar.");

        showToast(data.message || "Salvo!", { type: "success", duration: 3000 });
        fecharFormRecorrencia();
        carregarRecorrentes();
      } catch (err) {
        showToast(err.message || "Erro ao salvar.", { type: "error", duration: 4000 });
      }
    }

    async function excluirRecorrente(rowIndex) {
      if (!confirm("Excluir este template recorrente?")) return;
      try {
        const data = await jsonpRequest({ action: "Recorrentes.Excluir", rowIndex: rowIndex });
        if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao excluir.");
        showToast("Template excluido.", { type: "success", duration: 3000 });
        carregarRecorrentes();
      } catch (err) {
        showToast(err.message || "Erro.", { type: "error" });
      }
    }

    async function gerarRecorrentes() {
      if (!confirm("Gerar lancamentos pendentes do mes atual a partir dos templates ativos?")) return;
      try {
        const data = await jsonpRequest({ action: "Recorrentes.Gerar" });
        if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao gerar.");
        showToast(data.message || "Gerado!", { type: "success", duration: 5000 });
      } catch (err) {
        showToast(err.message || "Erro ao gerar.", { type: "error" });
      }
    }

    // ============================================================
    // SALVAR (criar / editar)
    // ============================================================
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
      if (state.selectedRowIndex) return true;
      const n = parseParcelCount(payload.Parcelamento);
      if (!n || n < 2) return true;
      const total = toNumberBR(payload.Valor);
      const each = n ? total / n : 0;
      const base = payload.Data_Caixa || payload.Data_Competencia;
      const msg =
        `Parcelamento = ${n}\n\n` +
        `Serao criadas ${n} parcelas (1/${n}...${n}/${n}).\n` +
        `Total: ${formatMoneyBR(total)}\n` +
        `Aprox/parcela: ${formatMoneyBR(each)}\n` +
        `Data base: ${base || "(vazia)"}\n\n` +
        `Continuar?`;
      return window.confirm(msg);
    }

    async function salvar() {
      if (state._saving) return;
      state._saving = true;
      try {
        if (!requireScriptUrl()) return;
        form.aplicarDescricaoDaCategoria(false);
        const payload = form.buildLancPayload();
        if (!(await form.validateRequired(payload))) return;
        if (!confirmParcelamentoSeNovo(payload)) {
          setFeedback(dom.feedbackSalvar, "Operacao cancelada.", "info");
          return;
        }

        setFeedback(dom.feedbackSalvar, "Salvando...", "info");
        const desc = payload.Descricao || "";
        const valor = payload.Valor || "";
        if (state.selectedRowIndex && Number(state.selectedRowIndex) >= 2) {
          const resp = await editar(state.selectedRowIndex, payload);
          setFeedback(dom.feedbackSalvar, (resp.message || "Atualizado!"), "success");
          showToast("Lancamento atualizado: " + desc + (valor ? " - R$ " + valor : ""), { type: "success", duration: 5000 });
        } else {
          const resp = await criar(payload);
          setFeedback(dom.feedbackSalvar, (resp.message || "Salvo!"), "success");
          showToast("Lancamento salvo: " + desc + (valor ? " - R$ " + valor : ""), { type: "success", duration: 5000 });
        }
        form.clearForm();
        await recarregarAbaAtiva();
      } catch (err) {
        const msg = err.message || "Erro ao salvar.";
        setFeedback(dom.feedbackSalvar, msg, "error");
        showToast(msg, { type: "error", duration: 5000 });
      } finally {
        state._saving = false;
      }
    }

    async function recarregarAbaAtiva() {
      if (state.abaAtiva === "mes") {
        await table.carregarMes();
        table.carregarPendentes().catch(() => {});
      } else if (state.abaAtiva === "pendentes") {
        await table.carregarPendentes();
        table.carregarMes().catch(() => {});
      } else {
        await table.listarTodos(state.paginaAtual);
        table.carregarPendentes().catch(() => {});
      }
    }

    // ============================================================
    // EXCLUIR
    // ============================================================
    function abrirModalExcluir() {
      if (!dom.modalExcluir || !state.selectedRowIndex) return;
      const desc = el.Descricao?.value || "";
      const valor = el.Valor?.value || "";
      const data = el.Data_Competencia?.value || "";
      if (dom.modalExcluirInfo) {
        dom.modalExcluirInfo.textContent = `${data} - ${desc} - R$ ${valor}`;
      }
      dom.modalExcluir.classList.add("is-open");
    }

    function fecharModalExcluir() {
      if (dom.modalExcluir) dom.modalExcluir.classList.remove("is-open");
    }

    async function confirmarExcluir() {
      if (!state.selectedRowIndex) return;
      const rowIdx = state.selectedRowIndex;
      const desc = el.Descricao?.value || "";
      const valor = el.Valor?.value || "";
      fecharModalExcluir();
      form.fecharFormulario();

      setFeedback(dom.feedbackLanc, "Excluindo...", "info");

      try {
        const data = await jsonpRequest({
          action: "Lancamentos.Excluir",
          sheet: SHEET_NAME,
          rowIndex: rowIdx
        });
        if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao excluir.");

        showToast("Lancamento excluido: " + (desc || "item") + (valor ? " - R$ " + valor : ""), {
          type: "success",
          duration: 5000
        });
        setFeedback(dom.feedbackLanc, "Lancamento excluido com sucesso.", "success");
        await recarregarAbaAtiva();
      } catch (err) {
        showToast(err.message || "Erro ao excluir.", { type: "error" });
        setFeedback(dom.feedbackLanc, err.message || "Erro ao excluir.", "error");
      }
    }

    // ============================================================
    // ACOES RAPIDAS
    // ============================================================
    function duplicarLancamento() {
      if (!state.itemAtualEdicao) return;
      state.selectedRowIndex = null;
      if (dom.tituloFormulario) dom.tituloFormulario.textContent = "Duplicar Lancamento";
      if (dom.descFormulario) dom.descFormulario.textContent = "Copia criada. Altere os dados e salve.";
      if (el.Data_Competencia) el.Data_Competencia.value = hojeISO();
      if (el.Data_Caixa) el.Data_Caixa.value = "";
      if (dom.btnNovo) dom.btnNovo.style.display = "none";
      if (dom.btnDuplicar) dom.btnDuplicar.style.display = "none";
      if (dom.btnExcluir) dom.btnExcluir.style.display = "none";
      if (dom.btnMarcarPago) dom.btnMarcarPago.style.display = "none";
      if (dom.btnCancelarLanc) dom.btnCancelarLanc.style.display = "none";
      setFeedback(dom.feedbackSalvar, "Lancamento duplicado. Clique em Salvar para criar.", "info");
    }

    async function marcarComoPago() {
      if (!state.selectedRowIndex) return;
      el.Status.value = "Pago";
      if (!el.Data_Caixa.value) el.Data_Caixa.value = hojeISO();
      setFeedback(dom.feedbackSalvar, "Salvando como Pago...", "info");
      await salvar();
    }

    async function cancelarLancamento() {
      if (!state.selectedRowIndex) return;
      if (!confirm("Deseja marcar este lancamento como Cancelado?")) return;
      el.Status.value = "Cancelado";
      setFeedback(dom.feedbackSalvar, "Cancelando lancamento...", "info");
      await salvar();
    }

    // ============================================================
    // MES NAVEGACAO
    // ============================================================
    function navegarMes(delta) {
      const valor = dom.mesSelecionadoInput?.value || getMesAtualYYYYMM();
      const [ano, mes] = valor.split("-").map(Number);
      const d = new Date(ano, mes - 1 + delta, 1);
      const novoMes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (dom.mesSelecionadoInput) dom.mesSelecionadoInput.value = novoMes;
      table.carregarMes();
    }

    // ============================================================
    // IMPRIMIR / EXPORTAR MES
    // ============================================================
    function imprimirMes() {
      const mesValue = dom.mesSelecionadoInput?.value || getMesAtualYYYYMM();
      const printTitulo = document.getElementById("printTitulo");
      const printSubtitulo = document.getElementById("printSubtitulo");

      if (printTitulo) printTitulo.textContent = `Lancamentos - ${formatMesDisplay(mesValue)}`;
      if (printSubtitulo) printSubtitulo.textContent = `Gerado em ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`;

      window.print();
    }

    function exportarMesPDF() {
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) {
        setFeedback(dom.feedbackMes, "jsPDF nao carregado.", "error");
        return;
      }
      if (!state.dadosMesAtual.length) {
        setFeedback(dom.feedbackMes, "Nenhum dado para exportar.", "error");
        return;
      }

      const mesValue = dom.mesSelecionadoInput?.value || getMesAtualYYYYMM();
      const doc = new jsPDF({ orientation: "landscape" });

      doc.setFontSize(16);
      doc.text(`Lancamentos - ${formatMesDisplay(mesValue)}`, 14, 15);

      let entradas = 0, saidas = 0, pendentes = 0;
      state.dadosMesAtual.forEach(it => {
        const valor = toNumberBR(it.Valor);
        if (it.Status === "Cancelado") return;
        if (it.Tipo === "Entrada") {
          if (it.Status === "Pago") entradas += valor;
          else if (it.Status === "Pendente") pendentes += valor;
        } else if (it.Tipo === "Saida") saidas += valor;
      });

      doc.setFontSize(10);
      doc.text(`Entradas: ${formatMoneyBR(entradas)}`, 14, 24);
      doc.text(`Saidas: ${formatMoneyBR(saidas)}`, 80, 24);
      doc.text(`Pendentes: ${formatMoneyBR(pendentes)}`, 140, 24);
      doc.text(`Saldo: ${formatMoneyBR(entradas - saidas)}`, 200, 24);

      const headers = ["Data", "Tipo", "Categoria", "Descricao", "Cliente/Forn.", "Pagamento", "Valor", "Status"];
      const rows = table.sortItems(state.dadosMesAtual).map(it => [
        formatDateBR(it.Data_Competencia),
        it.Tipo || "",
        it.Categoria || "",
        (it.Descricao || "").substring(0, 25),
        table.getClienteFornecedor(it),
        it.Forma_Pagamento || "",
        formatMoneyBR(it.Valor),
        it.Status || ""
      ]);

      doc.autoTable({
        head: [headers],
        body: rows,
        startY: 30,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [139, 92, 165] }
      });

      doc.save(`Lancamentos_${mesValue}.pdf`);
      setFeedback(dom.feedbackMes, "PDF exportado.", "success");
    }

    // Expose
    ctx.actions = {
      salvar, recarregarAbaAtiva,
      abrirModalExcluir, fecharModalExcluir, confirmarExcluir,
      duplicarLancamento, marcarComoPago, cancelarLancamento,
      navegarMes, imprimirMes, exportarMesPDF,
      carregarRecorrentes, abrirFormRecorrencia, fecharFormRecorrencia,
      salvarRecorrente, gerarRecorrentes,
    };
  }

  window._LancActionsRegister = register;
})();
