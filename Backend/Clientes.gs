/**
 * Clientes.gs — Feature: Clientes (Cadastro)
 * -----------------------------------------
 * Aba: "Cadastro"
 *
 * Actions (via Registry):
 * - Clientes.GerarID
 * - Clientes.Criar   (payload JSON em p.payload)
 * - Clientes.Buscar  (q em p.q)  ✅ agora retorna lista mesmo com q vazio
 *
 * Dependências:
 * - Clientes.Utils.gs (Clientes_* helpers)
 */

var CLIENTES_SHEET_NAME = "Cadastro";

var CLIENTES_HEADERS = [
  "ID_Cliente",
  "NomeCliente",
  "Telefone",
  "E-mail",
  "DataNascimento",
  "Municipio",
  "Bairro",
  "DataCadastro",
  "Profissão",
  "Preferências",
  "Origem",
  "Observação",
  "Status",
];

// ============================================================
// API WRAPPERS (chamadas pelo Registry)
// ============================================================
function Clientes_GerarIDApi_(e) {
  var id = Clientes_gerarIdSequencial_("CLIENTES_SEQ");
  return { ok: true, id: id, message: "ID gerado." };
}

function Clientes_CriarApi_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var payload = Clientes_parseJsonParam_(p.payload);

  var sheet = Clientes_getOrCreateSheet_(CLIENTES_SHEET_NAME);
  Clientes_ensureHeader_(sheet, CLIENTES_HEADERS);

  var result = Clientes_criar_(sheet, payload);
  result.ok = true;
  return result;
}

function Clientes_BuscarApi_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var q = Clientes_safeStr_(p.q);

  var sheet = Clientes_getOrCreateSheet_(CLIENTES_SHEET_NAME);
  Clientes_ensureHeader_(sheet, CLIENTES_HEADERS);

  var items = Clientes_buscar_(sheet, q);
  return { ok: true, items: items, message: "OK" };
}

function Clientes_EditarApi_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var rowIndex = Number(p.rowIndex);
  var payload = Clientes_parseJsonParam_(p.payload);

  if (!rowIndex || rowIndex < 2) throw new Error("rowIndex inválido.");

  var sheet = Clientes_getOrCreateSheet_(CLIENTES_SHEET_NAME);
  Clientes_ensureHeader_(sheet, CLIENTES_HEADERS);

  Clientes_editar_(sheet, rowIndex, payload);
  return { ok: true, message: "Cliente atualizado." };
}

function Clientes_InativarApi_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var rowIndex = Number(p.rowIndex);

  if (!rowIndex || rowIndex < 2) throw new Error("rowIndex inválido.");

  var sheet = Clientes_getOrCreateSheet_(CLIENTES_SHEET_NAME);
  Clientes_ensureHeader_(sheet, CLIENTES_HEADERS);

  Clientes_setStatus_(sheet, rowIndex, "Inativo");
  return { ok: true, message: "Cliente inativado." };
}

function Clientes_AtivarApi_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var rowIndex = Number(p.rowIndex);

  if (!rowIndex || rowIndex < 2) throw new Error("rowIndex inválido.");

  var sheet = Clientes_getOrCreateSheet_(CLIENTES_SHEET_NAME);
  Clientes_ensureHeader_(sheet, CLIENTES_HEADERS);

  Clientes_setStatus_(sheet, rowIndex, "Ativo");
  return { ok: true, message: "Cliente reativado." };
}

function Clientes_ExcluirApi_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var rowIndex = Number(p.rowIndex);

  if (!rowIndex || rowIndex < 2) throw new Error("rowIndex inválido.");

  var sheet = Clientes_getOrCreateSheet_(CLIENTES_SHEET_NAME);

  sheet.deleteRow(rowIndex);
  return { ok: true, message: "Cliente excluído." };
}

// ============================================================
// CORE
// ============================================================
function Clientes_criar_(sheet, payload) {
  payload = payload || {};

  var nome = Clientes_safeStr_(payload.NomeCliente);
  var tel = Clientes_safeStr_(payload.Telefone);

  if (!nome) throw new Error("NomeCliente é obrigatório.");
  if (!tel) throw new Error("Telefone é obrigatório.");

  var id = Clientes_safeStr_(payload.ID_Cliente);
  if (!id) id = Clientes_gerarIdSequencial_("CLIENTES_SEQ");

  if (Clientes_findRowById_(sheet, id) > 0) {
    throw new Error("ID_Cliente já existe: " + id);
  }

  var dataCadastro = Clientes_safeStr_(payload.DataCadastro) || Clientes_isoDate_(new Date());

  var rowObj = {
    "ID_Cliente": id,
    "NomeCliente": nome,
    "Telefone": tel,
    "E-mail": Clientes_safeStr_(payload["E-mail"]),
    "DataNascimento": Clientes_safeStr_(payload.DataNascimento),
    "Municipio": Clientes_safeStr_(payload.Municipio),
    "Bairro": Clientes_safeStr_(payload.Bairro),
    "DataCadastro": dataCadastro,
    "Profissão": Clientes_safeStr_(payload["Profissão"]),
    "Preferências": Clientes_safeStr_(payload["Preferências"]),
    "Origem": Clientes_safeStr_(payload.Origem),
    "Observação": Clientes_safe_attachObs_(payload),
  };

  var values = CLIENTES_HEADERS.map(function (h) { return rowObj[h] || ""; });
  sheet.appendRow(values);

  return { id: id, message: "Cadastro salvo." };
}

