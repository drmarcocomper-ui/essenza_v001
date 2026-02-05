// ============================================================
// INSTRUÇÕES:
// 1. Abra script.google.com
// 2. Abra seu projeto Essenza
// 3. Para cada seção abaixo, crie um arquivo novo com o nome indicado
// 4. Copie o conteúdo correspondente
// 5. Salve tudo (Ctrl+S)
// 6. Execute a função "configurarSenha"
// ============================================================


// ============================================================
// ARQUIVO: Auth.Utils (criar novo arquivo com este nome)
// ============================================================

var AUTH_SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;
var AUTH_TOKEN_PREFIX = "AUTH_TOKEN_";

function Auth_sha256_(text) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return raw.map(function(b) {
    return ("0" + ((b < 0 ? b + 256 : b).toString(16))).slice(-2);
  }).join("");
}

function Auth_hmacSha256_(message, key) {
  var signature = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_256,
    message,
    key,
    Utilities.Charset.UTF_8
  );
  return signature.map(function(b) {
    return ("0" + ((b < 0 ? b + 256 : b).toString(16))).slice(-2);
  }).join("");
}

function Auth_uuid_() {
  var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  var result = "";
  for (var i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function Auth_generateToken_() {
  var props = PropertiesService.getScriptProperties();
  var passwordHash = props.getProperty("AUTH_PASSWORD_HASH");
  if (!passwordHash) {
    throw new Error("Senha não configurada. Execute configurarSenha() primeiro.");
  }
  var timestamp = Date.now().toString();
  var uuid = Auth_uuid_();
  var payload = timestamp + ":" + uuid;
  var signature = Auth_hmacSha256_(payload, passwordHash);
  var token = payload + ":" + signature;
  var expiration = Date.now() + AUTH_SESSION_TIMEOUT_MS;
  props.setProperty(AUTH_TOKEN_PREFIX + uuid, expiration.toString());
  return token;
}

function Auth_validateToken_(token) {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Token não fornecido" };
  }
  var parts = token.split(":");
  if (parts.length !== 3) {
    return { valid: false, error: "Formato de token inválido" };
  }
  var timestamp = parts[0];
  var uuid = parts[1];
  var signature = parts[2];
  var props = PropertiesService.getScriptProperties();
  var passwordHash = props.getProperty("AUTH_PASSWORD_HASH");
  if (!passwordHash) {
    return { valid: false, error: "Sistema não configurado" };
  }
  var payload = timestamp + ":" + uuid;
  var expectedSig = Auth_hmacSha256_(payload, passwordHash);
  if (signature !== expectedSig) {
    return { valid: false, error: "Assinatura inválida" };
  }
  var storedExpiration = props.getProperty(AUTH_TOKEN_PREFIX + uuid);
  if (!storedExpiration) {
    return { valid: false, error: "Token não encontrado ou já invalidado" };
  }
  var expTime = parseInt(storedExpiration, 10);
  if (Date.now() > expTime) {
    props.deleteProperty(AUTH_TOKEN_PREFIX + uuid);
    return { valid: false, error: "Token expirado" };
  }
  return { valid: true };
}

function Auth_invalidateToken_(token) {
  if (!token || typeof token !== "string") return false;
  var parts = token.split(":");
  if (parts.length !== 3) return false;
  var uuid = parts[1];
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(AUTH_TOKEN_PREFIX + uuid)) {
    props.deleteProperty(AUTH_TOKEN_PREFIX + uuid);
    return true;
  }
  return false;
}

function Auth_cleanupExpiredTokens_() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var now = Date.now();
  var cleaned = 0;
  for (var key in all) {
    if (key.indexOf(AUTH_TOKEN_PREFIX) === 0) {
      var expTime = parseInt(all[key], 10);
      if (now > expTime) {
        props.deleteProperty(key);
        cleaned++;
      }
    }
  }
  return cleaned;
}

function Auth_verifyPassword_(password) {
  if (!password || typeof password !== "string") return false;
  var props = PropertiesService.getScriptProperties();
  var storedHash = props.getProperty("AUTH_PASSWORD_HASH");
  if (!storedHash) return false;
  var inputHash = Auth_sha256_(password);
  return inputHash === storedHash;
}

