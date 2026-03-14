/**
 * Lancamentos.Utils.gs — Helpers do módulo Lançamentos
 * ----------------------------------------------------
 * Redirects genéricos para Shared.Utils.gs + helpers específicos de Lancamentos.
 */
function LANC_parseJsonParam_(s) { return Shared_parseJsonParam_(s); }
function LANC_safeStr_(v) { return Shared_safeStr_(v); }
function LANC_normalize_(s) { return Shared_normalize_(s); }
function LANC_indexMap_(h) { return Shared_indexMap_(h); }
function LANC_rowToObj_(h, r) { return Shared_rowToObj_(h, r); }

/**
 * Normaliza Mes_a_receber para YYYY-MM.
 * Aceita: YYYY-MM, YYYY-MM-DD, Date, "março de 2026", "03/2026", etc.
 */
function LANC_normalizeYYYYMM_(v) {
  if (!v) return "";

  // Date object
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) {
    return v.getFullYear() + "-" + String(v.getMonth() + 1).padStart(2, "0");
  }

  var s = LANC_safeStr_(v);
  if (!s) return "";

  // Já está em YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 7);

  // MM/YYYY ou 03/2026
  var mSlash = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (mSlash) return mSlash[2] + "-" + mSlash[1].padStart(2, "0");

  // "março de 2026", "Março 2026", "março/2026"
  var meses = {
    "janeiro":1,"fevereiro":2,"marco":3,"março":3,"abril":4,"maio":5,"junho":6,
    "julho":7,"agosto":8,"setembro":9,"outubro":10,"novembro":11,"dezembro":12,
    "jan":1,"fev":2,"mar":3,"abr":4,"mai":5,"jun":6,
    "jul":7,"ago":8,"set":9,"out":10,"nov":11,"dez":12
  };
  var lower = s.toLowerCase().replace(/\s+/g, " ").trim();
  var mExtenso = lower.match(/^(\w+)\s*(?:de\s*)?[\/\s]\s*(\d{4})$/);
  if (mExtenso && meses[mExtenso[1]]) {
    return mExtenso[2] + "-" + String(meses[mExtenso[1]]).padStart(2, "0");
  }

  // Fallback: tentar parsear como data
  var d = LANC_parseAnyToDate_(s);
  if (d) return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");

  return s;
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
