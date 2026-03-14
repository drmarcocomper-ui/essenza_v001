/**
 * Auth.gs — Módulo principal de autenticação
 * -------------------------------------------
 * - Login: valida senha, retorna token
 * - Logout: invalida token
 * - Validate: verifica se token é válido
 * - Middleware para proteção de rotas
 *
 * Dependências:
 * - Auth.Utils.gs (Auth_sha256_, Auth_generateToken_, etc.)
 *
 * Ações públicas (não requerem token):
 * - Auth.Login
 * - Auth.Validate
 *
 * Usado por:
 * - Api.gs (middleware de verificação)
 * - Registry.gs (registro de rotas)
 */

// ============================
// Ações Públicas (sem token)
// ============================
const AUTH_PUBLIC_ACTIONS = [
  "Auth.Login",
  "Auth.Validate"
];

/**
 * Verifica se uma ação é pública (não requer token)
 */
function Auth_isPublicAction_(action) {
  if (!action) return false;
  for (var i = 0; i < AUTH_PUBLIC_ACTIONS.length; i++) {
    if (AUTH_PUBLIC_ACTIONS[i] === action) return true;
  }
  return false;
}

// ============================
// Middleware de Proteção
// ============================
/**
 * Verifica se a requisição tem token válido
 * Retorna null se OK, ou objeto de erro se falhar
 */
function Auth_requireToken_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var token = safeStr_(p.token);

  if (!token) {
    return {
      ok: false,
      code: "AUTH_ERROR",
      message: "Token de autenticação não fornecido."
    };
  }

  var result = Auth_validateToken_(token);

  if (!result.valid) {
    return {
      ok: false,
      code: "AUTH_ERROR",
      message: result.error || "Token inválido ou expirado."
    };
  }

  return null; // OK - token válido
}

// ============================
// Rate Limiting (CacheService)
// ============================
const AUTH_RATE_LIMIT_MAX_ = 5;
const AUTH_RATE_LIMIT_WINDOW_ = 300; // 5 minutos
const AUTH_RATE_LIMIT_PREFIX_ = "login_fail_";

function Auth_rateLimitKey_(identifier) {
  // Gera chave única por identificador (IP ou password hash parcial)
  var raw = String(identifier || "unknown");
  var hash = 0;
  for (var i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return AUTH_RATE_LIMIT_PREFIX_ + Math.abs(hash);
}

function Auth_getFailCount_(key) {
  var cache = CacheService.getScriptCache();
  var val = cache.get(key);
  return val ? parseInt(val, 10) : 0;
}

function Auth_incrementFailCount_(key) {
  var cache = CacheService.getScriptCache();
  var count = Auth_getFailCount_(key) + 1;
  cache.put(key, String(count), AUTH_RATE_LIMIT_WINDOW_);
}

function Auth_clearFailCount_(key) {
  var cache = CacheService.getScriptCache();
  cache.remove(key);
}

// ============================
// API: Login
// ============================
function Auth_LoginApi_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var password = safeStr_(p.password);

  // Rate limiting per-user (usa password como identificador para isolar atacantes)
  var rlKey = Auth_rateLimitKey_(password || "empty");
  if (Auth_getFailCount_(rlKey) >= AUTH_RATE_LIMIT_MAX_) {
    Utilities.sleep(1000);
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Muitas tentativas. Aguarde alguns minutos."
    };
  }

  if (!password) {
    Utilities.sleep(1000);
    Auth_incrementFailCount_(rlKey);
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Senha não fornecida."
    };
  }

  var isValid = Auth_verifyPassword_(password);

  if (!isValid) {
    Utilities.sleep(1000);
    Auth_incrementFailCount_(rlKey);
    Shared_tryLog_("Auth.Login", { success: false });
    return {
      ok: false,
      code: "AUTH_ERROR",
      message: "Senha incorreta."
    };
  }

  // Login OK: limpar contador de falhas
  Auth_clearFailCount_(rlKey);

  // Limpar tokens expirados periodicamente
  try {
    Auth_cleanupExpiredTokens_();
  } catch (cleanupErr) {}

  // Gerar novo token
  var token = Auth_generateToken_();

  Shared_tryLog_("Auth.Login", { success: true }, token);

  return {
    ok: true,
    token: token,
    message: "Login realizado com sucesso."
  };
}

// ============================
// API: Logout
// ============================
function Auth_LogoutApi_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var token = safeStr_(p.token);

  if (token) {
    Auth_invalidateToken_(token);
  }

  Shared_tryLog_("Auth.Logout", {}, token);

  return {
    ok: true,
    message: "Logout realizado."
  };
}

// ============================
// API: Validate
// ============================
function Auth_ValidateApi_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var token = safeStr_(p.token);

  if (!token) {
    return {
      ok: false,
      code: "AUTH_ERROR",
      valid: false,
      message: "Token não fornecido."
    };
  }

  var result = Auth_validateToken_(token);

  if (!result.valid) {
    return {
      ok: false,
      code: "AUTH_ERROR",
      valid: false,
      message: result.error || "Token inválido."
    };
  }

  return {
    ok: true,
    valid: true,
    message: "Token válido."
  };
}

// ============================
// Dispatcher (para Registry)
// ============================
function Auth_dispatch_(action, e) {
  switch (action) {
    case "Auth.Login":
      return Auth_LoginApi_(e);

    case "Auth.Logout":
      return Auth_LogoutApi_(e);

    case "Auth.Validate":
      return Auth_ValidateApi_(e);

    default:
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Ação de autenticação desconhecida: " + action
      };
  }
}
