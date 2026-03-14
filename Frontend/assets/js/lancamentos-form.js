// lancamentos-form.js — Formulário, autocompletes, categorias, validação
// Requer: lancamentos.js (carrega depois — registra funções em window.LancCtx)
(() => {
  "use strict";

  function register(ctx) {
    const { el, dom, state, helpers } = ctx;
    const { escapeHtml, hojeISO, formatMoneyBR, toNumberBR, formatDateBR, formatMesDisplay, getMesAtualYYYYMM, setFeedback, skeletonRows, showToast, jsonpRequest, toISODate, parseParcelCount, requireScriptUrl, SHEET_NAME } = helpers;

    // ============================================================
    // DESCRICOES (datalist)
    // ============================================================
    function clearDescricoesDatalist() {
      if (!dom.datalistDescricoes) return;
      dom.datalistDescricoes.innerHTML = "";
    }

    function renderDescricoesFromPadrao(padroes) {
      clearDescricoesDatalist();
      if (!dom.datalistDescricoes) return;
      const all = Array.isArray(padroes) ? padroes : [padroes];
      const parts = [];
      all.forEach((raw) => {
        String(raw || "").split(/\r?\n|[|;,]/g).map((s) => s.trim()).filter(Boolean).forEach((s) => parts.push(s));
      });
      const uniq = new Set(parts);
      [...uniq].slice(0, 80).forEach((txt) => {
        const opt = document.createElement("option");
        opt.value = txt;
        dom.datalistDescricoes.appendChild(opt);
      });
    }

    // ============================================================
    // CATEGORIAS
    // ============================================================
    function getTipoAtual() {
      return String(el.Tipo?.value || "").trim();
    }

    function clearCategoriasDatalist() {
      if (!dom.datalistCategorias) return;
      dom.datalistCategorias.innerHTML = "";
    }

    function renderCategoriasDatalist(items) {
      if (!dom.datalistCategorias) return;
      clearCategoriasDatalist();
      const set = new Set();
      (items || []).forEach((it) => {
        const cat = String(it?.Categoria || "").trim();
        if (cat) set.add(cat);
      });
      [...set].slice(0, 200).forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat;
        dom.datalistCategorias.appendChild(opt);
      });
      if (dom.datalistCategoriasF) {
        dom.datalistCategoriasF.innerHTML = "";
        [...set].slice(0, 200).forEach((cat) => {
          const opt = document.createElement("option");
          opt.value = cat;
          dom.datalistCategoriasF.appendChild(opt);
        });
      }
    }

    async function carregarCategoriasAtivas(tipo) {
      if (!requireScriptUrl()) return;
      const filtros = { somenteAtivos: "1" };
      if (tipo) filtros.fTipo = tipo;
      const data = await jsonpRequest({
        action: "Categoria.Listar",
        sheet: "Categoria",
        filtros: JSON.stringify(filtros),
      });
      if (!data || data.ok !== true) return;
      state.categoriasCache = Array.isArray(data.items) ? data.items : [];
      renderCategoriasDatalist(state.categoriasCache);
    }

    async function carregarTodasCategorias() {
      if (!requireScriptUrl()) return;
      const data = await jsonpRequest({
        action: "Categoria.Listar",
        sheet: "Categoria",
        filtros: JSON.stringify({ somenteAtivos: "1" }),
      });
      if (!data || data.ok !== true) return;
      const items = Array.isArray(data.items) ? data.items : [];
      if (dom.datalistCategoriasF) {
        dom.datalistCategoriasF.innerHTML = "";
        const set = new Set();
        items.forEach((it) => {
          const cat = String(it?.Categoria || "").trim();
          if (cat) set.add(cat);
        });
        [...set].slice(0, 200).forEach((cat) => {
          const opt = document.createElement("option");
          opt.value = cat;
          dom.datalistCategoriasF.appendChild(opt);
        });
      }
    }

    function findCategoriaAll(tipo, categoriaNome) {
      const t = String(tipo || "").trim();
      const c = String(categoriaNome || "").trim();
      if (!t || !c) return [];
      return state.categoriasCache.filter((x) =>
        String(x.Tipo || "").trim() === t &&
        String(x.Categoria || "").trim() === c &&
        String(x.Ativo || "Sim").trim() !== "Nao"
      );
    }

    function aplicarDescricaoDaCategoria(force = false) {
      if (!el.Descricao || !el.Categoria || !el.Tipo) return;
      const tipo = getTipoAtual();
      const cat = String(el.Categoria.value || "").trim();
      if (!tipo || !cat) return;
      const matches = findCategoriaAll(tipo, cat);
      if (!matches.length) { clearDescricoesDatalist(); return; }
      const padroes = matches.map((m) => String(m.Descricao_Padrao || "").trim()).filter(Boolean);
      if (!padroes.length) { clearDescricoesDatalist(); return; }
      renderDescricoesFromPadrao(padroes);
      const atual = String(el.Descricao.value || "").trim();
      const primeira = padroes.join("|").split(/\r?\n|[|;,]/g).map((s) => s.trim()).filter(Boolean)[0] || "";
      if ((force || !atual || atual === state.ultimaDescricaoAuto) && primeira) {
        el.Descricao.value = primeira;
        state.ultimaDescricaoAuto = primeira;
        setFeedback(dom.feedbackSalvar, "Descricao sugerida pela categoria.", "info");
        setTimeout(() => setFeedback(dom.feedbackSalvar, "", "info"), 1200);
      }
    }

    async function validarCategoriaSelecionada(payload) {
      const tipo = String(payload.Tipo || "").trim();
      const cat = String(payload.Categoria || "").trim();
      if (!tipo || !cat) return false;
      if (!state.categoriasCache.length) {
        try { await carregarCategoriasAtivas(tipo); } catch (_) {}
      }
      if (!findCategoriaAll(tipo, cat).length) {
        setFeedback(dom.feedbackSalvar, "Selecione uma Categoria valida (da lista).", "error");
        showToast("Categoria invalida. Selecione da lista.", { type: "error", duration: 4000 });
        return false;
      }
      return true;
    }

    function bindCategoriaPadrao() {
      if (!el.Tipo || !el.Categoria) return;
      el.Tipo.addEventListener("change", () => {
        if (el.Categoria) el.Categoria.value = "";
        if (el.Descricao) el.Descricao.value = "";
        state.ultimaDescricaoAuto = "";
        clearDescricoesDatalist();
        carregarCategoriasAtivas(getTipoAtual()).catch(() => {});
      });
      el.Categoria.addEventListener("focus", () => {
        carregarCategoriasAtivas(getTipoAtual()).catch(() => {});
      });
      el.Categoria.addEventListener("change", () => { aplicarDescricaoDaCategoria(true); });
      el.Categoria.addEventListener("blur", () => { aplicarDescricaoDaCategoria(false); });
      if (el.Descricao) {
        el.Descricao.addEventListener("focus", () => { aplicarDescricaoDaCategoria(false); });
      }
    }

    // ============================================================
    // CLIENTES
    // ============================================================
    function isTipoEntrada() { return getTipoAtual() === "Entrada"; }

    function clearClientesDatalist() {
      if (!dom.datalistClientes) return;
      dom.datalistClientes.innerHTML = "";
    }

    function renderClientesDatalist(items) {
      if (!dom.datalistClientes) return;
      dom.datalistClientes.innerHTML = "";
      const nomes = new Set();
      (items || []).forEach((it) => {
        const nome = String(it?.NomeSugestao || it?.NomeCliente || "").trim();
        if (nome) nomes.add(nome);
      });
      [...nomes].slice(0, 50).forEach((nome) => {
        const opt = document.createElement("option");
        opt.value = nome;
        dom.datalistClientes.appendChild(opt);
      });
    }

    async function buscarClientes(q) {
      if (!requireScriptUrl()) return;
      const data = await jsonpRequest({ action: "Clientes.Buscar", q: String(q ?? "") });
      if (!data || data.ok !== true) return;
      renderClientesDatalist(data.items || []);
    }

    function bindAutocompleteClientes() {
      if (!dom.inputCliente) return;
      dom.inputCliente.addEventListener("focus", () => {
        if (!isTipoEntrada()) return;
        buscarClientes(dom.inputCliente.value || "").catch(() => {});
      });
      dom.inputCliente.addEventListener("input", () => {
        if (!isTipoEntrada()) return;
        clearTimeout(state.clientesDebounce);
        state.clientesDebounce = setTimeout(() => {
          buscarClientes(dom.inputCliente.value || "").catch(() => {});
        }, 250);
      });
      if (el.Tipo) {
        el.Tipo.addEventListener("change", () => {
          if (!isTipoEntrada()) clearClientesDatalist();
          atualizarVisibilidadeCampos();
        });
      }
    }

    // ============================================================
    // FORNECEDORES
    // ============================================================
    function isTipoSaida() { return getTipoAtual() === "Saida"; }

    function clearFornecedoresDatalist() {
      if (!dom.datalistFornecedores) return;
      dom.datalistFornecedores.innerHTML = "";
    }

    function renderFornecedoresDatalist(items) {
      if (!dom.datalistFornecedores) return;
      dom.datalistFornecedores.innerHTML = "";
      const nomes = new Set();
      (items || []).forEach((it) => {
        const nome = String(it?.NomeFornecedor || "").trim();
        if (nome) nomes.add(nome);
      });
      [...nomes].slice(0, 50).forEach((nome) => {
        const opt = document.createElement("option");
        opt.value = nome;
        dom.datalistFornecedores.appendChild(opt);
      });
    }

    async function buscarFornecedores(q) {
      if (!requireScriptUrl()) return;
      const data = await jsonpRequest({ action: "Fornecedores.Buscar", q: String(q ?? "") });
      if (!data || data.ok !== true) return;
      renderFornecedoresDatalist(data.items || []);
    }

    function bindAutocompleteFornecedores() {
      if (!dom.inputFornecedor) return;
      dom.inputFornecedor.addEventListener("focus", () => {
        if (!isTipoSaida()) return;
        buscarFornecedores(dom.inputFornecedor.value || "").catch(() => {});
      });
      dom.inputFornecedor.addEventListener("input", () => {
        if (!isTipoSaida()) return;
        clearTimeout(state.fornecedoresDebounce);
        state.fornecedoresDebounce = setTimeout(() => {
          buscarFornecedores(dom.inputFornecedor.value || "").catch(() => {});
        }, 250);
      });
      if (el.Tipo) {
        el.Tipo.addEventListener("change", () => {
          if (!isTipoSaida()) clearFornecedoresDatalist();
        });
      }
    }

    // ============================================================
    // VISIBILIDADE CAMPOS
    // ============================================================
    function atualizarVisibilidadeCampos() {
      const tipo = getTipoAtual();
      if (dom.fieldCliente) dom.fieldCliente.style.display = (tipo === "Entrada") ? "" : "none";
      if (dom.fieldFornecedor) dom.fieldFornecedor.style.display = (tipo === "Saida") ? "" : "none";
    }

    // ============================================================
    // FORM CRUD helpers
    // ============================================================
    function clearForm() {
      Object.keys(el).forEach((k) => {
        if (!el[k]) return;
        el[k].value = "";
      });
      state.selectedRowIndex = null;
      state.ultimaDescricaoAuto = "";
      if (el.Data_Competencia) el.Data_Competencia.value = hojeISO();
      setFeedback(dom.feedbackSalvar, "", "info");
      clearClientesDatalist();
      clearFornecedoresDatalist();
      clearDescricoesDatalist();
      atualizarVisibilidadeCampos();
      if (dom.btnExcluir) dom.btnExcluir.style.display = "none";
      if (dom.btnNovo) dom.btnNovo.style.display = "none";
      if (dom.btnDuplicar) dom.btnDuplicar.style.display = "none";
      if (dom.btnMarcarPago) dom.btnMarcarPago.style.display = "none";
      if (dom.btnCancelarLanc) dom.btnCancelarLanc.style.display = "none";
    }

    function abrirFormulario(modoEdicao = false) {
      if (!dom.cardFormulario) return;
      dom.cardFormulario.style.display = "block";
      dom.cardFormulario.classList.toggle("modo-edicao", modoEdicao);
      if (dom.tituloFormulario) {
        dom.tituloFormulario.textContent = modoEdicao ? "Editar Lancamento" : "Novo Lancamento";
      }
      if (dom.descFormulario) {
        dom.descFormulario.textContent = modoEdicao
          ? "Altere os dados e clique em Salvar."
          : "Preencha os dados do lancamento.";
      }
      dom.cardFormulario.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function fecharFormulario() {
      if (!dom.cardFormulario) return;
      dom.cardFormulario.style.display = "none";
      clearForm();
    }

    function mostrarBotoesEdicao(item) {
      if (dom.btnNovo) dom.btnNovo.style.display = "inline-block";
      if (dom.btnDuplicar) dom.btnDuplicar.style.display = "inline-block";
      if (dom.btnExcluir) dom.btnExcluir.style.display = "inline-block";
      if (dom.btnMarcarPago) dom.btnMarcarPago.style.display = (item?.Status === "Pendente") ? "inline-block" : "none";
      if (dom.btnCancelarLanc) dom.btnCancelarLanc.style.display = (item?.Status !== "Cancelado") ? "inline-block" : "none";
    }

    function fillForm(it) {
      if (!it) return;
      state.itemAtualEdicao = it;
      Object.keys(el).forEach((k) => {
        if (!el[k]) return;
        if (k === "ID_Cliente") {
          el[k].value = it.NomeCliente || it[k] || "";
        } else if (k === "ID_Fornecedor") {
          el[k].value = it.NomeFornecedor || it[k] || "";
        } else if (k === "Data_Competencia" || k === "Data_Caixa" || k === "Mes_a_receber") {
          el[k].value = toISODate(it[k]);
        } else {
          el[k].value = it[k] ?? "";
        }
      });
      const ri = Number(it.rowIndex || 0);
      state.selectedRowIndex = ri > 0 ? ri : null;
      state.ultimaDescricaoAuto = "";
      clearDescricoesDatalist();
      if (!isTipoEntrada()) clearClientesDatalist();
      if (!isTipoSaida()) clearFornecedoresDatalist();
      aplicarDescricaoDaCategoria(false);
      atualizarVisibilidadeCampos();
      abrirFormulario(true);
      mostrarBotoesEdicao(it);
    }

    function buildLancPayload() {
      return {
        Data_Competencia: (el.Data_Competencia?.value || "").trim(),
        Data_Caixa: (el.Data_Caixa?.value || "").trim(),
        Tipo: (el.Tipo?.value || "").trim(),
        Origem: (el.Origem?.value || "").trim(),
        Categoria: (el.Categoria?.value || "").trim(),
        Descricao: (el.Descricao?.value || "").trim(),
        ID_Cliente: (el.ID_Cliente?.value || "").trim(),
        ID_Fornecedor: (el.ID_Fornecedor?.value || "").trim(),
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

    async function validateRequired(payload) {
      if (!payload.Data_Competencia || !payload.Tipo || !payload.Categoria ||
          !payload.Descricao || !payload.Valor || !payload.Status) {
        const msg = "Preencha: Data, Tipo, Categoria, Descricao, Valor, Status.";
        setFeedback(dom.feedbackSalvar, msg, "error");
        showToast(msg, { type: "error", duration: 4000 });
        return false;
      }
      if (!(await validarCategoriaSelecionada(payload))) return false;
      return true;
    }

    // Expose
    ctx.form = {
      getTipoAtual, clearForm, abrirFormulario, fecharFormulario, fillForm,
      buildLancPayload, validateRequired, aplicarDescricaoDaCategoria,
      atualizarVisibilidadeCampos, isTipoEntrada, isTipoSaida,
      carregarCategoriasAtivas, carregarTodasCategorias,
      bindCategoriaPadrao, bindAutocompleteClientes, bindAutocompleteFornecedores,
      clearClientesDatalist, clearFornecedoresDatalist,
      mostrarBotoesEdicao,
    };
  }

  window._LancFormRegister = register;
})();
