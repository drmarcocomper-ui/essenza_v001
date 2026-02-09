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

// ============================================================
// CONFIGURAR SENHA DO SISTEMA
// ============================================================
/**
 * Execute esta função para configurar a senha do login.
 * TROQUE "essenza2025" pela senha que você deseja usar.
 */
function ConfigurarSenha() {
  var SENHA = "essenza2025";  // <-- TROQUE AQUI pela sua senha

  if (!SENHA || SENHA.length < 6) {
    Logger.log("ERRO: A senha deve ter pelo menos 6 caracteres.");
    return;
  }

  Auth_SetupPassword_(SENHA);
  Logger.log("✅ Senha configurada com sucesso!");
  Logger.log("Agora você pode fazer login com essa senha.");
}

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
    "ID_Fornecedor",
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
    "ID_Fornecedor",
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
        "",                                 // ID_Fornecedor
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

      // Montar linha no formato novo (16 colunas)
      var novaLinha = [
        dataAtendimento,                    // Data_Competencia
        dataCompensacao || dataAtendimento, // Data_Caixa
        tipo,                               // Tipo
        "",                                 // Origem
        categoria,                          // Categoria
        descricao,                          // Descricao
        idCliente,                          // ID_Cliente
        "",                                 // ID_Fornecedor
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
 * Importa dados de Lancamentos_2026 (estrutura nova) para Lancamentos
 * Corrige ID_Cliente buscando pelo nome na aba Cadastro
 */
function Migracao_importarLancamentos2026_v2() {
  Logger.log("Use Migracao_importarLancamentos2026_v3() - versão atualizada");
}

/**
 * Importa lançamentos de Lancamentos_2026 para Lancamentos
 * - Converte nome do cliente para ID_Cliente
 * - Converte nome do fornecedor para ID_Fornecedor (se Tipo=Saida)
 * - Loga nomes não encontrados para debug
 */
function Migracao_importarLancamentos2026_v3() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var abaOrigem = ss.getSheetByName("Lancamentos_2026");
  var abaDestino = ss.getSheetByName("Lancamentos");
  var abaClientes = ss.getSheetByName("Cadastro");
  var abaFornecedores = ss.getSheetByName("Fornecedores");

  if (!abaOrigem) {
    Logger.log("ERRO: Aba 'Lancamentos_2026' não encontrada!");
    return;
  }

  if (!abaDestino) {
    Logger.log("ERRO: Aba 'Lancamentos' não encontrada!");
    return;
  }

  Logger.log("========== IMPORTANDO LANCAMENTOS_2026 (v3) ==========");

  // Carregar mapa de clientes: Nome -> ID
  var mapaClientes = {};
  if (abaClientes) {
    var dataClientes = abaClientes.getDataRange().getValues();
    if (dataClientes.length > 1) {
      var headerClientes = dataClientes[0];
      var idxClientes = Migracao_indexMap_(headerClientes);

      var idxId = idxClientes["ID_Cliente"] !== undefined ? idxClientes["ID_Cliente"] : idxClientes["ID"];
      var idxNome = idxClientes["NomeCliente"] !== undefined ? idxClientes["NomeCliente"] : idxClientes["Nome"];

      if (idxId !== undefined && idxNome !== undefined) {
        for (var c = 1; c < dataClientes.length; c++) {
          var id = String(dataClientes[c][idxId] || "").trim();
          var nome = String(dataClientes[c][idxNome] || "").trim().toLowerCase();
          if (id && nome) {
            mapaClientes[nome] = id;
          }
        }
      }
    }
    Logger.log("Clientes carregados: " + Object.keys(mapaClientes).length);
  }

  // Carregar mapa de fornecedores: Nome -> ID
  var mapaFornecedores = {};
  if (abaFornecedores) {
    var dataForn = abaFornecedores.getDataRange().getValues();
    if (dataForn.length > 1) {
      var headerForn = dataForn[0];
      var idxForn = Migracao_indexMap_(headerForn);

      var idxIdF = idxForn["ID_Fornecedor"] !== undefined ? idxForn["ID_Fornecedor"] : idxForn["ID"];
      var idxNomeF = idxForn["NomeFornecedor"] !== undefined ? idxForn["NomeFornecedor"] : idxForn["Nome"];

      if (idxIdF !== undefined && idxNomeF !== undefined) {
        for (var f = 1; f < dataForn.length; f++) {
          var idF = String(dataForn[f][idxIdF] || "").trim();
          var nomeF = String(dataForn[f][idxNomeF] || "").trim().toLowerCase();
          if (idF && nomeF) {
            mapaFornecedores[nomeF] = idF;
          }
        }
      }
    }
    Logger.log("Fornecedores carregados: " + Object.keys(mapaFornecedores).length);
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
  var clientesCorrigidos = 0;
  var fornecedoresCorrigidos = 0;
  var nomesNaoEncontrados = {};

  for (var r = 1; r < dadosOrigem.length; r++) {
    var row = dadosOrigem[r];

    try {
      var dataCompetencia = Migracao_formatarData_(row[idxOrigem["Data_Competencia"]]);
      var dataCaixa = Migracao_formatarData_(row[idxOrigem["Data_Caixa"]]);
      var tipo = String(row[idxOrigem["Tipo"]] || "").trim();
      var origem = String(row[idxOrigem["Origem"]] || "").trim();
      var categoria = String(row[idxOrigem["Categoria"]] || "").trim();
      var descricao = String(row[idxOrigem["Descricao"]] || "").trim();

      // Coluna ID_Cliente pode ter nome de cliente OU fornecedor
      var nomeOriginal = String(row[idxOrigem["ID_Cliente"]] || "").trim();

      // Coluna Cliente_Fornecedor (se existir)
      var clienteFornecedor = "";
      if (idxOrigem["Cliente_Fornecedor"] !== undefined) {
        clienteFornecedor = String(row[idxOrigem["Cliente_Fornecedor"]] || "").trim();
      }

      var formaPagamento = String(row[idxOrigem["Forma_Pagamento"]] || "").trim();
      var instituicao = String(row[idxOrigem["Instituicao_Financeira"]] || "").trim();
      var titularidade = String(row[idxOrigem["Titularidade"]] || "").trim();
      var parcelamento = String(row[idxOrigem["Parcelamento"]] || "").trim();
      var valor = Migracao_parseNumber_(row[idxOrigem["Valor"]]);
      var status = String(row[idxOrigem["Status"]] || "").trim();
      var observacoes = String(row[idxOrigem["Observacoes"]] || "").trim();
      var mesAReceber = Migracao_formatarMes_(row[idxOrigem["Mes_a_receber"]]);

      // Ignorar linhas vazias
      if (!dataCompetencia && !dataCaixa && !descricao && !valor) {
        continue;
      }

      var idCliente = "";
      var idFornecedor = "";
      var nomeNorm = nomeOriginal.toLowerCase();

      // Se é Entrada, buscar como cliente
      if (tipo === "Entrada" || tipo === "Receita") {
        if (mapaClientes[nomeNorm]) {
          idCliente = mapaClientes[nomeNorm];
          clientesCorrigidos++;
        } else if (nomeOriginal) {
          nomesNaoEncontrados[nomeOriginal] = (nomesNaoEncontrados[nomeOriginal] || 0) + 1;
        }
      }
      // Se é Saída, buscar como fornecedor
      else if (tipo === "Saida" || tipo === "Saída" || tipo === "Despesa") {
        if (mapaFornecedores[nomeNorm]) {
          idFornecedor = mapaFornecedores[nomeNorm];
          fornecedoresCorrigidos++;
        } else if (nomeOriginal) {
          nomesNaoEncontrados[nomeOriginal] = (nomesNaoEncontrados[nomeOriginal] || 0) + 1;
        }
      }

      // Montar linha no formato destino (16 colunas)
      var novaLinha = [
        dataCompetencia,      // Data_Competencia
        dataCaixa,            // Data_Caixa
        tipo,                 // Tipo
        origem,               // Origem
        categoria,            // Categoria
        descricao,            // Descricao
        idCliente,            // ID_Cliente
        idFornecedor,         // ID_Fornecedor
        formaPagamento,       // Forma_Pagamento
        instituicao,          // Instituicao_Financeira
        titularidade,         // Titularidade
        parcelamento,         // Parcelamento
        valor,                // Valor
        status,               // Status
        observacoes,          // Observacoes
        mesAReceber           // Mes_a_receber
      ];

      abaDestino.appendRow(novaLinha);
      importados++;

      if (importados % 50 === 0) {
        Logger.log("Importados: " + importados);
        SpreadsheetApp.flush();
      }

    } catch (e) {
      Logger.log("Erro linha " + (r + 1) + ": " + e.message);
    }
  }

  SpreadsheetApp.flush();

  Logger.log("========================================");
  Logger.log("✅ IMPORTAÇÃO CONCLUÍDA!");
  Logger.log("Registros importados: " + importados);
  Logger.log("Clientes convertidos: " + clientesCorrigidos);
  Logger.log("Fornecedores convertidos: " + fornecedoresCorrigidos);

  var nomesNaoEnc = Object.keys(nomesNaoEncontrados);
  if (nomesNaoEnc.length > 0) {
    Logger.log("⚠️ Nomes NÃO encontrados (" + nomesNaoEnc.length + "):");
    for (var i = 0; i < Math.min(nomesNaoEnc.length, 20); i++) {
      Logger.log("  - " + nomesNaoEnc[i] + " (" + nomesNaoEncontrados[nomesNaoEnc[i]] + "x)");
    }
  }
}

/**
 * Formata mês para YYYY-MM
 */
function Migracao_formatarMes_(value) {
  if (!value) return "";

  // Se já é Date object
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0");
  }

  var s = String(value).trim();

  // Já está no formato YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;

  // Formato YYYY-MM-DD ou ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);

  return s;
}

