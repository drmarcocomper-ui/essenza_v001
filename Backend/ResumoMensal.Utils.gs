/**
 * ResumoMensal.Utils.gs — Helpers da feature ResumoMensal
 * ------------------------------------------------------
 * Contém apenas utilitários e acumuladores RM_*
 */

// ============================================================
// ACUMULADOR
// ============================================================
function RM_newAcc_() {
  return {
    entradasPagas: 0,
    entradasPendentes: 0,
    saidas: 0,

    sumupPJ: 0,
    nubankPJ: 0,
    nubankPF: 0,
    picpayPF: 0,
  };
}

function RM_accumulate_(acc, it) {
  var tipo = RM_safeStr_(it.tipo);
  var status = RM_safeStr_(it.status);
  var valor = RM_parseNumber_(it.valor);

  if (tipo === "Receita") {
    if (status === "Pago") acc.entradasPagas += valor;
    else if (status === "Pendente") acc.entradasPendentes += valor;

    // Instituições (somente pagos)
    if (status === "Pago") {
      var instN = RM_norm_(it.inst);
      var titN = RM_norm_(it.titular);

      if (instN.indexOf("sumup") !== -1 && titN.indexOf("pj") !== -1) acc.sumupPJ += valor;
      if (instN.indexOf("nubank") !== -1 && titN.indexOf("pj") !== -1) acc.nubankPJ += valor;
      if (instN.indexOf("nubank") !== -1 && titN.indexOf("pf") !== -1) acc.nubankPF += valor;
      if (instN.indexOf("picpay") !== -1 && titN.indexOf("pf") !== -1) acc.picpayPF += valor;
    }
  }

  if (tipo === "Despesa") {
    acc.saidas += valor;
  }
}

// ============================================================
// UTIL — Header / Colunas
// ============================================================
function RM_indexMap_(headerRow) {
  var map = {};
  for (var i = 0; i < headerRow.length; i++) {
    var k = String(headerRow[i] || "").trim();
    if (k) map[k] = i;
  }
  return map;
}

function RM_requireCols_(idxMap, cols) {
  for (var i = 0; i < cols.length; i++) {
    if (idxMap[cols[i]] === undefined) {
      throw new Error("Coluna obrigatória ausente em Lancamentos: " + cols[i]);
    }
  }
}

// ============================================================
// UTIL — Strings / Números
// ============================================================
function RM_safeStr_(v) {
  return String(v == null ? "" : v).trim();
}

function RM_norm_(v) {
  // simples (sem remover acentos)
  return RM_safeStr_(v).toLowerCase();
}

function RM_parseNumber_(v) {
  if (typeof v === "number") return v;

  var s = RM_safeStr_(v);
  if (!s) return 0;

  if (s.indexOf(",") !== -1) {
    s = s.replace(/\./g, "").replace(",", ".");
  }

  var n = Number(s);
  return isNaN(n) ? 0 : n;
}

function RM_round2_(n) {
  n = Number(n || 0);
  return Math.round(n * 100) / 100;
}

// ============================================================
// UTIL — Datas
// ============================================================
function RM_monthKeyFromDate_(value) {
  if (!value) return "";

  // Date object vindo da planilha
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0");
  }

  var s = RM_safeStr_(value);

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);

  // DD/MM/YYYY
  var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return m[3] + "-" + m[2];

  return "";
}

function RM_dateOut_(value) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    var y = value.getFullYear();
    var m = String(value.getMonth() + 1).padStart(2, "0");
    var d = String(value.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  return RM_safeStr_(value);
}
