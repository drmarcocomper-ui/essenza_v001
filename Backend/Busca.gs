/**
 * Busca.gs — Busca Global
 * ------------------------
 * Pesquisa em múltiplas abas simultaneamente.
 *
 * Actions:
 * - Busca.Global - Pesquisa em Lancamentos, Cadastro e Categoria
 *
 * Usado por:
 * - Registry.gs
 */

var BUSCA_MAX_RESULTS = 20; // máximo por tipo

/**
 * Dispatcher
 */
function Busca_dispatch_(action, e) {
  if (action === "Busca.Global") {
    return Busca_GlobalApi_(e);
  }

  return { ok: false, code: "NOT_FOUND", message: "Ação desconhecida: " + action };
}

/**
 * API: Busca Global
 */
function Busca_GlobalApi_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var q = Busca_safeStr_(p.q);

  if (!q || q.length < 2) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Digite pelo menos 2 caracteres para buscar."
    };
  }

  var qNorm = Busca_normalize_(q);

  var results = {
    lancamentos: [],
    clientes: [],
    categorias: []
  };

  // Buscar em Lançamentos
  try {
    results.lancamentos = Busca_emLancamentos_(qNorm);
  } catch (err) {
    // Ignorar erro, continuar com outras buscas
  }

  // Buscar em Clientes (Cadastro)
  try {
    results.clientes = Busca_emClientes_(qNorm);
  } catch (err) {
    // Ignorar erro
  }

  // Buscar em Categorias
  try {
    results.categorias = Busca_emCategorias_(qNorm);
  } catch (err) {
    // Ignorar erro
  }

  var total = results.lancamentos.length + results.clientes.length + results.categorias.length;

  return {
    ok: true,
    results: results,
    total: total,
    message: total > 0 ? total + " resultado(s)" : "Nenhum resultado encontrado."
  };
}

/**
 * Busca em Lançamentos
 */
function Busca_emLancamentos_(qNorm) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Lancamentos");
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var header = data[0];
  var idx = Busca_indexMap_(header);

  var out = [];
  for (var i = 1; i < data.length && out.length < BUSCA_MAX_RESULTS; i++) {
    var row = data[i];

    var desc = Busca_normalize_(row[idx["Descricao"]] || "");
    var cli = Busca_normalize_(row[idx["ID_Cliente"]] || "");
    var cat = Busca_normalize_(row[idx["Categoria"]] || "");
    var obs = Busca_normalize_(row[idx["Observacoes"]] || "");

    if (
      desc.indexOf(qNorm) !== -1 ||
      cli.indexOf(qNorm) !== -1 ||
      cat.indexOf(qNorm) !== -1 ||
      obs.indexOf(qNorm) !== -1
    ) {
      out.push({
        tipo: "lancamento",
        rowIndex: i + 1,
        Data_Competencia: Busca_safeStr_(row[idx["Data_Competencia"]]),
        Tipo: Busca_safeStr_(row[idx["Tipo"]]),
        Categoria: Busca_safeStr_(row[idx["Categoria"]]),
        Descricao: Busca_safeStr_(row[idx["Descricao"]]),
        ID_Cliente: Busca_safeStr_(row[idx["ID_Cliente"]]),
        Valor: row[idx["Valor"]] || 0
      });
    }
  }

  return out;
}

/**
 * Busca em Clientes (Cadastro)
 */
function Busca_emClientes_(qNorm) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Cadastro");
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var header = data[0];
  var idx = Busca_indexMap_(header);

  var out = [];
  for (var i = 1; i < data.length && out.length < BUSCA_MAX_RESULTS; i++) {
    var row = data[i];

    var nome = Busca_normalize_(row[idx["NomeCliente"]] || "");
    var tel = Busca_normalize_(row[idx["Telefone"]] || "");
    var email = Busca_normalize_(row[idx["E-mail"]] || "");
    var mun = Busca_normalize_(row[idx["Municipio"]] || "");

    if (
      nome.indexOf(qNorm) !== -1 ||
      tel.indexOf(qNorm) !== -1 ||
      email.indexOf(qNorm) !== -1 ||
      mun.indexOf(qNorm) !== -1
    ) {
      out.push({
        tipo: "cliente",
        ID_Cliente: Busca_safeStr_(row[idx["ID_Cliente"]]),
        NomeCliente: Busca_safeStr_(row[idx["NomeCliente"]]),
        Telefone: Busca_safeStr_(row[idx["Telefone"]]),
        Email: Busca_safeStr_(row[idx["E-mail"]]),
        Municipio: Busca_safeStr_(row[idx["Municipio"]])
      });
    }
  }

  return out;
}

/**
 * Busca em Categorias
 */
function Busca_emCategorias_(qNorm) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Categoria");
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var header = data[0];
  var idx = Busca_indexMap_(header);

  var out = [];
  for (var i = 1; i < data.length && out.length < BUSCA_MAX_RESULTS; i++) {
    var row = data[i];

    var cat = Busca_normalize_(row[idx["Categoria"]] || "");
    var descPadrao = Busca_normalize_(row[idx["Descricao_Padrao"]] || "");

    if (cat.indexOf(qNorm) !== -1 || descPadrao.indexOf(qNorm) !== -1) {
      out.push({
        tipo: "categoria",
        ID_Categoria: Busca_safeStr_(row[idx["ID_Categoria"]]),
        Tipo: Busca_safeStr_(row[idx["Tipo"]]),
        Categoria: Busca_safeStr_(row[idx["Categoria"]]),
        Descricao_Padrao: Busca_safeStr_(row[idx["Descricao_Padrao"]]),
        Ativo: Busca_safeStr_(row[idx["Ativo"]])
      });
    }
  }

  return out;
}

// ============================================================
// HELPERS
// ============================================================
function Busca_safeStr_(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    var y = v.getFullYear();
    var m = String(v.getMonth() + 1).padStart(2, "0");
    var d = String(v.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }
  return String(v).trim();
}

function Busca_normalize_(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function Busca_indexMap_(header) {
  var m = {};
  for (var i = 0; i < header.length; i++) {
    m[String(header[i]).trim()] = i;
  }
  return m;
}