/**
 * Debug - mostra colunas e dados de Lancamentos_2026
 */
function Migracao_debugLancamentos2026() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Lancamentos_2026");

  if (!sheet) {
    Logger.log("Aba 'Lancamentos_2026' não encontrada!");
    return;
  }

  var data = sheet.getDataRange().getValues();
  var header = data[0];

  Logger.log("Colunas: " + header.join(" | "));

  // Mostrar 3 primeiras linhas
  for (var i = 1; i <= Math.min(3, data.length - 1); i++) {
    Logger.log("--- Linha " + (i + 1) + " ---");
    for (var j = 0; j < header.length; j++) {
      Logger.log("  " + header[j] + ": [" + data[i][j] + "]");
    }
  }
}

/**
 * Adiciona a coluna ID_Fornecedor na aba Lancamentos e cria a aba Fornecedores
 * Execute esta função para atualizar a estrutura do sistema
 */
function Migracao_adicionarFornecedores() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  Logger.log("========== MIGRAÇÃO FORNECEDORES ==========");

  // 1. Criar aba Fornecedores se não existir
  var abaFornecedores = ss.getSheetByName("Fornecedores");
  if (!abaFornecedores) {
    abaFornecedores = ss.insertSheet("Fornecedores");
    Logger.log("✅ Aba 'Fornecedores' criada.");

    // Cabeçalho
    var headersForn = [
      "ID_Fornecedor",
      "NomeFornecedor",
      "Telefone",
      "E-mail",
      "CNPJ_CPF",
      "Categoria",
      "Endereco",
      "DataCadastro",
      "Observacao"
    ];

    var rangeForn = abaFornecedores.getRange(1, 1, 1, headersForn.length);
    rangeForn.setValues([headersForn]);
    rangeForn.setFontWeight("bold");
    rangeForn.setBackground("#8b5ca5");
    rangeForn.setFontColor("#ffffff");
    abaFornecedores.setFrozenRows(1);

    Logger.log("✅ Cabeçalho de Fornecedores criado.");
  } else {
    Logger.log("Aba 'Fornecedores' já existe.");
  }

  // 2. Atualizar aba Lancamentos para incluir ID_Fornecedor
  var abaLancamentos = ss.getSheetByName("Lancamentos");
  if (!abaLancamentos) {
    Logger.log("ERRO: Aba 'Lancamentos' não encontrada!");
    return;
  }

  var headerLanc = abaLancamentos.getRange(1, 1, 1, abaLancamentos.getLastColumn()).getValues()[0];
  var idxLanc = Migracao_indexMap_(headerLanc);

  // Verificar se ID_Fornecedor já existe
  if (idxLanc["ID_Fornecedor"] !== undefined) {
    Logger.log("Coluna 'ID_Fornecedor' já existe em Lancamentos.");
    Logger.log("========================================");
    Logger.log("✅ MIGRAÇÃO CONCLUÍDA!");
    return;
  }

  // Encontrar posição do ID_Cliente
  var idxIdCliente = idxLanc["ID_Cliente"];
  if (idxIdCliente === undefined) {
    Logger.log("ERRO: Coluna 'ID_Cliente' não encontrada!");
    return;
  }

  // Inserir coluna após ID_Cliente
  var colInserir = idxIdCliente + 2; // +1 porque índice é 0-based, +1 para inserir DEPOIS
  abaLancamentos.insertColumnAfter(colInserir);

  // Escrever cabeçalho na nova coluna
  abaLancamentos.getRange(1, colInserir + 1).setValue("ID_Fornecedor");
  abaLancamentos.getRange(1, colInserir + 1).setFontWeight("bold");
  abaLancamentos.getRange(1, colInserir + 1).setBackground("#8b5ca5");
  abaLancamentos.getRange(1, colInserir + 1).setFontColor("#ffffff");

  Logger.log("✅ Coluna 'ID_Fornecedor' adicionada em Lancamentos (coluna " + (colInserir + 1) + ").");

  SpreadsheetApp.flush();

  Logger.log("========================================");
  Logger.log("✅ MIGRAÇÃO CONCLUÍDA!");
  Logger.log("");
  Logger.log("PRÓXIMOS PASSOS:");
  Logger.log("1. Execute 'clasp push' para atualizar o código no Apps Script");
  Logger.log("2. Crie uma nova implantação no Apps Script");
  Logger.log("3. Atualize a URL em config.js com a nova implantação");
}

