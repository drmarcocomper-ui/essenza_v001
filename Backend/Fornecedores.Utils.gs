/**
 * Fornecedores.Utils.gs — Helpers do módulo Fornecedores
 * --------------------------------------------------------
 * Contém apenas utilitários Fornecedores_*
 */

// ============================================================
// JSON
// ============================================================
function Fornecedores_parseJsonParam_(s) {
  var raw = (s || "").toString();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

// ============================================================
// STRINGS / NORMALIZE
// ============================================================
function Fornecedores_safeStr_(v) {
  return String(v == null ? "" : v).trim();
}

function Fornecedores_normalize_(s) {
  return Fornecedores_safeStr_(s).toLowerCase();
}

// ============================================================
// HEADER MAP / ROW MAP
// ============================================================
function Fornecedores_indexMap_(headerRow) {
  var map = {};
  for (var i = 0; i < headerRow.length; i++) {
    var k = String(headerRow[i] || "").trim();
    if (k) map[k] = i;
  }
  return map;
}

function Fornecedores_rowToObj_(headerRow, row) {
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
function Fornecedores_pad2_(n) {
  return String(n).padStart(2, "0");
}

function Fornecedores_isoDate_(d) {
  return d.getFullYear() + "-" + Fornecedores_pad2_(d.getMonth() + 1) + "-" + Fornecedores_pad2_(d.getDate());
}