function Clientes_safe_attachObs_(payload) {
  // mantém compat caso venha "Observacoes" ou variações
  return Clientes_safeStr_(payload["Observação"] || payload.Observacao || payload.Observacoes || "");
}

function Clientes_editar_(sheet, rowIndex, payload) {
  payload = payload || {};

  var nome = Clientes_safeStr_(payload.NomeCliente);
  var tel = Clientes_safeStr_(payload.Telefone);

  if (!nome) throw new Error("NomeCliente é obrigatório.");
  if (!tel) throw new Error("Telefone é obrigatório.");

  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = Clientes_indexMap_(header);

  // Manter ID e DataCadastro originais
  var rowData = sheet.getRange(rowIndex, 1, 1, header.length).getValues()[0];
  var idOriginal = rowData[idx["ID_Cliente"]] || "";
  var dataCadastroOriginal = rowData[idx["DataCadastro"]] || "";
  var statusOriginal = rowData[idx["Status"]] || "Ativo";

  var rowObj = {
    "ID_Cliente": idOriginal,
    "NomeCliente": nome,
    "Telefone": tel,
    "E-mail": Clientes_safeStr_(payload["E-mail"]),
    "DataNascimento": Clientes_safeStr_(payload.DataNascimento),
    "Municipio": Clientes_safeStr_(payload.Municipio),
    "Bairro": Clientes_safeStr_(payload.Bairro),
    "DataCadastro": dataCadastroOriginal,
    "Profissão": Clientes_safeStr_(payload["Profissão"]),
    "Preferências": Clientes_safeStr_(payload["Preferências"]),
    "Origem": Clientes_safeStr_(payload.Origem),
    "Observação": Clientes_safe_attachObs_(payload),
    "Status": statusOriginal,
  };

  var values = CLIENTES_HEADERS.map(function (h) { return rowObj[h] || ""; });
  sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
}

function Clientes_setStatus_(sheet, rowIndex, status) {
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = Clientes_indexMap_(header);

  var colStatus = idx["Status"];
  if (colStatus === undefined) {
    // Adicionar coluna Status se não existir
    Clientes_ensureHeader_(sheet, CLIENTES_HEADERS);
    colStatus = CLIENTES_HEADERS.indexOf("Status");
  }

  sheet.getRange(rowIndex, colStatus + 1).setValue(status);
}

/**
 * ✅ Buscar clientes:
 * - Se q vazio: retorna até 50 clientes (NomeCliente preenchido)
 * - Se q preenchido: filtra por NomeCliente/Telefone/E-mail
 */
function Clientes_buscar_(sheet, q) {
  q = Clientes_safeStr_(q);

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var header = data[0];
  var idx = Clientes_indexMap_(header);

  // ✅ se q vazio, retorna lista padrão (até 100)
  if (!q) {
    var outAll = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var nome = String(row[idx["NomeCliente"]] || "").trim();
      if (!nome) continue;

      var obj = Clientes_rowToObj_(header, row);
      obj.rowIndex = i + 1; // Adiciona rowIndex
      outAll.push(obj);
      if (outAll.length >= 100) break;
    }
    // Ordenar alfabeticamente por NomeCliente
    outAll.sort(Clientes_sortByNome_);
    return outAll;
  }

  var qNorm = Clientes_normalize_(q);
  var out = [];

  for (var j = 1; j < data.length; j++) {
    var r = data[j];

    var nome2 = Clientes_normalize_(r[idx["NomeCliente"]] || "");
    var tel = Clientes_normalize_(r[idx["Telefone"]] || "");
    var email = Clientes_normalize_(r[idx["E-mail"]] || "");

    if (nome2.indexOf(qNorm) !== -1 || tel.indexOf(qNorm) !== -1 || email.indexOf(qNorm) !== -1) {
      var obj = Clientes_rowToObj_(header, r);
      obj.rowIndex = j + 1; // Adiciona rowIndex
      out.push(obj);
      if (out.length >= 100) break;
    }
  }

  // Ordenar alfabeticamente por NomeCliente
  out.sort(Clientes_sortByNome_);
  return out;
}

// Função de ordenação por NomeCliente (A-Z)
function Clientes_sortByNome_(a, b) {
  var nomeA = Clientes_normalize_(a.NomeCliente || "");
  var nomeB = Clientes_normalize_(b.NomeCliente || "");
  if (nomeA < nomeB) return -1;
  if (nomeA > nomeB) return 1;
  return 0;
}

// ============================================================
// SHEET / SCHEMA
// ============================================================
function Clientes_getOrCreateSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function Clientes_ensureHeader_(sheet, headers) {
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

function Clientes_findRowById_(sheet, id) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return -1;

  var header = data[0];
  var idx = Clientes_indexMap_(header);
  var colId = idx["ID_Cliente"];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colId] || "").trim() === id) return i + 1;
  }
  return -1;
}

// ============================================================
// ID SEQUENCIAL
// ============================================================
function Clientes_gerarIdSequencial_(propKey) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var props = PropertiesService.getScriptProperties();
    var last = Number(props.getProperty(propKey) || "0");
    var next = last + 1;
    props.setProperty(propKey, String(next));

    var d = new Date();
    return "CL-" +
      d.getFullYear() +
      Clientes_pad2_(d.getMonth() + 1) +
      Clientes_pad2_(d.getDate()) +
      "-" +
      String(next).padStart(4, "0");
  } finally {
    lock.releaseLock();
  }
}