/**
 * Separa a coluna K (Titularidade) que contém dados combinados
 * Ex: "Pessoa Jurídica SumUp" -> Coluna J: "SumUp", Coluna K: "PJ"
 * Ex: "Pessoa Fisica Nubank" -> Coluna J: "Nubank", Coluna K: "PF"
 */
function Migracao_separarTitularidade() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Lancamentos");

  if (!sheet) {
    Logger.log("ERRO: Aba 'Lancamentos' não encontrada!");
    return;
  }

  Logger.log("========== SEPARANDO TITULARIDADE ==========");

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log("Nenhum dado para processar.");
    return;
  }

  var header = data[0];
  var idx = Migracao_indexMap_(header);

  // Encontrar colunas J (Instituicao_Financeira) e K (Titularidade)
  var idxInstituicao = idx["Instituicao_Financeira"];
  var idxTitularidade = idx["Titularidade"];

  if (idxInstituicao === undefined) {
    Logger.log("ERRO: Coluna 'Instituicao_Financeira' não encontrada!");
    Logger.log("Colunas: " + header.join(" | "));
    return;
  }

  if (idxTitularidade === undefined) {
    Logger.log("ERRO: Coluna 'Titularidade' não encontrada!");
    Logger.log("Colunas: " + header.join(" | "));
    return;
  }

  Logger.log("Coluna Instituicao_Financeira: " + (idxInstituicao + 1));
  Logger.log("Coluna Titularidade: " + (idxTitularidade + 1));
  Logger.log("Total de linhas: " + (data.length - 1));

  var atualizados = 0;

  for (var r = 1; r < data.length; r++) {
    var valorTitularidade = String(data[r][idxTitularidade] || "").trim();
    var valorInstituicao = String(data[r][idxInstituicao] || "").trim();

    // Pular se já está no formato correto (PF, PJ ou vazio)
    if (valorTitularidade === "PF" || valorTitularidade === "PJ" || valorTitularidade === "" || valorTitularidade === "Cortesia") {
      continue;
    }

    // Separar o valor combinado
    var resultado = Migracao_parseTitularidadeCombinada_(valorTitularidade);

    if (resultado.titularidade || resultado.instituicao) {
      // Atualizar Instituicao_Financeira (coluna J) se estiver vazia
      if (!valorInstituicao && resultado.instituicao) {
        sheet.getRange(r + 1, idxInstituicao + 1).setValue(resultado.instituicao);
      }

      // Atualizar Titularidade (coluna K)
      sheet.getRange(r + 1, idxTitularidade + 1).setValue(resultado.titularidade);

      atualizados++;

      if (atualizados % 50 === 0) {
        Logger.log("Atualizados: " + atualizados);
        SpreadsheetApp.flush();
      }
    }
  }

  SpreadsheetApp.flush();

  Logger.log("========================================");
  Logger.log("✅ MIGRAÇÃO CONCLUÍDA!");
  Logger.log("Registros atualizados: " + atualizados);
}

