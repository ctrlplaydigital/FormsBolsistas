// ===== CÓDIGO PRINCIPAL - Code.gs =====

// ===== LIMITE DE E-MAILS (altere apenas aqui) =====
const LIMITE_EMAILS_DIARIO = 100;      // 100 = conta Google comum | ~1500 = Google Workspace
const MARGEM_SEGURANCA_EMAILS = 5;     // o sistema para de enviar quando faltam só estes e-mails

/**
 * Função principal que cria o menu customizado na planilha
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sistema de Inscrições')
    .addItem('Configurar Triggers', 'configurarTriggers')
    .addItem('Configurar cabeçalho da aba Inscritos', 'configurarCabecalhoInscritos')
    .addItem('Migrar Inscritos para o novo layout', 'migrarInscritosParaNovoLayout')
    .addSeparator()
    .addItem('Verificar Limite de Emails', 'verificarLimiteEmails')
    .addSeparator()
    .addItem('Instruções', 'mostrarInstrucoes')
    .addToUi();
}

/**
 * Função de teste para verificar email
 */
function testarEnvioEmail() {
  console.log('=== TESTE DE ENVIO DE E-MAIL ===');
  const scriptProperties = PropertiesService.getScriptProperties();
  const destino = (scriptProperties.getProperty('email-bkp') || '').trim() || Session.getEffectiveUser().getEmail();
  console.log('📧 Os e-mails de teste serão enviados para: ' + destino);

  // Confere a cota antes (cada teste envia 2 e-mails)
  const antes = verificarLimiteEmailsLog();
  if (!podeEnviarEmails() || antes.restantes < 8) {
    console.error('❌ Cota diária de e-mails quase no fim. Teste cancelado.');
    return;
  }

  // Dados fictícios (mesmos campos do formulário)
  const dados = {
    nomeBolsista: 'Maria Souza (TESTE)', cpf: '529.982.247-25', emailBolsista: destino, celularBolsista: '(11) 98765-4321',
    nomeResponsavel: 'Carlos Lima (TESTE)', celularResponsavel: '(11) 3333-4444', localTrabalho: 'Departamento de TI',
    parentesco: 'Pai', emailPedagogico: destino
  };
  const infoTurma = { nivel: 'A1', codigo: 'A1-1-0100', horario: 'Seg e Qua, 19h às 20h', dataInicio: '03/02/2027', dataTermino: '30/06/2027' };
  const dataHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy 'às' HH:mm");

  // Envia as duas versões do e-mail real: para o bolsista e para o responsável
  ['Bolsista', 'Responsável'].forEach(function (tipo) {
    try {
      const html = montarEmailHtml_(Object.assign({}, dados, { destinoComunicacao: tipo }), 'INS-TESTE-0000', infoTurma, dataHora);
      MailApp.sendEmail({
        to: destino,
        subject: '🧪 TESTE (e-mail para o ' + tipo.toLowerCase() + ') - Confirmação de Inscrição',
        body: 'Este é um teste do e-mail de confirmação. Abra em um visualizador que suporte HTML.',
        htmlBody: html
      });
      incrementarContadorEmails(1);
      console.log('✅ Enviado: versão "' + tipo + '"');
    } catch (erro) {
      console.error('❌ Erro ao enviar a versão "' + tipo + '":', erro);
    }
  });
  verificarLimiteEmailsLog();
  console.log('⏱️ Confira a caixa de entrada (e o spam) de ' + destino);
}

/**
 * Verifica o limite de emails restantes hoje
 */
function verificarLimiteEmails() {
  const hoje = new Date().toDateString();
  const scriptProperties = PropertiesService.getScriptProperties();
  
  // Busca contador do dia
  let emailsEnviadosHoje = parseInt(scriptProperties.getProperty('emails_enviados_' + hoje) || '0');
  const limite = LIMITE_EMAILS_DIARIO;
  const restantes = limite - emailsEnviadosHoje;
  
  let mensagem = `📊 LIMITE DE EMAILS - ${hoje}\n\n`;
  mensagem += `✅ Emails enviados hoje: ${emailsEnviadosHoje}\n`;
  mensagem += `📧 Limite diário: ${limite}\n`;
  mensagem += `📉 Restantes: ${restantes}\n\n`;
  
  if (restantes <= 10) {
    mensagem += `⚠️ ALERTA: Você está próximo do limite!\n`;
    mensagem += `Considere alternativas:\n`;
    mensagem += `• Usar conta Google Workspace (limite: 1.500/dia)\n`;
    mensagem += `• Configurar serviço de email externo\n`;
    mensagem += `• Avisar administradores`;
  } else if (restantes <= 20) {
    mensagem += `⚠️ AVISO: Menos de 20 emails restantes hoje`;
  } else {
    mensagem += `✅ Limite está ok para hoje`;
  }
  
  SpreadsheetApp.getUi().alert('Limite de Emails', mensagem, SpreadsheetApp.getUi().ButtonSet.OK);
  
  return { enviados: emailsEnviadosHoje, restantes: restantes, limite: limite };
}

/**
 * Incrementa o contador de emails enviados hoje
 */
function incrementarContadorEmails(quantidade = 1) {
  const hoje = new Date().toDateString();
  const scriptProperties = PropertiesService.getScriptProperties();
  
  let emailsEnviadosHoje = parseInt(scriptProperties.getProperty('emails_enviados_' + hoje) || '0');
  emailsEnviadosHoje += quantidade;
  
  scriptProperties.setProperty('emails_enviados_' + hoje, emailsEnviadosHoje.toString());
  
  return emailsEnviadosHoje;
}

/**
 * Verifica se pode enviar emails (com margem de segurança)
 */
function podeEnviarEmails() {
  const hoje = new Date().toDateString();
  const scriptProperties = PropertiesService.getScriptProperties();
  
  let emailsEnviadosHoje = parseInt(scriptProperties.getProperty('emails_enviados_' + hoje) || '0');
  const limite = LIMITE_EMAILS_DIARIO;
  
  // Deixa margem de segurança de 5 emails
  return emailsEnviadosHoje < (limite - MARGEM_SEGURANCA_EMAILS);
}

