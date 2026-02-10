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
})();
