/**
 * Lancamentos.Utils.gs — Helpers do módulo Lançamentos
 * ----------------------------------------------------
 * Contém apenas utilitários LANC_*
 */

function LANC_parseJsonParam_(s) {
  var raw = (s || "").toString();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

function LANC_safeStr_(v) {
  return String(v == null ? "" : v).trim();
}

function LANC_normalize_(s) {
  return LANC_safeStr_(s).toLowerCase();
}

function LANC_indexMap_(headerRow) {
  var map = {};
  for (var i = 0; i < headerRow.length; i++) {
    var k = String(headerRow[i] || "").trim();
    if (k) map[k] = i;
  }
  return map;
}

function LANC_rowToObj_(headerRow, row) {
  var o = {};
  for (var i = 0; i < headerRow.length; i++) {
    var k = String(headerRow[i] || "").trim();
    if (!k) continue;
    o[k] = row[i] != null ? row[i] : "";
  }
  return o;
}

function LANC_parseNumber_(v) {
  var s = LANC_safeStr_(v);
  if (!s) return 0;

  if (s.indexOf(",") !== -1) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  var n = Number(s);
  if (isNaN(n)) throw new Error("Valor inválido: " + v);
  return n;
}

function LANC_normalizeIsoDate_(iso) {
  var s = LANC_safeStr_(iso);
  if (!s) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return m[3] + "-" + m[2] + "-" + m[1];

  return s;
}

function LANC_parseIsoDateToDate_(iso) {
  var s = LANC_normalizeIsoDate_(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  var parts = s.split("-");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

/**
 * Aceita Date (da planilha) OU string ISO/BR e retorna Date (sem hora).
 */
function LANC_parseAnyToDate_(v) {
  if (!v) return null;

  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }

  var s = LANC_safeStr_(v);
  if (!s) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return LANC_parseIsoDateToDate_(s);

  // DD/MM/YYYY
  var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

  var t = Date.parse(s);
  if (isNaN(t)) return null;
  var d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
