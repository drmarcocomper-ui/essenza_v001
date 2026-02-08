/**
 * Migracao.gs — Script de migração de dados
 * ------------------------------------------
 * Migra dados de "Financeiro_antigo" para "Lancamentos"
 *
 * COMO USAR:
 * 1. Abra o Apps Script
 * 2. Execute a função: Migracao_executar()
 * 3. Verifique o log para ver o resultado
 *
 * IMPORTANTE: Faça backup da planilha antes de executar!
 */

/**
 * Função principal de migração
 * Execute esta função no editor do Apps Script
 */
function Migracao_executar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Abas
  var abaOrigem = ss.getSheetByName("Financeiro_antigo");
  var abaClientes = ss.getSheetByName("Cadastro");
  var abaDestino = ss.getSheetByName("Lancamentos");

  if (!abaOrigem) {
    Logger.log("ERRO: Aba 'Financeiro_antigo' não encontrada!");
    return;
  }

  if (!abaClientes) {
    Logger.log("ERRO: Aba 'Cadastro' não encontrada!");
    return;
  }

  if (!abaDestino) {
    Logger.log("ERRO: Aba 'Lancamentos' não encontrada!");
    return;
  }

  // 1. Carregar mapa de clientes (ID -> Nome)
  Logger.log("Carregando clientes...");
  var mapaClientes = Migracao_carregarClientes_(abaClientes);
  Logger.log("Clientes carregados: " + Object.keys(mapaClientes).length);

  // 2. Ler dados da aba origem
  Logger.log("Lendo dados de Financeiro_antigo...");
  var dadosOrigem = abaOrigem.getDataRange().getValues();

  if (dadosOrigem.length <= 1) {
    Logger.log("Nenhum dado para migrar.");
    return;
  }

  var headerOrigem = dadosOrigem[0];
  var idxOrigem = Migracao_indexMap_(headerOrigem);

  // Verificar colunas necessárias
  var colunasNecessarias = ["DataAtendimento", "Tipo", "Descricao", "Valor", "Status"];
  for (var i = 0; i < colunasNecessarias.length; i++) {
    if (idxOrigem[colunasNecessarias[i]] === undefined) {
      Logger.log("ERRO: Coluna '" + colunasNecessarias[i] + "' não encontrada na origem!");
      Logger.log("Colunas encontradas: " + headerOrigem.join(", "));
      return;
    }
  }

  // 3. Preparar dados para destino
  Logger.log("Processando " + (dadosOrigem.length - 1) + " registros...");

  var registrosMigrados = 0;
  var erros = [];

  for (var r = 1; r < dadosOrigem.length; r++) {
    var row = dadosOrigem[r];

    try {
      var novoRegistro = Migracao_converterRegistro_(row, idxOrigem, mapaClientes);

      if (novoRegistro) {
        // Inserir na aba destino
        abaDestino.appendRow(novoRegistro);
        registrosMigrados++;

        // Log a cada 100 registros
        if (registrosMigrados % 100 === 0) {
          Logger.log("Migrados: " + registrosMigrados);
        }
      }
    } catch (e) {
      erros.push("Linha " + (r + 1) + ": " + e.message);
    }
  }

  // 4. Resultado
  Logger.log("========================================");
  Logger.log("MIGRAÇÃO CONCLUÍDA!");
  Logger.log("Registros migrados: " + registrosMigrados);
  Logger.log("Erros: " + erros.length);

  if (erros.length > 0) {
    Logger.log("Detalhes dos erros:");
    for (var i = 0; i < Math.min(erros.length, 20); i++) {
      Logger.log("  - " + erros[i]);
    }
    if (erros.length > 20) {
      Logger.log("  ... e mais " + (erros.length - 20) + " erros");
    }
  }
}

/**
 * Carrega mapa de clientes: ID -> Nome
 */
function Migracao_carregarClientes_(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return {};

  var header = data[0];
  var idx = Migracao_indexMap_(header);

  // Tentar diferentes nomes de coluna para ID
  var idxId = idx["ID_Cliente"];
  if (idxId === undefined) idxId = idx["ID"];
  if (idxId === undefined) idxId = idx["Id"];
  if (idxId === undefined) idxId = idx["id_cliente"];

  // Tentar diferentes nomes de coluna para Nome
  var idxNome = idx["NomeCliente"];
  if (idxNome === undefined) idxNome = idx["Nome"];
  if (idxNome === undefined) idxNome = idx["nome"];
  if (idxNome === undefined) idxNome = idx["Cliente"];

  if (idxId === undefined) {
    Logger.log("AVISO: Coluna de ID não encontrada em Cadastro. Colunas: " + header.join(", "));
    return {};
  }

  if (idxNome === undefined) {
    Logger.log("AVISO: Coluna de Nome não encontrada em Cadastro. Colunas: " + header.join(", "));
    return {};
  }

  var mapa = {};
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][idxId] || "").trim();
    var nome = String(data[i][idxNome] || "").trim();
    if (id) {
      mapa[id] = nome || "(Sem nome)";
    }
  }

  return mapa;
}

