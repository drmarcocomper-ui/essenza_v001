/** Code.gs — WebApp JSONP (sem CORS) — OPÇÃO A + DRILL-DOWN
 * ---------------------------------------------------------
 * ✅ GitHub Pages / file:// (via JSONP)
 * ✅ Router central para:
 *   - Clientes.* (Cadastro)
 *   - Lancamentos.* (via Lancamentos_dispatch_ em Lacamentos.gs)
 *   - ResumoMensal.Calcular (tempo real, sem aba Resumo_Mensal)
 *   - ResumoMensal.DetalharMes (drill-down: lista lançamentos do mês por Data_Caixa)
 *
 * Querystring:
 *  - action=...
 *  - callback=... (JSONP)
 *  - sheet=... (quando aplicável)
 *  - payload=... (JSON string)
 *  - filtros=... (JSON string)
 *  - mes=YYYY-MM
 */

var DEFAULT_SHEET_NAME = "Cadastro";

var CADASTRO_HEADERS = [
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
];

/** =========================
 *  WEB APP
 *  ========================= */
function doGet(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    var action = safeStr_(p.action);
    var callback = safeStr_(p.callback); // JSONP

    // healthcheck
    if (!action) {
      return jsonp_(callback, {
        ok: true,
        message: "Web App ativo",
        now: new Date().toISOString(),
      });
    }

    // =====================================================
    // ✅ RESUMO (OPÇÃO A — cálculo em tempo real)
    // =====================================================
    if (action === "ResumoMensal.Calcular") {
      var mesCalc = safeStr_(p.mes); // opcional YYYY-MM
      var resResumo = ResumoMensal_Calcular(mesCalc);
      return jsonp_(callback, resResumo);
    }

    // =====================================================
    // 🔎 RESUMO: DRILL-DOWN (lançamentos do mês por Data_Caixa)
    // =====================================================
    if (action === "ResumoMensal.DetalharMes") {
      var mes = safeStr_(p.mes); // YYYY-MM
      if (!/^\d{4}-\d{2}$/.test(mes)) {
        return jsonp_(callback, { ok: false, message: "Mês inválido. Use YYYY-MM." });
      }

      // Usa o módulo de lançamentos para listar por Data_Caixa no mês
      var filtros = {
        dateField: "Data_Caixa",
        fDataIni: mes + "-01",
        fDataFim: mes + "-31",
      };

      // sheet opcional (default no Lacamentos.gs é "Lancamentos")
      var sheetNameLanc = safeStr_(p.sheet) || "Lancamentos";

      var resp = Lancamentos_dispatch_("Lancamentos.Listar", {
        sheet: sheetNameLanc,
        filtros: JSON.stringify(filtros),
      });

      if (!resp || resp.ok !== true) {
        return jsonp_(callback, { ok: false, message: (resp && resp.message) ? resp.message : "Erro ao listar lançamentos." });
      }

      return jsonp_(callback, { ok: true, items: resp.items || [] });
    }

    // =====================================================
    // ✅ LANÇAMENTOS (módulo Lacamentos.gs)
    // =====================================================
    if (action.indexOf("Lancamentos.") === 0) {
      var respLanc = Lancamentos_dispatch_(action, p);
      return jsonp_(callback, respLanc);
    }

    // =====================================================
    // ✅ CLIENTES (Cadastro)
    // =====================================================
    var sheetName = safeStr_(p.sheet) || DEFAULT_SHEET_NAME;
    var sheet = getOrCreateSheet_(sheetName);
    ensureHeader_(sheet, CADASTRO_HEADERS);

    if (action === "Clientes.GerarID") {
      var id = gerarIdSequencial_("CLIENTES_SEQ");
      return jsonp_(callback, { ok: true, id: id, message: "ID gerado." });
    }

    if (action === "Clientes.Criar") {
      var payload = parseJsonParam_(p.payload);
      var result = clientesCriar_(sheet, payload);
      result.ok = true;
      return jsonp_(callback, result);
    }

    if (action === "Clientes.Buscar") {
      var q = safeStr_(p.q);
      var itemsClientes = clientesBuscar_(sheet, q);
      return jsonp_(callback, { ok: true, items: itemsClientes, message: "OK" });
    }

    return jsonp_(callback, {
      ok: false,
      code: "NOT_FOUND",
      message: "Ação desconhecida: " + action,
    });

  } catch (err) {
    var cb = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : "";
    return jsonp_(cb, {
      ok: false,
      code: "INTERNAL_ERROR",
      message: String(err && err.message ? err.message : err),
    });
  }
}

