/**
 * Categoria.Utils.gs — Helpers do módulo Categoria
 * ------------------------------------------------
 * Regras:
 * - Somente helpers (sem SpreadsheetApp)
 * - Reutilizável por Categoria.gs e futuras integrações (ex.: Lançamentos)
 */

// =========================
// STRING / NORMALIZAÇÃO
// =========================
function CAT_safeStr_(v) {
  return String(v == null ? "" : v).trim();
}

function CAT_norm_(v) {
  var s = CAT_safeStr_(v).toLowerCase();
  try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (_) {}
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// =========================
// ID
// =========================
function CAT_newId_(prefix) {
  var p = CAT_safeStr_(prefix) || "CAT";
  var rnd = Math.random().toString(16).slice(2, 10);
  var t = Date.now().toString(36);
  return p + "-" + t + "-" + rnd;
}

// =========================
// DATAS
// =========================
function CAT_isoNow_() {
  return new Date().toISOString();
}

// =========================
// SORT
// =========================
function CAT_sortByOrdemThenCategoria_(a, b) {
  // Ordenar por Categoria (alfabética), depois por Descricao_Padrao
  var ac = CAT_norm_(a.Categoria);
  var bc = CAT_norm_(b.Categoria);
  if (ac < bc) return -1;
  if (ac > bc) return 1;

  var ad = CAT_norm_(a.Descricao_Padrao);
  var bd = CAT_norm_(b.Descricao_Padrao);
  if (ad < bd) return -1;
  if (ad > bd) return 1;

  return 0;
}

// =========================
// VALIDATIONS
// =========================
function CAT_isValidTipo_(tipo) {
  var t = CAT_safeStr_(tipo);
  return t === "Entrada" || t === "Saida" || t === "Transferência";
}

function CAT_isValidAtivo_(ativo) {
  var a = CAT_safeStr_(ativo);
  return a === "" || a === "Sim" || a === "Nao";
}

function CAT_toAtivo_(ativo) {
  var a = CAT_safeStr_(ativo);
  return a ? a : "Sim";
}

function CAT_toOrdem_(ordem) {
  var s = CAT_safeStr_(ordem);
  if (!s) return "";
  var n = Number(s);
  if (isNaN(n)) return "";
  return String(Math.max(0, Math.floor(n)));
}
