// cadastro.js
// Página: index.html (Cadastro)
// Backend: Google Apps Script (Google Planilhas)
// Observação: defina a constante SCRIPT_URL com a URL do seu Web App publicado.

(() => {
  "use strict";

  // =========================
  // CONFIG
  // =========================
  // cadastro.js

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwES8ixA7sDUQhj4-OdjvZvnIgPoBuyol7dHAyX4O4WENNiBdKOv6Iq_fBGOX8zFJpSVQ/exec";


  const SHEET_NAME = "Cadastro"; // nome da aba no Google Sheets (ajuste se quiser)

  // =========================
  // DOM
  // =========================
  const formCadastro = document.getElementById("formCadastro");
  const formBusca = document.getElementById("formBusca");

  const btnGerarId = document.getElementById("btnGerarId");
  const btnBuscar = document.getElementById("btnBuscar");

  const feedback = document.getElementById("feedback");

  const elIdCliente = document.getElementById("idCliente");
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

  const elQuery = document.getElementById("q");
  const tabelaResultados = document.getElementById("tabelaResultados");
  const tbodyResultados = tabelaResultados ? tabelaResultados.querySelector("tbody") : null;

  // =========================
  // HELPERS UI
  // =========================
  function setFeedback(msg, type = "info") {
    if (!feedback) return;
    feedback.textContent = msg || "";
    feedback.dataset.type = type;
    // Se quiser, estilize via CSS usando .feedback[data-type="success"] etc.
  }

  function hojeISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function sanitizePhone(v) {
    return (v || "").replace(/[^\d()+\-\s]/g, "").trim();
  }

  function normalizeText(v) {
    return (v || "").toString().trim();
  }

  function requireScriptUrl() {
    if (!SCRIPT_URL) {
      setFeedback(
        "Defina SCRIPT_URL no cadastro.js (URL do Web App do Apps Script) antes de usar.",
        "error"
      );
      return false;
    }
    return true;
  }

  async function postJSON(payload) {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Apps Script às vezes responde como text/plain
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { ok: res.ok, raw: text };
    }

    if (!res.ok) {
      const msg = data && (data.message || data.error) ? (data.message || data.error) : "Falha na requisição.";
      throw new Error(msg);
    }

    return data;
  }

  function clearResults() {
    if (!tbodyResultados) return;
    tbodyResultados.innerHTML = "";
  }

  function renderResults(items) {
    clearResults();
    if (!tbodyResultados) return;

    if (!Array.isArray(items) || items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5">Nenhum resultado.</td>`;
      tbodyResultados.appendChild(tr);
      return;
    }

    items.forEach((it) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(it.ID_Cliente ?? "")}</td>
        <td>${escapeHtml(it.NomeCliente ?? "")}</td>
        <td>${escapeHtml(it.Telefone ?? "")}</td>
        <td>${escapeHtml(it.Municipio ?? "")}</td>
        <td>${escapeHtml(it.Bairro ?? "")}</td>
      `;
      tbodyResultados.appendChild(tr);

      // Clique na linha -> carregar no formulário (opcional)
      tr.addEventListener("click", () => fillFormFromItem(it));
    });
  }

  function fillFormFromItem(it) {
    if (!it) return;

    elIdCliente.value = it.ID_Cliente ?? "";
    elNome.value = it.NomeCliente ?? "";
    elTelefone.value = it.Telefone ?? "";
    elEmail.value = it["E-mail"] ?? it.Email ?? "";
    elDataNascimento.value = it.DataNascimento ?? "";
    elMunicipio.value = it.Municipio ?? "";
    elBairro.value = it.Bairro ?? "";
    elDataCadastro.value = it.DataCadastro ?? "";
    elProfissao.value = it["Profissão"] ?? it.Profissao ?? "";
    elPreferencias.value = it["Preferências"] ?? it.Preferencias ?? "";
    elOrigem.value = it.Origem ?? "";
    elObservacao.value = it["Observação"] ?? it.Observacao ?? "";

    setFeedback("Cliente carregado no formulário. Edite e salve para atualizar (se implementar update).", "info");
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // =========================
  // PAYLOADS (colunas exatamente como você pediu)
  // =========================
  function buildCadastroPayload() {
    return {
      ID_Cliente: normalizeText(elIdCliente.value),
      NomeCliente: normalizeText(elNome.value),
      Telefone: sanitizePhone(elTelefone.value),
      "E-mail": normalizeText(elEmail.value),
      DataNascimento: normalizeText(elDataNascimento.value),
      Municipio: normalizeText(elMunicipio.value),
      Bairro: normalizeText(elBairro.value),
      DataCadastro: normalizeText(elDataCadastro.value),
      "Profissão": normalizeText(elProfissao.value),
      "Preferências": normalizeText(elPreferencias.value),
      Origem: normalizeText(elOrigem.value),
      "Observação": normalizeText(elObservacao.value),
    };
  }

  // =========================
  // ACTIONS
  // =========================
  async function gerarIdNoBackend() {
    if (!requireScriptUrl()) return;

    setFeedback("Gerando ID...", "info");

    try {
      const data = await postJSON({
        action: "Clientes.GerarID",
        sheet: SHEET_NAME,
      });

      // Esperado: { ok: true, id: "CL-..." }
      const id = data.id || data.ID_Cliente || "";
      if (!id) throw new Error("Backend não retornou ID.");

      elIdCliente.value = id;
      setFeedback("ID gerado.", "success");
    } catch (err) {
      setFeedback(err.message || "Erro ao gerar ID.", "error");
    }
  }

  async function salvarCadastro() {
    if (!requireScriptUrl()) return;

    // validações mínimas
    const nome = normalizeText(elNome.value);
    const tel = sanitizePhone(elTelefone.value);

    if (!nome || !tel) {
      setFeedback("Preencha Nome e Telefone.", "error");
      return;
    }

    // DataCadastro default hoje
    if (!elDataCadastro.value) elDataCadastro.value = hojeISO();

    // Se não tiver ID, tenta gerar localmente (fallback)
    if (!elIdCliente.value) {
      elIdCliente.value = gerarIdLocal();
    }

    setFeedback("Salvando...", "info");

    try {
      const payload = buildCadastroPayload();

      const data = await postJSON({
        action: "Clientes.Criar",
        sheet: SHEET_NAME,
        payload,
      });

      // Esperado: { ok: true, message: "...", rowId: ... }
      if (data.ok === false) throw new Error(data.message || "Erro ao salvar.");

      setFeedback(data.message || "Cadastro salvo com sucesso.", "success");
      // opcional: limpar form após salvar
      // formCadastro.reset();
      // elDataCadastro.value = hojeISO();
    } catch (err) {
      setFeedback(err.message || "Erro ao salvar cadastro.", "error");
    }
  }

  async function buscarClientes() {
    if (!requireScriptUrl()) return;

    const q = normalizeText(elQuery.value);
    if (!q) {
      setFeedback("Digite algo para buscar (nome ou telefone).", "error");
      return;
    }

    setFeedback("Buscando...", "info");

    try {
      const data = await postJSON({
        action: "Clientes.Buscar",
        sheet: SHEET_NAME,
        q,
      });

      // Esperado: { ok: true, items: [ {..} ] }
      const items = data.items || data.result || [];
      renderResults(items);
      setFeedback(`Resultados: ${Array.isArray(items) ? items.length : 0}`, "success");
    } catch (err) {
      setFeedback(err.message || "Erro na busca.", "error");
    }
  }

  // =========================
  // FALLBACK ID LOCAL (caso ainda não tenha endpoint pronto)
  // =========================
  function gerarIdLocal() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const rand = String(Math.floor(Math.random() * 9000) + 1000); // 1000-9999
    return `CL-${y}${m}${day}-${rand}`;
  }

  // =========================
  // INIT
  // =========================
  function initDefaults() {
    // DataCadastro default: hoje
    if (elDataCadastro && !elDataCadastro.value) elDataCadastro.value = hojeISO();
  }

  function bindEvents() {
    if (btnGerarId) {
      btnGerarId.addEventListener("click", (e) => {
        e.preventDefault();
        gerarIdNoBackend();
      });
    }

    if (formCadastro) {
      formCadastro.addEventListener("submit", (e) => {
        e.preventDefault();
        salvarCadastro();
      });
    }

    if (btnBuscar) {
      btnBuscar.addEventListener("click", (e) => {
        e.preventDefault();
        buscarClientes();
      });
    }

    if (formBusca) {
      formBusca.addEventListener("submit", (e) => {
        e.preventDefault();
        buscarClientes();
      });
    }
  }

  initDefaults();
  bindEvents();
})();
