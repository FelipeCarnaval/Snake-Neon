// Harness de testes: carrega script.js num stub de DOM e valida o núcleo do jogo.
const fs = require("fs");

function makeEl(id) {
  return {
    id,
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, force) {
        const has = this._s.has(c);
        const want = force === undefined ? !has : !!force;
        if (want) this._s.add(c); else this._s.delete(c);
        return want;
      },
      contains(c) { return this._s.has(c); },
    },
    style: { setProperty() {}, transform: "" },
    addEventListener() {},
    getContext() { return makeCtx(); },
    getBoundingClientRect() { return { width: 480, height: 480, left: 0, top: 0 }; },
    setAttribute() {},
    querySelector() { return null; },
    set clientWidth(v) {},
    get clientWidth() { return 480; },
    value: "",
    checked: false,
    blur() {},
    focus() {},
    appendChild() { return null; },
    remove() {},
    textContent: "",
    offsetWidth: 10,
  };
}

function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p === "createLinearGradient") return () => ({ addColorStop() {} });
      if (p === "createRadialGradient") return () => ({ addColorStop() {} });
      return typeof t[p] !== "undefined" ? t[p] : () => {};
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

const ids = [
  "game", "canvasWrapper", "score", "scoreBox", "highScore", "overlayStart",
  "overlayPause", "overlayGameOver", "finalScore", "newRecord", "btnPause", "btnSound",
  "btnAmbient", "level", "levelFill", "toastStack", "settingsBackdrop", "btnSettings",
  "btnCloseSettings", "optSound", "optMusic", "optParticles", "optVisual", "optMotion",
  "btnStart", "btnPlayAgain", "btnResume", "btnRestart", "btnUp", "btnDown", "btnLeft",
  "btnRight", "btnPauseTouch", "bestScore", "levelValue", "statEaten", "statGames",
  "statBest", "statLevel", "statSize", "statCombo", "statTime", "statRecord", "statFoods",
  "totGames", "totBest", "totCombo", "totLevel", "totSize", "totTime", "totFoods",
  "totGold", "totTurbo", "comboChip", "comboText", "comboBarFill", "speedChip", "speedTime",
  "levelBanner", "levelBannerNum", "countdown", "optSfxVol", "optMusicVol", "sfxVolVal", "musicVolVal",
];
const els = new Map();
ids.forEach(id => { if (!els.has(id)) els.set(id, makeEl(id)); });

const document = {
  getElementById(id) { return els.get(id) || makeEl(id); },
  querySelector() { return makeEl("sel"); },
  querySelectorAll() { return []; },
  createElement(tag) { return makeEl(tag); },
  body: Object.assign(makeEl("body"), { classList: { add() {}, remove() {}, toggle() {}, contains: () => false } }),
  activeElement: null,
  addEventListener() {},
};

const windowStub = {
  addEventListener() {},
  matchMedia() { return { matches: false, addEventListener() {} }; },
  devicePixelRatio: 1,
};
windowStub.__SNAKE_TEST__ = {};

const localStorageStub = new Map();
const localStorage = {
  getItem: k => (localStorageStub.has(k) ? localStorageStub.get(k) : null),
  setItem: (k, v) => localStorageStub.set(k, v),
  removeItem: k => localStorageStub.delete(k),
};

const performance = { now: () => 0 };
const rAF = () => 0;

global.document = document;
global.window = windowStub;
global.localStorage = localStorage;
global.performance = performance;
global.requestAnimationFrame = rAF;
global.cancelAnimationFrame = rAF;

let T;
try {
  const code = fs.readFileSync("script.js", "utf8");
  eval(code);
  T = windowStub.__SNAKE_TEST__;
} catch (e) {
  console.log("LOAD ERROR —", e.constructor.name + ":", e.message);
  process.exit(1);
}

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name); }
}

// A: estado inicial
ok(T.getState() === "ready", "estado inicial 'ready'");
ok(T.getSnake().length === 3, "cobra nasce com 3 segmentos");

// B: matemática do multiplicador de combo
ok(T.comboMult(1) === 1, "streak 1 => x1");
ok(Math.abs(T.comboMult(2) - 1.25) < 1e-9, "streak 2 => x1.25");
ok(Math.abs(T.comboMult(6) - 2.25) < 1e-9, "streak 6 => x2.25");
ok(T.comboMult(20) === 3, "streak alto => teto x3");

// C: movimento avança a cabeça
T.resetGame();
const c = Math.floor(21 / 2);
const bx = T.getSnake()[0].x;
T.setDir({ x: 1, y: 0 });
T.step();
ok(T.getSnake()[0].x === bx + 1 && T.getSnake()[0].y === c, "passo move a cabeça +1 em x");
ok(T.getState() === "ready" || T.getState() === "playing", "sem colisão => jogo segue vivo");

