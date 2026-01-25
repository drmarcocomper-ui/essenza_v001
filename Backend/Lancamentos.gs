/** Lacamentos.gs (módulo separado) — Aba: "Lancamentos"
 * ------------------------------------------------------------
 * Colunas:
 * Data_Competencia, Data_Caixa, Tipo, Origem, Categoria, Descricao,
 * Cliente_Fornecedor, Forma_Pagamento, Instituicao_Financeira, Titularidade,
 * Parcelamento, Valor, Status, Observacoes, Mes_a_receber
 *
 * Compatível com WebApp JSONP (Code.gs) chamando actions:
 * - "Lancamentos.Criar"
 * - "Lancamentos.Listar" (com filtros)
 *
 * Router no Code.gs:
 *   if (action.indexOf("Lancamentos.") === 0) return jsonp_(callback, Lancamentos_dispatch_(action, p));
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
  var sheetName = LANC_safeStr_(p.sheet) || LANC_SHEET_DEFAULT;

  var sheet = LANC_getOrCreateSheet_(sheetName);
  LANC_ensureHeader_(sheet, LANC_HEADERS);

  if (action === "Lancamentos.Criar") {
    var payload = LANC_parseJsonParam_(p.payload);
    var res = Lancamentos_criar_(sheet, payload);
    res.ok = true;
    return res;
  }

  if (action === "Lancamentos.Listar") {
    // ✅ aceita "filtros" (padrão atual do lancamentos.js)
    // ✅ aceita também "filtro" (compat antigo)
    var filtros = LANC_parseJsonParam_(p.filtros);
    if (!filtros || typeof filtros !== "object") filtros = LANC_parseJsonParam_(p.filtro);
    if (!filtros || typeof filtros !== "object") filtros = {};

    // também aceita filtros flat via querystring
    if (LANC_safeStr_(p.fDataIni)) filtros.fDataIni = p.fDataIni;
    if (LANC_safeStr_(p.fDataFim)) filtros.fDataFim = p.fDataFim;
    if (LANC_safeStr_(p.fTipo)) filtros.fTipo = p.fTipo;
    if (LANC_safeStr_(p.fStatus)) filtros.fStatus = p.fStatus;
    if (LANC_safeStr_(p.q)) filtros.q = p.q;

    // opcional: filtro por Data_Caixa em vez de Data_Competencia
    // filtros.dateField = "Data_Caixa" (se quiser no futuro)
    var items = Lancamentos_listar_(sheet, filtros);
    return { ok: true, items: items, message: "OK" };
  }

  return { ok: false, code: "NOT_FOUND", message: "Ação desconhecida: " + action };
}

// ============================================================
// AÇÕES
// ============================================================
function Lancamentos_criar_(sheet, payload) {
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

function Lancamentos_listar_(sheet, filtros) {
  filtros = filtros || {};

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var header = data[0];
  var idx = LANC_indexMap_(header);

  // ✅ qual campo de data usar no filtro (default Data_Competencia)
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

    var dValue = LANC_safeStr_(row[idx[dateField]]);
    var tipo = LANC_safeStr_(row[idx["Tipo"]]);
    var status = LANC_safeStr_(row[idx["Status"]]);

    // Data filter
    if (iniDate || fimDate) {
      var dDate = LANC_parseIsoDateToDate_(dValue);
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

    out.push(LANC_rowToObj_(header, row));
    if (out.length >= 300) break;
  }

  // ordena por Data_Competencia desc (mantém padrão da tela)
  out.sort(function (a, b) {
    var da = LANC_parseIsoDateToDate_(a.Data_Competencia);
    var db = LANC_parseIsoDateToDate_(b.Data_Competencia);
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

/** ✅ evita erro de validação no cabeçalho */
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

// ============================================================
// HELPERS
// ============================================================
function LANC_parseJsonParam_(s) {
  var raw = (s || "").toString();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
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
