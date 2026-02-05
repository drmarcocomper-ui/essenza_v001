/** Lancamentos.gs — Módulo Lançamentos — Aba: "Lancamentos"
 * ------------------------------------------------------------
 * Actions:
 * - Lancamentos.Criar        ✅ parcelamento automático + regra de status por Forma_Pagamento
 * - Lancamentos.Listar       ✅ retorna rowIndex
 * - Lancamentos.Editar       ✅ edita por rowIndex
 *
 * Regra nova (parcelamento):
 * - Se Forma_Pagamento = Cartao_Credito => TODAS as parcelas ficam Pago
 * - Caso contrário => 1ª parcela mantém status informado; demais = Pendente
 *
 * Dependências:
 * - Lancamentos.Utils.gs (helpers LANC_*)
 */

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
  p = p || {};
  var sheetName = LANC_safeStr_(p.sheet) || LANC_SHEET_DEFAULT;

  var sheet = LANC_getOrCreateSheet_(sheetName);
  LANC_ensureHeader_(sheet, LANC_HEADERS);

  if (action === "Lancamentos.Criar") {
    var payload = LANC_parseJsonParam_(p.payload);
    var res = Lancamentos_criar_(sheet, payload);
    res.ok = true;
    return res;
  }

  if (action === "Lancamentos.Editar") {
    var payloadEdit = LANC_parseJsonParam_(p.payload);
    var resEdit = Lancamentos_editar_(sheet, payloadEdit);
    resEdit.ok = true;
    return resEdit;
  }

  if (action === "Lancamentos.PorCliente") {
    var filtrosCliente = LANC_parseJsonParam_(p.filtros);
    if (!filtrosCliente || typeof filtrosCliente !== "object") filtrosCliente = {};
    var resultCliente = Lancamentos_porCliente_(sheet, filtrosCliente);
    return {
      ok: true,
      items: resultCliente.items,
      total: resultCliente.total,
      message: "OK"
    };
  }

  if (action === "Lancamentos.Listar") {
    var filtros = LANC_parseJsonParam_(p.filtros);
    if (!filtros || typeof filtros !== "object") filtros = LANC_parseJsonParam_(p.filtro);
    if (!filtros || typeof filtros !== "object") filtros = {};

    if (LANC_safeStr_(p.fDataIni)) filtros.fDataIni = p.fDataIni;
    if (LANC_safeStr_(p.fDataFim)) filtros.fDataFim = p.fDataFim;
    if (LANC_safeStr_(p.fTipo)) filtros.fTipo = p.fTipo;
    if (LANC_safeStr_(p.fStatus)) filtros.fStatus = p.fStatus;
    if (LANC_safeStr_(p.fCategoria)) filtros.fCategoria = p.fCategoria;
    if (LANC_safeStr_(p.fFormaPagamento)) filtros.fFormaPagamento = p.fFormaPagamento;
    if (LANC_safeStr_(p.fInstituicao)) filtros.fInstituicao = p.fInstituicao;
    if (LANC_safeStr_(p.fTitularidade)) filtros.fTitularidade = p.fTitularidade;
    if (LANC_safeStr_(p.q)) filtros.q = p.q;

    // Paginação
    var page = parseInt(p.page, 10) || 1;
    var limit = parseInt(p.limit, 10) || 50;
    if (page < 1) page = 1;
    if (limit < 1) limit = 50;
    if (limit > 200) limit = 200;

    var result = Lancamentos_listar_(sheet, filtros, page, limit);
    return {
      ok: true,
      items: result.items,
      pagination: result.pagination,
      message: "OK"
    };
  }

  return { ok: false, code: "NOT_FOUND", message: "Ação desconhecida: " + action };
}

// ============================================================
// AÇÕES
// ============================================================

/**
 * ✅ Criar lançamento:
 * - Se Parcelamento for inteiro >=2 (ex.: "4"), cria N linhas (1/4..N/4).
 * - Se Parcelamento for texto (ex.: "1/3", "à vista"), cria 1 linha normal.
 *
 * Regras de parcelamento:
 * - Datas: base na Data_Caixa se existir; senão Data_Competencia.
 * - Cada parcela avança 1 mês.
 * - Valor: divide em N, ajusta centavos na última.
 * - Mes_a_receber: YYYY-MM conforme o mês da parcela.
 *
 * ✅ Regra nova de Status no parcelamento:
 * - Se Forma_Pagamento = Cartao_Credito => TODAS as parcelas = Pago
 * - Caso contrário => 1ª parcela = status informado; demais = Pendente
 */
