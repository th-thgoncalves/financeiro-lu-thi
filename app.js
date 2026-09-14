// ============================================================
// CONFIGURAÇÃO — troque pela URL do seu Google Apps Script
// ============================================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw6tvdUdsNQI5VZpdxQ43bMYf5bcCAa3rApESvEx4asN-f4IPKBoOlPTulXLUfG4EL0iQ/exec";

const QUEM_OPCOES = ["Lu", "Thi"];

const BLOCOS = [
  { id: "Despesa Fixa",     label: "Despesa Fixa",     classe: "tile-fixa",     hint: "Contas do mês a mês" },
  { id: "Despesa Variável", label: "Despesa Variável", classe: "tile-variavel", hint: "Gastos que mudam" },
  { id: "Cartão",           label: "Cartão",           classe: "tile-cartao",   hint: "Fatura do cartão" },
  { id: "Receita",          label: "Receita",          classe: "tile-receita",  hint: "Dinheiro que entra" },
];

const CATEGORIAS_PADRAO = {
  "Despesa Fixa": ["Luz","Água","Internet","Celular Thi","Celular Lu","Pensão","Transporte Ni","Ração","Areia"],
  "Despesa Variável": ["Facul","Conce","Shoppe","Cíntia","Marcio","Roça","Marco Celular","Rita Sec","Nilton (bateria)","Óculos","Facio","Jorge (projeto jiu-jitsu)","Fal","Regina (mãe)"],
  "Cartão": ["Cartão","Taylane","Fusca"],
  "Receita": ["Luciana","Thiago","Sabe","Sabe Thi","Dedeu","Hilmara"],
};

const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function mesAtualLabel() {
  const h = new Date();
  return `${MESES_PT[h.getMonth()]} de ${h.getFullYear()}`;
}
function gerarOpcoesDeMes() {
  const out = []; const h = new Date();
  for (let off = -6; off <= 6; off++) {
    const d = new Date(h.getFullYear(), h.getMonth() + off, 1);
    out.push(`${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`);
  }
  return out;
}
function formatarMoeda(v) {
  return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}