/**
 * Função para executar no editor do Apps Script (mostra no log)
 */
function verificarLimiteEmailsLog() {
  const hoje = new Date().toDateString();
  const scriptProperties = PropertiesService.getScriptProperties();
  
  let emailsEnviadosHoje = parseInt(scriptProperties.getProperty('emails_enviados_' + hoje) || '0');
  const limite = LIMITE_EMAILS_DIARIO;
  const restantes = limite - emailsEnviadosHoje;
  
  console.log('========================================');
  console.log('📊 LIMITE DE EMAILS - ' + hoje);
  console.log('========================================');
  console.log('✅ Emails enviados hoje: ' + emailsEnviadosHoje);
  console.log('📧 Limite diário: ' + limite);
  console.log('📉 Restantes: ' + restantes);
  console.log('========================================');
  
  if (restantes <= 10) {
    console.log('⚠️ ALERTA: Você está próximo do limite!');
  } else if (restantes <= 20) {
    console.log('⚠️ AVISO: Menos de 20 emails restantes hoje');
  } else {
    console.log('✅ Limite está ok para hoje');
  }
  
  return { enviados: emailsEnviadosHoje, restantes: restantes, limite: limite };
}

/**
 * Função de teste que simula uma inscrição completa
 * Usa dados fictícios para testar todo o fluxo
 */
function testarInscricaoCompleta(limpar) {
  limpar = limpar !== false;   // padrão: ao final, apaga a inscrição de teste e devolve a vaga
  console.log('=== TESTE DE INSCRIÇÃO COMPLETA ===');
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1) Usa automaticamente a primeira turma que ainda tem vaga
  const turma = ss.getSheetByName('Turmas').getDataRange().getValues().slice(1)
    .find(function (t) { return t[1] && Number(t[6] || 0) < Number(t[5] || 0); });
  if (!turma) { console.error('❌ Nenhuma turma com vaga na aba Turmas.'); return; }
  const codigoTurma = turma[1];

  // 2) Os e-mails de teste vão para você (ou para o email-bkp)
  const emailTeste = (PropertiesService.getScriptProperties().getProperty('email-bkp') || '').trim() || Session.getEffectiveUser().getEmail();
  const end = { Logradouro: 'Rua Teste', Numero: '123', Complemento: 'Apto 4', Bairro: 'Bairro Teste', Cidade: 'São Paulo', Uf: 'SP', Cep: '01001-000' };
  const textoEnd = 'Rua Teste, 123, Apto 4, Bairro Teste, São Paulo - SP, CEP 01001-000';

  // 3) Todos os campos que o formulário envia
  const dadosTeste = {
    dataAdmissao: '2024-01-15', nomeResponsavel: 'Responsável Teste Silva', generoResponsavel: 'Feminino',
    estadoCivilResponsavel: 'Casado(a)', cpfResponsavel: '529.982.247-25', dataNascimentoResponsavel: '1985-03-15',
    celularResponsavel: '(11) 3333-4444', emailPedagogico: emailTeste, localTrabalho: 'Departamento de TI', parentesco: 'Mãe',
    respLogradouro: end.Logradouro, respNumero: end.Numero, respComplemento: end.Complemento, respBairro: end.Bairro,
    respCidade: end.Cidade, respUf: end.Uf, respCep: end.Cep, enderecoResponsavel: textoEnd,
    nomeBolsista: 'Bolsista Teste da Silva', genero: 'Feminino', estadoCivil: 'Solteiro(a)', cpf: '529.982.247-25',
    dataNascimento: '2010-05-20',
    bolLogradouro: end.Logradouro, bolNumero: end.Numero, bolComplemento: end.Complemento, bolBairro: end.Bairro,
    bolCidade: end.Cidade, bolUf: end.Uf, bolCep: end.Cep, endereco: textoEnd,
    celularBolsista: '(11) 98765-4321', emailBolsista: emailTeste, necessidadeEspecial: 'Teste',
    destinoComunicacao: 'Bolsista', nivel: turma[0], turma: codigoTurma
  };
  console.log('📝 Turma usada: ' + codigoTurma + ' | e-mails para: ' + emailTeste);

  try {
    const resultado = processarInscricao(dadosTeste);
    if (!resultado.sucesso) { console.error('❌ Falhou: ' + resultado.mensagem); return resultado; }
    console.log('✅ Inscrição gravada. Protocolo: ' + resultado.protocolo);

    // 4) Confere se TODAS as colunas da aba Inscritos foram preenchidas
    const dados = ss.getSheetByName('Inscritos').getDataRange().getValues();
    const iProt = COLUNAS_INSCRITOS_.findIndex(function (col) { return col[0] === 'Protocolo'; });
    const linha = dados.find(function (l) { return l[iProt] === resultado.protocolo; });
    const opcionais = ['Bolsista - Complemento', 'Responsável - Complemento', 'Necessidade Educacional Específica'];
    const vazias = COLUNAS_INSCRITOS_.filter(function (col, i) {
      return !linha || ((linha[i] === '' || linha[i] == null) && opcionais.indexOf(col[0]) === -1);
    }).map(function (col) { return col[0]; });
    console.log(vazias.length
      ? '⚠️ Colunas SEM valor: ' + vazias.join(' | ')
      : '✅ Todas as ' + COLUNAS_INSCRITOS_.length + ' colunas foram preenchidas.');

    // 5) Desfaz o teste
    if (limpar) {
      limparInscricaoTeste_(resultado.protocolo, codigoTurma);
      console.log('🧹 Inscrição de teste apagada e vaga devolvida.');
    } else {
      console.log('ℹ️ A inscrição de teste foi mantida (protocolo ' + resultado.protocolo + '). Apague a linha e corrija o Total Inscritos da turma ' + codigoTurma + '.');
    }
    return resultado;
  } catch (erro) {
    console.error('❌ ERRO NA INSCRIÇÃO:', erro);
  }
}

