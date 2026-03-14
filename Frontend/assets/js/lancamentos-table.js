// lancamentos-table.js — Renderização de tabela, paginação, carregamento por aba, resumo
// Requer: lancamentos-form.js (registrado antes)
(() => {
  "use strict";

  function register(ctx) {
    const { el, dom, state, helpers, form } = ctx;
    const { escapeHtml, hojeISO, formatMoneyBR, toNumberBR, formatDateBR, formatMesDisplay, getMesAtualYYYYMM, setFeedback, skeletonRows, showToast, jsonpRequest, toISODate, requireScriptUrl, SHEET_NAME } = helpers;

    // ============================================================
    // RESUMO RAPIDO
    // ============================================================
    function atualizarResumoRapido(items) {
      const resumoEl = document.getElementById("resumoRapido");
      const entradasEl = document.getElementById("resumoEntradas");
      const saidasEl = document.getElementById("resumoSaidas");
      const pendentesEl = document.getElementById("resumoPendentes");
      const saldoEl = document.getElementById("resumoSaldo");

      if (!resumoEl) return;

      let entradas = 0, saidas = 0, pendentes = 0;

      items.forEach(it => {
        const valor = toNumberBR(it.Valor);
        if (it.Status === "Cancelado") return;
        if (it.Tipo === "Entrada") {
          if (it.Status === "Pago") entradas += valor;
          else if (it.Status === "Pendente") pendentes += valor;
        } else if (it.Tipo === "Saida") {
          saidas += valor;
        }
      });

      const saldo = entradas - saidas;

      if (entradasEl) entradasEl.textContent = formatMoneyBR(entradas);
      if (saidasEl) saidasEl.textContent = formatMoneyBR(saidas);
      if (pendentesEl) pendentesEl.textContent = formatMoneyBR(pendentes);
      if (saldoEl) {
        saldoEl.textContent = formatMoneyBR(saldo);
        saldoEl.style.color = saldo >= 0 ? "#228b22" : "#c41e3a";
      }

      resumoEl.style.display = items.length > 0 ? "grid" : "none";
    }

    // ============================================================
    // RENDER TABLE HELPERS
    // ============================================================
    function getClienteFornecedor(it) {
      if (it.Tipo === "Entrada") return it.NomeCliente || it.ID_Cliente || "";
      if (it.Tipo === "Saida") return it.NomeFornecedor || it.ID_Fornecedor || "";
      return it.NomeCliente || it.ID_Cliente || it.NomeFornecedor || it.ID_Fornecedor || "";
    }

    function sortItems(items) {
      if (!state.sortCol) return items;
      return [...items].sort((a, b) => {
        let va = a[state.sortCol] ?? "";
        let vb = b[state.sortCol] ?? "";
        if (state.sortCol === "Valor") {
          va = toNumberBR(va);
          vb = toNumberBR(vb);
        } else {
          va = String(va).toLowerCase();
          vb = String(vb).toLowerCase();
        }
        let cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return state.sortDir === "desc" ? -cmp : cmp;
      });
    }

    function criarLinhaTabela(it, options = {}) {
      const tr = document.createElement("tr");
      tr.dataset.rowIndex = String(it.rowIndex ?? "");

      const tipoClass = it.Tipo === "Entrada" ? "tipo-entrada" : it.Tipo === "Saida" ? "tipo-saida" : "";
      const statusClass = it.Status === "Pago" ? "status-pago" : it.Status === "Pendente" ? "status-pendente" : it.Status === "Cancelado" ? "status-cancelado" : "";
      const valorClass = it.Tipo === "Entrada" ? "valor-positivo" : it.Tipo === "Saida" ? "valor-negativo" : "";

      if (options.showAcoes) {
        tr.innerHTML = `
          <td>${escapeHtml(formatDateBR(it.Data_Competencia) || "")}</td>
          <td class="${tipoClass}">${escapeHtml(it.Tipo || "")}</td>
          <td>${escapeHtml(it.Categoria || "")}</td>
          <td title="${escapeHtml(it.Descricao || "")}">${escapeHtml((it.Descricao || "").substring(0, 25))}${(it.Descricao || "").length > 25 ? "..." : ""}</td>
          <td>${escapeHtml(getClienteFornecedor(it))}</td>
          <td class="${valorClass}">${escapeHtml(formatMoneyBR(it.Valor))}</td>
          <td>${escapeHtml(it.Mes_a_receber ? formatMesDisplay(toISODate(it.Mes_a_receber).substring(0, 7)) : "")}</td>
          <td class="acoes-linha"></td>
        `;
        const tdAcoes = tr.querySelector(".acoes-linha");

        const btnPago = document.createElement("button");
        btnPago.type = "button";
        btnPago.className = "btn-pago-rapido";
        btnPago.textContent = "Pago";
        btnPago.addEventListener("click", (e) => {
          e.stopPropagation();
          marcarPagoRapido(it);
        });
        tdAcoes.appendChild(btnPago);

        const btnEditar = document.createElement("button");
        btnEditar.type = "button";
        btnEditar.className = "btn-editar-rapido";
        btnEditar.textContent = "Editar";
        btnEditar.addEventListener("click", (e) => {
          e.stopPropagation();
          form.fillForm(it);
        });
        tdAcoes.appendChild(btnEditar);
      } else {
        tr.innerHTML = `
          <td>${escapeHtml(formatDateBR(it.Data_Competencia) || "")}</td>
          <td class="${tipoClass}">${escapeHtml(it.Tipo || "")}</td>
          <td>${escapeHtml(it.Categoria || "")}</td>
          <td title="${escapeHtml(it.Descricao || "")}">${escapeHtml((it.Descricao || "").substring(0, 30))}${(it.Descricao || "").length > 30 ? "..." : ""}</td>
          <td>${escapeHtml(getClienteFornecedor(it))}</td>
          <td>${escapeHtml(it.Forma_Pagamento || "")}</td>
          <td class="${valorClass}">${escapeHtml(formatMoneyBR(it.Valor))}</td>
          <td class="${statusClass}">${escapeHtml(it.Status || "")}</td>
        `;
      }

      tr.addEventListener("click", () => { form.fillForm(it); });

      return tr;
    }

    function renderTableInto(tbody, items, options = {}) {
      if (!tbody) return;
      tbody.innerHTML = "";

      if (!Array.isArray(items) || items.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="8">Nenhum lancamento encontrado.</td>`;
        tbody.appendChild(tr);
        return;
      }

      const sorted = sortItems(items);
      sorted.forEach((it) => {
        tbody.appendChild(criarLinhaTabela(it, options));
      });
    }

    // ============================================================
    // CARREGAR MES
    // ============================================================
    async function carregarMes() {
      if (!requireScriptUrl()) return;

      const mesValue = dom.mesSelecionadoInput?.value || getMesAtualYYYYMM();
      if (dom.mesSelecionadoInput && !dom.mesSelecionadoInput.value) {
        dom.mesSelecionadoInput.value = getMesAtualYYYYMM();
      }

      const [ano, mes] = mesValue.split("-");
      const dataIni = `${ano}-${mes}-01`;
      const ultimoDia = new Date(Number(ano), Number(mes), 0).getDate();
      const dataFim = `${ano}-${mes}-${String(ultimoDia).padStart(2, "0")}`;

      setFeedback(dom.feedbackMes, "Carregando...", "info");
      if (dom.tbodyMes) dom.tbodyMes.innerHTML = skeletonRows(5, 8);

      try {
        const data = await jsonpRequest({
          action: "Lancamentos.Listar",
          sheet: SHEET_NAME,
          filtros: JSON.stringify({ fDataIni: dataIni, fDataFim: dataFim }),
          page: 1,
          limit: 500
        });

        if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao listar.");

        state.dadosMesAtual = data.items || [];
        renderTableInto(dom.tbodyMes, state.dadosMesAtual);
        atualizarResumoRapido(state.dadosMesAtual);

        const total = data.pagination?.total || state.dadosMesAtual.length;
        setFeedback(dom.feedbackMes, `${total} lancamento(s) em ${formatMesDisplay(mesValue)}`, "success");
      } catch (err) {
        setFeedback(dom.feedbackMes, err.message || "Erro ao carregar.", "error");
      }
    }

    // ============================================================
    // CARREGAR PENDENTES
    // ============================================================
    async function carregarPendentes() {
      if (!requireScriptUrl()) return;

      setFeedback(dom.feedbackPendentes, "Carregando pendentes...", "info");
      if (dom.tbodyPendentes) dom.tbodyPendentes.innerHTML = skeletonRows(5, 8);

      try {
        const data = await jsonpRequest({
          action: "Lancamentos.Listar",
          sheet: SHEET_NAME,
          filtros: JSON.stringify({ fStatus: "Pendente" }),
          page: 1,
          limit: 500
        });

        if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao listar.");

        state.dadosPendentesAtual = data.items || [];
        renderTableInto(dom.tbodyPendentes, state.dadosPendentesAtual, { showAcoes: true });

        const total = data.pagination?.total || state.dadosPendentesAtual.length;
        if (dom.badgePendentes) {
          dom.badgePendentes.textContent = String(total);
          dom.badgePendentes.style.display = total > 0 ? "inline-block" : "none";
        }

        setFeedback(dom.feedbackPendentes, `${total} pendente(s)`, "success");
      } catch (err) {
        setFeedback(dom.feedbackPendentes, err.message || "Erro.", "error");
      }
    }

    // ============================================================
    // MARCAR PAGO RAPIDO
    // ============================================================
    async function marcarPagoRapido(it) {
      if (!it?.rowIndex) return;

      const payload = {
        Data_Competencia: it.Data_Competencia || "",
        Data_Caixa: it.Data_Caixa || hojeISO(),
        Tipo: it.Tipo || "",
        Origem: it.Origem || "",
        Categoria: it.Categoria || "",
        Descricao: it.Descricao || "",
        ID_Cliente: it.ID_Cliente || "",
        ID_Fornecedor: it.ID_Fornecedor || "",
        Forma_Pagamento: it.Forma_Pagamento || "",
        Instituicao_Financeira: it.Instituicao_Financeira || "",
        Titularidade: it.Titularidade || "",
        Parcelamento: it.Parcelamento || "",
        Valor: it.Valor || "",
        Status: "Pago",
        Observacoes: it.Observacoes || "",
        Mes_a_receber: it.Mes_a_receber || "",
      };

      if (!payload.Data_Caixa) payload.Data_Caixa = hojeISO();

      try {
        const data = await jsonpRequest({
          action: "Lancamentos.Editar",
          sheet: SHEET_NAME,
          payload: JSON.stringify({ rowIndex: it.rowIndex, data: payload }),
        });
        if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao marcar pago.");

        await carregarPendentes();
        if (state.abaAtiva === "pendentes") {
          carregarMes().catch(() => {});
        }
      } catch (err) {
        setFeedback(dom.feedbackPendentes, err.message || "Erro.", "error");
      }
    }

    // ============================================================
    // LISTAR TODOS (com filtros e paginacao)
    // ============================================================
    function buildFiltros() {
      return {
        fDataIni: (dom.fDataIni?.value || "").trim(),
        fDataFim: (dom.fDataFim?.value || "").trim(),
        fTipo: (dom.fTipo?.value || "").trim(),
        fStatus: (dom.fStatus?.value || "").trim(),
        fCategoria: (dom.fCategoria?.value || "").trim(),
        fFormaPagamento: (dom.fFormaPagamento?.value || "").trim(),
        fInstituicao: (dom.fInstituicao?.value || "").trim(),
        fTitularidade: (dom.fTitularidade?.value || "").trim(),
        q: (dom.fQ?.value || "").trim(),
      };
    }

    function syncFiltersToURL() {
      const params = new URLSearchParams();
      const fields = { fDataIni: dom.fDataIni, fDataFim: dom.fDataFim, fTipo: dom.fTipo, fStatus: dom.fStatus, fCategoria: dom.fCategoria, fFormaPagamento: dom.fFormaPagamento, fInstituicao: dom.fInstituicao, fTitularidade: dom.fTitularidade, q: dom.fQ };
      Object.keys(fields).forEach(function(key) {
        const val = (fields[key]?.value || "").trim();
        if (val) params.set(key, val);
      });
      const qs = params.toString();
      const newUrl = window.location.pathname + (qs ? "?" + qs : "");
      history.replaceState(null, "", newUrl);
    }

    function loadFiltersFromURL() {
      const params = new URLSearchParams(window.location.search);
      if (dom.fDataIni && params.get("fDataIni")) dom.fDataIni.value = params.get("fDataIni");
      if (dom.fDataFim && params.get("fDataFim")) dom.fDataFim.value = params.get("fDataFim");
      if (dom.fTipo && params.get("fTipo")) dom.fTipo.value = params.get("fTipo");
      if (dom.fStatus && params.get("fStatus")) dom.fStatus.value = params.get("fStatus");
      if (dom.fCategoria && params.get("fCategoria")) dom.fCategoria.value = params.get("fCategoria");
      if (dom.fFormaPagamento && params.get("fFormaPagamento")) dom.fFormaPagamento.value = params.get("fFormaPagamento");
      if (dom.fInstituicao && params.get("fInstituicao")) dom.fInstituicao.value = params.get("fInstituicao");
      if (dom.fTitularidade && params.get("fTitularidade")) dom.fTitularidade.value = params.get("fTitularidade");
      if (dom.fQ && params.get("q")) dom.fQ.value = params.get("q");
    }

    async function listarTodos(page = 1) {
      if (!requireScriptUrl()) return;

      setFeedback(dom.feedbackLanc, "Carregando...", "info");
      if (dom.tbodyTodos) dom.tbodyTodos.innerHTML = skeletonRows(5, 8);
      try {
        const filtros = buildFiltros();
        syncFiltersToURL();
        const data = await jsonpRequest({
          action: "Lancamentos.Listar",
          sheet: SHEET_NAME,
          filtros: JSON.stringify(filtros),
          page: page,
          limit: state._pageSize
        });

        if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao listar.");

        state.dadosListaAtual = data.items || [];
        renderTableInto(dom.tbodyTodos, state.dadosListaAtual);

        const pagination = data.pagination || { page: 1, totalPages: 1, total: 0 };
        state.paginaAtual = pagination.page;
        state.totalPaginas = pagination.totalPages;
        atualizarControlesPaginacao(pagination);

        setFeedback(dom.feedbackLanc, `${state.dadosListaAtual.length} de ${pagination.total} itens`, "success");
      } catch (err) {
        setFeedback(dom.feedbackLanc, err.message || "Erro ao listar.", "error");
      }
    }

    function atualizarControlesPaginacao(pagination) {
      const container = document.getElementById("paginationLancamentos");
      if (!container) return;
      const page = pagination.page || 1;
      const pages = pagination.totalPages || 1;
      const total = pagination.total || 0;

      let html = "";

      html += '<div class="pagination__per-page"><label>Itens:</label><select id="selPageSize">';
      [10, 25, 50, 100].forEach(function(n) {
        html += '<option value="' + n + '"' + (n === state._pageSize ? ' selected' : '') + '>' + n + '</option>';
      });
      html += '</select></div>';

      html += '<button class="pagination__btn" data-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>&laquo;</button>';

      buildPageRange(page, pages).forEach(function(p) {
        if (p === "...") {
          html += '<span class="pagination__ellipsis">...</span>';
        } else {
          html += '<button class="pagination__btn' + (p === page ? ' pagination__btn--active' : '') + '" data-page="' + p + '">' + p + '</button>';
        }
      });

      html += '<button class="pagination__btn" data-page="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + '>&raquo;</button>';
      html += '<span class="pagination__info">Total: ' + total + '</span>';

      container.innerHTML = html;

      container.querySelectorAll(".pagination__btn[data-page]").forEach(function(btn) {
        btn.addEventListener("click", function(e) {
          e.preventDefault();
          const p = parseInt(btn.dataset.page, 10);
          if (p >= 1 && p <= pages) listarTodos(p);
        });
      });

      const selPageSize = document.getElementById("selPageSize");
      if (selPageSize) {
        selPageSize.addEventListener("change", function() {
          state._pageSize = parseInt(selPageSize.value, 10) || 25;
          state.paginaAtual = 1;
          listarTodos(1);
        });
      }
    }

    function buildPageRange(current, total) {
      if (total <= 7) {
        const arr = [];
        for (let i = 1; i <= total; i++) arr.push(i);
        return arr;
      }
      const pages = [1];
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      if (start > 2) pages.push("...");
      for (let j = start; j <= end; j++) pages.push(j);
      if (end < total - 1) pages.push("...");
      pages.push(total);
      return pages;
    }

    // ============================================================
    // SORT
    // ============================================================
    function updateSortIcons(table) {
      if (!table) return;
      table.querySelectorAll("th.sortable").forEach(th => {
        th.classList.remove("sort-asc", "sort-desc");
        if (th.dataset.col === state.sortCol) {
          th.classList.add(state.sortDir === "asc" ? "sort-asc" : "sort-desc");
        }
      });
    }

    function handleSort(col) {
      if (state.sortCol === col) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortCol = col;
        state.sortDir = "asc";
      }

      if (state.abaAtiva === "mes") {
        renderTableInto(dom.tbodyMes, state.dadosMesAtual);
        updateSortIcons(dom.tabelaMes);
      } else if (state.abaAtiva === "todos") {
        renderTableInto(dom.tbodyTodos, state.dadosListaAtual);
        updateSortIcons(dom.tabelaTodos);
      }
    }

    function bindSortHeaders() {
      [dom.tabelaMes, dom.tabelaTodos].forEach(table => {
        if (!table) return;
        table.querySelectorAll("th.sortable").forEach(th => {
          th.style.cursor = "pointer";
          th.addEventListener("click", () => {
            const col = th.dataset.col;
            if (col) handleSort(col);
          });
        });
      });
    }

    // Expose
    ctx.table = {
      carregarMes, carregarPendentes, listarTodos,
      renderTableInto, sortItems, getClienteFornecedor,
      atualizarResumoRapido, bindSortHeaders,
      loadFiltersFromURL, syncFiltersToURL, buildFiltros,
      limparFiltro() {
        if (dom.formFiltro) dom.formFiltro.reset();
        history.replaceState(null, "", window.location.pathname);
        setFeedback(dom.feedbackLanc, "", "info");
        state.paginaAtual = 1;
        listarTodos(1);
      },
    };
  }

  window._LancTableRegister = register;
})();
