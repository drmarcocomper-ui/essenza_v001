/**
 * Clientes.Utils.gs — Helpers do módulo Clientes (Cadastro)
 * --------------------------------------------------------
 * Contém apenas utilitários Clientes_*
 */

// ============================================================
// JSON
// ============================================================
function Clientes_parseJsonParam_(s) {
  var raw = (s || "").toString();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

// ============================================================
// STRINGS / NORMALIZE
// ============================================================
function Clientes_safeStr_(v) {
  return String(v == null ? "" : v).trim();
}

function Clientes_normalize_(s) {
  return Clientes_safeStr_(s).toLowerCase();
}

// ============================================================
// HEADER MAP / ROW MAP
// ============================================================
function Clientes_indexMap_(headerRow) {
  var map = {};
  for (var i = 0; i < headerRow.length; i++) {
    var k = String(headerRow[i] || "").trim();
    if (k) map[k] = i;
  }
  return map;
}

function Clientes_rowToObj_(headerRow, row) {
  var o = {};
  for (var i = 0; i < headerRow.length; i++) {
    var k = String(headerRow[i] || "").trim();
    if (k) o[k] = row[i];
  }
  return o;
}

// ============================================================
// DATE / PAD
// ============================================================
function Clientes_pad2_(n) {
  return String(n).padStart(2, "0");
}

function Clientes_isoDate_(d) {
  return d.getFullYear() + "-" + Clientes_pad2_(d.getMonth() + 1) + "-" + Clientes_pad2_(d.getDate());
}
