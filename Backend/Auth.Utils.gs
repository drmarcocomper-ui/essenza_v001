/**
 * Auth.Utils.gs — Helpers de autenticação
 * ----------------------------------------
 * - Hash SHA-256
 * - Geração e validação de tokens HMAC
 * - Armazenamento de tokens em PropertiesService
 *
 * Usado por:
 * - Auth.gs
 */

// ============================
// Configuração
// ============================
var AUTH_SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 horas
var AUTH_TOKEN_PREFIX = "AUTH_TOKEN_";

// ============================
// SHA-256
// ============================
function Auth_sha256_(text) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return raw.map(function(b) {
    return ("0" + ((b < 0 ? b + 256 : b).toString(16))).slice(-2);
  }).join("");
}

// ============================
// HMAC-SHA-256
// ============================
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

// ============================
// UUID simples
// ============================
function Auth_uuid_() {
  var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  var result = "";
  for (var i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ============================
// Geração de Token
// ============================
/**
 * Gera um token assinado com HMAC
 * Formato: {timestamp}:{uuid}:{signature}
 */
function Auth_generateToken_() {
  var props = PropertiesService.getScriptProperties();
  var passwordHash = props.getProperty("AUTH_PASSWORD_HASH");

  if (!passwordHash) {
    throw new Error("Senha não configurada. Execute Auth_SetupPassword_() primeiro.");
  }

  var timestamp = Date.now().toString();
  var uuid = Auth_uuid_();
  var payload = timestamp + ":" + uuid;
  var signature = Auth_hmacSha256_(payload, passwordHash);

  var token = payload + ":" + signature;

  // Armazenar token com expiração
  var expiration = Date.now() + AUTH_SESSION_TIMEOUT_MS;
  props.setProperty(AUTH_TOKEN_PREFIX + uuid, expiration.toString());

  return token;
}

// ============================
// Validação de Token
// ============================
/**
 * Valida um token
 * Retorna { valid: true/false, error?: string }
 */
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

  // Verificar assinatura
  var payload = timestamp + ":" + uuid;
  var expectedSig = Auth_hmacSha256_(payload, passwordHash);

  if (signature !== expectedSig) {
    return { valid: false, error: "Assinatura inválida" };
  }

  // Verificar se o token está armazenado e não expirou
  var storedExpiration = props.getProperty(AUTH_TOKEN_PREFIX + uuid);

  if (!storedExpiration) {
    return { valid: false, error: "Token não encontrado ou já invalidado" };
  }

  var expTime = parseInt(storedExpiration, 10);
  if (Date.now() > expTime) {
    // Token expirado - limpar
    props.deleteProperty(AUTH_TOKEN_PREFIX + uuid);
    return { valid: false, error: "Token expirado" };
  }

  return { valid: true };
}

// ============================
// Invalidar Token (Logout)
// ============================
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

// ============================
// Limpeza de Tokens Expirados
// ============================
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

// ============================
// Verificar Senha
// ============================
function Auth_verifyPassword_(password) {
  if (!password || typeof password !== "string") {
    return false;
  }

  var props = PropertiesService.getScriptProperties();
  var storedHash = props.getProperty("AUTH_PASSWORD_HASH");

  if (!storedHash) {
    return false;
  }

  var inputHash = Auth_sha256_(password);
  return inputHash === storedHash;
}

// ============================
// Setup Inicial de Senha
// ============================
/**
 * Configura a senha inicial do sistema
 * EXECUTE MANUALMENTE NO EDITOR DO APPS SCRIPT
 *
 * Exemplo:
 *   Auth_SetupPassword_("minhaSenhaSegura123")
 */
function Auth_SetupPassword_(password) {
  if (!password || password.length < 6) {
    throw new Error("A senha deve ter pelo menos 6 caracteres.");
  }

  var hash = Auth_sha256_(password);
  var props = PropertiesService.getScriptProperties();
  props.setProperty("AUTH_PASSWORD_HASH", hash);

  // Limpar tokens antigos
  Auth_cleanupExpiredTokens_();

  Logger.log("Senha configurada com sucesso!");
  Logger.log("Hash: " + hash.substring(0, 16) + "...");

  return { ok: true, message: "Senha configurada." };
}
