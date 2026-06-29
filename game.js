// ============================================
//  GAME MAIN - js/game.js
//  Orchestrates all systems
// ============================================

'use strict';

// ── Game state object (passed to renderer) ──
const GameState = {
  // Core
  status:   'menu',  // menu / play / paused / over
  animTime: 0,
  fps:      0,
  fpsCnt:   0,
  fpsTime:  0,
  lastTime: 0,
  runTime:  0,

  // Speed
  speed:    6,
  BASE_SPD: 6,
  MAX_SPD:  20,

  // Progress
  score:    0,
  distance: 0,
  coins:    0,
  multi:    1,

  // Track
  trackWidth:   240,
  camZ:         0,
  scrollOffset: 0,
  LANE_POSITIONS: [-80, 0, 80],

  // Powerup states
  shield:   false,
  magnet:   false,
  jetpack:  false,
  giant:    false,
  invisible:false,
  puTimer:  0,
  puMax:    8,
  puActive: null,

  // Player
  player: null,

  // Chaser
  chaser: null,

  // World objects
  obstacles: [],
  coins:     [],
  powerups:  [],
  buildings: [],
  trees:     [],
  clouds:    [],

  // Spawn timers
  nextObsZ:  200,
  nextCoinZ: 80,
  nextPUZ:   400,

  // Combo
  passedObs: 0,
};


