# Formulário de Bolsistas

Formulário de inscrição de bolsistas em página única, hospedado no **GitHub Pages**. Ele não guarda dados sozinho: conversa com um **Google Apps Script** (publicado como Web App) que lê as turmas, grava as inscrições em uma **planilha Google** e envia o **e-mail de confirmação**.

<!-- Opcional: link da documentação completa de uso (interna) -->

- Sem dependências e sem etapa de build: HTML, CSS e JavaScript puro em um único arquivo.
- Validações no navegador: CPF, telefone, datas, e-mails e CEP.
- Controle de vagas por turma, com trava contra envios simultâneos.
- E-mail de confirmação para o endereço escolhido no formulário (bolsista ou responsável).

## Visão geral

```
Navegador (GitHub Pages — index.html)
        │  GET  ?action=niveis | ?action=turmas&nivel=...
        │  POST (JSON em text/plain)
        ▼
Google Apps Script (Web App — Codigo.gs)
        │
        ├──▶ Planilha Google, aba "Turmas"    (níveis, turmas e vagas)
        ├──▶ Planilha Google, aba "Inscritos" (uma linha por inscrição)
        └──▶ MailApp: e-mail de confirmação
```

**Por que assim:** antes o formulário rodava dentro de um iframe do Google, que é bloqueado em muitos navegadores (principalmente com várias contas Google logadas). Agora o navegador conversa direto com a URL `/exec` do Web App, sem iframe.

## Estrutura do repositório

```
.
├── index.html          # todo o front-end (HTML + CSS + JS)
├── backend/
│   └── Codigo.gs       # cópia do código do Apps Script (versionamento e backup)
└── README.md
```

> O código que **roda** o back-end fica dentro do projeto Apps Script da planilha. A cópia em `backend/` serve para histórico e backup: ao alterar um, atualize o outro.

## Fluxo de uma inscrição

1. A página carrega e chama `GET ?action=niveis`. O script devolve só os níveis que têm turma com vaga.
2. Ao escolher o nível, chama `GET ?action=turmas&nivel=...` e preenche a lista de turmas.
3. Ao enviar, o front-end valida tudo no navegador, monta o JSON e faz `POST` para a URL `/exec`.
4. `doPost` chama `processarInscricao`, que entra em uma **trava** (`LockService`, até 30 s) para não estourar vagas.
5. Dentro da trava: confere se o cabeçalho da aba `Inscritos` está no padrão, confere de novo a vaga, gera o protocolo e envia o e-mail.
6. Grava a linha em `Inscritos`, soma 1 em **Total Inscritos** da turma e devolve o resultado.
7. O front-end troca o formulário pela tela de confirmação.

O e-mail é enviado **antes** de gravar a linha. Se ele falhar, a inscrição é gravada mesmo assim, com `Email enviado = NÃO`.

## Configuração e publicação

### 1. Back-end (Google Apps Script)

1. Abra a planilha e vá em **Extensões → Apps Script**.
2. Cole o conteúdo de `backend/Codigo.gs` no projeto.
3. **Implantar → Nova implantação → App da Web**:
   - *Executar como*: **Eu**
   - *Quem pode acessar*: **Qualquer pessoa** (não use "Qualquer pessoa com Conta Google": traz de volta o bloqueio)
4. Copie a URL gerada (termina em `/exec`) e autorize o script quando for pedido.
5. Opcional: em **Configurações do projeto → Propriedades do script**, crie `email-bkp` com um e-mail que receberá cópia (Cc) das confirmações.

**Depois de qualquer mudança no `Codigo.gs`**, crie uma nova versão: *Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão → Implantar*. Sem isso o site continua usando a versão antiga. Mantendo a mesma implantação, a URL não muda. Se front-end e back-end mudarem juntos, publique o **back-end primeiro**.

### 2. Planilha

Duas abas, com estes nomes exatos:

**`Turmas`** — uma linha por turma, lida pela **posição** das colunas:

| Coluna | Conteúdo |
|---|---|
| A | Nível |
| B | Turma (código único) |
| C | Horário |
| D | Data de início |
| E | Data de término |
| F | Total de vagas |
| G | Total de inscritos (começa em 0; o sistema soma) |

Uma turma só aparece no formulário se `G < F`.

