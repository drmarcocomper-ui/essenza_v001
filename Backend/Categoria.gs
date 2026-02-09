/**
 * Categoria.gs — Módulo de padronização (Categoria + Descricao)
 * ------------------------------------------------------------
 * Aba: "Categoria"
 *
 * Colunas (headers):
 * - ID_Categoria
 * - Tipo                (Entrada | Saida | Transferência)
 * - Categoria
 * - Descricao_Padrao
 * - Ativo               (Sim | Nao)
 * - Ordem               (número; opcional)
 * - DataCadastro        (ISO)
 * - DataAtualizacao     (ISO)
 *
 * Actions (via Registry prefix "Categoria."):
 * - Categoria.Criar
 * - Categoria.Editar
 * - Categoria.Listar
 *
 * Dependências:
 * - Categoria.Utils.gs (CAT_* helpers)
 */

var CAT_SHEET_DEFAULT = "Categoria";
var CAT_HEADERS = [
  "ID_Categoria",
  "Tipo",
  "Categoria",
  "Descricao_Padrao",
  "Ativo",
  "Ordem",
  "DataCadastro",
  "DataAtualizacao",
];

// ============================================================
// DISPATCH
// ============================================================
function Categoria_dispatch_(action, p) {
  p = p || {};
  var sheetName = CAT_safeStr_(p.sheet) || CAT_SHEET_DEFAULT;

  var sheet = CAT_getOrCreateSheet_(sheetName);
  CAT_ensureHeader_(sheet, CAT_HEADERS);

  if (action === "Categoria.Criar") {
    var payload = CAT_parseJsonParam_(p.payload);
    var res = Categoria_criar_(sheet, payload);
    res.ok = true;
    return res;
  }

  if (action === "Categoria.Editar") {
    var payloadE = CAT_parseJsonParam_(p.payload);
    var resE = Categoria_editar_(sheet, payloadE);
    resE.ok = true;
    return resE;
  }

  if (action === "Categoria.Listar") {
    var filtros = CAT_parseJsonParam_(p.filtros);
    if (!filtros || typeof filtros !== "object") filtros = {};
    var items = Categoria_listar_(sheet, filtros);
    return { ok: true, items: items, message: "OK" };
  }

  if (action === "Categoria.Excluir") {
    var rowIndex = Number(p.rowIndex);
    if (!rowIndex || rowIndex < 2) throw new Error("rowIndex inválido.");
    sheet.deleteRow(rowIndex);
    return { ok: true, message: "Categoria excluída." };
  }

  return { ok: false, code: "NOT_FOUND", message: "Ação desconhecida: " + action };
}

// ============================================================
// AÇÕES
// ============================================================
function Categoria_criar_(sheet, payload) {
  payload = payload || {};

  var tipo = CAT_safeStr_(payload.Tipo);
  var categoria = CAT_safeStr_(payload.Categoria);

  if (!CAT_isValidTipo_(tipo)) throw new Error("Tipo inválido. Use: Entrada, Saida ou Transferência.");
  if (!categoria) throw new Error("Categoria é obrigatória.");

  var ativo = CAT_toAtivo_(payload.Ativo);
  if (!CAT_isValidAtivo_(ativo)) throw new Error("Ativo inválido. Use: Sim ou Nao.");

  var id = CAT_safeStr_(payload.ID_Categoria);
  if (!id) id = CAT_newId_("CAT");

  if (CAT_findRowById_(sheet, id) > 0) throw new Error("ID_Categoria já existe: " + id);

  var nowIso = CAT_isoNow_();

  var rowObj = {
    ID_Categoria: id,
    Tipo: tipo,
    Categoria: categoria,
    Descricao_Padrao: CAT_safeStr_(payload.Descricao_Padrao),
    Ativo: ativo,
    Ordem: CAT_toOrdem_(payload.Ordem),
    DataCadastro: nowIso,
    DataAtualizacao: nowIso,
  };

  sheet.appendRow(CAT_toRowValues_(rowObj));
  return { message: "Categoria salva.", id: id };
}

