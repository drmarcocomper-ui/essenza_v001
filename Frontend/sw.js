// sw.js — Service Worker para cache offline do Essenza
const CACHE_NAME = "essenza-v2";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./login.html",
  "./dashboard.html",
  "./lancamentos.html",
  "./resumo.html",
  "./fornecedores.html",
  "./categoria.html",
  "./assets/css/style.css",
  "./assets/js/config.js",
  "./assets/js/utils.js",
  "./assets/js/auth.js",
  "./assets/js/api.js",
  "./assets/js/theme.js",
  "./assets/js/search.js",
  "./assets/js/export.js",
  "./assets/js/login.js",
  "./assets/js/cadastro.js",
  "./assets/js/categoria.js",
  "./assets/js/fornecedores.js",
  "./assets/js/dashboard.js",
  "./assets/js/resumo.js",
  "./assets/js/lancamentos.js"
];

// Install: cache static assets
self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener("fetch", function(event) {
  var url = new URL(event.request.url);

  // API calls (Google Apps Script) - always network, no cache
  if (url.hostname === "script.google.com") {
    return;
  }

  // CDN scripts - cache first (versioned URLs)
  if (url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Static assets - network first, fallback to cache
  event.respondWith(
    fetch(event.request).then(function(response) {
      if (response.ok) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request);
    })
  );
});