/**
 * Converte um registro do formato antigo para o novo
 */
function Migracao_converterRegistro_(row, idx, mapaClientes) {
  // Extrair valores da origem
  var dataAtendimento = Migracao_formatarData_(row[idx["DataAtendimento"]]);
  var dataCompensacao = Migracao_formatarData_(row[idx["DataCompensacao"]]);
  var competencia = row[idx["Competencia"]] || "";
  var tipo = String(row[idx["Tipo"]] || "").trim();
  var idCliente = String(row[idx["ID_Cliente"]] || "").trim();
  var descricao = String(row[idx["Descricao"]] || "").trim();
  var categoria = String(row[idx["Categoria"]] || "").trim();
  var pessoa = String(row[idx["Pessoa"]] || "").trim();
  var formaPagamento = String(row[idx["FormaPagamento"]] || "").trim();
  var valor = Migracao_parseNumber_(row[idx["Valor"]]);
  var status = String(row[idx["Status"]] || "").trim();

  // Ignorar linhas vazias
  if (!dataAtendimento && !descricao && !valor) {
    return null;
  }

  // Buscar nome do cliente
  var nomeCliente = "";
  if (idCliente && mapaClientes[idCliente]) {
    nomeCliente = mapaClientes[idCliente];
  } else if (idCliente) {
    nomeCliente = "(ID: " + idCliente + ")";
  }

  // Separar Pessoa em Instituicao_Financeira e Titularidade
  var instituicao = "";
  var titularidade = "";

  if (pessoa) {
    var parsed = Migracao_separarPessoa_(pessoa);
    instituicao = parsed.instituicao;
    titularidade = parsed.titularidade;
  }

  // Normalizar Tipo
  if (tipo.toLowerCase() === "entrada" || tipo.toLowerCase() === "receita") {
    tipo = "Entrada";
  } else if (tipo.toLowerCase() === "saida" || tipo.toLowerCase() === "saída" || tipo.toLowerCase() === "despesa") {
    tipo = "Saida";
  }

  // Normalizar Status
  if (status.toLowerCase() === "pago" || status.toLowerCase() === "recebido") {
    status = "Pago";
  } else if (status.toLowerCase() === "pendente" || status.toLowerCase() === "a receber") {
    status = "Pendente";
  }

  // Normalizar FormaPagamento
  formaPagamento = Migracao_normalizarFormaPagamento_(formaPagamento);

  // Calcular Mes_a_receber (YYYY-MM)
  var mesAReceber = "";
  if (competencia) {
    mesAReceber = Migracao_extrairMes_(competencia);
  } else if (dataCompensacao) {
    mesAReceber = dataCompensacao.substring(0, 7);
  } else if (dataAtendimento) {
    mesAReceber = dataAtendimento.substring(0, 7);
  }

  // Montar registro no formato novo
  // Ordem: Data_Competencia, Data_Caixa, Tipo, Origem, Categoria, Descricao,
  //        ID_Cliente, Cliente_Fornecedor, Forma_Pagamento, Instituicao_Financeira, Titularidade,
  //        Parcelamento, Valor, Status, Observacoes, Mes_a_receber
  return [
    dataAtendimento,           // Data_Competencia
    dataCompensacao || dataAtendimento,  // Data_Caixa
    tipo,                      // Tipo
    "",                        // Origem (não existe no antigo)
    categoria,                 // Categoria
    descricao,                 // Descricao
    idCliente,                 // ID_Cliente
    nomeCliente,               // Cliente_Fornecedor
    formaPagamento,            // Forma_Pagamento
    instituicao,               // Instituicao_Financeira
    titularidade,              // Titularidade
    "",                        // Parcelamento (não existe no antigo)
    valor,                     // Valor
    status,                    // Status
    "",                        // Observacoes
    mesAReceber                // Mes_a_receber
  ];
}

