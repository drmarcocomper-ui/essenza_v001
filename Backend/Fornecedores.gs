/**
 * Fornecedores.gs — Feature: Fornecedores
 * -----------------------------------------
 * Aba: "Fornecedores"
 *
 * Actions (via Registry):
 * - Fornecedores.GerarID
 * - Fornecedores.Criar   (payload JSON em p.payload)
 * - Fornecedores.Buscar  (q em p.q)
 *
 * Dependências:
 * - Fornecedores.Utils.gs (Fornecedores_* helpers)
 */

var FORNECEDORES_SHEET_NAME = "Fornecedores";

var FORNECEDORES_HEADERS = [
  "ID_Fornecedor",
  "NomeFornecedor",
  "Telefone",
  "E-mail",
  "CNPJ_CPF",
  "Categoria",
  "Endereco",
  "DataCadastro",
  "Observacao",
];

// ============================================================
// API WRAPPERS (chamadas pelo Registry)
// ============================================================
function Fornecedores_GerarIDApi_(e) {
  var id = Fornecedores_gerarIdSequencial_("FORNECEDORES_SEQ");
  return { ok: true, id: id, message: "ID gerado." };
}

function Fornecedores_CriarApi_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var payload = Fornecedores_parseJsonParam_(p.payload);

  var sheet = Fornecedores_getOrCreateSheet_(FORNECEDORES_SHEET_NAME);
  Fornecedores_ensureHeader_(sheet, FORNECEDORES_HEADERS);

  var result = Fornecedores_criar_(sheet, payload);
  result.ok = true;
  return result;
}

function Fornecedores_BuscarApi_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var q = Fornecedores_safeStr_(p.q);

  var sheet = Fornecedores_getOrCreateSheet_(FORNECEDORES_SHEET_NAME);
  Fornecedores_ensureHeader_(sheet, FORNECEDORES_HEADERS);

  var items = Fornecedores_buscar_(sheet, q);
  return { ok: true, items: items, message: "OK" };
}

// ============================================================
// CORE
// ============================================================
function Fornecedores_criar_(sheet, payload) {
  payload = payload || {};

  var nome = Fornecedores_safeStr_(payload.NomeFornecedor);

  if (!nome) throw new Error("NomeFornecedor é obrigatório.");

  var id = Fornecedores_safeStr_(payload.ID_Fornecedor);
  if (!id) id = Fornecedores_gerarIdSequencial_("FORNECEDORES_SEQ");

  if (Fornecedores_findRowById_(sheet, id) > 0) {
    throw new Error("ID_Fornecedor já existe: " + id);
  }

  var dataCadastro = Fornecedores_safeStr_(payload.DataCadastro) || Fornecedores_isoDate_(new Date());

  var rowObj = {
    "ID_Fornecedor": id,
    "NomeFornecedor": nome,
    "Telefone": Fornecedores_safeStr_(payload.Telefone),
    "E-mail": Fornecedores_safeStr_(payload["E-mail"]),
    "CNPJ_CPF": Fornecedores_safeStr_(payload.CNPJ_CPF),
    "Categoria": Fornecedores_safeStr_(payload.Categoria),
    "Endereco": Fornecedores_safeStr_(payload.Endereco),
    "DataCadastro": dataCadastro,
    "Observacao": Fornecedores_safeStr_(payload.Observacao || payload.Observacoes || ""),
  };

  var values = FORNECEDORES_HEADERS.map(function (h) { return rowObj[h] || ""; });
  sheet.appendRow(values);

  return { id: id, message: "Fornecedor salvo." };
}

/**
 * Buscar fornecedores:
 * - Se q vazio: retorna até 50 fornecedores
 * - Se q preenchido: filtra por NomeFornecedor/Telefone/E-mail/CNPJ_CPF
 */
function Fornecedores_buscar_(sheet, q) {
  q = Fornecedores_safeStr_(q);

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var header = data[0];
  var idx = Fornecedores_indexMap_(header);

  // se q vazio, retorna lista padrão (até 50)
  if (!q) {
    var outAll = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var nome = String(row[idx["NomeFornecedor"]] || "").trim();
      if (!nome) continue;

      outAll.push(Fornecedores_rowToObj_(header, row));
      if (outAll.length >= 50) break;
    }
    // Ordenar alfabeticamente por NomeFornecedor
    outAll.sort(Fornecedores_sortByNome_);
    return outAll;
  }

  var qNorm = Fornecedores_normalize_(q);
  var out = [];

  for (var j = 1; j < data.length; j++) {
    var r = data[j];

    var nome2 = Fornecedores_normalize_(r[idx["NomeFornecedor"]] || "");
    var tel = Fornecedores_normalize_(r[idx["Telefone"]] || "");
    var email = Fornecedores_normalize_(r[idx["E-mail"]] || "");
    var cnpj = Fornecedores_normalize_(r[idx["CNPJ_CPF"]] || "");

    if (nome2.indexOf(qNorm) !== -1 || tel.indexOf(qNorm) !== -1 || email.indexOf(qNorm) !== -1 || cnpj.indexOf(qNorm) !== -1) {
      out.push(Fornecedores_rowToObj_(header, r));
      if (out.length >= 50) break;
    }
  }

  // Ordenar alfabeticamente por NomeFornecedor
  out.sort(Fornecedores_sortByNome_);
  return out;
}

// Função de ordenação por NomeFornecedor (A-Z)
function Fornecedores_sortByNome_(a, b) {
  var nomeA = String(a.NomeFornecedor || "").toLowerCase();
  var nomeB = String(b.NomeFornecedor || "").toLowerCase();
  return nomeA.localeCompare(nomeB, "pt-BR");
}

// ============================================================
// SHEET / SCHEMA
// ============================================================
function Fornecedores_getOrCreateSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function Fornecedores_ensureHeader_(sheet, headers) {
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.clearDataValidations();

  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    headerRange.setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }

  var current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var mismatch = false;
  for (var i = 0; i < headers.length; i++) {
    if (String(current[i] || "").trim() !== headers[i]) { mismatch = true; break; }
  }

  if (mismatch) {
    headerRange.setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function Fornecedores_findRowById_(sheet, id) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return -1;

  var header = data[0];
  var idx = Fornecedores_indexMap_(header);
  var colId = idx["ID_Fornecedor"];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colId] || "").trim() === id) return i + 1;
  }
  return -1;
}

// ============================================================
// ID SEQUENCIAL
// ============================================================
function Fornecedores_gerarIdSequencial_(propKey) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var props = PropertiesService.getScriptProperties();
    var last = Number(props.getProperty(propKey) || "0");
    var next = last + 1;
    props.setProperty(propKey, String(next));

    var d = new Date();
    return "FN-" +
      d.getFullYear() +
      Fornecedores_pad2_(d.getMonth() + 1) +
      Fornecedores_pad2_(d.getDate()) +
      "-" +
      String(next).padStart(4, "0");
  } finally {
    lock.releaseLock();
  }
}
