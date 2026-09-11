// ============================================================
// CONFIGURAÇÃO — troque pela URL do seu Google Apps Script
// (veja o passo a passo no README.md)
// ============================================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw6tvdUdsNQI5VZpdxQ43bMYf5bcCAa3rApESvEx4asN-f4IPKBoOlPTulXLUfG4EL0iQ/exec";

// ============================================================
// Dados fixos: quem lança e blocos
// ============================================================
const QUEM_OPCOES = ["Lu", "Thi"];

const BLOCOS = [
  { id: "Despesa Fixa", label: "Despesa Fixa", classe: "tile-fixa", hint: "Contas do mês a mês" },
  { id: "Despesa Variável", label: "Despesa Variável", classe: "tile-variavel", hint: "Gastos que mudam" },
  { id: "Cartão", label: "Cartão", classe: "tile-cartao", hint: "Fatura do cartão" },
  { id: "Receita", label: "Receita", classe: "tile-receita", hint: "Dinheiro que entra" },
];

// Usadas só como último recurso, se a planilha ainda não tiver a
// aba "Categorias" configurada, ou se o app estiver sem internet.
const CATEGORIAS_PADRAO = {
  "Despesa Fixa": [
    "Luz", "Água", "Internet", "Celular Thi", "Celular Lu",
    "Pensão", "Transporte Ni", "Ração", "Areia",
  ],
  "Despesa Variável": [
    "Facul", "Conce", "Shoppe", "Cíntia", "Marcio", "Roça",
    "Marco Celular", "Rita Sec", "Nilton (bateria)", "Óculos",
    "Facio", "Jorge (projeto jiu-jitsu)", "Fal", "Regina (mãe)",
  ],
  "Cartão": ["Cartão", "Taylane", "Fusca"],
  "Receita": ["Luciana", "Thiago", "Sabe", "Sabe Thi", "Dedeu", "Hilmara"],
};

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function mesAtualLabel() {
  const hoje = new Date();
  return `${MESES_PT[hoje.getMonth()]} de ${hoje.getFullYear()}`;
}

function gerarOpcoesDeMes() {
  const opcoes = [];
  const hoje = new Date();
  for (let offset = -6; offset <= 6; offset++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + offset, 1);
    opcoes.push(`${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`);
  }
  return opcoes;
}