/**
 * Gera ID_Fornecedor para todas as linhas com Tipo = "Saida"
 * que ainda não têm ID_Fornecedor preenchido
 */
function Migracao_gerarIDFornecedorParaSaidas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Lancamentos");

  if (!sheet) {
    Logger.log("ERRO: Aba 'Lancamentos' não encontrada!");
    return;
  }

  Logger.log("========== GERANDO ID_FORNECEDOR PARA SAÍDAS ==========");

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log("Nenhum dado para processar.");
    return;
  }

  var header = data[0];
  var idx = Migracao_indexMap_(header);

  // Encontrar colunas
  var idxTipo = idx["Tipo"];
  var idxIdFornecedor = idx["ID_Fornecedor"];

  if (idxTipo === undefined) {
    Logger.log("ERRO: Coluna 'Tipo' não encontrada!");
    return;
  }

  if (idxIdFornecedor === undefined) {
    Logger.log("ERRO: Coluna 'ID_Fornecedor' não encontrada!");
    Logger.log("Colunas: " + header.join(" | "));
    return;
  }

  Logger.log("Coluna Tipo: " + (idxTipo + 1));
  Logger.log("Coluna ID_Fornecedor: " + (idxIdFornecedor + 1));
  Logger.log("Total de linhas: " + (data.length - 1));

  // Obter o último número de sequência
  var props = PropertiesService.getScriptProperties();
  var seq = Number(props.getProperty("FORNECEDORES_LANC_SEQ") || "0");

  var atualizados = 0;

  for (var r = 1; r < data.length; r++) {
    var tipo = String(data[r][idxTipo] || "").trim();
    var idFornecedor = String(data[r][idxIdFornecedor] || "").trim();

    // Só processa se for Saida e não tiver ID_Fornecedor
    if (tipo === "Saida" && !idFornecedor) {
      seq++;
      var novoId = "FN-" + Migracao_getDataFormatada_() + "-" + String(seq).padStart(4, "0");

      sheet.getRange(r + 1, idxIdFornecedor + 1).setValue(novoId);
      atualizados++;

      if (atualizados % 50 === 0) {
        Logger.log("Atualizados: " + atualizados);
        SpreadsheetApp.flush();
      }
    }
  }

  // Salvar o último número de sequência
  props.setProperty("FORNECEDORES_LANC_SEQ", String(seq));

  SpreadsheetApp.flush();

  Logger.log("========================================");
  Logger.log("✅ MIGRAÇÃO CONCLUÍDA!");
  Logger.log("IDs gerados: " + atualizados);
  Logger.log("Último seq: " + seq);
}

/**
 * Popula a aba Fornecedores com os IDs gerados na aba Lancamentos
 * Usa a Categoria ou Descricao como nome do fornecedor
 */
function Migracao_popularFornecedores() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetLanc = ss.getSheetByName("Lancamentos");
  var sheetForn = ss.getSheetByName("Fornecedores");

  if (!sheetLanc) {
    Logger.log("ERRO: Aba 'Lancamentos' não encontrada!");
    return;
  }

  if (!sheetForn) {
    Logger.log("ERRO: Aba 'Fornecedores' não encontrada!");
    return;
  }

  Logger.log("========== POPULANDO ABA FORNECEDORES ==========");

  // Ler dados de Lancamentos
  var dataLanc = sheetLanc.getDataRange().getValues();
  if (dataLanc.length <= 1) {
    Logger.log("Nenhum dado em Lancamentos.");
    return;
  }

  var headerLanc = dataLanc[0];
  var idxLanc = Migracao_indexMap_(headerLanc);

  var idxTipo = idxLanc["Tipo"];
  var idxIdFornecedor = idxLanc["ID_Fornecedor"];
  var idxCategoria = idxLanc["Categoria"];
  var idxDescricao = idxLanc["Descricao"];

  if (idxIdFornecedor === undefined) {
    Logger.log("ERRO: Coluna 'ID_Fornecedor' não encontrada em Lancamentos!");
    return;
  }

  // Ler dados existentes de Fornecedores
  var dataForn = sheetForn.getDataRange().getValues();
  var headerForn = dataForn[0];
  var idxForn = Migracao_indexMap_(headerForn);

  // Criar mapa de IDs já existentes em Fornecedores
  var idsExistentes = {};
  for (var f = 1; f < dataForn.length; f++) {
    var idExistente = String(dataForn[f][idxForn["ID_Fornecedor"]] || "").trim();
    if (idExistente) {
      idsExistentes[idExistente] = true;
    }
  }

  Logger.log("Fornecedores já cadastrados: " + Object.keys(idsExistentes).length);

  // Coletar IDs únicos de Lancamentos (Saida) que não existem em Fornecedores
  var novosForncedores = {};

  for (var r = 1; r < dataLanc.length; r++) {
    var tipo = String(dataLanc[r][idxTipo] || "").trim();
    var idFornecedor = String(dataLanc[r][idxIdFornecedor] || "").trim();

    if (tipo === "Saida" && idFornecedor && !idsExistentes[idFornecedor] && !novosForncedores[idFornecedor]) {
      var categoria = String(dataLanc[r][idxCategoria] || "").trim();
      var descricao = String(dataLanc[r][idxDescricao] || "").trim();

      // Usar Categoria ou Descricao como nome do fornecedor
      var nomeFornecedor = categoria || descricao || "(Sem nome)";

      novosForncedores[idFornecedor] = {
        id: idFornecedor,
        nome: nomeFornecedor,
        categoria: categoria
      };
    }
  }

  var idsNovos = Object.keys(novosForncedores);
  Logger.log("Novos fornecedores a cadastrar: " + idsNovos.length);

  if (idsNovos.length === 0) {
    Logger.log("Nenhum novo fornecedor para cadastrar.");
    return;
  }

  // Inserir novos fornecedores
  var dataHoje = Migracao_getDataFormatadaISO_();
  var inseridos = 0;

  for (var i = 0; i < idsNovos.length; i++) {
    var forn = novosForncedores[idsNovos[i]];

    // Formato: ID_Fornecedor, NomeFornecedor, Telefone, E-mail, CNPJ_CPF, Categoria, Endereco, DataCadastro, Observacao
    var novaLinha = [
      forn.id,           // ID_Fornecedor
      forn.nome,         // NomeFornecedor
      "",                // Telefone
      "",                // E-mail
      "",                // CNPJ_CPF
      forn.categoria,    // Categoria
      "",                // Endereco
      dataHoje,          // DataCadastro
      ""                 // Observacao
    ];

    sheetForn.appendRow(novaLinha);
    inseridos++;

    if (inseridos % 50 === 0) {
      Logger.log("Inseridos: " + inseridos);
      SpreadsheetApp.flush();
    }
  }

  SpreadsheetApp.flush();

  Logger.log("========================================");
  Logger.log("✅ MIGRAÇÃO CONCLUÍDA!");
  Logger.log("Fornecedores inseridos: " + inseridos);
}

