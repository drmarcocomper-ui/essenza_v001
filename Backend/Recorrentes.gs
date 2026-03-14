/**
 * Recorrentes.gs — Modulo de Transacoes Recorrentes
 * --------------------------------------------------
 * Aba: "Recorrentes" (templates de lancamentos recorrentes)
 *
 * Actions:
 * - Recorrentes.Listar
 * - Recorrentes.Criar
 * - Recorrentes.Editar
 * - Recorrentes.Excluir
 * - Recorrentes.Gerar (gera lancamentos pendentes para um mes)
 */

const REC_SHEET_NAME = "Recorrentes";
const REC_HEADERS = [
  "Tipo",
  "Categoria",
  "Descricao",
  "ID_Cliente",
  "ID_Fornecedor",
  "Forma_Pagamento",
  "Valor",
  "Frequencia",
  "Dia_Vencimento",
  "Ativo"
];

// ============================================================
// DISPATCH
// ============================================================
function Recorrentes_dispatch_(action, p) {
  try {
    p = p || {};

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(REC_SHEET_NAME);

    // Criar aba se nao existir (exceto para Listar)
    if (!sheet && action !== "Recorrentes.Listar") {
      sheet = ss.insertSheet(REC_SHEET_NAME);
      sheet.getRange(1, 1, 1, REC_HEADERS.length).setValues([REC_HEADERS]);
      sheet.setFrozenRows(1);
    }

    if (action === "Recorrentes.Listar") {
      return Recorrentes_listar_(sheet);
    }

    if (action === "Recorrentes.Criar") {
      var payload = REC_parseJson_(p.payload);
      return Recorrentes_criar_(sheet, payload);
    }

    if (action === "Recorrentes.Editar") {
      var payloadEdit = REC_parseJson_(p.payload);
      return Recorrentes_editar_(sheet, payloadEdit);
    }

    if (action === "Recorrentes.Excluir") {
      var rowIndex = parseInt(p.rowIndex, 10);
      if (!rowIndex || rowIndex < 2) {
        return { ok: false, code: "VALIDATION_ERROR", message: "rowIndex inválido." };
      }
      return Recorrentes_excluir_(sheet, rowIndex);
    }

    if (action === "Recorrentes.Gerar") {
      var mes = REC_safeStr_(p.mes); // YYYY-MM
      if (!mes) {
        var now = new Date();
        mes = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
      }
      return Recorrentes_gerar_(sheet, mes, p.token);
    }

    return { ok: false, code: "NOT_FOUND", message: "Ação desconhecida: " + action };

  } catch (err) {
    return { ok: false, code: "VALIDATION_ERROR", message: String(err && err.message ? err.message : err) };
  }
}

// ============================================================
// ACOES
// ============================================================

function Recorrentes_listar_(sheet) {
  if (!sheet) {
    return { ok: true, items: [], message: "Sem templates recorrentes." };
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { ok: true, items: [], message: "Sem templates recorrentes." };
  }

  var header = data[0];
  var items = [];

  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < header.length; j++) {
      obj[header[j]] = data[i][j] !== undefined ? data[i][j] : "";
    }
    obj.rowIndex = i + 1;
    items.push(obj);
  }

  return { ok: true, items: items, message: "OK" };
}

function Recorrentes_criar_(sheet, payload) {
  payload = payload || {};

  var descricao = REC_safeStr_(payload.Descricao);
  var valor = parseFloat(payload.Valor) || 0;
  var frequencia = REC_safeStr_(payload.Frequencia) || "Mensal";
  var tipo = REC_safeStr_(payload.Tipo) || "Saida";

  if (!descricao) throw new Error("Descrição é obrigatória.");
  if (!valor) throw new Error("Valor é obrigatório.");

  var row = REC_HEADERS.map(function(h) {
    if (h === "Valor") return valor;
    if (h === "Ativo") return REC_safeStr_(payload.Ativo) || "Sim";
    if (h === "Frequencia") return frequencia;
    if (h === "Tipo") return tipo;
    return REC_safeStr_(payload[h]) || "";
  });

  sheet.appendRow(row);

  Shared_tryLog_("Recorrentes.Criar", { descricao: descricao }, payload.token);

  return { ok: true, message: "Template recorrente criado." };
}