function formatarMoeda(v) {
  return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

// ============================================================
// Categorias vindas da planilha (aba "Categorias"), com fallback
// ============================================================
let CATEGORIAS_REMOTAS = null;
let categoriasPromise = null;

function carregarCategorias() {
  if (categoriasPromise) return categoriasPromise;
  categoriasPromise = (async () => {
    try {
      if (SCRIPT_URL.includes("COLE_AQUI")) return null;
      const res = await fetch(`${SCRIPT_URL}?categorias=1`);
      const json = await res.json();
      if (json.status === "ok" && json.categorias) {
        CATEGORIAS_REMOTAS = json.categorias;
      }
    } catch (err) {
      // sem internet ou script fora do ar — segue com o padrão
    }
    return CATEGORIAS_REMOTAS;
  })();
  return categoriasPromise;
}

function categoriasDoBloco(bloco) {
  const base = (CATEGORIAS_REMOTAS && CATEGORIAS_REMOTAS[bloco]) || CATEGORIAS_PADRAO[bloco] || [];
  const lista = base.slice();
  if (!lista.includes("Outro")) lista.push("Outro");
  return lista;
}

// ============================================================
// Estado do formulário
// ============================================================
const state = {
  screen: "home", // "home" | "wizard" | "resumo" | "recentes"
  step: 1,
  quem: null,
  bloco: null,
  categoria: null,
  categoriaOutro: "",
  valor: "",
  pago: null,
  observacao: "",
  resumoMes: null,
};

const TOTAL_STEPS = 6;

const screenWrap = document.getElementById("screenWrap");
const backBtn = document.getElementById("backBtn");
const progressEl = document.getElementById("progress");
const resumoBtn = document.getElementById("resumoBtn");

resumoBtn.addEventListener("click", () => goResumo());

backBtn.addEventListener("click", () => {
  if (state.screen === "wizard") {
    if (state.step <= 1) {
      goHome();
    } else {
      goToStep(state.step - 1);
    }
  } else if (state.screen === "resumo" || state.screen === "recentes") {
    goHome();
  }
});

function resetState() {
  state.step = 1;
  state.quem = null;
  state.bloco = null;
  state.categoria = null;
  state.categoriaOutro = "";
  state.valor = "";
  state.pago = null;
  state.observacao = "";
}

function goHome() {
  state.screen = "home";
  render();
}

function goToStep(step) {
  state.screen = "wizard";
  state.step = step;
  render();
}

function goResumo() {
  state.screen = "resumo";
  if (!state.resumoMes) state.resumoMes = mesAtualLabel();
  render();
}

function goRecentes() {
  state.screen = "recentes";
  render();
}

function updateProgress() {
  const isWizardSteps = state.screen === "wizard" && state.step >= 1 && state.step <= TOTAL_STEPS;
  progressEl.style.display = isWizardSteps ? "flex" : "none";

  const dots = progressEl.querySelectorAll(".dot");
  dots.forEach((dot, i) => {
    const n = i + 1;
    dot.classList.toggle("active", isWizardSteps && n === state.step);
    dot.classList.toggle("done", isWizardSteps && n < state.step);
  });

  backBtn.hidden = state.screen === "home" || (state.screen === "wizard" && state.step === 7);
}

// ============================================================
// Renderização de cada passo
// ============================================================
function render() {
  updateProgress();
  screenWrap.innerHTML = "";

  if (state.screen === "home") {
    renderHome();
    return;
  }

  if (state.screen === "resumo") {
    renderResumo();
    return;
  }

  if (state.screen === "recentes") {
    renderRecentes();
    return;
  }

  switch (state.step) {
    case 1: renderQuem(); break;
    case 2: renderBloco(); break;
    case 3: renderCategoria(); break;
    case 4: renderValor(); break;
    case 5: renderStatus(); break;
    case 6: renderObservacao(); break;
    case 7: renderSucesso(); break;
  }
}

function screenEl(html) {
  const div = document.createElement("div");
  div.className = "screen";
  div.innerHTML = html;
  screenWrap.appendChild(div);
  return div;
}

// ---------- Início: escolher o que fazer ----------
function renderHome() {
  const el = screenEl(`
    <p class="screen-sub" style="margin-top:2px;">O que você quer fazer?</p>
    <div class="tile-grid" id="homeGrid" style="grid-template-columns: 1fr; gap: 14px; margin-top: 6px;"></div>
  `);

  const grid = el.querySelector("#homeGrid");

  const btnLancar = document.createElement("button");
  btnLancar.className = "tile tile-fixa";
  btnLancar.innerHTML = `+ Novo lançamento<span class="tile-hint">Registrar um gasto ou recebimento</span>`;
  btnLancar.addEventListener("click", () => {
    resetState();
    goToStep(1);
  });
  grid.appendChild(btnLancar);

  const btnResumo = document.createElement("button");
  btnResumo.className = "tile tile-variavel";
  btnResumo.innerHTML = `📊 Ver resumo do mês<span class="tile-hint">Consultar totais por categoria</span>`;
  btnResumo.addEventListener("click", () => goResumo());
  grid.appendChild(btnResumo);

  const btnRecentes = document.createElement("button");
  btnRecentes.className = "tile tile-receita";
  btnRecentes.innerHTML = `🕘 Últimos lançamentos<span class="tile-hint">Ver e corrigir os mais recentes</span>`;
  btnRecentes.addEventListener("click", () => goRecentes());
  grid.appendChild(btnRecentes);
}

// ---------- Passo 1: Quem ----------
function renderQuem() {
  const el = screenEl(`
    <h2 class="screen-title">Quem está lançando?</h2>
    <p class="screen-sub">Escolha quem está registrando esse gasto ou recebimento.</p>
    <div class="tile-grid cols-2" id="quemGrid"></div>
  `);

  const grid = el.querySelector("#quemGrid");
  QUEM_OPCOES.forEach((nome) => {
    const btn = document.createElement("button");
    btn.className = "tile";
    btn.innerHTML = `${nome}`;
    btn.addEventListener("click", () => {
      state.quem = nome;
      goToStep(2);
    });
    grid.appendChild(btn);
  });
}

// ---------- Passo 2: Bloco ----------
function renderBloco() {
  const el = screenEl(`
    <h2 class="screen-title">Que tipo de lançamento?</h2>
    <p class="screen-sub">Selecione o bloco da planilha onde isso entra.</p>
    <div class="tile-grid cols-2" id="blocoGrid"></div>
  `);

  const grid = el.querySelector("#blocoGrid");
  BLOCOS.forEach((bloco) => {
    const btn = document.createElement("button");
    btn.className = `tile ${bloco.classe}`;
    btn.innerHTML = `${bloco.label}<span class="tile-hint">${bloco.hint}</span>`;
    btn.addEventListener("click", () => {
      state.bloco = bloco.id;
      state.categoria = null;
      state.categoriaOutro = "";
      goToStep(3);
    });
    grid.appendChild(btn);
  });
}

// ---------- Passo 3: Categoria ----------
function renderCategoria() {
  if (!CATEGORIAS_REMOTAS && !SCRIPT_URL.includes("COLE_AQUI")) {
    const el = screenEl(`
      <div class="resumo-loading">
        <span class="spinner" style="border-color: rgba(43,36,32,0.15); border-top-color: var(--teal);"></span>
        &nbsp; Carregando categorias...
      </div>
    `);
    carregarCategorias().then(() => {
      if (state.screen === "wizard" && state.step === 3) render();
    });
    return;
  }

  const el = screenEl(`
    <h2 class="screen-title">Qual categoria?</h2>
    <p class="screen-sub">Bloco: <strong>${state.bloco}</strong></p>
    <div class="cat-list" id="catList"></div>
    <div id="outroWrap" style="margin-top:14px; display:none;">
      <p class="field-label">Digite o nome da categoria</p>
      <input type="text" class="text-input" id="outroInput" placeholder="Ex: Presente de aniversário" />
    </div>
    <button class="btn-primary" id="catNext" style="margin-top:18px;" disabled>Continuar</button>
  `);

  const list = el.querySelector("#catList");
  const outroWrap = el.querySelector("#outroWrap");
  const outroInput = el.querySelector("#outroInput");
  const nextBtn = el.querySelector("#catNext");

  function checkReady() {
    const ready =
      state.categoria &&
      (state.categoria !== "Outro" || state.categoriaOutro.trim().length > 0);
    nextBtn.disabled = !ready;
  }

  categoriasDoBloco(state.bloco).forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "cat-item";
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      state.categoria = cat;
      list.querySelectorAll(".cat-item").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      outroWrap.style.display = cat === "Outro" ? "block" : "none";
      if (cat === "Outro") outroInput.focus();
      checkReady();
    });
    list.appendChild(btn);
  });

  outroInput.addEventListener("input", (e) => {
    state.categoriaOutro = e.target.value;
    checkReady();
  });

  nextBtn.addEventListener("click", () => goToStep(4));
}