const GameFlow = {

  // ── Init ──
  init() {
    const canvas = document.getElementById('C');
    Renderer.init(canvas);
    InputHandler.init(canvas);
    AudioManager.init();
    SaveManager.load();
    UIManager.refreshCoins();
    UIManager.refreshMenu();
    this._buildMenuBg();
    this._runLoader();
  },

  // ── Loader animation ──
  _runLoader() {
    let p = 0;
    const bar = document.getElementById('ldbar');
    const msg = document.getElementById('ldmsg');
    const msgs = [
      'Loading characters...',
      'Building the city...',
      'Placing obstacles...',
      'Waking up Oggy...',
      'Warming up cockroaches...',
      'Almost there...',
      "LET'S GO!"
    ];

    // Preload sprites
    const allChars = [
      ...CharacterData.allRunners(),
      ...CharacterData.allChasers()
    ];
    const loadPromises = allChars.map(c => SpriteManager.preloadCharacter(c));
    loadPromises.push(SpriteManager.preloadObstacles());

    Promise.all(loadPromises).catch(() => {});

    const iv = setInterval(() => {
      p += Math.random() * 14 + 4;
      if (p > 100) p = 100;
      bar.style.width = p + '%';
      msg.textContent = msgs[Math.min(Math.floor(p / 15), msgs.length - 1)];
      if (p >= 100) {
        clearInterval(iv);
        setTimeout(() => {
          document.getElementById('loader').classList.add('done');
        }, 400);
      }
    }, 160);
  },

  // ── Floating bg bubbles ──
  _buildMenuBg() {
    const bg = document.getElementById('menuBgAnim');
    if (!bg) return;
    const colors = ['#4A90D9','#E91E63','#FFD700','#4CAF50','#9C27B0','#FF9800'];
    for (let i = 0; i < 14; i++) {
      const b = document.createElement('div');
      b.className = 'bg-bubble';
      const sz = 50 + Math.random() * 90;
      b.style.cssText = [
        `width:${sz}px`, `height:${sz}px`,
        `left:${Math.random() * 100}%`,
        `background:${colors[i % colors.length]}`,
        `animation-delay:${Math.random() * 22}s`,
        `animation-duration:${14 + Math.random() * 20}s`,
      ].join(';');
      bg.appendChild(b);
    }
  },

  // ── Go to screen ──
  goScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
    // Init screens
    if (id === 'charScr')    CharSelect.init();
    if (id === 'shopScr')    ShopUI.init();
    if (id === 'missionScr') MissionUI.init();
    if (id === 'settScr')    SettingsUI.init();
    if (id === 'menuScr')    UIManager.refreshMenu();
    AudioManager.play('sel');
  },

  // ────────────────────────────────────────────
  //  START RUN
  // ────────────────────────────────────────────
  startRun() {
    AudioManager.wake();
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('hud').className = 'hud-visible';

    this._resetGameState();
    GameState.status = 'play';
    GameState.lastTime = performance.now();

    // Show then auto-hide gesture hint
    const hint = document.getElementById('gestureHint');
    if (hint) {
      hint.style.display = 'flex';
      setTimeout(() => { if (hint) hint.style.display = 'none'; }, 4000);
    }

    this._loop(GameState.lastTime);
  },

  // ── Reset all game state ──
  _resetGameState() {
    const gs = GameState;
    const rd = CharacterData.getRunner(SaveManager.data.selectedRunner) || CharacterData.getRunner('oggy');
    const cd = CharacterData.getChaser(SaveManager.data.selectedChaser) || CharacterData.getChaser('dee_dee');

    gs.speed     = gs.BASE_SPD;
    gs.score     = 0;
    gs.distance  = 0;
    gs.coins     = 0;
    gs.multi     = 1;
    gs.runTime   = 0;
    gs.animTime  = 0;
    gs.camZ      = 0;
    gs.scrollOffset = 0;

    // Reset powerups
    gs.shield    = false;
    gs.magnet    = false;
    gs.jetpack   = false;
    gs.giant     = false;
    gs.invisible = false;
    gs.puTimer   = 0;
    gs.puActive  = null;

    // Spawn timers
    gs.nextObsZ  = 200;
    gs.nextCoinZ = 80;
    gs.nextPUZ   = 450;
    gs.passedObs = 0;

    // Player
    gs.player = {
      wx:       0,                  // world x
      wy:       0,                  // world y (height)
      wz:       300,                // world z (fixed depth in front of camera)
      targetWX: 0,
      lane:     1,
      vy:       0,
      state:    'run',              // run / jump / slide / fall
      slideTimer: 0,
      invTimer:   0,
      charData: rd,
      charW:    rd.type === 'roach' ? 38 : 50,
      charH:    rd.type === 'roach' ? 50 : 68,
    };

    // Chaser - starts behind camera
    gs.chaser = {
      wx:       0,
      wz:       80,                 // behind player
      targetWX: 0,
      lane:     1,
      wobble:   0,
      chasingLane: 1,
      laneSwapCooldown: 0,
      charData: cd,
      charW:    cd.type === 'roach' ? 36 : 48,
      charH:    cd.type === 'roach' ? 48 : 64,
    };

    // Clear world
    gs.obstacles = [];
    gs.coins     = [];
    gs.powerups  = [];

    ParticleSystem.clear();

    // Generate environment
    this._genEnvironment();
  },

  // ── Generate static environment ──
  _genEnvironment() {
    const gs = GameState;
    gs.buildings = [];
    gs.trees     = [];
    gs.clouds    = [];

    for (let i = 0; i < 32; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      gs.buildings.push({
        wx:      side * (gs.trackWidth / 2 + 50 + Math.random() * 80),
        wz:      100 + i * 110 + Math.random() * 60,
        w:       45 + Math.random() * 55,
        h:       70 + Math.random() * 150,
        color:   `hsl(${200 + Math.random() * 40},${14 + Math.random() * 10}%,${17 + Math.random() * 13}%)`,
        winCols: Math.floor(Math.random() * 3 + 2),
        winRows: 0,
        seed:    Math.floor(Math.random() * 100),
      });
      gs.buildings[gs.buildings.length - 1].winRows =
        Math.floor(gs.buildings[gs.buildings.length - 1].h / 18);
    }

    for (let i = 0; i < 22; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      gs.trees.push({
        wx: side * (gs.trackWidth / 2 + 18 + Math.random() * 30),
        wz: 80 + i * 140 + Math.random() * 80,
      });
    }

    for (let i = 0; i < 12; i++) {
      gs.clouds.push({
        wx:   (Math.random() - 0.5) * 500,
        wy:   140 + Math.random() * 90,
        wz:   200 + Math.random() * 3000,
        size: 35 + Math.random() * 45,
      });
    }
  },

  // ────────────────────────────────────────────
  //  GAME LOOP
  // ────────────────────────────────────────────
  _loop(now) {
    const gs = GameState;
    if (gs.status !== 'play' && gs.status !== 'over') return;

    const dt = Math.min((now - gs.lastTime) / 1000, 0.045);
    gs.lastTime = now;

    // FPS counter
    gs.fpsCnt++;
    gs.fpsTime += dt;
    if (gs.fpsTime >= 1) {
      gs.fps    = gs.fpsCnt;
      gs.fpsCnt = 0;
      gs.fpsTime = 0;
    }

    if (gs.status === 'play') {
      this._update(dt);
    }

    ParticleSystem.update(dt);
    Renderer.render(gs, dt);

    requestAnimationFrame(t => this._loop(t));
  },

  // ────────────────────────────────────────────
  //  UPDATE
  // ────────────────────────────────────────────
  _update(dt) {
    const gs = GameState;

    gs.animTime += dt;
    gs.runTime  += dt;

    // Speed ramp
    gs.speed = Math.min(gs.MAX_SPD, gs.speed + 0.0008 * gs.speed * dt * 60);

    const move = gs.speed * dt * 55;
    gs.distance    += move * 0.14;
    gs.score       += gs.speed * dt * 7 * gs.multi;
    gs.scrollOffset += move;

    // ── Player ──
    PlayerSystem.update(dt, gs, move);

    // ── Chaser ──
    ChaserSystem.update(dt, gs, move);

    // ── World ──
    WorldSystem.update(dt, gs, move);

    // ── Collision ──
    CollisionSystem.check(gs, dt);

    // ── Powerup timer ──
    this._updatePowerup(dt, gs);

    // ── HUD ──
    this._updateHUD(gs);
  },

  // ── Powerup timer ──
  _updatePowerup(dt, gs) {
    if (gs.puTimer > 0) {
      gs.puTimer -= dt;
      const pct = Math.max(0, gs.puTimer / gs.puMax * 100);
      const fill = document.getElementById('hudPuFill');
      if (fill) fill.style.width = pct + '%';
      if (gs.puTimer <= 0) this.deactivatePowerup();
    }
  },

  // ── HUD update ──
  _updateHUD(gs) {
    const el = id => document.getElementById(id);
    if (el('hudScore')) el('hudScore').textContent = Math.floor(gs.score).toLocaleString();
    if (el('hudCoins')) el('hudCoins').textContent = gs.coins;
    if (el('hudDist'))  el('hudDist').textContent  = Math.floor(gs.distance) + 'm';
  },

  // ────────────────────────────────────────────
  //  POWER-UPS
  // ────────────────────────────────────────────
  activatePowerup(puData) {
    const gs = GameState;
    AudioManager.play('pow');

    // Deactivate previous
    this.deactivatePowerup(true);

    gs.puActive = puData;
    gs.puTimer  = puData.dur || 8;
    gs.puMax    = gs.puTimer;

    switch (puData.id) {
      case 'magnet':    gs.magnet    = true; break;
      case 'shield':    gs.shield    = true; break;
      case 'x2score':   gs.multi     = 2;    break;
      case 'jetpack':   gs.jetpack   = true; break;
      case 'giant':     gs.giant     = true; break;
      case 'invisible': gs.invisible = true; break;
      case 'timeslow':  gs.speed    *= 0.5;  break;
      case 'coinrain':  WorldSystem.spawnCoinRain(gs); break;
    }

    const puBar  = document.getElementById('hudPuBar');
    const puIcon = document.getElementById('hudPuIcon');
    if (puBar)  puBar.style.display  = 'flex';
    if (puIcon) puIcon.textContent    = puData.icon;

    const mult = document.getElementById('hudMult');
    if (mult) mult.style.display = gs.multi > 1 ? 'block' : 'none';

    UIManager.toast(puData.name + ' activated!', 'ts');
  },

  deactivatePowerup(silent = false) {
    const gs = GameState;
    if (!gs.puActive && !silent) return;

    const wasTimeSlow = gs.puActive?.id === 'timeslow';

    gs.magnet    = false;
    gs.jetpack   = false;
    gs.giant     = false;
    gs.invisible = false;
    gs.multi     = 1;
    gs.puTimer   = 0;
    gs.puActive  = null;

    if (wasTimeSlow) gs.speed = Math.min(gs.MAX_SPD, gs.speed * 2);

    const puBar = document.getElementById('hudPuBar');
    if (puBar) puBar.style.display = 'none';
    const mult = document.getElementById('hudMult');
    if (mult)  mult.style.display  = 'none';
  },

  // ────────────────────────────────────────────
  //  GAME OVER
  // ────────────────────────────────────────────
  triggerGameOver() {
    const gs = GameState;
    gs.status = 'over';
    AudioManager.play('go');
    AudioManager.vib(200);

    const pl  = gs.player;
    const pr  = Renderer.project(pl.wx, pl.wy + pl.charH / 2, pl.wz);
    ParticleSystem.crashFX(pr.sx, pr.sy);
    Renderer.shake(18);

    const result = {
      score:    Math.floor(gs.score),
      distance: Math.floor(gs.distance),
      coins:    gs.coins,
      time:     Math.floor(gs.runTime),
    };
    SaveManager.recordRun(result);

    setTimeout(() => {
      document.getElementById('hud').className = 'hud-hidden';
      const hs = result.score >= SaveManager.data.highScore;

      const el = id => document.getElementById(id);
      if (el('goBigScore')) el('goBigScore').textContent = result.score.toLocaleString();
      if (el('goCoins'))    el('goCoins').textContent    = result.coins;
      if (el('goDist'))     el('goDist').textContent     = result.distance + 'm';
      if (el('goTime'))     el('goTime').textContent     = result.time + 's';
      if (el('goHs'))       el('goHs').style.display     = hs ? 'block' : 'none';

      document.getElementById('goOvl').style.display = 'flex';
    }, 700);
  },

  // ────────────────────────────────────────────
  //  PAUSE / RESUME / RESTART / QUIT
  // ────────────────────────────────────────────
  pause() {
    if (GameState.status !== 'play') return;
    GameState.status = 'paused';
    document.getElementById('pauseOvl').style.display = 'flex';
    const el = document.getElementById('pauseScore');
    if (el) el.textContent = Math.floor(GameState.score).toLocaleString();
  },

  resume() {
    GameState.status   = 'play';
    GameState.lastTime = performance.now();
    document.getElementById('pauseOvl').style.display = 'none';
    this._loop(GameState.lastTime);
  },

  restart() {
    document.querySelectorAll('.ovl-bg').forEach(o => o.style.display = 'none');
    document.getElementById('hud').className = 'hud-visible';
    this._resetGameState();
    GameState.status   = 'play';
    GameState.lastTime = performance.now();
    this._loop(GameState.lastTime);
  },

  quit() {
    GameState.status = 'menu';
    document.querySelectorAll('.ovl-bg').forEach(o => o.style.display = 'none');
    document.getElementById('hud').className = 'hud-hidden';
    this.goScreen('menuScr');
  },
};