function Lancamentos_criar_(sheet, payload) {
  payload = payload || {};

  var dcRaw = LANC_safeStr_(payload.Data_Competencia);
  var tipo = LANC_safeStr_(payload.Tipo);
  var desc = LANC_safeStr_(payload.Descricao);
  var valorRaw = payload.Valor;
  var statusRaw = LANC_safeStr_(payload.Status);

  if (!dcRaw) throw new Error("Data_Competencia é obrigatório.");
  if (!tipo) throw new Error("Tipo é obrigatório.");
  if (!desc) throw new Error("Descricao é obrigatório.");
  if (valorRaw === null || valorRaw === undefined || String(valorRaw).trim() === "") throw new Error("Valor é obrigatório.");
  if (!statusRaw) throw new Error("Status é obrigatório.");

  var dc = LANC_normalizeIsoDate_(dcRaw);

  var dcaixaRaw = LANC_safeStr_(payload.Data_Caixa);
  var dcaixa = dcaixaRaw ? LANC_normalizeIsoDate_(dcaixaRaw) : "";

  var total = LANC_parseNumber_(valorRaw);

  // detecta parcelamento numérico: "4" => 4 parcelas
  var parcRaw = LANC_safeStr_(payload.Parcelamento);
  var nParcelas = LANC_parseParcelasCount_(parcRaw);

  // Se não é parcelamento numérico (ou é 1), cria 1 linha normal
  if (!nParcelas || nParcelas < 2) {
    var rowObj1 = LANC_buildRowObj_(payload, dc, dcaixa, parcRaw, total, statusRaw, payload.Mes_a_receber);
    sheet.appendRow(LANC_toRowValues_(rowObj1));
    return { message: "Lançamento salvo." };
  }

  // Parcelamento automático
  var baseDateISO = dcaixa || dc; // prioridade: Data_Caixa
  var baseDate = LANC_parseIsoDateToDate_(baseDateISO);
  if (!baseDate) throw new Error("Data base inválida para parcelamento. Preencha Data_Caixa ou Data_Competencia (YYYY-MM-DD).");

  // valores por parcela
  var parts = LANC_splitAmount_(total, nParcelas);

  // ✅ Forma de pagamento define regra de status
  var formaPg = LANC_safeStr_(payload.Forma_Pagamento);

  var created = 0;
  for (var i = 0; i < nParcelas; i++) {
    var parcelaNum = i + 1;

    var d = LANC_addMonths_(baseDate, i);
    var iso = LANC_dateToIso_(d);
    var mesAReceber = iso.slice(0, 7);

    // datas por parcela
    var dcParc = iso;
    var dcaixaParc = iso;

    // ✅ Regra nova:
    // - Cartao_Credito => tudo Pago
    // - outros => 1ª = statusRaw; demais = Pendente
    var st = (formaPg === "Cartao_Credito")
      ? "Pago"
      : ((parcelaNum === 1) ? statusRaw : "Pendente");

    var rowObj = LANC_buildRowObj_(
      payload,
      dcParc,
      dcaixaParc,
      (parcelaNum + "/" + nParcelas),
      parts[i],
      st,
      mesAReceber
    );

    sheet.appendRow(LANC_toRowValues_(rowObj));
    created++;
  }

  return {
    message: "Parcelamento criado: " + created + " parcelas.",
    parcelas: created,
    valorTotal: total,
    statusParcelas: (formaPg === "Cartao_Credito") ? "Pago" : "Primeira conforme / demais Pendente"
  };
}

/**
 * ✅ Editar por rowIndex (linha real 1-based)
 * Payload: { rowIndex: number, data: {...} }
 */
function Lancamentos_editar_(sheet, payload) {
  payload = payload || {};
  var rowIndex = Number(payload.rowIndex || 0);
  var data = payload.data || {};

  if (!rowIndex || rowIndex < 2) throw new Error("rowIndex inválido (mínimo 2).");
  if (!data || typeof data !== "object") throw new Error("payload.data é obrigatório.");

  if (data.Valor !== undefined) data.Valor = LANC_parseNumber_(data.Valor);
  if (data.Data_Competencia) data.Data_Competencia = LANC_normalizeIsoDate_(data.Data_Competencia);
  if (data.Data_Caixa) data.Data_Caixa = LANC_normalizeIsoDate_(data.Data_Caixa);

  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = LANC_indexMap_(header);

  var rowRange = sheet.getRange(rowIndex, 1, 1, header.length);
  var current = rowRange.getValues()[0];

  Object.keys(data).forEach(function (k) {
    if (idx[k] === undefined) return;
    current[idx[k]] = data[k];
  });

  rowRange.setValues([current]);
  return { message: "Lançamento atualizado.", rowIndex: rowIndex };
}