/**
 * Remove fornecedores duplicados da aba Fornecedores
 * Mantém apenas o primeiro registro de cada Categoria (não altera IDs)
 */
function Migracao_removerFornecedoresDuplicados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Fornecedores");

  if (!sheet) {
    Logger.log("ERRO: Aba 'Fornecedores' não encontrada!");
    return;
  }

  Logger.log("========== REMOVENDO FORNECEDORES DUPLICADOS (POR CATEGORIA) ==========");

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log("Nenhum dado para processar.");
    return;
  }

  var header = data[0];
  var idx = Migracao_indexMap_(header);
  var idxCategoria = idx["Categoria"];

  if (idxCategoria === undefined) {
    Logger.log("ERRO: Coluna 'Categoria' não encontrada!");
    return;
  }

  // Identificar linhas únicas e duplicadas por Categoria
  var categoriasVistas = {};
  var linhasParaManter = [header]; // Manter cabeçalho
  var duplicados = 0;

  for (var r = 1; r < data.length; r++) {
    var categoria = String(data[r][idxCategoria] || "").trim().toLowerCase();

    if (!categoria) {
      // Linha sem categoria, manter
      linhasParaManter.push(data[r]);
      continue;
    }

    if (categoriasVistas[categoria]) {
      // Duplicado, não manter
      duplicados++;
    } else {
      // Primeira com esta categoria, manter
      categoriasVistas[categoria] = true;
      linhasParaManter.push(data[r]);
    }
  }

  Logger.log("Total de linhas originais: " + (data.length - 1));
  Logger.log("Duplicados encontrados: " + duplicados);
  Logger.log("Linhas a manter: " + (linhasParaManter.length - 1));

  if (duplicados === 0) {
    Logger.log("Nenhum duplicado encontrado.");
    return;
  }

  // Limpar aba e reescrever dados únicos
  sheet.clearContents();

  if (linhasParaManter.length > 0) {
    sheet.getRange(1, 1, linhasParaManter.length, linhasParaManter[0].length)
         .setValues(linhasParaManter);
  }

  // Formatar cabeçalho
  var headerRange = sheet.getRange(1, 1, 1, header.length);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#8b5ca5");
  headerRange.setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  SpreadsheetApp.flush();

  Logger.log("========================================");
  Logger.log("✅ DUPLICADOS REMOVIDOS!");
  Logger.log("Registros únicos mantidos: " + (linhasParaManter.length - 1));
}

/**
 * Corrige os ID_Fornecedor na aba Lancamentos
 * Usa a Categoria para buscar o ID correto na aba Fornecedores
 */
