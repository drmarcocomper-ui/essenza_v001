/**
 * AuditLog.gs — Registro de auditoria
 * ------------------------------------
 * Registra acoes importantes em uma aba "AuditLog".
 * Fire-and-forget: erros de logging nunca quebram o fluxo principal.
 */

var AUDIT_SHEET_NAME = "AuditLog";
var AUDIT_HEADERS = ["Timestamp", "Action", "User", "Details"];

/**
 * Registra uma entrada no log de auditoria.
 * @param {string} action - Nome da acao (ex: "Auth.Login", "Lancamentos.Criar")
 * @param {Object} details - Detalhes da acao
 * @param {string} [token] - Token do usuario (opcional)
 */
function AuditLog_log_(action, details, token) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(AUDIT_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(AUDIT_SHEET_NAME);
      sheet.getRange(1, 1, 1, AUDIT_HEADERS.length).setValues([AUDIT_HEADERS]);
      sheet.setFrozenRows(1);
    }

    var user = token ? String(token).substring(0, 8) + "..." : "anonymous";
    var detailsStr = "";
    try {
      detailsStr = JSON.stringify(details || {});
    } catch (_) {
      detailsStr = String(details || "");
    }

    sheet.appendRow([
      new Date(),
      String(action || ""),
      user,
      detailsStr
    ]);
  } catch (_) {
    // Nunca quebrar o fluxo principal
  }
}

/**
 * Retorna as ultimas N entradas do log.
 * @param {number} [limit=50] - Numero de entradas
 * @returns {Array<Object>}
 */
function AuditLog_getRecent_(limit) {
  limit = limit || 50;

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(AUDIT_SHEET_NAME);
    if (!sheet) return [];

    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    var startRow = Math.max(2, lastRow - limit + 1);
    var numRows = lastRow - startRow + 1;
    var data = sheet.getRange(startRow, 1, numRows, AUDIT_HEADERS.length).getValues();

    var items = [];
    for (var i = data.length - 1; i >= 0; i--) {
      items.push({
        Timestamp: data[i][0],
        Action: data[i][1],
        User: data[i][2],
        Details: data[i][3]
      });
    }

    return items;
  } catch (_) {
    return [];
  }
}
