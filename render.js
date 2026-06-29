// ============================================
//  3D RENDERER - js/renderer.js
//  Full perspective rendering like Subway Surfers
//  Objects come from far and grow closer
// ============================================

'use strict';

const Renderer = {

  canvas: null,
  ctx:    null,
  W:      0,
  H:      0,

  // Camera config
  CAM_FOV:   300,
  CAM_Y:     260,
  CAM_PITCH: 0.70,
  HORIZON_Y: 0,   // set in resize()

  // Shake state
  shakeX: 0,
  shakeY: 0,
  shakeIntensity: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width  = this.W;
    this.canvas.height = this.H;
    this.HORIZON_Y = this.H * 0.42;
  },

  // ── Shake ──
  shake(intensity) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  },

  _updateShake() {
    if (this.shakeIntensity > 0) {
      this.shakeIntensity *= 0.88;
      this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      if (this.shakeIntensity < 0.4) {
        this.shakeIntensity = 0;
        this.shakeX = 0;
        this.shakeY = 0;
      }
    }
  },

  // ────────────────────────────────────────────
  //  PROJECT: 3D world → 2D screen
  //  x, y = world horizontal/vertical offset
  //  z    = depth (distance from camera)
  //
  //  Higher z = further away = smaller + higher up
  //  z=0 means at player's feet
  // ────────────────────────────────────────────
  project(wx, wy, wz) {
    const dz = wz;
    if (dz <= 0) return { sx: this.W / 2, sy: this.H, scale: 0, visible: false };

    const scale = this.CAM_FOV / dz;
    const sx = this.W / 2 + wx * scale;
    const sy = this.HORIZON_Y + (this.CAM_Y - wy) * scale;

    return { sx, sy, scale, visible: dz > 0 && sy < this.H + 50 };
  },

  // ── Get scale at a given z distance ──
  scaleAt(wz) {
    if (wz <= 0) return 0;
    return this.CAM_FOV / wz;
  },

  // ────────────────────────────────────────────
  //  MASTER RENDER CALL
  // ────────────────────────────────────────────
  render(gameState, dt) {
    const ctx = this.ctx;
    this._updateShake();

    ctx.save();
    if (this.shakeIntensity > 0) ctx.translate(this.shakeX, this.shakeY);

    this._drawSky(ctx);
    this._drawClouds(ctx, gameState);
    this._drawGround(ctx, gameState);
    this._drawBuildings(ctx, gameState);
    this._drawTrees(ctx, gameState);

    // Collect + sort all 3D objects
    const drawList = this._buildDrawList(gameState, dt);

    // Draw far → near
    for (const item of drawList) {
      this._drawItem(ctx, item, gameState, dt);
    }

    // Particles on top
    ParticleSystem.draw(ctx);

    // Effects
    this._drawPlayerEffects(ctx, gameState, dt);

    // FPS
    if (SaveManager.data.settings.showFps) {
      ctx.fillStyle = 'rgba(255,255,0,0.8)';
      ctx.font = '12px monospace';
      ctx.fillText(`FPS: ${gameState.fps}`, 8, this.H - 8);
    }

    ctx.restore();
  },

  // ── Sky ──
  _drawSky(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, this.HORIZON_Y);
    g.addColorStop(0,   '#0d0d2e');
    g.addColorStop(0.3, '#1a2a5e');
    g.addColorStop(0.8, '#5b8ac9');
    g.addColorStop(1,   '#9ecfed');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.HORIZON_Y);

    // Sun/moon
    ctx.fillStyle = 'rgba(255,220,100,0.85)';
    ctx.beginPath();
    ctx.arc(this.W * 0.82, this.H * 0.07, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,220,100,0.12)';
    ctx.beginPath();
    ctx.arc(this.W * 0.82, this.H * 0.07, 40, 0, Math.PI * 2);
    ctx.fill();
  },

  // ── Clouds ──
  _drawClouds(ctx, gs) {
    if (!gs.clouds) return;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (const cl of gs.clouds) {
      const pr = this.project(cl.wx, cl.wy, cl.wz);
      if (!pr.visible) continue;
      const s = cl.size * pr.scale;
      if (s < 2) continue;
      ctx.beginPath();
      ctx.arc(pr.sx,           pr.sy,          s * 0.55, 0, Math.PI * 2);
      ctx.arc(pr.sx - s * 0.4, pr.sy + s * 0.1, s * 0.38, 0, Math.PI * 2);
      ctx.arc(pr.sx + s * 0.4, pr.sy + s * 0.1, s * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // ────────────────────────────────────────────
  //  GROUND WITH PERSPECTIVE GRID
  //  This creates the "corridor" look
  // ────────────────────────────────────────────
  _drawGround(ctx, gs) {
    const W  = this.W;
    const H  = this.H;
    const hy = this.HORIZON_Y;
    const tw = gs.trackWidth || 240;

    // Green sides
    const gGrad = ctx.createLinearGradient(0, hy, 0, H);
    gGrad.addColorStop(0,   '#4a7c4e');
    gGrad.addColorStop(0.4, '#3d6b42');
    gGrad.addColorStop(1,   '#2a4a2e');
    ctx.fillStyle = gGrad;
    ctx.fillRect(0, hy, W, H - hy);

    // Road perspective segments
    const SEGS = 50;
    const zStart = gs.camZ || 0;

    for (let i = 0; i < SEGS; i++) {
      const z1 = zStart + i * 18;
      const z2 = zStart + (i + 1) * 18;

      const pL1 = this.project(-tw / 2 - 12, 0, z1);
      const pR1 = this.project( tw / 2 + 12, 0, z1);
      const pL2 = this.project(-tw / 2 - 12, 0, z2);
      const pR2 = this.project( tw / 2 + 12, 0, z2);

      if (!pL1.visible || pL1.sy < hy - 1) continue;

      // Alternating road shades
      ctx.fillStyle = i % 2 === 0 ? '#565656' : '#505050';
      ctx.beginPath();
      ctx.moveTo(pL1.sx, pL1.sy);
      ctx.lineTo(pR1.sx, pR1.sy);
      ctx.lineTo(pR2.sx, pR2.sy);
      ctx.lineTo(pL2.sx, pL2.sy);
      ctx.closePath();
      ctx.fill();

      // Curb/edge
      const edgeW = 8 * pL1.scale;
      ctx.fillStyle = '#8a8a8a';
      ctx.fillRect(pL1.sx - edgeW, pL1.sy, edgeW, (pL2.sy - pL1.sy) + 0.5);
      ctx.fillRect(pR1.sx,          pR1.sy, edgeW, (pR2.sy - pR1.sy) + 0.5);
    }

    // Lane dividers
    const laneXs = [-tw / 6, tw / 6];
    for (const lx of laneXs) {
      for (let i = 0; i < SEGS; i++) {
        const z1 = zStart + i * 18;
        const z2 = zStart + (i + 1) * 18;
        const dash = Math.floor((z1 * 0.08 + gs.scrollOffset * 0.05)) % 3;
        if (dash) continue;

        const p1 = this.project(lx, 0.5, z1);
        const p2 = this.project(lx, 0.5, z2);
        if (!p1.visible || p1.sy < hy) continue;

        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = Math.max(0.5, 2 * p1.scale);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();
      }
    }
  },

  // ── Buildings ──
  _drawBuildings(ctx, gs) {
    if (!gs.buildings) return;
    for (const b of gs.buildings) {
      const pr = this.project(b.wx, 0, b.wz);
      if (!pr.visible || pr.scale < 0.03) continue;
      const bw = b.w * pr.scale;
      const bh = b.h * pr.scale;
      const bx = pr.sx - bw / 2;
      const by = pr.sy - bh;

      ctx.fillStyle = b.color;
      ctx.fillRect(bx, by, bw, bh);

      // Windows
      ctx.fillStyle = 'rgba(255,255,180,0.22)';
      const wc = b.winCols || 3;
      const wr = b.winRows || 4;
      const ww = bw / (wc + 1);
      const wh = bh / (wr + 1);
      for (let r = 1; r <= Math.min(wr, 6); r++) {
        for (let c = 0; c < wc; c++) {
          if ((r * 7 + c * 13 + b.seed) % 4 !== 0) {
            ctx.fillRect(bx + 3 + c * ww, by + r * wh, ww * 0.5, wh * 0.5);
          }
        }
      }
    }
  },

  // ── Trees ──
  _drawTrees(ctx, gs) {
    if (!gs.trees) return;
    for (const t of gs.trees) {
      const pr = this.project(t.wx, 0, t.wz);
      if (!pr.visible || pr.scale < 0.04) continue;
      const s = pr.scale;
      // Trunk
      ctx.fillStyle = '#5D4037';
      ctx.fillRect(pr.sx - 3 * s, pr.sy - 28 * s, 6 * s, 28 * s);
      // Leaves
      ctx.fillStyle = '#2E7D32';
      ctx.beginPath();
      ctx.arc(pr.sx, pr.sy - 38 * s, 16 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#388E3C';
      ctx.beginPath();
      ctx.arc(pr.sx + 7 * s, pr.sy - 33 * s, 12 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // ── Build sorted draw list ──
  _buildDrawList(gs, dt) {
    const list = [];

    // Obstacles
    if (gs.obstacles) {
      for (const o of gs.obstacles) {
        list.push({ type: 'obstacle', z: o.wz, data: o });
      }
    }

    // Coins
    if (gs.coins) {
      for (const c of gs.coins) {
        list.push({ type: 'coin', z: c.wz, data: c });
      }
    }

    // Power-ups
    if (gs.powerups) {
      for (const p of gs.powerups) {
        list.push({ type: 'powerup', z: p.wz, data: p });
      }
    }

    // Chaser
    if (gs.chaser) {
      list.push({ type: 'chaser', z: gs.chaser.wz, data: gs.chaser });
    }

    // Player
    if (gs.player) {
      list.push({ type: 'player', z: gs.player.wz, data: gs.player });
    }

    // Sort far to near (big z = far away = draw first)
    list.sort((a, b) => b.z - a.z);
    return list;
  },

  // ── Draw each item ──
  _drawItem(ctx, item, gs, dt) {
    switch (item.type) {
      case 'obstacle': this._drawObstacle(ctx, item.data, gs, dt); break;
      case 'coin':     this._drawCoin(ctx, item.data, gs, dt);     break;
      case 'powerup':  this._drawPowerup(ctx, item.data, gs, dt);  break;
      case 'chaser':   this._drawChaser(ctx, gs, dt);              break;
      case 'player':   this._drawPlayer(ctx, gs, dt);              break;
    }
  },

  // ── Obstacle ──
  _drawObstacle(ctx, o, gs, dt) {
    const pr = this.project(o.wx, 0, o.wz);
    if (!pr.visible || pr.scale < 0.04) return;
    const s  = pr.scale;
    const dw = o.typeData.w * s;
    const dh = o.typeData.h * s;
    const drawY = o.typeData.elevated ? pr.sy - 20 * s : pr.sy;

    ctx.save();
    ctx.globalAlpha = Math.min(1, s * 4);

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(pr.sx, pr.sy + 2, dw * 0.52, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw sprite or fallback
    SpriteManager.drawObstacle(ctx, o.typeData, pr.sx, drawY, dw, dh);

    // Warning indicator when approaching (shows before it's in lane)
    if (s > 0.08 && s < 0.3) {
      ctx.fillStyle = 'rgba(255,50,50,0.65)';
      ctx.beginPath();
      ctx.arc(pr.sx, pr.sy - dh - 6 * s, 5 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  // ── Coin ──
  _drawCoin(ctx, c, gs, dt) {
    const bob  = Math.sin(gs.animTime * 5 + c.bobPhase) * 4;
    const pr   = this.project(c.wx, 16 + (c.yOff || 0) + bob, c.wz);
    if (!pr.visible || pr.scale < 0.04) return;
    const s  = pr.scale;
    const sz = 9 * s;

    ctx.save();
    ctx.globalAlpha = Math.min(1, s * 4);

    // Glow
    ctx.fillStyle = 'rgba(255,215,0,0.22)';
    ctx.beginPath();
    ctx.arc(pr.sx, pr.sy, sz * 2, 0, Math.PI * 2);
    ctx.fill();

    // Coin spin
    const spin = Math.abs(Math.cos(gs.animTime * 4 + c.bobPhase));
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.ellipse(pr.sx, pr.sy, sz * spin, sz, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shine
    ctx.fillStyle = '#FFF8DC';
    ctx.beginPath();
    ctx.ellipse(pr.sx - sz * 0.2, pr.sy - sz * 0.2, sz * 0.28 * spin, sz * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // $ label
    if (sz > 4) {
      ctx.fillStyle = '#B8860B';
      ctx.font = `bold ${Math.max(5, Math.floor(sz))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', pr.sx, pr.sy + 0.5);
    }

    ctx.restore();
  },

  // ── Power-up ──
  _drawPowerup(ctx, pu, gs, dt) {
    const bob = Math.sin(gs.animTime * 3.5 + pu.bobPhase) * 7;
    const pr  = this.project(pu.wx, 28 + bob, pu.wz);
    if (!pr.visible || pr.scale < 0.04) return;
    const s  = pr.scale;
    const sz = 14 * s;

    ctx.save();
    ctx.globalAlpha = Math.min(1, s * 4);

    // Glow ring
    const glow = Math.sin(gs.animTime * 5 + pu.bobPhase) * 3;
    ctx.strokeStyle = 'rgba(0,255,136,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pr.sx, pr.sy, sz + 5 + glow, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0,255,136,0.12)';
    ctx.beginPath();
    ctx.arc(pr.sx, pr.sy, sz, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#00CC66';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pr.sx, pr.sy, sz, 0, Math.PI * 2);
    ctx.stroke();

    // Icon
    ctx.font = `${Math.max(10, Math.floor(sz * 1.25))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pu.itemData.icon, pr.sx, pr.sy);

    ctx.restore();
  },

  // ── Player ──
  _drawPlayer(ctx, gs, dt) {
    const pl = gs.player;
    const pr = this.project(pl.wx, pl.wy + pl.charH / 2, pl.wz);
    if (!pr.visible) return;
    const s = pr.scale;

    // Draw scale relative to reference z=300
    const drawScale = s / (this.CAM_FOV / 300);
    const dw = pl.charW * drawScale;
    const dh = pl.charH * drawScale;

    ctx.save();

    // Invulnerability flash
    if (pl.invTimer > 0 && Math.floor(pl.invTimer * 12) % 2 === 0) {
      ctx.globalAlpha = 0.3;
    }
    if (gs.invisible) ctx.globalAlpha = 0.25;

    // Giant scale
    if (gs.giant) {
      ctx.translate(pr.sx, pr.sy);
      ctx.scale(1.7, 1.7);
      ctx.translate(-pr.sx, -pr.sy);
    }

    // Ground shadow
    const gpr = this.project(pl.wx, 0, pl.wz);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(gpr.sx, gpr.sy + 2, dw * 0.45, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Character sprite/fallback
    SpriteManager.drawCharacter(
      ctx,
      'player',
      pr.sx,
      pr.sy,
      dw,
      dh,
      pl.charData,
      pl.state,
      dt
    );

    // Jetpack flames
    if (gs.jetpack) {
      const gy = gpr.sy;
      ctx.fillStyle = '#FF6600';
      ctx.beginPath();
      ctx.moveTo(pr.sx - 6 * s, gy);
      ctx.lineTo(pr.sx, gy + (14 + Math.random() * 10) * s);
      ctx.lineTo(pr.sx + 6 * s, gy);
      ctx.fill();
      ctx.fillStyle = '#FFFF00';
      ctx.beginPath();
      ctx.moveTo(pr.sx - 3 * s, gy);
      ctx.lineTo(pr.sx, gy + (7 + Math.random() * 6) * s);
      ctx.lineTo(pr.sx + 3 * s, gy);
      ctx.fill();
    }

    ctx.restore();
  },

  // ── Chaser ──
  _drawChaser(ctx, gs, dt) {
    const ch = gs.chaser;
    const pr = this.project(ch.wx, ch.charH / 2, ch.wz);
    if (!pr.visible) return;
    const s = pr.scale;

    const drawScale = s / (this.CAM_FOV / 300);
    const dw = ch.charW * drawScale;
    const dh = ch.charH * drawScale;

    ctx.save();

    // Shadow
    const gpr = this.project(ch.wx, 0, ch.wz);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(gpr.sx, gpr.sy + 2, dw * 0.4, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mark as chaser so eyes draw red
    ch.charData.isChaser = true;

    SpriteManager.drawCharacter(
      ctx,
      'chaser',
      pr.sx,
      pr.sy,
      dw,
      dh,
      ch.charData,
      'run',
      dt
    );

    // Anger emoji
    const angBob = Math.sin(gs.animTime * 4) * 3;
    ctx.font = `${Math.max(10, Math.floor(18 * drawScale))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💢', pr.sx + dw * 0.55, pr.sy - dh * 0.62 + angBob);

    // Running dust
    if (Math.random() < 0.18) {
      const dp = this.project(ch.wx - 12 + Math.random() * 24, 2, ch.wz - 10);
      ParticleSystem.emit(dp.sx, dp.sy, 1, {
        col: '#AAA', sz: 2.5,
        vx: (Math.random() - 0.5) * 2, vy: -0.8,
        grav: 0.06, life: 0.3
      });
    }

    ctx.restore();
  },

  // ── Player visual effects ──
  _drawPlayerEffects(ctx, gs, dt) {
    if (!gs.player) return;
    const pl = gs.player;
    const pr = this.project(pl.wx, pl.wy + pl.charH / 2, pl.wz);
    if (!pr.visible) return;

    const drawScale = pr.scale / (this.CAM_FOV / 300);
    const r = Math.max(pl.charW, pl.charH) * drawScale * 0.75;

    // Shield bubble
    if (gs.shield) {
      const pulse = Math.sin(gs.animTime * 6) * 2;
      ctx.strokeStyle = 'rgba(79,172,254,0.55)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(pr.sx, pr.sy, r + 5 + pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(79,172,254,0.06)';
      ctx.fill();
    }

    // Magnet field
    if (gs.magnet) {
      ctx.strokeStyle = 'rgba(255,215,0,0.25)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(pr.sx, pr.sy, r * 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Giant glow
    if (gs.giant) {
      const glow = Math.sin(gs.animTime * 8) * 4;
      ctx.strokeStyle = 'rgba(255,152,0,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pr.sx, pr.sy, r + 10 + glow, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
};