/** Opcional: mantém POST compatível */
function doPost(e) {
  var body = parseBody_(e);
  return doGet({ parameter: body });
}

/** =========================
 *  CLIENTES
 *  ========================= */
function clientesCriar_(sheet, payload) {
  var nome = safeStr_(payload.NomeCliente);
  var tel = safeStr_(payload.Telefone);

  if (!nome) throw new Error("NomeCliente é obrigatório.");
  if (!tel) throw new Error("Telefone é obrigatório.");

  var id = safeStr_(payload.ID_Cliente);
  if (!id) id = gerarIdSequencial_("CLIENTES_SEQ");

  if (findRowById_(sheet, id) > 0) {
    throw new Error("ID_Cliente já existe: " + id);
  }

  var dataCadastro = safeStr_(payload.DataCadastro) || isoDate_(new Date());

  var rowObj = {
    "ID_Cliente": id,
    "NomeCliente": nome,
    "Telefone": tel,
    "E-mail": safeStr_(payload["E-mail"]),
    "DataNascimento": safeStr_(payload.DataNascimento),
    "Municipio": safeStr_(payload.Municipio),
    "Bairro": safeStr_(payload.Bairro),
    "DataCadastro": dataCadastro,
    "Profissão": safeStr_(payload["Profissão"]),
    "Preferências": safeStr_(payload["Preferências"]),
    "Origem": safeStr_(payload.Origem),
    "Observação": safeStr_(payload["Observação"]),
  };

  var values = CADASTRO_HEADERS.map(function (h) { return rowObj[h] || ""; });
  sheet.appendRow(values);

  return { id: id, message: "Cadastro salvo." };
}

function clientesBuscar_(sheet, q) {
  q = safeStr_(q);
  if (!q) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var header = data[0];
  var idx = indexMap_(header);
  var qNorm = normalize_(q);

  var out = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    var nome = normalize_(row[idx["NomeCliente"]] || "");
    var tel = normalize_(row[idx["Telefone"]] || "");
    var email = normalize_(row[idx["E-mail"]] || "");

    if (nome.indexOf(qNorm) !== -1 || tel.indexOf(qNorm) !== -1 || email.indexOf(qNorm) !== -1) {
      out.push(rowToObj_(header, row));
      if (out.length >= 50) break;
    }
  }
  return out;
}

/** =========================
 *  JSONP
 *  ========================= */
function jsonp_(callback, obj) {
  var cb = safeStr_(callback);
  var payload = JSON.stringify(obj || {});
  var out = cb ? (cb + "(" + payload + ");") : payload;

  return ContentService
    .createTextOutput(out)
    .setMimeType(cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function parseJsonParam_(s) {
  var raw = (s || "").toString();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

/** =========================
 *  SHEET / SCHEMA
 *  ========================= */
function getOrCreateSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function ensureHeader_(sheet, headers) {
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.clearDataValidations();

  // se vazio, cria
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

function findRowById_(sheet, id) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return -1;

  var header = data[0];
  var idx = indexMap_(header);
  var colId = idx["ID_Cliente"];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colId] || "").trim() === id) return i + 1;
  }
  return -1;
}

/** =========================
 *  ID SEQUENCIAL
 *  ========================= */
function gerarIdSequencial_(propKey) {
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
      pad2_(d.getMonth() + 1) +
      pad2_(d.getDate()) +
      "-" +
      String(next).padStart(4, "0");
  } finally {
    lock.releaseLock();
  }
}

/** =========================
 *  UTIL
 *  ========================= */
function parseBody_(e) {
  var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "";
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

function indexMap_(headerRow) {
  var map = {};
  for (var i = 0; i < headerRow.length; i++) {
    var k = String(headerRow[i] || "").trim();
    if (k) map[k] = i;
  }
  return map;
}

function rowToObj_(headerRow, row) {
  var o = {};
  for (var i = 0; i < headerRow.length; i++) {
    var k = String(headerRow[i] || "").trim();
    if (k) o[k] = row[i];
  }
  return o;
}

function safeStr_(v) {
  return String(v == null ? "" : v).trim();
}

function normalize_(s) {
  return safeStr_(s).toLowerCase();
}

function pad2_(n) {
  return String(n).padStart(2, "0");
}

function isoDate_(d) {
  return d.getFullYear() + "-" + pad2_(d.getMonth() + 1) + "-" + pad2_(d.getDate());
}
