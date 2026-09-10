// ============================================================
// CONFIGURAÇÃO — troque pela URL do seu Google Apps Script
// (veja o passo a passo no README.md)
// ============================================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw6tvdUdsNQI5VZpdxQ43bMYf5bcCAa3rApESvEx4asN-f4IPKBoOlPTulXLUfG4EL0iQ/exec";

// ============================================================
// Dados fixos: quem lança e categorias por bloco
// ============================================================
const QUEM_OPCOES = ["Lu", "Thi"];

const BLOCOS = [
  { id: "Despesa Fixa", label: "Despesa Fixa", classe: "tile-fixa", hint: "Contas do mês a mês" },
  { id: "Despesa Variável", label: "Despesa Variável", classe: "tile-variavel", hint: "Gastos que mudam" },
  { id: "Cartão", label: "Cartão", classe: "tile-cartao", hint: "Fatura do cartão" },
  { id: "Receita", label: "Receita", classe: "tile-receita", hint: "Dinheiro que entra" },
];

const CATEGORIAS = {
  "Despesa Fixa": [
    "Luz", "Água", "Internet", "Celular Thi", "Celular Lu",
    "Pensão", "Transporte Ni", "Ração", "Areia",
  ],
  "Despesa Variável": [
    "Facul", "Conce", "Shoppe", "Cíntia", "Marcio", "Roça",
    "Marco Celular", "Rita Sec", "Nilton (bateria)", "Óculos",
    "Facio", "Jorge (projeto jiu-jitsu)", "Fal", "Regina (mãe)",
    "Outro",
  ],
  "Cartão": ["Cartão", "Taylane", "Fusca"],
  "Receita": ["Luciana", "Thiago", "Sabe", "Sabe Thi", "Dedeu", "Hilmara"],
};

// ============================================================
// Estado do formulário
// ============================================================
const state = {
  step: 1,
  quem: null,
  bloco: null,
  categoria: null,
  categoriaOutro: "",
  valor: "",
  observacao: "",
};

const TOTAL_STEPS = 5;

const screenWrap = document.getElementById("screenWrap");
const backBtn = document.getElementById("backBtn");
const progressEl = document.getElementById("progress");

backBtn.addEventListener("click", () => goToStep(state.step - 1));

function resetState() {
  state.step = 1;
  state.quem = null;
  state.bloco = null;
  state.categoria = null;
  state.categoriaOutro = "";
  state.valor = "";
  state.observacao = "";
}

function goToStep(step) {
  state.step = step;
  render();
}

function updateProgress() {
  const dots = progressEl.querySelectorAll(".dot");
  dots.forEach((dot, i) => {
    const n = i + 1;
    dot.classList.toggle("active", n === state.step);
    dot.classList.toggle("done", n < state.step);
  });
  backBtn.hidden = state.step === 1;
  progressEl.style.display = state.step > TOTAL_STEPS ? "none" : "flex";
}

// ============================================================
// Renderização de cada passo
// ============================================================
function render() {
  updateProgress();
  screenWrap.innerHTML = "";

  switch (state.step) {
    case 1: renderQuem(); break;
    case 2: renderBloco(); break;
    case 3: renderCategoria(); break;
    case 4: renderValor(); break;
    case 5: renderObservacao(); break;
    case 6: renderSucesso(); break;
  }
}

function screenEl(html) {
  const div = document.createElement("div");
  div.className = "screen";
  div.innerHTML = html;
  screenWrap.appendChild(div);
  return div;
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

  (CATEGORIAS[state.bloco] || []).forEach((cat) => {
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

// ---------- Passo 5: Observação + salvar ----------
function renderObservacao() {
  const categoriaLabel = state.categoria === "Outro" ? state.categoriaOutro : state.categoria;
  const valorFormatado = parseValor(state.valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
  });

  const el = screenEl(`
    <h2 class="screen-title">Confirmar lançamento</h2>
    <div class="summary">
      <span class="chip"><strong>${state.quem}</strong></span>
      <span class="chip">${state.bloco}</span>
      <span class="chip">${categoriaLabel}</span>
      <span class="chip"><strong>R$ ${valorFormatado}</strong></span>
    </div>
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

    goToStep(6);
  } catch (err) {
    errorSlot.innerHTML = `<div class="error-banner">Não deu pra salvar: ${err.message}. Verifique sua internet e tente de novo.</div>`;
    button.disabled = false;
    button.innerHTML = originalContent;
  }
}

// ---------- Passo 6: Sucesso ----------
function renderSucesso() {
  const el = screenEl(`
    <div class="success-wrap">
      <div class="success-mark">✓</div>
      <h2 class="success-title">Lançamento salvo!</h2>
      <p class="success-detail">Já foi direto pra planilha. Pode fechar o app ou lançar outra coisa.</p>
      <button class="btn-primary" id="novoBtn" style="margin-top:20px; width:100%;">Novo lançamento</button>
    </div>
  `);
  el.querySelector("#novoBtn").addEventListener("click", () => {
    resetState();
    render();
  });
}

// ============================================================
// Inicialização
// ============================================================
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
