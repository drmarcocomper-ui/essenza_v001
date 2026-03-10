// utils.js — Utilitários compartilhados do Essenza
// Carregue ANTES dos scripts de página
(() => {
  "use strict";

  // ============================
  // Segurança
  // ============================
  /**
   * Escapa caracteres HTML para prevenir XSS.
   * @param {*} str - Valor a escapar
   * @returns {string} String segura para innerHTML
   */
  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ============================
  // Datas
  // ============================
  /**
   * Retorna a data de hoje no formato ISO (YYYY-MM-DD).
   * @returns {string}
   */
  function hojeISO() {
    const d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  /**
   * Retorna o mes atual no formato YYYY-MM.
   * @returns {string}
   */
  function getMesAtualYYYYMM() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  /**
   * Converte data ISO (YYYY-MM-DD) para formato BR (DD/MM/YYYY).
   * @param {string} v - Data ISO ou string
   * @returns {string}
   */
  function formatDateBR(v) {
    if (!v) return "";
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y, m, d] = s.substring(0, 10).split("-");
      return d + "/" + m + "/" + y;
    }
    return s;
  }

  /**
   * Converte YYYY-MM para formato legivel (ex: "Jan/2025").
   * @param {string} mesYYYYMM - Mes no formato YYYY-MM, MM/YYYY ou YYYY/MM
   * @returns {string}
   */
  function formatMesDisplay(mesYYYYMM) {
    if (!mesYYYYMM) return "";
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const s = String(mesYYYYMM).trim();
    // YYYY-MM
    if (/^\d{4}-\d{2}$/.test(s)) {
      const [ano, mes] = s.split("-");
      const idx = parseInt(mes, 10) - 1;
      return idx >= 0 && idx < 12 ? meses[idx] + "/" + ano : s;
    }
    // MM/YYYY
    if (/^\d{1,2}\/\d{4}$/.test(s)) {
      const [mes, ano] = s.split("/");
      const idx = parseInt(mes, 10) - 1;
      return idx >= 0 && idx < 12 ? meses[idx] + "/" + ano : s;
    }
    // YYYY/MM
    if (/^\d{4}\/\d{1,2}$/.test(s)) {
      const [ano, mes] = s.split("/");
      const idx = parseInt(mes, 10) - 1;
      return idx >= 0 && idx < 12 ? meses[idx] + "/" + ano : s;
    }
    return s;
  }

  // ============================
  // Números / Moeda
  // ============================
  /**
   * Converte string para numero, suportando formato BR (virgula decimal).
   * @param {*} v - Valor a converter
   * @returns {number}
   */
  function toNumber(v) {
    const s = String(v ?? "").trim();
    if (!s) return 0;
    const clean = s.replace(/r\$\s?/gi, "");
    const num = Number(clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(",", "."));
    return Number.isNaN(num) ? 0 : num;
  }

  /**
   * Formata numero como moeda brasileira (R$ 1.234,56).
   * @param {number|string} v - Valor a formatar
   * @returns {string}
   */
  function formatMoneyBR(v) {
    const num = typeof v === "number" ? v : toNumber(v);
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  /**
   * Calcula variacao percentual entre dois valores.
   * @param {number} atual - Valor atual
   * @param {number} anterior - Valor anterior
   * @returns {number|null} Percentual ou null se anterior for zero
   */
  function calcVariacao(atual, anterior) {
    if (!anterior || anterior === 0) return null;
    return ((atual - anterior) / Math.abs(anterior)) * 100;
  }

  /**
   * Formata variacao percentual com sinal (ex: "+12.3%").
   * @param {number|null} v - Percentual
   * @returns {string}
   */
  function formatVariacao(v) {
    if (v === null || v === undefined) return "";
    const sinal = v >= 0 ? "+" : "";
    return sinal + v.toFixed(1) + "%";
  }

  // ============================
  // Texto
  // ============================
  /**
   * Remove caracteres nao-telefonicos de uma string.
   * @param {string} v - Texto a sanitizar
   * @returns {string}
   */
  function sanitizePhone(v) {
    return (v || "").replace(/[^\d()+\-\s]/g, "").trim();
  }

  /**
   * Normaliza texto removendo espacos extras.
   * @param {*} v - Texto a normalizar
   * @returns {string}
   */
  function normalizeText(v) {
    return (v || "").toString().trim();
  }

  // ============================
  // UI
  // ============================
  /**
   * Define texto e tipo de feedback em um elemento.
   * @param {HTMLElement} el - Elemento de feedback
   * @param {string} msg - Mensagem
   * @param {string} [type="info"] - Tipo: "info", "success", "error"
   */
  function setFeedback(el, msg, type) {
    if (!el) return;
    el.textContent = msg || "";
    el.dataset.type = type || "info";
  }

  // ============================
  // Controle de fluxo
  // ============================
  /**
   * Cria uma versao debounced de uma funcao.
   * @param {Function} fn - Funcao a executar
   * @param {number} delay - Delay em ms
   * @returns {Function}
   */
  function debounce(fn, delay) {
    let timer = null;
    return function() {
      const args = arguments;
      const ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
    };
  }

  // ============================
  // Acessibilidade
  // ============================
  /**
   * Ativa focus trap dentro de um container (modal/formulário).
   * @param {HTMLElement} container - Elemento a aprisionar o foco
   * @returns {Function} Função para desativar o trap
   */
  function trapFocus(container) {
    if (!container) return function() {};
    var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    var focusable = container.querySelectorAll(FOCUSABLE);
    if (!focusable.length) return function() {};
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    function handleKeydown(e) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    function handleEscape(e) {
      if (e.key === "Escape") {
        container.dispatchEvent(new CustomEvent("focustrap:escape"));
      }
    }
    container.addEventListener("keydown", handleKeydown);
    container.addEventListener("keydown", handleEscape);
    first.focus();
    return function() {
      container.removeEventListener("keydown", handleKeydown);
      container.removeEventListener("keydown", handleEscape);
    };
  }

  /**
   * Valida um campo em tempo real e mostra erro inline.
   * @param {HTMLInputElement} input - Campo a validar
   * @param {Function} validatorFn - Função que retorna string de erro ou "" se válido
   * @returns {Function} Função para remover o listener
   */
  function validateField(input, validatorFn) {
    if (!input) return function() {};
    var field = input.closest(".field");
    var errorEl = null;
    if (field) {
      errorEl = field.querySelector(".field__error");
      if (!errorEl) {
        errorEl = document.createElement("span");
        errorEl.className = "field__error";
        field.appendChild(errorEl);
      }
    }
    function check() {
      var msg = validatorFn(input.value);
      if (msg) {
        input.classList.add("input--error");
        if (field) field.classList.add("field--has-error");
        if (errorEl) errorEl.textContent = msg;
      } else {
        input.classList.remove("input--error");
        if (field) field.classList.remove("field--has-error");
        if (errorEl) errorEl.textContent = "";
      }
      return !msg;
    }
    input.addEventListener("blur", check);
    input.addEventListener("input", function() {
      if (input.classList.contains("input--error")) check();
    });
    return check;
  }

  /**
   * Gera HTML de linhas skeleton para tabelas.
   * @param {number} rows - Número de linhas
   * @param {number} cols - Número de colunas
   * @returns {string} HTML das linhas skeleton
   */
  function skeletonRows(rows, cols) {
    var html = "";
    var widths = ["skeleton-line--long", "skeleton-line--medium", "skeleton-line--short"];
    for (var r = 0; r < rows; r++) {
      html += "<tr class=\"skeleton-row\">";
      for (var c = 0; c < cols; c++) {
        html += "<td><div class=\"skeleton-line " + widths[c % 3] + "\"></div></td>";
      }
      html += "</tr>";
    }
    return html;
  }

  // ============================
  // Toast notifications
  // ============================
  /**
   * Exibe notificacao toast com opcao de desfazer.
   * @param {string} message - Mensagem
   * @param {Object} [options]
   * @param {number} [options.duration=5000] - Tempo em ms
   * @param {string} [options.type="info"] - "info"|"success"|"error"|"warning"
   * @param {Function} [options.onUndo] - Se presente, mostra botao "Desfazer"
   * @param {Function} [options.onDismiss] - Chamado ao fechar
   * @returns {Function} dismiss - Funcao para fechar manualmente
   */
  function showToast(message, options) {
    var opts = options || {};
    var duration = opts.duration || 5000;
    var type = opts.type || "info";

    // Container
    var container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }

    // Toast element
    var toast = document.createElement("div");
    toast.className = "toast toast--" + type;

    var msgEl = document.createElement("span");
    msgEl.className = "toast__message";
    msgEl.textContent = message;
    toast.appendChild(msgEl);

    if (typeof opts.onUndo === "function") {
      var undoBtn = document.createElement("button");
      undoBtn.className = "toast__undo";
      undoBtn.textContent = "Desfazer";
      undoBtn.addEventListener("click", function() {
        opts.onUndo();
        dismiss();
      });
      toast.appendChild(undoBtn);
    }

    var closeBtn = document.createElement("button");
    closeBtn.className = "toast__close";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", function() { dismiss(); });
    toast.appendChild(closeBtn);

    // Progress bar
    var progress = document.createElement("div");
    progress.className = "toast__progress";
    progress.style.animationDuration = duration + "ms";
    toast.appendChild(progress);

    container.appendChild(toast);

    var timer = setTimeout(function() { dismiss(); }, duration);
    var dismissed = false;

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      clearTimeout(timer);
      toast.style.animation = "toast-out .3s ease forwards";
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
        if (typeof opts.onDismiss === "function") opts.onDismiss();
      }, 300);
    }

    return dismiss;
  }

  // ============================
  // Expor globalmente
  // ============================
  window.EssenzaUtils = {
    escapeHtml: escapeHtml,
    hojeISO: hojeISO,
    getMesAtualYYYYMM: getMesAtualYYYYMM,
    formatDateBR: formatDateBR,
    formatMesDisplay: formatMesDisplay,
    toNumber: toNumber,
    formatMoneyBR: formatMoneyBR,
    calcVariacao: calcVariacao,
    formatVariacao: formatVariacao,
    sanitizePhone: sanitizePhone,
    normalizeText: normalizeText,
    setFeedback: setFeedback,
    debounce: debounce,
    trapFocus: trapFocus,
    validateField: validateField,
    skeletonRows: skeletonRows,
    showToast: showToast
  };
})();
