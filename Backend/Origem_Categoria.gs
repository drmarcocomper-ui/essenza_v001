/**************************************************************
 * ============================================================
 * ARQUIVO 1 — DROPDOWNS (Tipo -> Origem -> Categoria)
 * Nome sugerido: Dropdowns.gs
 * ============================================================
 **************************************************************/

const CFG = {
  sheetLanc: "Lancamentos",
  sheetListas: "Listas",
  headerRow: 1,
  colTipo: 3,        // C
  colOrigem: 4,      // D
  colCategoria: 5,   // E
  listStartRow: 2,
  listMaxRows: 999
};

// Origem -> coluna em Listas
const MAP_COL = {
  Servico: 1,       // A
  Produto: 2,       // B
  Despesa: 3,       // C
  Financeiro: 4     // D
};

// Tipo -> Origens permitidas
const ORIGENS_POR_TIPO = {
  Entrada: ["Servico", "Produto", "Financeiro"],
  Saida: ["Despesa", "Financeiro"]
};

/**
 * Handler do gatilho onEdit (INSTALÁVEL).
 * Dispara ao editar Tipo (C) ou Origem (D) na aba "Lancamentos".
 */
function handleEdit(e) {
  if (!e || !e.range) return;

  const sh = e.range.getSheet();
  if (sh.getName() !== CFG.sheetLanc) return;

  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row <= CFG.headerRow) return;

  const ss = e.source;
  const listas = ss.getSheetByName(CFG.sheetListas);
  if (!listas) return;

  const tipoCell = sh.getRange(row, CFG.colTipo);
  const origemCell = sh.getRange(row, CFG.colOrigem);
  const catCell = sh.getRange(row, CFG.colCategoria);

  const tipo = String(tipoCell.getValue() || "").trim();     // Entrada / Saida
  const origem = String(origemCell.getValue() || "").trim(); // Servico / Produto / ...

  // 1) Mudou o TIPO (C): ajusta lista de Origem
  if (col === CFG.colTipo) {
    origemCell.clearDataValidations();
    origemCell.clearContent();
    catCell.clearDataValidations();
    catCell.clearContent();

    const allowed = ORIGENS_POR_TIPO[tipo];
    if (!allowed) return;

    const ruleOrigem = SpreadsheetApp.newDataValidation()
      .requireValueInList(allowed, true)
      .setAllowInvalid(false)
      .build();

    origemCell.setDataValidation(ruleOrigem);
    return;
  }

  // 2) Mudou a ORIGEM (D): ajusta lista de Categoria
  if (col === CFG.colOrigem) {
    catCell.clearDataValidations();
    catCell.clearContent();

    if (!origem || !MAP_COL[origem]) return;

    // Segurança: Origem compatível com o Tipo
    const allowed = ORIGENS_POR_TIPO[tipo];
    if (allowed && !allowed.includes(origem)) {
      origemCell.clearContent();
      return;
    }

    const listCol = MAP_COL[origem];
    const listRange = listas.getRange(CFG.listStartRow, listCol, CFG.listMaxRows, 1);

    const ruleCat = SpreadsheetApp.newDataValidation()
      .requireValueInRange(listRange, true)
      .setAllowInvalid(false)
      .build();

    catCell.setDataValidation(ruleCat);
  }
}

/**************************************************************
 * (Opcional) Instalação do gatilho — use se quiser pelo menu.
 **************************************************************/
function installDropdownTrigger() {
  // remove triggers antigos desta função
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "handleEdit") ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger("handleEdit")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
}
