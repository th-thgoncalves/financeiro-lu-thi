# Financeiro - Lu & Thi

App simples para lançar gastos e receitas rapidinho pelo celular, que
alimenta uma aba nova ("Lançamentos") na planilha financeira —
sem mexer nas abas mensais que já existem.

## O que tem aqui

```
financeiro-app/
├── index.html          → tela do app
├── style.css            → visual do app
├── app.js                → lógica (formulário, envio pra planilha)
├── manifest.json        → configuração do "instalar na tela inicial"
├── service-worker.js    → deixa o app instalável
├── icons/                → ícones do app
└── google-apps-script/
    └── Code.gs           → script que recebe os dados na planilha
```

## Passo 1 — Configurar o Google Apps Script

1. Abra a planilha **PLANILHA FINANCEIRA - LU E THI**.
2. No menu, clique em **Extensões > Apps Script**.
3. Apague o conteúdo que aparecer por padrão e cole todo o conteúdo
   do arquivo `google-apps-script/Code.gs`.
4. Clique no ícone de disquete para salvar.
5. Clique em **Implantar > Nova implantação**.
6. Em "Selecionar tipo", clique na engrenagem e escolha
   **Aplicativo da Web**.
7. Configure:
   - Executar como: **Eu (seu e-mail)**
   - Quem pode acessar: **Qualquer pessoa**
8. Clique em **Implantar**.
9. O Google vai pedir autorização — clique em **Autorizar acesso**,
   escolha sua conta, e se aparecer uma tela de aviso "app não
   verificado", clique em **Avançado** e depois em **Acessar
   Financeiro Lu&Thi (não seguro)**. Isso é normal: o aviso aparece
   porque o script é seu, feito por você, e o Google só confia
   automaticamente em apps de empresas grandes.
10. Copie a **URL do aplicativo da Web** (termina em `/exec`). Você
    vai usar essa URL no próximo passo.

Se um dia editar o `Code.gs`, lembre-se: só salvar não atualiza o
app publicado. É preciso ir em **Implantar > Gerenciar implantações**,
clicar no ícone de lápis e escolher **Nova versão**.

## Passo 2 — Conectar o app à planilha

1. Abra o arquivo `app.js`.
2. Na primeira linha de código, troque:
   ```js
   const SCRIPT_URL = "COLE_AQUI_A_URL_DO_SEU_APP_SCRIPT";
   ```
   pela URL que você copiou no passo anterior, entre aspas.

## Passo 3 — Publicar no GitHub Pages

1. Crie um repositório novo no GitHub (ex: `financeiro-lu-thi`),
   separado do repositório do site do casamento.
2. Suba todos os arquivos desta pasta **exceto** a pasta
   `google-apps-script` (essa fica só na sua planilha, não precisa
   ir para o site).
3. Vá em **Settings > Pages** do repositório.
4. Em "Branch", escolha `main` (ou a branch onde estão os arquivos)
   e a pasta `/root`. Salve.
5. Em alguns minutos, o GitHub mostra o link do site (algo como
   `https://seuusuario.github.io/financeiro-lu-thi/`).

## Passo 4 — Instalar no celular

1. Abra o link do GitHub Pages no navegador do celular (Chrome no
   Android, Safari no iPhone).
2. Toque no menu do navegador e escolha **Adicionar à tela inicial**
   (Android) ou **Adicionar à Tela de Início** (iPhone).
3. Pronto — o ícone "L&T" aparece na tela como um app normal.

Repita esse passo no celular de cada um de vocês.

## Testando

Depois de conectar a URL, abra o app, faça um lançamento de teste
(ex: R$ 1,00) e confira se uma aba nova **"Lançamentos"** apareceu na
planilha com a linha certinha. Depois é só apagar a linha de teste.

## Passo 5 — Ativar o Resumo automático

O script também mantém uma aba **"Resumo"**, com um menu pra escolher
o mês e ver o total por Bloco/Categoria daquele mês — sem precisar
digitar nada nos blocos antigos.

1. Depois de colar a versão mais recente do `Code.gs` e publicar uma
   **nova versão** da implantação (Implantar > Gerenciar implantações
   > ícone de lápis > Nova versão), volte pra planilha e aperte F5
   pra recarregar a página.
2. Vai aparecer um menu novo **"Financeiro"** na barra de menus, do
   lado de "Ajuda".
3. Clique em **Financeiro > Configurar Resumo**. Na primeira vez, o
   Google pode pedir autorização de novo — é normal, autorize.
4. Isso cria a aba "Resumo", já com o mês atual selecionado e a
   tabela preenchida.
5. Pra ver outro mês, é só clicar na célula amarela (B2) e escolher
   outro mês na lista.

