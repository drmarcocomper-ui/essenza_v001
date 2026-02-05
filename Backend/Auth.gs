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
var AUTH_PUBLIC_ACTIONS = [
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
// API: Login
// ============================
function Auth_LoginApi_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var password = safeStr_(p.password);

  if (!password) {
    // Delay anti brute-force
    Utilities.sleep(1000);
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Senha não fornecida."
    };
  }

  var isValid = Auth_verifyPassword_(password);

  if (!isValid) {
    // Delay anti brute-force
    Utilities.sleep(1000);
    return {
      ok: false,
      code: "AUTH_ERROR",
      message: "Senha incorreta."
    };
  }

  // Limpar tokens expirados periodicamente
  try {
    Auth_cleanupExpiredTokens_();
  } catch (cleanupErr) {
    // Ignorar erro de limpeza
  }

  // Gerar novo token
  var token = Auth_generateToken_();

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
