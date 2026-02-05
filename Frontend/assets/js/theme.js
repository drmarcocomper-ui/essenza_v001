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
  }

  // Run immediately
  init();
})();
