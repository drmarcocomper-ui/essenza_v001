/**
 * ResumoMensal.gs — OPÇÃO A (sem aba Resumo_Mensal)
 * ------------------------------------------------------------
 * Fonte: aba "Lancamentos"
 * ✅ Agrupa por mês usando Data_Caixa (padrão)
 * ✅ Separa Entradas Pagas por Forma_Pagamento e Instituicao_Financeira
 *
 * Dependência:
 * - ResumoMensal.Utils.gs (RM_*)
 */

var RM_SHEET_LANC = "Lancamentos";

function ResumoMensal_CalcularApi_(e) {
  var mes = "";
  try { mes = e && e.parameter && e.parameter.mes ? String(e.parameter.mes).trim() : ""; } catch (_) {}
  return ResumoMensal_Calcular(mes);
}

function ResumoMensal_DetalharMesApi_(e) {
  var mes = "";
  try { mes = e && e.parameter && e.parameter.mes ? String(e.parameter.mes).trim() : ""; } catch (_) {}
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) throw new Error("Parâmetro 'mes' é obrigatório e deve estar em YYYY-MM.");
  return ResumoMensal_DetalharMes(mes);
}

function ResumoMensal_Calcular(mesYYYYMM) {
  mesYYYYMM = RM_safeStr_(mesYYYYMM);
  if (mesYYYYMM && !/^\d{4}-\d{2}$/.test(mesYYYYMM)) throw new Error("Parâmetro 'mes' inválido. Use YYYY-MM.");

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shLanc = ss.getSheetByName(RM_SHEET_LANC);
  if (!shLanc) throw new Error("Aba não encontrada: " + RM_SHEET_LANC);

  var data = shLanc.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, items: [] };

  var header = data[0];
  var idx = RM_indexMap_(header);

  RM_requireCols_(idx, [
    "Mes_a_receber",
    "Tipo",
    "Status",
    "Valor",
    "Forma_Pagamento",
    "Instituicao_Financeira",
    "Titularidade",
  ]);

  var buckets = {}; // { "YYYY-MM": acc }

  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    // Extrair mês de Mes_a_receber (pode ser YYYY-MM, YYYY-MM-DD ou Date)
    var mes = RM_extractMonth_(row[idx["Mes_a_receber"]]);
    if (!mes) continue;
    if (mesYYYYMM && mes !== mesYYYYMM) continue;

    if (!buckets[mes]) buckets[mes] = RM_newAcc_();

    RM_accumulate_(buckets[mes], {
      tipo: row[idx["Tipo"]],
      status: row[idx["Status"]],
      valor: row[idx["Valor"]],
      forma: row[idx["Forma_Pagamento"]],
      inst: row[idx["Instituicao_Financeira"]],
      titularidade: row[idx["Titularidade"]],
    });
  }

  var meses = Object.keys(buckets).sort().reverse();
  var items = [];

  for (var m = 0; m < meses.length; m++) {
    var key = meses[m];
    var acc = buckets[key];

    var entradasPagas = acc.entradasPagas;
    var entradasPend = acc.entradasPendentes;
    var totalEntradas = entradasPagas + entradasPend;
    var saidas = acc.saidas;

    var resultadoCaixa = entradasPagas - saidas;

    var rowOut = {
      "Mês": key,
      "Entradas Pagas": RM_round2_(entradasPagas),
      "Entradas Pendentes": RM_round2_(entradasPend),
      "Total Entradas": RM_round2_(totalEntradas),
      "Saidas": RM_round2_(saidas),
      "Resultado (Caixa)": RM_round2_(resultadoCaixa),
      "Resultado (Caixa Real)": RM_round2_(resultadoCaixa),

      // ✅ Forma_Pagamento (fixas)
      "Entrada Pix": RM_round2_(acc.porForma.Pix || 0),
      "Entrada Dinheiro": RM_round2_(acc.porForma.Dinheiro || 0),
      "Entrada Cartao_Debito": RM_round2_(acc.porForma.Cartao_Debito || 0),
      "Entrada Cartao_Credito": RM_round2_(acc.porForma.Cartao_Credito || 0),
      "Entrada Boleto": RM_round2_(acc.porForma.Boleto || 0),
      "Entrada Transferencia": RM_round2_(acc.porForma.Transferencia || 0),
      "Entrada Confianca": RM_round2_(acc.porForma.Confianca || 0),
      "Entrada Cortesia": RM_round2_(acc.porForma.Cortesia || 0),

      // ✅ Instituicao_Financeira (fixas)
      "Entrada Nubank": RM_round2_(acc.porInstituicao.Nubank || 0),
      "Entrada PicPay": RM_round2_(acc.porInstituicao.PicPay || 0),
      "Entrada SumUp": RM_round2_(acc.porInstituicao.SumUp || 0),
      "Entrada Terceiro": RM_round2_(acc.porInstituicao.Terceiro || 0),
      "Entrada Dinheiro Inst": RM_round2_(acc.porInstituicao.Dinheiro || 0),
      "Entrada Cortesia Inst": RM_round2_(acc.porInstituicao.Cortesia || 0),

      // ✅ Instituicao + Titularidade (PF/PJ)
      "Nubank PF": RM_round2_(acc.porInstituicaoTitularidade.Nubank_PF || 0),
      "Nubank PJ": RM_round2_(acc.porInstituicaoTitularidade.Nubank_PJ || 0),
      "PicPay PF": RM_round2_(acc.porInstituicaoTitularidade.PicPay_PF || 0),
      "PicPay PJ": RM_round2_(acc.porInstituicaoTitularidade.PicPay_PJ || 0),
      "SumUp PF": RM_round2_(acc.porInstituicaoTitularidade.SumUp_PF || 0),
      "SumUp PJ": RM_round2_(acc.porInstituicaoTitularidade.SumUp_PJ || 0),
      "Terceiro PF": RM_round2_(acc.porInstituicaoTitularidade.Terceiro_PF || 0),
      "Terceiro PJ": RM_round2_(acc.porInstituicaoTitularidade.Terceiro_PJ || 0),
      "Dinheiro PF": RM_round2_(acc.porInstituicaoTitularidade.Dinheiro_PF || 0),
      "Dinheiro PJ": RM_round2_(acc.porInstituicaoTitularidade.Dinheiro_PJ || 0),
      "Cortesia PF": RM_round2_(acc.porInstituicaoTitularidade.Cortesia_PF || 0),
      "Cortesia PJ": RM_round2_(acc.porInstituicaoTitularidade.Cortesia_PJ || 0),
    };

    items.push(rowOut);
  }

  return { ok: true, items: items };
}

