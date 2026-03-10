// theme.js - Dark Mode Toggle
(() => {
  "use strict";

  const THEME_KEY = "essenza_theme";

  function getStoredTheme() {
    return localStorage.getItem(THEME_KEY) || "light";
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
    updateToggleIcon();
  }

  function toggleTheme() {
    const current = getStoredTheme();
    setTheme(current === "dark" ? "light" : "dark");
  }

  function updateToggleIcon() {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;
    const theme = getStoredTheme();
    btn.textContent = theme === "dark" ? "☀️" : "🌙";
    btn.title = theme === "dark" ? "Modo claro" : "Modo escuro";
  }

  function init() {
    // Apply stored theme immediately
    const theme = getStoredTheme();
    document.documentElement.setAttribute("data-theme", theme);
    applyAccent(getStoredAccent());

    // Wait for DOM
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", setup);
    } else {
      setup();
    }
  }

  function setup() {
    updateToggleIcon();

    const btn = document.getElementById("themeToggle");
    if (btn) {
      btn.addEventListener("click", toggleTheme);
    }

    setupMobileMenu();
    setupAccentPicker();
  }

  /* ---- Custom Accent Color ---- */
  const ACCENT_KEY = "essenza_accent";

  function getStoredAccent() {
    return localStorage.getItem(ACCENT_KEY) || "";
  }

  function applyAccent(hex) {
    if (!hex) {
      document.documentElement.style.removeProperty("--cor-primaria");
      document.documentElement.style.removeProperty("--cor-secundaria");
      return;
    }
    document.documentElement.style.setProperty("--cor-primaria", hex);
    // Derive secondary: lighten by mixing with white
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    var lr = Math.round(r + (255 - r) * 0.6);
    var lg = Math.round(g + (255 - g) * 0.6);
    var lb = Math.round(b + (255 - b) * 0.6);
    document.documentElement.style.setProperty("--cor-secundaria", "rgb(" + lr + "," + lg + "," + lb + ")");
  }

  function setAccent(hex) {
    if (hex) {
      localStorage.setItem(ACCENT_KEY, hex);
    } else {
      localStorage.removeItem(ACCENT_KEY);
    }
    applyAccent(hex);
    updateAccentPicker();
  }

  function updateAccentPicker() {
    var picker = document.getElementById("accentPicker");
    if (picker) picker.value = getStoredAccent() || "#7b4b94";
  }

  function setupAccentPicker() {
    var nav = document.querySelector(".app-nav");
    if (!nav) return;
    var currentPage = window.location.pathname.split("/").pop() || "";
    if (currentPage === "login.html") return;

    var wrap = document.createElement("span");
    wrap.className = "accent-picker-wrap";
    wrap.innerHTML = '<input type="color" id="accentPicker" class="accent-picker" title="Cor do tema" value="' + (getStoredAccent() || "#7b4b94") + '" />';

    var themeBtn = document.getElementById("themeToggle");
    if (themeBtn && themeBtn.parentNode === nav) {
      nav.insertBefore(wrap, themeBtn);
    } else {
      nav.appendChild(wrap);
    }

    var picker = document.getElementById("accentPicker");
    if (picker) {
      picker.addEventListener("input", function() {
        applyAccent(picker.value);
      });
      picker.addEventListener("change", function() {
        setAccent(picker.value);
      });
      // Double-click to reset
      picker.addEventListener("dblclick", function(e) {
        e.preventDefault();
        setAccent("");
      });
    }
  }

  /* ---- Mobile Menu (Hamburger) ---- */
  function setupMobileMenu() {
    const toggle = document.getElementById("menuToggle");
    const nav = document.querySelector(".app-nav");
    if (!toggle || !nav) return;

    // Create overlay element
    const overlay = document.createElement("div");
    overlay.className = "menu-overlay";
    document.body.appendChild(overlay);

    function openMenu() {
      nav.classList.add("open");
      toggle.classList.add("open");
      overlay.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Fechar menu");
    }

    function closeMenu() {
      nav.classList.remove("open");
      toggle.classList.remove("open");
      overlay.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Abrir menu");
    }

    toggle.addEventListener("click", function () {
      if (nav.classList.contains("open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Close when clicking overlay
    overlay.addEventListener("click", closeMenu);

    // Close when clicking a nav link
    nav.querySelectorAll(".app-nav__link").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    // Close when resizing to desktop
    window.addEventListener("resize", function () {
      if (window.innerWidth > 768) {
        closeMenu();
      }
    });
  }

  // Run immediately
  init();

  // Service Worker: desativado temporariamente — limpar caches antigos
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(regs) {
      regs.forEach(function(r) { r.unregister(); });
    }).then(function() {
      return caches.keys();
    }).then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).catch(function() {});
  }
})();