function Auth_SetupPassword_(password) {
  if (!password || password.length < 6) {
    throw new Error("A senha deve ter pelo menos 6 caracteres.");
  }
  var hash = Auth_sha256_(password);
  var props = PropertiesService.getScriptProperties();
  props.setProperty("AUTH_PASSWORD_HASH", hash);
  Auth_cleanupExpiredTokens_();
  Logger.log("Senha configurada com sucesso!");
  return { ok: true, message: "Senha configurada." };
}


// ============================================================
// ARQUIVO: Auth (criar novo arquivo com este nome)
// ============================================================

var AUTH_PUBLIC_ACTIONS = ["Auth.Login", "Auth.Validate"];

function Auth_isPublicAction_(action) {
  if (!action) return false;
  for (var i = 0; i < AUTH_PUBLIC_ACTIONS.length; i++) {
    if (AUTH_PUBLIC_ACTIONS[i] === action) return true;
  }
  return false;
}

function Auth_requireToken_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var token = safeStr_(p.token);
  if (!token) {
    return { ok: false, code: "AUTH_ERROR", message: "Token de autenticação não fornecido." };
  }
  var result = Auth_validateToken_(token);
  if (!result.valid) {
    return { ok: false, code: "AUTH_ERROR", message: result.error || "Token inválido ou expirado." };
  }
  return null;
}

function Auth_LoginApi_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var password = safeStr_(p.password);
  if (!password) {
    Utilities.sleep(1000);
    return { ok: false, code: "VALIDATION_ERROR", message: "Senha não fornecida." };
  }
  var isValid = Auth_verifyPassword_(password);
  if (!isValid) {
    Utilities.sleep(1000);
    return { ok: false, code: "AUTH_ERROR", message: "Senha incorreta." };
  }
  try { Auth_cleanupExpiredTokens_(); } catch (e) {}
  var token = Auth_generateToken_();
  return { ok: true, token: token, message: "Login realizado com sucesso." };
}

function Auth_LogoutApi_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var token = safeStr_(p.token);
  if (token) Auth_invalidateToken_(token);
  return { ok: true, message: "Logout realizado." };
}

function Auth_ValidateApi_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var token = safeStr_(p.token);
  if (!token) {
    return { ok: false, code: "AUTH_ERROR", valid: false, message: "Token não fornecido." };
  }
  var result = Auth_validateToken_(token);
  if (!result.valid) {
    return { ok: false, code: "AUTH_ERROR", valid: false, message: result.error || "Token inválido." };
  }
  return { ok: true, valid: true, message: "Token válido." };
}

function Auth_dispatch_(action, e) {
  switch (action) {
    case "Auth.Login": return Auth_LoginApi_(e);
    case "Auth.Logout": return Auth_LogoutApi_(e);
    case "Auth.Validate": return Auth_ValidateApi_(e);
    default: return { ok: false, code: "NOT_FOUND", message: "Ação desconhecida: " + action };
  }
}


// ============================================================
// ARQUIVO: Setup (criar novo arquivo com este nome)
// ============================================================

function configurarSenha() {
  Auth_SetupPassword_("123456");
}


// ============================================================
// ARQUIVO: Busca (criar novo arquivo com este nome)
// ============================================================

var BUSCA_MAX_RESULTS = 20;

function Busca_dispatch_(action, e) {
  if (action === "Busca.Global") return Busca_GlobalApi_(e);
  return { ok: false, code: "NOT_FOUND", message: "Ação desconhecida: " + action };
}