/**
 * Separa o campo Pessoa em Instituição e Titularidade
 * Ex: "Nubank PF" -> { instituicao: "Nubank", titularidade: "PF" }
 * Ex: "PicPay PJ" -> { instituicao: "PicPay", titularidade: "PJ" }
 */
function Migracao_separarPessoa_(pessoa) {
  pessoa = String(pessoa || "").trim();

  if (!pessoa) {
    return { instituicao: "", titularidade: "" };
  }

  // Verificar se termina com PF ou PJ
  var match = pessoa.match(/^(.+?)\s+(PF|PJ)$/i);

  if (match) {
    return {
      instituicao: match[1].trim(),
      titularidade: match[2].toUpperCase()
    };
  }

  // Se não tem PF/PJ, assume como instituição apenas
  return { instituicao: pessoa, titularidade: "" };
}

/**
 * Normaliza forma de pagamento para o padrão novo
 */
function Migracao_normalizarFormaPagamento_(forma) {
  forma = String(forma || "").trim().toLowerCase();

  var mapa = {
    "pix": "Pix",
    "dinheiro": "Dinheiro",
    "credito": "Cartao_Credito",
    "crédito": "Cartao_Credito",
    "cartao credito": "Cartao_Credito",
    "cartão crédito": "Cartao_Credito",
    "cartao_credito": "Cartao_Credito",
    "debito": "Cartao_Debito",
    "débito": "Cartao_Debito",
    "cartao debito": "Cartao_Debito",
    "cartão débito": "Cartao_Debito",
    "cartao_debito": "Cartao_Debito",
    "boleto": "Boleto",
    "transferencia": "Transferencia",
    "transferência": "Transferencia",
    "ted": "Transferencia",
    "doc": "Transferencia",
    "confianca": "Confianca",
    "confiança": "Confianca",
    "cortesia": "Cortesia"
  };

  return mapa[forma] || String(forma || "").trim();
}

/**
 * Formata data para YYYY-MM-DD
 */
function Migracao_formatarData_(valor) {
  if (!valor) return "";

  // Se já é Date object
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor.getTime())) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  var s = String(valor).trim();

  // Se já está em YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // Se está em DD/MM/YYYY
  var match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    var d = match[1].padStart(2, "0");
    var m = match[2].padStart(2, "0");
    var y = match[3];
    return y + "-" + m + "-" + d;
  }

  return "";
}

/**
 * Extrai YYYY-MM de uma competência
 */
function Migracao_extrairMes_(valor) {
  if (!valor) return "";

  var s = String(valor).trim();

  // Se já está em YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) {
    return s;
  }

  // Se está em YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s.substring(0, 7);
  }

  // Se está em MM/YYYY
  var match = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (match) {
    var m = match[1].padStart(2, "0");
    var y = match[2];
    return y + "-" + m;
  }

  // Se é Date object
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor.getTime())) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyy-MM");
  }

  return "";
}

/**
 * Parse número
 */
function Migracao_parseNumber_(valor) {
  if (valor === null || valor === undefined) return 0;

  if (typeof valor === "number") return valor;

  var s = String(valor).trim();
  if (!s) return 0;

  // Remove R$ e espaços
  s = s.replace(/R\$\s*/gi, "").trim();

  // Se tem vírgula como decimal (formato BR)
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }

  var num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

/**
 * Cria mapa de índices das colunas
 */
function Migracao_indexMap_(header) {
  var map = {};
  for (var i = 0; i < header.length; i++) {
    var key = String(header[i] || "").trim();
    if (key) map[key] = i;
  }
  return map;
}

/**
 * Cria o cabeçalho na aba Lancamentos
 * Execute esta função ANTES da migração se a aba estiver vazia
 */
function Migracao_criarCabecalho() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  Logger.log("Planilha: " + ss.getName());

  var abas = ss.getSheets().map(function(s) { return s.getName(); });
  Logger.log("Abas existentes: " + abas.join(", "));

  var sheet = ss.getSheetByName("Lancamentos");

  if (!sheet) {
    sheet = ss.insertSheet("Lancamentos");
    Logger.log("Aba 'Lancamentos' CRIADA.");
  } else {
    Logger.log("Aba 'Lancamentos' encontrada.");
  }

  var headers = [
    "Data_Competencia",
    "Data_Caixa",
    "Tipo",
    "Origem",
    "Categoria",
    "Descricao",
    "ID_Cliente",
    "Forma_Pagamento",
    "Instituicao_Financeira",
    "Titularidade",
    "Parcelamento",
    "Valor",
    "Status",
    "Observacoes",
    "Mes_a_receber"
  ];

  // Limpar primeira linha e escrever cabeçalho
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.clearContent();
  range.setValues([headers]);
  sheet.setFrozenRows(1);

  // Formatar cabeçalho
  range.setFontWeight("bold");
  range.setBackground("#8b5ca5");
  range.setFontColor("#ffffff");

  Logger.log("✅ Cabeçalho escrito com " + headers.length + " colunas.");
  Logger.log("Verifique a aba 'Lancamentos' na planilha.");

  // Forçar flush
  SpreadsheetApp.flush();
}