**`Inscritos`** — criada pelo menu da planilha (*Sistema de Inscrições → Configurar cabeçalho da aba Inscritos*), com 38 colunas (A a AL) agrupadas na ordem do formulário:

| Colunas | Grupo |
|---|---|
| A–B | Registro (data de identificação, protocolo) |
| C–S | Responsável (dados pessoais, parentesco, endereço) |
| T–AH | Bolsista (dados pessoais, endereço, contatos) |
| AI–AJ | Comunicações (para quem enviar e e-mail usado) |
| AK | Turma |
| AL | Email enviado (SIM ou NÃO) |

A definição completa fica em um único lugar, a lista `COLUNAS_INSCRITOS_` do `Codigo.gs`.

### 3. Front-end (GitHub Pages)

1. No `index.html`, preencha a constante `API_URL` (início do `<script>`) com a URL `/exec` do Web App. Enquanto ela for `COLE_AQUI_A_URL_DO_WEB_APP`, a página mostra um aviso de configuração.
2. No repositório, ative **Settings → Pages** e escolha a branch (e a pasta raiz) a publicar.
3. A cada *commit* o site é atualizado em poucos minutos. Use Ctrl+F5 para ignorar o cache.

**Testar localmente:** abra o `index.html` no navegador (ou rode `python -m http.server` na pasta). Ele usa o mesmo Web App, então **testes locais gravam na planilha real**.

## Front-end (`index.html`)

Três telas no mesmo container, alternadas por `mostrarTela()`: `viewForm` (formulário), `viewLoading` (processando) e `viewConfirm` (confirmação). Cores da marca: rosa `#E91E63` e azul `#2E3192`.

| Função / bloco | Para que serve |
|---|---|
| `apiGet`, `apiPost` | Chamadas ao Apps Script. O POST usa `Content-Type: text/plain` para evitar o *preflight* de CORS, que o Apps Script não suporta |
| `carregarNiveis`, `carregarTurmas`, `mostrarInfoTurma` | Listas de nível e turma e o quadro de informações da turma |
| `blocoEndereco(prefixo, título)` | Gera os campos de endereço (prefixos `bol` e `resp`) |
| `montarEndereco` | Junta os campos de endereço em um texto único |
| `validarCPF`, `validarEmail`, `ehEmailCna`, `validarTelefone`, `parseBR` | Funções de validação |
| `DATA_MAX` | Data limite da idade mínima (hoje menos 4 anos) |
| `erroDoCampo(el)` | **Ponto central das regras:** devolve a mensagem de erro de um campo, ou vazio |
| `setErro`, `validarFormulario` | Mostram o erro abaixo do campo e validam tudo no envio |
| `abrirModal`, `mostrarAlerta`, `confirmar` | Pop-ups no estilo do site |
| `dpAbrir`, `dpRender` | Seletor de data de nascimento (ano → mês → dia) |
| `csInit(select)` | Transforma cada `<select>` em uma lista personalizada; o `<select>` original continua oculto e é a fonte do valor |
| `sincronizarEndereco`, `atualizarDestino`, `atualizarParentesco` | Regras de "mesmo endereço", aviso do e-mail de comunicação e campo "Outro" |
| `mostrarConfirmacao` | Monta a tela de confirmação a partir da resposta do servidor |

### Regras de preenchimento implementadas

- **CPF:** dígito verificador (responsável e bolsista).
- **Telefone:** celular BR (DDD + 9 dígitos), fixo BR (DDD + 8 dígitos começando de 2 a 5) ou internacional começando com `+`.
- **Datas de nascimento:** idade mínima de 4 anos e nunca futura.
- **E-mails:** formato válido; domínios `@cna*` bloqueados; e-mail do bolsista e do responsável podem ser iguais.
- **CEP:** 8 dígitos.
- **Comunicações:** se escolher o e-mail do responsável, o e-mail do responsável pedagógico passa a ser obrigatório.

## Back-end (`Codigo.gs`)

