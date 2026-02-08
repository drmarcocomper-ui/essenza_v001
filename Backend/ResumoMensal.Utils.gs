/**
 * ResumoMensal.Utils.gs — Helpers da feature ResumoMensal
 * ------------------------------------------------------
 * ✅ Tipo: Entrada / Saida (aceita Receita/Despesa por compat)
 * ✅ Separa Entradas Pagas por:
 *   - Forma_Pagamento (fixas)
 *   - Instituicao_Financeira (fixas)
 * ✅ Normaliza acentos e maiúsculas
 */

var RM_FORMAS_FIXAS = [
  "Pix",
  "Dinheiro",
  "Cartao_Debito",
  "Cartao_Credito",
  "Boleto",
  "Transferencia",
  "Confianca",
  "Cortesia",
];

var RM_INST_FIXAS = [
  "Nubank",
  "PicPay",
  "SumUp",
  "Terceiro",
  "Dinheiro",
  "Cortesia",
];

var RM_TITULARIDADES = ["PF", "PJ"];

// ============================================================
// ACUMULADOR
// ============================================================
function RM_newAcc_() {
  var formas = {};
  RM_FORMAS_FIXAS.forEach(function (k) { formas[k] = 0; });

  var insts = {};
  RM_INST_FIXAS.forEach(function (k) { insts[k] = 0; });

  // Instituição + Titularidade (ex: "Nubank_PF", "Nubank_PJ")
  var instTit = {};
  RM_INST_FIXAS.forEach(function (inst) {
    RM_TITULARIDADES.forEach(function (tit) {
      instTit[inst + "_" + tit] = 0;
    });
  });

  return {
    entradasPagas: 0,
    entradasPendentes: 0,
    saidas: 0,

    // ✅ breakdowns (somente entradas pagas)
    porForma: formas,
    porInstituicao: insts,
    porInstituicaoTitularidade: instTit,
  };
}

function RM_accumulate_(acc, it) {
  var tipoN = RM_norm_(it.tipo);
  var statusN = RM_norm_(it.status);
  var valor = RM_parseNumber_(it.valor);

  // ignora cancelados/inativos
  if (statusN === "cancelado" || statusN === "inativo") return;

  var isEntrada =
    tipoN === "entrada" || tipoN === "entradas" ||
    tipoN === "receita" || tipoN === "receitas";

  var isSaida =
    tipoN === "saida" || tipoN === "saidas" ||
    tipoN === "despesa" || tipoN === "despesas";

  if (isEntrada) {
    if (statusN === "pago" || statusN === "paga" || statusN === "quitado") {
      acc.entradasPagas += valor;

      // ✅ Forma_Pagamento (fixa)
      var forma = RM_pickFromFixed_(it.forma, RM_FORMAS_FIXAS);
      if (forma) acc.porForma[forma] = (acc.porForma[forma] || 0) + valor;

      // ✅ Instituicao_Financeira (fixa)
      var inst = RM_pickFromFixed_(it.inst, RM_INST_FIXAS);
      if (inst) acc.porInstituicao[inst] = (acc.porInstituicao[inst] || 0) + valor;

      // ✅ Instituicao + Titularidade (ex: "Nubank_PF")
      var tit = RM_pickFromFixed_(it.titularidade, RM_TITULARIDADES);
      if (inst && tit) {
        var key = inst + "_" + tit;
        acc.porInstituicaoTitularidade[key] = (acc.porInstituicaoTitularidade[key] || 0) + valor;
      }

    } else if (statusN === "pendente" || statusN === "a receber" || statusN === "areceber") {
      acc.entradasPendentes += valor;
    }
  }

  if (isSaida) {
    acc.saidas += valor;
  }
}

// ============================================================
// UTIL — Header / Colunas
// ============================================================
function RM_indexMap_(headerRow) {
  var map = {};
  for (var i = 0; i < headerRow.length; i++) {
    var k = String(headerRow[i] || "").trim();
    if (k) map[k] = i;
  }
  return map;
}

function RM_requireCols_(idxMap, cols) {
  for (var i = 0; i < cols.length; i++) {
    if (idxMap[cols[i]] === undefined) {
      throw new Error("Coluna obrigatória ausente em Lancamentos: " + cols[i]);
    }
  }
}