// ────────────────────────────────────────────
//  INPUT HANDLER
// ────────────────────────────────────────────
const InputHandler = {
  tx: 0, ty: 0, tt: 0,

  init(canvas) {
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      AudioManager.wake();
      const t = e.touches[0];
      this.tx = t.clientX;
      this.ty = t.clientY;
      this.tt = Date.now();
    }, { passive: false });

    canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

    canvas.addEventListener('touchend', e => {
      if (GameState.status !== 'play') return;
      const t  = e.changedTouches[0];
      const dx = t.clientX - this.tx;
      const dy = t.clientY - this.ty;
      const dt = Date.now() - this.tt;
      this._process(dx, dy, dt);
    }, { passive: false });

    // Mouse (desktop)
    let mx = 0, my = 0, mt = 0;
    canvas.addEventListener('mousedown', e => { AudioManager.wake(); mx = e.clientX; my = e.clientY; mt = Date.now(); });
    canvas.addEventListener('mouseup',   e => {
      if (GameState.status !== 'play') return;
      this._process(e.clientX - mx, e.clientY - my, Date.now() - mt);
    });

    // Keyboard
    document.addEventListener('keydown', e => {
      if (GameState.status !== 'play') return;
      switch (e.key) {
        case 'ArrowLeft':  case 'a': case 'A': PlayerSystem.moveLeft();  break;
        case 'ArrowRight': case 'd': case 'D': PlayerSystem.moveRight(); break;
        case 'ArrowUp':  case 'w': case 'W':
        case ' ':                              PlayerSystem.jump();  break;
        case 'ArrowDown': case 's': case 'S': PlayerSystem.slide(); break;
        case 'Escape': case 'p': case 'P':    GameFlow.pause();     break;
      }
    });
  },

  _process(dx, dy, dt) {
    const MIN_SWIPE = 28;
    if (dt < 320) {
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx >  MIN_SWIPE) PlayerSystem.moveRight();
        if (dx < -MIN_SWIPE) PlayerSystem.moveLeft();
      } else {
        if (dy < -MIN_SWIPE) PlayerSystem.jump();
        if (dy >  MIN_SWIPE) PlayerSystem.slide();
      }
    } else if (Math.abs(dx) < 14 && Math.abs(dy) < 14) {
      PlayerSystem.jump();
    }
  },
};


// ────────────────────────────────────────────
//  BOOT
// ────────────────────────────────────────────
window.addEventListener('load', () => GameFlow.init());

document.addEventListener('touchmove', e => {
  if (e.target.id === 'C') e.preventDefault();
}, { passive: false });

document.addEventListener('visibilitychange', () => {
  if (document.hidden && GameState.status === 'play') GameFlow.pause();
});