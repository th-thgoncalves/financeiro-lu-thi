# Financeiro — Lu & Thi

App simples para lançar gastos e receitas rapidinho pelo celular, que
alimenta uma planilha financeira no Google Sheets — sem precisar abrir
o Google Sheets pra nada no dia a dia.

Instalável como app no iPhone e Android (PWA), funciona offline pra
visualização (com cache), e tem backup automático no Drive.

---

## Sumário

- [O que o app faz](#o-que-o-app-faz)
- [Estrutura de arquivos](#estrutura-de-arquivos)
- [Como funciona (visão geral)](#como-funciona-visão-geral)
- [Passo 1 — Configurar o Google Apps Script](#passo-1--configurar-o-google-apps-script)
- [Passo 2 — Conectar o app à planilha](#passo-2--conectar-o-app-à-planilha)
- [Passo 3 — Publicar no GitHub Pages](#passo-3--publicar-no-github-pages)
- [Passo 4 — Instalar no celular](#passo-4--instalar-no-celular)
- [Estrutura da planilha](#estrutura-da-planilha)
- [Funcionalidades](#funcionalidades)
- [Solução de problemas](#solução-de-problemas)
- [Manutenção](#manutenção)
- [Replicar o app para outra pessoa](#replicar-o-app-para-outra-pessoa)
- [Tecnologias](#tecnologias)

---

## O que o app faz

Em poucas palavras:

- **Lançamento rápido**: 8 toques e um valor → salvo direto na planilha
- **Resumo do mês**: entradas, saídas, saldo previsto e saldo real (o que já foi pago/recebido), por categoria
- **Orçamento por categoria**: define limite e o app avisa quando está perto de estourar
- **Parcelamento**: compras em 2x até 24x, uma parcela caindo por mês
- **Edição e exclusão**: pelo próprio celular, sem abrir a planilha
- **Backup automático**: toda madrugada de domingo, uma cópia da planilha vai pro Drive
- **E-mail mensal**: no dia 1, um resumo do mês anterior chega no e-mail de vocês
- **Performance**: cache no servidor e no app, para as respostas serem rápidas

---

## Estrutura de arquivos

```
financeiro-app/
├── index.html          → tela do app
├── style.css            → visual do app
├── app.js                → lógica (formulário, envio pra planilha)
├── manifest.json        → configuração do "instalar na tela inicial"
├── service-worker.js    → deixa o app instalável e gerencia cache
├── icons/                → ícones do app
└── google-apps-script/
    └── Code.gs           → script que recebe os dados na planilha
```

A pasta `google-apps-script/` fica só no seu computador — ela não vai pro GitHub Pages, porque é colada dentro do Apps Script da planilha.

---

## Como funciona (visão geral)

```
┌─────────────────┐      fetch       ┌──────────────────┐
│  Celular (PWA)  │ ───────────────▶ │  Google Apps     │
│  GitHub Pages   │ ◀─────────────── │  Script (/exec)  │
└─────────────────┘      JSON        └────────┬─────────┘
                                              │
                                              ▼
                                     ┌──────────────────┐
                                     │ Google Sheets    │
                                     │ (planilha)       │
                                     └──────────────────┘
```

- O **app** (HTML/CSS/JS) é hospedado pelo GitHub Pages — só arquivos estáticos, rápido e grátis.
- O **Apps Script** recebe os lançamentos e devolve consultas (resumo, categorias, recentes).
- A **planilha** é onde os dados moram de verdade. Vocês continuam donos dela.

Nenhum dado passa por servidor de terceiros — só Google.

---

## Passo 1 — Configurar o Google Apps Script

1. Abra a planilha **PLANILHA FINANCEIRA - LU E THI**.
2. Menu **Extensões > Apps Script**.
3. Apague o conteúdo padrão e cole o conteúdo de `google-apps-script/Code.gs`.
4. Salve (ícone de disquete).
5. **Implantar > Nova implantação**.
6. Em "Selecionar tipo", clique na engrenagem e escolha **Aplicativo da Web**.
7. Configure:
   - Executar como: **Eu (seu e-mail)**
   - Quem pode acessar: **Qualquer pessoa**
8. **Implantar**.
9. O Google vai pedir autorização — clique em **Autorizar acesso**, escolha sua conta, e se aparecer aviso "app não verificado", clique em **Avançado > Acessar (não seguro)**. Isso é normal — o script é seu.
10. Copie a **URL do aplicativo da Web** (termina em `/exec`). Você vai usar no Passo 2.

> **Importante ao editar o `Code.gs`:** salvar não atualiza o app publicado. É preciso ir em **Implantar > Gerenciar implantações**, clicar no ícone de lápis e escolher **Nova versão**. A URL continua a mesma.

### Primeira configuração da planilha

Depois de colar o script e implantar, vá até a planilha e recarregue (F5). Um menu novo **"Financeiro"** aparece ao lado de "Ajuda". Clique, em ordem:

1. **Configurar Resumo** — cria a aba "Resumo"
2. **Configurar Categorias** — cria a aba "Categorias" com as categorias padrão
3. **Configurar Orçamentos** — cria a aba "Orçamentos" (opcional, mas recomendado)
4. **Configurar Avisos** — cria a aba "Config" (necessária pro e-mail mensal)
5. **Instalar rotinas automáticas** — cria os 3 acionadores:
   - Backup toda madrugada de domingo (~3h)
   - E-mail mensal todo dia 1 (~9h)
   - Warmup a cada 5 minutos (mantém o script "quente" pra ficar rápido)

Essas 5 ações só precisam ser feitas **uma vez**.

---

## Passo 2 — Conectar o app à planilha

1. Abra o arquivo `app.js`.
2. Na primeira linha de código, troque:
   ```js
   const SCRIPT_URL = "COLE_AQUI_A_URL_DO_SEU_APP_SCRIPT";
   ```
   pela URL copiada no passo anterior, entre aspas.

> Se você for manter o repositório público, essa URL fica visível. Como o Apps Script é "qualquer pessoa", qualquer um que descobrir a URL consegue ler e escrever. Para um app pessoal de casal isso é aceitável, mas vale saber.

---

## Passo 3 — Publicar no GitHub Pages

1. Crie um repositório no GitHub (ex: `financeiro-lu-thi`).
2. Suba todos os arquivos desta pasta **exceto** a pasta `google-apps-script`.
3. Vá em **Settings > Pages**.
4. Em "Branch", escolha `main` e a pasta `/root`. Salve.
5. Em alguns minutos, o GitHub mostra o link (algo como `https://seuusuario.github.io/financeiro-lu-thi/`).

---

## Passo 4 — Instalar no celular

1. Abra o link do GitHub Pages no navegador do celular:
   - **Android:** Chrome
   - **iPhone:** Safari (tem que ser o Safari, não o Chrome)
2. Toque em **Compartilhar** (iPhone) ou no menu (Android) e escolha:
   - **iPhone:** "Adicionar à Tela de Início"
   - **Android:** "Instalar aplicativo" ou "Adicionar à tela inicial"
3. O ícone "L&T" aparece na tela como app normal.
4. Repita no celular do outro.

---

## Estrutura da planilha

Depois de configurado, a planilha tem essas abas:

| Aba | O que é |
|---|---|
| **Lançamentos** | A única aba que o app escreve. Cada linha é um lançamento (ou uma parcela). |
| **Resumo** | Totais por mês, atualizado automaticamente. Não editar à mão. |
| **Categorias** | Editável: Bloco + Categoria. O app puxa as opções daqui. |
| **Orçamentos** | Editável: limite mensal por categoria. O app avisa quando estoura. |
| **Config** | E-mails do resumo mensal e chaves liga/desliga. |

### Colunas da aba "Lançamentos"

| Col | Nome | Exemplo |
|---|---|---|
| A | ID | (UUID gerado pelo script) |
| B | Data | 15/09/2026 |
| C | Hora | 14:32 |
| D | Quem | Lu / Thi |
| E | Bloco | Despesa Fixa / Despesa Variável / Cartão / Receita |
| F | Categoria | Luz, Facul, Cartão… |
| G | Valor | 120,00 |
| H | Pago | Sim / Não |
| I | Observação | (opcional) |
| J | Parcela | ex: 3/6 (vazio se avulso) |
| K | GrupoID | (UUID que amarra as parcelas de um mesmo parcelamento) |

As colunas **A** (ID), **J** (Parcela) e **K** (GrupoID) foram adicionadas em versões posteriores. Se a planilha já existia antes, o script cria essas colunas automaticamente na primeira vez que rodar, e preenche os dados antigos.

---

## Funcionalidades

### Tela inicial

- **+ Novo lançamento** — abre o wizard
- **📊 Ver resumo do mês** — totais por mês, com barra de orçamento por categoria
- **🕘 Últimos lançamentos** — lista os últimos 30, com filtro por mês e busca
- **💾 Fazer backup agora** — cria uma cópia da planilha no Drive na hora

No topo, tem um botão **🏠** que volta pra tela inicial de qualquer lugar (com confirmação se você estiver no meio de um lançamento).

### Wizard de lançamento (8 passos)

1. **Quem** (Lu ou Thi)
2. **Bloco** (Despesa Fixa / Despesa Variável / Cartão / Receita)
3. **Categoria** (puxa da aba "Categorias", ou "Outro" pra digitar livre)
4. **Valor** (total, se for parcelado)
5. **É parcelado?** (Sim / Não)
6. **Quantas vezes?** (2x a 24x — só se parcelado)
7. **Quando** (mês da 1ª parcela, ou mês único)
8. **Já foi pago/recebido?** (Sim / Não)
9. **Observação** (opcional) e confirmação
10. **Sucesso**

Se for parcelado, cada parcela vira uma linha na planilha, com uma data por mês, e a coluna "Parcela" preenchida (ex: `1/6`, `2/6`…). Apenas a **primeira** parcela herda a resposta de "já foi pago"; as seguintes nascem sempre como **pendentes**.

### Últimos lançamentos — ações

- **Marcar pago / Desfazer pago** — muda o status, com um toque
- **Duplicar** — abre o wizard já preenchido (bom pra contas fixas)
- **Editar** — abre o wizard com os dados atuais
  - Se for lançamento avulso, edita só ele
  - Se for parcela de parcelamento, pergunta o escopo: **só esta**, **esta e as futuras**, **todas** ou **cancelar daqui pra frente**
- **Excluir**
  - Se for avulso, exclui direto (com confirmação)
  - Se for parcela, pergunta: **só esta** ou **todo o parcelamento** (exclui as pendentes, preserva as pagas)

### Backup automático

- Roda toda madrugada de domingo (~3h)
- Cópia completa da planilha vai pra pasta `Backups Financeiro L&T` no Drive
- Backups com mais de 90 dias são apagados automaticamente
- Você também pode forçar um backup pelo app (botão na home) ou pelo menu **Financeiro > Rodar backup agora**

### E-mail mensal

- Roda todo dia 1 (~9h)
- Manda um resumo do mês anterior em HTML para os e-mails configurados
- Inclui entradas, saídas, saldo previsto, saldo real, e totais por categoria
- Configuração: aba **Config** (não é editável pelo app, só pela planilha)

### Orçamento por categoria

- Você define um limite mensal na aba **Orçamentos**
- No Resumo, aparece uma barra de progresso abaixo da categoria
- Verde até 80%, amarelo entre 80% e 100%, vermelho quando estoura
- No wizard, se o lançamento vai estourar, o app avisa antes de salvar (não bloqueia)

---

## Solução de problemas

### "Não deu pra salvar: The string did not match the expected pattern."

Erro do Safari do iPhone. Já resolvido desde a versão do Bloco C, mas se reaparecer: verifique se a versão publicada do `app.js` é a mais recente. Limpe o cache do service worker no iPhone (remove o app da tela de início e adiciona de novo).

### "Não deu pra carregar: [mensagem]"

Provavelmente internet. Verifique se o script do Apps Script ainda está implantado como "Nova versão" mais recente.

### Dados antigos aparecendo (lançamento novo não aparece)

Cache do service worker. No iPhone: fecha o app por completo (arrasta pra cima na lista de apps abertos) e reabre. Se não resolver: remove da tela de início e adiciona de novo.

### App mostra "erro 401/403"

O Apps Script foi republicado mas a implantação não. Vá em **Implantar > Gerenciar implantações > lápis > Nova versão**.

### Lançamento não aparece na planilha

1. Verifique se o `SCRIPT_URL` no `app.js` está correto
2. Verifique se o script está implantado como Aplicativo da Web, "Qualquer pessoa"
3. Confira **Execuções** no Apps Script (barra lateral esquerda) — se tem erro recente, ele diz o motivo

### Lentidão

O servidor do Apps Script leva ~1 segundo pra responder, e o celular adiciona 0,5 a 2 segundos de rede. Se estiver **muito** mais lento que isso:

- Confirme que o warmup está rodando (Apps Script > Acionadores > warmup a cada 5 min)
- Teste com Wi-Fi vs 4G — se for só no 4G, é a rede, não o app
- Se persistir, cheque **Execuções** no Apps Script por anomalias

### "Nenhum e-mail configurado"

Vá na aba **Config** da planilha e preencha `email_1` e/ou `email_2`.

---

## Manutenção

### Coisas que rodam sozinhas

- Backup semanal (domingo ~3h)
- E-mail mensal (dia 1 ~9h)
- Warmup (a cada 5 min — mantém as respostas rápidas)

### Coisas que você faz manualmente

- **Nada no dia a dia.** O app cuida de tudo.
- **Ao editar `Code.gs`:** republicar uma **Nova versão** da implantação (Implantar > Gerenciar implantações > lápis > Nova versão).
- **Ao editar `app.js` / `style.css` / `service-worker.js`:** subir pro GitHub. Se quiser forçar atualização no celular, suba a versão do `CACHE_NAME` no `service-worker.js`.

### Categorias e orçamentos

Mudam direto na planilha, sem subir nada:

- **Categorias**: edite a aba "Categorias" (Bloco + Categoria)
- **Orçamentos**: edite a aba "Orçamentos" (Bloco + Categoria + Limite)
- **Avisos**: edite a aba "Config" (e-mails e chaves liga/desliga)

Depois de editar **Categorias** ou **Orçamentos**, rode **Financeiro > Limpar cache do app** pra forçar a próxima leitura a pegar os valores novos.

### Se a planilha crescer muito

O app lê a planilha com busca binária na coluna Data. Se você inserir uma linha **no meio** da planilha com data antiga, isso pode bagunçar a busca. **Evite inserir linhas manualmente no meio**. Se precisar corrigir algo, use o app ou edite uma linha existente.

### Histórico de versões do Google Sheets

Além do backup automático, o próprio Sheets guarda um histórico de versões. Em caso de catástrofe, **Arquivo > Histórico de versões** na planilha pode te salvar.

---

## Replicar o app para outra pessoa

Se alguém quiser usar o próprio app (com a própria planilha), o processo é:

1. **Duplicar a estrutura**: criar uma planilha em branco, colar o `Code.gs`, rodar as 5 configurações do menu Financeiro.
2. **Implantar o script** na nova planilha (Aplicativo da Web, Qualquer pessoa) e copiar a URL.
3. **Copiar a pasta do app** (HTML/CSS/JS), trocar o `SCRIPT_URL` no `app.js` pela nova URL.
4. **Personalizar** (opcional): `manifest.json` (nome), ícones, `QUEM_OPCOES` no `app.js`, `CATEGORIAS_PADRAO` no `app.js` e no `Code.gs`.
5. **Publicar num repositório novo** no GitHub Pages.
6. **Instalar no celular** da pessoa.

Leva cerca de 30 a 45 minutos pra primeira cópia, e 15 a 20 minutos por pessoa adicional.

**Aviso honesto:** o app só funciona pra quem **lança todo dia**. Se a pessoa não tem o hábito, a planilha fica abandonada em 2 semanas. Vale perguntar antes de replicar.

---

## Tecnologias

- **HTML, CSS, JavaScript puro** (sem frameworks)
- **PWA** (service worker + manifest) — instalável, funciona offline pra cache
- **Google Apps Script** — backend serverless
- **Google Sheets** — banco de dados
- **GitHub Pages** — hospedagem dos arquivos estáticos
- **Google Drive** — armazenamento dos backups

Nenhuma dependência externa. Nada de bibliotecas pesadas. Nenhum custo mensal.

---

## Licença

Projeto pessoal de Lu & Thi. Sem licença formal — use como referência se quiser, mas não é uma biblioteca pública.
```

---

## Como subir no GitHub

**Opção 1 — pelo navegador (mais simples):**

1. Abre o repositório do app no GitHub
2. Clica em **Add file > Create new file**
3. No campo de nome, digita `README.md` (exatamente assim, com maiúsculas)
4. Cola o conteúdo todo
5. Desce até o final e clica em **Commit new file**
6. Se já existir um `README.md` antigo, o GitHub vai substituir automaticamente

**Opção 2 — pelo computador:**

1. Salva o conteúdo num arquivo chamado `README.md` na raiz do repositório local
2. `git add README.md`
3. `git commit -m "Atualiza README com o estado atual do app"`
4. `git push`