// ============================================================
// UTIL — Strings / Números
// ============================================================
function RM_safeStr_(v) {
  return String(v == null ? "" : v).trim();
}

function RM_norm_(v) {
  var s = RM_safeStr_(v).toLowerCase();
  try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (_) {}
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function RM_parseNumber_(v) {
  if (typeof v === "number") return v;

  var s = RM_safeStr_(v);
  if (!s) return 0;

  s = s.replace(/r\$\s?/gi, "").trim();

  if (s.indexOf(",") !== -1) {
    s = s.replace(/\./g, "").replace(",", ".");
  }

  var n = Number(s);
  return isNaN(n) ? 0 : n;
}

function RM_round2_(n) {
  n = Number(n || 0);
  return Math.round(n * 100) / 100;
}

/**
 * Retorna exatamente uma opção fixa, se bater.
 * Tenta:
 * - match direto (case-sensitive) primeiro
 * - match por normalização (case/acentos) depois
 */
function RM_pickFromFixed_(raw, fixedList) {
  var s = RM_safeStr_(raw);
  if (!s) return "";

  // match direto
  for (var i = 0; i < fixedList.length; i++) {
    if (s === fixedList[i]) return fixedList[i];
  }

  // match normalizado
  var sn = RM_norm_(s);
  for (var j = 0; j < fixedList.length; j++) {
    if (sn === RM_norm_(fixedList[j])) return fixedList[j];
  }

  return "";
}

// ============================================================
// UTIL — Datas
// ============================================================

/**
 * Extrai YYYY-MM de qualquer formato de data
 * Suporta: Date object, YYYY-MM, YYYY-MM-DD, ISO string, DD/MM/YYYY
 */
function RM_extractMonth_(value) {
  if (!value) return "";

  // Se for objeto Date do JS
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0");
  }

  var s = RM_safeStr_(value);
  if (!s) return "";

  // Já está no formato YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;

  // Formato YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss (ISO)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);

  // Formato DD/MM/YYYY
  var m = s.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return m[2] + "-" + String(parseInt(m[1], 10)).padStart(2, "0");
  }

  return "";
}

function RM_monthKeyFromDate_(value) {
  if (!value) return "";

  // Se for objeto Date do JS
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0");
  }

  var s = RM_safeStr_(value);

  // Formato YYYY-MM-DD (ISO com hífen)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);

  // Formato YYYY/MM/DD ou YYYY/DD/MM (ano primeiro com barra)
  var mAno = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (mAno) {
    var ano = mAno[1];
    var p1 = parseInt(mAno[2], 10); // pode ser mês ou dia
    var p2 = parseInt(mAno[3], 10); // pode ser dia ou mês

    // Determinar qual é mês: o que for <= 12
    // Se p1 > 12, então p1 é dia e p2 é mês
    // Se p2 > 12, então p2 é dia e p1 é mês
    // Se ambos <= 12, assumir YYYY/MM/DD (p1 = mês)
    var mes;
    if (p1 > 12 && p2 <= 12) {
      mes = p2;
    } else if (p2 > 12 && p1 <= 12) {
      mes = p1;
    } else {
      mes = p1; // ambos <= 12, assumir YYYY/MM/DD
    }

    return ano + "-" + String(mes).padStart(2, "0");
  }

  // Formato DD/MM/YYYY ou MM/DD/YYYY (ano no final)
  var mDia = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mDia) {
    var p1 = parseInt(mDia[1], 10);
    var p2 = parseInt(mDia[2], 10);
    var ano = mDia[3];

    var mes;
    if (p1 > 12 && p2 <= 12) {
      mes = p2; // p1 é dia, p2 é mês (DD/MM/YYYY)
    } else if (p2 > 12 && p1 <= 12) {
      mes = p1; // p1 é mês, p2 é dia (MM/DD/YYYY)
    } else {
      mes = p2; // ambos <= 12, assumir DD/MM/YYYY (brasileiro)
    }

    return ano + "-" + String(mes).padStart(2, "0");
  }

  return "";
}

function RM_dateOut_(value) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    var y = value.getFullYear();
    var m = String(value.getMonth() + 1).padStart(2, "0");
    var d = String(value.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  return RM_safeStr_(value);
}
