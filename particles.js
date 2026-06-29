// ============================================
//  PARTICLE SYSTEM - js/particles.js
// ============================================

'use strict';

const ParticleSystem = {
  particles: [],
  MAX: 280,

  emit(x, y, count, cfg = {}) {
    if (!SaveManager.data.settings.particles) return;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.MAX) break;
      this.particles.push({
        x, y,
        vx: cfg.vx !== undefined ? cfg.vx + (Math.random() - 0.5) * 1.5 : (Math.random() - 0.5) * 6,
        vy: cfg.vy !== undefined ? cfg.vy + (Math.random() - 0.5) * 1.5 : -(Math.random() * 5 + 2),
        life: cfg.life || 1,
        maxLife: cfg.life || 1,
        size: cfg.sz  || (Math.random() * 4 + 2),
        color: cfg.col || '#FFD700',
        gravity: cfg.grav !== undefined ? cfg.grav : 0.1,
        rotation: Math.random() * 6.28,
        rotSpeed: (Math.random() - 0.5) * 0.18,
      });
    }
  },

  // Shortcuts
  coinFX(x, y) {
    this.emit(x, y, 8,  { col: '#FFD700', sz: 5,   grav: 0.04, life: 0.7  });
    this.emit(x, y, 4,  { col: '#FFA000', sz: 3,   grav: 0.06             });
  },
  jumpFX(x, y) {
    this.emit(x, y, 5,  { col: '#EEE',   sz: 3,   vy: 0.4, grav: -0.04, life: 0.38 });
  },
  slideFX(x, y) {
    this.emit(x, y, 2,  { col: '#999',   sz: 2.5, vx: -2,  vy: -0.5,   grav: 0.1,  life: 0.28 });
  },
  crashFX(x, y) {
    this.emit(x, y, 20, { col: '#FF4444', sz: 7,  grav: 0.14, life: 1.1 });
    this.emit(x, y, 12, { col: '#FF8800', sz: 6,  grav: 0.10, life: 0.9 });
    this.emit(x, y, 8,  { col: '#FFFF00', sz: 4,  grav: 0.07, life: 0.7 });
  },
  powFX(x, y) {
    this.emit(x, y, 20, { col: '#00FF88', sz: 5,  grav: 0,    life: 1.1 });
    this.emit(x, y, 10, { col: '#FFFFFF', sz: 3,  grav: -0.02, life: 0.85 });
  },
  shieldFX(x, y) {
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * 6.28;
      this.emit(x, y, 1, {
        col: '#4FACFE', sz: 4,
        vx: Math.cos(a) * 5, vy: Math.sin(a) * 5,
        grav: 0.04, life: 0.7,
      });
    }
  },

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x   += p.vx;
      p.y   += p.vy;
      p.vy  += p.gravity;
      p.life -= dt * 2;
      p.rotation += p.rotSpeed;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  },

  draw(ctx) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      const sz    = p.size * alpha;
      if (sz < 0.3) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }
  },

  clear() { this.particles = []; },
};