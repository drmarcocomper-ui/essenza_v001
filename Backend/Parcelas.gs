/**************************************************************
 * PARCELAMENTO — gerar parcelas automaticamente (menu)
 * Aba: Lancamentos
 * Header (15 colunas):
 * 1 Data_Competencia | 2 Data_Caixa | 3 Tipo | 4 Origem | 5 Categoria
 * 6 Descricao | 7 Cliente_Fornecedor | 8 Forma_Pagamento | 9 Instituicao_Financeira
 * 10 Titularidade | 11 Parcelamento | 12 Valor | 13 Status | 14 Observacoes | 15 Mes_a_receber
 **************************************************************/

const PARC = {
  sheetLanc: "Lancamentos",
  headerRow: 1,
  maxCols: 15,

  colDataCompetencia: 1,
  colDataCaixa: 2,
  colForma: 8,
  colParcelamento: 11,
  colValor: 12,
  colStatus: 13,
  colObs: 14,
  colMesReceber: 15
};

// Menu (não é gatilho instalável). Aparece ao abrir/recarregar a planilha.
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Financeiro")
    .addItem("Gerar parcelas (linha selecionada)", "gerarParcelasDaLinhaSelecionada")
    .addToUi();
}

function gerarParcelasDaLinhaSelecionada() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(PARC.sheetLanc);
  const ui = SpreadsheetApp.getUi();

  if (!sh) {
    ui.alert(`Aba "${PARC.sheetLanc}" não encontrada.`);
    return;
  }

  const r = sh.getActiveRange();
  if (!r) return;

  const row = r.getRow();
  if (row <= PARC.headerRow) {
    ui.alert(`Selecione uma linha abaixo do cabeçalho (aba ${PARC.sheetLanc}).`);
    return;
  }

  // Lê a linha completa (15 colunas)
  const rowValues = sh.getRange(row, 1, 1, PARC.maxCols).getValues()[0];

  // Anti-duplicação (se já gerou antes)
  const obs0 = String(rowValues[PARC.colObs - 1] || "");
  if (obs0.includes("auto-parcelas")) {
    ui.alert("Essa linha já gerou parcelas (auto-parcelas).");
    return;
  }

  // Forma de pagamento
  const formaRaw = String(rowValues[PARC.colForma - 1] || "").trim();
  const forma = formaRaw.toLowerCase();

  if (forma !== "cartao_credito") {
    ui.alert('Para usar a automação, defina Forma_Pagamento como "Cartao_Credito" na linha selecionada.');
    return;
  }

  // Parcelamento (1/N)
  const parcStr = String(rowValues[PARC.colParcelamento - 1] || "").trim();
  const parsed = parseParcela_(parcStr);
  if (!parsed) {
    ui.alert('Preencha "Parcelamento" no formato 1/3 (ex.: 1/4) antes de gerar.');
    return;
  }

  const { atual, total } = parsed;
  if (atual !== 1) {
    ui.alert('Gere as parcelas a partir da 1ª parcela (use "1/N").');
    return;
  }
  if (total < 2) {
    ui.alert("Número total de parcelas deve ser >= 2.");
    return;
  }

  // Valor total (aceita positivo ou negativo; não aceita zero)
  const totalValor = toNumberBR(rowValues[PARC.colValor - 1]);
  if (!totalValor || totalValor === 0) {
    ui.alert('Preencha "Valor" com o VALOR TOTAL (número) antes de gerar.');
    return;
  }

  // Data_Caixa
  const dataCaixa = rowValues[PARC.colDataCaixa - 1];
  if (!isDate_(dataCaixa)) {
    ui.alert('Preencha "Data_Caixa" com uma data válida antes de gerar.');
    return;
  }

  // Confirmação
  const ok = ui.alert(
    "Gerar parcelas",
    `Vou criar ${total - 1} linhas (2/${total} até ${total}/${total}) abaixo desta.\n` +
      `Valor total: ${formatBRL_(totalValor)} (dividido em ${total}x).\n\nContinuar?`,
    ui.ButtonSet.OK_CANCEL
  );
  if (ok !== ui.Button.OK) return;

  // Divide valor em parcelas (ajusta centavos na última) — preserva sinal
  const sign = totalValor < 0 ? -1 : 1;
  const absTotal = Math.abs(totalValor);

  const centsTotal = Math.round(absTotal * 100);
  const centsEach = Math.floor(centsTotal / total);
  const remainder = centsTotal - centsEach * total;

  // Atualiza a 1ª linha para o valor da 1ª parcela
  sh.getRange(row, PARC.colValor).setValue(sign * (centsEach / 100));

  // Atualiza observação na 1ª linha (marca como gerado)
  sh.getRange(row, PARC.colObs).setValue(obs0 ? `${obs0} | auto-parcelas` : "auto-parcelas");

  // (opcional) Mes_a_receber na 1ª linha
  sh.getRange(row, PARC.colMesReceber).setValue(
    Utilities.formatDate(new Date(dataCaixa), Session.getScriptTimeZone(), "yyyy-MM")
  );

  const newRows = [];

  for (let i = 2; i <= total; i++) {
    const clone = rowValues.slice();

    // Parcelamento i/N
    clone[PARC.colParcelamento - 1] = `${i}/${total}`;

    // Data_Caixa: + (i-1) meses
    const dt = addMonths_(new Date(dataCaixa), i - 1);
    clone[PARC.colDataCaixa - 1] = dt;

    // (opcional) Data_Competencia acompanha Data_Caixa
    clone[PARC.colDataCompetencia - 1] = dt;

    // Mes_a_receber: yyyy-MM
    clone[PARC.colMesReceber - 1] = Utilities.formatDate(dt, Session.getScriptTimeZone(), "yyyy-MM");

    // Valor da parcela (última recebe o resto)
    const cents = centsEach + (i === total ? remainder : 0);
    clone[PARC.colValor - 1] = sign * (cents / 100);

    // Status pendente
    clone[PARC.colStatus - 1] = "Pendente";

    // Observações
    const obs = String(clone[PARC.colObs - 1] || "");
    clone[PARC.colObs - 1] = obs ? `${obs} | auto-parcelas` : "auto-parcelas";

    newRows.push(clone);
  }

  // Insere e escreve
  sh.insertRowsAfter(row, newRows.length);
  sh.getRange(row + 1, 1, newRows.length, PARC.maxCols).setValues(newRows);

  // Copia formatação/validação da linha original para as novas linhas
  const source = sh.getRange(row, 1, 1, PARC.maxCols);
  const target = sh.getRange(row + 1, 1, newRows.length, PARC.maxCols);
  source.copyTo(target, { formatOnly: true });

  ui.alert("Parcelas geradas com sucesso.");
}

/* ================= helpers ================= */

function parseParcela_(s) {
  const m = String(s || "").trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return null;
  return { atual: Number(m[1]), total: Number(m[2]) };
}

function isDate_(v) {
  return Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime());
}

function addMonths_(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0); // último dia do mês anterior
  return d;
}

function toNumberBR(v) {
  if (typeof v === "number") return v;
  const s = String(v || "").trim();
  if (!s) return 0;
  const cleaned = s.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

function formatBRL_(n) {
  return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