// D: comer maçã cresce e pontua (+10 na primeira)
T.resetGame();
const head = T.getSnake()[0];
T.setDir({ x: 1, y: 0 });
T.setFood({ x: head.x + 1, y: head.y, kind: "apple" });
T.step();
ok(T.getSnake().length === 4, "comer maçã cresce para 4");
ok(T.getScore() === 10, "maçã base vale +10");

// E: combinação de combo (2ª comida em sequência = x1.25)
head2 = T.getSnake()[0];
T.setFood({ x: head2.x + 1, y: head2.y, kind: "apple" });
T.step();
ok(T.getEatStreak() === 2, "segunda comida mantém sequência (streak 2)");
ok(T.getScore() === 23, "pontuação acumula 10 + 13 (x1.25 arredondado)");

// F: gema dourada vale +30
T.resetGame();
const h3 = T.getSnake()[0];
T.setDir({ x: 1, y: 0 });
T.setFood({ x: h3.x + 1, y: h3.y, kind: "gold" });
T.step();
ok(T.getScore() === 30, "gema dourada vale +30");

// F2: raio ativa turbo
T.resetGame();
const h4 = T.getSnake()[0];
T.setDir({ x: 1, y: 0 });
T.setFood({ x: h4.x + 1, y: h4.y, kind: "speed" });
T.step();
ok(T.getSpeedActive() === true, "comer raio ativa o turbo");
ok(T.getScore() === 5, "raio vale +5");

// G: colisão com obstáculo encerra a partida
T.resetGame();
const h5 = T.getSnake()[0];
T.setDir({ x: 1, y: 0 });
T.setObstacles([{ x: h5.x + 1, y: h5.y }]);
T.step();
ok(T.getState() === "over", "colisão com obstáculo => game over");

// H: colisão com parede encerra a partida
T.resetGame();
T.setSnake([{ x: 20, y: 10 }, { x: 19, y: 10 }, { x: 18, y: 10 }]);
T.setDir({ x: 1, y: 0 });
T.step();
ok(T.getState() === "over", "colisão com parede => game over");

// I: obstáculos do nível 3+ ficam em células pares-pares e fora do centro/snake/comida
T.resetGame();
T.spawnObstacles(3);
const obs = T.getObstacles();
ok(obs.length >= 1 && obs.length <= 14, `nível 3 gera ${obs.length} obstáculos`);
const allEven = obs.every(o => o.x % 2 === 0 && o.y % 2 === 0);
ok(allEven, "obstáculos sempre em células pares-pares");
const centerOk = obs.every(o => !(Math.abs(o.x - c) <= 2 && Math.abs(o.y - c) <= 2));
ok(centerOk, "nenhum obstáculo na zona central");
const food = T.getFood();
ok(!obs.some(o => o.x === food.x && o.y === food.y), "comida não nasce sob obstáculo");
T.spawnObstacles(2);
ok(T.getObstacles().length === 0, "nível 2 não gera obstáculos");

// J: reset limpa obstáculos e estado
T.setObstacles([{ x: 1, y: 1 }, { x: 3, y: 3 }]);
T.setSpeedActive(true);
T.resetGame();
ok(T.getObstacles().length === 0, "resetGame limpa obstáculos");
ok(T.getSpeedActive() === false, "resetGame desliga turbo");

// L: gema expira apenas se especial
T.resetGame();
T.placeFood(true);
ok(T.getFood().kind === "apple" && T.getFoodExpiresAt() === Number.MAX_SAFE_INTEGER, "maçã (apple) não expira");
T.setFood({ x: 1, y: 1, kind: "gold" });
ok(T.getFoodExpiresAt() === Number.MAX_SAFE_INTEGER, "setFood não altera validade manualmente");
T.placeFood(true);
ok(T.getFood().kind === "apple", "placeFood(true) força maçã comum");

// M: estatísticas de itens especiais acumulam
T.resetGame();
const gx = T.getSnake()[0];
T.setDir({ x: 1, y: 0 });
T.setFood({ x: gx.x + 1, y: gx.y, kind: "gold" });
T.step();
ok(T.getStats().golds >= 1, "gema dourada soma em stats.golds");
T.resetGame();
const gx2 = T.getSnake()[0];
T.setDir({ x: 1, y: 0 });
T.setFood({ x: gx2.x + 1, y: gx2.y, kind: "speed" });
T.step();
ok(T.getStats().turbos >= 1, "raio soma em stats.turbos");

// K: gameOver persiste totais
T.resetGame();
const before = JSON.parse(localStorage.getItem("snakeStats") || "{}").games | 0;
T.gameOver();
const after = JSON.parse(localStorage.getItem("snakeStats") || "{}").games | 0;
ok(after === before + 1, "gameOver incrementa o total de partidas");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);