/** Apaga a linha de teste (achada pelo protocolo) e devolve a vaga da turma */
function limparInscricaoTeste_(protocolo, codigoTurma) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Inscritos');
    const iProt = COLUNAS_INSCRITOS_.findIndex(function (col) { return col[0] === 'Protocolo'; });
    const dados = sheet.getDataRange().getValues();
    for (let i = dados.length - 1; i >= 1; i--) {
      if (dados[i][iProt] === protocolo) { sheet.deleteRow(i + 1); break; }
    }
    const turmas = ss.getSheetByName('Turmas');
    const t = turmas.getDataRange().getValues();
    for (let k = 1; k < t.length; k++) {
      if (t[k][1] === codigoTurma) { turmas.getRange(k + 1, 7).setValue(Math.max(0, Number(t[k][6]) - 1)); break; }
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Sincroniza o contador com as inscrições reais da planilha
 * Conta quantas inscrições "SIM" existem hoje e atualiza o contador
 */
function sincronizarContadorEmails() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetInscritos = ss.getSheetByName('Inscritos');
  
  if (!sheetInscritos) {
    console.error('❌ Planilha "Inscritos" não encontrada!');
    return;
  }
  
  // Obtém todos os dados da planilha
  const dados = sheetInscritos.getDataRange().getValues();
  
  // Encontra as colunas
  let colunaData = -1;
  let colunaEmailEnviado = -1;
  
  // Assume que a linha 1 é o cabeçalho
  const cabecalho = dados[0];
  for (let i = 0; i < cabecalho.length; i++) {
    if (cabecalho[i].toString().toLowerCase().includes('data') && cabecalho[i].toString().toLowerCase().includes('identificação')) {
      colunaData = i;
    }
    if (cabecalho[i].toString().toLowerCase().includes('email enviado')) {
      colunaEmailEnviado = i;
    }
  }
  
  if (colunaData === -1 || colunaEmailEnviado === -1) {
    console.error('❌ Colunas não encontradas! Verifique os cabeçalhos da planilha.');
    return;
  }
  
  console.log('📊 Coluna Data: ' + colunaData + ' (Coluna ' + (colunaData + 1) + ')');
  console.log('📧 Coluna Email Enviado: ' + colunaEmailEnviado + ' (Coluna ' + (colunaEmailEnviado + 1) + ')');
  
  // Data de hoje no formato brasileiro
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();
  const dataHojeBR = dia + '/' + mes + '/' + ano;
  
  console.log('📅 Data de hoje (BR): ' + dataHojeBR);
  
  // Conta inscrições de hoje com email enviado = SIM
  let contador = 0;
  for (let i = 1; i < dados.length; i++) {
    const brutoData = dados[i][colunaData];
    // O Sheets pode converter o texto em data: formata de volta para dd/MM/aaaa antes de comparar
    const dataInscricao = brutoData instanceof Date
      ? Utilities.formatDate(brutoData, Session.getScriptTimeZone(), 'dd/MM/yyyy')
      : String(brutoData);
    const emailEnviado = String(dados[i][colunaEmailEnviado] || '');
    
    // Verifica se a data contém a data de hoje e se email foi enviado
    if (dataInscricao.includes(dataHojeBR) && emailEnviado.toUpperCase() === 'SIM') {
      contador++;
    }
  }
  
  console.log('✅ Inscrições encontradas hoje com email enviado: ' + contador);
  
  // Atualiza a propriedade
  const scriptProperties = PropertiesService.getScriptProperties();
  const chaveData = new Date().toDateString();
  scriptProperties.setProperty('emails_enviados_' + chaveData, contador.toString());
  
  console.log('💾 Contador sincronizado! Novo valor: ' + contador);
  console.log('📉 Restantes: ' + (LIMITE_EMAILS_DIARIO - contador));
  
  return contador;
}

/**
 * Retorna os níveis únicos disponíveis
 */
function obterNiveis() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Turmas');
  const dados = sheet.getDataRange().getValues();
  
  // Pular o cabeçalho e filtrar níveis únicos
  const niveis = [];
  const niveisUnicos = new Set();
  
  for (let i = 1; i < dados.length; i++) {
    const nivel = dados[i][0]; // Coluna A - Nível
    const totalVagas = dados[i][5]; // Coluna F - Total Vagas
    const totalInscritos = dados[i][6]; // Coluna G - Total Inscritos
    
    // Mostra nível se ainda há vagas disponíveis (inscritos < vagas)
    if (nivel && totalInscritos < totalVagas && !niveisUnicos.has(nivel)) {
      niveisUnicos.add(nivel);
      niveis.push(nivel);
    }
  }
  
  return niveis.sort();
}

/**
 * Retorna as turmas disponíveis para um nível específico
 */
function obterTurmasPorNivel(nivel) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Turmas');
  const dados = sheet.getDataRange().getValues();
  const turmas = [];
  
  for (let i = 1; i < dados.length; i++) {
    const totalVagas = dados[i][5]; // Coluna F - Total Vagas
    const totalInscritos = dados[i][6]; // Coluna G - Total Inscritos
    
    // Mostra turma se ainda há vagas disponíveis (inscritos < vagas)
    if (dados[i][0] === nivel && totalInscritos < totalVagas) {
      turmas.push({
        nivel: dados[i][0], // Coluna A - Nível
        codigo: dados[i][1], // Coluna B - Turma
        horario: dados[i][2], // Coluna C - Horário
        dataInicio: formatarData(dados[i][3]), // Coluna D - Data de Início
        dataTermino: formatarData(dados[i][4]), // Coluna E - Data de Término
        totalVagas: totalVagas - totalInscritos, // Coluna F - Total Vagas
        linha: i + 1 // Guardar a linha para atualização posterior
      });
    }
  }
  
  return turmas;
}

/**
 * Gera um código de protocolo único
 * Formato: INS-DDMMYYYY-XXXX (onde XXXX é um código aleatório de 4 caracteres)
 */
