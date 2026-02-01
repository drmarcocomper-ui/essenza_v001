/**
 * ResumoMensal.Utils.gs — Helpers da feature ResumoMensal
 * ------------------------------------------------------
 * ✅ Tipo: Entrada / Saida (aceita Receita/Despesa por compat)
 * ✅ Separa Entradas Pagas por:
 *   - Forma_Pagamento (fixas)
 *   - Instituicao_Financeira (fixas)
 * ✅ Normaliza acentos e maiúsculas
 */

var RM_FORMAS_FIXAS = [
  "Pix",
  "Dinheiro",
  "Cartao_Debito",
  "Cartao_Credito",
  "Boleto",
  "Transferencia",
  "Confianca",
  "Cortesia",
];

var RM_INST_FIXAS = [
  "Nubank",
  "PicPay",
  "SumUp",
  "Terceiro",
  "Dinheiro",
  "Cortesia",
];

// ============================================================
// ACUMULADOR
// ============================================================
function RM_newAcc_() {
  var formas = {};
  RM_FORMAS_FIXAS.forEach(function (k) { formas[k] = 0; });

  var insts = {};
  RM_INST_FIXAS.forEach(function (k) { insts[k] = 0; });

  return {
    entradasPagas: 0,
    entradasPendentes: 0,
    saidas: 0,

    // ✅ breakdowns (somente entradas pagas)
    porForma: formas,
    porInstituicao: insts,
  };
}

function RM_accumulate_(acc, it) {
  var tipoN = RM_norm_(it.tipo);
  var statusN = RM_norm_(it.status);
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

      // ✅ Forma_Pagamento (fixa)
      var forma = RM_pickFromFixed_(it.forma, RM_FORMAS_FIXAS);
      if (forma) acc.porForma[forma] = (acc.porForma[forma] || 0) + valor;

      // ✅ Instituicao_Financeira (fixa)
      var inst = RM_pickFromFixed_(it.inst, RM_INST_FIXAS);
      if (inst) acc.porInstituicao[inst] = (acc.porInstituicao[inst] || 0) + valor;

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

  s = s.replace(/r\$\s?/gi, "").trim();

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

/**
 * Retorna exatamente uma opção fixa, se bater.
 * Tenta:
 * - match direto (case-sensitive) primeiro
 * - match por normalização (case/acentos) depois
 */
function RM_pickFromFixed_(raw, fixedList) {
  var s = RM_safeStr_(raw);
  if (!s) return "";

  // match direto
  for (var i = 0; i < fixedList.length; i++) {
    if (s === fixedList[i]) return fixedList[i];
  }

  // match normalizado
  var sn = RM_norm_(s);
  for (var j = 0; j < fixedList.length; j++) {
    if (sn === RM_norm_(fixedList[j])) return fixedList[j];
  }

  return "";
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