/**
 * Função de teste - mostra preview sem migrar
 */
function Migracao_preview() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaOrigem = ss.getSheetByName("Financeiro_antigo");
  var abaClientes = ss.getSheetByName("Cadastro");

  if (!abaOrigem || !abaClientes) {
    Logger.log("Abas não encontradas!");
    return;
  }

  var mapaClientes = Migracao_carregarClientes_(abaClientes);
  Logger.log("Clientes: " + Object.keys(mapaClientes).length);

  var dados = abaOrigem.getDataRange().getValues();
  Logger.log("Colunas origem: " + dados[0].join(" | "));
  Logger.log("Total de linhas: " + (dados.length - 1));

  if (dados.length > 1) {
    Logger.log("Exemplo linha 2: " + dados[1].join(" | "));
  }
}

/**
 * Atualiza a coluna ID_Cliente na aba Lancamentos
 * buscando o ID na aba Financeiro_antigo
 */
function Migracao_atualizarIDCliente() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var abaOrigem = ss.getSheetByName("Financeiro_antigo");
  var abaDestino = ss.getSheetByName("Lancamentos");

  if (!abaOrigem) {
    Logger.log("ERRO: Aba 'Financeiro_antigo' não encontrada!");
    return;
  }

  if (!abaDestino) {
    Logger.log("ERRO: Aba 'Lancamentos' não encontrada!");
    return;
  }

  // Ler dados da origem
  var dadosOrigem = abaOrigem.getDataRange().getValues();
  var headerOrigem = dadosOrigem[0];

  Logger.log("Colunas em Financeiro_antigo: " + headerOrigem.join(" | "));

  // Encontrar índice do ID_Cliente na origem (tentar várias variações)
  var idxIdOrigem = -1;
  for (var i = 0; i < headerOrigem.length; i++) {
    var col = String(headerOrigem[i] || "").trim().toLowerCase();
    if (col === "id_cliente" || col === "idcliente" || col === "id cliente") {
      idxIdOrigem = i;
      break;
    }
  }

  if (idxIdOrigem === -1) {
    Logger.log("ERRO: Coluna ID_Cliente não encontrada na origem!");
    Logger.log("Colunas disponíveis: " + headerOrigem.join(", "));
    return;
  }

  Logger.log("Coluna ID_Cliente encontrada no índice: " + idxIdOrigem + " (" + headerOrigem[idxIdOrigem] + ")");

  // Ler dados do destino
  var dadosDestino = abaDestino.getDataRange().getValues();
  var headerDestino = dadosDestino[0];

  Logger.log("Colunas em Lancamentos: " + headerDestino.join(" | "));

  // Encontrar índice do ID_Cliente no destino
  var idxIdDestino = -1;
  for (var j = 0; j < headerDestino.length; j++) {
    var colDest = String(headerDestino[j] || "").trim();
    if (colDest === "ID_Cliente") {
      idxIdDestino = j;
      break;
    }
  }

  if (idxIdDestino === -1) {
    Logger.log("ERRO: Coluna ID_Cliente não encontrada no destino!");
    return;
  }

  Logger.log("Coluna ID_Cliente no destino: índice " + idxIdDestino);

  // Criar mapa de linha origem (baseado em algum identificador único)
  // Vamos usar a combinação de Data + Descricao + Valor para fazer o match
  var idxDataOrigem = Migracao_findColIndex_(headerOrigem, ["DataAtendimento", "Data"]);
  var idxDescOrigem = Migracao_findColIndex_(headerOrigem, ["Descricao", "Descrição"]);
  var idxValorOrigem = Migracao_findColIndex_(headerOrigem, ["Valor"]);

  var idxDataDestino = Migracao_findColIndex_(headerDestino, ["Data_Competencia"]);
  var idxDescDestino = Migracao_findColIndex_(headerDestino, ["Descricao"]);
  var idxValorDestino = Migracao_findColIndex_(headerDestino, ["Valor"]);

  Logger.log("Índices origem - Data: " + idxDataOrigem + ", Desc: " + idxDescOrigem + ", Valor: " + idxValorOrigem);
  Logger.log("Índices destino - Data: " + idxDataDestino + ", Desc: " + idxDescDestino + ", Valor: " + idxValorDestino);

  // Criar mapa de IDs da origem
  var mapaIds = {};
  for (var r = 1; r < dadosOrigem.length; r++) {
    var row = dadosOrigem[r];
    var data = Migracao_formatarData_(row[idxDataOrigem]);
    var desc = String(row[idxDescOrigem] || "").trim();
    var valor = Migracao_parseNumber_(row[idxValorOrigem]);
    var idCliente = String(row[idxIdOrigem] || "").trim();

    if (data && idCliente) {
      var chave = data + "|" + desc + "|" + valor;
      mapaIds[chave] = idCliente;
    }
  }

  Logger.log("Mapa de IDs criado com " + Object.keys(mapaIds).length + " registros");

  // Atualizar destino
  var atualizados = 0;
  var updates = [];

  for (var d = 1; d < dadosDestino.length; d++) {
    var rowDest = dadosDestino[d];
    var dataDest = String(rowDest[idxDataDestino] || "").trim();
    var descDest = String(rowDest[idxDescDestino] || "").trim();
    var valorDest = Migracao_parseNumber_(rowDest[idxValorDestino]);

    var chaveDest = dataDest + "|" + descDest + "|" + valorDest;

    if (mapaIds[chaveDest]) {
      updates.push({
        row: d + 1,
        id: mapaIds[chaveDest]
      });
      atualizados++;
    }
  }

  // Remover validação de dados da coluna ID_Cliente
  var lastRow = abaDestino.getLastRow();
  if (lastRow > 1) {
    var colRange = abaDestino.getRange(2, idxIdDestino + 1, lastRow - 1, 1);
    colRange.clearDataValidations();
    Logger.log("Validação de dados removida da coluna ID_Cliente");
  }

  // Aplicar updates
  for (var u = 0; u < updates.length; u++) {
    abaDestino.getRange(updates[u].row, idxIdDestino + 1).setValue(updates[u].id);
  }

  SpreadsheetApp.flush();

  Logger.log("✅ Atualização concluída!");
  Logger.log("Registros atualizados: " + atualizados + " de " + (dadosDestino.length - 1));
}

