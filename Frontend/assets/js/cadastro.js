// cadastro.js (JSONP - sem CORS)
// Requer: assets/js/config.js, auth.js, api.js

(() => {
  "use strict";

  const SHEET_NAME = "Cadastro";

  // =========================
  // DOM
  // =========================
  const formCadastro = document.getElementById("formCadastro");
  const formBusca = document.getElementById("formBusca");
  const btnBuscar = document.getElementById("btnBuscar");
  const btnLimparBusca = document.getElementById("btnLimparBusca");

  const feedback = document.getElementById("feedback");
  const feedbackLista = document.getElementById("feedbackLista");

  // Formulário
  const cardFormulario = document.getElementById("cardFormulario");
  const btnAbrirNovoCliente = document.getElementById("btnAbrirNovoCliente");
  const btnFecharForm = document.getElementById("btnFecharForm");
  const tituloFormulario = document.getElementById("tituloFormulario");
  const descFormulario = document.getElementById("descFormulario");

  // Botões de ação
  const btnSalvar = document.getElementById("btnSalvar");
  const btnLimpar = document.getElementById("btnLimpar");
  const btnInativar = document.getElementById("btnInativar");
  const btnAtivar = document.getElementById("btnAtivar");
  const btnExcluir = document.getElementById("btnExcluir");

  // Campos
  const elIdCliente = document.getElementById("idCliente");
  const elRowIndex = document.getElementById("rowIndex");
  const elNome = document.getElementById("nomeCliente");
  const elTelefone = document.getElementById("telefone");
  const elEmail = document.getElementById("email");
  const elDataNascimento = document.getElementById("dataNascimento");
  const elMunicipio = document.getElementById("municipio");
  const elBairro = document.getElementById("bairro");
  const elDataCadastro = document.getElementById("dataCadastro");
  const elProfissao = document.getElementById("profissao");
  const elPreferencias = document.getElementById("preferencias");
  const elOrigem = document.getElementById("origem");
  const elObservacao = document.getElementById("observacao");

  // Tabela
  const elQuery = document.getElementById("q");
  const tabelaResultados = document.getElementById("tabelaResultados");
  const tbodyResultados = tabelaResultados ? tabelaResultados.querySelector("tbody") : null;

  // Resumo
  const resumoClientes = document.getElementById("resumoClientes");
  const resumoTotal = document.getElementById("resumoTotal");
  const resumoAtivos = document.getElementById("resumoAtivos");
  const resumoInativos = document.getElementById("resumoInativos");

  // =========================
  // Estado
  // =========================
  let clienteAtual = null;
  let dadosListaAtual = [];

  // =========================
  // Helpers
  // =========================
  function setFeedback(el, msg, type = "info") {
    if (!el) return;
    el.textContent = msg || "";
    el.dataset.type = type;
  }

  function hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function sanitizePhone(v) {
    return (v || "").replace(/[^\d()+\-\s]/g, "").trim();
  }

  function normalizeText(v) {
    return (v || "").toString().trim();
  }

  function requireScriptUrl() {
    const url = window.EssenzaApi?.getScriptUrl?.() || "";
    if (!url || !url.includes("/exec")) {
      setFeedback(feedback, "SCRIPT_URL inválida.", "error");
      return false;
    }
    return true;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  const jsonpRequest = window.EssenzaApi?.request || (() => Promise.reject(new Error("EssenzaApi não carregado")));

  // =========================
  // Formulário: Abrir/Fechar
  // =========================
  function abrirFormulario(modoEdicao = false) {
    if (!cardFormulario) return;

    cardFormulario.style.display = "block";
    cardFormulario.classList.toggle("modo-edicao", modoEdicao);

    if (tituloFormulario) {
      tituloFormulario.textContent = modoEdicao ? "Editar Cliente" : "Novo Cliente";
    }
    if (descFormulario) {
      descFormulario.textContent = modoEdicao
        ? "Altere os dados e clique em Salvar."
        : "Preencha os dados do cliente.";
    }

    cardFormulario.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function fecharFormulario() {
    if (!cardFormulario) return;
    cardFormulario.style.display = "none";
    limparFormulario();
  }

  function limparFormulario() {
    if (formCadastro) formCadastro.reset();
    if (elIdCliente) elIdCliente.value = "";
    if (elRowIndex) elRowIndex.value = "";
    if (elDataCadastro) elDataCadastro.value = hojeISO();

    clienteAtual = null;

    // Esconder botões de edição
    if (btnLimpar) btnLimpar.style.display = "none";
    if (btnInativar) btnInativar.style.display = "none";
    if (btnAtivar) btnAtivar.style.display = "none";
    if (btnExcluir) btnExcluir.style.display = "none";

    setFeedback(feedback, "", "info");
  }

  function mostrarBotoesEdicao(cliente) {
    if (btnLimpar) btnLimpar.style.display = "inline-block";
    if (btnExcluir) btnExcluir.style.display = "inline-block";

    const isInativo = cliente?.Status === "Inativo";
    if (btnInativar) btnInativar.style.display = isInativo ? "none" : "inline-block";
    if (btnAtivar) btnAtivar.style.display = isInativo ? "inline-block" : "none";
  }

  // =========================
  // Payload
  // =========================
  function buildCadastroPayload() {
    return {
      NomeCliente: normalizeText(elNome?.value),
      Telefone: sanitizePhone(elTelefone?.value),
      "E-mail": normalizeText(elEmail?.value),
      DataNascimento: normalizeText(elDataNascimento?.value),
      Municipio: normalizeText(elMunicipio?.value),
      Bairro: normalizeText(elBairro?.value),
      DataCadastro: normalizeText(elDataCadastro?.value),
      "Profissão": normalizeText(elProfissao?.value),
      "Preferências": normalizeText(elPreferencias?.value),
      Origem: normalizeText(elOrigem?.value),
      "Observação": normalizeText(elObservacao?.value),
    };
  }

  // =========================
  // Tabela
  // =========================
  function clearResults() {
    if (!tbodyResultados) return;
    tbodyResultados.innerHTML = "";
  }

  function renderResults(items) {
    clearResults();
    if (!tbodyResultados) return;

    dadosListaAtual = items || [];

    if (!Array.isArray(items) || items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5">Nenhum cliente encontrado.</td>`;
      tbodyResultados.appendChild(tr);
      return;
    }

    items.forEach((it) => {
      const isInativo = it.Status === "Inativo";
      const tr = document.createElement("tr");
      if (isInativo) tr.classList.add("cliente-inativo");

      tr.innerHTML = `
        <td>${escapeHtml(it.NomeCliente ?? "")}</td>
        <td>${escapeHtml(it.Telefone ?? "")}</td>
        <td>${escapeHtml(it["E-mail"] ?? it.Email ?? "")}</td>
        <td>${escapeHtml(it.Municipio ?? "")}</td>
        <td>${isInativo ? "Inativo" : "Ativo"}</td>
      `;
      tbodyResultados.appendChild(tr);
      tr.addEventListener("click", () => {
        // Remover seleção anterior
        tbodyResultados.querySelectorAll("tr").forEach(r => r.classList.remove("selecionada"));
        tr.classList.add("selecionada");
        fillFormFromItem(it);
      });
    });

    atualizarResumo(items);
  }

  function atualizarResumo(items) {
    if (!resumoClientes) return;

    const total = items.length;
    const inativos = items.filter(i => i.Status === "Inativo").length;
    const ativos = total - inativos;

    if (resumoTotal) resumoTotal.textContent = total;
    if (resumoAtivos) resumoAtivos.textContent = ativos;
    if (resumoInativos) resumoInativos.textContent = inativos;

    resumoClientes.style.display = total > 0 ? "grid" : "none";
  }

  function fillFormFromItem(it) {
    if (!it) return;

    clienteAtual = it;

    if (elIdCliente) elIdCliente.value = it.ID_Cliente ?? "";
    if (elRowIndex) elRowIndex.value = it.rowIndex ?? "";
    if (elNome) elNome.value = it.NomeCliente ?? "";
    if (elTelefone) elTelefone.value = it.Telefone ?? "";
    if (elEmail) elEmail.value = it["E-mail"] ?? it.Email ?? "";
    if (elDataNascimento) elDataNascimento.value = it.DataNascimento ?? "";
    if (elMunicipio) elMunicipio.value = it.Municipio ?? "";
    if (elBairro) elBairro.value = it.Bairro ?? "";
    if (elDataCadastro) elDataCadastro.value = it.DataCadastro ?? "";
    if (elProfissao) elProfissao.value = it["Profissão"] ?? it.Profissao ?? "";
    if (elPreferencias) elPreferencias.value = it["Preferências"] ?? it.Preferencias ?? "";
    if (elOrigem) elOrigem.value = it.Origem ?? "";
    if (elObservacao) elObservacao.value = it["Observação"] ?? it.Observacao ?? "";

    abrirFormulario(true);
    mostrarBotoesEdicao(it);
  }

  // =========================
  // Ações
  // =========================
  async function salvarCadastro() {
    if (!requireScriptUrl()) return;

    const nome = normalizeText(elNome?.value);
    const tel = sanitizePhone(elTelefone?.value);

    if (!nome || !tel) {
      setFeedback(feedback, "Preencha Nome e Telefone.", "error");
      return;
    }

    if (elDataCadastro && !elDataCadastro.value) elDataCadastro.value = hojeISO();

    setFeedback(feedback, "Salvando...", "info");

    try {
      const payload = buildCadastroPayload();
      const rowIndex = elRowIndex?.value ? Number(elRowIndex.value) : null;

      let data;
      if (rowIndex && rowIndex >= 2) {
        // Editar existente
        data = await jsonpRequest({
          action: "Clientes.Editar",
          sheet: SHEET_NAME,
          rowIndex: rowIndex,
          payload: JSON.stringify(payload),
        });
      } else {
        // Criar novo
        if (elIdCliente) elIdCliente.value = "";
        data = await jsonpRequest({
          action: "Clientes.Criar",
          sheet: SHEET_NAME,
          payload: JSON.stringify(payload),
        });
      }

      if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao salvar.");

      if (data.id && elIdCliente) elIdCliente.value = data.id;

      setFeedback(feedback, data.message || "Salvo com sucesso!", "success");

      // Fechar formulário e atualizar lista
      setTimeout(() => {
        fecharFormulario();
        buscarClientes();
      }, 500);

    } catch (err) {
      setFeedback(feedback, err.message || "Erro ao salvar.", "error");
    }
  }

  async function buscarClientes() {
    if (!requireScriptUrl()) return;

    const q = normalizeText(elQuery?.value);

    setFeedback(feedbackLista, "Buscando...", "info");

    try {
      const data = await jsonpRequest({
        action: "Clientes.Buscar",
        sheet: SHEET_NAME,
        q: q || "",
      });

      if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro na busca.");

      renderResults(data.items || []);
      setFeedback(feedbackLista, `${(data.items || []).length} cliente(s)`, "success");

    } catch (err) {
      setFeedback(feedbackLista, err.message || "Erro na busca.", "error");
    }
  }

  async function inativarCliente() {
    if (!clienteAtual?.rowIndex) return;

    if (!confirm("Deseja inativar este cliente?")) return;

    setFeedback(feedback, "Inativando...", "info");

    try {
      const data = await jsonpRequest({
        action: "Clientes.Inativar",
        sheet: SHEET_NAME,
        rowIndex: clienteAtual.rowIndex,
      });

      if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao inativar.");

      setFeedback(feedback, "Cliente inativado.", "success");
      fecharFormulario();
      buscarClientes();

    } catch (err) {
      setFeedback(feedback, err.message || "Erro ao inativar.", "error");
    }
  }

  async function ativarCliente() {
    if (!clienteAtual?.rowIndex) return;

    setFeedback(feedback, "Reativando...", "info");

    try {
      const data = await jsonpRequest({
        action: "Clientes.Ativar",
        sheet: SHEET_NAME,
        rowIndex: clienteAtual.rowIndex,
      });

      if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao ativar.");

      setFeedback(feedback, "Cliente reativado.", "success");
      fecharFormulario();
      buscarClientes();

    } catch (err) {
      setFeedback(feedback, err.message || "Erro ao ativar.", "error");
    }
  }

  async function excluirCliente() {
    if (!clienteAtual?.rowIndex) return;

    if (!confirm("Tem certeza que deseja EXCLUIR este cliente permanentemente?")) return;

    setFeedback(feedback, "Excluindo...", "info");

    try {
      const data = await jsonpRequest({
        action: "Clientes.Excluir",
        sheet: SHEET_NAME,
        rowIndex: clienteAtual.rowIndex,
      });

      if (!data || data.ok !== true) throw new Error(data?.message || "Erro ao excluir.");

      setFeedback(feedbackLista, "Cliente excluído.", "success");
      fecharFormulario();
      buscarClientes();

    } catch (err) {
      setFeedback(feedback, err.message || "Erro ao excluir.", "error");
    }
  }

  function limparBusca() {
    if (elQuery) elQuery.value = "";
    buscarClientes();
  }

  // =========================
  // Bind
  // =========================
  function bindEvents() {
    // Formulário
    if (formCadastro) formCadastro.addEventListener("submit", (e) => (e.preventDefault(), salvarCadastro()));

    // Botões do formulário
    if (btnAbrirNovoCliente) btnAbrirNovoCliente.addEventListener("click", () => {
      limparFormulario();
      abrirFormulario(false);
    });
    if (btnFecharForm) btnFecharForm.addEventListener("click", fecharFormulario);
    if (btnLimpar) btnLimpar.addEventListener("click", () => {
      limparFormulario();
      abrirFormulario(false);
    });
    if (btnInativar) btnInativar.addEventListener("click", inativarCliente);
    if (btnAtivar) btnAtivar.addEventListener("click", ativarCliente);
    if (btnExcluir) btnExcluir.addEventListener("click", excluirCliente);

    // Busca
    if (btnBuscar) btnBuscar.addEventListener("click", (e) => (e.preventDefault(), buscarClientes()));
    if (btnLimparBusca) btnLimparBusca.addEventListener("click", (e) => (e.preventDefault(), limparBusca()));
    if (formBusca) formBusca.addEventListener("submit", (e) => (e.preventDefault(), buscarClientes()));
  }

  // =========================
  // Init
  // =========================
  function init() {
    if (elDataCadastro && !elDataCadastro.value) elDataCadastro.value = hojeISO();
    bindEvents();
    // Carregar lista inicial
    buscarClientes();
  }

  init();
})();