function Busca_GlobalApi_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var q = Busca_safeStr_(p.q);
  if (!q || q.length < 2) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Digite pelo menos 2 caracteres." };
  }
  var qNorm = Busca_normalize_(q);
  var results = { lancamentos: [], clientes: [], categorias: [] };
  try { results.lancamentos = Busca_emLancamentos_(qNorm); } catch (e) {}
  try { results.clientes = Busca_emClientes_(qNorm); } catch (e) {}
  try { results.categorias = Busca_emCategorias_(qNorm); } catch (e) {}
  var total = results.lancamentos.length + results.clientes.length + results.categorias.length;
  return { ok: true, results: results, total: total, message: total > 0 ? total + " resultado(s)" : "Nenhum resultado." };
}

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
    var cli = Busca_normalize_(row[idx["Cliente_Fornecedor"]] || "");
    var cat = Busca_normalize_(row[idx["Categoria"]] || "");
    if (desc.indexOf(qNorm) !== -1 || cli.indexOf(qNorm) !== -1 || cat.indexOf(qNorm) !== -1) {
      out.push({
        tipo: "lancamento",
        rowIndex: i + 1,
        Data_Competencia: Busca_safeStr_(row[idx["Data_Competencia"]]),
        Tipo: Busca_safeStr_(row[idx["Tipo"]]),
        Categoria: Busca_safeStr_(row[idx["Categoria"]]),
        Descricao: Busca_safeStr_(row[idx["Descricao"]]),
        Cliente_Fornecedor: Busca_safeStr_(row[idx["Cliente_Fornecedor"]]),
        Valor: row[idx["Valor"]] || 0
      });
    }
  }
  return out;
}

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
    if (nome.indexOf(qNorm) !== -1 || tel.indexOf(qNorm) !== -1) {
      out.push({
        tipo: "cliente",
        NomeCliente: Busca_safeStr_(row[idx["NomeCliente"]]),
        Telefone: Busca_safeStr_(row[idx["Telefone"]]),
        Municipio: Busca_safeStr_(row[idx["Municipio"]])
      });
    }
  }
  return out;
}

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
    if (cat.indexOf(qNorm) !== -1) {
      out.push({
        tipo: "categoria",
        Tipo: Busca_safeStr_(row[idx["Tipo"]]),
        Categoria: Busca_safeStr_(row[idx["Categoria"]]),
        Ativo: Busca_safeStr_(row[idx["Ativo"]])
      });
    }
  }
  return out;
}

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
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function Busca_indexMap_(header) {
  var m = {};
  for (var i = 0; i < header.length; i++) {
    m[String(header[i]).trim()] = i;
  }
  return m;
}


// ============================================================
// ARQUIVO: Api (SUBSTITUIR o conteúdo existente)
// ============================================================

function doGet(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    var action = safeStr_(p.action);
    var callback = safeStr_(p.callback);

    if (!action) {
      return jsonp_(callback, {
        ok: true,
        message: "Web App ativo",
        now: new Date().toISOString(),
        version: "2026-02-04-auth-v1"
      });
    }

    // Verificar autenticação (exceto ações públicas)
    if (!Auth_isPublicAction_(action)) {
      var authError = Auth_requireToken_(e);
      if (authError) {
        return jsonp_(callback, authError);
      }
    }

    var result = Registry_dispatch_(action, e);
    return jsonp_(callback, result);

  } catch (err) {
    var cb = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : "";
    return jsonp_(cb, {
      ok: false,
      code: "INTERNAL_ERROR",
      message: String(err && err.message ? err.message : err)
    });
  }
}

function doPost(e) {
  var body = parseBody_(e);
  return doGet({ parameter: body });
}


// ============================================================
// ARQUIVO: ResumoMensal.Utils (ATUALIZAR - adicionar Titularidade)
// Adicione/atualize as seguintes variáveis e funções:
// ============================================================

/*
// Adicionar após RM_INST_FIXAS:
var RM_TITULARIDADES = ["PF", "PJ"];

// Atualizar RM_newAcc_ para incluir porInstituicaoTitularidade:
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
    porForma: formas,
    porInstituicao: insts,
    porInstituicaoTitularidade: instTit,
  };
}

// Atualizar RM_accumulate_ para incluir tracking por Inst+Titularidade:
// Dentro do bloco "if (statusN === 'pago'...)", APÓS o tracking de instituição, adicionar:
      // ✅ Instituicao + Titularidade (ex: "Nubank_PF")
      var tit = RM_pickFromFixed_(it.titularidade, RM_TITULARIDADES);
      if (inst && tit) {
        var key = inst + "_" + tit;
        acc.porInstituicaoTitularidade[key] = (acc.porInstituicaoTitularidade[key] || 0) + valor;
      }
*/


// ============================================================
// ARQUIVO: ResumoMensal (ATUALIZAR - adicionar Titularidade)
// Atualize as seguintes partes:
// ============================================================

