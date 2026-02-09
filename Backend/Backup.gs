/**
 * Backup.gs — Módulo de Backup
 * ----------------------------
 * Actions:
 * - Backup.ExportarTodos: Retorna todos os dados das abas para backup
 *
 * Dependências:
 * - Registry.gs (registro da rota)
 */

var BACKUP_SHEETS = ["Cadastro", "Lancamentos", "Categoria", "Fornecedores"];

// ============================================================
// DISPATCH
// ============================================================
function Backup_dispatch_(action, e) {
  if (action === "Backup.ExportarTodos") {
    return Backup_exportarTodos_();
  }

  return { ok: false, code: "NOT_FOUND", message: "Ação desconhecida: " + action };
}

// ============================================================
// AÇÕES
// ============================================================

/**
 * Exporta todos os dados das abas principais
 * Retorna um objeto com dados de cada aba
 */
function Backup_exportarTodos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var resultado = {
    ok: true,
    timestamp: new Date().toISOString(),
    sheets: {}
  };

  for (var i = 0; i < BACKUP_SHEETS.length; i++) {
    var sheetName = BACKUP_SHEETS[i];
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      resultado.sheets[sheetName] = {
        exists: false,
        headers: [],
        data: []
      };
      continue;
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    if (lastRow === 0 || lastCol === 0) {
      resultado.sheets[sheetName] = {
        exists: true,
        headers: [],
        data: []
      };
      continue;
    }

    var allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = allData[0];
    var rows = [];

    for (var r = 1; r < allData.length; r++) {
      var row = allData[r];
      var obj = {};
      var hasData = false;

      for (var c = 0; c < headers.length; c++) {
        var key = String(headers[c] || "").trim();
        if (!key) continue; // Pular colunas sem header

        var val = row[c];

        // Converter datas para ISO string
        if (Object.prototype.toString.call(val) === "[object Date]" && !isNaN(val.getTime())) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
        }

        // Converter valores para string se necessário
        if (val === null || val === undefined) {
          val = "";
        } else if (typeof val === "number" || typeof val === "boolean") {
          val = String(val);
        }

        obj[key] = val;
        if (String(val).trim() !== "") hasData = true;
      }

      // Só adiciona linhas que têm pelo menos um dado
      if (hasData) {
        rows.push(obj);
      }
    }

    resultado.sheets[sheetName] = {
      exists: true,
      headers: headers.map(function(h) { return String(h || "").trim(); }),
      data: rows,
      count: rows.length
    };
  }

  resultado.message = "Backup exportado com sucesso.";
  return resultado;
}
