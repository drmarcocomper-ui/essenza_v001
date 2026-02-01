/**
 * Registry.gs — Registro central de rotas (actions)
 * ------------------------------------------------
 * Resolve:
 * - ações exatas  -> handler(e)
 * - ações por prefixo -> dispatcher(action, e)
 *
 * Usado por:
 * - Api.gs
 */

var REGISTRY_EXACT = null;   // { "Action.Name": function(e){...} }
var REGISTRY_PREFIX = null;  // [ { prefix, fn(action,e) } ]

/** Inicialização lazy */
function Registry_init_() {
  if (REGISTRY_EXACT && REGISTRY_PREFIX) return;

  // =========================
  // AÇÕES EXATAS
  // =========================
  REGISTRY_EXACT = {
    // ---- RESUMO MENSAL ----
    "ResumoMensal.Calcular": function (e) {
      if (typeof ResumoMensal_CalcularApi_ !== "function") {
        throw new Error("Handler ausente: ResumoMensal_CalcularApi_");
      }
      return ResumoMensal_CalcularApi_(e);
    },

    "ResumoMensal.DetalharMes": function (e) {
      if (typeof ResumoMensal_DetalharMesApi_ !== "function") {
        throw new Error("Handler ausente: ResumoMensal_DetalharMesApi_");
      }
      return ResumoMensal_DetalharMesApi_(e);
    },

    // ---- CLIENTES ----
    "Clientes.GerarID": function (e) {
      if (typeof Clientes_GerarIDApi_ !== "function") {
        throw new Error("Handler ausente: Clientes_GerarIDApi_");
      }
      return Clientes_GerarIDApi_(e);
    },

    "Clientes.Criar": function (e) {
      if (typeof Clientes_CriarApi_ !== "function") {
        throw new Error("Handler ausente: Clientes_CriarApi_");
      }
      return Clientes_CriarApi_(e);
    },

    "Clientes.Buscar": function (e) {
      if (typeof Clientes_BuscarApi_ !== "function") {
        throw new Error("Handler ausente: Clientes_BuscarApi_");
      }
      return Clientes_BuscarApi_(e);
    }
  };

  // =========================
  // ROTAS POR PREFIXO
  // =========================
  REGISTRY_PREFIX = [
    {
      prefix: "Lancamentos.",
      fn: function (action, e) {
        var p = (e && e.parameter) ? e.parameter : {};
        if (typeof Lancamentos_dispatch_ !== "function") {
          throw new Error("Lancamentos_dispatch_ não encontrado. Verifique Lancamentos.gs.");
        }
        return Lancamentos_dispatch_(action, p);
      }
    }

    // Futuro:
    // { prefix: "Relatorios.", fn: function(action,e){ return Relatorios_dispatch_(action, (e&&e.parameter)||{}); } }
  ];
}

/** Resolve a action para handler */
function Registry_resolve_(action) {
  Registry_init_();

  if (REGISTRY_EXACT[action]) {
    return { mode: "exact", handler: REGISTRY_EXACT[action] };
  }

  for (var i = 0; i < REGISTRY_PREFIX.length; i++) {
    var r = REGISTRY_PREFIX[i];
    if (action.indexOf(r.prefix) === 0) {
      return { mode: "prefix", route: r };
    }
  }

  return null;
}

/** Dispatcher público */
function Registry_dispatch_(action, e) {
  var a = String(action || "").trim();
  if (!a) {
    return { ok: false, code: "VALIDATION_ERROR", message: "action obrigatório." };
  }

  var resolved = Registry_resolve_(a);
  if (!resolved) {
    return { ok: false, code: "NOT_FOUND", message: "Ação desconhecida: " + a };
  }

  var result;
  if (resolved.mode === "exact") {
    result = resolved.handler(e);
  } else {
    result = resolved.route.fn(a, e);
  }

  if (result && typeof result === "object" && result.ok === undefined) {
    result.ok = true;
  }
  return result;
}