function gerarProtocolo() {
  // Gera 4 caracteres aleatórios (A-Z e 0-9)
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigoAleatorio = '';
  
  for (let i = 0; i < 4; i++) {
    codigoAleatorio += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  
  // Data atual no formato DDMMYYYY
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();
  
  return `INS-${dia}${mes}${ano}-${codigoAleatorio}`;
}

/**
 * Grava textos que começam com = + - @ como texto puro na planilha.
 * Evita que '+351...' vire número e impede injeção de fórmulas.
 */
function textoSeguro_(v) {
  return (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v;
}

// ===== LAYOUT DA ABA "INSCRITOS" =====
// Ordem das colunas = ordem do formulário. Cada item: [cabeçalho, grupo, função que pega o valor].
// Para mudar a ordem ou incluir campos, mexa SÓ aqui e rode "Configurar cabeçalho" no menu.
// ATENÇÃO: os cabeçalhos "Data de Identificação" e "Email enviado" são procurados pelo nome em outra função.
const CORES_GRUPO_ = { sistema: '#5F6368', resp: '#2E3192', bol: '#E91E63', com: '#00897B', turma: '#F57C00' };

const COLUNAS_INSCRITOS_ = [
  // Registro
  ['Data de Identificação', 'sistema', (d, x) => x.dataHora],
  ['Protocolo', 'sistema', (d, x) => x.protocolo],
  // Responsável
  ['Data de Admissão', 'resp', d => d.dataAdmissao],
  ['Nome do Responsável', 'resp', d => d.nomeResponsavel],
  ['Gênero do Responsável', 'resp', d => d.generoResponsavel],
  ['Estado Civil do Responsável', 'resp', d => d.estadoCivilResponsavel],
  ['CPF do Responsável', 'resp', d => d.cpfResponsavel],
  ['Data de Nascimento do Responsável', 'resp', d => d.dataNascimentoResponsavel],
  ['Celular do Responsável', 'resp', d => d.celularResponsavel],
  ['E-mail do Responsável Pedagógico', 'resp', d => d.emailPedagogico],
  ['Local de Trabalho/Departamento', 'resp', d => d.localTrabalho],
  ['Parentesco com o Bolsista', 'resp', d => d.parentesco],
  ['Responsável - Rua', 'resp', d => d.respLogradouro],
  ['Responsável - Número', 'resp', d => d.respNumero],
  ['Responsável - Complemento', 'resp', d => d.respComplemento],
  ['Responsável - Bairro', 'resp', d => d.respBairro],
  ['Responsável - Cidade', 'resp', d => d.respCidade],
  ['Responsável - Estado', 'resp', d => d.respUf],
  ['Responsável - CEP', 'resp', d => d.respCep],
  // Bolsista
  ['Nome do Bolsista', 'bol', d => d.nomeBolsista],
  ['Gênero do Bolsista', 'bol', d => d.genero],
  ['Estado Civil do Bolsista', 'bol', d => d.estadoCivil],
  ['CPF do Bolsista', 'bol', d => d.cpf],
  ['Data de Nascimento do Bolsista', 'bol', d => d.dataNascimento],
  ['Bolsista - Rua', 'bol', d => d.bolLogradouro],
  ['Bolsista - Número', 'bol', d => d.bolNumero],
  ['Bolsista - Complemento', 'bol', d => d.bolComplemento],
  ['Bolsista - Bairro', 'bol', d => d.bolBairro],
  ['Bolsista - Cidade', 'bol', d => d.bolCidade],
  ['Bolsista - Estado', 'bol', d => d.bolUf],
  ['Bolsista - CEP', 'bol', d => d.bolCep],
  ['Celular do Bolsista', 'bol', d => d.celularBolsista],
  ['E-mail do Bolsista', 'bol', d => d.emailBolsista],
  ['Necessidade Educacional Específica', 'bol', d => d.necessidadeEspecial],
  // Comunicações
  ['Comunicações enviadas para', 'com', (d, x) => x.destino.tipo],
  ['E-mail para comunicações', 'com', (d, x) => x.destino.email],
  // Turma e status
  ['Turma', 'turma', d => d.turma],
  ['Email enviado', 'sistema', (d, x) => x.emailEnviado]
];

/** Escreve e formata o cabeçalho (linha 1) da aba, com uma cor por grupo */
function aplicarCabecalhoInscritos_(sheet) {
  const n = COLUNAS_INSCRITOS_.length;
  if (sheet.getMaxColumns() < n) sheet.insertColumnsAfter(sheet.getMaxColumns(), n - sheet.getMaxColumns());
  const faixa = sheet.getRange(1, 1, 1, n);
  faixa.setValues([COLUNAS_INSCRITOS_.map(function (col) { return col[0]; })])
    .setFontColor('#FFFFFF').setFontWeight('bold').setWrap(true)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  COLUNAS_INSCRITOS_.forEach(function (col, i) {
    sheet.getRange(1, i + 1).setBackground(CORES_GRUPO_[col[1]]);
  });
  sheet.setFrozenRows(1);
}

/** Confere se o cabeçalho da planilha está na ordem esperada (evita gravar dado na coluna errada) */
function cabecalhoInscritosConfere_(sheet) {
  const esperado = COLUNAS_INSCRITOS_.map(function (col) { return col[0].toString().trim().toLowerCase(); });
  const largura = Math.min(esperado.length, sheet.getMaxColumns());
  const atual = sheet.getRange(1, 1, 1, largura).getValues()[0].map(function (v) { return String(v).trim().toLowerCase(); });
  const erros = esperado.filter(function (h, i) { return h !== atual[i]; });
  if (erros.length) console.error('❌ Cabeçalho da aba Inscritos fora do padrão. Divergências: ' + erros.join(' | '));
  return erros.length === 0;
}

/** Menu: cria o cabeçalho na aba "Inscritos" (só se ela ainda não tiver inscrições) */
function configurarCabecalhoInscritos() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Inscritos') || ss.insertSheet('Inscritos');
  if (sheet.getLastRow() > 1) {
    ui.alert('A aba "Inscritos" já tem inscrições.\n\nUse "Migrar Inscritos para o novo layout" para reorganizar sem perder dados.');
    return;
  }
  aplicarCabecalhoInscritos_(sheet);
  ui.alert('Cabeçalho da aba "Inscritos" configurado (' + COLUNAS_INSCRITOS_.length + ' colunas).');
}

/**
 * Menu: reorganiza inscrições já gravadas no layout ANTIGO para o novo layout.
 * Faz uma cópia de segurança da aba antes. Rode uma única vez.
 */
function migrarInscritosParaNovoLayout() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Inscritos');
  if (!sheet) { ui.alert('Aba "Inscritos" não encontrada.'); return; }
  if (cabecalhoInscritosConfere_(sheet)) { ui.alert('A aba já está no novo layout. Nada a fazer.'); return; }
  const resp = ui.alert('Migrar para o novo layout',
    'Será criada uma cópia de segurança da aba e as inscrições serão reorganizadas. Continuar?', ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  // Posição (0 = coluna A) de cada informação no layout ANTIGO
  const ANTIGO = {
    'Data de Identificação': 0, 'Protocolo': 16, 'Data de Admissão': 1, 'Nome do Responsável': 2,
    'Gênero do Responsável': 35, 'Estado Civil do Responsável': 36, 'CPF do Responsável': 37,
    'Data de Nascimento do Responsável': 38, 'Celular do Responsável': 7, 'E-mail do Responsável Pedagógico': 12,
    'Local de Trabalho/Departamento': 14, 'Parentesco com o Bolsista': 18,
    'Responsável - Rua': 26, 'Responsável - Número': 27, 'Responsável - Complemento': 28, 'Responsável - Bairro': 29,
    'Responsável - Cidade': 30, 'Responsável - Estado': 31, 'Responsável - CEP': 32,
    'Nome do Bolsista': 3, 'Gênero do Bolsista': 4, 'Estado Civil do Bolsista': 5, 'CPF do Bolsista': 9,
    'Data de Nascimento do Bolsista': 10,
    'Bolsista - Rua': 19, 'Bolsista - Número': 20, 'Bolsista - Complemento': 21, 'Bolsista - Bairro': 22,
    'Bolsista - Cidade': 23, 'Bolsista - Estado': 24, 'Bolsista - CEP': 25,
    'Celular do Bolsista': 8, 'E-mail do Bolsista': 11, 'Necessidade Educacional Específica': 13,
    'Comunicações enviadas para': 33, 'E-mail para comunicações': 34, 'Turma': 15, 'Email enviado': 17
  };
  const ENDERECO_TEXTO_ANTIGO = 6;  // coluna G: endereço do bolsista em texto único

  const backup = sheet.copyTo(ss);
  backup.setName('Inscritos_backup_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss'));

  const antigas = sheet.getDataRange().getValues().slice(1).filter(function (l) { return l.join('') !== ''; });
  const novas = antigas.map(function (l) {
    const linha = COLUNAS_INSCRITOS_.map(function (col) {
      const i = ANTIGO[col[0]];
      return i === undefined || l[i] === undefined ? '' : l[i];
    });
    // Linhas muito antigas só têm o endereço em texto único: preserva em "Bolsista - Rua"
    const iRua = COLUNAS_INSCRITOS_.findIndex(function (col) { return col[0] === 'Bolsista - Rua'; });
    const partes = ['Bolsista - Rua', 'Bolsista - Número', 'Bolsista - Bairro', 'Bolsista - Cidade', 'Bolsista - CEP'].some(function (h) {
      return linha[COLUNAS_INSCRITOS_.findIndex(function (col) { return col[0] === h; })] !== '';
    });
    if (!partes && l[ENDERECO_TEXTO_ANTIGO]) linha[iRua] = l[ENDERECO_TEXTO_ANTIGO];
    return linha.map(textoSeguro_);
  });

  sheet.clear();
  aplicarCabecalhoInscritos_(sheet);
  if (novas.length) sheet.getRange(2, 1, novas.length, COLUNAS_INSCRITOS_.length).setValues(novas);
  ui.alert('Migração concluída: ' + novas.length + ' inscrições reorganizadas.\nCópia de segurança: ' + backup.getName());
}