// ---------- Passo 4: Valor ----------
function renderValor() {
  const categoriaLabel = state.categoria === "Outro" ? state.categoriaOutro : state.categoria;
  const el = screenEl(`
    <h2 class="screen-title">Qual o valor?</h2>
    <div class="value-context">
      <strong>${state.quem}</strong> · ${state.bloco} · ${categoriaLabel}
    </div>
    <div class="value-display">
      <div class="value-row">
        <span class="value-prefix">R$</span>
        <input
          type="text"
          inputmode="decimal"
          class="value-input"
          id="valorInput"
          placeholder="0,00"
          autofocus
        />
      </div>
    </div>
    <button class="btn-primary" id="valorNext" disabled>Continuar</button>
  `);

  const input = el.querySelector("#valorInput");
  const nextBtn = el.querySelector("#valorNext");

  input.value = state.valor;
  input.focus();

  input.addEventListener("input", () => {
    // aceita apenas números e uma vírgula/ponto decimal
    let v = input.value.replace(/[^0-9,\.]/g, "");
    input.value = v;
    state.valor = v;
    const numeric = parseValor(v);
    nextBtn.disabled = !(numeric > 0);
  });

  nextBtn.addEventListener("click", () => goToStep(5));
}

function parseValor(v) {
  if (!v) return 0;
  const normalized = v.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

// ---------- Passo 5: Já foi pago/recebido? ----------
function renderStatus() {
  const isReceita = state.bloco === "Receita";
  const pergunta = isReceita ? "Esse valor já entrou na conta?" : "Essa despesa já foi paga?";
  const opcaoSim = isReceita ? "Sim, já recebido" : "Sim, já paguei";
  const opcaoNao = isReceita ? "Ainda não" : "Ainda não paguei";

  const el = screenEl(`
    <h2 class="screen-title">${pergunta}</h2>
    <p class="screen-sub">Isso ajuda a diferenciar o que já é dinheiro de fato do que ainda está previsto.</p>
    <div class="tile-grid" id="statusGrid" style="gap:12px;"></div>
  `);

  const grid = el.querySelector("#statusGrid");

  const btnSim = document.createElement("button");
  btnSim.className = "tile tile-fixa";
  btnSim.textContent = opcaoSim;
  btnSim.addEventListener("click", () => {
    state.pago = true;
    goToStep(6);
  });
  grid.appendChild(btnSim);

  const btnNao = document.createElement("button");
  btnNao.className = "tile tile-cartao";
  btnNao.textContent = opcaoNao;
  btnNao.addEventListener("click", () => {
    state.pago = false;
    goToStep(6);
  });
  grid.appendChild(btnNao);
}

// ---------- Passo 6: Observação + salvar ----------
function renderObservacao() {
  const categoriaLabel = state.categoria === "Outro" ? state.categoriaOutro : state.categoria;
  const valorFormatado = parseValor(state.valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
  });
  const isReceita = state.bloco === "Receita";
  const statusLabel = state.pago
    ? (isReceita ? "Recebido" : "Pago")
    : (isReceita ? "A receber" : "Pendente");

  const el = screenEl(`
    <h2 class="screen-title">Confirmar lançamento</h2>
    <div class="summary">
      <span class="chip"><strong>${state.quem}</strong></span>
      <span class="chip">${state.bloco}</span>
      <span class="chip">${categoriaLabel}</span>
      <span class="chip"><strong>R$ ${valorFormatado}</strong></span>
      <span class="chip">${statusLabel}</span>
    </div>
    <div id="duplicadoSlot"></div>
    <p class="field-label">Observação (opcional)</p>
    <textarea class="text-input" id="obsInput" rows="3" placeholder="Alguma anotação sobre esse lançamento..."></textarea>
    <div id="errorSlot" style="margin-top:16px;"></div>
    <button class="btn-primary" id="salvarBtn" style="margin-top:16px;">Salvar lançamento</button>
  `);

  const obsInput = el.querySelector("#obsInput");
  obsInput.value = state.observacao;
  obsInput.addEventListener("input", (e) => (state.observacao = e.target.value));

  const salvarBtn = el.querySelector("#salvarBtn");
  const errorSlot = el.querySelector("#errorSlot");

  salvarBtn.addEventListener("click", () => salvar(salvarBtn, errorSlot));

  verificarPossivelDuplicado(el.querySelector("#duplicadoSlot"), categoriaLabel);
}