function Lancamentos_listar_(sheet, filtros, page, limit) {
  filtros = filtros || {};
  page = page || 1;
  limit = limit || 50;

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return {
      items: [],
      pagination: { page: 1, limit: limit, total: 0, totalPages: 0 }
    };
  }

  var header = data[0];
  var idx = LANC_indexMap_(header);

  var dateField = LANC_safeStr_(filtros.dateField || "Data_Competencia");
  if (dateField !== "Data_Competencia" && dateField !== "Data_Caixa") dateField = "Data_Competencia";

  var fIni = LANC_safeStr_(filtros.fDataIni || "");
  var fFim = LANC_safeStr_(filtros.fDataFim || "");
  var fTipo = LANC_safeStr_(filtros.fTipo || "");
  var fStatus = LANC_safeStr_(filtros.fStatus || "");
  var fCategoria = LANC_safeStr_(filtros.fCategoria || "");
  var fFormaPagamento = LANC_safeStr_(filtros.fFormaPagamento || "");
  var fInstituicao = LANC_safeStr_(filtros.fInstituicao || "");
  var fTitularidade = LANC_safeStr_(filtros.fTitularidade || "");
  var q = LANC_safeStr_(filtros.q || "");

  var iniDate = fIni ? LANC_parseIsoDateToDate_(fIni) : null;
  var fimDate = fFim ? LANC_parseIsoDateToDate_(fFim) : null;
  var qNorm = q ? LANC_normalize_(q) : "";

  var all = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    var dValue = row[idx[dateField]];
    var tipo = LANC_safeStr_(row[idx["Tipo"]]);
    var status = LANC_safeStr_(row[idx["Status"]]);

    if (iniDate || fimDate) {
      var dDate = LANC_parseAnyToDate_(dValue);
      if (!dDate) continue;
      if (iniDate && dDate < iniDate) continue;
      if (fimDate && dDate > fimDate) continue;
    }

    if (fTipo && tipo !== fTipo) continue;
    if (fStatus && status !== fStatus) continue;

    // Filtros avançados
    if (fCategoria) {
      var categoria = LANC_safeStr_(row[idx["Categoria"]]);
      if (categoria !== fCategoria) continue;
    }
    if (fFormaPagamento) {
      var formaPag = LANC_safeStr_(row[idx["Forma_Pagamento"]]);
      if (formaPag !== fFormaPagamento) continue;
    }
    if (fInstituicao) {
      var instituicao = LANC_safeStr_(row[idx["Instituicao_Financeira"]]);
      if (instituicao !== fInstituicao) continue;
    }
    if (fTitularidade) {
      var titularidade = LANC_safeStr_(row[idx["Titularidade"]]);
      if (titularidade !== fTitularidade) continue;
    }

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
      ) continue;
    }

    var obj = LANC_rowToObj_(header, row);
    obj.rowIndex = i + 1;
    all.push(obj);
  }

  // Ordenar por data decrescente
  all.sort(function (a, b) {
    var da = LANC_parseAnyToDate_(a.Data_Competencia);
    var db = LANC_parseAnyToDate_(b.Data_Competencia);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db.getTime() - da.getTime();
  });

  // Paginação
  var total = all.length;
  var totalPages = Math.ceil(total / limit) || 1;
  if (page > totalPages) page = totalPages;

  var startIdx = (page - 1) * limit;
  var endIdx = startIdx + limit;
  var items = all.slice(startIdx, endIdx);

  return {
    items: items,
    pagination: {
      page: page,
      limit: limit,
      total: total,
      totalPages: totalPages
    }
  };
}

/**
 * Agrupa entradas pagas por Cliente_Fornecedor
 * Retorna ranking dos clientes com maior valor
 */
