// ============================================
//  SAVE MANAGER - js/save.js
//  Handles all localStorage persistence
// ============================================

'use strict';

const SaveManager = {

  KEY: 'oggy_runner_v4',

  defaults: {
    coins: 500,
    highScore: 0,
    totalDistance: 0,
    totalCoinsEver: 0,
    gamesPlayed: 0,

    selectedRunner: 'oggy',
    selectedChaser: 'dee_dee',

    unlockedChars: ['oggy', 'dee_dee'],
    purchasedItems: ['magnet'],   // magnet free by default

    activeBoosts: [],             // consumable boosts equipped

    settings: {
      sfx:       true,
      music:     true,
      vibration: true,
      particles: true,
      showFps:   false,
      volume:    80
    },

    missions: {},                 // { missionId: { progress, claimed } }
    achievements: [],

    stats: {
      bestDistance:    0,
      bestCoinsRun:    0,
      powerupsUsed:    0,
      obstaclesSmashed: 0,
    }
  },

  data: null,

  // ── Load from storage ──
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = this._deepMerge(
          JSON.parse(JSON.stringify(this.defaults)),
          parsed
        );
      } else {
        this.data = JSON.parse(JSON.stringify(this.defaults));
      }
    } catch (e) {
      console.warn('[SaveManager] Load error:', e);
      this.data = JSON.parse(JSON.stringify(this.defaults));
    }
    return this.data;
  },

  // ── Save to storage ──
  save() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('[SaveManager] Save error:', e);
    }
  },

  // ── Deep merge helper ──
  _deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this._deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  },

  // ── Coin helpers ──
  addCoins(amount) {
    this.data.coins          += amount;
    this.data.totalCoinsEver += amount;
    this.save();
    UIManager.refreshCoins();
  },

  spendCoins(amount) {
    if (this.data.coins >= amount) {
      this.data.coins -= amount;
      this.save();
      UIManager.refreshCoins();
      return true;
    }
    return false;
  },

  // ── Character unlock ──
  isUnlocked(charId) {
    return this.data.unlockedChars.includes(charId);
  },

  unlock(charId) {
    if (!this.isUnlocked(charId)) {
      this.data.unlockedChars.push(charId);
      this.save();
    }
  },

  // ── Item purchase ──
  hasItem(itemId) {
    return this.data.purchasedItems.includes(itemId);
  },

  addItem(itemId) {
    if (!this.hasItem(itemId)) {
      this.data.purchasedItems.push(itemId);
      this.save();
    }
  },

  // ── Score / distance update ──
  recordRun({ score, distance, coins, time }) {
    if (score > this.data.highScore) this.data.highScore = Math.floor(score);
    if (distance > this.data.stats.bestDistance) this.data.stats.bestDistance = Math.floor(distance);
    if (coins > this.data.stats.bestCoinsRun)     this.data.stats.bestCoinsRun = coins;
    this.data.totalDistance += Math.floor(distance);
    this.data.gamesPlayed++;
    this.addCoins(coins);
    this.save();
  },

  // ── Mission progress ──
  getMissionProgress(id) {
    return this.data.missions[id] || { progress: 0, claimed: false };
  },

  updateMission(id, value) {
    if (!this.data.missions[id]) this.data.missions[id] = { progress: 0, claimed: false };
    this.data.missions[id].progress = value;
    this.save();
  },

  claimMission(id) {
    if (this.data.missions[id]) {
      this.data.missions[id].claimed = true;
      this.save();
    }
  },

  // ── Full reset ──
  resetAll() {
    this.data = JSON.parse(JSON.stringify(this.defaults));
    this.save();
    UIManager.refreshCoins();
  }
};