/**
 * Define para qual e-mail vão as comunicações sobre o bolsista.
 * Escolha do formulário: 'Bolsista' ou 'Responsável' (e-mail do responsável pedagógico).
 * Se escolheu o responsável mas não há e-mail dele, usa o do bolsista.
 */
function destinoComunicacao_(dados) {
  const emailBol = String(dados.emailBolsista || '').trim();
  const emailResp = String(dados.emailPedagogico || '').trim();
  if (dados.destinoComunicacao === 'Responsável' && emailResp) return { tipo: 'Responsável', email: emailResp };
  return { tipo: 'Bolsista', email: emailBol };
}

/**
 * Processa a inscrição com trava (evita estourar vagas com envios simultâneos)
 */
function processarInscricao(dadosFormulario) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    return { sucesso: false, mensagem: 'Sistema ocupado. Por favor, tente novamente em instantes.' };
  }
  try {
    return processarInscricaoInterno_(dadosFormulario);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Lógica original de processar a inscrição
 */
function processarInscricaoInterno_(dadosFormulario) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetInscritos = ss.getSheetByName('Inscritos');
    if (!cabecalhoInscritosConfere_(sheetInscritos)) {
      return { sucesso: false, mensagem: 'Sistema em atualização. Por favor, tente novamente em alguns minutos.' };
    }
    const sheetTurmas = ss.getSheetByName('Turmas');
    
    // Verificar novamente se há vagas (proteção contra concorrência)
    const turmasData = sheetTurmas.getDataRange().getValues();
    let linhaTurma = -1;
    let totalVagas = 0;
    let totalInscritos = 0;
    
    for (let i = 1; i < turmasData.length; i++) {
      if (turmasData[i][1] === dadosFormulario.turma) {
        linhaTurma = i + 1;
        totalVagas = turmasData[i][5]; // Coluna F - Total Vagas
        totalInscritos = turmasData[i][6]; // Coluna G - Total Inscritos
        break;
      }
    }
    
    if (linhaTurma === -1 || totalInscritos >= totalVagas) {
      return {
        sucesso: false,
        mensagem: 'Desculpe, não há mais vagas disponíveis para esta turma.'
      };
    }
    
    // Adicionar o inscrito
    const protocolo = gerarProtocolo();
    
    // Buscar informações completas da turma para retornar e enviar email
    let infoTurma = null;
    for (let i = 1; i < turmasData.length; i++) {
      if (turmasData[i][1] === dadosFormulario.turma) {
        infoTurma = {
          nivel: turmasData[i][0],
          codigo: turmasData[i][1],
          horario: turmasData[i][2],
          dataInicio: formatarData(turmasData[i][3]),
          dataTermino: formatarData(turmasData[i][4]),
          totalVagas: turmasData[i][5]
        };
        break;
      }
    }
    
    // Enviar e-mail de confirmação (opcional) - ANTES de salvar na planilha
    let emailEnviado = 'NÃO';
    try {
      console.log('=== TENTANDO ENVIAR EMAIL ===');
      console.log('Dados do bolsista:', dadosFormulario.nomeBolsista);
      console.log('Email bolsista:', dadosFormulario.emailBolsista);
      console.log('Email pedagógico:', dadosFormulario.emailPedagogico);
      
      const resultado = enviarEmailConfirmacao(dadosFormulario, protocolo, infoTurma);
      
      if (resultado) {
        emailEnviado = 'SIM';
        console.log('✅ EMAIL ENVIADO COM SUCESSO');
      } else {
        emailEnviado = 'NÃO';
        console.log('❌ FALHA AO ENVIAR EMAIL');
      }
    } catch (erro) {
      console.error('❌ ERRO AO ENVIAR EMAIL (continuando processo):', erro);
      emailEnviado = 'NÃO';
    }
    
    const destino = destinoComunicacao_(dadosFormulario);
    
    // Monta a linha na ordem de COLUNAS_INSCRITOS_ (mesma ordem do formulário)
    const ctx = {
      dataHora: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'),
      protocolo: protocolo,
      emailEnviado: emailEnviado,
      destino: destino
    };
    const novaLinha = COLUNAS_INSCRITOS_.map(function (col) { return col[2](dadosFormulario, ctx); });
    
    sheetInscritos.appendRow(novaLinha.map(function (v) { return textoSeguro_(v == null ? '' : v); }));
    
    // Atualizar o total de inscritos (incrementar)
    sheetTurmas.getRange(linhaTurma, 7).setValue(totalInscritos + 1);
    
    return {
      sucesso: true,
      mensagem: 'Inscrição realizada com sucesso!',
      protocolo: protocolo,
      dadosCompletos: {
        turma: infoTurma,
        bolsista: {
          nome: dadosFormulario.nomeBolsista,
          cpf: dadosFormulario.cpf,
          email: dadosFormulario.emailBolsista,
          celular: dadosFormulario.celularBolsista,
          dataNascimento: dadosFormulario.dataNascimento,
          genero: dadosFormulario.genero,
          estadoCivil: dadosFormulario.estadoCivil,
          endereco: dadosFormulario.endereco,
          emailComunicacao: destino.email,
          necessidadeEspecial: dadosFormulario.necessidadeEspecial
        },
        responsavel: {
          nome: dadosFormulario.nomeResponsavel,
          celular: dadosFormulario.celularResponsavel,
          localTrabalho: dadosFormulario.localTrabalho,
          dataAdmissao: dadosFormulario.dataAdmissao,
          emailPedagogico: dadosFormulario.emailPedagogico,
          parentesco: dadosFormulario.parentesco,
          genero: dadosFormulario.generoResponsavel,
          estadoCivil: dadosFormulario.estadoCivilResponsavel,
          cpf: dadosFormulario.cpfResponsavel,
          dataNascimento: dadosFormulario.dataNascimentoResponsavel,
          endereco: dadosFormulario.enderecoResponsavel
        }
      }
    };
    
  } catch (erro) {
    console.error('Erro ao processar inscrição:', erro);
    return {
      sucesso: false,
      mensagem: 'Erro ao processar inscrição. Por favor, tente novamente.'
    };
  }
}