function Migracao_corrigirIDFornecedorEmLancamentos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetLanc = ss.getSheetByName("Lancamentos");
  var sheetForn = ss.getSheetByName("Fornecedores");

  if (!sheetLanc) {
    Logger.log("ERRO: Aba 'Lancamentos' não encontrada!");
    return;
  }

  if (!sheetForn) {
    Logger.log("ERRO: Aba 'Fornecedores' não encontrada!");
    return;
  }

  Logger.log("========== CORRIGINDO ID_FORNECEDOR EM LANCAMENTOS ==========");

  // Ler Fornecedores e criar mapa: Categoria -> ID_Fornecedor
  var dataForn = sheetForn.getDataRange().getValues();
  var headerForn = dataForn[0];
  var idxForn = Migracao_indexMap_(headerForn);

  var idxFornId = idxForn["ID_Fornecedor"];
  var idxFornCategoria = idxForn["Categoria"];

  if (idxFornId === undefined || idxFornCategoria === undefined) {
    Logger.log("ERRO: Colunas não encontradas em Fornecedores!");
    return;
  }

  var mapaCategoria = {};
  for (var f = 1; f < dataForn.length; f++) {
    var id = String(dataForn[f][idxFornId] || "").trim();
    var categoria = String(dataForn[f][idxFornCategoria] || "").trim().toLowerCase();

    if (id && categoria) {
      mapaCategoria[categoria] = id;
    }
  }

  Logger.log("Mapa Categoria->ID criado: " + Object.keys(mapaCategoria).length + " categorias");

  // Ler Lancamentos
  var dataLanc = sheetLanc.getDataRange().getValues();
  var headerLanc = dataLanc[0];
  var idxLanc = Migracao_indexMap_(headerLanc);

  var idxTipo = idxLanc["Tipo"];
  var idxCategoria = idxLanc["Categoria"];
  var idxIdFornecedor = idxLanc["ID_Fornecedor"];

  if (idxTipo === undefined || idxCategoria === undefined || idxIdFornecedor === undefined) {
    Logger.log("ERRO: Colunas não encontradas em Lancamentos!");
    return;
  }

  var atualizados = 0;

  for (var r = 1; r < dataLanc.length; r++) {
    var tipo = String(dataLanc[r][idxTipo] || "").trim();

    if (tipo !== "Saida") continue;

    var categoria = String(dataLanc[r][idxCategoria] || "").trim().toLowerCase();
    var idAtual = String(dataLanc[r][idxIdFornecedor] || "").trim();

    // Buscar ID correto no mapa
    var idCorreto = mapaCategoria[categoria];

    if (idCorreto && idCorreto !== idAtual) {
      sheetLanc.getRange(r + 1, idxIdFornecedor + 1).setValue(idCorreto);
      atualizados++;

      if (atualizados % 50 === 0) {
        Logger.log("Atualizados: " + atualizados);
        SpreadsheetApp.flush();
      }
    }
  }

  SpreadsheetApp.flush();

  Logger.log("========================================");
  Logger.log("✅ CORREÇÃO CONCLUÍDA!");
  Logger.log("Lançamentos atualizados: " + atualizados);
}

/**
 * Retorna data formatada YYYY-MM-DD
 */
function Migracao_getDataFormatadaISO_() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

/**
 * Retorna data formatada YYYYMMDD
 */
function Migracao_getDataFormatada_() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return y + m + day;
}

/**
 * Parse valor combinado de Titularidade
 * Ex: "Pessoa Jurídica SumUp" -> { titularidade: "PJ", instituicao: "SumUp" }
 * Ex: "Pessoa Fisica Nubank PF" -> { titularidade: "PF", instituicao: "Nubank" }
 * Ex: "PJ Nubank" -> { titularidade: "PJ", instituicao: "Nubank" }
 */
function Migracao_parseTitularidadeCombinada_(valor) {
  valor = String(valor || "").trim();

  if (!valor) {
    return { titularidade: "", instituicao: "" };
  }

  var titularidade = "";
  var instituicao = "";

  // Normalizar variações
  var valorLower = valor.toLowerCase();

  // Detectar Pessoa Física / PF
  if (valorLower.indexOf("pessoa f") !== -1 || valorLower.indexOf("pessoa f") !== -1) {
    titularidade = "PF";
    // Remover "Pessoa Física" ou variações
    valor = valor.replace(/pessoa\s*f[ií]sica/gi, "").trim();
  }
  // Detectar Pessoa Jurídica / PJ
  else if (valorLower.indexOf("pessoa j") !== -1) {
    titularidade = "PJ";
    // Remover "Pessoa Jurídica" ou variações
    valor = valor.replace(/pessoa\s*jur[ií]dica/gi, "").trim();
  }
  // Detectar PF ou PJ no início ou fim
  else if (/\bPF\b/i.test(valor)) {
    titularidade = "PF";
    valor = valor.replace(/\bPF\b/gi, "").trim();
  }
  else if (/\bPJ\b/i.test(valor)) {
    titularidade = "PJ";
    valor = valor.replace(/\bPJ\b/gi, "").trim();
  }

  // O que sobrou é a instituição
  instituicao = valor.trim();

  // Normalizar instituições conhecidas
  var instLower = instituicao.toLowerCase();
  if (instLower === "nubank" || instLower.indexOf("nubank") !== -1) instituicao = "Nubank";
  else if (instLower === "picpay" || instLower.indexOf("picpay") !== -1) instituicao = "PicPay";
  else if (instLower === "sumup" || instLower.indexOf("sumup") !== -1) instituicao = "SumUp";
  else if (instLower === "dinheiro") instituicao = "Dinheiro";
  else if (instLower === "terceiro") instituicao = "Terceiro";
  else if (instLower === "cortesia") instituicao = "Cortesia";

  return { titularidade: titularidade, instituicao: instituicao };
}

/**
 * CORREÇÃO v2: Reorganiza as colunas baseado na estrutura correta
 *
 * Problema atual: A planilha tem 18 colunas, dados desalinhados,
 * e "Mes_a_receber" duplicado 3 vezes.
 *
 * Esta função:
 * 1. Limpa colunas extras (mantém apenas 16)
 * 2. Move dados para posições corretas baseado no conteúdo
 */
