/**
 * ResumoMensal.Utils.gs — Helpers da feature ResumoMensal
 * ------------------------------------------------------
 * ✅ Ajustado para Tipo = Entrada / Saida
 * ✅ Também aceita Receita/Despesa (compat)
 * ✅ Normaliza acentos e maiúsculas
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
  var tipoN = RM_norm_(it.tipo);     // ex.: "entrada", "saida"
  var statusN = RM_norm_(it.status); // ex.: "pago", "pendente"
  var valor = RM_parseNumber_(it.valor);

  // ignora cancelados/inativos
  if (statusN === "cancelado" || statusN === "inativo") return;

  var isEntrada =
    tipoN === "entrada" || tipoN === "entradas" ||
    tipoN === "receita" || tipoN === "receitas";

  var isSaida =
    tipoN === "saida" || tipoN === "saidas" ||
    tipoN === "despesa" || tipoN === "despesas";

  if (isEntrada) {
    if (statusN === "pago" || statusN === "paga" || statusN === "quitado") {
      acc.entradasPagas += valor;

      // instituiçoes (somente entradas pagas)
      var instN = RM_norm_(it.inst);
      var titN = RM_norm_(it.titular);

      // heurística simples:
      // - PJ: contém "pj" ou "salao"
      // - PF: contém "pf" ou "cabeleireira"
      var isPJ = titN.indexOf("pj") !== -1 || titN.indexOf("salao") !== -1 || titN.indexOf("salao") !== -1;
      var isPF = titN.indexOf("pf") !== -1 || titN.indexOf("cabeleireira") !== -1;

      if (instN.indexOf("sumup") !== -1 && isPJ) acc.sumupPJ += valor;
      if (instN.indexOf("nubank") !== -1 && isPJ) acc.nubankPJ += valor;
      if (instN.indexOf("nubank") !== -1 && isPF) acc.nubankPF += valor;
      if (instN.indexOf("picpay") !== -1 && isPF) acc.picpayPF += valor;

    } else if (statusN === "pendente" || statusN === "a receber" || statusN === "areceber") {
      acc.entradasPendentes += valor;
    }
  }

  if (isSaida) {
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
  var s = RM_safeStr_(v).toLowerCase();
  try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (_) {}
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function RM_parseNumber_(v) {
  if (typeof v === "number") return v;

  var s = RM_safeStr_(v);
  if (!s) return 0;

  // remove R$ e espaços
  s = s.replace(/r\$\s?/gi, "").trim();

  // milhares e vírgula
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

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0");
  }

  var s = RM_safeStr_(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);

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
