(() => {
  "use strict";

  /* ================= Configurações ================= */
  const GRID = 21;            // células por lado
  const START_SPEED = 150;    // ms por passo no início
  const MIN_SPEED = 65;       // limite máximo de velocidade
  const SPEEDUP = 0.55;       // ms reduzidos por ponto
  const FOOD_POINTS = 10;
  const GOLD_POINTS = 30;
  const SPEED_POINTS = 5;
  const COMBO_WINDOW = 2400;  // ms para manter a sequência ativa
  const COMBO_STEP = 0.25;    // multiplicador extra por maçã adicional
  const COMBO_MAX = 3;        // teto do multiplicador (×3)
  const SPEED_BOOST_MS = 4500; // duração do turbo
  const SPEED_FACTOR = 0.72;   // intervalo ×0.72 durante o turbo
  const FOOD_LIFETIME = 6000;  // gemas especiais somem se não forem pegas a tempo
  const RESUME_FREEZE = 1600; // contagem 3·2·1 antes de retomar
  const RESUME_STEP = RESUME_FREEZE / 3;
  const LEVEL_EVERY = 50;     // pontos por nível
  // Matizes dos "biomas" (mudam a cada 5 níveis) e seus nomes de cenário
  const BIOMES = [null, "167, 139, 250", "34, 211, 238", "251, 191, 36", "251, 113, 133"];
  const BIOME_NAMES = ["", "Abismo Violeta", "Gelo Profundo", "Cinzas Âmbar", "Vulcão Carmesim"];
  const STORAGE_KEY = "snakeHighScore";

  /* ====== Placar global (online) ======
     Backend: Supabase grátis (supabase.com). Crie um projeto, rode o SQL abaixo em
     "SQL Editor", e cole em SUPABASE_URL a URL do projeto e em SUPABASE_ANON a
     "anon public" key (Settings > API > Project keys). Sem isso o jogo funciona
     100% offline com recorde local.

     create table if not exists records (
       id bigint generated always as identity primary key,
       name text not null default 'Jogador',
       score integer not null,
       level integer not null default 1,
       created_at timestamptz not null default now()
     );
     alter table records enable row level security;
     create policy "read" on records for select using (true);
     create policy "insert" on records for insert with check (true);
  */
  const SUPABASE_URL = "https://qnwtfcgyjaavazwklqge.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFud3RmY2d5amFhdmF6d2tscWdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMDE5MzIsImV4cCI6MjEwNTc3NzkzMn0.2nROMgfQlgRfY15-SMP4UV39jaypLiZLKR5CFxgPxM0";

  /* ================= Elementos ================= */
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const wrapper = document.getElementById("canvasWrapper");
  const scoreEl = document.getElementById("score");
  const scoreBox = document.getElementById("scoreBox");
  const highScoreEl = document.getElementById("highScore");
  const overlayStart = document.getElementById("overlayStart");
  const overlayPause = document.getElementById("overlayPause");
  const overlayGameOver = document.getElementById("overlayGameOver");
  const finalScoreEl = document.getElementById("finalScore");
  const newRecordBadge = document.getElementById("newRecord");
  const newGlobalRecordBadge = document.getElementById("newGlobalRecord");
  const globalScoreEl = document.getElementById("globalScore");
  const globalHintEl = document.getElementById("globalHint");
  const btnPause = document.getElementById("btnPause");
  const btnSound = document.getElementById("btnSound");
  const btnAmbient = document.getElementById("btnAmbient");
  const levelEl = document.getElementById("level");
  const levelFill = document.getElementById("levelFill");
  const bestBox = document.querySelector(".score-box.best");
  const toastStack = document.getElementById("toastStack");
  const settingsBackdrop = document.getElementById("settingsBackdrop");
  const btnSettings = document.getElementById("btnSettings");
  const btnCloseSettings = document.getElementById("btnCloseSettings");
  const optSound = document.getElementById("optSound");
  const optMusic = document.getElementById("optMusic");
  const optParticles = document.getElementById("optParticles");
  const optVisual = document.getElementById("optVisual");
  const optMotion = document.getElementById("optMotion");
  const optSfxVol = document.getElementById("optSfxVol");
  const optMusicVol = document.getElementById("optMusicVol");
  const sfxVolVal = document.getElementById("sfxVolVal");
  const musicVolVal = document.getElementById("musicVolVal");
  const optNick = document.getElementById("optNick");
  const comboChip = document.getElementById("comboChip");
  const comboText = document.getElementById("comboText");
  const comboBarFill = document.getElementById("comboBarFill");
  const speedChip = document.getElementById("speedChip");
  const speedTime = document.getElementById("speedTime");
  const levelBanner = document.getElementById("levelBanner");
  const levelBannerNum = document.getElementById("levelBannerNum");
  const countdownEl = document.getElementById("countdown");
  const btnPlayAgain = document.getElementById("btnPlayAgain");
  const btnShare = document.getElementById("btnShare");
  // Estrelas determinísticas do fundo (3 camadas de parallax)
  const starField = Array.from({ length: 110 }, (_, i) => ({
    x: ((i * 137) % 173) / 173,
    y: ((i * 89) % 131) / 131,
    s: 0.35 + ((i * 17) % 9) / 10,
    tw: (i * 31) % 100,
    layer: i % 3,
  }));

  /* ================= Utilidades ================= */
  const storage = {
    get() {
      try { return parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0; }
      catch (e) { return 0; }
    },
    set(v) {
      try { localStorage.setItem(STORAGE_KEY, String(v)); } catch (e) { /* ignore */ }
    },
  };

  /* ================= Áudio (Web Audio API) ================= */
  const SFX_KEY = "snakeSound";
  const AMB_KEY = "snakeAmbient";
  const SFX_VOL_KEY = "snakeVolSfx";
  const MUS_VOL_KEY = "snakeVolMusic";

  // Trilha ambiente: progressão calma em Dm (Dm9 -> Bbmaj7 -> Fmaj7 -> Cmaj9)
  const CHORD_DUR = 7.5; // acordes longos, tempo lento (~60 BPM de pulso harmônico)
  const CHORDS = [
    [146.83, 220.0, 261.63, 329.63], // Dm9
    [116.54, 174.61, 220.0, 293.66], // Bbmaj7
    [174.61, 220.0, 261.63, 349.23], // Fmaj7
    [130.81, 196.0, 246.94, 293.66], // Cmaj9
  ];
  const BASS = [73.42, 58.27, 87.31, 65.41];                    // D2 Bb1 F2 C2 (pad de baixo, só ao jogar)
  const BELLS = [587.33, 698.46, 783.99, 880.0, 1046.5, 1174.66]; // pentatônica menor de D (sinos)

  function loadPref(key, def) {
    try { const v = localStorage.getItem(key); return v === null ? def : v !== "off"; } catch (e) { return def; }
  }
  function savePref(key, on) {
    try { localStorage.setItem(key, on ? "on" : "off"); } catch (e) { /* ignore */ }
  }
  function loadVol(key, def) {
    try {
      const v = parseFloat(localStorage.getItem(key));
      return isFinite(v) ? Math.max(0, Math.min(100, v)) : def;
    } catch (e) { return def; }
  }
  function saveVol(key, v) {
    try { localStorage.setItem(key, String(Math.round(v))); } catch (e) { /* ignore */ }
  }

  // Impulso gerado proceduralmente para o reverb (ConvolverNode)
  function makeImpulse(ctx, seconds, decay) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  const sfx = {
    ctx: null,
    master: null,
    verb: null,
    ambient: null,
    loops: null,
    _lastLvl: 1,
    _musState: "ready",
    _musTier: 0,
    _musTimer: null,
    nextChordTime: 0,
    nextBellTime: 0,
    chordIdx: 0,
    enabled: loadPref(SFX_KEY, true),
    ambOn: loadPref(AMB_KEY, true),
    vol: loadVol(SFX_VOL_KEY, 100) / 100,
    musVol: loadVol(MUS_VOL_KEY, 60) / 100,

    ensure() {
      if (!this.enabled) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!this.ctx) {
        try {
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.55 * (this.vol || 1);
          this.master.connect(this.ctx.destination);
          // Reverb leve compartilhado
          this.verb = this.ctx.createConvolver();
          this.verb.buffer = makeImpulse(this.ctx, 1.4, 2.4);
          const vg = this.ctx.createGain();
          vg.gain.value = 0.6;
          this.verb.connect(vg).connect(this.master);
        } catch (e) { this.ctx = null; return; }
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
      if (this.ambOn) this.startAmbient();
      if (!this.loops) this.startLoops();
    },

    tone({ f0, f1 = f0, dur = 0.1, type = "sine", vol = 0.2, delay = 0, attack = 0.008, wet = 0.15 }) {
      if (!this.enabled || !this.ctx) return;
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(30, f0), t0);
      if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur * 0.85);
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.exponentialRampToValueAtTime(vol, t0 + attack);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(env).connect(this.master);
      if (wet > 0 && this.verb) {
        const send = this.ctx.createGain();
        send.gain.value = wet;
        env.connect(send).connect(this.verb);
      }
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    },

    noise(dur = 0.3, vol = 0.2, cutoff = 600, wet = 0.15) {
      if (!this.enabled || !this.ctx) return;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoff;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(filter).connect(g).connect(this.master);
      if (wet > 0 && this.verb) {
        const send = this.ctx.createGain();
        send.gain.value = wet;
        g.connect(send).connect(this.verb);
      }
      src.start();
    },

    // Trilha ambiente: pads de acordes longos + sinos esparsos, agendados no relógio do áudio
    startAmbient() {
      if (!this.ctx || this.ambient) return;
      const c = this.ctx;

      // Barramento próprio da música: filtro suave -> master, com envio generoso ao reverb
      const bus = c.createGain();
      bus.gain.value = 0.0001;
      const filt = c.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 950;
      filt.Q.value = 0.4;
      filt.connect(bus).connect(this.master);
      if (this.verb) {
        const send = c.createGain();
        send.gain.value = 0.85;
        bus.connect(send).connect(this.verb);
      }

      this.ambient = { bus, filt };
      this.chordIdx = 0;
      this.nextChordTime = c.currentTime + 0.3;
      this.nextBellTime = c.currentTime + 2.5;
      this._musTimer = setInterval(() => this._scheduleMusic(), 250);

      bus.gain.setTargetAtTime(this._musicTarget(), c.currentTime, 1.2); // fade-in de ~3-4s
    },

    stopAmbient() {
      if (!this.ambient || !this.ctx) return;
      clearInterval(this._musTimer);
      this._musTimer = null;
      const bus = this.ambient.bus;
      this.ambient = null;
      bus.gain.cancelScheduledValues(this.ctx.currentTime);
      bus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 1.1); // fade-out de ~3-4s
    },

    _musicTarget() {
      const s = this._musState;
      const base = s === "playing" ? 0.9 : s === "paused" ? 0.38 : s === "ready" ? 0.5 : 0.0001;
      return base * this.musVol;
    },

    setVol(v) {
      this.vol = Math.max(0, Math.min(1, v));
      if (this.master) this.master.gain.value = 0.55 * this.vol;
    },

    setMusicVol(v) {
      this.musVol = Math.max(0, Math.min(1, v));
    },

    // Agenda acordes e sinos à frente do tempo (lookahead), sem setTimeout no timing musical
    _scheduleMusic() {
      if (!this.ctx || !this.ambient) return;
      const horizon = this.ctx.currentTime + 1.4;
      while (this.nextChordTime < horizon) {
        if (this._musState !== "over") this._playChord(this.nextChordTime);
        this.nextChordTime += CHORD_DUR;
      }
      while (this.nextBellTime < horizon) {
        if (this._musState !== "over") this._playBell(this.nextBellTime);
        this.nextBellTime += this._nextBellGap();
      }
    },

    _playChord(t0) {
      const notes = CHORDS[this.chordIdx % CHORDS.length];
      const bass = BASS[this.chordIdx % BASS.length];
      this.chordIdx++;
      const end = t0 + CHORD_DUR + 3.2; // release longo que abraça o próximo acorde
      for (let i = 0; i < notes.length; i++) {
        this._padVoice(notes[i], t0, end, 0.04, "sine", 3);     // corpo
        this._padVoice(notes[i], t0, end, 0.03, "triangle", -4); // textura
        if (this._musTier >= 1) this._padVoice(notes[i] * 2, t0, end, 0.01, "sine", 6); // shimmer (nível 6+)
      }
      // Pad de baixo sutil, apenas enquanto joga
      if (this._musState === "playing") this._padVoice(bass, t0, end, 0.05, "sine", 0);
    },

    _padVoice(freq, t0, end, vol, type, detune) {
      const c = this.ctx;
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 1.5);              // attack longo (pad etéreo)
      g.gain.setValueAtTime(vol, Math.max(t0 + 1.6, end - 3.3));  // sustain
      g.gain.exponentialRampToValueAtTime(0.0001, end);           // release ainda mais longo
      o.connect(g).connect(this.ambient.filt);
      o.start(t0);
      o.stop(end + 0.05);
    },

    _playBell(t0) {
      const c = this.ctx;
      let f = BELLS[(Math.random() * BELLS.length) | 0];
      const r = Math.random();
      if (r < 0.22) f *= 2;       // uma oitava acima
      else if (r < 0.3) f *= 0.5; // uma oitava abaixo
      const dur = 2.6 + Math.random() * 1.2;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.03, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      if (c.createStereoPanner) { // espalha os sinos no campo estéreo
        const pan = c.createStereoPanner();
        pan.pan.value = (Math.random() * 2 - 1) * 0.55;
        g.connect(pan).connect(this.ambient.filt);
      } else {
        g.connect(this.ambient.filt);
      }
      const parts = [[1, 1]];
      if (this._musTier >= 2) parts.push([2.756, 0.22], [5.404, 0.1]); // timbre de sino mais rico (nível 11+)
      for (const [m, v] of parts) {
        const o = c.createOscillator();
        o.type = "sine";
        o.frequency.value = f * m;
        const og = c.createGain();
        og.gain.value = v;
        o.connect(og).connect(g);
        o.start(t0);
        o.stop(t0 + dur + 0.05);
      }
    },

    _nextBellGap() {
      const s = this._musState;
      if (s === "playing") return 1 + Math.random() * 1.8;
      if (s === "paused") return 3.2 + Math.random() * 3;
      return 3 + Math.random() * 3.5; // menu: bem esparso
    },

    // Game over: a trilha some rápido e dá lugar a um Am com nona menor, cheio de reverb
    _musicGameOver() {
      if (!this.ambient) return;
      const c = this.ctx;
      const t = c.currentTime;
      this.ambient.bus.gain.cancelScheduledValues(t);
      this.ambient.bus.gain.setTargetAtTime(0.0001, t, 0.18);

      const notes = [110.0, 164.81, 233.08, 261.63]; // A E Bb C
      const t0 = t + 0.35;
      const dur = 3.6;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.15, t0 + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      g.connect(this.master);
      if (this.verb) {
        const send = c.createGain();
        send.gain.value = 1;
        g.connect(send).connect(this.verb);
      }
      notes.forEach((f, i) => {
        const o = c.createOscillator();
        o.type = i < 2 ? "sine" : "triangle";
        o.frequency.value = f;
        o.detune.value = (i - 1.5) * 3;
        const og = c.createGain();
        og.gain.value = i === 2 ? 0.32 : 0.38; // destaca a nona menor
        o.connect(og).connect(g);
        o.start(t0);
        o.stop(t0 + dur + 0.1);
      });
    },

    // Ao reiniciar após o game over, a trilha retorna suavemente
    _musicResume() {
      if (!this.ambient) return;
      const t = this.ctx.currentTime;
      this.nextChordTime = t + 0.3;
      this.nextBellTime = t + 2;
      this.ambient.bus.gain.setTargetAtTime(this._musicTarget(), t, 1.2);
    },

    // Loops contínuos: "deslize" (ruído filtrado) e "tensão" (tom agudo sutil)
    startLoops() {
      if (!this.ctx || this.loops) return;
      const c = this.ctx;
      const len = c.sampleRate;
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filt = c.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 500;
      const g = c.createGain();
      g.gain.value = 0.0001;
      src.connect(filt).connect(g).connect(this.master);
      src.start();
      const to = c.createOscillator();
      to.type = "sine";
      to.frequency.value = 1244;
      const tg = c.createGain();
      tg.gain.value = 0.0001;
      to.connect(tg).connect(this.master);
      to.start();
      this.loops = { src, filt, g, to, tg };
    },

    // Mix dinâmica: trilha reage ao estado; whoosh segue a velocidade; tensão segue a parede
    updateDynamics(stateNow, interval, lvl, near) {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;

      // Transições de estado da trilha
      if (stateNow !== this._musState) {
        const was = this._musState;
        this._musState = stateNow;
        if (this.ambient) {
          if (stateNow === "over") this._musicGameOver();
          else if (stateNow === "playing" && was === "over") this._musicResume();
        }
      }
      if (this.ambient && stateNow !== "over") {
        this.ambient.bus.gain.setTargetAtTime(this._musicTarget(), t, 0.9);
      }
      if (lvl !== this._lastLvl) {
        this._lastLvl = lvl;
        this._musTier = Math.min(3, Math.floor((lvl - 1) / 5)); // novo timbre a cada 5 níveis
      }

      // Loops de gameplay (deslize e tensão perto da parede)
      if (this.loops) {
        const speedK = clamp((150 - interval) / (150 - 65), 0, 1); // 0 = lento, 1 = máx.
        const slideT = stateNow === "playing" ? 0.018 + speedK * 0.016 : 0.0001;
        this.loops.g.gain.setTargetAtTime(slideT, t, 0.15);
        this.loops.filt.frequency.setTargetAtTime(420 + speedK * 950, t, 0.15);
        const tensT = stateNow === "playing" ? near * 0.035 : 0.0001;
        this.loops.tg.gain.setTargetAtTime(tensT, t, 0.2);
      }
    },

    // Efeitos do jogo
    tick(nx, ny) { // tom varia levemente conforme a direção
      const base = nx === 1 ? 300 : nx === -1 ? 275 : ny === -1 ? 325 : 250;
      this.tone({ f0: base, f1: base * 0.9, dur: 0.035, vol: 0.04, wet: 0.1 });
    },
    eat() {
      const m = Math.pow(2, ((Math.random() * 2 - 1) * 2) / 12); // ±2 semitons, nunca repetitivo
      this.tone({ f0: 523 * m, dur: 0.06, type: "triangle", vol: 0.2, wet: 0.12 });
      this.tone({ f0: 784 * m, dur: 0.11, type: "triangle", vol: 0.18, delay: 0.05, wet: 0.18 });
      this.tone({ f0: 1568 * m, dur: 0.07, vol: 0.06, delay: 0.05, wet: 0.3 });
    },
    levelUp() { // arpejo ascendente ao subir de nível
      [523.25, 659.25, 783.99].forEach((f, i) =>
        this.tone({ f0: f, dur: 0.1, type: "triangle", vol: 0.15, delay: i * 0.07, wet: 0.3 }));
    },
    pause() { this.tone({ f0: 392, f1: 262, dur: 0.12, vol: 0.11, wet: 0.25 }); },
    unpause() { this.tone({ f0: 262, f1: 392, dur: 0.12, vol: 0.11, wet: 0.25 }); },
    over() { // impacto + descida dramática com eco e fade longo
      this.noise(0.3, 0.22, 350, 0.3);
      [220, 174.61, 146.83, 110].forEach((f, i) =>
        this.tone({ f0: f, dur: 0.32, type: "triangle", vol: 0.16, delay: 0.08 + i * 0.17, attack: 0.015, wet: 0.45 }));
      this.tone({ f0: 130.81, f1: 55, dur: 1.6, vol: 0.2, delay: 0.7, attack: 0.02, wet: 0.5 });
    },
    record() { // fanfarra: arpejo maior + acorde final + brilho agudo
      const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      seq.forEach((f, i) => this.tone({ f0: f, dur: 0.13, vol: 0.15, delay: i * 0.085, wet: 0.32 }));
      [1046.5, 1318.5].forEach((f) => this.tone({ f0: f, dur: 0.5, vol: 0.11, delay: 0.46, wet: 0.4 }));
      this.tone({ f0: 2093, dur: 0.7, vol: 0.07, delay: 0.55, wet: 0.5 });
    },
    bonus() { // bônus de combo: brilho duplo curto
      this.tone({ f0: 880, dur: 0.06, type: "triangle", vol: 0.16, wet: 0.2 });
      this.tone({ f0: 1318.5, dur: 0.1, vol: 0.12, delay: 0.05, wet: 0.3 });
    },
    gold() { // gema dourada: arpejo ascendente reluzente
      [1046.5, 1318.5, 1568].forEach((f, i) =>
        this.tone({ f0: f, dur: 0.09, type: "triangle", vol: 0.14, delay: i * 0.055, wet: 0.3 }));
    },
    speed() { // raio: descida veloz com chiado
      this.tone({ f0: 1400, f1: 900, dur: 0.09, type: "square", vol: 0.07, wet: 0.35 });
      this.tone({ f0: 1244.5, f1: 830.6, dur: 0.12, vol: 0.13, delay: 0.05, wet: 0.35 });
    },
    recordHint() { // superou o recorde durante a partida
      this.tone({ f0: 1046.5, dur: 0.09, vol: 0.12, wet: 0.3 });
      this.tone({ f0: 1568, dur: 0.18, vol: 0.1, delay: 0.07, wet: 0.4 });
    },
    nearRecord() { // alerta suave: recorde está próximo
      this.tone({ f0: 659.25, f1: 783.99, dur: 0.16, vol: 0.1, wet: 0.3 });
    },
    achieve() { // conquista desbloqueada
      this.tone({ f0: 987.77, dur: 0.12, vol: 0.14, wet: 0.3 });
      this.tone({ f0: 1318.5, dur: 0.2, vol: 0.12, delay: 0.07, wet: 0.35 });
    },
  };

  // Desbloqueia o áudio no primeiro gesto do usuário (exigência dos navegadores)
  ["pointerdown", "keydown", "touchstart"].forEach((evt) =>
    window.addEventListener(evt, () => sfx.ensure(), { passive: true })
  );

  function applySoundState() {
    btnSound.classList.toggle("muted", !sfx.enabled);
    btnSound.setAttribute("aria-pressed", String(sfx.enabled));
    if (optSound) optSound.checked = sfx.enabled;
  }
  function applyAmbientState() {
    btnAmbient.classList.toggle("muted", !sfx.ambOn);
    btnAmbient.setAttribute("aria-pressed", String(sfx.ambOn));
    if (optMusic) optMusic.checked = sfx.ambOn;
  }
  applySoundState();
  applyAmbientState();

  /* ================= Preferências visuais (FX) ================= */
  const FX_P_KEY = "snakeFxParticles";
  const FX_V_KEY = "snakeFxVisual";
  const RM_KEY = "snakeReducedMotion";
  const mqReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  let fxParticles = loadPref(FX_P_KEY, true);
  let fxVisual = loadPref(FX_V_KEY, true);
  let reducedMotion = loadPref(RM_KEY, !!(mqReduce && mqReduce.matches));

  function applyFxPrefs() {
    document.body.classList.toggle("no-vfx", !fxVisual);
    document.body.classList.toggle("rm", reducedMotion);
  }
  applyFxPrefs();

  // Ações compartilhadas entre os botões do HUD e os toggles das configurações
  function setSound(on) {
    sfx.enabled = on;
    savePref(SFX_KEY, on);
    if (on) {
      sfx.ensure();
      if (sfx.master) sfx.master.gain.value = 0.55 * (sfx.vol || 1);
      sfx.unpause(); // retorno audível
    } else {
      if (sfx.master) sfx.master.gain.value = 0;
      sfx.stopAmbient();
    }
    applySoundState();
    syncSettingsControls();
  }
  function setAmbient(on) {
    sfx.ambOn = on;
    savePref(AMB_KEY, on);
    if (on) { sfx.ensure(); sfx.startAmbient(); }
    else sfx.stopAmbient();
    applyAmbientState();
    syncSettingsControls();
  }

  function setSfxVol(v) {
    sfx.setVol(v / 100);
    saveVol(SFX_VOL_KEY, v);
    if (sfxVolVal) sfxVolVal.textContent = Math.round(v) + "%";
  }
  function setMusicVol(v) {
    sfx.setMusicVol(v / 100);
    saveVol(MUS_VOL_KEY, v);
    if (musicVolVal) musicVolVal.textContent = Math.round(v) + "%";
  }

  /* ================= Conquistas ================= */
  const ACH_KEY = "snakeAchievements";
  const STATS_KEY = "snakeStats";

  function loadStats() {
    try {
      const s = JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
      return {
        eaten: s.eaten | 0,
        games: s.games | 0,
        best: s.best | 0,
        maxLevel: Math.max(1, s.maxLevel | 0),
        maxSize: Math.max(3, s.maxSize | 0),
        maxCombo: s.maxCombo | 0,
        golds: s.golds | 0,
        turbos: s.turbos | 0,
        ms: s.ms | 0,
      };
    } catch (e) {
      return { eaten: 0, games: 0, best: 0, maxLevel: 1, maxSize: 3, maxCombo: 0, golds: 0, turbos: 0, ms: 0 };
    }
  }
  function saveStats() {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) { /* ignore */ }
  }
  function loadAchievements() {
    try { return JSON.parse(localStorage.getItem(ACH_KEY) || "{}"); } catch (e) { return {}; }
  }
  function saveAchievements() {
    try { localStorage.setItem(ACH_KEY, JSON.stringify(unlocked)); } catch (e) { /* ignore */ }
  }

  const stats = loadStats();
  const unlocked = loadAchievements();

  const ACHIEVEMENTS = [
    { id: "first", name: "Primeira maçã", desc: "Comeu a primeira maçã" },
    { id: "ten", name: "Lanche rápido", desc: "10 maçãs comidas (acumulado)" },
    { id: "fifty", name: "Apetite lendário", desc: "50 maçãs comidas (acumulado)" },
    { id: "lvl5", name: "Velocista", desc: "Chegou ao nível 5" },
    { id: "record", name: "Lenda do tabuleiro", desc: "Superou o recorde" },
    { id: "gold10", name: "Colecionador de joias", desc: "Pegou 10 gemas douradas" },
    { id: "turbo5", name: "Turbinado", desc: "Ativou o turbo 5 vezes" },
  ];

  function checkAchievements(s) {
    for (const a of ACHIEVEMENTS) {
      if (unlocked[a.id]) continue;
      let hit = false;
      if (a.id === "first") hit = s.totalEaten >= 1;
      else if (a.id === "ten") hit = s.totalEaten >= 10;
      else if (a.id === "fifty") hit = s.totalEaten >= 50;
      else if (a.id === "lvl5") hit = s.level >= 5;
      else if (a.id === "record") hit = !!s.record;
      else if (a.id === "gold10") hit = (s.golds | 0) >= 10;
      else if (a.id === "turbo5") hit = (s.turbos | 0) >= 5;
      if (!hit) continue;
      unlocked[a.id] = true;
      saveAchievements();
      showToast(a.name, a.desc);
      sfx.achieve();
    }
  }

  function showToast(name, desc) {
    const el = document.createElement("div");
    el.className = "toast";
    const dot = document.createElement("span");
    dot.className = "t-dot";
    const box = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = name;
    const small = document.createElement("small");
    small.textContent = desc;
    box.appendChild(strong);
    box.appendChild(small);
    el.appendChild(dot);
    el.appendChild(box);
    toastStack.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 350);
    }, 3200);
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ================= Placar global ================= */
  const LB_NAME_KEY = "snakeNick";
  const lbCacheKey = "snakeTop";
  let globalRecord = null; // null = desconhecido/sem backend
  let globalTop = [];
  let lbLastPush = 0;

  function lbEnabled() {
    if (!SUPABASE_URL || !SUPABASE_ANON || typeof fetch === "undefined") return false;
    try { return true; } catch (e) { return false; }
  }
  function loadNick() {
    try { return (localStorage.getItem(LB_NAME_KEY) || "").trim().slice(0, 12); }
    catch (e) { return ""; }
  }
  function saveNick(v) {
    try { localStorage.setItem(LB_NAME_KEY, String(v || "").trim().slice(0, 12)); }
    catch (e) { /* armazenamento indisponível */ }
  }

  async function lbFetch(path, opts) {
    const headers = Object.assign({
      apikey: SUPABASE_ANON,
      Authorization: "Bearer " + SUPABASE_ANON,
      Accept: "application/json"
    }, opts && opts.headers);
    const res = await fetch(path, Object.assign({ headers }, opts));
    if (!res.ok) throw new Error("HTTP " + res.status);
    if (opts && opts.method && opts.method !== "GET") return;
    return res.json();
  }

  async function loadGlobalLeaderboard() {
    if (!lbEnabled()) { renderLeaderboard(); return; }
    try {
      const rows = await lbFetch(
        SUPABASE_URL + "/rest/v1/records?select=name,score,level,created_at&order=score.desc&limit=12"
      );
      if (Array.isArray(rows)) {
        globalTop = rows.map(r => ({
          name: String(r.name || "Jogador").slice(0, 12),
          score: Math.max(0, r.score | 0),
          level: Math.max(1, r.level | 0),
          date: r.created_at || null
        }));
        globalRecord = globalTop.length ? globalTop[0].score : 0;
        try { localStorage.setItem(lbCacheKey, JSON.stringify({ top: globalTop, at: Date.now() })); }
        catch (e) { /* offline */ }
        updateGlobalHud();
        renderLeaderboard();
      }
    } catch (e) {
      // offline/inoperante: mantém o que cacheou da última vez
      try {
        const cached = JSON.parse(localStorage.getItem(lbCacheKey) || "null");
        if (cached && Array.isArray(cached.top) && cached.top.length) {
          globalTop = cached.top;
          globalRecord = globalTop[0].score;
          updateGlobalHud();
          renderLeaderboard();
        }
      } catch (e2) { /* sem cache */ }
    }
  }

  function updateGlobalHud() {
    if (!globalScoreEl) return;
    globalScoreEl.textContent = globalRecord === null ? "—" : String(globalRecord);
    globalScoreEl.classList.toggle("pop", false);
  }

  // Só publica quem BATE o recorde mundial (com throttle ~15s); nunca bloqueia o loop.
  async function pushGlobalScore(score, level) {
    if (!lbEnabled() || !(score > 0)) return;
    const now = Date.now();
    if (now - lbLastPush < 15000) return;
    // busca o recorde atual na hora: só publica quem realmente o bateu
    let cur;
    try {
      const rows = await lbFetch(SUPABASE_URL + "/rest/v1/records?select=score&order=score.desc&limit=1");
      cur = (Array.isArray(rows) && rows.length && rows[0].score) | 0;
    } catch (e) { return; } // sem conexão: não dá para saber o recorde, fica local
    globalRecord = cur;
    updateGlobalHud();
    if (score <= cur) return; // não bateu o recorde mundial, não entra no placar
    lbLastPush = now;
    const name = loadNick() || "Jogador";
    fetch(SUPABASE_URL + "/rest/v1/records", {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: "Bearer " + SUPABASE_ANON,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ name, score: Math.round(score), level: level | 0 })
    }).then(() => {
      loadGlobalLeaderboard();
      showToast("Novo recorde mundial!", "Sua pontuação foi publicada no placar global.");
    }).catch(() => { /* sem conexão: fica só local */ });
  }

  function renderLeaderboard() {
    const list = document.getElementById("leaderboardList");
    if (!list) return;
    list.textContent = "";
    if (!lbEnabled()) {
      const li = document.createElement("li");
      li.className = "lb-item lb-empty";
      li.textContent = "Placar online desativado: cole as chaves do Supabase em script.js.";
      list.appendChild(li);
      return;
    }
    if (!globalTop.length) {
      const li = document.createElement("li");
      li.className = "lb-item lb-empty";
      li.textContent = "Só entra no placar quem bater o recorde mundial — seja o primeiro!";
      list.appendChild(li);
      return;
    }
    const medals = ["lb-gold", "lb-silver", "lb-bronze"];
    globalTop.slice(0, 10).forEach((r, i) => {
      const li = document.createElement("li");
      li.className = "lb-item";
      const rank = document.createElement("span");
      rank.className = "lb-rank" + (medals[i] ? " " + medals[i] : "");
      rank.textContent = "#" + (i + 1);
      const name = document.createElement("span");
      name.className = "lb-name";
      name.textContent = r.name;
      const lvl = document.createElement("span");
      lvl.className = "lb-level";
      lvl.textContent = "Nv " + r.level;
      const meta = document.createElement("small");
      meta.className = "lb-meta";
      meta.textContent = r.date ? new Date(r.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
      li.appendChild(rank);
      li.appendChild(name);
      li.appendChild(meta);
      li.appendChild(lvl);
      const pts = document.createElement("strong");
      pts.className = "lb-score";
      pts.textContent = r.score;
      li.appendChild(pts);
      list.appendChild(li);
    });
  }

  /* ================= Estado ================= */
  let snake, prevSnake, dir, inputQueue;
  let food, foodBornAt;
  let score, highScore, lastStep;
  let level, spawnAt, headPx;
  let floats, eatStreak, wallK, prevBest, recordWarned, liveRecord, runEaten, runMaxStreak, runMs;
  let levelFlash = 0, levelFlashColor = "167, 139, 250", biomeTint = null;
  let state; // 'ready' | 'playing' | 'resuming' | 'paused' | 'over'
  let particles, flashes, trail;
  let obstacles = [];
  let lastEatAt = 0;
  let speedLeft = 0;
  let speedActive = false;
  let statsTimer = null;
  let foodExpiresAt = Number.MAX_SAFE_INTEGER;
  let lastBiomeIdx = -1;
  let freezeUntil = 0;
  let resumeStart = 0;
  let cellSize = 20;
  let bgGrad = null, vignetteGrad = null;
  let deathToken = 0;
  let overAt = 0;          // timestamp da morte (slow-motion da explosão)
  let lastChewAt = -9999;  // último instante em que a cobra comeu (squash da cabeça)
  let energyPulseAt = -9999; // último pulso de energia disparado ao comer
  let shareText = "";      // resultado da partida pronto para compartilhar

  highScore = storage.get();
  highScoreEl.textContent = highScore;
  state = "ready";

  /* ================= Núcleo do jogo ================= */
  function resetGame() {
    const c = Math.floor(GRID / 2);
    snake = [{ x: c, y: c }, { x: c - 1, y: c }, { x: c - 2, y: c }];
    prevSnake = snake.map(s => ({ ...s }));
    dir = { x: 1, y: 0 };
    inputQueue = [];
    score = 0;
    level = 1;
    particles = [];
    flashes = [];
    trail = [];
    floats = [];
    eatStreak = 0;
    wallK = 0;
    prevBest = highScore;
    recordWarned = false;
    liveRecord = false;
    levelFlash = 0;
    runEaten = 0;
    runMaxStreak = 0;
    runMs = 0;
    obstacles = [];
    lastEatAt = 0;
    speedLeft = 0;
    speedActive = false;
    freezeUntil = 0;
    overAt = 0;
    lastChewAt = -9999;
    energyPulseAt = -9999;
    if (levelBanner) levelBanner.classList.remove("show");
    if (countdownEl) countdownEl.classList.add("hidden");
    refreshBiome();
    updateScore(0);
    placeFood();
    spawnObstacles(level);
    lastStep = performance.now();
    spawnAt = lastStep;
    headPx = null;
    // Anel de "nascimento" no centro do tabuleiro
    flashes.push({ x: (GRID * cellSize) / 2, y: (GRID * cellSize) / 2, r: cellSize, alpha: 0.55, w: 2, spd: cellSize * 0.16, color: "163, 230, 53" });
  }

  function stepInterval() {
    const base = Math.max(MIN_SPEED, START_SPEED - score * SPEEDUP);
    return speedActive ? Math.max(40, base * SPEED_FACTOR) : base;
  }

  function step() {
    prevSnake = snake.map(s => ({ ...s }));
    if (inputQueue.length) dir = inputQueue.shift();

    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // Colisão com parede
    if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID) return gameOver();

    // Colisão com obstáculo
    if (obstacles.some(o => o.x === head.x && o.y === head.y)) return gameOver();

    const grows = food !== null && head.x === food.x && head.y === food.y;
    // Se não for crescer, a cauda sairá do caminho: não conta como colisão
    const body = grows ? snake : snake.slice(0, -1);
    if (body.some(s => s.x === head.x && s.y === head.y)) return gameOver();

    snake.unshift(head);

    if (grows) {
      const nowEat = performance.now();
      if (nowEat - lastEatAt <= COMBO_WINDOW) eatStreak++;
      else eatStreak = 1;
      lastEatAt = nowEat;
      runEaten++;
      runMaxStreak = Math.max(runMaxStreak, eatStreak);
      const kind = food.kind || "apple";
      lastChewAt = performance.now();
      energyPulseAt = lastChewAt;
      stats.eaten++;
      if (kind === "gold") stats.golds++;
      else if (kind === "speed") stats.turbos++;
      saveStatsSoon();

      const basePts = kind === "gold" ? GOLD_POINTS : kind === "speed" ? SPEED_POINTS : FOOD_POINTS;
      const mult = comboMult(eatStreak);
      const gained = Math.round(basePts * mult);
      updateScore(score + gained);
      if (kind === "gold") sfx.gold();
      else if (kind === "speed") sfx.speed();
      else sfx.eat();
      if (kind === "gold") vibe([50, 40, 60]);
      else if (kind === "speed") vibe([30, 50, 30]);
      spawnEatEffect(head, kind);
      if (kind === "speed") activateSpeed();
      // Texto flutuante de pontos
      floats.push({
        x: head.x * cellSize + cellSize / 2,
        y: head.y * cellSize + cellSize * 0.2,
        text: `+${gained}`,
        life: 1,
        color: kind === "gold" ? "#fde047" : kind === "speed" ? "#38bdf8" : "#d9f99d",
      });
      // Combo: sequência sem pausas multiplica os pontos
      if (mult > 1) {
        sfx.bonus();
        floats.push({
          x: head.x * cellSize + cellSize / 2,
          y: head.y * cellSize - cellSize * 0.3,
          text: `COMBO ×${fmtMult(mult)}`,
          life: 1.2,
          color: "#c4b5fd",
        });
        flashes.push({ x: head.x * cellSize + cellSize / 2, y: head.y * cellSize + cellSize / 2, r: cellSize * 0.3, alpha: 0.6, w: 2, spd: cellSize * 0.12, color: "196, 181, 253" });
      }
      checkAchievements({ totalEaten: stats.eaten, level, golds: stats.golds, turbos: stats.turbos });
      placeFood();
    } else {
      snake.pop();
    }
  }

  function placeFood(forcePlain) {
    let p = null;
    const occupied = (x, y) =>
      snake.some(s => s.x === x && s.y === y) ||
      obstacles.some(o => o.x === x && o.y === y);
    // Até 50 sorteios aleatórios; se não achar, varre a grade inteira.
    // Se não houver nenhuma célula livre (cobra preencheu o tabuleiro), food = null.
    for (let i = 0; i < 50; i++) {
      const c = { x: (Math.random() * GRID) | 0, y: (Math.random() * GRID) | 0 };
      if (!occupied(c.x, c.y)) { p = c; break; }
    }
    if (!p) {
      for (let y = 0; y < GRID && !p; y++) {
        for (let x = 0; x < GRID && !p; x++) {
          if (!occupied(x, y)) p = { x, y };
        }
      }
    }
    if (!p) { food = null; return; } // tabuleiro 100% cheio
    let kind = "apple";
    if (!forcePlain) {
      const r = Math.random();
      if (speedActive) {
        // Durante o turbo, só existe a gema dourada além da maçã comum
        if (r < 0.12) kind = "gold";
      } else if (r < 0.10) kind = "speed";
      else if (r < 0.22) kind = "gold";
    }
    food = { ...p, kind };
    foodBornAt = performance.now();
    foodExpiresAt = kind === "apple" ? Number.MAX_SAFE_INTEGER : performance.now() + FOOD_LIFETIME;
  }

  /* ================= Combo, turbo e obstáculos ================= */
  function comboMult(streak) {
    return Math.min(1 + (streak - 1) * COMBO_STEP, COMBO_MAX);
  }

  function fmtMult(m) {
    if (Number.isInteger(m)) return String(m);
    return m.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  function hideChips() {
    if (comboChip) comboChip.classList.add("hidden");
    if (speedChip) speedChip.classList.add("hidden");
  }

  function updateComboChip(now) {
    if (!comboChip) return;
    if (eatStreak > 0 && state === "playing") {
      const remain = 1 - clamp((now - lastEatAt) / COMBO_WINDOW, 0, 1);
      const mult = comboMult(eatStreak);
      if (mult > 1) {
        comboChip.classList.remove("hidden");
        comboText.textContent = `Combo ${eatStreak} ×${fmtMult(mult)}`;
        if (comboBarFill) comboBarFill.style.transform = `scaleX(${remain.toFixed(3)})`;
      } else {
        comboChip.classList.add("hidden");
      }
      if (remain <= 0) { eatStreak = 0; comboChip.classList.add("hidden"); }
    } else {
      comboChip.classList.add("hidden");
    }
  }

  function activateSpeed() {
    speedLeft = SPEED_BOOST_MS;
    speedActive = true;
  }

  function updateSpeedChip(dt) {
    if (!speedChip) return;
    if (speedActive && state === "playing") {
      speedLeft -= dt;
      if (speedLeft <= 0) {
        speedActive = false;
        speedChip.classList.add("hidden");
        return;
      }
      speedTime.textContent = `${Math.max(1, Math.ceil(speedLeft / 1000))}s`;
      speedChip.classList.remove("hidden");
    } else {
      speedChip.classList.add("hidden");
    }
  }

  // Obstáculos a partir do nível 3, sempre em células pares-pares (corredores livres)
  function spawnObstacles(lvl) {
    obstacles = [];
    if (lvl < 3) return;
    const count = Math.min(3 + (lvl - 3), 14);
    const c = Math.floor(GRID / 2);
    const free = (x, y) => {
      if (Math.abs(x - c) <= 2 && Math.abs(y - c) <= 2) return false; // zona central inicial
      if (snake.some(s => s.x === x && s.y === y)) return false;
      if (food && food.x === x && food.y === y) return false;
      return !obstacles.some(o => o.x === x && o.y === y);
    };
    let tries = 0;
    while (obstacles.length < count && tries < 500) {
      tries++;
      const x = (Math.random() * GRID) | 0;
      const y = (Math.random() * GRID) | 0;
      if (x % 2 !== 0 || y % 2 !== 0) continue;
      if (!free(x, y)) continue;
      obstacles.push({ x, y });
    }
  }

  // Salva totais com debounce (evita gravar no localStorage a cada maçã)
  function saveStatsSoon() {
    if (statsTimer) return;
    statsTimer = setTimeout(() => { statsTimer = null; saveStats(); }, 400);
  }

  function updateScore(v) {
    score = v;
    scoreEl.textContent = score;
    scoreEl.classList.remove("pop");
    scoreBox.classList.remove("flash");
    void scoreEl.offsetWidth; // reinicia a animação
    if (score > 0) {
      scoreEl.classList.add("pop");
      scoreBox.classList.add("flash");
      const lv = Math.floor(score / LEVEL_EVERY) + 1;
      if (lv > level) {
        level = lv;
        sfx.levelUp();
        vibe([40, 50, 60]);
        // Flash de cor no fundo + onda de energia do centro às bordas
        levelFlash = 1;
        levelFlashColor = lv % 2 ? "167, 139, 250" : "34, 211, 238";
        flashes.push({ x: (GRID * cellSize) / 2, y: (GRID * cellSize) / 2, r: cellSize, alpha: 0.7, w: 3, spd: cellSize * 0.55, color: levelFlashColor });
        refreshBiome();
        spawnObstacles(level);
        // Garante que a comida não fique presa sob um obstáculo novo
        if (food && obstacles.some(o => o.x === food.x && o.y === food.y)) placeFood();
        freezeUntil = performance.now() + 340; // hit-stop curto
        showLevelBanner(lv);
        checkAchievements({ totalEaten: stats.eaten, level });
      }
      // Alerta de recorde próximo e celebração ao superá-lo em tempo real
      if (prevBest > 0 && !recordWarned && score >= prevBest - 30 && score <= prevBest) {
        recordWarned = true;
        sfx.nearRecord();
        bestBox.classList.remove("flash");
        void bestBox.offsetWidth;
        bestBox.classList.add("flash");
      }
      if (prevBest > 0 && !liveRecord && score > prevBest) {
        liveRecord = true;
        celebrateLiveRecord();
      }
      if (score > highScore) {
        highScore = score;
        storage.set(highScore);
        highScoreEl.textContent = highScore;
      }
    }
    updateLevelHud();
  }

  function updateLevelHud() {
    levelEl.textContent = level;
    levelFill.style.transform = `scaleX(${(score % LEVEL_EVERY) / LEVEL_EVERY})`;
  }

  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  // Estatísticas da partida (tela de game over)
  function fillGameOverStats(finalLen) {
    document.getElementById("statRecord").textContent = highScore;
    document.getElementById("statLevel").textContent = level;
    document.getElementById("statSize").textContent = finalLen;
    document.getElementById("statTime").textContent = fmtTime(runMs);
    document.getElementById("statCombo").textContent = runMaxStreak + " (×" + fmtMult(comboMult(runMaxStreak)) + ")";
    document.getElementById("statFoods").textContent = runEaten;
    shareText = `Consegui ${score} pontos no SNAKE — nível ${level} e ${finalLen} segmentos!`;
  }

  // Totais acumulados (painel de configurações)
  function fillTotals() {
    document.getElementById("totGames").textContent = stats.games;
    document.getElementById("totBest").textContent = Math.max(stats.best, highScore);
    document.getElementById("totCombo").textContent = stats.maxCombo;
    document.getElementById("totLevel").textContent = stats.maxLevel;
    document.getElementById("totSize").textContent = stats.maxSize;
    document.getElementById("totTime").textContent = fmtTime(stats.ms);
    document.getElementById("totFoods").textContent = stats.eaten;
    document.getElementById("totGold").textContent = stats.golds;
    document.getElementById("totTurbo").textContent = stats.turbos;
  }

  // Transição suave das telas (fade + blur na saída também)
  function showOverlay(el) { el.classList.remove("closing"); el.classList.remove("hidden"); }
  function hideOverlay(el) {
    if (el.classList.contains("hidden")) return;
    el.classList.add("closing");
    setTimeout(() => { el.classList.add("hidden"); el.classList.remove("closing"); }, 220);
  }

  // Matiz do "bioma" muda a cada 5 níveis
  function refreshBiome() {
    const idx = Math.floor((level - 1) / 5) % BIOMES.length;
    if (idx !== lastBiomeIdx) {
      lastBiomeIdx = idx;
      if (idx > 0 && level > 1 && BIOME_NAMES[idx]) {
        showToast(BIOME_NAMES[idx], "Novo cenário: cores e obstáculos mudam");
      }
    }
    biomeTint = BIOMES[idx];
    // A moldura do tabuleiro acompanha a cor do bioma (glow em CSS)
    if (wrapper && biomeTint) wrapper.style.setProperty("--biome-rgb", biomeTint);
  }

  // Banner central de subida de nível (com hit-stop breve)
  function showLevelBanner(lv) {
    if (!levelBanner) return;
    levelBannerNum.textContent = lv;
    levelBanner.classList.remove("show");
    void levelBanner.offsetWidth;
    levelBanner.classList.add("show");
    clearTimeout(levelBanner._t);
    levelBanner._t = setTimeout(() => levelBanner.classList.remove("show"), 620);
  }

  // Celebração sutil ao superar o recorde em tempo real
  function celebrateLiveRecord() {
    sfx.recordHint();
    vibe([30, 30, 60, 30, 90]);
    highScoreEl.classList.remove("pop");
    void highScoreEl.offsetWidth;
    highScoreEl.classList.add("pop");
    const ccx = (GRID * cellSize) / 2, ccy = (GRID * cellSize) / 2;
    flashes.push({ x: ccx, y: ccy, r: cellSize, alpha: 0.6, w: 2.5, spd: cellSize * 0.4, color: "253, 224, 71" });
    if (fxParticles) for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.8 + Math.random() * 2.4;
      particles.push({
        x: ccx, y: ccy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1.2,
        size: 2 + Math.random() * 2.5,
        type: "star",
        color: "#fde047",
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.25,
      });
    }
    checkAchievements({ totalEaten: stats.eaten, level, record: true });
  }

  function gameOver() {
    state = "over";
    overAt = performance.now();
    freezeUntil = 0;
    if (countdownEl) countdownEl.classList.add("hidden");
    if (levelBanner) levelBanner.classList.remove("show");
    sfx.stopAmbient();
    sfx.over();
    vibe([180, 70, 140]);
    const finalLen = snake.length; // captura antes de dissolver
    // Impacto: flash vermelho + onda de choque branca na cabeça
    if (snake.length) {
      levelFlash = 1;
      levelFlashColor = "251, 113, 133";
      const hx = snake[0].x * cellSize + cellSize / 2;
      const hy = snake[0].y * cellSize + cellSize / 2;
      flashes.push({ x: hx, y: hy, r: cellSize * 0.3, alpha: 0.9, w: 3, spd: cellSize * 0.24, color: "255, 255, 255" });
    }
    dissolveSnake();
    wrapper.classList.remove("shake", "danger");
    void wrapper.offsetWidth;
    wrapper.classList.add("shake", "danger");

    const isRecord = score > prevBest;
    if (isRecord) {
      highScore = score;
      storage.set(highScore);
      highScoreEl.textContent = highScore;
    }

    finalScoreEl.textContent = score;
    newRecordBadge.classList.toggle("hidden", !isRecord);
    if (isRecord) setTimeout(() => sfx.record(), 700);
    checkAchievements({ totalEaten: stats.eaten, level, record: isRecord });

    // Placar global: badge de superação do recorde mundial + envio com throttle
    const isGlobalRecord = score > 0 && globalRecord !== null && score > globalRecord;
    if (newGlobalRecordBadge) newGlobalRecordBadge.classList.toggle("hidden", !isGlobalRecord);
    const diff = globalRecord !== null ? globalRecord - score : 0;
    const showHint = lbEnabled() && globalRecord !== null && score > 0 && diff > 0;
    if (globalHintEl) {
      globalHintEl.classList.toggle("hidden", !showHint);
      if (showHint) globalHintEl.textContent = "Faltam " + diff + " pontos para bater o recorde mundial — bora!";
    }
    pushGlobalScore(score, level);

    // Persiste totais acumulados da partida
    stats.games++;
    stats.best = Math.max(stats.best, score);
    stats.maxLevel = Math.max(stats.maxLevel, level);
    stats.maxSize = Math.max(stats.maxSize, finalLen);
    stats.maxCombo = Math.max(stats.maxCombo, runMaxStreak);
    stats.ms += Math.round(runMs);
    saveStats();
    hideChips();
    fillGameOverStats(finalLen);

    const token = ++deathToken;
    setTimeout(() => {
      if (state === "over" && token === deathToken) {
        showOverlay(overlayGameOver);
        // Foco vai para o primeiro botão: leitores de tela anunciam o fim da partida
        if (btnPlayAgain && btnPlayAgain.focus) {
          try { btnPlayAgain.focus({ preventScroll: true }); } catch (e) { btnPlayAgain.focus(); }
        }
      }
    }, 650);
  }

  /* ================= Fluxo / controles ================= */
  function startGame() {
    resetGame();
    state = "playing";
    hideOverlay(overlayStart);
    hideOverlay(overlayGameOver);
    hideOverlay(overlayPause);
    btnPause.textContent = "Pausar";
    lastStep = performance.now();
  }

  function resume() {
    if (state !== "paused") return;
    state = "resuming";
    resumeStart = performance.now();
    freezeUntil = resumeStart + RESUME_FREEZE + 200;
    hideOverlay(overlayPause);
    btnPause.textContent = "Pausar";
    if (countdownEl) {
      countdownEl.classList.remove("hidden");
      countdownEl.textContent = "3";
      countdownEl.classList.remove("pulse");
      void countdownEl.offsetWidth;
      countdownEl.classList.add("pulse");
    }
  }

  function togglePause() {
    if (state === "playing" || state === "resuming") {
      state = "paused";
      showOverlay(overlayPause);
      btnPause.textContent = "Continuar";
      sfx.pause();
      eatStreak = 0; // combo exige sequência sem pausas
      hideChips();
      if (countdownEl) countdownEl.classList.add("hidden");
    } else if (state === "paused") {
      resume();
    }
  }

  function queueDirection(nx, ny) {
    if (state === "ready") startGame();
    if (state !== "playing" && state !== "resuming") return; // resuming: deixa "virar" já no 3·2·1
    const last = inputQueue.length ? inputQueue[inputQueue.length - 1] : dir;
    // Bloqueia movimento reverso e direção repetida
    if ((last.x === nx && last.y === ny) || (last.x === -nx && last.y === -ny)) return;
    if (inputQueue.length < 3) {
      inputQueue.push({ x: nx, y: ny });
      sfx.tick(nx, ny);
    }
  }

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (settingsOpen() && k !== "escape") {
      if (k === "tab") trapSettingsTab(e); // mantém o foco preso no dialog enquanto aberto
      return;
    }
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    switch (k) {
      case "escape":
        if (settingsOpen()) closeSettings();
        else if (state === "playing" || state === "paused" || state === "resuming") togglePause();
        break;
      case "arrowup": case "w": queueDirection(0, -1); break;
      case "arrowdown": case "s": queueDirection(0, 1); break;
      case "arrowleft": case "a": queueDirection(-1, 0); break;
      case "arrowright": case "d": queueDirection(1, 0); break;
      case " ": case "spacebar": togglePause(); break;
      case "enter":
        if (state === "over") startGame();
        else if (state === "ready") startGame();
        break;
    }
  });

  // Botões
  document.getElementById("btnStart").addEventListener("click", (e) => { startGame(); e.currentTarget.blur(); });
  document.getElementById("btnPlayAgain").addEventListener("click", (e) => { startGame(); e.currentTarget.blur(); });
  document.getElementById("btnResume").addEventListener("click", (e) => { resume(); e.currentTarget.blur(); });
  document.getElementById("btnRestart").addEventListener("click", (e) => { startGame(); e.currentTarget.blur(); });
  btnPause.addEventListener("click", (e) => { togglePause(); e.currentTarget.blur(); });

  // Botão de ligar/desligar som (mute geral, inclui o ambiente)
  btnSound.addEventListener("click", (e) => {
    setSound(!sfx.enabled);
    e.currentTarget.blur();
  });

  // Botão de ligar/desligar apenas a música ambiente
  btnAmbient.addEventListener("click", (e) => {
    setAmbient(!sfx.ambOn);
    e.currentTarget.blur();
  });

  /* ================= Painel de configurações ================= */
  let lastFocused = null;

  function syncSettingsControls() {
    if (!optSound) return;
    optSound.checked = sfx.enabled;
    optMusic.checked = sfx.ambOn;
    optParticles.checked = fxParticles;
    optVisual.checked = fxVisual;
    optMotion.checked = reducedMotion;
    if (optSfxVol) {
      optSfxVol.value = Math.round(sfx.vol * 100);
      if (sfxVolVal) sfxVolVal.textContent = Math.round(sfx.vol * 100) + "%";
    }
    if (optMusicVol) {
      optMusicVol.value = Math.round(sfx.musVol * 100);
      if (musicVolVal) musicVolVal.textContent = Math.round(sfx.musVol * 100) + "%";
    }
  }

  function settingsOpen() {
    return settingsBackdrop && !settingsBackdrop.classList.contains("hidden");
  }

  function openSettings() {
    if (state === "playing" || state === "resuming") togglePause(); // pausa antes de configurar
    syncSettingsControls();
    fillTotals();
    fillAchievements();
    if (optNick) optNick.value = loadNick();
    renderLeaderboard();
    loadGlobalLeaderboard();
    lastFocused = document.activeElement;
    settingsBackdrop.classList.remove("hidden");
    requestAnimationFrame(() => settingsBackdrop.classList.add("open"));
    btnCloseSettings.focus();
  }
  function closeSettings() {
    settingsBackdrop.classList.remove("open");
    setTimeout(() => settingsBackdrop.classList.add("hidden"), 230);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  if (settingsBackdrop) {
    btnSettings.addEventListener("click", (e) => { openSettings(); });
    btnCloseSettings.addEventListener("click", (e) => { closeSettings(); e.currentTarget.blur(); });
    settingsBackdrop.addEventListener("click", (e) => { if (e.target === settingsBackdrop) closeSettings(); });

    optSound.addEventListener("change", () => setSound(optSound.checked));
    optMusic.addEventListener("change", () => setAmbient(optMusic.checked));
    optParticles.addEventListener("change", () => { fxParticles = optParticles.checked; savePref(FX_P_KEY, fxParticles); });
    optVisual.addEventListener("change", () => { fxVisual = optVisual.checked; savePref(FX_V_KEY, fxVisual); applyFxPrefs(); });
    optMotion.addEventListener("change", () => { reducedMotion = optMotion.checked; savePref(RM_KEY, reducedMotion); applyFxPrefs(); });
    optSfxVol.addEventListener("input", () => setSfxVol(optSfxVol.valueAsNumber));
    optMusicVol.addEventListener("input", () => setMusicVol(optMusicVol.valueAsNumber));
    if (optNick) optNick.addEventListener("input", () => saveNick(optNick.value));
  }

  // Mantém o Tab circulando dentro do dialog de configurações (focus trap)
  function trapSettingsTab(e) {
    if (!settingsBackdrop) return;
    const focusables = settingsBackdrop.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const list = Array.prototype.filter.call(focusables, (el) => !el.disabled && el.offsetWidth > 0);
    if (list.length < 2) return;
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // Galeria de conquistas desbloqueadas (painel de configurações)
  function fillAchievements() {
    const list = document.getElementById("achievementsList");
    if (!list) return;
    list.textContent = "";
    for (const a of ACHIEVEMENTS) {
      const li = document.createElement("li");
      li.className = "ach-item" + (unlocked[a.id] ? " done" : " locked");
      const check = document.createElement("span");
      check.className = "ach-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = unlocked[a.id] ? "✓" : "";
      const t = document.createElement("span");
      t.className = "ach-t";
      const n = document.createElement("strong");
      n.textContent = a.name;
      const d = document.createElement("small");
      d.textContent = a.desc;
      t.appendChild(n);
      t.appendChild(d);
      li.appendChild(check);
      li.appendChild(t);
      list.appendChild(li);
    }
  }

  // Compartilhar resultado: Web Share API com fallback para copiar o link
  async function shareResult() {
    const text = shareText || `Consegui ${finalScoreEl ? finalScoreEl.textContent : "0"} pontos no SNAKE!`;
    const url = typeof location !== "undefined" ? location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "Snake Neon — Jogo da Cobrinha", text, url }); }
      catch (e) { /* usuário cancelou */ }
    } else if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text + (url ? " — " + url : ""));
        showToast("Link copiado", "Cole onde quiser compartilhar");
      } catch (e) {
        showToast("Não foi possível copiar", "Copie a URL manualmente");
      }
    } else {
      showToast("Não foi possível compartilhar", "Copie a URL manualmente");
    }
  }
  if (btnShare) btnShare.addEventListener("click", () => { shareResult(); });

  // PWA: cache offline do app shell (desktop e celular)
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => { /* offline indisponível */ });
    });
  }

  // Suporte a swipe (mobile)
  let touchStart = null;
  canvas.addEventListener("touchstart", (e) => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });

  canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

  canvas.addEventListener("touchend", (e) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < 20) {
      // Toque simples: inicia ou retoma
      if (state === "ready") startGame();
      else if (state === "paused") resume();
      return;
    }
    if (ax > ay) queueDirection(dx > 0 ? 1 : -1, 0);
    else queueDirection(0, dy > 0 ? 1 : -1);
  }, { passive: true });

  // D-pad virtual (botões direcionais + pausa em telas touch)
  const dpadDirs = { btnUp: [0, -1], btnDown: [0, 1], btnLeft: [-1, 0], btnRight: [1, 0] };
  for (const id of Object.keys(dpadDirs)) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      queueDirection(dpadDirs[id][0], dpadDirs[id][1]);
    });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  const btnPauseTouch = document.getElementById("btnPauseTouch");
  if (btnPauseTouch) {
    btnPauseTouch.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (state === "ready") startGame();
      else if (state === "paused") resume();
      else if (state === "playing") togglePause();
    });
  }

  /* ================= Efeitos ================= */
  function spawnEatEffect(cell, kind) {
    const cx = cell.x * cellSize + cellSize / 2;
    const cy = cell.y * cellSize + cellSize / 2;
    // Partículas variadas: estrelas, faíscas e pontos em cores diferentes
    const kinds = [
      { type: "star", color: "#fde047", n: 4 },
      { type: "spark", color: "#fda4af", n: 5 },
      { type: "dot", color: "#a3e635", n: 5 },
      { type: "dot", color: "#4ade80", n: 4 },
    ];
    if (fxParticles) for (const k of kinds) {
      for (let i = 0; i < k.n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1.2 + Math.random() * 3.4;
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 1,
          size: 1.8 + Math.random() * 3,
          type: k.type,
          color: k.color,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
        });
      }
    }
    // Explosão em anel duplo
    flashes.push({ x: cx, y: cy, r: cellSize * 0.35, alpha: 0.85, w: 2.5, spd: cellSize * 0.085, color: "163, 230, 53" });
    flashes.push({ x: cx, y: cy, r: cellSize * 0.15, alpha: 0.7, w: 1.5, spd: cellSize * 0.14, color: "253, 224, 71" });
  }

  // A cobrinha se "desmonta" em partículas no game over
  function dissolveSnake() {
    const max = Math.min(snake.length, 80);
    for (let i = 0; i < max; i++) {
      const seg = snake[i];
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 3.2;
      particles.push({
        x: seg.x * cellSize + cellSize / 2,
        y: seg.y * cellSize + cellSize / 2,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1.15,
        size: 2 + Math.random() * 3.5,
        type: "dot",
        color: Math.random() < 0.6 ? "#a3e635" : "#22c55e",
        rot: 0,
        vr: 0,
      });
    }
    snake = [];
    headPx = null;
  }

  const easeOutBack = (x) => {
    const c = 1.70158;
    const u = x - 1;
    return 1 + (c + 1) * u * u * u + c * u * u;
  };

  // Progresso da animação de entrada (cobra crescendo a partir do centro)
  function spawnT(now) {
    const a = (now - spawnAt) / 480;
    return a >= 1 ? 1 : easeOutBack(clamp(a, 0, 1));
  }

  /* ================= Renderização ================= */
  function resizeCanvas() {
    let size = canvas.clientWidth;
    if (size < 10) size = 10; // protege contra clientWidth = 0 na carga inicial
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cellSize = size / GRID;

    // Gradientes em cache: fundo escuro + vinheta nas bordas
    const sz = GRID * cellSize;
    bgGrad = ctx.createLinearGradient(0, 0, sz * 0.15, sz);
    bgGrad.addColorStop(0, "#101c2e");
    bgGrad.addColorStop(0.55, "#0a1626");
    bgGrad.addColorStop(1, "#060c17");
    vignetteGrad = ctx.createRadialGradient(sz / 2, sz / 2, sz * 0.32, sz / 2, sz / 2, sz * 0.78);
    vignetteGrad.addColorStop(0, "rgba(2, 6, 14, 0)");
    vignetteGrad.addColorStop(1, "rgba(2, 6, 14, 0.5)");
  }
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("beforeunload", () => { saveStats(); });

  // Pausa automática quando o jogo perde visibilidade/foco (nada de morrer sozinho fora da aba)
  // Nunca retoma sozinho: sessão pausada continua pausada ao voltar a aba.
  function autoPause() {
    if (state === "playing" || state === "resuming") togglePause();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) autoPause();
    else loadGlobalLeaderboard(); // ao voltar, busca o recorde mais recente dos amigos
  });
  window.addEventListener("blur", () => autoPause());
  window.addEventListener("focus", () => loadGlobalLeaderboard());

  // Vibração (mobile): eventos-chave, opcional e comedida
  function vibe(pattern) {
    if (!fxVisual || reducedMotion || typeof navigator === "undefined" || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  }

  function drawGrid(now) {
    // Linhas quase imperceptíveis
    ctx.strokeStyle = "rgba(140, 165, 195, 0.035)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < GRID; i++) {
      const p = Math.round(i * cellSize) + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, GRID * cellSize);
      ctx.moveTo(0, p);
      ctx.lineTo(GRID * cellSize, p);
    }
    ctx.stroke();

    // Pontos luminosos nos cruzamentos, com "respiração" suave
    const breath = 0.5 + 0.5 * Math.sin(now / 2400);
    ctx.fillStyle = `rgba(140, 165, 195, ${0.05 + breath * 0.07})`;
    ctx.beginPath();
    for (let gx = 1; gx < GRID; gx++) {
      for (let gy = 1; gy < GRID; gy++) {
        ctx.rect(gx * cellSize - 0.7, gy * cellSize - 0.7, 1.4, 1.4);
      }
    }
    ctx.fill();

    // Brilho central "respirando"
    const half = (GRID * cellSize) / 2;
    const cg = ctx.createRadialGradient(half, half, 0, half, half, GRID * cellSize * 0.6);
    cg.addColorStop(0, `rgba(74, 222, 128, ${0.04 + breath * 0.04})`);
    cg.addColorStop(1, "rgba(74, 222, 128, 0)");
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, GRID * cellSize, GRID * cellSize);
  }

  function drawFood(now) {
    if (!food) return; // tabuleiro cheio, nada para desenhar
    if (food.kind === "gold") { drawSpecialFood(now, "gold"); return; }
    if (food.kind === "speed") { drawSpecialFood(now, "speed"); return; }
    const age = now - foodBornAt;
    const spawn = Math.min(1, age / 180);
    const ease = 1 - Math.pow(1 - spawn, 3);
    const pulse = 1 + 0.12 * Math.sin(now / 220);
    const r = cellSize * 0.4 * pulse * ease;
    if (r <= 0) return;

    const cx = food.x * cellSize + cellSize / 2;
    const baseCy = food.y * cellSize + cellSize / 2;
    const floatY = Math.sin(now / 480) * cellSize * 0.08; // flutuação vertical suave
    const cy = baseCy + floatY;

    // Sombra projetada no "chão" (fica parada enquanto a maçã flutua)
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(cx, baseCy + cellSize * 0.34, r * 0.85, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Aura neon ao redor da comida
    const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, cellSize * 1.4);
    aura.addColorStop(0, "rgba(244, 63, 94, 0.3)");
    aura.addColorStop(1, "rgba(244, 63, 94, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 1.4, 0, Math.PI * 2);
    ctx.fill();

    // Beacon: anel expansivo periódico para localizar a comida no tabuleiro
    if (!reducedMotion) {
      const pp = ((now - foodBornAt) % 2400) / 2400;
      if (pp < 0.16) {
        const k = pp / 0.16;
        ctx.strokeStyle = `rgba(244, 63, 94, ${((1 - k) * 0.4).toFixed(3)})`;
        ctx.lineWidth = Math.max(cellSize * 0.05, 1);
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * (0.5 + k * 2.1), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.save();
    ctx.shadowColor = "rgba(244, 63, 94, 0.9)";
    ctx.shadowBlur = cellSize * 0.9;
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    g.addColorStop(0, "#fda4af");
    g.addColorStop(1, "#e11d48");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Brilho/reflexo
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.22, 0, Math.PI * 2);
    ctx.fill();

    // Faíscas orbitando a gema
    for (let i = 0; i < 3; i++) {
      const a = now / 700 + (i * Math.PI * 2) / 3;
      const sx = cx + Math.cos(a) * cellSize * 0.75;
      const sy = cy + Math.sin(a) * cellSize * 0.75;
      const tw = 0.5 + 0.5 * Math.sin(now / 160 + i * 2);
      ctx.fillStyle = `rgba(253, 224, 71, ${0.3 + 0.45 * tw})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Caule e folhinha (toque de "maçã")
    ctx.strokeStyle = "#a16207";
    ctx.lineWidth = Math.max(cellSize * 0.07, 1.2);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.85);
    ctx.lineTo(cx + r * 0.12, cy - r * 1.25);
    ctx.stroke();
    ctx.fillStyle = "#4ade80";
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.38, cy - r * 1.05, r * 0.28, r * 0.13, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Gemas especiais: dourada (pontuação alta) e raio (turbo)
  function drawSpecialFood(now, kind) {
    const gold = kind === "gold";
    const color = gold ? "#fde047" : "#67e8f9";
    const auraRgb = gold ? "253, 224, 71" : "103, 232, 249";
    const age = now - foodBornAt;
    const spawn = Math.min(1, age / 180);
    const ease = 1 - Math.pow(1 - spawn, 3);
    const pulse = 1 + 0.16 * Math.sin(now / 210);
    const r = cellSize * 0.42 * pulse * ease;
    if (r <= 0) return;

    const cx = food.x * cellSize + cellSize / 2;
    const baseCy = food.y * cellSize + cellSize / 2;
    const cy = baseCy + Math.sin(now / 460) * cellSize * 0.09;

    // Pisca quando está prestes a expirar
    const remain = foodExpiresAt - now;
    const blink = remain < 1500 ? Math.max(0.25, 0.5 + 0.5 * Math.sin(now / 110)) : 1;
    ctx.save();
    ctx.globalAlpha = blink;

    // Sombra projetada no "chão"
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(cx, baseCy + cellSize * 0.34, r * 0.85, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Aura neon mais forte que a da maçã
    const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, cellSize * 1.5);
    aura.addColorStop(0, `rgba(${auraRgb}, ${gold ? 0.36 : 0.3})`);
    aura.addColorStop(1, `rgba(${auraRgb}, 0)`);
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Beacon expansivo periódico (mesma cor do item)
    if (!reducedMotion) {
      const pp = ((now - foodBornAt) % 2400) / 2400;
      if (pp < 0.16) {
        const k = pp / 0.16;
        ctx.strokeStyle = `rgba(${auraRgb}, ${((1 - k) * 0.45).toFixed(3)})`;
        ctx.lineWidth = Math.max(cellSize * 0.05, 1);
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * (0.5 + k * 2.1), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Lens-flare: cruz de brilho girando (gema) / corrente giratória (raio)
    if (!reducedMotion) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalCompositeOperation = "lighter";
      if (gold) {
        ctx.rotate(now / 1400);
        ctx.fillStyle = "rgba(253, 224, 71, 0.45)";
        const fl = r * 2.5;
        ctx.fillRect(-fl, -r * 0.14, fl * 2, r * 0.28);
        ctx.fillRect(-r * 0.14, -fl, r * 0.28, fl * 2);
      } else {
        const la = now / 950;
        ctx.rotate(la);
        ctx.strokeStyle = `rgba(103, 232, 249, ${(0.5 + 0.3 * Math.sin(now / 260)).toFixed(3)})`;
        ctx.lineWidth = Math.max(cellSize * 0.045, 1);
        for (let i = 0; i < 6; i++) {
          const a0 = (i * Math.PI) / 3;
          const rf = r * (1.1 + 0.25 * Math.sin(now / 300 + i));
          ctx.beginPath();
          ctx.moveTo(Math.cos(a0) * r * 0.7, Math.sin(a0) * r * 0.7);
          ctx.lineTo(Math.cos(a0) * rf, Math.sin(a0) * rf);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = cellSize * 1.1;
    ctx.fillStyle = color;
    if (gold) {
      drawStar(cx, cy, r, now / 700, color);
    } else {
      // Raio (relâmpago estilizado)
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.0, cy - r * 1.1);
      ctx.lineTo(cx + r * 0.75, cy - r * 0.15);
      ctx.lineTo(cx + r * 0.15, cy - r * 0.1);
      ctx.lineTo(cx + r * 0.35, cy + r * 1.1);
      ctx.lineTo(cx - r * 0.75, cy + r * 0.15);
      ctx.lineTo(cx - r * 0.12, cy + r * 0.1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Faíscas orbitando
    for (let i = 0; i < 4; i++) {
      const a = now / 900 + (i * Math.PI) / 2;
      const sx = cx + Math.cos(a) * cellSize * 0.85;
      const sy = cy + Math.sin(a) * cellSize * 0.85;
      const tw = 0.5 + 0.5 * Math.sin(now / 140 + i * 2);
      ctx.fillStyle = `rgba(${auraRgb}, ${0.3 + 0.5 * tw})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Brilho/reflexo
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Obstáculos: blocos de aço com borda cor do bioma, pulsando suavemente
  function drawObstacles(now) {
    if (!obstacles.length) return;
    const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now / 750);
    const rgb = biomeTint || "140, 165, 195";
    for (const o of obstacles) {
      const ox = o.x * cellSize;
      const oy = o.y * cellSize;
      const inset = cellSize * 0.14;
      const pad = cellSize * 0.05 * pulse;
      const sz = cellSize - inset * 2;
      ctx.save();
      // Núcleo escuro com leve relevo
      ctx.fillStyle = "rgba(15, 26, 45, 0.95)";
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(ox + inset - pad, oy + inset - pad, sz + pad * 2, sz + pad * 2, cellSize * 0.2); ctx.fill(); }
      else ctx.fillRect(ox + inset - pad, oy + inset - pad, sz + pad * 2, sz + pad * 2);
      // Bevel de aço: brilho no canto superior e sombra no inferior (relevo 3D)
      const bv = ctx.createLinearGradient(ox, oy, ox + cellSize, oy + cellSize);
      bv.addColorStop(0, "rgba(255, 255, 255, 0.10)");
      bv.addColorStop(0.45, "rgba(255, 255, 255, 0.02)");
      bv.addColorStop(1, "rgba(0, 0, 0, 0.34)");
      ctx.fillStyle = bv;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(ox + inset - pad, oy + inset - pad, sz + pad * 2, sz + pad * 2, cellSize * 0.2); ctx.fill(); }
      else ctx.fillRect(ox + inset - pad, oy + inset - pad, sz + pad * 2, sz + pad * 2);
      // Borda neon pulsante
      ctx.strokeStyle = `rgba(${rgb}, ${0.4 + 0.4 * pulse})`;
      ctx.lineWidth = Math.max(cellSize * 0.06, 1.5);
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(ox + inset, oy + inset, sz, sz, cellSize * 0.2); ctx.stroke(); }
      else { ctx.strokeRect(ox + inset, oy + inset, sz, sz); }
      // Cruz interna sutil (reforço de aço)
      ctx.strokeStyle = `rgba(${rgb}, ${0.14 + 0.12 * pulse})`;
      ctx.lineWidth = Math.max(cellSize * 0.04, 1);
      ctx.beginPath();
      ctx.moveTo(ox + inset + sz * 0.25, oy + inset + sz * 0.25);
      ctx.lineTo(ox + inset + sz * 0.75, oy + inset + sz * 0.75);
      ctx.moveTo(ox + inset + sz * 0.75, oy + inset + sz * 0.25);
      ctx.lineTo(ox + inset + sz * 0.25, oy + inset + sz * 0.75);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSnake(now) {
    if (!snake.length) return;
    const t = state === "playing" ? clamp((now - lastStep) / stepInterval(), 0, 1) : 1;

    // Animação de entrada: nasce do centro e cresce
    const s = spawnT(now);
    const ccx = (GRID * cellSize) / 2, ccy = (GRID * cellSize) / 2;

    const pts = snake.map((seg, i) => {
      const prev = prevSnake[Math.min(i, prevSnake.length - 1)];
      let x = lerp(prev.x, seg.x, t) * cellSize + cellSize / 2;
      let y = lerp(prev.y, seg.y, t) * cellSize + cellSize / 2;
      if (s < 1) { x = ccx + (x - ccx) * s; y = ccy + (y - ccy) * s; }
      return { x, y };
    });
    headPx = pts[0];

    // Registra o rastro luminoso da cabeça (após a entrada)
    if (fxVisual && state === "playing" && s === 1) {
      trail.push({ x: headPx.x, y: headPx.y, a: 1 });
      if (trail.length > 55) trail.shift();
    }

    // Caminho suave e contínuo (curvas quadráticas entre segmentos)
    const path = new Path2D();
    path.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      path.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    }
    if (pts.length > 1) path.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

    const head = pts[0], tail = pts[pts.length - 1];
    const bodyW = cellSize * 0.72 * (0.65 + 0.35 * s);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Sombra projetada sob o corpo (profundidade)
    ctx.save();
    ctx.translate(0, cellSize * 0.13);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = bodyW;
    ctx.stroke(path);
    ctx.restore();

    // Motion blur: fantasmas translúcidos da cabeça em alta velocidade
    if (fxVisual && stepInterval() <= 105 && trail.length > 14) {
      const g1 = trail[trail.length - 7], g2 = trail[trail.length - 14];
      for (const [gp, al] of [[g1, 0.15], [g2, 0.07]]) {
        if (!gp) continue;
        ctx.fillStyle = `rgba(163, 230, 53, ${al})`;
        ctx.beginPath();
        ctx.arc(gp.x, gp.y, bodyW * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Halo neon externo (aditivo)
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(163, 230, 53, ${0.14 * s})`;
    ctx.lineWidth = bodyW * 1.7;
    ctx.stroke(path);
    ctx.restore();

    // Aura de combo: intensifica conforme o multiplicador e muda de tom por tier
    const comboK = fxVisual && state === "playing" ? Math.max(0, Math.min(1, (comboMult(eatStreak) - 1) / 2)) : 0;
    if (comboK > 0.02) {
      const cm = comboMult(eatStreak);
      const tier = cm >= 2.5 ? 3 : cm >= 1.7 ? 2 : 1;
      const auraRgb = tier === 3 ? "240, 171, 252" : tier === 2 ? "232, 121, 249" : "196, 181, 253";
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(${auraRgb}, ${(0.14 * comboK).toFixed(3)})`;
      ctx.lineWidth = bodyW * 1.7;
      ctx.stroke(path);
      for (let i = 0; i < 3; i++) {
        const a = now / 700 + (i * Math.PI * 2) / 3;
        const sx = head.x + Math.cos(a) * bodyW * 1.5;
        const sy = head.y + Math.sin(a) * bodyW * 1.5;
        ctx.fillStyle = `rgba(${auraRgb}, ${(0.5 * comboK).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1.5, bodyW * 0.16), 0, Math.PI * 2);
        ctx.fill();
      }
      // Tier 3 (×2.5+): anel segmentado girando ao redor da cabeça
      if (tier === 3) {
        ctx.strokeStyle = `rgba(240, 171, 252, ${(0.4 * comboK).toFixed(3)})`;
        ctx.lineWidth = Math.max(cellSize * 0.06, 1.5);
        for (let i = 0; i < 8; i++) {
          const a0 = now / 500 + (i * Math.PI * 2) / 8;
          const a1 = a0 + Math.PI / 14;
          ctx.beginPath();
          ctx.arc(head.x, head.y, bodyW * 2.1, a0, a1);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Linhas de velocidade atrás da cabeça durante o turbo
    if (speedActive && fxVisual && state === "playing") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(103, 232, 249, 0.5)";
      ctx.lineCap = "round";
      const px = -dir.y, py = dir.x;
      ctx.lineWidth = Math.max(cellSize * 0.06, 1);
      for (let i = 0; i < 3; i++) {
        const off = (i - 1) * bodyW * 0.42;
        ctx.beginPath();
        ctx.moveTo(head.x - dir.x * bodyW * 0.9 + px * off, head.y - dir.y * bodyW * 0.9 + py * off);
        ctx.lineTo(head.x - dir.x * bodyW * 2.3 + px * off, head.y - dir.y * bodyW * 2.3 + py * off);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Corpo com gradiente rico: verde-limão -> verde -> verde-azulado
    const grad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    grad.addColorStop(0, "#d9f99d");
    grad.addColorStop(0.22, "#a3e635");
    grad.addColorStop(0.6, "#22c55e");
    grad.addColorStop(1, "#0f766e");
    ctx.strokeStyle = grad;
    ctx.lineWidth = bodyW;
    ctx.stroke(path);

    // Pulso de energia: onda brilhante que viaja da cauda para a cabeça ao comer
    if (fxVisual && !reducedMotion && state === "playing") {
      const et = (now - energyPulseAt) / 800;
      if (et >= 0 && et < 1) {
        const f = et; // 0 na cauda → 1 na cabeça
        const idx = f * (pts.length - 1);
        const i0 = Math.min(pts.length - 1, Math.floor(idx));
        const i1 = Math.min(pts.length - 1, i0 + 1);
        const frac = idx - Math.floor(idx);
        const ex2 = lerp(pts[i0].x, pts[i1].x, frac);
        const ey2 = lerp(pts[i0].y, pts[i1].y, frac);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const pg = ctx.createRadialGradient(ex2, ey2, 0, ex2, ey2, bodyW * 0.95);
        pg.addColorStop(0, `rgba(236, 252, 203, ${(0.5 * (1 - f) + 0.18).toFixed(3)})`);
        pg.addColorStop(1, "rgba(236, 252, 203, 0)");
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(ex2, ey2, bodyW * 0.95, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Escamas sutis: divisões curvas a cada segmento
    ctx.strokeStyle = "rgba(6, 26, 20, 0.26)";
    ctx.lineWidth = Math.max(cellSize * 0.055, 1);
    for (let i = 2; i < pts.length; i++) {
      const a = pts[i], b = pts[i - 1];
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const ppx = Math.cos(ang + Math.PI / 2), ppy = Math.sin(ang + Math.PI / 2);
      const k = i / pts.length;
      const w = bodyW * 0.52 * (1 - k * 0.4);
      if (w < 1) continue;
      ctx.beginPath();
      ctx.moveTo(a.x - ppx * w, a.y - ppy * w);
      ctx.quadraticCurveTo(a.x + (b.x - a.x) * 0.5 + ppx * w * 0.3, a.y + (b.y - a.y) * 0.5 + ppy * w * 0.3, a.x + ppx * w, a.y + ppy * w);
      ctx.stroke();
    }

    // Textura de escama extra: "V" invertidos pulsando ao longo do corpo
    if (fxVisual && !reducedMotion) {
      const scPulse = 0.5 + 0.5 * Math.sin(now / 800);
      ctx.strokeStyle = `rgba(236, 252, 203, ${(0.07 + 0.07 * scPulse).toFixed(3)})`;
      ctx.lineWidth = Math.max(cellSize * 0.045, 1);
      for (let i = 2; i < pts.length; i++) {
        const a = pts[i], b = pts[i - 1];
        const slen = Math.hypot(b.x - a.x, b.y - a.y);
        if (slen < 0.001) continue;
        const fx = (b.x - a.x) / slen, fy = (b.y - a.y) / slen; // sentido da cabeça
        const nx = -fy, ny = fx;
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const hl = cellSize * 0.2;
        const hw = bodyW * 0.4;
        const apex = { x: m.x + fx * hl, y: m.y + fy * hl };
        ctx.beginPath();
        ctx.moveTo(apex.x + fx * hl * 0.1 - nx * hw, apex.y + fy * hl * 0.1 - ny * hw);
        ctx.quadraticCurveTo(apex.x - fx * hl * 0.5, apex.y - fy * hl * 0.5, apex.x + fx * hl * 0.1 + nx * hw, apex.y + fy * hl * 0.1 + ny * hw);
        ctx.stroke();
      }
    }

    // Brilho interno (núcleo mais claro ao longo de todo o corpo)
    const inner = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    inner.addColorStop(0, "rgba(254, 255, 214, 0.5)");
    inner.addColorStop(0.5, "rgba(217, 249, 157, 0.22)");
    inner.addColorStop(1, "rgba(217, 249, 157, 0)");
    ctx.strokeStyle = inner;
    ctx.lineWidth = bodyW * 0.42;
    ctx.stroke(path);

    drawHead(now, head, bodyW);
  }

  function drawHead(now, hp, bodyW) {
    let hr = Math.max(bodyW * 0.72, 2);
    const ex = dir.x, ey = dir.y;
    const px = -ey, py = ex; // perpendicular
    // Olhos ficam mais "afiados" conforme o nível sobe
    const sharp = Math.min(1, Math.max(0, (level - 1) / 9));

    // Squash de mordida: a cabeça "morde" quando come (pop breve ao crescer)
    const chewT = (now - lastChewAt) / 160;
    if (chewT >= 0 && chewT < 1) {
      const c = Math.sin(chewT * Math.PI); // 0→1→0 em ~160ms
      hr *= 1 + 0.18 * c;
    }

    // Perigo à frente: pupilas contraem perto de parede ou obstáculo na mira
    const hcx = Math.round((hp.x - cellSize / 2) / cellSize);
    const hcy = Math.round((hp.y - cellSize / 2) / cellSize);
    let danger = Math.min(hcx, hcy, GRID - 1 - hcx, GRID - 1 - hcy);
    danger = danger >= 2 ? 0 : 1 - danger / 2;
    for (let s = 1; s <= 2; s++) {
      if (obstacles.some(ob => ob.x === hcx + dir.x * s && ob.y === hcy + dir.y * s)) {
        danger = Math.max(danger, 1 - s / 2);
      }
    }
    danger = clamp(danger, 0, 1);

    // Aberração cromática sutil em alta velocidade
    if (fxVisual && level >= 3) {
      const off = cellSize * (0.06 + Math.min(0.05, (level - 3) * 0.012));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(255, 60, 90, 0.15)";
      ctx.beginPath();
      ctx.arc(hp.x + px * off, hp.y + py * off, hr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
      ctx.beginPath();
      ctx.arc(hp.x - px * off, hp.y - py * off, hr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Língua bifurcada que aparece/desaparece periodicamente
    const phase = (now % 1600) / 1600;
    if (phase < 0.22) {
      const ext = Math.sin((phase / 0.22) * Math.PI); // sobe e desce suavemente
      const len = cellSize * 0.75 * ext;
      const bx = hp.x + ex * hr * 0.9;
      const by = hp.y + ey * hr * 0.9;
      const tipX = hp.x + ex * (hr * 0.9 + len);
      const tipY = hp.y + ey * (hr * 0.9 + len);
      ctx.strokeStyle = "#fb7185";
      ctx.lineWidth = Math.max(cellSize * 0.07, 1);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(tipX - px * cellSize * 0.14 * ext, tipY - py * cellSize * 0.14 * ext);
      ctx.moveTo(bx, by);
      ctx.lineTo(tipX + px * cellSize * 0.14 * ext, tipY + py * cellSize * 0.14 * ext);
      ctx.stroke();
    }

    // Cabeça com glow e volume (gradiente radial)
    ctx.save();
    ctx.shadowColor = "rgba(163, 230, 53, 0.55)";
    ctx.shadowBlur = cellSize * 0.7;
    const hg = ctx.createRadialGradient(hp.x - hr * 0.35, hp.y - hr * 0.35, hr * 0.2, hp.x, hp.y, hr);
    hg.addColorStop(0, "#ecfccb");
    hg.addColorStop(0.55, "#d9f99d");
    hg.addColorStop(1, "#84cc16");
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Olhos: globo, pupila orientada ao movimento e ponto de luz
    const eyeOff = cellSize * 0.2;
    const fwd = cellSize * 0.16;
    for (const s of [-1, 1]) {
      const cx = hp.x + px * eyeOff * s + ex * fwd;
      const cy = hp.y + py * eyeOff * s + ey * fwd;
      const er = cellSize * 0.115;
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(cx, cy, er, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(cx + ex * er * 0.35, cy + ey * er * 0.35, er * (0.55 - sharp * 0.12) * (1 - danger * 0.28), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(cx + ex * er * 0.1 - px * er * 0.25 * s, cy + ey * er * 0.1 - py * er * 0.25 * s, er * 0.22, 0, Math.PI * 2);
      ctx.fill();

      // Sobrancelha: mais marcada e inclinada conforme o nível
      ctx.strokeStyle = `rgba(15, 23, 42, ${0.3 + sharp * 0.35})`;
      ctx.lineWidth = Math.max(cellSize * (0.05 + sharp * 0.015), 1);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - ex * er * (1.0 - sharp * 0.35) - px * er * 0.75 * s, cy - ey * er * (1.0 - sharp * 0.35) - py * er * 0.75 * s);
      ctx.lineTo(cx - ex * er * (1.5 + sharp * 0.2) + px * er * (0.5 - sharp * 0.15) * s, cy - ey * er * (1.5 + sharp * 0.2) + py * er * (0.5 - sharp * 0.15) * s);
      ctx.stroke();
    }
  }

  // Aviso visual: bordas avermelhadas perto de parede ou obstáculo à frente
  function drawWallWarning(now) {
    if (state !== "playing" || !headPx) return;
    const gx = (headPx.x - cellSize / 2) / cellSize;
    const gy = (headPx.y - cellSize / 2) / cellSize;
    const d = Math.min(gx, gy, GRID - 1 - gx, GRID - 1 - gy);
    let k = d >= 2 ? 0 : clamp(1 - d / 2, 0, 1);
    // Obstáculo na trajetória: quanto mais perto, mais forte o aviso
    const fgx = Math.round(gx), fgy = Math.round(gy);
    for (let s = 1; s <= 2; s++) {
      const o = { x: fgx + dir.x * s, y: fgy + dir.y * s };
      if (obstacles.some(ob => ob.x === o.x && ob.y === o.y)) {
        k = Math.max(k, 1 - (s - 1) / 2);
        break;
      }
    }
    if (k <= 0) { wallK = 0; return; }
    wallK = k; // alimenta o som de tensão
    const a = k * (0.3 + 0.18 * Math.sin(now / 110));
    const size = GRID * cellSize;
    ctx.strokeStyle = `rgba(251, 113, 133, ${Math.max(a, 0).toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(1.5, 1.5, size - 3, size - 3, 15);
    else ctx.rect(1.5, 1.5, size - 3, size - 3);
    ctx.stroke();
  }

  // Vignette violeta pulsante quando o próximo nível está próximo
  function drawLevelPulse(now, k) {
    const a = k * (0.09 + 0.05 * Math.sin(now / 220));
    const sz = GRID * cellSize;
    const pv = ctx.createRadialGradient(sz / 2, sz / 2, sz * 0.4, sz / 2, sz / 2, sz * 0.72);
    pv.addColorStop(0, "rgba(167, 139, 250, 0)");
    pv.addColorStop(1, `rgba(167, 139, 250, ${Math.max(a, 0).toFixed(3)})`);
    ctx.fillStyle = pv;
    ctx.fillRect(0, 0, sz, sz);
  }

  function drawTrail(dt) {
    if (state !== "playing") dt = 0; // congela o rastro ao pausar / contar / encerrar
    for (let i = trail.length - 1; i >= 0; i--) {
      const s = trail[i];
      s.a -= dt / 420;
      if (s.a <= 0) trail.splice(i, 1);
    }
    if (trail.length < 2) return;

    // Faixa luminosa contínua, afunilando e esmaecendo
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = trail.length - 1; i > 0; i--) {
      const s = trail[i];
      const alpha = s.a * s.a * (speedActive ? 0.5 : 0.3);
      if (alpha <= 0.004) continue;
      ctx.strokeStyle = `rgba(${speedActive ? "103, 232, 249" : "74, 222, 128"}, ${alpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(cellSize * 0.34 * s.a, 0.5);
      ctx.beginPath();
      ctx.moveTo(trail[i].x, trail[i].y);
      ctx.lineTo(trail[i - 1].x, trail[i - 1].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStar(x, y, r, rot, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const rad = k % 2 === 0 ? r : r * 0.38;
      const a = rot + (k * Math.PI) / 4;
      const px = x + Math.cos(a) * rad;
      const py = y + Math.sin(a) * rad;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawEffects(dt) {
    const f = dt / 16.7;

    // Partículas: pontos, estrelas girando e faíscas alongadas
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * f;
      p.y += p.vy * f;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.rot = (p.rot || 0) + (p.vr || 0) * f;
      p.life -= dt / 520;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(p.life, 0);
      if (p.type === "star") {
        drawStar(p.x, p.y, p.size * (0.9 + 0.4 * p.life), p.rot, p.color);
      } else if (p.type === "spark") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 3.2, p.y - p.vy * 3.2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Anéis de choque (configuráveis: cor, espessura e velocidade)
    for (let i = flashes.length - 1; i >= 0; i--) {
      const w = flashes[i];
      w.r += (w.spd || cellSize * 0.09) * f;
      w.alpha -= dt / 430;
      if (w.alpha <= 0) { flashes.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(${w.color || "163, 230, 53"}, ${Math.max(w.alpha, 0).toFixed(3)})`;
      ctx.lineWidth = w.w || 2.5;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Textos flutuantes ("+10", "+5 COMBO")
    for (let i = floats.length - 1; i >= 0; i--) {
      const ft = floats[i];
      ft.y -= 0.35 * f;
      ft.life -= dt / 850;
      if (ft.life <= 0) { floats.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = clamp(ft.life, 0, 1);
      ctx.font = `700 ${Math.max(10, Math.round(cellSize * 0.62))}px Orbitron, sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(7, 11, 20, 0.7)";
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  // Fundo cinematográfico: estrelas com parallax + nebulosa tingida pelo bioma
  function drawBackground(now) {
    const size = GRID * cellSize;
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);

    const mx = size / 2, my = size / 2;
    let ox = 0, oy = 0;
    if (headPx) { ox = (mx - headPx.x) * 0.08; oy = (my - headPx.y) * 0.08; }
    const drift = reducedMotion ? 0 : (now / 60) % size;

    // Nebulosa: dois halos suaves com a cor do bioma atual
    if (biomeTint && fxVisual && !reducedMotion) {
      const n1x = (mx + Math.cos(now / 9000) * size * 0.3 + ox);
      const n1y = (my + Math.sin(now / 11000) * size * 0.26 + oy * 0.5);
      const ng1 = ctx.createRadialGradient(n1x, n1y, 0, n1x, n1y, size * 0.52);
      ng1.addColorStop(0, `rgba(${biomeTint}, ${(0.05 + 0.02 * Math.sin(now / 4000)).toFixed(3)})`);
      ng1.addColorStop(1, `rgba(${biomeTint}, 0)`);
      ctx.fillStyle = ng1;
      ctx.fillRect(0, 0, size, size);
    }

    // Estrelas: três camadas, as próximas acompanham a cabeça (parallax)
    for (const st of starField) {
      const px = ((st.x * size + ox * (st.layer / 2.2) + (st.layer === 2 ? -drift : drift * 0.4)) % size + size) % size;
      const py = ((st.y * size + oy * (st.layer / 2.2)) % size + size) % size;
      const breath = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(now / 1600 + st.tw));
      const alpha = ((st.layer + 1) / 4) * breath * (st.layer * 0.35 + 0.25);
      ctx.fillStyle = `rgba(190, 216, 255, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px, py, st.s * (0.6 + st.layer * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function render(now, dt) {
    drawBackground(now);

    // Matiz do "bioma" atual (muda a cada 5 níveis)
    if (fxVisual && biomeTint) {
      ctx.fillStyle = `rgba(${biomeTint}, ${(0.05 + 0.015 * Math.sin(now / 3000)).toFixed(3)})`;
      ctx.fillRect(0, 0, GRID * cellSize, GRID * cellSize);
    }

    // Flash de cor do fundo ao subir de nível
    if (levelFlash > 0) {
      levelFlash -= dt / 650;
      ctx.fillStyle = `rgba(${levelFlashColor}, ${(Math.max(levelFlash, 0) * 0.22).toFixed(3)})`;
      ctx.fillRect(0, 0, GRID * cellSize, GRID * cellSize);
    }

    drawGrid(now);
    drawObstacles(now);

    // Moldura interna da borda: marca onde está a parede, na cor do bioma
    if (fxVisual) {
      ctx.save();
      const frRgb = biomeTint || "140, 165, 195";
      const fr = cellSize * 0.09;
      ctx.strokeStyle = `rgba(${frRgb}, ${(0.5 + 0.18 * Math.sin(now / 1800)).toFixed(3)})`;
      ctx.lineWidth = Math.max(cellSize * 0.06, 1.5);
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(fr * 1.5, fr * 1.5, GRID * cellSize - fr * 3, GRID * cellSize - fr * 3, cellSize * 0.25); ctx.stroke(); }
      else { ctx.strokeRect(fr * 1.5, fr * 1.5, GRID * cellSize - fr * 3, GRID * cellSize - fr * 3); }
      ctx.restore();
    }

    // Vignette pulsante quando falta pouco para o próximo nível
    if (fxVisual && state === "playing" && score > 0) {
      const rem = LEVEL_EVERY - (score % LEVEL_EVERY);
      if (rem <= 20) drawLevelPulse(now, (20 - rem) / 20);
    }

    if (fxVisual) drawTrail(dt);
    drawFood(now);
    drawSnake(now);
    drawWallWarning(now);
    drawEffects(dt);
    ctx.fillStyle = vignetteGrad; // escurece sutilmente as bordas
    ctx.fillRect(0, 0, GRID * cellSize, GRID * cellSize);
  }

  /* ================= Loop principal ================= */
  let lastFrame = performance.now();

  function loop(now) {
    const dt = Math.min(now - lastFrame, 100);
    lastFrame = now;

    if (state === "resuming") {
      // Contagem 3·2·1 antes de voltar a jogar
      const elapsed = performance.now() - resumeStart;
      const n = Math.max(1, Math.min(3, 3 - Math.floor(elapsed / RESUME_STEP)));
      if (countdownEl && !countdownEl.classList.contains("hidden")) {
        if (countdownEl.textContent !== String(n)) {
          countdownEl.textContent = String(n);
          countdownEl.classList.remove("pulse");
          void countdownEl.offsetWidth;
          countdownEl.classList.add("pulse");
        }
      }
      if (elapsed >= RESUME_FREEZE) {
        state = "playing";
        if (countdownEl) countdownEl.classList.add("hidden");
        sfx.unpause();
      }
      lastStep = now;
    } else if (state === "playing") {
      if (now < freezeUntil) {
        lastStep = now; // hit-stop (level up)
      } else {
        runMs += dt;
        let guard = 0;
        while (now - lastStep >= stepInterval() && guard < 5 && state === "playing") {
          step();
          lastStep += stepInterval();
          guard++;
        }
        if (guard === 5) lastStep = now; // descarta atraso acumulado
      }
    } else if (state === "paused") {
      lastStep = now;
    }

    // Slow-motion dramático nos primeiros instantes da explosão de morte
    let rdt = dt;
    if (state === "over") {
      const ts = performance.now() - overAt;
      if (ts < 320) rdt = dt * 0.28;
      else if (ts < 900) rdt = dt * (0.28 + ((ts - 320) / 580) * 0.72);
    }

    render(now, rdt);
    sfx.updateDynamics(state, stepInterval(), level, wallK);
    updateComboChip(now);
    updateSpeedChip(dt);
    // Gemas especiais expiram se não forem pegas a tempo
    if (state === "playing" && food && food.kind !== "apple" && now >= foodExpiresAt) {
      const cx = food.x * cellSize + cellSize / 2;
      const cy = food.y * cellSize + cellSize / 2;
      flashes.push({ x: cx, y: cy, r: cellSize * 0.2, alpha: 0.7, w: 2, spd: cellSize * 0.12, color: "203, 213, 225" });
      placeFood(true);
    }
    requestAnimationFrame(loop);
  }

  /* ================= Inicialização ================= */
  resetGame();
  resizeCanvas();
  requestAnimationFrame(loop);
  loadGlobalLeaderboard(); // busca o recorde mundial assim que o jogo abre

  if (window.__SNAKE_TEST__) {
    Object.assign(window.__SNAKE_TEST__,
      { getState: () => state, getScore: () => score, getSnake: () => snake, getFood: () => food,
        getObstacles: () => obstacles, getEatStreak: () => eatStreak, getLevel: () => level,
        getDir: () => dir, getSpeedActive: () => speedActive, getFoodExpiresAt: () => foodExpiresAt,
        getStats: () => stats,
        setSnake: v => (snake = v), setDir: v => (dir = v), setFood: v => (food = v),
        setObstacles: v => (obstacles = v), setSpeedActive: v => (speedActive = v),
        step, resetGame, placeFood, gameOver, spawnObstacles, comboMult, stepInterval });
  }
})();