// Avisa (sem bloquear) se já existe um lançamento parecido hoje.
async function verificarPossivelDuplicado(container, categoriaLabel) {
  try {
    if (SCRIPT_URL.includes("COLE_AQUI")) return;
    const itens = await fetchRecentes(15);
    const hojeISO = new Date().toISOString().split("T")[0];
    const parecido = itens.find(
      (it) => it.dataISO === hojeISO && it.bloco === state.bloco && it.categoria === categoriaLabel
    );
    if (parecido) {
      container.innerHTML = `
        <div class="error-banner" style="background: var(--gold-tint); border-color: var(--gold); color: var(--ink);">
          ⚠️ ${parecido.quem} já lançou <strong>${parecido.categoria}</strong> hoje às ${parecido.hora}
          (R$ ${formatarMoeda(parecido.valor)}). Se for o mesmo gasto, não precisa lançar de novo.
        </div>
      `;
    }
  } catch (err) {
    // consulta silenciosa — se falhar, simplesmente não mostra o aviso
  }
}

// ---------- Envio para a planilha ----------
async function salvar(button, errorSlot) {
  errorSlot.innerHTML = "";
  button.disabled = true;
  const originalContent = button.innerHTML;
  button.innerHTML = `<span class="spinner"></span> Salvando...`;

  const now = new Date();
  const payload = {
    data: now.toISOString().split("T")[0], // AAAA-MM-DD
    hora: now.toTimeString().slice(0, 5), // HH:MM
    quem: state.quem,
    bloco: state.bloco,
    categoria: state.categoria === "Outro" ? state.categoriaOutro : state.categoria,
    valor: parseValor(state.valor),
    pago: state.pago ? "Sim" : "Não",
    observacao: state.observacao,
  };

  try {
    if (SCRIPT_URL.includes("COLE_AQUI")) {
      throw new Error(
        "O app ainda não foi conectado à planilha. Veja o README para colar a URL do Apps Script."
      );
    }

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (json.status !== "ok") {
      throw new Error(json.message || "A planilha recusou o lançamento.");
    }

    goToStep(7);
  } catch (err) {
    errorSlot.innerHTML = `<div class="error-banner">Não deu pra salvar: ${err.message}. Verifique sua internet e tente de novo.</div>`;
    button.disabled = false;
    button.innerHTML = originalContent;
  }
}