function Migracao_reorganizarColunas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Lancamentos");

  if (!sheet) {
    Logger.log("ERRO: Aba 'Lancamentos' não encontrada!");
    return;
  }

  Logger.log("========== REORGANIZANDO COLUNAS ==========");

  // Cabeçalho correto (16 colunas)
  var headerCorreto = [
    "Data_Competencia",
    "Data_Caixa",
    "Tipo",
    "Origem",
    "Categoria",
    "Descricao",
    "ID_Cliente",
    "ID_Fornecedor",
    "Forma_Pagamento",
    "Instituicao_Financeira",
    "Titularidade",
    "Parcelamento",
    "Valor",
    "Status",
    "Observacoes",
    "Mes_a_receber"
  ];

  var allData = sheet.getDataRange().getValues();
  Logger.log("Linhas: " + allData.length);
  Logger.log("Colunas atuais: " + allData[0].length);

  // Mostrar amostra antes
  Logger.log("");
  Logger.log("ANTES - Linha 2:");
  for (var i = 0; i < Math.min(allData[0].length, 18); i++) {
    Logger.log("  Col " + i + ": [" + allData[1][i] + "]");
  }

  // Processar cada linha (exceto cabeçalho)
  var novosDados = [headerCorreto];

  for (var r = 1; r < allData.length; r++) {
    var row = allData[r];
    var novaLinha = [];

    // Colunas 0-6: Data_Competencia até ID_Cliente (parecem estar corretas)
    for (var c = 0; c <= 6; c++) {
      novaLinha.push(row[c] !== undefined ? row[c] : "");
    }

    // Coluna 7: ID_Fornecedor
    // Se a coluna 7 atual parece um ID de fornecedor (começa com FN-) ou está vazia, use
    // Caso contrário, deixe vazio
    var col7 = String(row[7] || "").trim();
    if (col7.indexOf("FN-") === 0 || col7 === "") {
      novaLinha.push(col7);
    } else {
      novaLinha.push("");
    }

    // Colunas 8-11: Forma_Pagamento, Instituicao, Titularidade, Parcelamento
    // Verificar onde estão esses dados
    // Atualmente: col 8 = Forma_Pagamento parece correto
    var formasPagamento = ["Pix", "Dinheiro", "Cartao_Credito", "Cartao_Debito", "Boleto", "Transferencia", "Confianca", "Cortesia", "cartão de crédito", "cartão de débito"];
    var instituicoes = ["Nubank", "PicPay", "SumUp", "Terceiro", "Dinheiro", "Cortesia"];
    var titularidades = ["PF", "PJ"];

    // Procurar Forma_Pagamento (pode estar em col 7 ou 8)
    var formaPag = "";
    var instituicao = "";
    var titularidade = "";
    var parcelamento = "";

    for (var busca = 7; busca <= 11; busca++) {
      var val = String(row[busca] || "").trim();

      if (!formaPag && formasPagamento.some(function(fp) { return val.toLowerCase().indexOf(fp.toLowerCase()) !== -1; })) {
        formaPag = val;
      } else if (!instituicao && instituicoes.some(function(inst) { return val === inst; })) {
        instituicao = val;
      } else if (!titularidade && titularidades.indexOf(val) !== -1) {
        titularidade = val;
      } else if (!parcelamento && /^\d+\/\d+$/.test(val)) {
        parcelamento = val;
      }
    }

    // Se não encontrou, usar posições padrão
    if (!formaPag) formaPag = String(row[8] || "").trim();
    if (!instituicao) instituicao = String(row[9] || "").trim();
    if (!titularidade) titularidade = String(row[10] || "").trim();
    if (!parcelamento) parcelamento = String(row[11] || "").trim();

    novaLinha.push(formaPag);       // 8
    novaLinha.push(instituicao);    // 9
    novaLinha.push(titularidade);   // 10
    novaLinha.push(parcelamento);   // 11

    // Coluna 12: Valor - procurar número que parece valor monetário
    var valor = "";
    for (var buscaValor = 12; buscaValor <= 15; buscaValor++) {
      var v = row[buscaValor];
      if (typeof v === "number" && v > 0) {
        valor = v;
        break;
      }
      var vStr = String(v || "").trim();
      if (vStr && /^[\d.,]+$/.test(vStr.replace("R$", "").trim())) {
        valor = vStr;
        break;
      }
    }
    novaLinha.push(valor);  // 12

    // Coluna 13: Status - procurar "Pago" ou "Pendente"
    var status = "";
    for (var buscaStatus = 12; buscaStatus <= 16; buscaStatus++) {
      var s = String(row[buscaStatus] || "").trim();
      if (s === "Pago" || s === "Pendente") {
        status = s;
        break;
      }
    }
    novaLinha.push(status);  // 13

    // Coluna 14: Observacoes (geralmente vazio ou texto livre)
    var obs = "";
    // Pegar o que não foi identificado como status ou valor
    for (var buscaObs = 14; buscaObs <= 16; buscaObs++) {
      var o = String(row[buscaObs] || "").trim();
      if (o && o !== "Pago" && o !== "Pendente" && !/^\d+$/.test(o)) {
        obs = o;
        break;
      }
    }
    novaLinha.push(obs);  // 14

    // Coluna 15: Mes_a_receber - procurar formato YYYY-MM ou data
    var mesReceber = "";
    for (var buscaMes = 15; buscaMes < row.length; buscaMes++) {
      var m = row[buscaMes];
      if (m instanceof Date && !isNaN(m.getTime())) {
        mesReceber = Utilities.formatDate(m, Session.getScriptTimeZone(), "yyyy-MM");
        break;
      }
      var mStr = String(m || "").trim();
      if (/^\d{4}-\d{2}/.test(mStr)) {
        mesReceber = mStr.substring(0, 7);
        break;
      }
    }
    novaLinha.push(mesReceber);  // 15

    novosDados.push(novaLinha);
  }

  Logger.log("");
  Logger.log("DEPOIS - Linha 2:");
  for (var j = 0; j < novosDados[1].length; j++) {
    Logger.log("  " + headerCorreto[j] + ": [" + novosDados[1][j] + "]");
  }

  // Limpar planilha
  sheet.clearContents();

  // Escrever dados corrigidos
  sheet.getRange(1, 1, novosDados.length, 16).setValues(novosDados);

  // Formatar cabeçalho
  var headerRange = sheet.getRange(1, 1, 1, 16);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#8b5ca5");
  headerRange.setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  // Deletar colunas extras (17, 18, etc.)
  var lastCol = sheet.getLastColumn();
  if (lastCol > 16) {
    sheet.deleteColumns(17, lastCol - 16);
    Logger.log("Colunas extras deletadas: " + (lastCol - 16));
  }

  SpreadsheetApp.flush();

  Logger.log("");
  Logger.log("========================================");
  Logger.log("✅ REORGANIZAÇÃO CONCLUÍDA!");
  Logger.log("Linhas processadas: " + (novosDados.length - 1));
  Logger.log("Colunas: 16");
}

