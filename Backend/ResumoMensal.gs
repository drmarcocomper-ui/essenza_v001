/**
 * ResumoMensal.gs — OPÇÃO A (sem aba Resumo_Mensal)
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
 *
 * Dependência:
 * - ResumoMensal.Utils.gs (RM_* helpers)
 */

var RM_SHEET_LANC = "Lancamentos";

/**
 * ✅ Wrapper para o Registry/Api (lê e.parameter.mes opcional)
 * Action: "ResumoMensal.Calcular"
 */
function ResumoMensal_CalcularApi_(e) {
  var mes = "";
  try {
    mes = e && e.parameter && e.parameter.mes ? String(e.parameter.mes).trim() : "";
  } catch (_) {}
  return ResumoMensal_Calcular(mes);
}

/**
 * ✅ Wrapper para o Registry/Api (lê e.parameter.mes obrigatório)
 * Action: "ResumoMensal.DetalharMes"
 */
function ResumoMensal_DetalharMesApi_(e) {
  var mes = "";
  try {
    mes = e && e.parameter && e.parameter.mes ? String(e.parameter.mes).trim() : "";
  } catch (_) {}

  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    throw new Error("Parâmetro 'mes' é obrigatório e deve estar em YYYY-MM.");
  }

  return ResumoMensal_DetalharMes(mes);
}

/**
 * Calcula o resumo mensal. Pode receber mesYYYYMM opcional.
 */
function ResumoMensal_Calcular(mesYYYYMM) {
  mesYYYYMM = RM_safeStr_(mesYYYYMM);
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
    if (!mes) continue;
    if (mesYYYYMM && mes !== mesYYYYMM) continue;

    if (!buckets[mes]) buckets[mes] = RM_newAcc_();

    RM_accumulate_(buckets[mes], {
      tipo: row[idx["Tipo"]],
      status: row[idx["Status"]],
      valor: row[idx["Valor"]],
      inst: row[idx["Instituicao_Financeira"]],
      titular: row[idx["Titularidade"]],
    });
  }

  var meses = Object.keys(buckets).sort().reverse(); // mais recente primeiro

  var items = [];
  for (var m = 0; m < meses.length; m++) {
    var key = meses[m];
    var acc = buckets[key];

    var entradasPagas = acc.entradasPagas;
    var entradasPend = acc.entradasPendentes;
    var totalEntradas = entradasPagas + entradasPend;
    var saidas = acc.saidas;

    // ✅ Base = Data_Caixa → caixa = caixa real
    var resultadoCaixa = entradasPagas - saidas;

    items.push({
      "Mês": key,
      "Entradas Pagas": RM_round2_(entradasPagas),
      "Entradas Pendentes": RM_round2_(entradasPend),
      "Total Entradas": RM_round2_(totalEntradas),
      "Saidas": RM_round2_(saidas),
      "Resultado (Caixa)": RM_round2_(resultadoCaixa),
      "Resultado (Caixa Real)": RM_round2_(resultadoCaixa),
      "Entrada. SumUp PJ": RM_round2_(acc.sumupPJ),
      "Entrada Nubank PJ": RM_round2_(acc.nubankPJ),
      "Entrada Nubank PF": RM_round2_(acc.nubankPF),
      "Entrada PicPay PF": RM_round2_(acc.picpayPF),
    });
  }

  return { ok: true, items: items };
}

/**
 * Drill-down: retorna lançamentos do mês (por Data_Caixa)
 */
function ResumoMensal_DetalharMes(mesYYYYMM) {
  mesYYYYMM = RM_safeStr_(mesYYYYMM);
  if (!mesYYYYMM || !/^\d{4}-\d{2}$/.test(mesYYYYMM)) {
    throw new Error("Parâmetro 'mes' inválido. Use YYYY-MM.");
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shLanc = ss.getSheetByName(RM_SHEET_LANC);
  if (!shLanc) throw new Error("Aba não encontrada: " + RM_SHEET_LANC);

  var data = shLanc.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, items: [] };

  var header = data[0];
  var idx = RM_indexMap_(header);

  RM_requireCols_(idx, ["Data_Caixa", "Tipo", "Valor", "Status"]);

  var items = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    var mes = RM_monthKeyFromDate_(row[idx["Data_Caixa"]]);
    if (!mes || mes !== mesYYYYMM) continue;

    items.push({
      Data_Caixa: RM_dateOut_(row[idx["Data_Caixa"]]),
      Tipo: RM_safeStr_(row[idx["Tipo"]]),
      Categoria: RM_safeStr_(row[idx["Categoria"]]),
      Descricao: RM_safeStr_(row[idx["Descricao"]] || row[idx["Descrição"]]),
      Cliente_Fornecedor: RM_safeStr_(row[idx["Cliente_Fornecedor"]]),
      Forma_Pagamento: RM_safeStr_(row[idx["Forma_Pagamento"]]),
      Valor: RM_round2_(RM_parseNumber_(row[idx["Valor"]])),
      Status: RM_safeStr_(row[idx["Status"]]),
      Instituicao_Financeira: RM_safeStr_(row[idx["Instituicao_Financeira"]]),
      Titularidade: RM_safeStr_(row[idx["Titularidade"]])
    });
  }

  return { ok: true, items: items };
}