/*
// 1. Em RM_requireCols_, adicionar "Titularidade":
  RM_requireCols_(idx, [
    "Data_Caixa",
    "Tipo",
    "Status",
    "Valor",
    "Forma_Pagamento",
    "Instituicao_Financeira",
    "Titularidade",
  ]);

// 2. Em RM_accumulate_ call, passar titularidade:
    RM_accumulate_(buckets[mes], {
      tipo: row[idx["Tipo"]],
      status: row[idx["Status"]],
      valor: row[idx["Valor"]],
      forma: row[idx["Forma_Pagamento"]],
      inst: row[idx["Instituicao_Financeira"]],
      titularidade: row[idx["Titularidade"]],
    });

// 3. No rowOut, adicionar as novas colunas de Inst+Titularidade:
      // ✅ Instituicao + Titularidade (PF/PJ)
      "Nubank PF": RM_round2_(acc.porInstituicaoTitularidade.Nubank_PF || 0),
      "Nubank PJ": RM_round2_(acc.porInstituicaoTitularidade.Nubank_PJ || 0),
      "PicPay PF": RM_round2_(acc.porInstituicaoTitularidade.PicPay_PF || 0),
      "PicPay PJ": RM_round2_(acc.porInstituicaoTitularidade.PicPay_PJ || 0),
      "SumUp PF": RM_round2_(acc.porInstituicaoTitularidade.SumUp_PF || 0),
      "SumUp PJ": RM_round2_(acc.porInstituicaoTitularidade.SumUp_PJ || 0),
      "Terceiro PF": RM_round2_(acc.porInstituicaoTitularidade.Terceiro_PF || 0),
      "Terceiro PJ": RM_round2_(acc.porInstituicaoTitularidade.Terceiro_PJ || 0),
      "Dinheiro PF": RM_round2_(acc.porInstituicaoTitularidade.Dinheiro_PF || 0),
      "Dinheiro PJ": RM_round2_(acc.porInstituicaoTitularidade.Dinheiro_PJ || 0),
      "Cortesia PF": RM_round2_(acc.porInstituicaoTitularidade.Cortesia_PF || 0),
      "Cortesia PJ": RM_round2_(acc.porInstituicaoTitularidade.Cortesia_PJ || 0),

// 4. Em ResumoMensal_DetalharMes, adicionar Titularidade ao output:
    items.push({
      Data_Caixa: RM_dateOut_(row[idx["Data_Caixa"]]),
      Tipo: RM_safeStr_(row[idx["Tipo"]]),
      Categoria: RM_safeStr_(row[idx["Categoria"]]),
      Descricao: RM_safeStr_(row[idx["Descricao"]]),
      Cliente_Fornecedor: RM_safeStr_(row[idx["Cliente_Fornecedor"]]),
      Forma_Pagamento: RM_safeStr_(row[idx["Forma_Pagamento"]]),
      Instituicao_Financeira: RM_safeStr_(row[idx["Instituicao_Financeira"]]),
      Titularidade: RM_safeStr_(row[idx["Titularidade"]]),
      Valor: RM_round2_(RM_parseNumber_(row[idx["Valor"]])),
      Status: RM_safeStr_(row[idx["Status"]]),
    });

// 5. Atualizar requireCols em DetalharMes:
  RM_requireCols_(idx, ["Data_Caixa", "Tipo", "Valor", "Status", "Titularidade"]);
*/


// ============================================================
// ARQUIVO: Registry (adicionar Auth e Busca no REGISTRY_PREFIX)
// Adicione estes blocos DENTRO do array REGISTRY_PREFIX:
// ============================================================

/*
    // ---- AUTH (prefixo) ---- ADICIONAR
    {
      prefix: "Auth.",
      fn: function (action, e) {
        if (typeof Auth_dispatch_ !== "function") {
          throw new Error("Auth_dispatch_ não encontrado.");
        }
        return Auth_dispatch_(action, e);
      }
    },

    // ---- BUSCA (prefixo) ---- ADICIONAR
    {
      prefix: "Busca.",
      fn: function (action, e) {
        if (typeof Busca_dispatch_ !== "function") {
          throw new Error("Busca_dispatch_ não encontrado.");
        }
        return Busca_dispatch_(action, e);
      }
    },
*/
