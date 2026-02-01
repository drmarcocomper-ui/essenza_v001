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
 * Actions (via Api/Registry):
 * - Categoria.Criar
 * - Categoria.Editar
 * - Categoria.Listar
 *
 * Observação:
 * - Usa JSONP via Api.gs/Registry.gs
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
// DISPATCH (chamado via Registry prefix "Categoria.")
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

  return { ok: false, code: "NOT_FOUND", message: "Ação desconhecida: " + action };
}

// ============================================================
// AÇÕES
// ============================================================
function Categoria_criar_(sheet, payload) {
  payload = payload || {};

  var tipo = CAT_safeStr_(payload.Tipo);
  var categoria = CAT_safeStr_(payload.Categoria);

  if (!tipo) throw new Error("Tipo é obrigatório.");
  if (!categoria) throw new Error("Categoria é obrigatória.");

  var id = CAT_safeStr_(payload.ID_Categoria);
  if (!id) id = CAT_newId_("CAT");

  // evita duplicar ID
  if (CAT_findRowById_(sheet, id) > 0) throw new Error("ID_Categoria já existe: " + id);

  var nowIso = CAT_isoNow_();

  var rowObj = {
    ID_Categoria: id,
    Tipo: tipo,
    Categoria: categoria,
    Descricao_Padrao: CAT_safeStr_(payload.Descricao_Padrao),
    Ativo: CAT_safeStr_(payload.Ativo) || "Sim",
    Ordem: CAT_safeStr_(payload.Ordem),
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

  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = CAT_indexMap_(header);

  var rowRange = sheet.getRange(rowIndex, 1, 1, header.length);
  var current = rowRange.getValues()[0];

  // atualiza campos permitidos
  CAT_setIfExists_(idx, current, "Tipo", payload.Tipo);
  CAT_setIfExists_(idx, current, "Categoria", payload.Categoria);
  CAT_setIfExists_(idx, current, "Descricao_Padrao", payload.Descricao_Padrao);
  CAT_setIfExists_(idx, current, "Ativo", payload.Ativo);
  CAT_setIfExists_(idx, current, "Ordem", payload.Ordem);

  // DataAtualizacao
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

    if (fTipo && tipo !== fTipo) continue;

    // busca textual
    if (qn) {
      var blob = CAT_norm_(tipo + " " + cat + " " + desc + " " + ativo);
      if (blob.indexOf(qn) === -1) continue;
    }

    out.push({
      ID_Categoria: CAT_safeStr_(row[idx["ID_Categoria"]] || ""),
      Tipo: tipo,
      Categoria: cat,
      Descricao_Padrao: desc,
      Ativo: ativo,
      Ordem: (ordem === null || ordem === undefined) ? "" : ordem,
      DataCadastro: CAT_safeStr_(row[idx["DataCadastro"]] || ""),
      DataAtualizacao: CAT_safeStr_(row[idx["DataAtualizacao"]] || ""),
    });

    if (out.length >= 300) break;
  }

  // ordena: Ordem asc (quando houver), depois Categoria asc
  out.sort(function (a, b) {
    var ao = Number(a.Ordem || 0);
    var bo = Number(b.Ordem || 0);
    if (ao !== bo) return ao - bo;

    var ac = (a.Categoria || "").toLowerCase();
    var bc = (b.Categoria || "").toLowerCase();
    if (ac < bc) return -1;
    if (ac > bc) return 1;
    return 0;
  });

  return out;
}

// ============================================================
// HELPERS
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
    if (String(data[i][colId] || "").trim() === id) return i + 1; // 1-based row index
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

function CAT_safeStr_(v) {
  return String(v == null ? "" : v).trim();
}

function CAT_norm_(v) {
  var s = CAT_safeStr_(v).toLowerCase();
  try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (_) {}
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function CAT_rowEmpty_(row) {
  for (var i = 0; i < row.length; i++) {
    if (String(row[i] || "").trim() !== "") return false;
  }
  return true;
}

function CAT_isoNow_() {
  return new Date().toISOString();
}

function CAT_newId_(prefix) {
  var p = String(prefix || "ID").trim() || "ID";
  var rnd = Math.random().toString(16).slice(2, 10);
  var t = Date.now().toString(36);
  return p + "-" + t + "-" + rnd;
}
