# Financeiro - Lu & Thi

App simples para lançar gastos e receitas rapidinho pelo celular, que
alimenta uma aba nova ("Lançamentos") na planilha financeira de vocês —
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

## Categorias

As categorias do formulário estão fixas no início do `app.js`, no
objeto `CATEGORIAS`. Se um dia quiser adicionar, remover ou renomear
uma categoria, é só editar essa lista e subir o arquivo atualizado
para o GitHub — não precisa mexer no Apps Script.
