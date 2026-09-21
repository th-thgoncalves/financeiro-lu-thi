// ============================================================
// CONFIGURAÇÃO
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

const LIMITE_RECENTES = 30;
const MESES_FUTUROS = 12;
const SKELETON_DELAY_MS = 150;

const CORES_BLOCO = {
  "Despesa Fixa":     "#3D6B66",
  "Despesa Variável": "#B98A3D",
  "Cartão":           "#A9503D",
  "Receita":          "#2C4E4A",
  "Outro":            "#8C8274",
};

// Cache em memória (Bloco C)
const CACHE_TTL_MS = 30 * 1000;
const cacheMemoria = new Map();

function cacheGet(chave) {
  const entry = cacheMemoria.get(chave);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { cacheMemoria.delete(chave); return null; }
  return entry.valor;
}
function cachePut(chave, valor) {
  cacheMemoria.set(chave, { ts: Date.now(), valor });
}
function cacheInvalida(prefixo) {
  for (const k of cacheMemoria.keys()) {
    if (!prefixo || k.startsWith(prefixo)) cacheMemoria.delete(k);
  }
}

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
function gerarMesesLancamento() {
  const out = []; const h = new Date();
  for (let off = 0; off <= MESES_FUTUROS; off++) {
    const d = new Date(h.getFullYear(), h.getMonth() + off, 1);
    out.push({
      label: `${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`,
      ano: d.getFullYear(), mesIndex: d.getMonth(), offset: off,
    });
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
function hojeISO() { return new Date().toISOString().split("T")[0]; }

function montarDataAlvo(mesObj) {
  const hoje = new Date();
  const diaDesejado = hoje.getDate();
  const ultimoDia = new Date(mesObj.ano, mesObj.mesIndex + 1, 0).getDate();
  const dia = Math.min(diaDesejado, ultimoDia);
  const d = new Date(mesObj.ano, mesObj.mesIndex, dia);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function gerarDatasParcelas(mesBase, quantidade) {
  const hoje = new Date();
  const diaDesejado = hoje.getDate();
  const datas = [];
  for (let i = 0; i < quantidade; i++) {
    const totalMes = mesBase.mesIndex + i;
    const ano = mesBase.ano + Math.floor(totalMes / 12);
    const mesIndex = ((totalMes % 12) + 12) % 12;
    const ultimoDia = new Date(ano, mesIndex + 1, 0).getDate();
    const dia = Math.min(diaDesejado, ultimoDia);
    datas.push(`${ano}-${String(mesIndex + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
  }
  return datas;
}
function ehMesFuturo(dataISO) {
  if (!dataISO) return false;
  const [y, m] = dataISO.split("-").map(Number);
  const hoje = new Date();
  return (y > hoje.getFullYear()) || (y === hoje.getFullYear() && (m - 1) > hoje.getMonth());
}
function calcularParcelas(valorTotal, quantidade) {
  const totalCentavos = Math.round(valorTotal * 100);
  const baseCentavos = Math.floor(totalCentavos / quantidade);
  const resto = totalCentavos - baseCentavos * quantidade;
  const valores = [];
  for (let i = 0; i < quantidade; i++) {
    valores.push((baseCentavos + (i === quantidade - 1 ? resto : 0)) / 100);
  }
  return valores;
}

// ============================================================
// SKELETON HELPERS
// ============================================================
async function comSkeleton(container, htmlSkeleton, fetchFn, renderFn, aposRender) {
  const timer = setTimeout(() => {
    container.innerHTML = htmlSkeleton();
  }, SKELETON_DELAY_MS);

  try {
    const dados = await fetchFn();
    clearTimeout(timer);
    container.innerHTML = renderFn(dados);
    if (typeof aposRender === "function") {
      queueMicrotask(() => aposRender(dados));
    }
  } catch (err) {
    clearTimeout(timer);
    container.innerHTML = `<div class="error-banner">Não deu pra carregar: ${err.message}</div>`;
  }
}

function htmlSkeletonCartoes(n) {
  let html = "";
  for (let i = 0; i < (n || 5); i++) {
    html += `
      <div class="skeleton-card">
        <div class="linha-1">
          <div class="skeleton titulo"></div>
          <div class="skeleton valor"></div>
        </div>
        <div class="linha-2">
          <div class="skeleton meta"></div>
        </div>
        <div class="linha-3">
          <div class="skeleton acao"></div>
          <div class="skeleton acao"></div>
        </div>
      </div>
    `;
  }
  return `<div class="cat-list">${html}</div>`;
}

function htmlSkeletonCategorias(n) {
  let html = "";
  for (let i = 0; i < (n || 6); i++) {
    html += `<div class="skeleton-cat"><div class="skeleton cat-nome"></div></div>`;
  }
  return `<div class="cat-list">${html}</div>`;
}

function htmlSkeletonResumo() {
  let linhas = "";
  for (let i = 0; i < 6; i++) {
    linhas += `
      <div class="skeleton-linha">
        <div class="skeleton nome"></div>
        <div class="skeleton val"></div>
      </div>
    `;
  }
  return `
    <div class="skeleton-resumo-topo">
      <div class="skeleton-card-grande">
        <div class="skeleton label"></div>
        <div class="skeleton valor"></div>
      </div>
      <div class="skeleton-card-grande">
        <div class="skeleton label"></div>
        <div class="skeleton valor"></div>
      </div>
    </div>
    <div class="skeleton-chips">
      <div class="skeleton chip-skeleton"></div>
    </div>
    <div class="skeleton-bloco-titulo skeleton"></div>
    ${linhas}
  `;
}

// ============================================================
// Categorias / orçamentos remotos
// ============================================================
let CATEGORIAS_REMOTAS = null;
let categoriasPromise = null;
let ORCAMENTOS_REMOTOS = null;

function carregarCategorias() {
  if (categoriasPromise) return categoriasPromise;
  categoriasPromise = (async () => {
    try {
      if (SCRIPT_URL.includes("COLE_AQUI")) return null;
      const url = `${SCRIPT_URL}?categorias=1&orcamentos=1`;
      const json = await fetch(url).then((r) => r.json()).catch(() => null);
      if (json && json.status === "ok") {
        if (json.categorias) CATEGORIAS_REMOTAS = json.categorias;
        if (json.orcamentos) ORCAMENTOS_REMOTOS = json.orcamentos;
      }
    } catch (err) {}
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
  quem: null, bloco: null, categoria: null, categoriaOutro: "",
  valor: "",
  parcelado: null, quantidadeParcelas: null,
  mesLancamento: null,
  pago: null, observacao: "",
  resumoMes: null,
  editingId: null, editingMeta: null,
  editingEscopo: null,
  editingIds: null,
  recentesMes: "todos", recentesBusca: "", recentesIniciado: false,
};
const TOTAL_STEPS = 8;

const screenWrap = document.getElementById("screenWrap");
const backBtn = document.getElementById("backBtn");
const progressEl = document.getElementById("progress");
const casaBtn = document.getElementById("casaBtn");

if (casaBtn) {
  casaBtn.addEventListener("click", () => {
    if (state.screen === "wizard" && state.step < 10) {
      const ok = window.confirm("Descartar este lançamento e voltar ao início?");
      if (!ok) return;
    }
    resetState();
    goHome();
  });
}

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
  state.quem = null; state.bloco = null; state.categoria = null; state.categoriaOutro = "";
  state.valor = "";
  state.parcelado = null; state.quantidadeParcelas = null;
  state.mesLancamento = null;
  state.pago = null; state.observacao = "";
  state.editingId = null; state.editingMeta = null;
  state.editingEscopo = null;
  state.editingIds = null;
}

function goHome()       { state.screen = "home"; render(); }
function goToStep(step) { state.screen = "wizard"; state.step = step; render(); }
function goResumo()     { state.screen = "resumo"; if (!state.resumoMes) state.resumoMes = mesAtualLabel(); render(); }
function goRecentes()   { state.screen = "recentes"; render(); }

function updateProgress() {
  const isWizard = state.screen === "wizard" && state.step >= 1 && state.step <= TOTAL_STEPS;
  progressEl.style.display = isWizard ? "flex" : "none";
  progressEl.querySelectorAll(".dot").forEach((dot, i) => {
    const n = i + 1;
    dot.classList.toggle("active", isWizard && n === state.step);
    dot.classList.toggle("done",   isWizard && n < state.step);
  });
  backBtn.hidden = state.screen === "home" || (state.screen === "wizard" && state.step === 9);
  if (casaBtn) casaBtn.disabled = state.screen === "home";
}

function render() {
  updateProgress();
  screenWrap.innerHTML = "";
  removerBotaoTopo();
  if (state.screen === "home")      return renderHome();
  if (state.screen === "resumo")    return renderResumo();
  if (state.screen === "recentes")  return renderRecentes();
  switch (state.step) {
    case 1: renderQuem(); break;
    case 2: renderBloco(); break;
    case 3: renderCategoria(); break;
    case 4: renderValor(); break;
    case 5: renderParcelado(); break;
    case 6: renderQuantidadeParcelas(); break;
    case 7: renderMesLancamento(); break;
    case 8: renderStatus(); break;
    case 9: renderObservacao(); break;
    case 10: renderSucesso(); break;
  }
}

function screenEl(html) {
  const div = document.createElement("div");
  div.className = "screen";
  div.innerHTML = html;
  screenWrap.appendChild(div);
  return div;
}

// ============================================================
// Botão voltar ao topo
// ============================================================
let botaoTopoEl = null;

function removerBotaoTopo() {
  if (botaoTopoEl) { botaoTopoEl.remove(); botaoTopoEl = null; }
  window.removeEventListener("scroll", handlerScrollTopo);
}
function handlerScrollTopo() {
  if (!botaoTopoEl) return;
  if (window.scrollY > 300) botaoTopoEl.classList.add("visivel");
  else botaoTopoEl.classList.remove("visivel");
}
function instalarBotaoTopo() {
  removerBotaoTopo();
  const btn = document.createElement("button");
  btn.className = "btn-topo";
  btn.setAttribute("aria-label", "Voltar ao topo");
  btn.textContent = "↑";
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  document.body.appendChild(btn);
  botaoTopoEl = btn;
  window.addEventListener("scroll", handlerScrollTopo, { passive: true });
  handlerScrollTopo();
}

// ============================================================
// Home
// ============================================================
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
  mk("tile-receita", "🕘 Últimos lançamentos", "Ver, editar, marcar como pago ou excluir", () => goRecentes());
  mk("tile-backup", "💾 Fazer backup agora", "Salvar uma cópia da planilha no Drive", () => fazerBackupAgora());
}

async function fazerBackupAgora() {
  const ok = window.confirm("Fazer um backup da planilha agora? Vai criar uma cópia no seu Google Drive.");
  if (!ok) return;
  try {
    if (SCRIPT_URL.includes("COLE_AQUI")) throw new Error("App não conectado à planilha.");
    const json = await fetch(`${SCRIPT_URL}?backup=1`, { keepalive: true }).then((r) => r.json());
    if (json.status !== "ok") throw new Error(json.message || "Falha no backup.");
    alert(json.message || "Backup concluído.");
  } catch (err) { alert(`Não deu pra fazer o backup: ${err.message}`); }
}

// ============================================================
// Wizard
// ============================================================
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
      state.bloco = bloco.id; state.categoria = null; state.categoriaOutro = "";
      goToStep(3);
    });
    grid.appendChild(b);
  });
}

function renderCategoria() {
  if (!CATEGORIAS_REMOTAS && !SCRIPT_URL.includes("COLE_AQUI")) {
    screenEl(`
      <h2 class="screen-title">Qual categoria?</h2>
      <p class="screen-sub">Bloco: <strong>${state.bloco}</strong></p>
      <div id="catSkeletonWrap">${htmlSkeletonCategorias(6)}</div>
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
  outroInput.addEventListener("input", (e) => { state.categoriaOutro = e.target.value; checkReady(); });
  nextBtn.addEventListener("click", () => goToStep(4));
  checkReady();
}

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
    <p class="field-label" style="text-align:center; margin-top:8px;">Valor total, não o da parcela.</p>
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

function renderParcelado() {
  const el = screenEl(`
    <h2 class="screen-title">É parcelado?</h2>
    <p class="screen-sub">Se for uma compra (ou recebimento) dividida em várias vezes, escolha "Sim".</p>
    <div class="tile-grid" id="parcGrid" style="gap:12px;"></div>
  `);
  const grid = el.querySelector("#parcGrid");

  const bs = document.createElement("button");
  bs.className = "tile tile-variavel";
  bs.innerHTML = `Sim, é parcelado<span class="tile-hint">Vou dividir em 2x ou mais</span>`;
  bs.addEventListener("click", () => {
    state.parcelado = true;
    state.quantidadeParcelas = state.quantidadeParcelas || 2;
    goToStep(6);
  });
  grid.appendChild(bs);

  const bn = document.createElement("button");
  bn.className = "tile tile-fixa";
  bn.innerHTML = `Não, é à vista<span class="tile-hint">Valor único, cai em um mês só</span>`;
  bn.addEventListener("click", () => {
    state.parcelado = false; state.quantidadeParcelas = null;
    goToStep(7);
  });
  grid.appendChild(bn);
}

function renderQuantidadeParcelas() {
  const valorTotal = parseValor(state.valor);
  const el = screenEl(`
    <h2 class="screen-title">Em quantas vezes?</h2>
    <p class="screen-sub">Total de <strong>R$ ${formatarMoeda(valorTotal)}</strong> dividido em:</p>
    <div class="parcelas-grid" id="parcGrid"></div>
    <div id="parcResumo"></div>
    <button class="btn-primary" id="parcNext" disabled>Continuar</button>
  `);
  const grid = el.querySelector("#parcGrid");
  const resumo = el.querySelector("#parcResumo");
  const nextBtn = el.querySelector("#parcNext");

  const opcoes = [2,3,4,5,6,7,8,9,10,12,15,18,21,24];
  opcoes.forEach((n) => {
    const b = document.createElement("button");
    b.className = "parcela-btn";
    b.textContent = `${n}x`;
    if (state.quantidadeParcelas === n) b.classList.add("selected");
    b.addEventListener("click", () => {
      state.quantidadeParcelas = n;
      grid.querySelectorAll(".parcela-btn").forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
      atualizarResumo();
    });
    grid.appendChild(b);
  });
  function atualizarResumo() {
    if (!state.quantidadeParcelas) { resumo.innerHTML = ""; nextBtn.disabled = true; return; }
    const valores = calcularParcelas(valorTotal, state.quantidadeParcelas);
    const primeiro = valores[0];
    const ultimo = valores[valores.length - 1];
    const texto = primeiro === ultimo
      ? `${state.quantidadeParcelas}x de <strong>R$ ${formatarMoeda(primeiro)}</strong>`
      : `${state.quantidadeParcelas}x de <strong>R$ ${formatarMoeda(primeiro)}</strong> (última: <strong>R$ ${formatarMoeda(ultimo)}</strong>)`;
    resumo.innerHTML = `<div class="parcela-resumo">${texto}</div>`;
    nextBtn.disabled = false;
  }
  atualizarResumo();
  nextBtn.addEventListener("click", () => goToStep(7));
}

function renderMesLancamento() {
  const isReceita = state.bloco === "Receita";
  const parcelado = state.parcelado === true;
  const titulo = parcelado ? "Quando vence a primeira parcela?"
    : (isReceita ? "Quando você vai receber?" : "Quando é pra pagar?");
  const sub = parcelado
    ? "Normalmente no mês seguinte (fatura do cartão). Escolha conforme o caso."
    : (isReceita ? "Escolha o mês em que esse valor deve entrar na conta."
                 : "Escolha o mês em que essa despesa deve ser paga.");

  const el = screenEl(`
    <h2 class="screen-title">${titulo}</h2>
    <p class="screen-sub">${sub}</p>
    <div class="mes-opcoes" id="mesOpcoes"></div>
    <button class="btn-primary" id="mesNext" style="margin-top:18px;" disabled>Continuar</button>
  `);
  const container = el.querySelector("#mesOpcoes");
  const nextBtn = el.querySelector("#mesNext");
  const meses = gerarMesesLancamento();

  if (!state.mesLancamento) {
    state.mesLancamento = parcelado ? meses[1] : meses[0];
  }
  meses.forEach((mes) => {
    const b = document.createElement("button");
    b.className = "mes-opcao";
    if (state.mesLancamento && state.mesLancamento.label === mes.label) b.classList.add("selected");
    const tag = mes.offset === 0 ? "mês atual" : `+${mes.offset} ${mes.offset === 1 ? "mês" : "meses"}`;
    b.innerHTML = `<span>${mes.label}</span><span class="mes-tag">${tag}</span>`;
    b.addEventListener("click", () => {
      state.mesLancamento = mes;
      container.querySelectorAll(".mes-opcao").forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
      nextBtn.disabled = false;
    });
    container.appendChild(b);
  });
  nextBtn.disabled = !state.mesLancamento;
  nextBtn.addEventListener("click", () => goToStep(8));
}

function renderStatus() {
  const isReceita = state.bloco === "Receita";
  const parcelado = state.parcelado === true;
  const pergunta = isReceita ? "Esse valor já entrou na conta?" : "Essa despesa já foi paga?";
  const sim = isReceita ? "Sim, já recebido" : "Sim, já paguei";
  const nao = isReceita ? "Ainda não" : "Ainda não paguei";
  const futuro = state.mesLancamento && state.mesLancamento.offset > 0;

  let aviso = "";
  if (state.editingEscopo && (state.editingEscopo === "todas" || state.editingEscopo === "estaEFuturas")) {
    aviso = `<div class="error-banner" style="background: var(--gold-tint); border-color: var(--gold); color: var(--ink);">
      Você está editando <strong>${state.editingIds ? state.editingIds.length : ""} parcelas</strong> em grupo. O status abaixo será aplicado a <strong>todas</strong>.
    </div>`;
  } else if (parcelado) {
    aviso = `<div class="error-banner" style="background: var(--gold-tint); border-color: var(--gold); color: var(--ink);">
      No parcelamento, as parcelas futuras entram automaticamente como <strong>pendentes</strong>. Só a primeira usa a resposta abaixo.
    </div>`;
  } else if (futuro) {
    aviso = `<div class="error-banner" style="background: var(--gold-tint); border-color: var(--gold); color: var(--ink);">
      Você escolheu um mês futuro. Normalmente ainda não foi ${isReceita ? "recebido" : "pago"}, mas confirme abaixo.
    </div>`;
  }

  const el = screenEl(`
    <h2 class="screen-title">${pergunta}</h2>
    <p class="screen-sub">Isso separa o que já é dinheiro de fato do que ainda está previsto.</p>
    ${aviso}
    <div class="tile-grid" id="statusGrid" style="gap:12px;"></div>
  `);
  const grid = el.querySelector("#statusGrid");
  const bs = document.createElement("button");
  bs.className = "tile tile-fixa";
  bs.textContent = sim;
  bs.addEventListener("click", () => { state.pago = true; goToStep(9); });
  grid.appendChild(bs);

  const bn = document.createElement("button");
  bn.className = "tile tile-cartao";
  bn.textContent = nao;
  bn.addEventListener("click", () => { state.pago = false; goToStep(9); });
  grid.appendChild(bn);
}

function renderObservacao() {
  const categoriaLabel = state.categoria === "Outro" ? state.categoriaOutro : state.categoria;
  const valorFormatado = parseValor(state.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const isReceita = state.bloco === "Receita";
  const statusLabel = state.pago
    ? (isReceita ? "Recebido" : "Pago")
    : (isReceita ? "A receber" : "Pendente");
  const titulo = state.editingId ? "Confirmar alterações" : "Confirmar lançamento";
  const botao  = state.editingId ? "Salvar alterações" : "Salvar lançamento";

  const mesLabel = state.mesLancamento ? state.mesLancamento.label : mesAtualLabel();
  const mesTag = state.mesLancamento && state.mesLancamento.offset > 0
    ? ` · <em style="color: var(--gold);">${mesLabel}</em>` : "";

  let parcelaTag = "";
  if (state.parcelado && state.quantidadeParcelas) {
    const valores = calcularParcelas(parseValor(state.valor), state.quantidadeParcelas);
    const primeiro = valores[0];
    const ultimo = valores[valores.length - 1];
    const detalhe = primeiro === ultimo
      ? `${state.quantidadeParcelas}x de R$ ${formatarMoeda(primeiro)}`
      : `${state.quantidadeParcelas}x de R$ ${formatarMoeda(primeiro)} (última R$ ${formatarMoeda(ultimo)})`;
    parcelaTag = `<span class="chip"><strong>${detalhe}</strong></span>`;
  }

  let escopoTag = "";
  if (state.editingEscopo && state.editingIds) {
    const mapEscopo = {
      "uma": "Só esta parcela",
      "todas": `Todas as ${state.editingIds.length} parcelas`,
      "estaEFuturas": `Esta e as ${state.editingIds.length - 1} seguintes`,
      "cancelarRestante": `Cancelar daqui pra frente (${state.editingIds.length} parcelas)`,
    };
    escopoTag = `<span class="chip" style="background: var(--gold-tint); border-color: var(--gold);"><strong>${mapEscopo[state.editingEscopo]}</strong></span>`;
  }

  const el = screenEl(`
    <h2 class="screen-title">${titulo}</h2>
    <div class="summary">
      <span class="chip"><strong>${state.quem}</strong></span>
      <span class="chip">${state.bloco}</span>
      <span class="chip">${categoriaLabel}</span>
      <span class="chip"><strong>R$ ${valorFormatado}</strong></span>
      ${parcelaTag}
      ${escopoTag}
      <span class="chip">${statusLabel}${mesTag}</span>
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

  if (!state.editingId) verificarPossivelDuplicado(el.querySelector("#duplicadoSlot"), categoriaLabel);
  if (!state.editingId) verificarOrcamentoNoLancamento(el.querySelector("#orcamentoSlot"), categoriaLabel);
}

async function verificarPossivelDuplicado(container, categoriaLabel) {
  try {
    if (SCRIPT_URL.includes("COLE_AQUI")) return;
    const itens = await fetchRecentes({ limite: 15 });
    const p = itens.find((it) => it.dataISO === hojeISO() && it.bloco === state.bloco && it.categoria === categoriaLabel);
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
    const mesLabel = state.mesLancamento ? state.mesLancamento.label : mesAtualLabel();
    const json = await fetchResumo(mesLabel);
    if (!json || json.status !== "ok") return;
    const linha = (json.linhas || []).find((l) => l.bloco === state.bloco && l.categoria === categoriaLabel);
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

// ============================================================
// Salvar
// ============================================================
async function salvar(button, errorSlot) {
  errorSlot.innerHTML = "";
  button.disabled = true;
  const original = button.innerHTML;
  button.innerHTML = `<span class="spinner"></span> Salvando...`;

  const now = new Date();
  const hora = state.editingMeta?.hora || now.toTimeString().slice(0, 5);
  const categoriaFinal = state.categoria === "Outro" ? state.categoriaOutro : state.categoria;

  try {
    if (SCRIPT_URL.includes("COLE_AQUI")) throw new Error("O app ainda não foi conectado à planilha.");

    if (state.editingEscopo && state.editingIds && state.editingIds.length > 0) {
      if (state.editingEscopo === "cancelarRestante") {
        const json = await fetch(SCRIPT_URL, {
          method: "POST", headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ action: "cancelarParcelamento", ids: state.editingIds }),
        }).then((r) => r.json());
        if (json.status !== "ok") throw new Error(json.message || "Falha ao cancelar parcelamento.");
        cacheInvalida();
        goToStep(10); return;
      }

      const payload = {
        action: "editarLote",
        ids: state.editingIds,
        quem: state.quem,
        bloco: state.bloco,
        categoria: categoriaFinal,
        valor: parseValor(state.valor),
        pago: state.pago ? "Sim" : "Não",
        observacao: state.observacao,
      };
      const json = await fetch(SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());
      if (json.status !== "ok") throw new Error(json.message || "Falha ao editar em lote.");
      cacheInvalida();
      goToStep(10); return;
    }

    if (state.editingId) {
      const dataISO = state.mesLancamento ? montarDataAlvo(state.mesLancamento) : state.editingMeta.dataISO;
      const payload = {
        action: "editar", id: state.editingId, data: dataISO, hora,
        quem: state.quem, bloco: state.bloco, categoria: categoriaFinal,
        valor: parseValor(state.valor), pago: state.pago ? "Sim" : "Não",
        observacao: state.observacao, parcela: state.editingMeta?.parcela || "",
      };
      const json = await fetch(SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());
      if (json.status !== "ok") throw new Error(json.message || "A planilha recusou a alteração.");
      cacheInvalida();
      goToStep(10); return;
    }

    if (state.parcelado && state.quantidadeParcelas > 1) {
      const valorTotal = parseValor(state.valor);
      const valores = calcularParcelas(valorTotal, state.quantidadeParcelas);
      const datas = gerarDatasParcelas(state.mesLancamento, state.quantidadeParcelas);
      const itens = datas.map((dataISO, i) => {
        const numero = i + 1;
        const pagoParcela = (numero === 1 && state.pago) ? "Sim" : "Não";
        return {
          data: dataISO, hora, quem: state.quem, bloco: state.bloco,
          categoria: categoriaFinal, valor: valores[i],
          pago: pagoParcela, observacao: state.observacao,
          parcela: `${numero}/${state.quantidadeParcelas}`,
        };
      });
      const json = await fetch(SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "criarLote", itens }),
      }).then((r) => r.json());
      if (json.status !== "ok") throw new Error(json.message || "A planilha recusou o parcelamento.");
      cacheInvalida();
      goToStep(10); return;
    }

    const dataISO = state.mesLancamento ? montarDataAlvo(state.mesLancamento) : now.toISOString().split("T")[0];
    const payload = {
      data: dataISO, hora, quem: state.quem, bloco: state.bloco,
      categoria: categoriaFinal, valor: parseValor(state.valor),
      pago: state.pago ? "Sim" : "Não", observacao: state.observacao, parcela: "",
    };
    const json = await fetch(SCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    }).then((r) => r.json());
    if (json.status !== "ok") throw new Error(json.message || "A planilha recusou o lançamento.");
    cacheInvalida();
    goToStep(10);
  } catch (err) {
    errorSlot.innerHTML = `<div class="error-banner">Não deu pra salvar: ${err.message}</div>`;
    button.disabled = false;
    button.innerHTML = original;
  }
}

function renderSucesso() {
  const foiEdicao = !!state.editingId || !!state.editingEscopo;
  const foiParcelado = state.parcelado && state.quantidadeParcelas > 1;
  const foiCancelamento = state.editingEscopo === "cancelarRestante";

  let titulo = "Lançamento salvo!";
  let detalhe = "Já foi direto pra planilha.";
  if (foiCancelamento) { titulo = "Parcelamento cancelado"; detalhe = "As parcelas restantes viraram lançamentos normais."; }
  else if (foiEdicao) { titulo = "Lançamento atualizado!"; detalhe = "As alterações já foram pra planilha."; }
  else if (foiParcelado) { titulo = "Parcelamento salvo!"; detalhe = `${state.quantidadeParcelas} parcelas foram criadas, uma por mês.`; }

  const el = screenEl(`
    <div class="success-wrap">
      <div class="success-mark">✓</div>
      <h2 class="success-title">${titulo}</h2>
      <p class="success-detail">${detalhe}</p>
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
// Fetch com cache
// ============================================================
async function fetchResumo(mesLabel) {
  const chave = `resumo::${mesLabel}`;
  const cache = cacheGet(chave);
  if (cache) return cache;

  const json = await fetch(`${SCRIPT_URL}?mes=${encodeURIComponent(mesLabel)}`).then((r) => r.json());
  if (json && json.status === "ok") cachePut(chave, json);
  return json;
}

async function fetchRecentes(opts) {
  const o = opts || {};
  const limite = o.limite || LIMITE_RECENTES;
  const mes    = o.mes || "";
  const busca  = o.busca || "";
  const chave = `recentes::${limite}::${mes}::${busca}`;

  const cache = cacheGet(chave);
  if (cache) return cache;

  let url = `${SCRIPT_URL}?recentes=1&limite=${limite}`;
  if (mes && mes !== "todos") url += `&mesFiltro=${encodeURIComponent(mes)}`;
  if (busca) url += `&busca=${encodeURIComponent(busca)}`;
  const json = await fetch(url).then((r) => r.json());
  if (json.status !== "ok") throw new Error(json.message || "Falha ao consultar lançamentos.");
  const itens = json.itens || [];
  cachePut(chave, itens);
  return itens;
}

// ============================================================
// EXPORT CSV
// ============================================================

/**
 * Escapa um campo pra CSV no padrão que abre bem no Excel BR.
 * - Se contém ; " \n, envolve em aspas duplas
 * - Aspas duplas dentro do campo são duplicadas
 */
function csvEscapar(valor) {
  const s = String(valor == null ? "" : valor);
  if (s.indexOf(";") === -1 && s.indexOf('"') === -1 && s.indexOf("\n") === -1 && s.indexOf("\r") === -1) {
    return s;
  }
  return '"' + s.replace(/"/g, '""') + '"';
}

/**
 * Converte "Setembro de 2026" em "setembro-2026" (para nome do arquivo).
 * Remove acentos.
 */
function mesParaNomeArquivo(mesLabel) {
  return String(mesLabel || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+de\s+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
}

/**
 * Gera o conteúdo CSV a partir de uma lista de itens (mesmo formato
 * do fetchRecentes).
 */
function gerarCsv(itens) {
  const cabecalho = "Data;Hora;Quem;Bloco;Categoria;Parcela;Valor;Pago;Observacao";
  const linhas = itens.map((it) => {
    const valor = Number(it.valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false,
    });
    return [
      csvEscapar(it.data),
      csvEscapar(it.hora),
      csvEscapar(it.quem),
      csvEscapar(it.bloco),
      csvEscapar(it.categoria),
      csvEscapar(it.parcela || ""),
      csvEscapar(valor),
      csvEscapar(it.pago ? "Sim" : "Não"),
      csvEscapar(it.observacao || ""),
    ].join(";");
  });
  // BOM UTF-8 no início pra Excel reconhecer acentuação
  return "\uFEFF" + [cabecalho].concat(linhas).join("\r\n");
}

/**
 * Exporta o mês selecionado no Resumo.
 * 1. Busca até 100 lançamentos daquele mês
 * 2. Gera CSV
 * 3. Tenta compartilhar via navigator.share (iPhone/Android moderno)
 * 4. Se não suportar, cai pra download tradicional
 */
async function exportarMesCsv(botao) {
  const mesLabel = state.resumoMes;
  if (!mesLabel) {
    alert("Escolha um mês primeiro.");
    return;
  }

  const textoOriginal = botao.innerHTML;
  botao.disabled = true;
  botao.innerHTML = `<span class="spinner" style="border-color: rgba(43,36,32,0.15); border-top-color: var(--teal);"></span> Gerando...`;

  try {
    // Busca os lançamentos do mês (limite 100 — suficiente pra uso do casal)
    const itens = await fetchRecentes({ limite: 100, mes: mesLabel });

    if (!itens || itens.length === 0) {
      alert(`Nenhum lançamento em ${mesLabel} para exportar.`);
      botao.disabled = false;
      botao.innerHTML = textoOriginal;
      return;
    }

    // Ordena por data + hora (mais antigo primeiro, cronológico)
    itens.sort((a, b) => {
      const da = a.dataISO + " " + (a.hora || "");
      const db = b.dataISO + " " + (b.hora || "");
      return da.localeCompare(db);
    });

    const csv = gerarCsv(itens);
    const nomeArquivo = `financeiro-lu-thi-${mesParaNomeArquivo(mesLabel)}.csv`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const arquivo = new File([blob], nomeArquivo, { type: "text/csv" });

    // Compartilhamento nativo (iOS/Android moderno)
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      try {
        await navigator.share({
          files: [arquivo],
          title: `Financeiro Lu & Thi — ${mesLabel}`,
          text: `Lançamentos de ${mesLabel}`,
        });
        botao.disabled = false;
        botao.innerHTML = textoOriginal;
        return;
      } catch (err) {
        // Se o usuário cancelou (AbortError), não cai no download
        if (err && err.name === "AbortError") {
          botao.disabled = false;
          botao.innerHTML = textoOriginal;
          return;
        }
        // Outros erros: cai pro download tradicional abaixo
      }
    }

    // Fallback: download tradicional
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    botao.disabled = false;
    botao.innerHTML = textoOriginal;
  } catch (err) {
    alert(`Não deu pra exportar: ${err.message}`);
    botao.disabled = false;
    botao.innerHTML = textoOriginal;
  }
}

// ============================================================
// Resumo
// ============================================================
function renderResumo() {
  const el = screenEl(`
    <h2 class="screen-title">Resumo do mês</h2>
    <p class="field-label">Mês</p>
    <select class="mes-select" id="mesSelect" style="margin-bottom:18px;"></select>
    <div id="resumoResultado"></div>
  `);
  const select = el.querySelector("#mesSelect");
  const opcoes = gerarOpcoesDeMes();
  gerarMesesLancamento().forEach((m) => { if (!opcoes.includes(m.label)) opcoes.push(m.label); });
  opcoes.forEach((label) => {
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
  instalarBotaoTopo();
}

function carregarResumo(container, mesLabel) {
  return comSkeleton(
    container,
    () => htmlSkeletonResumo(),
    () => {
      if (SCRIPT_URL.includes("COLE_AQUI")) throw new Error("O app ainda não foi conectado à planilha.");
      return fetchResumo(mesLabel).then((json) => {
        if (!json || json.status !== "ok") throw new Error((json && json.message) || "Falha ao consultar.");
        return json;
      });
    },
    (json) => gerarHtmlResumoResultado(json),
    () => {
      ativarInteracaoGrafico();
      const btnExport = document.getElementById("btnExportarCsv");
      if (btnExport) {
        btnExport.addEventListener("click", () => exportarMesCsv(btnExport));
      }
    }
  );
}

function gerarHtmlResumoResultado(d) {
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
      const parcelaTag = l.parcela ? `<span class="tag-parcela">${l.parcela}</span>` : "";
      html += `
        <div class="cat-item" style="display:flex; flex-direction:column; gap:6px; ${estourou ? "border-color: var(--brick); background: var(--brick-tint);" : ""}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>${l.categoria}${parcelaTag}</span>
            <span style="text-align:right;">
              <strong${estourou ? ' style="color: var(--brick);"' : ""}>R$ ${formatarMoeda(l.valor)}</strong>
              ${temLimite ? `<br><span style="font-size:11px; color: var(--ink-soft);">limite R$ ${formatarMoeda(l.limite)}</span>` : ""}
              ${pendente > 0 ? `<br><span style="font-size:11px; color: var(--brick);">R$ ${formatarMoeda(pendente)} pendente</span>` : ""}
            </span>
          </div>
          ${temLimite ? `<div class="barra"><div class="barra-preenchida ${estourou ? "estourou" : (pct >= 80 ? "alerta" : "")}" style="width:${pct}%;"></div></div>` : ""}
        </div>
      `;
    });
    html += `</div>`;
  }

  html += gerarHtmlGrafico(d);

  // Botão de exportar (no final de tudo)
  html += `
    <div style="margin-top:26px; display:flex; justify-content:center;">
      <button class="btn-mini" id="btnExportarCsv" style="padding:12px 20px;">
        📥 Exportar esse mês em CSV
      </button>
    </div>
  `;

  return html;
}

// ============================================================
// GRÁFICO DE GASTOS
// ============================================================
function gerarHtmlGrafico(d) {
  const linhas = (d.linhas || []).filter((l) => l.bloco !== "Receita");

  if (linhas.length === 0) {
    return `
      <div class="grafico-secao">
        <h3 class="grafico-titulo">Gastos por bloco</h3>
        <p class="grafico-sub">Veja como o dinheiro foi distribuído no mês.</p>
        <p class="grafico-vazio">Nenhum gasto registrado nesse mês.</p>
      </div>
    `;
  }

  const porBloco = {};
  linhas.forEach((l) => {
    porBloco[l.bloco] = (porBloco[l.bloco] || 0) + (Number(l.valor) || 0);
  });

  const blocosOrdenados = Object.keys(porBloco)
    .filter((b) => porBloco[b] > 0)
    .sort((a, b) => porBloco[b] - porBloco[a]);

  const totalGeral = blocosOrdenados.reduce((s, b) => s + porBloco[b], 0);

  const porCategoria = {};
  linhas.forEach((l) => {
    const chave = l.categoria;
    if (!porCategoria[chave]) {
      porCategoria[chave] = { categoria: chave, bloco: l.bloco, valor: 0 };
    }
    porCategoria[chave].valor += Number(l.valor) || 0;
  });

  const categoriasOrdenadas = Object.values(porCategoria)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8);

  const maiorCategoria = categoriasOrdenadas.length > 0 ? categoriasOrdenadas[0].valor : 0;

  return `
    <div class="grafico-secao">
      <h3 class="grafico-titulo">Gastos por bloco</h3>
      <p class="grafico-sub">Como o dinheiro foi distribuído no mês.</p>

      <div class="grafico-pizza-wrap">
        ${gerarSvgPizza(porBloco, blocosOrdenados, totalGeral)}
        <div class="grafico-legenda" id="graficoLegenda">
          ${blocosOrdenados.map((bloco, i) => {
            const valor = porBloco[bloco];
            const pct = totalGeral > 0 ? Math.round((valor / totalGeral) * 100) : 0;
            const cor = CORES_BLOCO[bloco] || CORES_BLOCO["Outro"];
            return `
              <div class="grafico-legenda-item" data-idx="${i}">
                <span class="grafico-legenda-cor" style="background:${cor};"></span>
                <span class="grafico-legenda-nome">${bloco}</span>
                <span class="grafico-legenda-valor">R$ ${formatarMoeda(valor)}</span>
                <span class="grafico-legenda-pct">${pct}%</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>

      <h3 class="grafico-titulo" style="margin-top:26px;">Onde mais gastou</h3>
      <p class="grafico-sub">Top ${categoriasOrdenadas.length} categorias do mês.</p>
      <div class="grafico-barras">
        ${categoriasOrdenadas.map((c) => {
          const pct = maiorCategoria > 0 ? (c.valor / maiorCategoria) * 100 : 0;
          const cor = CORES_BLOCO[c.bloco] || CORES_BLOCO["Outro"];
          return `
            <div class="grafico-barra-item">
              <div class="grafico-barra-topo">
                <span class="nome">${c.categoria}</span>
                <span class="valor">R$ ${formatarMoeda(c.valor)}</span>
              </div>
              <div class="grafico-barra-trilha">
                <div class="grafico-barra-preenchida" style="width:${pct}%; background:${cor};"></div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function gerarSvgPizza(porBloco, blocosOrdenados, totalGeral) {
  const RAIO = 42;
  const PERIMETRO = 2 * Math.PI * RAIO;

  let offsetAcumulado = 0;
  let fatiasSvg = "";

  blocosOrdenados.forEach((bloco, i) => {
    const valor = porBloco[bloco];
    const fracao = totalGeral > 0 ? valor / totalGeral : 0;
    const comprimento = fracao * PERIMETRO;
    const offset = -offsetAcumulado;
    const cor = CORES_BLOCO[bloco] || CORES_BLOCO["Outro"];
    const gap = blocosOrdenados.length > 1 ? 1.5 : 0;
    const comprimentoVisivel = Math.max(0, comprimento - gap);

    fatiasSvg += `
      <circle class="fatia" data-idx="${i}"
        cx="60" cy="60" r="${RAIO}"
        stroke="${cor}"
        stroke-dasharray="${comprimentoVisivel} ${PERIMETRO - comprimentoVisivel}"
        stroke-dashoffset="${offset}"
      />
    `;

    offsetAcumulado += comprimento;
  });

  return `
    <div class="grafico-pizza">
      <svg viewBox="0 0 120 120" aria-label="Gráfico de gastos por bloco">
        <circle cx="60" cy="60" r="${RAIO}" fill="none" stroke="var(--line)" stroke-width="22" />
        ${fatiasSvg}
      </svg>
      <div class="grafico-pizza-centro">
        <div class="label">Total gasto</div>
        <div class="valor">R$ ${formatarMoeda(totalGeral)}</div>
      </div>
    </div>
  `;
}

function ativarInteracaoGrafico() {
  const legenda = document.getElementById("graficoLegenda");
  if (!legenda) return;

  const pizza = document.querySelector(".grafico-pizza");
  if (!pizza) return;

  const fatias = pizza.querySelectorAll(".fatia");
  const itensLegenda = legenda.querySelectorAll(".grafico-legenda-item");

  function destacar(idx) {
    fatias.forEach((f) => {
      f.classList.toggle("dim", Number(f.dataset.idx) !== idx);
    });
    itensLegenda.forEach((it) => {
      it.classList.toggle("ativo", Number(it.dataset.idx) === idx);
    });
  }

  function limparDestaque() {
    fatias.forEach((f) => f.classList.remove("dim"));
    itensLegenda.forEach((it) => it.classList.remove("ativo"));
  }

  fatias.forEach((f) => {
    const idx = Number(f.dataset.idx);
    f.addEventListener("mouseenter", () => destacar(idx));
    f.addEventListener("mouseleave", limparDestaque);
    f.addEventListener("touchstart", (e) => { e.preventDefault(); destacar(idx); }, { passive: false });
    f.addEventListener("touchend", limparDestaque);
  });

  itensLegenda.forEach((it) => {
    const idx = Number(it.dataset.idx);
    it.addEventListener("mouseenter", () => destacar(idx));
    it.addEventListener("mouseleave", limparDestaque);
    it.addEventListener("touchstart", (e) => { e.preventDefault(); destacar(idx); }, { passive: false });
    it.addEventListener("touchend", limparDestaque);
  });
}

// ============================================================
// Recentes
// ============================================================
function renderRecentes() {
  const el = screenEl(`
    <h2 class="screen-title">Últimos lançamentos</h2>
    <p class="screen-sub">Edite, marque como pago/recebido, duplique ou exclua.</p>
    <input type="search" class="search-input" id="buscaInput" placeholder="Buscar por categoria, pessoa, bloco..." />
    <p class="field-label">Mês</p>
    <select class="mes-select" id="mesFiltroSelect" style="margin-bottom:16px;"></select>
    <div id="recentesLista"></div>
  `);
  const buscaInput = el.querySelector("#buscaInput");
  const mesSelect  = el.querySelector("#mesFiltroSelect");
  const listaEl    = el.querySelector("#recentesLista");

  const optTodos = document.createElement("option");
  optTodos.value = "todos";
  optTodos.textContent = "Todos os meses";
  if (state.recentesMes === "todos") optTodos.selected = true;
  mesSelect.appendChild(optTodos);

  const opcoes = gerarOpcoesDeMes();
  gerarMesesLancamento().forEach((m) => { if (!opcoes.includes(m.label)) opcoes.push(m.label); });
  opcoes.forEach((label) => {
    const opt = document.createElement("option");
    opt.value = label; opt.textContent = label;
    if (label === state.recentesMes) opt.selected = true;
    mesSelect.appendChild(opt);
  });

  buscaInput.value = state.recentesBusca;

  if (!state.recentesIniciado) {
    listaEl.innerHTML = `<div class="convite-inicial"><span class="icone">🔍</span>
      Digite algo na busca ou escolha um mês acima para ver seus lançamentos.</div>`;
  } else {
    carregarRecentes(listaEl);
  }

  let debounceTimer = null;
  buscaInput.addEventListener("input", () => {
    state.recentesBusca = buscaInput.value;
    state.recentesIniciado = true;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => carregarRecentes(listaEl), 350);
  });
  mesSelect.addEventListener("change", () => {
    state.recentesMes = mesSelect.value;
    state.recentesIniciado = true;
    carregarRecentes(listaEl);
  });
  instalarBotaoTopo();
}

function carregarRecentes(container) {
  return comSkeleton(
    container,
    () => htmlSkeletonCartoes(5),
    () => {
      if (SCRIPT_URL.includes("COLE_AQUI")) throw new Error("O app ainda não foi conectado à planilha.");
      return fetchRecentes({
        limite: LIMITE_RECENTES, mes: state.recentesMes, busca: state.recentesBusca,
      });
    },
    (itens) => {
      if (itens.length === 0) {
        return `<p class="sem-resultado">Nenhum lançamento encontrado com esses filtros.</p>`;
      }
      const wrap = document.createElement("div");
      wrap.className = "cat-list";
      itens.forEach((item) => wrap.appendChild(criarCartaoRecente(item, itens, container)));
      queueMicrotask(() => {
        const target = container.querySelector(".cat-list");
        if (target) {
          target.replaceWith(wrap);
        } else {
          container.innerHTML = "";
          container.appendChild(wrap);
        }
      });
      return `<div class="cat-list"></div>`;
    }
  );
}

function criarCartaoRecente(item, todosItens, container) {
  const row = document.createElement("div");
  row.className = "cat-item" + (item.pago ? " pago" : "");
  row.style.display = "flex";
  row.style.flexDirection = "column";
  row.style.gap = "8px";

  const statusTxt = item.pago
    ? ` · <span style="color:var(--teal-dark); font-weight:600;">${item.bloco === "Receita" ? "recebido" : "pago"}</span>`
    : ` · <span style="color:var(--brick);">pendente</span>`;
  const agendado = ehMesFuturo(item.dataISO) ? `<span class="chip-agendado">agendado</span>` : "";
  const parcelaTag = item.parcela ? `<span class="tag-parcela">${item.parcela}</span>` : "";

  row.innerHTML = `
    <div>
      <strong class="valor-principal">${item.categoria}</strong>${parcelaTag} — <strong class="valor-principal">R$ ${formatarMoeda(item.valor)}</strong>${agendado}<br>
      <span style="font-size:12px; color:var(--ink-soft);">${item.quem} · ${item.bloco} · ${item.data} ${item.hora}${statusTxt}</span>
    </div>
    <div class="row-acoes">
      <button class="btn-mini ${item.pago ? "desfazer" : "pago"}" data-acao="pago">
        ${item.pago ? "Desfazer pago" : "Marcar pago"}
      </button>
      <button class="btn-mini" data-acao="duplicar">Duplicar</button>
      <button class="btn-mini" data-acao="editar">Editar</button>
      <button class="btn-mini excluir" data-acao="excluir">Excluir</button>
    </div>
  `;
  row.querySelector('[data-acao="pago"]').addEventListener("click", () => alternarPago(item, container));
  row.querySelector('[data-acao="duplicar"]').addEventListener("click", () => duplicarItem(item));
  row.querySelector('[data-acao="editar"]').addEventListener("click", () => iniciarEdicao(item, todosItens));
  row.querySelector('[data-acao="excluir"]').addEventListener("click", () => excluirItem(item, todosItens, container));
  return row;
}

// ============================================================
// Ações dos Recentes
// ============================================================
async function alternarPago(item, container) {
  const novoPago = !item.pago;
  try {
    const json = await fetch(SCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "marcarPago", id: item.id, pago: novoPago ? "Sim" : "Não" }),
    }).then((r) => r.json());
    if (json.status !== "ok") throw new Error(json.message || "Falha ao atualizar.");
    cacheInvalida();
    carregarRecentes(container);
  } catch (err) { alert(`Não deu pra atualizar: ${err.message}`); }
}

function duplicarItem(item) {
  resetState();
  state.quem = item.quem;
  state.bloco = item.bloco;
  state.categoria = item.categoria;
  state.valor = String(item.valor).replace(".", ",");
  state.pago = false;
  state.observacao = item.observacao || "";
  state.parcelado = false;
  const [ano, mesNum] = item.dataISO.split("-").map(Number);
  const hoje = new Date();
  const offset = (ano - hoje.getFullYear()) * 12 + ((mesNum - 1) - hoje.getMonth());
  state.mesLancamento = { label: `${MESES_PT[mesNum - 1]} de ${ano}`, ano, mesIndex: mesNum - 1, offset };
  goToStep(9);
}

function iniciarEdicao(item, todosItens) {
  const temParcela = !!item.parcela;
  if (!temParcela) {
    editarAvulso_(item);
    return;
  }
  abrirModalEscopoEdicao(item, todosItens);
}

function editarAvulso_(item) {
  resetState();
  state.editingId = item.id;
  state.editingMeta = { dataISO: item.dataISO, hora: item.hora, parcela: item.parcela || "" };
  const [ano, mesNum] = item.dataISO.split("-").map(Number);
  const hoje = new Date();
  const offset = (ano - hoje.getFullYear()) * 12 + ((mesNum - 1) - hoje.getMonth());
  state.mesLancamento = { label: `${MESES_PT[mesNum - 1]} de ${ano}`, ano, mesIndex: mesNum - 1, offset };
  state.quem = item.quem;
  state.bloco = item.bloco;
  state.categoria = item.categoria;
  state.valor = String(item.valor).replace(".", ",");
  state.pago = !!item.pago;
  state.observacao = item.observacao || "";
  state.parcelado = false;
  state.quantidadeParcelas = null;
  goToStep(9);
}

function abrirModalEscopoEdicao(item, todosItens) {
  const irmaos = todosItens
    .filter((o) => o.grupoId && o.grupoId === item.grupoId && o.parcela)
    .sort((a, b) => {
      const na = parseInt(a.parcela.split("/")[0], 10);
      const nb = parseInt(b.parcela.split("/")[0], 10);
      return na - nb;
    });

  if (irmaos.length <= 1) {
    editarAvulso_(item);
    return;
  }

  const numAtual = parseInt(item.parcela.split("/")[0], 10);
  const restantes = irmaos.filter((o) => {
    const n = parseInt(o.parcela.split("/")[0], 10);
    return n >= numAtual;
  });

  const pagasAntes = irmaos.filter((o) => {
    const n = parseInt(o.parcela.split("/")[0], 10);
    return n < numAtual && o.pago;
  });

  let avisoForte = "";
  if (pagasAntes.length > 0) {
    avisoForte = `<div class="modal-aviso alerta-forte">
      ⚠️ ${pagasAntes.length} parcela(s) anterior(es) já paga(s) <strong>não</strong> serão afetadas nas opções abaixo.
    </div>`;
  }

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <h3 class="modal-titulo">Editar parcela ${item.parcela}</h3>
      <p class="modal-sub">
        <strong>${item.categoria}</strong> — parcelamento em ${irmaos.length}x.
        Esta é a ${item.parcela}. O que você quer editar?
      </p>
      ${avisoForte}
      <div class="modal-opcoes">
        <button class="modal-opcao" data-op="uma">
          <span class="op-titulo">Só esta parcela</span>
          <span class="op-desc">A ${item.parcela} vira R$ ${formatarMoeda(item.valor)} editado; as outras ficam como estão</span>
        </button>
        <button class="modal-opcao" data-op="estaEFuturas">
          <span class="op-titulo">Esta e as futuras</span>
          <span class="op-desc">Edita a ${item.parcela} e as ${restantes.length - 1} seguintes</span>
        </button>
        <button class="modal-opcao" data-op="todas">
          <span class="op-titulo">Todas as parcelas</span>
          <span class="op-desc">Edita as ${irmaos.length} parcelas, incluindo as ${numAtual - 1} anteriores</span>
        </button>
        <button class="modal-opcao perigo" data-op="cancelarRestante">
          <span class="op-titulo">Cancelar daqui pra frente</span>
          <span class="op-desc">A ${item.parcela} em diante viram lançamentos normais (mantém valor e data)</span>
        </button>
      </div>
      <button class="modal-cancelar" data-op="cancelar">Cancelar</button>
    </div>
  `;
  document.body.appendChild(overlay);
  function fechar() { overlay.remove(); }

  overlay.querySelector('[data-op="uma"]').addEventListener("click", () => {
    fechar();
    editarAvulso_(item);
  });

  overlay.querySelector('[data-op="estaEFuturas"]').addEventListener("click", () => {
    fechar();
    abrirWizardEdicaoLote_(item, restantes.map((o) => o.id), "estaEFuturas");
  });

  overlay.querySelector('[data-op="todas"]').addEventListener("click", () => {
    fechar();
    abrirWizardEdicaoLote_(item, irmaos.map((o) => o.id), "todas");
  });

  overlay.querySelector('[data-op="cancelarRestante"]').addEventListener("click", () => {
    fechar();
    abrirWizardEdicaoLote_(item, restantes.map((o) => o.id), "cancelarRestante");
  });

  overlay.querySelector('[data-op="cancelar"]').addEventListener("click", fechar);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) fechar(); });
}

function abrirWizardEdicaoLote_(item, ids, escopo) {
  resetState();
  state.editingEscopo = escopo;
  state.editingIds = ids;
  state.editingId = (escopo === "estaEFuturas" || escopo === "todas") ? item.id : null;

  const [ano, mesNum] = item.dataISO.split("-").map(Number);
  const hoje = new Date();
  const offset = (ano - hoje.getFullYear()) * 12 + ((mesNum - 1) - hoje.getMonth());
  state.mesLancamento = { label: `${MESES_PT[mesNum - 1]} de ${ano}`, ano, mesIndex: mesNum - 1, offset };

  state.quem = item.quem;
  state.bloco = item.bloco;
  state.categoria = item.categoria;
  state.valor = String(item.valor).replace(".", ",");
  state.pago = !!item.pago;
  state.observacao = item.observacao || "";
  state.parcelado = true;
  state.quantidadeParcelas = null;

  goToStep(9);
}

function encontrarIrmaos(item, todosItens) {
  if (!item.parcela) return [];
  if (item.grupoId) {
    return todosItens.filter((o) => o.grupoId === item.grupoId && o.parcela);
  }
  const match = /^(\d+)\/(\d+)$/.exec(item.parcela);
  if (!match) return [];
  const total = parseInt(match[2], 10);
  return todosItens.filter((o) => {
    if (!o.parcela) return false;
    const m = /^(\d+)\/(\d+)$/.exec(o.parcela);
    if (!m) return false;
    if (parseInt(m[2], 10) !== total) return false;
    if (o.bloco !== item.bloco) return false;
    if (o.categoria !== item.categoria) return false;
    if (o.quem !== item.quem) return false;
    return true;
  });
}

function excluirItem(item, todosItens, container) {
  const irmaos = encontrarIrmaos(item, todosItens);
  if (irmaos.length <= 1) { excluirUmaSo_(item, container); return; }

  const pagos = irmaos.filter((i) => i.pago);
  const pendentes = irmaos.filter((i) => !i.pago);
  const total = irmaos.length;

  if (pendentes.length === 0) {
    alert(`Todas as ${total} parcelas deste lançamento já estão pagas/recebidas. Desmarque o pago antes de excluir.`);
    return;
  }

  let aviso = "";
  if (pagos.length > 0) {
    aviso = `<div class="modal-aviso"><strong>${pagos.length}</strong> das ${total} parcelas já foram pagas/recebidas. Essas <strong>não</strong> serão excluídas.</div>`;
  }

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <h3 class="modal-titulo">Excluir parcela ${item.parcela}</h3>
      <p class="modal-sub">Esta parcela faz parte de um parcelamento em ${total}x (${item.categoria}).</p>
      ${aviso}
      <div class="modal-opcoes">
        <button class="modal-opcao" data-op="uma">
          Só esta parcela
          <span class="op-desc">Exclui apenas a ${item.parcela} (R$ ${formatarMoeda(item.valor)})</span>
        </button>
        <button class="modal-opcao perigo" data-op="todas">
          Todo o parcelamento
          <span class="op-desc">Exclui as ${pendentes.length} parcelas pendentes do grupo</span>
        </button>
      </div>
      <button class="modal-cancelar" data-op="cancelar">Cancelar</button>
    </div>
  `;
  document.body.appendChild(overlay);
  function fechar() { overlay.remove(); }
  overlay.querySelector('[data-op="uma"]').addEventListener("click", () => { fechar(); excluirUmaSo_(item, container); });
  overlay.querySelector('[data-op="todas"]').addEventListener("click", () => { fechar(); excluirLote_(pendentes, container); });
  overlay.querySelector('[data-op="cancelar"]').addEventListener("click", fechar);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) fechar(); });
}

async function excluirUmaSo_(item, container) {
  const ok = window.confirm(`Excluir o lançamento de R$ ${formatarMoeda(item.valor)} em "${item.categoria}" (${item.data})?`);
  if (!ok) return;
  try {
    const json = await fetch(SCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "excluir", id: item.id }),
    }).then((r) => r.json());
    if (json.status !== "ok") throw new Error(json.message || "Falha ao excluir.");
    cacheInvalida();
    carregarRecentes(container);
  } catch (err) { alert(`Não deu pra excluir: ${err.message}`); }
}

async function excluirLote_(itens, container) {
  const ids = itens.map((i) => i.id);
  try {
    const json = await fetch(SCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "excluirLote", ids }),
    }).then((r) => r.json());
    if (json.status !== "ok") throw new Error(json.message || "Falha ao excluir.");
    cacheInvalida();
    carregarRecentes(container);
  } catch (err) { alert(`Não deu pra excluir: ${err.message}`); }
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
