// ============================================
//  UI MANAGER - js/ui.js
//  All menu screens and UI updates
// ============================================

'use strict';

// ── Toast ──
const UIManager = {
  toast(msg, type = 'ti') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className   = `toast ${type} show`;
    setTimeout(() => el.classList.remove('show'), 2200);
  },

  refreshCoins() {
    const c = SaveManager.data.coins.toLocaleString();
    ['cs-coins', 'shop-coins', 'mission-coins'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = c;
    });
    const mc = document.getElementById('menu-coins');
    if (mc) mc.textContent = SaveManager.data.coins.toLocaleString();
  },

  refreshMenu() {
    const mc = document.getElementById('menu-coins');
    const mh = document.getElementById('menu-hi');
    const mg = document.getElementById('menu-games');
    if (mc) mc.textContent = SaveManager.data.coins.toLocaleString();
    if (mh) mh.textContent = (SaveManager.data.highScore || 0).toLocaleString();
    if (mg) mg.textContent = SaveManager.data.gamesPlayed || 0;
  },
};


// ── Character Select ──
const CharSelect = {
  currentTab:  'runner',
  viewingChar: null,

  init() {
    this.currentTab  = 'runner';
    this.viewingChar = null;
    document.querySelectorAll('.cs-tab').forEach((t, i) => {
      t.classList.toggle('active', i === 0);
    });
    this.render();
    UIManager.refreshCoins();
  },

  switchTab(tab, btn) {
    this.currentTab = tab;
    document.querySelectorAll('#charScr .cs-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    this.render();
  },

  render() {
    const grid = document.getElementById('csGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const chars  = this.currentTab === 'runner'
      ? CharacterData.allRunners()
      : CharacterData.allChasers();

    const selId  = this.currentTab === 'runner'
      ? SaveManager.data.selectedRunner
      : SaveManager.data.selectedChaser;

    chars.forEach(ch => {
      const unlocked = SaveManager.isUnlocked(ch.id) || ch.price === 0;
      const selected = ch.id === selId;

      const card = document.createElement('div');
      card.className = `char-card${selected ? ' selected' : ''}${unlocked ? '' : ' locked'}`;
      card.onclick   = () => {
        this.viewingChar = ch;
        this.updatePreview(ch, unlocked);
        document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        AudioManager.play('sel');
      };

      // Mini avatar
      const mini = document.createElement('div');
      mini.className = 'char-card-sprite';
      const miniCanvas = document.createElement('canvas');
      miniCanvas.width  = 52;
      miniCanvas.height = 52;
      const mctx = miniCanvas.getContext('2d');

      // Draw tiny character preview
      mctx.save();
      mctx.translate(26, 26);
      if (ch.type === 'roach') {
        SpriteManager.drawFallbackRoach(mctx, ch.id + '_mini', 0, 0, 34, 46, ch, 'run', 0);
      } else {
        SpriteManager.drawFallbackCat(mctx, ch.id + '_mini', 0, 0, 36, 50, ch, 'run', 0);
      }
      mctx.restore();

      mini.appendChild(miniCanvas);

      card.innerHTML = `
        ${!unlocked ? '<div class="char-lock-icon">🔒</div>' : ''}
        <div class="char-card-name">${ch.name}</div>
        ${!unlocked
          ? `<div class="char-card-price">🪙 ${ch.price.toLocaleString()}</div>`
          : selected
          ? '<div class="char-card-price" style="color:#43e97b">✓ Selected</div>'
          : ''}
      `;
      card.insertBefore(mini, card.firstChild);
      grid.appendChild(card);
    });

    // Update preview with currently selected
    const selChar = this.currentTab === 'runner'
      ? CharacterData.getRunner(SaveManager.data.selectedRunner)
      : CharacterData.getChaser(SaveManager.data.selectedChaser);
    if (selChar) {
      this.viewingChar = selChar;
      const ul = SaveManager.isUnlocked(selChar.id) || selChar.price === 0;
      this.updatePreview(selChar, ul);
    }
  },

  updatePreview(ch, unlocked) {
    const pCanvas = document.getElementById('previewCanvas');
    const pctx    = pCanvas?.getContext('2d');
    if (pctx) {
      pctx.clearRect(0, 0, 160, 200);
      pctx.save();
      pctx.translate(80, 110);
      if (ch.type === 'roach') {
        SpriteManager.drawFallbackRoach(pctx, ch.id + '_prev', 0, 0, 70, 95, ch, 'run', 0);
      } else {
        SpriteManager.drawFallbackCat(pctx, ch.id + '_prev', 0, 0, 78, 105, ch, 'run', 0);
      }
      pctx.restore();
    }

    const nm  = document.getElementById('cspi-name');
    const ab  = document.getElementById('cspi-ability');
    const st  = document.getElementById('cspi-stats');
    if (nm) nm.textContent = ch.name;
    if (ab) ab.textContent = ch.ability;

    // Stats bars
    if (st && ch.speedMult !== undefined) {
      st.innerHTML = [
        { label: 'Speed',  val: ch.speedMult  },
        { label: 'Jump',   val: ch.jumpMult   },
        { label: 'Magnet', val: ch.magnetMult },
      ].map(s => `
        <div class="stat-row">
          <div class="stat-label">${s.label}</div>
          <div class="stat-bar">
            <div class="stat-fill" style="width:${Math.min(100, (s.val || 1) * 80)}%"></div>
          </div>
        </div>
      `).join('');
    }

    // Action button
    const btn = document.getElementById('csActionBtn');
    if (btn) {
      if (unlocked) {
        btn.textContent = '✓ SELECT';
        btn.style.background = 'linear-gradient(135deg,#43e97b,#38f9d7)';
        btn.style.color = '#1a1a2e';
      } else {
        btn.textContent = `🪙 BUY (${ch.price.toLocaleString()})`;
        btn.style.background = 'linear-gradient(135deg,#FFD700,#FFA000)';
        btn.style.color = '#1a1a2e';
      }
    }
  },

  confirm() {
    const ch = this.viewingChar;
    if (!ch) return;

    const unlocked = SaveManager.isUnlocked(ch.id) || ch.price === 0;

    if (unlocked) {
      if (this.currentTab === 'runner') {
        SaveManager.data.selectedRunner = ch.id;
      } else {
        SaveManager.data.selectedChaser = ch.id;
      }
      SaveManager.save();
      UIManager.toast(`${ch.name} selected! ✓`, 'ts');
      AudioManager.play('sel');
      this.render();
    } else {
      if (SaveManager.spendCoins(ch.price)) {
        SaveManager.unlock(ch.id);
        UIManager.toast(`${ch.name} unlocked! 🎉`, 'ts');
        AudioManager.play('buy');
        this.render();
      } else {
        UIManager.toast('Not enough coins!', 'te');
        AudioManager.vib(80);
      }
    }
  },
};


// ── Shop UI ──
const ShopUI = {
  currentTab: 'powerups',

  init() {
    this.currentTab = 'powerups';
    document.querySelectorAll('#shopScr .cs-tab').forEach((t, i) => {
      t.classList.toggle('active', i === 0);
    });
    this.render();
    UIManager.refreshCoins();
  },

  switchTab(tab, btn) {
    this.currentTab = tab;
    document.querySelectorAll('#shopScr .cs-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    this.render();
  },

  render() {
    const grid  = document.getElementById('shopGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const items = ShopData[this.currentTab] || [];

    items.forEach(item => {
      const owned = SaveManager.hasItem(item.id) || item.price === 0;
      const card  = document.createElement('div');
      card.className = `char-card${owned ? ' selected' : ''}`;
      card.style.padding = '16px 10px';
      card.onclick = () => this.buy(item);
      card.innerHTML = `
        <div style="font-size:34px;margin-bottom:7px">${item.icon}</div>
        <div class="char-card-name">${item.name}</div>
        <div style="color:rgba(255,255,255,.35);font-size:10px;text-align:center;margin-top:3px">${item.desc}</div>
        <div class="char-card-price" style="margin-top:8px">
          ${owned ? '✓ Owned' : '🪙 ' + item.price.toLocaleString()}
        </div>
      `;
      grid.appendChild(card);
    });
  },

  buy(item) {
    const owned = SaveManager.hasItem(item.id) || item.price === 0;
    if (owned && !item.consumable) { UIManager.toast('Already owned!', 'ti'); return; }
    if (SaveManager.spendCoins(item.price)) {
      SaveManager.addItem(item.id);
      UIManager.toast(`${item.name} purchased! ✨`, 'ts');
      AudioManager.play('buy');
      this.render();
    } else {
      UIManager.toast('Not enough coins!', 'te');
      AudioManager.vib(80);
    }
  },
};


// ── Mission UI ──
const MissionUI = {
  init() {
    const list = document.getElementById('missionList');
    if (!list) return;
    list.innerHTML = '';
    UIManager.refreshCoins();

    MissionData.forEach(m => {
      const prog    = this._getProgress(m);
      const pct     = Math.min(100, prog / m.target * 100);
      const done    = prog >= m.target;
      const claimed = SaveManager.getMissionProgress(m.id).claimed;

      const card = document.createElement('div');
      card.className = `mission-card${done ? ' done' : ''}`;
      if (done && !claimed) card.onclick = () => this.claim(m, card);

      card.innerHTML = `
        <div class="mission-icon-box" style="background:${m.iconBg}">${m.icon}</div>
        <div class="mission-info">
          <div class="mission-title">${m.title}</div>
          <div class="mission-desc">${m.desc}</div>
          <div class="mission-pbar">
            <div class="mission-pfill" style="width:${pct}%"></div>
          </div>
          <div class="mission-desc" style="margin-top:4px">
            ${Math.min(prog, m.target).toLocaleString()} / ${m.target.toLocaleString()}
          </div>
        </div>
        <div class="mission-reward">
          ${claimed ? '✅' : done ? '🎁' : '🪙 ' + m.reward}
        </div>
      `;
      list.appendChild(card);
    });
  },

  _getProgress(m) {
    const d = SaveManager.data;
    const mp = SaveManager.getMissionProgress(m.id);
    switch (m.type) {
      case 'coins_run':     return mp.progress || 0;
      case 'distance_run':  return mp.progress || 0;
      case 'score_best':    return d.highScore;
      case 'games_total':   return d.gamesPlayed;
      case 'coins_total':   return d.totalCoinsEver;
      default:              return 0;
    }
  },

  claim(m, card) {
    SaveManager.addCoins(m.reward);
    SaveManager.claimMission(m.id);
    UIManager.toast(`+${m.reward} coins! 🎉`, 'ts');
    AudioManager.play('buy');
    card.querySelector('.mission-reward').textContent = '✅';
    card.onclick = null;
  },
};


// ── Settings UI ──
const SettingsUI = {
  init() {
    const list = document.getElementById('settList');
    if (!list) return;
    list.innerHTML = '';

    const items = [
      { key: 'sfx',       label: '🔊 Sound Effects' },
      { key: 'music',     label: '🎵 Music' },
      { key: 'vibration', label: '📳 Vibration' },
      { key: 'particles', label: '🎨 Particles' },
      { key: 'showFps',   label: '📊 Show FPS' },
    ];

    items.forEach(it => {
      const on  = !!SaveManager.data.settings[it.key];
      const div = document.createElement('div');
      div.className = 'sett-item';
      div.innerHTML = `
        <span class="sett-label">${it.label}</span>
        <button class="toggle${on ? ' on' : ''}"
                onclick="SettingsUI.toggle('${it.key}', this)">
        </button>
      `;
      list.appendChild(div);
    });

    // Volume slider
    const volDiv = document.createElement('div');
    volDiv.className = 'sett-item';
    volDiv.innerHTML = `
      <span class="sett-label">🔉 Volume</span>
      <input type="range" style="width:110px;accent-color:#4A90D9"
             min="0" max="100" value="${SaveManager.data.settings.volume}"
             oninput="SaveManager.data.settings.volume=+this.value;SaveManager.save()">
    `;
    list.appendChild(volDiv);

    // Reset
    const resetDiv = document.createElement('div');
    resetDiv.style.cssText = 'text-align:center;margin-top:12px';
    resetDiv.innerHTML = `
      <button class="ovl-btn ovl-quit"
              style="width:auto;padding:10px 28px;display:inline-block"
              onclick="if(confirm('Reset ALL data? This cannot be undone!')){SaveManager.resetAll();UIManager.refreshMenu();UIManager.toast('Data reset!','ti')}">
        🗑️ Reset All Data
      </button>
    `;
    list.appendChild(resetDiv);
  },

  toggle(key, btn) {
    SaveManager.data.settings[key] = !SaveManager.data.settings[key];
    SaveManager.save();
    btn.classList.toggle('on', !!SaveManager.data.settings[key]);
    AudioManager.play('sel');
  },
};