function Recorrentes_editar_(sheet, payload) {
  payload = payload || {};
  var rowIndex = parseInt(payload.rowIndex, 10);
  var data = payload.data || payload;

  if (!rowIndex || rowIndex < 2) throw new Error("rowIndex inválido.");

  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = {};
  for (var i = 0; i < header.length; i++) idx[header[i]] = i;

  var rowRange = sheet.getRange(rowIndex, 1, 1, header.length);
  var current = rowRange.getValues()[0];

  Object.keys(data).forEach(function(k) {
    if (idx[k] !== undefined && k !== "rowIndex") {
      current[idx[k]] = k === "Valor" ? (parseFloat(data[k]) || 0) : data[k];
    }
  });

  rowRange.setValues([current]);
  return { ok: true, message: "Template atualizado.", rowIndex: rowIndex };
}

function Recorrentes_excluir_(sheet, rowIndex) {
  rowIndex = Number(rowIndex || 0);
  if (!rowIndex || rowIndex < 2) throw new Error("rowIndex inválido.");

  var lastRow = sheet.getLastRow();
  if (rowIndex > lastRow) throw new Error("Linha não encontrada: " + rowIndex);

  sheet.deleteRow(rowIndex);

  Shared_tryLog_("Recorrentes.Excluir", { rowIndex: rowIndex });

  return { ok: true, message: "Template excluído.", rowIndex: rowIndex };
}

/**
 * Gera lancamentos pendentes a partir dos templates ativos para um mes.
 */
function Recorrentes_gerar_(sheet, mesYYYYMM, token) {
  if (!sheet) return { ok: true, gerados: 0, message: "Sem templates." };

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, gerados: 0, message: "Sem templates." };

  var header = data[0];
  var idx = {};
  for (var i = 0; i < header.length; i++) idx[header[i]] = i;

  // Parse mes
  var parts = mesYYYYMM.split("-");
  var ano = parseInt(parts[0], 10);
  var mes = parseInt(parts[1], 10);

  // Get lancamentos sheet
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lancSheet = ss.getSheetByName("Lancamentos");
  if (!lancSheet) {
    lancSheet = ss.insertSheet("Lancamentos");
  }

  var gerados = 0;

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var ativo = String(row[idx["Ativo"]] || "").trim();
    if (ativo !== "Sim") continue;

    var freq = String(row[idx["Frequencia"]] || "").trim();
    var diaVenc = parseInt(row[idx["Dia_Vencimento"]], 10) || 1;
    var valor = parseFloat(row[idx["Valor"]]) || 0;

    // Calcular datas de geracao baseado na frequencia
    var datas = [];
    if (freq === "Mensal") {
      datas.push(REC_buildDate_(ano, mes, diaVenc));
    } else if (freq === "Quinzenal") {
      datas.push(REC_buildDate_(ano, mes, diaVenc));
      datas.push(REC_buildDate_(ano, mes, Math.min(diaVenc + 15, 28)));
    } else if (freq === "Semanal") {
      // 4 semanas no mes
      for (var w = 0; w < 4; w++) {
        var dia = diaVenc + (w * 7);
        if (dia <= 28) datas.push(REC_buildDate_(ano, mes, dia));
      }
    } else {
      datas.push(REC_buildDate_(ano, mes, diaVenc));
    }

    datas.forEach(function(dataISO) {
      var lancRow = [
        dataISO,                                          // Data_Competencia
        dataISO,                                          // Data_Caixa
        String(row[idx["Tipo"]] || "Saida"),              // Tipo
        "Recorrente",                                     // Origem
        String(row[idx["Categoria"]] || ""),               // Categoria
        String(row[idx["Descricao"]] || ""),               // Descricao
        String(row[idx["ID_Cliente"]] || ""),               // ID_Cliente
        String(row[idx["ID_Fornecedor"]] || ""),            // ID_Fornecedor
        String(row[idx["Forma_Pagamento"]] || ""),          // Forma_Pagamento
        "",                                                // Instituicao_Financeira
        "",                                                // Titularidade
        "",                                                // Parcelamento
        valor,                                             // Valor
        "Pendente",                                        // Status
        "Gerado automaticamente",                          // Observacoes
        mesYYYYMM                                          // Mes_a_receber
      ];
      lancSheet.appendRow(lancRow);
      gerados++;
    });
  }

  Shared_tryLog_("Recorrentes.Gerar", { mes: mesYYYYMM, gerados: gerados }, token);

  return { ok: true, gerados: gerados, message: gerados + " lançamento(s) gerado(s) para " + mesYYYYMM + "." };
}

// ============================================================
// HELPERS
// ============================================================
function REC_safeStr_(v) { return Shared_safeStr_(v); }

function REC_parseJson_(v) {
  if (!v) return {};
  if (typeof v === "object") return v;
  return Shared_parseJsonParam_(v);
}

function REC_buildDate_(year, month, day) {
  // Clamp day to valid range for the month
  var lastDay = new Date(year, month, 0).getDate();
  day = Math.min(day, lastDay);
  return year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}
