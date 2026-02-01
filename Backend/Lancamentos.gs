/** Lancamentos.gs — Módulo Lançamentos — Aba: "Lancamentos"
 * ------------------------------------------------------------
 * Colunas:
 * Data_Competencia, Data_Caixa, Tipo, Origem, Categoria, Descricao,
 * Cliente_Fornecedor, Forma_Pagamento, Instituicao_Financeira, Titularidade,
 * Parcelamento, Valor, Status, Observacoes, Mes_a_receber
 *
 * Actions (via Registry prefix "Lancamentos."):
 * - Lancamentos.Criar
 * - Lancamentos.Listar        ✅ agora retorna rowIndex em cada item
 * - Lancamentos.Editar        ✅ edita por rowIndex (linha real 1-based)
 *
 * Dependências:
 * - Lancamentos.Utils.gs (helpers LANC_*)
 */

// ============================================================
// CONFIG
// ============================================================
var LANC_SHEET_DEFAULT = "Lancamentos";
var LANC_HEADERS = [
  "Data_Competencia",
  "Data_Caixa",
  "Tipo",
  "Origem",
  "Categoria",
  "Descricao",
  "Cliente_Fornecedor",
  "Forma_Pagamento",
  "Instituicao_Financeira",
  "Titularidade",
  "Parcelamento",
  "Valor",
  "Status",
  "Observacoes",
  "Mes_a_receber",
];

// ============================================================
// DISPATCH
// ============================================================
function Lancamentos_dispatch_(action, p) {
  p = p || {};
  var sheetName = LANC_safeStr_(p.sheet) || LANC_SHEET_DEFAULT;

  var sheet = LANC_getOrCreateSheet_(sheetName);
  LANC_ensureHeader_(sheet, LANC_HEADERS);

  if (action === "Lancamentos.Criar") {
    var payload = LANC_parseJsonParam_(p.payload);
    var res = Lancamentos_criar_(sheet, payload);
    res.ok = true;
    return res;
  }

  if (action === "Lancamentos.Editar") {
    var payloadEdit = LANC_parseJsonParam_(p.payload);
    var resEdit = Lancamentos_editar_(sheet, payloadEdit);
    resEdit.ok = true;
    return resEdit;
  }

  if (action === "Lancamentos.Listar") {
    // aceita filtros em JSON
    var filtros = LANC_parseJsonParam_(p.filtros);
    if (!filtros || typeof filtros !== "object") filtros = LANC_parseJsonParam_(p.filtro);
    if (!filtros || typeof filtros !== "object") filtros = {};

    // aceita filtros flat via querystring
    if (LANC_safeStr_(p.fDataIni)) filtros.fDataIni = p.fDataIni;
    if (LANC_safeStr_(p.fDataFim)) filtros.fDataFim = p.fDataFim;
    if (LANC_safeStr_(p.fTipo)) filtros.fTipo = p.fTipo;
    if (LANC_safeStr_(p.fStatus)) filtros.fStatus = p.fStatus;
    if (LANC_safeStr_(p.q)) filtros.q = p.q;

    var items = Lancamentos_listar_(sheet, filtros);
    return { ok: true, items: items, message: "OK" };
  }

  return { ok: false, code: "NOT_FOUND", message: "Ação desconhecida: " + action };
}

// ============================================================
// AÇÕES
// ============================================================
function Lancamentos_criar_(sheet, payload) {
  payload = payload || {};

  var dc = LANC_safeStr_(payload.Data_Competencia);
  var tipo = LANC_safeStr_(payload.Tipo);
  var desc = LANC_safeStr_(payload.Descricao);
  var valor = payload.Valor;

  if (!dc) throw new Error("Data_Competencia é obrigatório.");
  if (!tipo) throw new Error("Tipo é obrigatório.");
  if (!desc) throw new Error("Descricao é obrigatório.");
  if (valor === null || valor === undefined || String(valor).trim() === "") throw new Error("Valor é obrigatório.");

  // normalizações
  dc = LANC_normalizeIsoDate_(dc);

  var dcaixa = LANC_safeStr_(payload.Data_Caixa);
  dcaixa = dcaixa ? LANC_normalizeIsoDate_(dcaixa) : "";

  var valNum = LANC_parseNumber_(valor);

  var rowObj = {
    Data_Competencia: dc,
    Data_Caixa: dcaixa,
    Tipo: tipo,
    Origem: LANC_safeStr_(payload.Origem),
    Categoria: LANC_safeStr_(payload.Categoria),
    Descricao: desc,
    Cliente_Fornecedor: LANC_safeStr_(payload.Cliente_Fornecedor),
    Forma_Pagamento: LANC_safeStr_(payload.Forma_Pagamento),
    Instituicao_Financeira: LANC_safeStr_(payload.Instituicao_Financeira),
    Titularidade: LANC_safeStr_(payload.Titularidade),
    Parcelamento: LANC_safeStr_(payload.Parcelamento),
    Valor: valNum,
    Status: LANC_safeStr_(payload.Status),
    Observacoes: LANC_safeStr_(payload.Observacoes),
    Mes_a_receber: LANC_safeStr_(payload.Mes_a_receber), // YYYY-MM
  };

  var values = LANC_HEADERS.map(function (h) {
    return rowObj[h] !== undefined ? rowObj[h] : "";
  });

  sheet.appendRow(values);

  return { message: "Lançamento salvo." };
}