function ResumoMensal_DetalharMes(mesYYYYMM) {
  mesYYYYMM = RM_safeStr_(mesYYYYMM);
  if (!mesYYYYMM || !/^\d{4}-\d{2}$/.test(mesYYYYMM)) throw new Error("Parâmetro 'mes' inválido. Use YYYY-MM.");

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shLanc = ss.getSheetByName(RM_SHEET_LANC);
  if (!shLanc) throw new Error("Aba não encontrada: " + RM_SHEET_LANC);

  var data = shLanc.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, items: [] };

  var header = data[0];
  var idx = RM_indexMap_(header);

  RM_requireCols_(idx, ["Mes_a_receber", "Tipo", "Valor", "Status", "Titularidade"]);

  var items = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    // Extrair mês de Mes_a_receber
    var mes = RM_extractMonth_(row[idx["Mes_a_receber"]]);
    if (!mes || mes !== mesYYYYMM) continue;

    items.push({
      Data_Caixa: RM_dateOut_(row[idx["Data_Caixa"]]),
      Tipo: RM_safeStr_(row[idx["Tipo"]]),
      Categoria: RM_safeStr_(row[idx["Categoria"]]),
      Descricao: RM_safeStr_(row[idx["Descricao"]]),
      ID_Cliente: RM_safeStr_(row[idx["ID_Cliente"]]),
      Forma_Pagamento: RM_safeStr_(row[idx["Forma_Pagamento"]]),
      Instituicao_Financeira: RM_safeStr_(row[idx["Instituicao_Financeira"]]),
      Titularidade: RM_safeStr_(row[idx["Titularidade"]]),
      Valor: RM_round2_(RM_parseNumber_(row[idx["Valor"]])),
      Status: RM_safeStr_(row[idx["Status"]]),
    });
  }

  return { ok: true, items: items };
}
