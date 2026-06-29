// ============================================
//  AUDIO MANAGER - js/audio.js
// ============================================

'use strict';

const AudioManager = {
  ctx: null,

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[AudioManager] No AudioContext');
    }
  },

  wake() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  },

  play(name, vol = 0.22) {
    if (!SaveManager.data.settings.sfx || !this.ctx) return;
    const v = vol * (SaveManager.data.settings.volume / 100);
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.connect(g);
      g.connect(this.ctx.destination);
      g.gain.value = v;
      const t = this.ctx.currentTime;

      switch (name) {
        case 'jump':
          o.frequency.setValueAtTime(260, t);
          o.frequency.exponentialRampToValueAtTime(520, t + 0.1);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          o.start(t); o.stop(t + 0.15);
          break;
        case 'coin':
          o.type = 'sine';
          o.frequency.setValueAtTime(880, t);
          o.frequency.setValueAtTime(1100, t + 0.04);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
          o.start(t); o.stop(t + 0.10);
          break;
        case 'hit':
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(170, t);
          o.frequency.exponentialRampToValueAtTime(35, t + 0.3);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
          o.start(t); o.stop(t + 0.32);
          break;
        case 'pow':
          o.type = 'sine';
          o.frequency.setValueAtTime(400, t);
          o.frequency.exponentialRampToValueAtTime(1200, t + 0.2);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
          o.start(t); o.stop(t + 0.24);
          break;
        case 'slide':
          o.type = 'triangle';
          o.frequency.setValueAtTime(360, t);
          o.frequency.exponentialRampToValueAtTime(130, t + 0.12);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
          o.start(t); o.stop(t + 0.12);
          break;
        case 'lane':
          o.type = 'sine';
          o.frequency.setValueAtTime(460, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
          o.start(t); o.stop(t + 0.07);
          break;
        case 'go':
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(330, t);
          o.frequency.exponentialRampToValueAtTime(70, t + 0.6);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
          o.start(t); o.stop(t + 0.7);
          break;
        case 'buy':
          o.type = 'sine';
          o.frequency.setValueAtTime(500, t);
          o.frequency.setValueAtTime(700, t + 0.07);
          o.frequency.setValueAtTime(1100, t + 0.14);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
          o.start(t); o.stop(t + 0.28);
          break;
        case 'sel':
          o.type = 'sine';
          o.frequency.setValueAtTime(580, t);
          o.frequency.setValueAtTime(780, t + 0.04);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
          o.start(t); o.stop(t + 0.08);
          break;
        default:
          o.frequency.value = 440;
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
          o.start(t); o.stop(t + 0.08);
      }
    } catch (e) {}
  },

  vib(ms = 40) {
    if (SaveManager.data.settings.vibration && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  },
};