// ---------- Passo 7: Sucesso ----------
function renderSucesso() {
  const el = screenEl(`
    <div class="success-wrap">
      <div class="success-mark">✓</div>
      <h2 class="success-title">Lançamento salvo!</h2>
      <p class="success-detail">Já foi direto pra planilha. Pode fechar o app ou lançar outra coisa.</p>
      <button class="btn-primary" id="novoBtn" style="margin-top:20px; width:100%;">Novo lançamento</button>
      <button class="btn-text" id="inicioBtn">Voltar ao início</button>
    </div>
  `);
  el.querySelector("#novoBtn").addEventListener("click", () => {
    resetState();
    render();
  });
  el.querySelector("#inicioBtn").addEventListener("click", () => goHome());
}

// ============================================================
// Resumo do mês
// ============================================================
function renderResumo() {
  const el = screenEl(`
    <h2 class="screen-title">Resumo do mês</h2>
    <p class="field-label">Mês</p>
    <select class="mes-select" id="mesSelect" style="margin-bottom:18px;"></select>
    <div id="resumoResultado"></div>
  `);

  const select = el.querySelector("#mesSelect");
  gerarOpcoesDeMes().forEach((label) => {
    const opt = document.createElement("option");
    opt.value = label;
    opt.textContent = label;
    if (label === state.resumoMes) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => {
    state.resumoMes = select.value;
    carregarResumo(el.querySelector("#resumoResultado"), state.resumoMes);
  });

  carregarResumo(el.querySelector("#resumoResultado"), state.resumoMes);
}

async function carregarResumo(container, mesLabel) {
  container.innerHTML = `
    <div class="resumo-loading">
      <span class="spinner" style="border-color: rgba(43,36,32,0.15); border-top-color: var(--teal);"></span>
      &nbsp; Carregando...
    </div>
  `;

  try {
    if (SCRIPT_URL.includes("COLE_AQUI")) {
      throw new Error("O app ainda não foi conectado à planilha.");
    }

    const url = `${SCRIPT_URL}?mes=${encodeURIComponent(mesLabel)}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.status !== "ok") {
      throw new Error(json.message || "Não foi possível consultar o resumo.");
    }

    renderResumoResultado(container, json);
  } catch (err) {
    container.innerHTML = `<div class="error-banner">Não deu pra carregar: ${err.message}</div>`;
  }
}

function renderResumoResultado(container, dados) {
  const saldoPositivo = dados.saldo >= 0;
  const saldoRealPositivo = (dados.saldoReal !== undefined ? dados.saldoReal : dados.saldo) >= 0;

  let html = `
    <div class="tile-grid cols-2" style="margin-bottom: 10px;">
      <div class="tile tile-receita" style="padding: 16px;">
        Entradas
        <span class="tile-hint" style="font-size:16px; color: var(--ink); font-weight:700;">R$ ${formatarMoeda(dados.entradas)}</span>
        ${dados.entradasPendente ? `<span class="tile-hint">R$ ${formatarMoeda(dados.entradasPendente)} a receber</span>` : ""}
      </div>
      <div class="tile tile-cartao" style="padding: 16px;">
        Saídas
        <span class="tile-hint" style="font-size:16px; color: var(--ink); font-weight:700;">R$ ${formatarMoeda(dados.saidas)}</span>
        ${dados.saidasPendente ? `<span class="tile-hint">R$ ${formatarMoeda(dados.saidasPendente)} pendente</span>` : ""}
      </div>
    </div>
    <div class="summary" style="margin-bottom: 18px;">
      <span class="chip" style="${saldoPositivo ? "" : "border-color: var(--brick); background: var(--brick-tint);"}">
        Saldo previsto: <strong style="margin-left:4px;">R$ ${formatarMoeda(dados.saldo)}</strong>
      </span>
      ${dados.saldoReal !== undefined ? `
      <span class="chip" style="${saldoRealPositivo ? "" : "border-color: var(--brick); background: var(--brick-tint);"}">
        Saldo real (já efetivado): <strong style="margin-left:4px;">R$ ${formatarMoeda(dados.saldoReal)}</strong>
      </span>` : ""}
    </div>
  `;

  if (!dados.linhas || dados.linhas.length === 0) {
    html += `<p class="screen-sub">Nenhum lançamento registrado nesse mês ainda.</p>`;
  } else {
    let blocoAtual = null;
    html += `<div class="cat-list">`;
    dados.linhas.forEach((linha) => {
      if (linha.bloco !== blocoAtual) {
        blocoAtual = linha.bloco;
        html += `<p class="field-label" style="margin-top:14px;">${blocoAtual}</p>`;
      }
      const pendente = linha.pendente || 0;
      html += `
        <div class="cat-item" style="display:flex; justify-content:space-between; align-items:center;">
          <span>${linha.categoria}</span>
          <span style="text-align:right;">
            <strong>R$ ${formatarMoeda(linha.valor)}</strong>
            ${pendente > 0 ? `<br><span style="font-size:11px; color: var(--brick);">R$ ${formatarMoeda(pendente)} pendente</span>` : ""}
          </span>
        </div>
      `;
    });
    html += `</div>`;
  }

  container.innerHTML = html;
}

// ============================================================
// Últimos lançamentos (ver / excluir)
// ============================================================
async function fetchRecentes(limite) {
  const url = `${SCRIPT_URL}?recentes=1&limite=${limite || 10}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== "ok") throw new Error(json.message || "Não foi possível consultar os lançamentos.");
  return json.itens || [];
}

function renderRecentes() {
  const el = screenEl(`
    <h2 class="screen-title">Últimos lançamentos</h2>
    <p class="screen-sub">Toque em excluir se algum tiver sido lançado por engano.</p>
    <div id="recentesLista"></div>
  `);

  carregarRecentes(el.querySelector("#recentesLista"));
}

async function carregarRecentes(container) {
  container.innerHTML = `
    <div class="resumo-loading">
      <span class="spinner" style="border-color: rgba(43,36,32,0.15); border-top-color: var(--teal);"></span>
      &nbsp; Carregando...
    </div>
  `;

  try {
    if (SCRIPT_URL.includes("COLE_AQUI")) {
      throw new Error("O app ainda não foi conectado à planilha.");
    }
    const itens = await fetchRecentes(10);

    if (itens.length === 0) {
      container.innerHTML = `<p class="resumo-vazio">Nenhum lançamento ainda.</p>`;
      return;
    }

    container.innerHTML = "";
    const list = document.createElement("div");
    list.className = "cat-list";

    itens.forEach((item) => {
      const row = document.createElement("div");
      row.className = "cat-item";
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.gap = "10px";

      const statusTxt = item.pago ? "" : ` · <span style="color:var(--brick);">pendente</span>`;
      row.innerHTML = `
        <span style="flex:1;">
          <strong>${item.categoria}</strong> — R$ ${formatarMoeda(item.valor)}<br>
          <span style="font-size:12px; color:var(--ink-soft);">${item.quem} · ${item.bloco} · ${item.data} ${item.hora}${statusTxt}</span>
        </span>
        <button class="btn-text" style="color: var(--brick); padding: 6px 10px;">Excluir</button>
      `;

      row.querySelector("button").addEventListener("click", () => excluirItem(item, container));
      list.appendChild(row);
    });

    container.appendChild(list);
  } catch (err) {
    container.innerHTML = `<div class="error-banner">Não deu pra carregar: ${err.message}</div>`;
  }
}

async function excluirItem(item, container) {
  const confirmar = window.confirm(
    `Excluir o lançamento de R$ ${formatarMoeda(item.valor)} em "${item.categoria}" (${item.data})?`
  );
  if (!confirmar) return;

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "excluir", id: item.id }),
    });
    const json = await res.json();
    if (json.status !== "ok") throw new Error(json.message || "Não foi possível excluir.");
    carregarRecentes(container);
  } catch (err) {
    alert(`Não deu pra excluir: ${err.message}`);
  }
}

// ============================================================
// Inicialização
// ============================================================
render();
carregarCategorias();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