// ===== MONTAGEM DO E-MAIL DE CONFIRMAÇÃO =====

/** Escapa texto digitado pelo usuário antes de colocar no HTML */
function h_(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Uma linha "rótulo | valor" (tabela, para não grudar em nenhum cliente de e-mail) */
function linhaEmail_(rotulo, valor, ultima) {
  const borda = ultima ? '' : 'border-bottom:1px solid #e8eaf0;';
  return '<tr>' +
    '<td class="lbl" width="38%" valign="top" style="padding:12px 16px 12px 0;' + borda + 'font-size:13px;font-weight:bold;color:#6b7280;line-height:1.5;">' + rotulo + '</td>' +
    '<td class="val" valign="top" style="padding:12px 0;' + borda + 'font-size:15px;color:#1f2937;line-height:1.5;">' + h_(valor) + '</td>' +
    '</tr>';
}

/** Uma seção com título e várias linhas (ignora linhas sem valor) */
function secaoEmail_(titulo, linhas) {
  const validas = linhas.filter(function (l) { return l[1]; });
  return '<tr><td class="px" style="padding:30px 32px 0 32px;">' +
    '<h2 style="margin:0 0 8px 0;font-size:18px;line-height:1.3;color:#2E3192;">' + titulo + '</h2>' +
    '<div style="height:3px;width:48px;background-color:#E91E63;font-size:0;line-height:0;margin-bottom:6px;">&nbsp;</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
    validas.map(function (l, i) { return linhaEmail_(l[0], l[1], i === validas.length - 1); }).join('') +
    '</table></td></tr>';
}

function montarEmailHtml_(dados, protocolo, infoTurma, dataHora) {
  const paraResp = destinoComunicacao_(dados).tipo === 'Responsável';
  const fonte = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<meta name="x-apple-disable-message-reformatting"><title>Confirmação de Inscrição</title>' +
    '<style>@media only screen and (max-width:620px){' +
    '.wrap{width:100% !important}.px{padding-left:20px !important;padding-right:20px !important}' +
    '.lbl,.val{display:block !important;width:100% !important}' +
    '.lbl{padding:12px 0 0 0 !important;border-bottom:0 !important}.val{padding:2px 0 12px 0 !important}' +
    '.titulo{font-size:24px !important}.prot{font-size:22px !important}}</style></head>' +
    '<body style="margin:0;padding:0;background-color:#f1f2f8;' + fonte + '">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f1f2f8;">Inscrição confirmada! Protocolo ' + h_(protocolo) + ' - ' + h_(infoTurma.codigo) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f2f8" style="background-color:#f1f2f8;"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;' + fonte + '">' +

    // Cabeçalho
    '<tr><td bgcolor="#2E3192" align="center" class="px" style="background-color:#2E3192;background-image:linear-gradient(135deg,#E91E63 0%,#2E3192 100%);padding:40px 32px;color:#ffffff;">' +
    '<div style="font-size:14px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;opacity:.9;margin-bottom:14px;">CNA Digital School</div>' +
    '<div class="titulo" style="font-size:28px;font-weight:bold;line-height:1.25;margin-bottom:8px;">🎉 Inscrição confirmada!</div>' +
    '<div style="font-size:16px;opacity:.95;">Sua vaga está garantida</div></td></tr>' +

    // Saudação
    '<tr><td class="px" style="padding:32px 32px 0 32px;">' +
    '<p style="margin:0 0 12px 0;font-size:18px;line-height:1.5;color:#1f2937;">Olá, <strong>' + h_(paraResp ? dados.nomeResponsavel : dados.nomeBolsista) + '</strong>!</p>' +
    '<p style="margin:0;font-size:15px;line-height:1.7;color:#4b5563;">' +
    (paraResp ? 'A inscrição de <strong>' + h_(dados.nomeBolsista) + '</strong> foi realizada com sucesso. Confira abaixo todos os detalhes da turma e guarde este e-mail como comprovante.'
              : 'Sua inscrição foi realizada com sucesso. Confira abaixo todos os detalhes da sua turma e guarde este e-mail como comprovante.') +
    '</p></td></tr>' +

    // Protocolo
    '<tr><td class="px" style="padding:24px 32px 0 32px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td bgcolor="#fdecf2" style="background-color:#fdecf2;border-left:4px solid #E91E63;border-radius:6px;padding:18px 20px;">' +
    '<div style="font-size:12px;font-weight:bold;letter-spacing:1.5px;color:#C2185B;margin-bottom:6px;">NÚMERO DO PROTOCOLO</div>' +
    '<div class="prot" style="font-size:26px;font-weight:bold;letter-spacing:2px;color:#C2185B;line-height:1.3;">' + h_(protocolo) + '</div>' +
    '<div style="font-size:13px;color:#C2185B;margin-top:6px;">Guarde este número para consultas futuras.</div>' +
    '</td></tr></table></td></tr>' +

    secaoEmail_('📚 Informações do curso', [
      ['Nível', infoTurma.nivel], ['Turma', infoTurma.codigo], ['Horário', infoTurma.horario],
      ['Data de início', infoTurma.dataInicio], ['Data de término', infoTurma.dataTermino]]) +
    secaoEmail_('👤 Dados do inscrito', [
      ['Nome', dados.nomeBolsista], ['CPF', dados.cpf], ['E-mail', dados.emailBolsista], ['Celular', dados.celularBolsista]]) +
    secaoEmail_('👨‍💼 Responsável', [
      ['Nome', dados.nomeResponsavel], ['Parentesco com o bolsista', dados.parentesco], ['Celular', dados.celularResponsavel], ['Departamento', dados.localTrabalho]]) +

    // Aviso
    '<tr><td class="px" style="padding:30px 32px 32px 32px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td bgcolor="#eef0fb" style="background-color:#eef0fb;border-left:4px solid #2E3192;border-radius:6px;padding:16px 20px;font-size:14px;line-height:1.7;color:#1A237E;">' +
    '<strong>📌 Importante:</strong> em breve entraremos em contato com mais informações sobre o início das aulas. Em caso de dúvidas, fale com o responsável pela sua inscrição.' +
    '</td></tr></table></td></tr>' +

    // Rodapé
    '<tr><td align="center" class="px" bgcolor="#f8f9fc" style="background-color:#f8f9fc;border-top:1px solid #e8eaf0;padding:28px 32px;">' +
    '<div style="font-size:15px;font-weight:bold;color:#374151;margin-bottom:6px;">Equipe Digital School</div>' +
    '<div style="font-size:13px;line-height:1.6;color:#6b7280;">Este é um e-mail automático. Por favor, não responda.</div>' +
    '<div style="font-size:12px;color:#9ca3af;margin-top:12px;">Inscrição realizada em ' + h_(dataHora) + '</div>' +
    '</td></tr></table></td></tr></table></body></html>';
}

/**
 * Envia e-mail de confirmação (opcional)
 * Retorna true se enviou com sucesso, false caso contrário
 */
function enviarEmailConfirmacao(dados, protocolo, infoTurma) {
  try {
    console.log('🔧 INICIANDO ENVIO DE EMAIL');
    
    // Verifica se ainda pode enviar emails (com margem de segurança)
    if (!podeEnviarEmails()) {
      console.error('❌ Limite de emails diário atingido. Email não enviado.');
      throw new Error('Limite de emails atingido');
    }
    
    console.log('✅ Verificação de limite: OK');
    
    const assunto = '✅ Confirmação de Inscrição - ' + infoTurma.codigo + ' | Protocolo: ' + protocolo;
    
    // HTML do e-mail (layout em tabelas, compatível com Gmail/Outlook/celular)
    const dataHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy 'às' HH:mm");
    const corpoHTML = montarEmailHtml_(dados, protocolo, infoTurma, dataHora);
    
    // Lista de destinatários
    const destinatarios = [];
    
    // Destinatário: o e-mail escolhido no formulário para as comunicações
    const emailDestino = destinoComunicacao_(dados).email;
    if (emailDestino) {
      destinatarios.push(emailDestino);
    }
    
    // Busca email de backup das propriedades do script
    let emailBkp = '';
    try {
      const scriptProperties = PropertiesService.getScriptProperties();
      emailBkp = scriptProperties.getProperty('email-bkp') || '';
    } catch (e) {
      console.log('Não foi possível buscar email-bkp das propriedades');
    }
    
    // Envia e-mail para todos os destinatários
    if (destinatarios.length > 0) {
      const opcoesEmail = {
        to: destinatarios.join(','),
        subject: assunto,
        body: 'Inscrição confirmada. Protocolo: ' + protocolo + '. Abra este e-mail em um programa que exiba HTML para ver os detalhes.',   // exigido pelo MailApp; o conteúdo real é o htmlBody
        htmlBody: corpoHTML,
        name: 'Inscrição Bolsa CNA Idiomas - Digital School'
      };
      
      // Adiciona email de backup em cópia se existir
      if (emailBkp && emailBkp.trim()) {
        opcoesEmail.cc = emailBkp.trim();
        console.log('📧 Email backup em Cc: ' + emailBkp);
      }
      
      console.log('📤 Enviando email via MailApp...');
      MailApp.sendEmail(opcoesEmail);
      
      // Incrementa contador de emails enviados
      incrementarContadorEmails(1);
      
      console.log('✅ E-mails enviados para: ' + destinatarios.join(', ') + (emailBkp ? ' | Cc: ' + emailBkp : ''));
      return true; // Email enviado com sucesso
    } else {
      console.log('❌ Nenhum e-mail válido encontrado para envio');
      return false; // Não há destinatários válidos
    }
    
  } catch (erro) {
    console.error('Erro ao enviar e-mail:', erro);
    return false; // Erro ao enviar
  }
}

/**
 * Formata data para exibição
 */
function formatarData(data) {
  if (!data) return '';
  
  try {
    if (data instanceof Date) {
      return Utilities.formatDate(data, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    }
    return data.toString();
  } catch (e) {
    return data.toString();
  }
}

/**
 * Configura triggers automáticos
 */
function configurarTriggers() {
  // Remove triggers existentes
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  
  // Cria novo trigger onOpen
  ScriptApp.newTrigger('onOpen')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onOpen()
    .create();
    
  SpreadsheetApp.getUi().alert('Triggers configurados com sucesso!');
}

/**
 * Mostra instruções de uso
 */
function mostrarInstrucoes() {
  const instrucoes = `
SISTEMA DE INSCRIÇÕES DE BOLSISTAS

COMO FUNCIONA
• O formulário fica no GitHub Pages e envia as inscrições para esta planilha.
• Cada inscrição vira uma linha na aba "Inscritos" e desconta uma vaga na aba "Turmas".
• O e-mail de confirmação vai somente para o e-mail escolhido no formulário (bolsista ou responsável).

ABA "TURMAS" (você edita)
• Uma linha por turma: A Nível | B Turma (código único) | C Horário | D Início | E Término | F Total Vagas | G Total Inscritos.
• Para criar uma turma, adicione uma linha e deixe Total Inscritos = 0.
• A turma só aparece no formulário se Total Inscritos for menor que Total Vagas.

ABA "INSCRITOS" (NÃO edite)
• Guarda as inscrições. Não reordene, apague ou insira colunas, nem renomeie cabeçalhos. Se o cabeçalho mudar, o formulário deixa de gravar ("Sistema em atualização").
• Para filtrar ou exportar, duplique a aba ou baixe em CSV.

MENU "SISTEMA DE INSCRIÇÕES"
• Configurar cabeçalho da aba Inscritos: cria o cabeçalho (só se a aba não tiver inscrições).
• Migrar Inscritos para o novo layout: reorganiza dados do layout antigo, com cópia de segurança.
• Verificar Limite de Emails: consumo diário (limite: ${LIMITE_EMAILS_DIARIO} por dia).
• Configurar Triggers: recria o gatilho que monta este menu.

ALTERAÇÕES NO CÓDIGO
• Depois de editar o Código.gs: Implantar > Gerenciar implantações > Editar > Nova versão.
• O Web App deve ter acesso "Qualquer pessoa".
  `;
  
  SpreadsheetApp.getUi().alert('Instruções', instrucoes, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ===== FUNÇÕES PARA FORMULÁRIO WEB EXTERNO =====

/**
 * API para o front-end hospedado no GitHub Pages.
 * GET  ?action=niveis            -> lista de níveis com vagas
 * GET  ?action=turmas&nivel=XXX  -> turmas do nível
 * POST (corpo JSON, text/plain)  -> processa a inscrição
 */
function responderJSON_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.action === 'niveis') {
      return responderJSON_({ ok: true, dados: obterNiveis() });
    }
    if (p.action === 'turmas') {
      return responderJSON_({ ok: true, dados: obterTurmasPorNivel(p.nivel || '') });
    }
    return responderJSON_({ ok: true, mensagem: 'API de inscrições no ar.' });
  } catch (erro) {
    console.error('Erro no doGet:', erro);
    return responderJSON_({ ok: false, mensagem: 'Erro interno.' });
  }
}

function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);
    return responderJSON_({ ok: true, resultado: processarInscricao(dados) });
  } catch (erro) {
    console.error('Erro no doPost:', erro);
    return responderJSON_({ ok: false, mensagem: 'Erro interno.' });
  }
}
