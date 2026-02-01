/**
 * Api.Utils.gs — Utilitários globais da API (JSONP)
 * ------------------------------------------------
 * Usado por Api.gs
 */

// =========================
// STRING
// =========================
function safeStr_(v) {
  return String(v == null ? "" : v).trim();
}

// =========================
// JSONP
// =========================
function jsonp_(callback, obj) {
  var cb = safeStr_(callback);
  var payload = JSON.stringify(obj || {});
  var out = cb ? (cb + "(" + payload + ");") : payload;

  return ContentService
    .createTextOutput(out)
    .setMimeType(cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

// =========================
// BODY / JSON
// =========================
function parseBody_(e) {
  var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "";
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function parseJsonParam_(s) {
  var raw = (s || "").toString();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}
