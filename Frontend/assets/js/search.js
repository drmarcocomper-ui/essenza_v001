// search.js — Busca Global no Header
// Requer: config.js, auth.js, api.js

(() => {
  "use strict";

  const jsonpRequest = window.EssenzaApi?.request;
  let searchTimeout = null;
  let searchContainer = null;
  let searchInput = null;
  let searchResults = null;

  // ============================
  // Criar elementos da busca
  // ============================
  function criarBuscaNoHeader() {
    const nav = document.querySelector(".app-nav");
    if (!nav) return;

    // Não adicionar na página de login
    const currentPage = window.location.pathname.split("/").pop() || "";
    if (currentPage === "login.html") return;

    // Verificar se já existe
    if (document.getElementById("globalSearchContainer")) return;

    // Container
    searchContainer = document.createElement("div");
    searchContainer.id = "globalSearchContainer";
    searchContainer.className = "global-search";
    searchContainer.innerHTML = `
      <input type="text" id="globalSearchInput" class="global-search__input" placeholder="Buscar..." autocomplete="off" />
      <div id="globalSearchResults" class="global-search__results"></div>
    `;

    // Inserir antes do botão Sair (se existir) ou no final
    const btnSair = nav.querySelector(".app-nav__link--logout");
    if (btnSair) {
      nav.insertBefore(searchContainer, btnSair);
    } else {
      nav.appendChild(searchContainer);
    }

    searchInput = document.getElementById("globalSearchInput");
    searchResults = document.getElementById("globalSearchResults");

    // Eventos
    if (searchInput) {
      searchInput.addEventListener("input", onInputChange);
      searchInput.addEventListener("focus", onInputFocus);
      searchInput.addEventListener("keydown", onKeyDown);
    }

    // Fechar ao clicar fora
    document.addEventListener("click", (e) => {
      if (searchContainer && !searchContainer.contains(e.target)) {
        fecharResultados();
      }
    });
  }

  // ============================
  // Eventos
  // ============================
  function onInputChange() {
    const q = (searchInput?.value || "").trim();

    clearTimeout(searchTimeout);

    if (q.length < 2) {
      fecharResultados();
      return;
    }

    searchTimeout = setTimeout(() => {
      buscar(q);
    }, 300);
  }

  function onInputFocus() {
    const q = (searchInput?.value || "").trim();
    if (q.length >= 2 && searchResults?.innerHTML) {
      searchResults.style.display = "block";
    }
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      fecharResultados();
      searchInput?.blur();
    }
  }

  // ============================
  // Busca
  // ============================
  async function buscar(q) {
    if (!jsonpRequest) return;

    try {
      const data = await jsonpRequest({ action: "Busca.Global", q });

      if (!data || data.ok !== true) {
        mostrarMensagem(data?.message || "Erro na busca");
        return;
      }

      renderResultados(data.results, q);
    } catch (err) {
      mostrarMensagem("Erro: " + err.message);
    }
  }

  // ============================
  // Render
  // ============================
  function renderResultados(results, q) {
    if (!searchResults) return;

    const { lancamentos = [], clientes = [], categorias = [] } = results;
    const total = lancamentos.length + clientes.length + categorias.length;

    if (total === 0) {
      mostrarMensagem("Nenhum resultado para \"" + q + "\"");
      return;
    }

    let html = "";

    // Lançamentos
    if (lancamentos.length > 0) {
      html += `<div class="search-section">
        <div class="search-section__title">Lançamentos (${lancamentos.length})</div>`;
      lancamentos.forEach(item => {
        html += `<a href="lancamentos.html?q=${encodeURIComponent(item.Descricao || item.Categoria)}" class="search-item">
          <span class="search-item__main">${escapeHtml(item.Descricao || item.Categoria)}</span>
          <span class="search-item__sub">${escapeHtml(item.Data_Competencia)} • ${escapeHtml(item.Tipo)} • ${formatMoney(item.Valor)}</span>
        </a>`;
      });
      html += "</div>";
    }

    // Clientes
    if (clientes.length > 0) {
      html += `<div class="search-section">
        <div class="search-section__title">Clientes (${clientes.length})</div>`;
      clientes.forEach(item => {
        html += `<a href="index.html?q=${encodeURIComponent(item.NomeCliente)}" class="search-item">
          <span class="search-item__main">${escapeHtml(item.NomeCliente)}</span>
          <span class="search-item__sub">${escapeHtml(item.Telefone)} • ${escapeHtml(item.Municipio || "")}</span>
        </a>`;
      });
      html += "</div>";
    }

    // Categorias
    if (categorias.length > 0) {
      html += `<div class="search-section">
        <div class="search-section__title">Categorias (${categorias.length})</div>`;
      categorias.forEach(item => {
        html += `<a href="categoria.html?q=${encodeURIComponent(item.Categoria)}" class="search-item">
          <span class="search-item__main">${escapeHtml(item.Categoria)}</span>
          <span class="search-item__sub">${escapeHtml(item.Tipo)} • ${item.Ativo === "Sim" ? "Ativo" : "Inativo"}</span>
        </a>`;
      });
      html += "</div>";
    }

    searchResults.innerHTML = html;
    searchResults.style.display = "block";
  }

  function mostrarMensagem(msg) {
    if (!searchResults) return;
    searchResults.innerHTML = `<div class="search-message">${escapeHtml(msg)}</div>`;
    searchResults.style.display = "block";
  }

  function fecharResultados() {
    if (searchResults) {
      searchResults.style.display = "none";
    }
  }

  // ============================
  // Helpers
  // ============================
  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMoney(v) {
    const num = parseFloat(v) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  // ============================
  // Estilos
  // ============================
  function injetarEstilos() {
    if (document.getElementById("globalSearchStyles")) return;

    const style = document.createElement("style");
    style.id = "globalSearchStyles";
    style.textContent = `
      .global-search {
        position: relative;
        margin-left: auto;
        margin-right: 0.5rem;
      }

      .global-search__input {
        width: 180px;
        padding: 0.4rem 0.7rem;
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 20px;
        background: rgba(255,255,255,0.15);
        color: #fff;
        font-size: 0.85rem;
        outline: none;
        transition: width 0.2s, background 0.2s;
      }

      .global-search__input::placeholder {
        color: rgba(255,255,255,0.7);
      }

      .global-search__input:focus {
        width: 240px;
        background: rgba(255,255,255,0.25);
      }

      .global-search__results {
        display: none;
        position: absolute;
        top: 100%;
        right: 0;
        width: 320px;
        max-height: 400px;
        overflow-y: auto;
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        margin-top: 0.5rem;
        z-index: 1000;
      }

      .search-section {
        border-bottom: 1px solid #eee;
      }

      .search-section:last-child {
        border-bottom: none;
      }

      .search-section__title {
        padding: 0.5rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: #666;
        background: #f8f8f8;
        text-transform: uppercase;
      }

      .search-item {
        display: block;
        padding: 0.6rem 0.75rem;
        text-decoration: none;
        color: #333;
        border-bottom: 1px solid #f0f0f0;
        transition: background 0.15s;
      }

      .search-item:last-child {
        border-bottom: none;
      }

      .search-item:hover {
        background: #f5f5f5;
      }

      .search-item__main {
        display: block;
        font-size: 0.9rem;
        font-weight: 500;
      }

      .search-item__sub {
        display: block;
        font-size: 0.75rem;
        color: #888;
        margin-top: 0.2rem;
      }

      .search-message {
        padding: 1rem;
        text-align: center;
        color: #666;
        font-size: 0.9rem;
      }

      @media (max-width: 600px) {
        .global-search__input {
          width: 120px;
        }
        .global-search__input:focus {
          width: 160px;
        }
        .global-search__results {
          width: 280px;
          right: -20px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ============================
  // Init
  // ============================
  function init() {
    injetarEstilos();
    criarBuscaNoHeader();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