function parseValor(v) {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

// ============================================================
// Categorias e orçamentos remotos (com fallback)
// ============================================================
let CATEGORIAS_REMOTAS = null;
let categoriasPromise = null;
let ORCAMENTOS_REMOTOS = null;

function carregarCategorias() {
  if (categoriasPromise) return categoriasPromise;
  categoriasPromise = (async () => {
    try {
      if (SCRIPT_URL.includes("COLE_AQUI")) return null;
      const [catRes, orcRes] = await Promise.all([
        fetch(`${SCRIPT_URL}?categorias=1`).then((r) => r.json()).catch(() => null),
        fetch(`${SCRIPT_URL}?orcamentos=1`).then((r) => r.json()).catch(() => null),
      ]);
      if (catRes && catRes.status === "ok" && catRes.categorias) CATEGORIAS_REMOTAS = catRes.categorias;
      if (orcRes && orcRes.status === "ok" && orcRes.orcamentos) ORCAMENTOS_REMOTOS = orcRes.orcamentos;
    } catch (err) { /* segue com padrão */ }
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
// Estado
// ============================================================
const state = {
  screen: "home",
  step: 1,
  quem: null,
  bloco: null,
  categoria: null,
  categoriaOutro: "",
  valor: "",
  pago: null,
  observacao: "",
  resumoMes: null,

  editingId: null,   // quando != null, estamos editando um lançamento existente
  editingMeta: null, // { data, hora } originais (pra preservar ao editar)
};

const TOTAL_STEPS = 6;

const screenWrap = document.getElementById("screenWrap");
const backBtn = document.getElementById("backBtn");
const progressEl = document.getElementById("progress");
const resumoBtn = document.getElementById("resumoBtn");

resumoBtn.addEventListener("click", () => goResumo());
backBtn.addEventListener("click", () => {
  if (state.screen === "wizard") {
    if (state.step <= 1) goHome();
    else goToStep(state.step - 1);
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
  state.editingId = null;
  state.editingMeta = null;
}

function goHome()        { state.screen = "home"; render(); }
function goToStep(step)  { state.screen = "wizard"; state.step = step; render(); }
function goResumo()      { state.screen = "resumo"; if (!state.resumoMes) state.resumoMes = mesAtualLabel(); render(); }
function goRecentes()    { state.screen = "recentes"; render(); }

function updateProgress() {
  const isWizard = state.screen === "wizard" && state.step >= 1 && state.step <= TOTAL_STEPS;
  progressEl.style.display = isWizard ? "flex" : "none";
  progressEl.querySelectorAll(".dot").forEach((dot, i) => {
    const n = i + 1;
    dot.classList.toggle("active", isWizard && n === state.step);
    dot.classList.toggle("done",   isWizard && n < state.step);
  });
  backBtn.hidden = state.screen === "home" || (state.screen === "wizard" && state.step === 7);
}

// ============================================================
// Render
// ============================================================
function render() {
  updateProgress();
  screenWrap.innerHTML = "";
  if (state.screen === "home")      return renderHome();
  if (state.screen === "resumo")    return renderResumo();
  if (state.screen === "recentes")  return renderRecentes();
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

// ---------- Home ----------
function renderHome() {
  const el = screenEl(`
    <p class="screen-sub" style="margin-top:2px;">O que você quer fazer?</p>
    <div class="tile-grid" id="homeGrid" style="grid-template-columns: 1fr; gap: 14px; margin-top: 6px;"></div>
  `);
  const grid = el.querySelector("#homeGrid");

  const mk = (classe, titulo, hint, onClick) => {
    const b = document.createElement("button");
    b.className = `tile ${classe}`;
    b.innerHTML = `${titulo}<span class="tile-hint">${hint}</span>`;
    b.addEventListener("click", onClick);
    grid.appendChild(b);
  };

  mk("tile-fixa", "+ Novo lançamento", "Registrar um gasto ou recebimento", () => { resetState(); goToStep(1); });
  mk("tile-variavel", "📊 Ver resumo do mês", "Consultar totais por categoria", () => goResumo());
  mk("tile-receita", "🕘 Últimos lançamentos", "Ver, editar ou excluir os mais recentes", () => goRecentes());
}

// ---------- Passo 1 ----------
function renderQuem() {
  const el = screenEl(`
    <h2 class="screen-title">Quem está lançando?</h2>
    <p class="screen-sub">Escolha quem está registrando esse gasto ou recebimento.</p>
    <div class="tile-grid cols-2" id="quemGrid"></div>
  `);
  const grid = el.querySelector("#quemGrid");
  QUEM_OPCOES.forEach((nome) => {
    const b = document.createElement("button");
    b.className = "tile";
    b.textContent = nome;
    b.addEventListener("click", () => { state.quem = nome; goToStep(2); });
    grid.appendChild(b);
  });
}

// ---------- Passo 2 ----------
function renderBloco() {
  const el = screenEl(`
    <h2 class="screen-title">Que tipo de lançamento?</h2>
    <p class="screen-sub">Selecione o bloco da planilha onde isso entra.</p>
    <div class="tile-grid cols-2" id="blocoGrid"></div>
  `);
  const grid = el.querySelector("#blocoGrid");
  BLOCOS.forEach((bloco) => {
    const b = document.createElement("button");
    b.className = `tile ${bloco.classe}`;
    b.innerHTML = `${bloco.label}<span class="tile-hint">${bloco.hint}</span>`;
    b.addEventListener("click", () => {
      state.bloco = bloco.id;
      state.categoria = null;
      state.categoriaOutro = "";
      goToStep(3);
    });
    grid.appendChild(b);
  });
}

// ---------- Passo 3 ----------
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
    <div id="orcamentoAviso" style="margin-top:12px;"></div>
    <button class="btn-primary" id="catNext" style="margin-top:18px;" disabled>Continuar</button>
  `);

  const list = el.querySelector("#catList");
  const outroWrap = el.querySelector("#outroWrap");
  const outroInput = el.querySelector("#outroInput");
  const nextBtn = el.querySelector("#catNext");

  function checkReady() {
    const ok = state.categoria && (state.categoria !== "Outro" || state.categoriaOutro.trim().length > 0);
    nextBtn.disabled = !ok;
  }

  categoriasDoBloco(state.bloco).forEach((cat) => {
    const b = document.createElement("button");
    b.className = "cat-item";
    b.textContent = cat;
    if (cat === state.categoria) b.classList.add("selected");
    b.addEventListener("click", () => {
      state.categoria = cat;
      list.querySelectorAll(".cat-item").forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
      outroWrap.style.display = cat === "Outro" ? "block" : "none";
      if (cat === "Outro") outroInput.focus();
      checkReady();
    });
    list.appendChild(b);
  });

  if (state.categoria === "Outro" && state.categoriaOutro) {
    outroWrap.style.display = "block";
    outroInput.value = state.categoriaOutro;
  }
  outroInput.addEventListener("input", (e) => {
    state.categoriaOutro = e.target.value;
    checkReady();
  });
  nextBtn.addEventListener("click", () => goToStep(4));
  checkReady();
}

// ---------- Passo 4 ----------
function renderValor() {
  const categoriaLabel = state.categoria === "Outro" ? state.categoriaOutro : state.categoria;
  const el = screenEl(`
    <h2 class="screen-title">Qual o valor?</h2>
    <div class="value-context"><strong>${state.quem}</strong> · ${state.bloco} · ${categoriaLabel}</div>
    <div class="value-display">
      <div class="value-row">
        <span class="value-prefix">R$</span>
        <input type="text" inputmode="decimal" class="value-input" id="valorInput" placeholder="0,00" />
      </div>
    </div>
    <div id="orcamentoAvisoValor" style="margin-bottom:10px;"></div>
    <button class="btn-primary" id="valorNext" disabled>Continuar</button>
  `);
  const input = el.querySelector("#valorInput");
  const nextBtn = el.querySelector("#valorNext");
  input.value = state.valor;
  input.focus();
  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^0-9,\.]/g, "");
    state.valor = input.value;
    nextBtn.disabled = !(parseValor(input.value) > 0);
  });
  nextBtn.disabled = !(parseValor(state.valor) > 0);
  nextBtn.addEventListener("click", () => goToStep(5));
}

// ---------- Passo 5 ----------
function renderStatus() {
  const isReceita = state.bloco === "Receita";
  const pergunta = isReceita ? "Esse valor já entrou na conta?" : "Essa despesa já foi paga?";
  const sim = isReceita ? "Sim, já recebido" : "Sim, já paguei";
  const nao = isReceita ? "Ainda não" : "Ainda não paguei";

  const el = screenEl(`
    <h2 class="screen-title">${pergunta}</h2>
    <p class="screen-sub">Isso separa o que já é dinheiro de fato do que ainda está previsto.</p>
    <div class="tile-grid" id="statusGrid" style="gap:12px;"></div>
  `);
  const grid = el.querySelector("#statusGrid");

  const bs = document.createElement("button");
  bs.className = "tile tile-fixa";
  bs.textContent = sim;
  bs.addEventListener("click", () => { state.pago = true; goToStep(6); });
  grid.appendChild(bs);

  const bn = document.createElement("button");
  bn.className = "tile tile-cartao";
  bn.textContent = nao;
  bn.addEventListener("click", () => { state.pago = false; goToStep(6); });
  grid.appendChild(bn);
}

// ---------- Passo 6 ----------
function renderObservacao() {
  const categoriaLabel = state.categoria === "Outro" ? state.categoriaOutro : state.categoria;
  const valorFormatado = parseValor(state.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const isReceita = state.bloco === "Receita";
  const statusLabel = state.pago
    ? (isReceita ? "Recebido" : "Pago")
    : (isReceita ? "A receber" : "Pendente");
  const titulo = state.editingId ? "Confirmar alterações" : "Confirmar lançamento";
  const botao  = state.editingId ? "Salvar alterações" : "Salvar lançamento";

  const el = screenEl(`
    <h2 class="screen-title">${titulo}</h2>
    <div class="summary">
      <span class="chip"><strong>${state.quem}</strong></span>
      <span class="chip">${state.bloco}</span>
      <span class="chip">${categoriaLabel}</span>
      <span class="chip"><strong>R$ ${valorFormatado}</strong></span>
      <span class="chip">${statusLabel}</span>
    </div>
    <div id="duplicadoSlot"></div>
    <div id="orcamentoSlot"></div>
    <p class="field-label">Observação (opcional)</p>
    <textarea class="text-input" id="obsInput" rows="3" placeholder="Alguma anotação sobre esse lançamento..."></textarea>
    <div id="errorSlot" style="margin-top:16px;"></div>
    <button class="btn-primary" id="salvarBtn" style="margin-top:16px;">${botao}</button>
  `);
  const obs = el.querySelector("#obsInput");
  obs.value = state.observacao;
  obs.addEventListener("input", (e) => (state.observacao = e.target.value));

  const btn = el.querySelector("#salvarBtn");
  const errSlot = el.querySelector("#errorSlot");
  btn.addEventListener("click", () => salvar(btn, errSlot));

  // Só checa duplicado quando é lançamento novo
  if (!state.editingId) {
    verificarPossivelDuplicado(el.querySelector("#duplicadoSlot"), categoriaLabel);
  }
  verificarOrcamentoNoLancamento(el.querySelector("#orcamentoSlot"), categoriaLabel);
}

async function verificarPossivelDuplicado(container, categoriaLabel) {
  try {
    if (SCRIPT_URL.includes("COLE_AQUI")) return;
    const itens = await fetchRecentes(15);
    const hojeISO = new Date().toISOString().split("T")[0];
    const p = itens.find((it) => it.dataISO === hojeISO && it.bloco === state.bloco && it.categoria === categoriaLabel);
    if (p) {
      container.innerHTML = `
        <div class="error-banner" style="background: var(--gold-tint); border-color: var(--gold); color: var(--ink);">
          ⚠️ ${p.quem} já lançou <strong>${p.categoria}</strong> hoje às ${p.hora}
          (R$ ${formatarMoeda(p.valor)}). Se for o mesmo gasto, não precisa lançar de novo.
        </div>`;
    }
  } catch (e) {}
}

async function verificarOrcamentoNoLancamento(container, categoriaLabel) {
  try {
    if (SCRIPT_URL.includes("COLE_AQUI")) return;
    if (!ORCAMENTOS_REMOTOS) await carregarCategorias();
    if (!ORCAMENTOS_REMOTOS) return;
    const limite = ORCAMENTOS_REMOTOS[`${state.bloco}||${categoriaLabel}`];
    if (!limite) return;

    // Busca o total já lançado no mês atual nessa categoria
    const mesLabel = mesAtualLabel();
    const res = await fetch(`${SCRIPT_URL}?mes=${encodeURIComponent(mesLabel)}`).then((r) => r.json());
    if (!res || res.status !== "ok") return;
    const linha = (res.linhas || []).find((l) => l.bloco === state.bloco && l.categoria === categoriaLabel);
    const jaGasto = linha ? linha.valor : 0;
    const novoTotal = jaGasto + parseValor(state.valor);

    if (novoTotal > limite) {
      container.innerHTML = `
        <div class="error-banner" style="background: var(--brick-tint); border-color: var(--brick);">
          💸 Esse lançamento <strong>estoura o orçamento</strong> de <strong>${categoriaLabel}</strong>:
          já lançado R$ ${formatarMoeda(jaGasto)}, limite R$ ${formatarMoeda(limite)},
          novo total R$ ${formatarMoeda(novoTotal)}.
        </div>`;
    } else if (novoTotal > limite * 0.8) {
      container.innerHTML = `
        <div class="error-banner" style="background: var(--gold-tint); border-color: var(--gold); color: var(--ink);">
          ⚠️ Perto do limite de <strong>${categoriaLabel}</strong>:
          R$ ${formatarMoeda(novoTotal)} de R$ ${formatarMoeda(limite)}.
        </div>`;
    }
  } catch (e) {}
}

// ---------- Envio ----------
async function salvar(button, errorSlot) {
  errorSlot.innerHTML = "";
  button.disabled = true;
  const original = button.innerHTML;
  button.innerHTML = `<span class="spinner"></span> Salvando...`;

  const now = new Date();
  const dataISO = state.editingMeta?.dataISO || now.toISOString().split("T")[0];
  const hora    = state.editingMeta?.hora    || now.toTimeString().slice(0, 5);

  const payload = {
    action: state.editingId ? "editar" : undefined,
    id: state.editingId || undefined,
    data: dataISO,
    hora,
    quem: state.quem,
    bloco: state.bloco,
    categoria: state.categoria === "Outro" ? state.categoriaOutro : state.categoria,
    valor: parseValor(state.valor),
    pago: state.pago ? "Sim" : "Não",
    observacao: state.observacao,
  };

  try {
    if (SCRIPT_URL.includes("COLE_AQUI")) {
      throw new Error("O app ainda não foi conectado à planilha.");
    }
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.status !== "ok") throw new Error(json.message || "A planilha recusou o lançamento.");
    goToStep(7);
  } catch (err) {
    errorSlot.innerHTML = `<div class="error-banner">Não deu pra salvar: ${err.message}</div>`;
    button.disabled = false;
    button.innerHTML = original;
  }
}

// ---------- Sucesso ----------
function renderSucesso() {
  const foiEdicao = !!state.editingId;
  const el = screenEl(`
    <div class="success-wrap">
      <div class="success-mark">✓</div>
      <h2 class="success-title">${foiEdicao ? "Lançamento atualizado!" : "Lançamento salvo!"}</h2>
      <p class="success-detail">Já foi direto pra planilha.</p>
      <button class="btn-primary" id="novoBtn" style="margin-top:20px; width:100%;">
        ${foiEdicao ? "Novo lançamento" : "Lançar outro"}
      </button>
      <button class="btn-text" id="inicioBtn">Voltar ao início</button>
    </div>
  `);
  el.querySelector("#novoBtn").addEventListener("click", () => { resetState(); render(); });
  el.querySelector("#inicioBtn").addEventListener("click", () => { resetState(); goHome(); });
}

// ============================================================
// Resumo (com orçamento visual)
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
    opt.value = label; opt.textContent = label;
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
  container.innerHTML = `<div class="resumo-loading"><span class="spinner" style="border-color: rgba(43,36,32,0.15); border-top-color: var(--teal);"></span> &nbsp; Carregando...</div>`;
  try {
    if (SCRIPT_URL.includes("COLE_AQUI")) throw new Error("O app ainda não foi conectado à planilha.");
    const url = `${SCRIPT_URL}?mes=${encodeURIComponent(mesLabel)}`;
    const json = await fetch(url).then((r) => r.json());
    if (json.status !== "ok") throw new Error(json.message || "Falha ao consultar.");
    renderResumoResultado(container, json);
  } catch (err) {
    container.innerHTML = `<div class="error-banner">Não deu pra carregar: ${err.message}</div>`;
  }
}

function renderResumoResultado(container, d) {
  const saldoPos = d.saldo >= 0;
  const saldoRealPos = (d.saldoReal ?? d.saldo) >= 0;

  let html = `
    <div class="tile-grid cols-2" style="margin-bottom: 10px;">
      <div class="tile tile-receita" style="padding: 16px;">
        Entradas
        <span class="tile-hint" style="font-size:16px; color: var(--ink); font-weight:700;">R$ ${formatarMoeda(d.entradas)}</span>
        ${d.entradasPendente ? `<span class="tile-hint">R$ ${formatarMoeda(d.entradasPendente)} a receber</span>` : ""}
      </div>
      <div class="tile tile-cartao" style="padding: 16px;">
        Saídas
        <span class="tile-hint" style="font-size:16px; color: var(--ink); font-weight:700;">R$ ${formatarMoeda(d.saidas)}</span>
        ${d.saidasPendente ? `<span class="tile-hint">R$ ${formatarMoeda(d.saidasPendente)} pendente</span>` : ""}
      </div>
    </div>
    <div class="summary" style="margin-bottom: 18px;">
      <span class="chip" style="${saldoPos ? "" : "border-color: var(--brick); background: var(--brick-tint);"}">
        Saldo previsto: <strong style="margin-left:4px;">R$ ${formatarMoeda(d.saldo)}</strong>
      </span>
      ${d.saldoReal !== undefined ? `
      <span class="chip" style="${saldoRealPos ? "" : "border-color: var(--brick); background: var(--brick-tint);"}">
        Saldo real: <strong style="margin-left:4px;">R$ ${formatarMoeda(d.saldoReal)}</strong>
      </span>` : ""}
    </div>
  `;

  if (!d.linhas || d.linhas.length === 0) {
    html += `<p class="screen-sub">Nenhum lançamento registrado nesse mês ainda.</p>`;
  } else {
    let blocoAtual = null;
    html += `<div class="cat-list">`;
    d.linhas.forEach((l) => {
      if (l.bloco !== blocoAtual) {
        blocoAtual = l.bloco;
        html += `<p class="field-label" style="margin-top:14px;">${blocoAtual}</p>`;
      }
      const pendente = l.pendente || 0;
      const temLimite = l.limite != null && l.limite > 0;
      const pct = temLimite ? Math.min(100, Math.round((l.valor / l.limite) * 100)) : 0;
      const estourou = !!l.estourou;

      html += `
        <div class="cat-item" style="display:flex; flex-direction:column; gap:6px; ${estourou ? "border-color: var(--brick); background: var(--brick-tint);" : ""}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>${l.categoria}</span>
            <span style="text-align:right;">
              <strong${estourou ? ' style="color: var(--brick);"' : ""}>R$ ${formatarMoeda(l.valor)}</strong>
              ${temLimite ? `<br><span style="font-size:11px; color: var(--ink-soft);">limite R$ ${formatarMoeda(l.limite)}</span>` : ""}
              ${pendente > 0 ? `<br><span style="font-size:11px; color: var(--brick);">R$ ${formatarMoeda(pendente)} pendente</span>` : ""}
            </span>
          </div>
          ${temLimite ? `
            <div class="barra"><div class="barra-preenchida ${estourou ? "estourou" : (pct >= 80 ? "alerta" : "")}" style="width:${pct}%;"></div></div>
          ` : ""}
        </div>
      `;
    });
    html += `</div>`;
  }
  container.innerHTML = html;
}

// ============================================================
// Últimos lançamentos — editar + excluir
// ============================================================
async function fetchRecentes(limite) {
  const url = `${SCRIPT_URL}?recentes=1&limite=${limite || 10}`;
  const json = await fetch(url).then((r) => r.json());
  if (json.status !== "ok") throw new Error(json.message || "Falha ao consultar lançamentos.");
  return json.itens || [];
}

function renderRecentes() {
  const el = screenEl(`
    <h2 class="screen-title">Últimos lançamentos</h2>
    <p class="screen-sub">Toque em editar ou excluir para corrigir algo lançado por engano.</p>
    <div id="recentesLista"></div>
  `);
  carregarRecentes(el.querySelector("#recentesLista"));
}

async function carregarRecentes(container) {
  container.innerHTML = `<div class="resumo-loading"><span class="spinner" style="border-color: rgba(43,36,32,0.15); border-top-color: var(--teal);"></span> &nbsp; Carregando...</div>`;
  try {
    if (SCRIPT_URL.includes("COLE_AQUI")) throw new Error("O app ainda não foi conectado à planilha.");
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
      row.style.flexDirection = "column";
      row.style.gap = "8px";

      const statusTxt = item.pago ? "" : ` · <span style="color:var(--brick);">pendente</span>`;
      row.innerHTML = `
        <div>
          <strong>${item.categoria}</strong> — R$ ${formatarMoeda(item.valor)}<br>
          <span style="font-size:12px; color:var(--ink-soft);">${item.quem} · ${item.bloco} · ${item.data} ${item.hora}${statusTxt}</span>
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn-text" data-acao="editar"  style="color: var(--teal); padding: 6px 10px;">Editar</button>
          <button class="btn-text" data-acao="excluir" style="color: var(--brick); padding: 6px 10px;">Excluir</button>
        </div>
      `;
      row.querySelector('[data-acao="editar"]').addEventListener("click", () => iniciarEdicao(item));
      row.querySelector('[data-acao="excluir"]').addEventListener("click", () => excluirItem(item, container));
      list.appendChild(row);
    });
    container.appendChild(list);
  } catch (err) {
    container.innerHTML = `<div class="error-banner">Não deu pra carregar: ${err.message}</div>`;
  }
}

function iniciarEdicao(item) {
  resetState();
  state.editingId = item.id;
  state.editingMeta = { dataISO: item.dataISO, hora: item.hora };
  state.quem = item.quem;
  state.bloco = item.bloco;
  state.categoria = item.categoria;
  state.valor = String(item.valor).replace(".", ",");
  state.pago = !!item.pago;
  state.observacao = item.observacao || "";
  goToStep(6); // pula direto pra confirmação, já com tudo preenchido
}

async function excluirItem(item, container) {
  const ok = window.confirm(`Excluir o lançamento de R$ ${formatarMoeda(item.valor)} em "${item.categoria}" (${item.data})?`);
  if (!ok) return;
  try {
    const json = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "excluir", id: item.id }),
    }).then((r) => r.json());
    if (json.status !== "ok") throw new Error(json.message || "Falha ao excluir.");
    carregarRecentes(container);
  } catch (err) {
    alert(`Não deu pra excluir: ${err.message}`);
  }
}

// ============================================================
// Init
// ============================================================
render();
carregarCategorias();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