function Lancamentos_porCliente_(sheet, filtros) {
  filtros = filtros || {};

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { items: [], total: 0 };
  }

  var header = data[0];
  var idx = LANC_indexMap_(header);

  var fMes = LANC_safeStr_(filtros.mes || "");
  var limite = parseInt(filtros.limite, 10) || 20;

  var clientes = {};
  var totalGeral = 0;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    var tipo = LANC_safeStr_(row[idx["Tipo"]]);
    var status = LANC_safeStr_(row[idx["Status"]]);

    // Só entradas pagas
    if (tipo !== "Entrada") continue;
    if (status !== "Pago") continue;

    // Filtro por mês (Data_Caixa)
    if (fMes) {
      var dataCaixa = row[idx["Data_Caixa"]];
      var mesRow = LANC_getMesFromDate_(dataCaixa);
      if (mesRow !== fMes) continue;
    }

    var cliente = LANC_safeStr_(row[idx["Cliente_Fornecedor"]]) || "(Sem cliente)";
    var valor = LANC_parseNumberSafe_(row[idx["Valor"]]);

    if (!clientes[cliente]) {
      clientes[cliente] = { nome: cliente, total: 0, qtd: 0 };
    }
    clientes[cliente].total += valor;
    clientes[cliente].qtd += 1;
    totalGeral += valor;
  }

  // Converter para array e ordenar por total decrescente
  var arr = [];
  for (var nome in clientes) {
    arr.push(clientes[nome]);
  }
  arr.sort(function(a, b) { return b.total - a.total; });

  // Limitar quantidade
  var items = arr.slice(0, limite);

  // Calcular percentual
  items.forEach(function(it) {
    it.percentual = totalGeral > 0 ? Math.round((it.total / totalGeral) * 1000) / 10 : 0;
    it.total = Math.round(it.total * 100) / 100;
  });

  return { items: items, total: Math.round(totalGeral * 100) / 100 };
}

function LANC_getMesFromDate_(value) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0");
  }

  var s = LANC_safeStr_(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);

  var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return m[3] + "-" + m[2];

  return "";
}

function LANC_parseNumberSafe_(v) {
  try {
    return LANC_parseNumber_(v);
  } catch (_) {
    return 0;
  }
}

// ============================================================
// HELPERS internos (somente deste arquivo)
// ============================================================
function LANC_toRowValues_(rowObj) {
  return LANC_HEADERS.map(function (h) {
    return rowObj[h] !== undefined ? rowObj[h] : "";
  });
}

function LANC_buildRowObj_(payload, dc, dcaixa, parcelamentoStr, valorNum, statusStr, mesAReceber) {
  return {
    Data_Competencia: dc,
    Data_Caixa: dcaixa,
    Tipo: LANC_safeStr_(payload.Tipo),
    Origem: LANC_safeStr_(payload.Origem),
    Categoria: LANC_safeStr_(payload.Categoria),
    Descricao: LANC_safeStr_(payload.Descricao),
    Cliente_Fornecedor: LANC_safeStr_(payload.Cliente_Fornecedor),
    Forma_Pagamento: LANC_safeStr_(payload.Forma_Pagamento),
    Instituicao_Financeira: LANC_safeStr_(payload.Instituicao_Financeira),
    Titularidade: LANC_safeStr_(payload.Titularidade),
    Parcelamento: LANC_safeStr_(parcelamentoStr),
    Valor: Number(valorNum || 0),
    Status: LANC_safeStr_(statusStr),
    Observacoes: LANC_safeStr_(payload.Observacoes),
    Mes_a_receber: LANC_safeStr_(mesAReceber || payload.Mes_a_receber),
  };
}

function LANC_parseParcelasCount_(parcRaw) {
  var s = LANC_safeStr_(parcRaw);
  if (!s) return 0;
  if (/^\d+\s*\/\s*\d+$/.test(s)) return 0;

  if (/^\d+$/.test(s)) {
    var n = Number(s);
    return (!isNaN(n) && n >= 2) ? n : 0;
  }

  var m = s.match(/^(\d+)\s*x$/i);
  if (m) {
    var nx = Number(m[1]);
    return (!isNaN(nx) && nx >= 2) ? nx : 0;
  }

  return 0;
}

function LANC_splitAmount_(total, n) {
  total = Number(total || 0);
  n = Number(n || 0);
  if (!n || n < 1) return [total];

  var cents = Math.round(total * 100);
  var base = Math.floor(cents / n);
  var rem = cents - base * n;

  var out = [];
  for (var i = 0; i < n; i++) {
    var c = base + (i === n - 1 ? rem : 0);
    out.push(c / 100);
  }
  return out;
}

function LANC_addMonths_(dateObj, add) {
  var d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  var y = d.getFullYear();
  var m = d.getMonth() + add;
  var day = d.getDate();

  var target = new Date(y, m, 1);
  var lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target;
}

function LANC_dateToIso_(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
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

function LANC_ensureHeader_(sheet, headers) {
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.clearDataValidations();

  var lastCol = sheet.getLastColumn();
  if (lastCol === 0 || sheet.getLastRow() === 0) {
    headerRange.setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }

  var current = sheet.getRange(1, 1, 1, Math.max(lastCol, headers.length)).getValues()[0];

  var mismatch = false;
  for (var i = 0; i < headers.length; i++) {
    if (String(current[i] || "").trim() !== headers[i]) { mismatch = true; break; }
  }

  if (mismatch) {
    headerRange.setValues([headers]);
    sheet.setFrozenRows(1);
  }
}