/**
 * CORREÇÃO URGENTE: Deslocar colunas de dados para alinhar com novo cabeçalho
 *
 * O problema: Quando ID_Fornecedor foi adicionado ao cabeçalho (posição 8),
 * os dados existentes não foram deslocados. Resultado:
 * - Forma_Pagamento está sendo lido como ID_Fornecedor
 * - Valor está sendo lido como Status
 * - etc.
 *
 * Esta função insere uma coluna vazia na posição 8 (após ID_Cliente)
 * para alinhar os dados com o novo cabeçalho.
 */
function Migracao_corrigirColunasDeslocadas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Lancamentos");

  if (!sheet) {
    Logger.log("ERRO: Aba 'Lancamentos' não encontrada!");
    return;
  }

  Logger.log("========== CORRIGINDO COLUNAS DESLOCADAS ==========");

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  Logger.log("Linhas: " + lastRow);
  Logger.log("Colunas: " + lastCol);

  // Verificar cabeçalho atual
  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  Logger.log("Cabeçalho atual: " + header.join(" | "));

  // Verificar se ID_Fornecedor já está no cabeçalho
  var idxIdFornecedor = -1;
  for (var i = 0; i < header.length; i++) {
    if (String(header[i]).trim() === "ID_Fornecedor") {
      idxIdFornecedor = i;
      break;
    }
  }

  if (idxIdFornecedor === -1) {
    Logger.log("ERRO: Coluna 'ID_Fornecedor' não encontrada no cabeçalho!");
    Logger.log("Execute primeiro: Migracao_adicionarFornecedores()");
    return;
  }

  Logger.log("ID_Fornecedor está na coluna: " + (idxIdFornecedor + 1));

  // Verificar uma linha de dados para confirmar o problema
  if (lastRow > 1) {
    var amostra = sheet.getRange(2, 1, 1, lastCol).getValues()[0];
    Logger.log("Amostra linha 2:");
    for (var j = 0; j < Math.min(header.length, amostra.length); j++) {
      Logger.log("  " + header[j] + ": [" + amostra[j] + "]");
    }
  }

  // A coluna ID_Fornecedor deve estar na posição 8 (índice 7)
  // Inserir coluna na posição 8 para deslocar os dados
  var colunaInserir = idxIdFornecedor + 1; // 1-based

  Logger.log("Inserindo coluna vazia na posição " + colunaInserir + " para deslocar dados...");

  // IMPORTANTE: Inserir coluna ANTES de ID_Fornecedor empurra os dados para a direita
  // Mas precisamos que o cabeçalho fique no lugar certo
  // Então vamos fazer diferente: mover os dados da coluna 8 em diante uma posição para a direita

  // Primeiro, vamos ler todos os dados
  var allData = sheet.getDataRange().getValues();

  // Cabeçalho já está correto, só precisamos ajustar as linhas de dados (linha 2 em diante)
  // Para cada linha de dados, inserir "" na posição idxIdFornecedor

  for (var r = 1; r < allData.length; r++) {
    var row = allData[r];
    // Inserir valor vazio na posição do ID_Fornecedor
    row.splice(idxIdFornecedor, 0, "");
    allData[r] = row;
  }

  // Limpar a aba e reescrever
  sheet.clearContents();

  // O número de colunas agora é header.length (já correto) para linha 1
  // e header.length + 1 para as demais (porque adicionamos uma coluna)
  // Mas queremos que todas tenham o mesmo tamanho

  // Ajustar: o cabeçalho já tem ID_Fornecedor, então ele tem N colunas
  // Os dados agora também têm N colunas (após o splice)
  // Precisamos garantir que todos tenham o mesmo tamanho

  var numCols = allData[0].length;
  for (var r2 = 1; r2 < allData.length; r2++) {
    // Cortar se tiver mais colunas que o cabeçalho
    if (allData[r2].length > numCols) {
      allData[r2] = allData[r2].slice(0, numCols);
    }
    // Preencher se tiver menos
    while (allData[r2].length < numCols) {
      allData[r2].push("");
    }
  }

  // Escrever todos os dados de volta
  sheet.getRange(1, 1, allData.length, numCols).setValues(allData);

  // Formatar cabeçalho
  var headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#8b5ca5");
  headerRange.setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  SpreadsheetApp.flush();

  // Verificar resultado
  Logger.log("");
  Logger.log("Verificando resultado...");
  var novaAmostra = sheet.getRange(2, 1, 1, numCols).getValues()[0];
  var novoHeader = sheet.getRange(1, 1, 1, numCols).getValues()[0];
  Logger.log("Nova amostra linha 2:");
  for (var k = 0; k < novoHeader.length; k++) {
    Logger.log("  " + novoHeader[k] + ": [" + novaAmostra[k] + "]");
  }

  Logger.log("");
  Logger.log("========================================");
  Logger.log("✅ CORREÇÃO CONCLUÍDA!");
  Logger.log("Linhas processadas: " + (allData.length - 1));
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
