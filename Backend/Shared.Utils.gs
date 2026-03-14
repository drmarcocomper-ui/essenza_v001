/**
 * Shared.Utils.gs — Utilitários compartilhados entre módulos
 * ----------------------------------------------------------
 * Funções genéricas usadas por múltiplos módulos.
 * Cada módulo deve chamar Shared_* em vez de manter cópia local.
 */

// ============================================================
// STRING
// ============================================================
function Shared_safeStr_(v) {
  return String(v == null ? "" : v).trim();
}

function Shared_normalize_(s) {
  return Shared_safeStr_(s).toLowerCase();
}

// ============================================================
// JSON
// ============================================================
function Shared_parseJsonParam_(s) {
  var raw = (s || "").toString();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

// ============================================================
// HEADER MAP / ROW MAP
// ============================================================
function Shared_indexMap_(headerRow) {
  var map = {};
  for (var i = 0; i < headerRow.length; i++) {
    var k = String(headerRow[i] || "").trim();
    if (k) map[k] = i;
  }
  return map;
}

function Shared_rowToObj_(headerRow, row) {
  var o = {};
  for (var i = 0; i < headerRow.length; i++) {
    var k = String(headerRow[i] || "").trim();
    if (!k) continue;
    o[k] = row[i] != null ? row[i] : "";
  }
  return o;
}

// ============================================================
// DATE
// ============================================================
function Shared_pad2_(n) {
  return String(n).padStart(2, "0");
}

function Shared_isoDate_(d) {
  return d.getFullYear() + "-" + Shared_pad2_(d.getMonth() + 1) + "-" + Shared_pad2_(d.getDate());
}

// ============================================================
// AUDIT LOG (wrapper fire-and-forget)
// ============================================================
function Shared_tryLog_(action, details, token) {
  try { AuditLog_log_(action, details, token); } catch (_) {}
}