function Categoria_editar_(sheet, payload) {
  payload = payload || {};

  var id = CAT_safeStr_(payload.ID_Categoria);
  if (!id) throw new Error("ID_Categoria é obrigatório para editar.");

  var rowIndex = CAT_findRowById_(sheet, id);
  if (rowIndex < 2) throw new Error("ID_Categoria não encontrado: " + id);

  if (payload.Tipo && !CAT_isValidTipo_(payload.Tipo)) throw new Error("Tipo inválido. Use: Entrada, Saida ou Transferência.");
  if (payload.Ativo && !CAT_isValidAtivo_(payload.Ativo)) throw new Error("Ativo inválido. Use: Sim ou Nao.");

  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = CAT_indexMap_(header);

  var rowRange = sheet.getRange(rowIndex, 1, 1, header.length);
  var current = rowRange.getValues()[0];

  CAT_setIfExists_(idx, current, "Tipo", payload.Tipo);
  CAT_setIfExists_(idx, current, "Categoria", payload.Categoria);
  CAT_setIfExists_(idx, current, "Descricao_Padrao", payload.Descricao_Padrao);
  CAT_setIfExists_(idx, current, "Ativo", payload.Ativo);

  if (payload.Ordem !== undefined) {
    CAT_setIfExists_(idx, current, "Ordem", CAT_toOrdem_(payload.Ordem));
  }

  if (idx["DataAtualizacao"] !== undefined) current[idx["DataAtualizacao"]] = CAT_isoNow_();

  rowRange.setValues([current]);
  return { message: "Categoria atualizada.", id: id };
}

function Categoria_listar_(sheet, filtros) {
  filtros = filtros || {};

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var header = data[0];
  var idx = CAT_indexMap_(header);

  var fTipo = CAT_safeStr_(filtros.fTipo || "");
  var q = CAT_safeStr_(filtros.q || "");
  var somenteAtivos = (String(filtros.somenteAtivos || "").trim() === "1");

  var qn = q ? CAT_norm_(q) : "";

  var out = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (CAT_rowEmpty_(row)) continue;

    var ativo = CAT_safeStr_(row[idx["Ativo"]] || "Sim");
    var tipo = CAT_safeStr_(row[idx["Tipo"]] || "");
    var cat = CAT_safeStr_(row[idx["Categoria"]] || "");
    var desc = CAT_safeStr_(row[idx["Descricao_Padrao"]] || "");
    var ordem = row[idx["Ordem"]];

    if (somenteAtivos && ativo === "Nao") continue;
    if (fTipo && tipo !== fTipo) continue;

    if (qn) {
      var blob = CAT_norm_(tipo + " " + cat + " " + desc + " " + ativo);
      if (blob.indexOf(qn) === -1) continue;
    }

    out.push({
      rowIndex: i + 1,
      ID_Categoria: CAT_safeStr_(row[idx["ID_Categoria"]] || ""),
      Tipo: tipo,
      Categoria: cat,
      Descricao_Padrao: desc,
      Ativo: ativo,
      Ordem: (ordem === null || ordem === undefined) ? "" : ordem,
      DataCadastro: CAT_safeStr_(row[idx["DataCadastro"]] || ""),
      DataAtualizacao: CAT_safeStr_(row[idx["DataAtualizacao"]] || ""),
    });

    if (out.length >= 500) break;
  }

  out.sort(CAT_sortByOrdemThenCategoria_);
  return out;
}

// ============================================================
// HELPERS (internos ao módulo)
// ============================================================
function CAT_toRowValues_(rowObj) {
  return CAT_HEADERS.map(function (h) {
    return rowObj[h] !== undefined ? rowObj[h] : "";
  });
}

function CAT_setIfExists_(idx, currentRow, key, value) {
  if (idx[key] === undefined) return;
  currentRow[idx[key]] = CAT_safeStr_(value);
}

function CAT_findRowById_(sheet, id) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return -1;

  var header = data[0];
  var idx = CAT_indexMap_(header);
  var colId = idx["ID_Categoria"];
  if (colId === undefined) return -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colId] || "").trim() === id) return i + 1;
  }
  return -1;
}

function CAT_getOrCreateSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function CAT_ensureHeader_(sheet, headers) {
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

function CAT_parseJsonParam_(s) {
  var raw = (s || "").toString();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

function CAT_indexMap_(headerRow) {
  var map = {};
  for (var i = 0; i < headerRow.length; i++) {
    var k = String(headerRow[i] || "").trim();
    if (k) map[k] = i;
  }
  return map;
}

function CAT_rowEmpty_(row) {
  for (var i = 0; i < row.length; i++) {
    if (String(row[i] || "").trim() !== "") return false;
  }
  return true;
}