/**
 * Encontra índice de coluna tentando múltiplos nomes
 */
function Migracao_findColIndex_(header, nomes) {
  for (var i = 0; i < header.length; i++) {
    var col = String(header[i] || "").trim().toLowerCase();
    for (var n = 0; n < nomes.length; n++) {
      if (col === nomes[n].toLowerCase()) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Limpa a aba Lancamentos e executa a migração do zero
 * CUIDADO: Isso apaga todos os dados atuais!
 */
function Migracao_limparERodar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Lancamentos");

  if (!sheet) {
    Logger.log("ERRO: Aba 'Lancamentos' não encontrada!");
    return;
  }

  // 1. Limpar dados (manter só linha 1)
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow > 1 && lastCol > 0) {
    // Limpar conteúdo ao invés de deletar linhas
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearDataValidations();
    Logger.log("✅ Dados antigos removidos (" + (lastRow - 1) + " linhas)");
  }

  // 2. Recriar cabeçalho correto
  var headers = [
    "Data_Competencia",
    "Data_Caixa",
    "Tipo",
    "Origem",
    "Categoria",
    "Descricao",
    "ID_Cliente",
    "Forma_Pagamento",
    "Instituicao_Financeira",
    "Titularidade",
    "Parcelamento",
    "Valor",
    "Status",
    "Observacoes",
    "Mes_a_receber"
  ];

  // Limpar validações e escrever cabeçalho
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.clearDataValidations();
  headerRange.clearContent();
  headerRange.setValues([headers]);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#8b5ca5");
  headerRange.setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  Logger.log("✅ Cabeçalho recriado com " + headers.length + " colunas");

  SpreadsheetApp.flush();

  // 3. Executar migração
  Logger.log("========== INICIANDO MIGRAÇÃO ==========");

  var abaOrigem = ss.getSheetByName("Financeiro_antigo");
  var abaClientes = ss.getSheetByName("Cadastro");

  if (!abaOrigem) {
    Logger.log("ERRO: Aba 'Financeiro_antigo' não encontrada!");
    return;
  }

  // Carregar mapa de clientes
  var mapaClientes = {};
  if (abaClientes) {
    mapaClientes = Migracao_carregarClientes_(abaClientes);
    Logger.log("Clientes carregados: " + Object.keys(mapaClientes).length);
  }

  // Ler dados da origem
  var dadosOrigem = abaOrigem.getDataRange().getValues();
  if (dadosOrigem.length <= 1) {
    Logger.log("Nenhum dado para migrar.");
    return;
  }

  var headerOrigem = dadosOrigem[0];
  var idxOrigem = Migracao_indexMap_(headerOrigem);

  Logger.log("Colunas origem: " + headerOrigem.join(" | "));
  Logger.log("Total de linhas para migrar: " + (dadosOrigem.length - 1));

  // Migrar cada linha
  var migrados = 0;
  var erros = [];

  for (var r = 1; r < dadosOrigem.length; r++) {
    var row = dadosOrigem[r];

    try {
      // Extrair dados da origem
      var dataAtendimento = Migracao_formatarData_(row[idxOrigem["DataAtendimento"]]);
      var dataCompensacao = Migracao_formatarData_(row[idxOrigem["DataCompensacao"]]);
      var competencia = row[idxOrigem["Competencia"]] || "";
      var tipo = String(row[idxOrigem["Tipo"]] || "").trim();
      var idCliente = String(row[idxOrigem["ID_Cliente"]] || "").trim();
      var descricao = String(row[idxOrigem["Descricao"]] || "").trim();
      var categoria = String(row[idxOrigem["Categoria"]] || "").trim();
      var pessoa = String(row[idxOrigem["Pessoa"]] || "").trim();
      var formaPagamento = String(row[idxOrigem["FormaPagamento"]] || "").trim();
      var valor = Migracao_parseNumber_(row[idxOrigem["Valor"]]);
      var status = String(row[idxOrigem["Status"]] || "").trim();

      // Ignorar linhas vazias
      if (!dataAtendimento && !descricao && !valor) {
        continue;
      }

      // Buscar nome do cliente
      var nomeCliente = "";
      if (idCliente && mapaClientes[idCliente]) {
        nomeCliente = mapaClientes[idCliente];
      } else if (idCliente) {
        nomeCliente = idCliente; // Usa o próprio ID como nome se não encontrar
      }

      // Separar Pessoa em Instituicao e Titularidade
      var parsed = Migracao_separarPessoa_(pessoa);

      // Normalizar Tipo
      if (tipo.toLowerCase() === "entrada" || tipo.toLowerCase() === "receita") {
        tipo = "Entrada";
      } else if (tipo.toLowerCase() === "saida" || tipo.toLowerCase() === "saída" || tipo.toLowerCase() === "despesa") {
        tipo = "Saida";
      }

      // Normalizar Status
      if (status.toLowerCase() === "pago" || status.toLowerCase() === "recebido") {
        status = "Pago";
      } else if (status.toLowerCase() === "pendente" || status.toLowerCase() === "a receber") {
        status = "Pendente";
      }

      // Normalizar FormaPagamento
      formaPagamento = Migracao_normalizarFormaPagamento_(formaPagamento);

      // Calcular Mes_a_receber
      var mesAReceber = "";
      if (competencia) {
        mesAReceber = Migracao_extrairMes_(competencia);
      } else if (dataCompensacao) {
        mesAReceber = dataCompensacao.substring(0, 7);
      } else if (dataAtendimento) {
        mesAReceber = dataAtendimento.substring(0, 7);
      }

      // Montar linha no formato novo
      var novaLinha = [
        dataAtendimento,                    // Data_Competencia
        dataCompensacao || dataAtendimento, // Data_Caixa
        tipo,                               // Tipo
        "",                                 // Origem
        categoria,                          // Categoria
        descricao,                          // Descricao
        idCliente,                          // ID_Cliente
        formaPagamento,                     // Forma_Pagamento
        parsed.instituicao,                 // Instituicao_Financeira
        parsed.titularidade,                // Titularidade
        "",                                 // Parcelamento
        valor,                              // Valor
        status,                             // Status
        "",                                 // Observacoes
        mesAReceber                         // Mes_a_receber
      ];

      sheet.appendRow(novaLinha);
      migrados++;

      if (migrados % 100 === 0) {
        Logger.log("Migrados: " + migrados);
        SpreadsheetApp.flush();
      }

    } catch (e) {
      erros.push("Linha " + (r + 1) + ": " + e.message);
    }
  }

  SpreadsheetApp.flush();

  Logger.log("========================================");
  Logger.log("✅ MIGRAÇÃO CONCLUÍDA!");
  Logger.log("Registros migrados: " + migrados);
  Logger.log("Erros: " + erros.length);

  if (erros.length > 0 && erros.length <= 10) {
    Logger.log("Detalhes dos erros:");
    for (var i = 0; i < erros.length; i++) {
      Logger.log("  - " + erros[i]);
    }
  }
}

/**
 * Importa dados de Lancamentos_2026 para Lancamentos (sem apagar existentes)
 * Mesma estrutura de Financeiro_antigo
 */
function Migracao_importarLancamentos2026() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var abaOrigem = ss.getSheetByName("Lancamentos_2026");
  var abaDestino = ss.getSheetByName("Lancamentos");
  var abaClientes = ss.getSheetByName("Cadastro");

  if (!abaOrigem) {
    Logger.log("ERRO: Aba 'Lancamentos_2026' não encontrada!");
    return;
  }

  if (!abaDestino) {
    Logger.log("ERRO: Aba 'Lancamentos' não encontrada!");
    return;
  }

  Logger.log("========== IMPORTANDO LANCAMENTOS_2026 ==========");
  Logger.log("Dados existentes em Lancamentos serão MANTIDOS.");

  // Carregar mapa de clientes
  var mapaClientes = {};
  if (abaClientes) {
    mapaClientes = Migracao_carregarClientes_(abaClientes);
    Logger.log("Clientes carregados: " + Object.keys(mapaClientes).length);
  }

  // Ler dados da origem
  var dadosOrigem = abaOrigem.getDataRange().getValues();
  if (dadosOrigem.length <= 1) {
    Logger.log("Nenhum dado para importar.");
    return;
  }

  var headerOrigem = dadosOrigem[0];
  var idxOrigem = Migracao_indexMap_(headerOrigem);

  Logger.log("Colunas origem: " + headerOrigem.join(" | "));
  Logger.log("Total de linhas para importar: " + (dadosOrigem.length - 1));

  // Importar cada linha
  var importados = 0;
  var erros = [];

  for (var r = 1; r < dadosOrigem.length; r++) {
    var row = dadosOrigem[r];

    try {
      // Extrair dados da origem (mesma estrutura de Financeiro_antigo)
      var dataAtendimento = Migracao_formatarData_(row[idxOrigem["DataAtendimento"]]);
      var dataCompensacao = Migracao_formatarData_(row[idxOrigem["DataCompensacao"]]);
      var competencia = row[idxOrigem["Competencia"]] || "";
      var tipo = String(row[idxOrigem["Tipo"]] || "").trim();
      var idCliente = String(row[idxOrigem["ID_Cliente"]] || "").trim();
      var descricao = String(row[idxOrigem["Descricao"]] || "").trim();
      var categoria = String(row[idxOrigem["Categoria"]] || "").trim();
      var pessoa = String(row[idxOrigem["Pessoa"]] || "").trim();
      var formaPagamento = String(row[idxOrigem["FormaPagamento"]] || "").trim();
      var valor = Migracao_parseNumber_(row[idxOrigem["Valor"]]);
      var status = String(row[idxOrigem["Status"]] || "").trim();

      // Ignorar linhas vazias
      if (!dataAtendimento && !descricao && !valor) {
        continue;
      }

      // Separar Pessoa em Instituicao e Titularidade
      var parsed = Migracao_separarPessoa_(pessoa);

      // Normalizar Tipo
      if (tipo.toLowerCase() === "entrada" || tipo.toLowerCase() === "receita") {
        tipo = "Entrada";
      } else if (tipo.toLowerCase() === "saida" || tipo.toLowerCase() === "saída" || tipo.toLowerCase() === "despesa") {
        tipo = "Saida";
      }

      // Normalizar Status
      if (status.toLowerCase() === "pago" || status.toLowerCase() === "recebido") {
        status = "Pago";
      } else if (status.toLowerCase() === "pendente" || status.toLowerCase() === "a receber") {
        status = "Pendente";
      }

      // Normalizar FormaPagamento
      formaPagamento = Migracao_normalizarFormaPagamento_(formaPagamento);

      // Calcular Mes_a_receber
      var mesAReceber = "";
      if (competencia) {
        mesAReceber = Migracao_extrairMes_(competencia);
      } else if (dataCompensacao) {
        mesAReceber = dataCompensacao.substring(0, 7);
      } else if (dataAtendimento) {
        mesAReceber = dataAtendimento.substring(0, 7);
      }

      // Montar linha no formato novo (15 colunas)
      var novaLinha = [
        dataAtendimento,                    // Data_Competencia
        dataCompensacao || dataAtendimento, // Data_Caixa
        tipo,                               // Tipo
        "",                                 // Origem
        categoria,                          // Categoria
        descricao,                          // Descricao
        idCliente,                          // ID_Cliente
        formaPagamento,                     // Forma_Pagamento
        parsed.instituicao,                 // Instituicao_Financeira
        parsed.titularidade,                // Titularidade
        "",                                 // Parcelamento
        valor,                              // Valor
        status,                             // Status
        "",                                 // Observacoes
        mesAReceber                         // Mes_a_receber
      ];

      abaDestino.appendRow(novaLinha);
      importados++;

      if (importados % 100 === 0) {
        Logger.log("Importados: " + importados);
        SpreadsheetApp.flush();
      }

    } catch (e) {
      erros.push("Linha " + (r + 1) + ": " + e.message);
    }
  }

  SpreadsheetApp.flush();

  Logger.log("========================================");
  Logger.log("✅ IMPORTAÇÃO CONCLUÍDA!");
  Logger.log("Registros importados: " + importados);
  Logger.log("Erros: " + erros.length);

  if (erros.length > 0 && erros.length <= 10) {
    Logger.log("Detalhes dos erros:");
    for (var i = 0; i < erros.length; i++) {
      Logger.log("  - " + erros[i]);
    }
  }
}