| Grupo | Funções |
|---|---|
| API | `doGet`, `doPost`, `responderJSON_` |
| Inscrição | `processarInscricao` (com trava), `processarInscricaoInterno_`, `gerarProtocolo`, `formatarData` |
| Turmas | `obterNiveis`, `obterTurmasPorNivel` |
| Layout da planilha | `COLUNAS_INSCRITOS_`, `CORES_GRUPO_`, `aplicarCabecalhoInscritos_`, `cabecalhoInscritosConfere_`, `configurarCabecalhoInscritos`, `migrarInscritosParaNovoLayout` |
| E-mail | `destinoComunicacao_`, `montarEmailHtml_`, `linhaEmail_`, `secaoEmail_`, `h_`, `enviarEmailConfirmacao` |
| Limite de e-mails | `LIMITE_EMAILS_DIARIO`, `MARGEM_SEGURANCA_EMAILS`, `verificarLimiteEmails`, `verificarLimiteEmailsLog`, `incrementarContadorEmails`, `podeEnviarEmails`, `sincronizarContadorEmails` |
| Segurança | `textoSeguro_`, `h_` |
| Menu e testes | `onOpen`, `configurarTriggers`, `mostrarInstrucoes`, `testarEnvioEmail`, `testarInscricaoCompleta` |

**Layout da aba `Inscritos`.** `COLUNAS_INSCRITOS_` guarda `[cabeçalho, grupo, função que pega o valor]` e é usada para montar a linha gravada, criar o cabeçalho, conferir o cabeçalho existente e migrar dados antigos.

**Trava de segurança.** Antes de gravar, o cabeçalho da planilha é comparado com a lista. Se for diferente, **nada é gravado** e a resposta é "Sistema em atualização" (os detalhes ficam no log do Apps Script). Os cabeçalhos **Data de Identificação** e **Email enviado** são procurados pelo nome em `sincronizarContadorEmails`: não mude esses textos.

**E-mail.** O destinatário vem de `destinoComunicacao_`: se foi escolhido "Responsável" e existe e-mail do responsável pedagógico, vai para ele; senão, para o bolsista. O HTML usa tabelas com estilos inline (compatível com Gmail, Outlook e celular) e o conteúdo digitado passa por `h_` (escape de HTML). O limite diário e a margem de segurança ficam nas duas constantes do topo do arquivo; o contador diário fica nas propriedades do script.

**Proteção de dados na planilha.** Textos que começam com `=`, `+`, `-` ou `@` são gravados como texto puro (`textoSeguro_`), o que impede injeção de fórmulas e preserva números internacionais (`+351…`).

## API

| Chamada | Resposta |
|---|---|
| `GET ?action=niveis` | `{ "ok": true, "dados": ["A1", "A2"] }` |
| `GET ?action=turmas&nivel=A1` | `{ "ok": true, "dados": [{ nivel, codigo, horario, dataInicio, dataTermino, totalVagas, linha }] }` — `totalVagas` é o número de vagas **restantes** |
| `POST` (corpo JSON em `text/plain`) | `{ "ok": true, "resultado": { "sucesso": true, "protocolo": "...", "dadosCompletos": {...} } }` ou `resultado: { "sucesso": false, "mensagem": "..." }` |
| Erro interno | `{ "ok": false, "mensagem": "Erro interno." }` |

**Campos do `POST`**

| Grupo | Campos |
|---|---|
| Responsável | `dataAdmissao`, `nomeResponsavel`, `generoResponsavel`, `estadoCivilResponsavel`, `cpfResponsavel`, `dataNascimentoResponsavel` (aaaa-mm-dd), `celularResponsavel`, `emailPedagogico`, `localTrabalho`, `parentesco` |
| Endereço do responsável | `respLogradouro`, `respNumero`, `respComplemento`, `respBairro`, `respCidade`, `respUf`, `respCep`, `enderecoResponsavel` (texto único) |
| Bolsista | `nomeBolsista`, `genero`, `estadoCivil`, `cpf`, `dataNascimento` (aaaa-mm-dd), `celularBolsista`, `emailBolsista`, `necessidadeEspecial` |
| Endereço do bolsista | `bolLogradouro`, `bolNumero`, `bolComplemento`, `bolBairro`, `bolCidade`, `bolUf`, `bolCep`, `endereco` (texto único) |
| Comunicação e turma | `destinoComunicacao` (`Bolsista` ou `Responsável`), `nivel`, `turma` (código da coluna B de `Turmas`) |

## Receitas de mudança

