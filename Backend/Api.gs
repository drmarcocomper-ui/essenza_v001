/**
 * Api.gs — WebApp JSONP (sem CORS)
 * --------------------------------
 * Entry point único da aplicação.
 *
 * Regras:
 * - action obrigatório
 * - callback opcional (JSONP)
 * - roteamento feito pelo Registry.gs
 * - autenticação via token (exceto ações públicas)
 *
 * Dependências:
 * - Api.Utils.gs   (safeStr_, jsonp_, parseBody_)
 * - Registry.gs    (Registry_dispatch_)
 * - Auth.gs        (Auth_isPublicAction_, Auth_requireToken_)
 */

function doGet(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    var action = safeStr_(p.action);
    var callback = safeStr_(p.callback);

    // Healthcheck
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

    // Dispatch central
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

/**
 * POST opcional — redireciona para GET
 * (mantém compatibilidade)
 */
function doPost(e) {
  var body = parseBody_(e);
  return doGet({ parameter: body });
}
