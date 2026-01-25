// resumo.js (JSONP - sem CORS)
// Requer: config.js (window.APP_CONFIG.SCRIPT_URL)

(() => {
  "use strict";

  // ✅ Agora vem do config.js
  const SCRIPT_URL = window.APP_CONFIG?.SCRIPT_URL || "";

  const btnRecalcularTudo = document.getElementById("btnRecalcularTudo");
  const btnRecalcularMes = document.getElementById("btnRecalcularMes");
  const btnAtualizarLista = document.getElementById("btnAtualizarLista");
  const mes = document.getElementById("mes");

  const feedback = document.getElementById("feedbackResumo");
  const tabela = document.getElementById("tabelaResumo");
  const tbody = tabela ? tabela.querySelector("tbody") : null;

  function setFeedback(msg, type = "info") {
    if (!feedback) return;
    feedback.textContent = msg || "";
    feedback.dataset.type = type;
  }

  function requireScriptUrl() {
    if (!SCRIPT_URL || !SCRIPT_URL.includes("/exec")) {
      setFeedback("SCRIPT_URL inválida. Ajuste no config.js (precisa terminar em /exec).", "error");
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

  function jsonpRequest(params) {
    return new Promise((resolve, reject) => {
      const cb = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout na chamada ao Apps Script."));
      }, 20000);

      let script;

      function cleanup() {
        clearTimeout(timeout);
        try { delete window[cb]; } catch (_) {}
        if (script && script.parentNode) script.parentNode.removeChild(script);
      }

      window[cb] = (data) => {
        cleanup();
        resolve(data);
      };

      const qs = new URLSearchParams({ ...params, callback: cb }).toString();
      const url = `${SCRIPT_URL}?${qs}`;

      script = document.createElement("script");
      script.src = url;
      script.onerror = () => {
        cleanup();
        reject(new Error("Falha ao carregar JSONP (script)."));
      };
      document.head.appendChild(script);
    });
  }

  async function lerResumoDaAba() {
    const data = await jsonpRequest({ action: "ResumoMensal.Ler" });

    if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao ler resumo.");
    renderTable(data.items || []);
    setFeedback(`OK • ${(data.items || []).length} meses`, "success");
  }

  function clearTable() {
    if (!tbody) return;
    tbody.innerHTML = "";
  }

  function renderTable(items) {
    clearTable();
    if (!tbody) return;

    if (!Array.isArray(items) || items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="11">Sem dados.</td>`;
      tbody.appendChild(tr);
      return;
    }

    items.forEach((it) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(it["Mês"] || it.Mês || it.Mes || "")}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entradas Pagas"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entradas Pendentes"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Total Entradas"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Saidas"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Resultado (Caixa)"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Resultado (Caixa Real)"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Ent. SumUp PJ"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada Nubank PJ"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada Nubank PF"]))}</td>
        <td>${escapeHtml(formatMoneyBR(it["Entrada PicPay PF"]))}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function recalcularTudo() {
    if (!requireScriptUrl()) return;
    setFeedback("Recalculando tudo...", "info");

    try {
      const data = await jsonpRequest({ action: "ResumoMensal.RecalcularTudo" });
      if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao recalcular.");
      setFeedback(data.message || "Recalculado.", "success");
      await lerResumoDaAba();
    } catch (err) {
      setFeedback(err.message || "Erro.", "error");
    }
  }

  async function recalcularMes() {
    if (!requireScriptUrl()) return;

    const v = (mes?.value || "").trim(); // YYYY-MM
    if (!v) {
      setFeedback("Escolha um mês.", "error");
      return;
    }

    setFeedback("Recalculando mês...", "info");
    try {
      const data = await jsonpRequest({ action: "ResumoMensal.RecalcularMes", mes: v });
      if (!data || data.ok !== true) throw new Error((data && data.message) || "Erro ao recalcular mês.");
      setFeedback(data.message || "Mês recalculado.", "success");
      await lerResumoDaAba();
    } catch (err) {
      setFeedback(err.message || "Erro.", "error");
    }
  }

  function bind() {
    if (btnRecalcularTudo) btnRecalcularTudo.addEventListener("click", (e) => (e.preventDefault(), recalcularTudo()));
    if (btnRecalcularMes) btnRecalcularMes.addEventListener("click", (e) => (e.preventDefault(), recalcularMes()));
    if (btnAtualizarLista) btnAtualizarLista.addEventListener("click", (e) => (e.preventDefault(), lerResumoDaAba()));
  }

  bind();

  lerResumoDaAba().catch((err) => {
    setFeedback(err.message || "Erro ao carregar.", "error");
  });
})();