/**
 * ✅ Edita um lançamento por rowIndex (linha real 1-based).
 * Payload:
 * { rowIndex: <number>, data: {campo: valor, ...} }
 */
function Lancamentos_editar_(sheet, payload) {
  payload = payload || {};
  var rowIndex = Number(payload.rowIndex || 0); // 1-based
  var data = payload.data || {};

  if (!rowIndex || rowIndex < 2) {
    throw new Error("rowIndex inválido (use a linha real 1-based; mínimo 2).");
  }
  if (!data || typeof data !== "object") {
    throw new Error("payload.data é obrigatório (objeto com campos a atualizar).");
  }

  // Normalizações úteis
  if (data.Valor !== undefined) data.Valor = LANC_parseNumber_(data.Valor);
  if (data.Data_Competencia) data.Data_Competencia = LANC_normalizeIsoDate_(data.Data_Competencia);
  if (data.Data_Caixa) data.Data_Caixa = LANC_normalizeIsoDate_(data.Data_Caixa);

  // Header/índices
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = LANC_indexMap_(header);

  // Lê linha atual
  var rowRange = sheet.getRange(rowIndex, 1, 1, header.length);
  var current = rowRange.getValues()[0];

  // Aplica alterações apenas em colunas existentes
  Object.keys(data).forEach(function (k) {
    if (idx[k] === undefined) return;
    current[idx[k]] = data[k];
  });

  // Salva
  rowRange.setValues([current]);

  return { message: "Lançamento atualizado.", rowIndex: rowIndex };
}

function Lancamentos_listar_(sheet, filtros) {
  filtros = filtros || {};

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var header = data[0];
  var idx = LANC_indexMap_(header);

  // campo de data do filtro (default Data_Competencia)
  var dateField = LANC_safeStr_(filtros.dateField || "Data_Competencia");
  if (dateField !== "Data_Competencia" && dateField !== "Data_Caixa") dateField = "Data_Competencia";

  var fIni = LANC_safeStr_(filtros.fDataIni || "");
  var fFim = LANC_safeStr_(filtros.fDataFim || "");
  var fTipo = LANC_safeStr_(filtros.fTipo || "");
  var fStatus = LANC_safeStr_(filtros.fStatus || "");
  var q = LANC_safeStr_(filtros.q || "");

  var iniDate = fIni ? LANC_parseIsoDateToDate_(fIni) : null;
  var fimDate = fFim ? LANC_parseIsoDateToDate_(fFim) : null;
  var qNorm = q ? LANC_normalize_(q) : "";

  var out = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    var dValue = row[idx[dateField]];
    var tipo = LANC_safeStr_(row[idx["Tipo"]]);
    var status = LANC_safeStr_(row[idx["Status"]]);

    // filtro de data (aceita Date ou string)
    if (iniDate || fimDate) {
      var dDate = LANC_parseAnyToDate_(dValue);
      if (!dDate) continue;

      if (iniDate && dDate < iniDate) continue;
      if (fimDate && dDate > fimDate) continue;
    }

    // Tipo / Status
    if (fTipo && tipo !== fTipo) continue;
    if (fStatus && status !== fStatus) continue;

    // Busca textual
    if (qNorm) {
      var desc = LANC_normalize_(row[idx["Descricao"]] || "");
      var cli = LANC_normalize_(row[idx["Cliente_Fornecedor"]] || "");
      var cat = LANC_normalize_(row[idx["Categoria"]] || "");
      var org = LANC_normalize_(row[idx["Origem"]] || "");

      if (
        desc.indexOf(qNorm) === -1 &&
        cli.indexOf(qNorm) === -1 &&
        cat.indexOf(qNorm) === -1 &&
        org.indexOf(qNorm) === -1
      ) {
        continue;
      }
    }

    var obj = LANC_rowToObj_(header, row);
    obj.rowIndex = i + 1; // ✅ linha real (1-based)
    out.push(obj);

    if (out.length >= 300) break;
  }

  // ordena por Data_Competencia desc
  out.sort(function (a, b) {
    var da = LANC_parseAnyToDate_(a.Data_Competencia);
    var db = LANC_parseAnyToDate_(b.Data_Competencia);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db.getTime() - da.getTime();
  });

  return out;
}

// ============================================================
// SHEET / SCHEMA
// ============================================================
function LANC_getOrCreateSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function LANC_ensureHeader_(sheet, headers) {
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.clearDataValidations();

  var lastCol = sheet.getLastColumn();
  if (lastCol === 0 || sheet.getLastRow() === 0) {
    headerRange.setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }

  var current = sheet
    .getRange(1, 1, 1, Math.max(lastCol, headers.length))
    .getValues()[0];

  var mismatch = false;
  for (var i = 0; i < headers.length; i++) {
    if (String(current[i] || "").trim() !== headers[i]) {
      mismatch = true;
      break;
    }
  }

  if (mismatch) {
    headerRange.setValues([headers]);
    sheet.setFrozenRows(1);
  }
}