Se algum dia a tabela parecer "travada" ou desatualizada, use
**Financeiro > Atualizar Resumo agora** pra forçar um recálculo.

## Passo 6 — Resumo direto no celular

O app agora também mostra esse resumo sem precisar abrir a planilha.
Na tela inicial do app, tem um botão **"Ver resumo do mês"** (e
também o ícone 📊 no topo, em qualquer tela). É só escolher o mês
num menu e o app busca os totais direto na planilha.

Isso depende do `doGet` do script (que já responde com os dados),
então garanta que você publicou a **versão mais recente** do
`Code.gs` (Implantar > Gerenciar implantações > lápis > Nova
versão) — a mesma URL de sempre continua funcionando.

Depois, suba os arquivos atualizados (`index.html`, `style.css`,
`app.js`) para o repositório no GitHub. Se o app já estava instalado
na tela inicial do celular, pode ser preciso fechá-lo e abrir de novo
(ou aguardar alguns segundos) pra ele buscar a versão nova.

## Passo 6 — Ver o resumo pelo celular

O app agora tem uma tela inicial com duas opções: "Novo lançamento"
e "Ver resumo do mês". A segunda consulta os totais direto na
planilha e mostra tudo no próprio celular, sem precisar abrir o
Google Sheets.

Pra isso funcionar, é só garantir que as duas atualizações mais
recentes estejam ativas:
1. `Code.gs` — cole a versão mais nova e publique uma **nova versão**
   da implantação (mesma URL de sempre).
2. `app.js` — suba a versão mais nova pro GitHub (substitui o arquivo
   antigo no repositório).

Não precisa mexer na URL do `SCRIPT_URL` de novo — ela continua a
mesma, só o conteúdo dos arquivos mudou.

## Passo 7 — Controle de pago/recebido

Agora o formulário pergunta se o gasto já foi pago (ou se a receita já
entrou), e isso é salvo numa nova coluna **"Pago"** na aba
Lançamentos ("Sim" ou "Não"). O Resumo (tanto na planilha quanto no
app) passa a mostrar, além do total, quanto já é dinheiro de fato e
quanto ainda está pendente — e um "Saldo real" ao lado do "Saldo
previsto".

Isso só vale pra lançamentos feitos a partir de agora. Lançamentos
antigos, feitos antes dessa atualização, não têm essa coluna
preenchida — o script trata isso como "pendente" por padrão. Se
quiser, você pode editar a célula da coluna Pago direto na aba
Lançamentos pra corrigir algum lançamento antigo específico.

Depois de colar essa versão do `Code.gs`, publique uma **nova
versão** de novo (Implantar > Gerenciar implantações > lápis > Nova
versão), e suba os arquivos atualizados (`index.html`, `app.js`)
pro GitHub.

## Passo 8 — Três melhorias novas

Essa versão trouxe três coisas novas, todas já incluídas no
`Code.gs` e no `app.js` atualizados:

**1. Categorias editáveis pela planilha.** Agora existe uma aba
**"Categorias"** (crie clicando em **Financeiro > Configurar
Categorias**, uma vez só) com duas colunas: Bloco e Categoria. Pra
adicionar, remover ou renomear uma categoria, edite essa aba
diretamente — não precisa mais editar o `app.js` nem subir nada pro
GitHub. O app busca essa lista toda vez que abre a tela de
categoria (e se não conseguir, por falta de internet por exemplo,
usa uma lista padrão de reserva). A opção "Outro" continua sempre
disponível em todos os blocos, automaticamente.

**2. Últimos lançamentos, com exclusão pelo celular.** Na tela
inicial do app, tem uma opção nova **"Últimos lançamentos"**, que
mostra os 10 mais recentes com um botão de excluir em cada um. Não
precisa mais abrir a planilha pra corrigir um erro de digitação.

**3. Aviso de lançamento parecido no mesmo dia.** Se alguém lançar
uma categoria que já foi lançada hoje (no mesmo bloco), o app mostra
um aviso na tela de confirmação, antes de salvar — só um alerta, não
impede de salvar, é você quem decide se é duplicado ou não.

Sobre a exclusão: por baixo dos panos, cada lançamento agora recebe
um código único (coluna **"ID"**, a primeira da aba Lançamentos).
Se você já tinha lançamentos de antes dessa atualização, não se
preocupe — na primeira vez que o script rodar depois de atualizado,
ele adiciona essa coluna sozinho e gera um código pra cada
lançamento antigo automaticamente.

## Categorias

Desde o Passo 8, as categorias moram na aba **"Categorias"** da
planilha, não mais no código. `CATEGORIAS_PADRAO`, dentro do
`app.js` e do `Code.gs`, é só uma lista de reserva, usada apenas se
o app não conseguir buscar a aba (por exemplo, sem internet).
