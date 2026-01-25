/** ResumoMensal.gs — OPÇÃO A (sem aba Resumo_Mensal)
 * ------------------------------------------------------------
 * Fonte: aba "Lancamentos"
 * Saída: calcula e RETORNA (não escreve em nenhuma aba)
 *
 * ✅ Regra: agrupar por mês usando Data_Caixa
 *    - Mês = YYYY-MM derivado de Data_Caixa
 *    - Se Data_Caixa vazio -> ignora no resumo
 *
 * Retorno por mês:
 * Mês | Entradas Pagas | Entradas Pendentes | Total Entradas | Saidas |
 * Resultado (Caixa) | Resultado (Caixa Real) |
 * Entrada. SumUp PJ | Entrada Nubank PJ | Entrada Nubank PF | Entrada PicPay PF
 */

var RM_SHEET_LANC = "Lancamentos";

function ResumoMensal_Calcular(mesYYYYMM) {
  mesYYYYMM = RM_safeStr_(mesYYYYMM); // opcional
  if (mesYYYYMM && !/^\d{4}-\d{2}$/.test(mesYYYYMM)) {
    throw new Error("Parâmetro 'mes' inválido. Use YYYY-MM.");
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shLanc = ss.getSheetByName(RM_SHEET_LANC);
  if (!shLanc) throw new Error("Aba não encontrada: " + RM_SHEET_LANC);

  var data = shLanc.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, items: [] };

  var header = data[0];
  var idx = RM_indexMap_(header);

  RM_requireCols_(idx, [
    "Data_Caixa",
    "Tipo",
    "Status",
    "Valor",
    "Instituicao_Financeira",
    "Titularidade",
  ]);

  var buckets = {}; // { "YYYY-MM": acc }

  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    var mes = RM_monthKeyFromDate_(row[idx["Data_Caixa"]]);
    if (!mes) continue; // só entra se Data_Caixa válida
    if (mesYYYYMM && mes !== mesYYYYMM) continue;

    var tipo = RM_safeStr_(row[idx["Tipo"]]);
    var status = RM_safeStr_(row[idx["Status"]]);
    var inst = RM_safeStr_(row[idx["Instituicao_Financeira"]]);
    var titular = RM_safeStr_(row[idx["Titularidade"]]);
    var valor = RM_parseNumber_(row[idx["Valor"]]);

    if (!buckets[mes]) buckets[mes] = RM_newAcc_();

    RM_accumulate_(buckets[mes], {
      tipo: tipo,
      status: status,
      valor: valor,
      inst: inst,
      titular: titular,
    });
  }

  var meses = Object.keys(buckets).sort(); // asc
  // se você quiser mostrar do mais recente para o mais antigo:
  meses.reverse();

  var items = [];
  for (var m = 0; m < meses.length; m++) {
    var key = meses[m];
    var acc = buckets[key];

    var entradasPagas = acc.entradasPagas;
    var entradasPend = acc.entradasPendentes;
    var totalEntradas = entradasPagas + entradasPend;
    var saidas = acc.saidas;

    // como base é Data_Caixa, os dois ficam iguais
    var resultadoCaixa = entradasPagas - saidas;
    var resultadoCaixaReal = resultadoCaixa;

    items.push({
      "Mês": key,
      "Entradas Pagas": RM_round2_(entradasPagas),
      "Entradas Pendentes": RM_round2_(entradasPend),
      "Total Entradas": RM_round2_(totalEntradas),
      "Saidas": RM_round2_(saidas),
      "Resultado (Caixa)": RM_round2_(resultadoCaixa),
      "Resultado (Caixa Real)": RM_round2_(resultadoCaixaReal),
      "Entrada. SumUp PJ": RM_round2_(acc.sumupPJ),
      "Entrada Nubank PJ": RM_round2_(acc.nubankPJ),
      "Entrada Nubank PF": RM_round2_(acc.nubankPF),
      "Entrada PicPay PF": RM_round2_(acc.picpayPF),
    });
  }

  return { ok: true, items: items };
}

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
  var valor = Number(it.valor || 0) || 0;

  if (tipo === "Receita") {
    if (status === "Pago") acc.entradasPagas += valor;
    else if (status === "Pendente") acc.entradasPendentes += valor;

    // instituiçoes (somente pagos)
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
// UTIL
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

function RM_safeStr_(v) {
  return String(v == null ? "" : v).trim();
}

function RM_norm_(v) {
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
