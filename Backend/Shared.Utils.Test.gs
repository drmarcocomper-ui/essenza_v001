/**
 * Shared.Utils.Test.gs — Testes unitários para Shared.Utils.gs
 * ------------------------------------------------------------
 * Execute: Shared_runTests() no editor do Apps Script.
 * Resultado no Logger (Ver > Registros).
 */

function Shared_runTests() {
  var passed = 0;
  var failed = 0;

  function assertEqual(desc, actual, expected) {
    if (actual === expected) {
      passed++;
    } else {
      failed++;
      Logger.log("FAIL: " + desc + " — esperado: " + JSON.stringify(expected) + ", obtido: " + JSON.stringify(actual));
    }
  }

  function assert(desc, condition) {
    if (condition) {
      passed++;
    } else {
      failed++;
      Logger.log("FAIL: " + desc);
    }
  }

  // ---- Shared_safeStr_ ----
  assertEqual("safeStr: null", Shared_safeStr_(null), "");
  assertEqual("safeStr: undefined", Shared_safeStr_(undefined), "");
  assertEqual("safeStr: number", Shared_safeStr_(42), "42");
  assertEqual("safeStr: string com espaços", Shared_safeStr_("  hello  "), "hello");
  assertEqual("safeStr: string vazia", Shared_safeStr_(""), "");

  // ---- Shared_normalize_ ----
  assertEqual("normalize: maiúsculas", Shared_normalize_("HELLO"), "hello");
  assertEqual("normalize: trim + lower", Shared_normalize_("  ABC  "), "abc");
  assertEqual("normalize: null", Shared_normalize_(null), "");

  // ---- Shared_parseJsonParam_ ----
  var parsed = Shared_parseJsonParam_('{"a":1}');
  assertEqual("parseJson: objeto válido", parsed.a, 1);
  var empty = Shared_parseJsonParam_("");
  assert("parseJson: vazio retorna {}", Object.keys(empty).length === 0);
  var invalid = Shared_parseJsonParam_("{bad json}");
  assert("parseJson: inválido retorna {}", Object.keys(invalid).length === 0);
  var nulo = Shared_parseJsonParam_(null);
  assert("parseJson: null retorna {}", Object.keys(nulo).length === 0);

  // ---- Shared_indexMap_ ----
  var map = Shared_indexMap_(["Nome", "Idade", "", "Email"]);
  assertEqual("indexMap: Nome=0", map["Nome"], 0);
  assertEqual("indexMap: Idade=1", map["Idade"], 1);
  assertEqual("indexMap: Email=3", map["Email"], 3);
  assertEqual("indexMap: vazio ignorado", map[""], undefined);

  var mapEmpty = Shared_indexMap_([]);
  assert("indexMap: array vazio", Object.keys(mapEmpty).length === 0);

  // ---- Shared_rowToObj_ ----
  var obj = Shared_rowToObj_(["Nome", "Idade"], ["João", 30]);
  assertEqual("rowToObj: Nome", obj["Nome"], "João");
  assertEqual("rowToObj: Idade", obj["Idade"], 30);

  var objNull = Shared_rowToObj_(["A", "B"], [null, undefined]);
  assertEqual("rowToObj: null vira vazio", objNull["A"], "");
  assertEqual("rowToObj: undefined vira vazio", objNull["B"], "");

  // ---- Shared_pad2_ ----
  assertEqual("pad2: 1", Shared_pad2_(1), "01");
  assertEqual("pad2: 10", Shared_pad2_(10), "10");
  assertEqual("pad2: 0", Shared_pad2_(0), "00");

  // ---- Shared_isoDate_ ----
  var d = new Date(2025, 0, 5); // 5 jan 2025
  assertEqual("isoDate: 2025-01-05", Shared_isoDate_(d), "2025-01-05");

  var d2 = new Date(2025, 11, 31); // 31 dez 2025
  assertEqual("isoDate: 2025-12-31", Shared_isoDate_(d2), "2025-12-31");

  // ---- Sumário ----
  var total = passed + failed;
  if (failed === 0) {
    Logger.log("OK: " + total + " testes passaram.");
  } else {
    Logger.log("FALHA: " + failed + " de " + total + " testes falharam.");
  }
}
