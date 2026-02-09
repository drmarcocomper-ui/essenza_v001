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
 * Corrige formatos invertidos como YYYY-DD-MM
 */
function LANC_parseAnyToDate_(v) {
  if (!v) return null;

  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }

  var s = LANC_safeStr_(v);
  if (!s) return null;

  // YYYY-MM-DD ou YYYY-DD-MM (detectar automaticamente)
  var isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    var ano = Number(isoMatch[1]);
    var p1 = Number(isoMatch[2]); // pode ser mês ou dia
    var p2 = Number(isoMatch[3]); // pode ser dia ou mês

    var mes, dia;
    if (p1 > 12 && p2 <= 12) {
      // p1 é dia, p2 é mês (formato YYYY-DD-MM)
      dia = p1;
      mes = p2;
    } else if (p2 > 12 && p1 <= 12) {
      // p1 é mês, p2 é dia (formato YYYY-MM-DD) - mas dia > 12
      mes = p1;
      dia = p2;
    } else {
      // ambos <= 12, assumir YYYY-MM-DD (padrão ISO)
      mes = p1;
      dia = p2;
    }

    return new Date(ano, mes - 1, dia);
  }

  // DD/MM/YYYY
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    var d1 = Number(m[1]);
    var d2 = Number(m[2]);
    var d3 = Number(m[3]);

    // Detectar se é DD/MM ou MM/DD
    if (d1 > 12 && d2 <= 12) {
      return new Date(d3, d2 - 1, d1); // DD/MM/YYYY
    } else if (d2 > 12 && d1 <= 12) {
      return new Date(d3, d1 - 1, d2); // MM/DD/YYYY
    } else {
      return new Date(d3, d2 - 1, d1); // assumir DD/MM/YYYY (BR)
    }
  }

  var t = Date.parse(s);
  if (isNaN(t)) return null;
  var d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