- **Textos, cores e espaçamentos:** edite o CSS e o HTML do `index.html`.
- **Opções de uma lista** (gênero, estado civil, parentesco): edite as `<option>` do `<select>`; a lista personalizada se atualiza sozinha.
- **Regra de um campo:** edite o `case` correspondente em `erroDoCampo`.
- **Idade mínima:** altere o `- 4` em `DATA_MAX` e as mensagens em `erroDoCampo`.
- **Domínio de e-mail bloqueado:** função `ehEmailCna`.
- **Limite de e-mails:** constante `LIMITE_EMAILS_DIARIO` (e `MARGEM_SEGURANCA_EMAILS`) no topo do `Codigo.gs`.
- **Adicionar um campo novo:**
  1. Inclua o campo no HTML **com `name`** (tudo que tem `name` é enviado ao servidor).
  2. Se houver regra, inclua um `case` em `erroDoCampo`.
  3. No `Codigo.gs`, adicione uma linha **no final** de `COLUNAS_INSCRITOS_`.
  4. Na planilha, escreva o mesmo cabeçalho na primeira célula vazia à direita da última coluna, com o mesmo texto.
  5. Publique o novo `Codigo.gs` (nova versão do deploy) e o front-end. Opcional: exiba o dado em `mostrarConfirmacao` e em `montarEmailHtml_`.

Adicionar no meio da lista exige inserir a coluna na mesma posição da planilha antes do deploy; mudar a ordem de colunas existentes exige adaptar `migrarInscritosParaNovoLayout`.

## Testes

Execute pelo editor do Apps Script:

- `testarEnvioEmail`: envia as duas versões do e-mail real (para bolsista e para responsável), com dados fictícios, para o `email-bkp` ou para a conta dona do script. Gasta 2 e-mails da cota.
- `testarInscricaoCompleta`: faz uma inscrição de teste na primeira turma com vaga, confere se todas as colunas foram preenchidas e, por padrão, apaga a linha de teste e devolve a vaga. Use o parâmetro `false` para manter a linha. Envia 1 e-mail real.
- `verificarLimiteEmailsLog`: mostra o consumo diário de e-mails no log.
- `sincronizarContadorEmails`: recalcula o contador diário a partir da planilha.

## Limitações conhecidas

- **Validações só no navegador.** Quem enviar um `POST` direto para a URL `/exec` consegue gravar qualquer valor. Recomendação: repetir as validações em `processarInscricao`.
- **A URL `/exec` é pública**, o que é necessário para o formulário funcionar. Se houver abuso, considere um token simples ou verificação anti-robô.
- **Não há bloqueio de CPF duplicado.**
- **Cota de e-mails:** contas Google comuns enviam cerca de 100 por dia. O sistema para de enviar ao chegar em 95; a inscrição continua sendo gravada, com `Email enviado = NÃO`.
- **Datas** de nascimento e admissão são gravadas como `aaaa-mm-dd`, e o Google Sheets as converte em datas.

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| "Configure a constante API_URL" | `API_URL` não preenchida | Cole a URL `/exec` no `index.html` e publique |
| "Erro ao carregar níveis/turmas" | URL errada, acesso não está como "Qualquer pessoa" ou deploy sem a versão nova | Abra `<URL>/exec?action=niveis`: deve aparecer um JSON. Revise as opções do deploy |
| Aparece login do Google ao abrir a URL `/exec` | Acesso como "Qualquer pessoa com Conta Google" | Reimplante com "Qualquer pessoa" |
| Nenhum nível aparece | Nenhuma turma com `G < F`, ou a aba `Turmas` tem outro nome | Confira a aba e os números |
| "Sistema em atualização" ao enviar | Cabeçalho de `Inscritos` diferente do esperado | Veja o log do Apps Script e corrija o cabeçalho |
| Mudei o `Codigo.gs` e nada mudou | Faltou nova versão do deploy | Crie uma nova versão (veja Configuração) |
| Mudei o `index.html` e nada mudou | Cache do navegador ou do GitHub Pages | Aguarde alguns minutos e use Ctrl+F5 |

## Segurança e privacidade

- A planilha guarda dados pessoais (CPF, endereço, datas de nascimento). **Nunca versione exportações dela** (CSV, XLSX) neste repositório e restrinja o acesso à planilha.
- Não grave senhas, tokens ou e-mails pessoais no código. Configurações do script (como `email-bkp`) ficam nas **Propriedades do script**, fora do repositório.
- Em repositório público, tudo que está aqui pode ser lido por qualquer pessoa. Mantenha links internos, contas e dados de inscritos fora dos arquivos versionados.