/**
 * Debug - mostra os primeiros registros de cada aba para comparar
 */
function Migracao_debug() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaOrigem = ss.getSheetByName("Financeiro_antigo");
  var abaDestino = ss.getSheetByName("Lancamentos");

  Logger.log("========== ORIGEM (Financeiro_antigo) ==========");
  var dadosOrigem = abaOrigem.getDataRange().getValues();
  var headerOrigem = dadosOrigem[0];

  // Mostrar 3 primeiras linhas de dados
  for (var i = 1; i <= Math.min(3, dadosOrigem.length - 1); i++) {
    var row = dadosOrigem[i];
    Logger.log("Linha " + (i+1) + ":");
    Logger.log("  DataAtendimento: [" + row[2] + "] tipo: " + typeof row[2]);
    Logger.log("  ID_Cliente: [" + row[6] + "]");
    Logger.log("  Descricao: [" + row[7] + "]");
    Logger.log("  Valor: [" + row[11] + "] tipo: " + typeof row[11]);
  }

  Logger.log("");
  Logger.log("========== DESTINO (Lancamentos) ==========");
  var dadosDestino = abaDestino.getDataRange().getValues();

  for (var j = 1; j <= Math.min(3, dadosDestino.length - 1); j++) {
    var rowD = dadosDestino[j];
    Logger.log("Linha " + (j+1) + ":");
    Logger.log("  Data_Competencia: [" + rowD[0] + "] tipo: " + typeof rowD[0]);
    Logger.log("  ID_Cliente: [" + rowD[6] + "]");
    Logger.log("  Descricao: [" + rowD[5] + "]");
    Logger.log("  Valor: [" + rowD[12] + "] tipo: " + typeof rowD[12]);
  }

  Logger.log("");
  Logger.log("========== COMPARAÇÃO DE CHAVES ==========");

  // Mostrar as chaves geradas
  for (var k = 1; k <= Math.min(3, dadosOrigem.length - 1); k++) {
    var rowO = dadosOrigem[k];
    var dataO = Migracao_formatarData_(rowO[2]);
    var descO = String(rowO[7] || "").trim();
    var valorO = Migracao_parseNumber_(rowO[11]);
    var chaveO = dataO + "|" + descO + "|" + valorO;
    Logger.log("Chave ORIGEM " + k + ": " + chaveO);
  }

  for (var l = 1; l <= Math.min(3, dadosDestino.length - 1); l++) {
    var rowDe = dadosDestino[l];
    var dataD = String(rowDe[0] || "").trim();
    var descD = String(rowDe[5] || "").trim();
    var valorD = Migracao_parseNumber_(rowDe[12]);
    var chaveD = dataD + "|" + descD + "|" + valorD;
    Logger.log("Chave DESTINO " + l + ": " + chaveD);
  }
}
