// ============================================
//  SPRITE SYSTEM - js/sprites.js
//  Loads PNG sprites, falls back to canvas
//  drawing if images not found.
//
//  HOW TO ADD YOUR OWN CHARACTER SPRITES:
//  1. Get PNG images of Oggy running, jumping, sliding
//  2. Cut into individual frames (transparent background)
//  3. Name them: run0.png, run1.png ... run5.png
//               jump0.png, slide0.png
//  4. Put in sprites/runners/oggy/ folder
//  5. Game will automatically use them!
// ============================================

'use strict';

const SpriteManager = {

  // Loaded image cache
  cache: {},

  // Animation frame timers per entity
  animTimers: {},

  // Default sprite size in world units
  DEFAULT_W: 60,
  DEFAULT_H: 80,

  // ── Load a single image ──
  loadImage(src) {
    if (this.cache[src]) return Promise.resolve(this.cache[src]);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload  = () => { this.cache[src] = img; resolve(img); };
      img.onerror = () => {
        // Return null - will use fallback drawing
        this.cache[src] = null;
        resolve(null);
      };
      img.src = src;
    });
  },

  // ── Preload all sprites for a character ──
  async preloadCharacter(charData) {
    if (!charData.spritePath) return;
    const { spritePath, spriteFrames } = charData;

    const loads = [];

    if (spriteFrames.run) {
      for (let i = 0; i < spriteFrames.run; i++) {
        loads.push(this.loadImage(`${spritePath}/run${i}.png`));
      }
    }
    if (spriteFrames.jump) {
      for (let i = 0; i < spriteFrames.jump; i++) {
        loads.push(this.loadImage(`${spritePath}/jump${i}.png`));
      }
    }
    if (spriteFrames.slide) {
      for (let i = 0; i < spriteFrames.slide; i++) {
        loads.push(this.loadImage(`${spritePath}/slide${i}.png`));
      }
    }
    if (spriteFrames.fall) {
      for (let i = 0; i < spriteFrames.fall; i++) {
        loads.push(this.loadImage(`${spritePath}/fall${i}.png`));
      }
    }

    await Promise.all(loads);
  },

  // ── Preload obstacle sprites ──
  async preloadObstacles() {
    const loads = ObstacleTypes.map(t =>
      t.spritePath ? this.loadImage(t.spritePath) : Promise.resolve(null)
    );
    await Promise.all(loads);
  },

  // ── Get the correct frame image ──
  getFrame(spritePath, state, frameIndex) {
    const key = `${spritePath}/${state}${frameIndex}.png`;
    return this.cache[key] || null;
  },

  // ── Calculate current animation frame ──
  getAnimFrame(entityId, frameCount, fps = 12) {
    if (!this.animTimers[entityId]) {
      this.animTimers[entityId] = { t: 0, frame: 0 };
    }
    return this.animTimers[entityId].frame % frameCount;
  },

  // ── Tick animation timer for an entity ──
  tickAnim(entityId, dt, frameCount, fps = 10) {
    if (!this.animTimers[entityId]) {
      this.animTimers[entityId] = { t: 0, frame: 0 };
    }
    const timer = this.animTimers[entityId];
    timer.t += dt;
    if (timer.t >= 1 / fps) {
      timer.t = 0;
      timer.frame = (timer.frame + 1) % frameCount;
    }
    return timer.frame;
  },

  // ────────────────────────────────────────────
  //  DRAW CHARACTER
  //  Tries to use loaded sprite first.
  //  Falls back to hand-drawn if no sprite.
  // ────────────────────────────────────────────
  drawCharacter(ctx, entityId, x, y, drawW, drawH, charData, state, dt) {
    const { spritePath, spriteFrames, type } = charData;

    // Determine current anim state
    let animState = 'run';
    let frameCount = spriteFrames?.run || 1;

    if (state === 'jump')  { animState = 'jump';  frameCount = spriteFrames?.jump  || 1; }
    if (state === 'slide') { animState = 'slide'; frameCount = spriteFrames?.slide || 1; }
    if (state === 'fall')  { animState = 'fall';  frameCount = spriteFrames?.fall  || 1; }

    const frame = this.tickAnim(entityId, dt, frameCount, 10);
    const img   = this.getFrame(spritePath, animState, frame);

    if (img) {
      // ── SPRITE FOUND: draw the PNG ──
      ctx.save();

      if (state === 'slide') {
        // Flatten for slide
        ctx.translate(x, y + drawH * 0.3);
        ctx.scale(1.15, 0.55);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        ctx.drawImage(img, x - drawW / 2, y - drawH / 2, drawW, drawH);
      }

      ctx.restore();
    } else {
      // ── NO SPRITE: fallback canvas drawing ──
      if (type === 'roach') {
        this.drawFallbackRoach(ctx, entityId, x, y, drawW, drawH, charData, state, dt);
      } else {
        this.drawFallbackCat(ctx, entityId, x, y, drawW, drawH, charData, state, dt);
      }
    }
  },

  // ────────────────────────────────────────────
  //  FALLBACK CAT DRAWING
  //  Used when no sprite PNG is available
  // ────────────────────────────────────────────
  drawFallbackCat(ctx, entityId, x, y, w, h, charData, state, dt) {
    const col    = charData.fallbackColor || '#4A90D9';
    const belly  = charData.fallbackBelly || '#87CEEB';
    const legAnim = this.animTimers[entityId]?.frame * 0.8 || 0;

    ctx.save();
    ctx.translate(x, y);

    // Slide transform
    if (state === 'slide') {
      ctx.translate(0, h * 0.28);
      ctx.rotate(-0.42);
      ctx.scale(1.18, 0.52);
    }

    // Body
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly patch
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(1, h * 0.06, w * 0.32, h * 0.30, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, -h * 0.41, w * 0.41, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    for (const sx of [-1, 1]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(sx * w * 0.29, -h * 0.55);
      ctx.lineTo(sx * w * 0.16, -h * 0.80);
      ctx.lineTo(sx * w * 0.03, -h * 0.55);
      ctx.fill();
      // Inner ear
      ctx.fillStyle = '#FF9999';
      ctx.beginPath();
      ctx.moveTo(sx * w * 0.24, -h * 0.57);
      ctx.lineTo(sx * w * 0.16, -h * 0.72);
      ctx.lineTo(sx * w * 0.08, -h * 0.57);
      ctx.fill();
    }

    // Eyes (white + pupil)
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.ellipse(sx * w * 0.15, -h * 0.43, w * 0.12, w * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(sx * w * 0.13 + 1.5, -h * 0.43, w * 0.065, 0, Math.PI * 2);
      ctx.fill();
      // Eye shine
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(sx * w * 0.155 + 2, -h * 0.45, w * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nose
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.34, w * 0.048, w * 0.033, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.2;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx * w * 0.055, -h * 0.3, w * 0.052, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }

    // Whiskers
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.8;
    for (const sx of [-1, 1]) {
      for (let wi = -1; wi <= 1; wi++) {
        ctx.beginPath();
        ctx.moveTo(sx * w * 0.2, -h * 0.35 + wi * 3);
        ctx.lineTo(sx * w * 0.54, -h * 0.37 + wi * 4.5);
        ctx.stroke();
      }
    }

    // Legs (not during slide)
    if (state !== 'slide') {
      for (const sx of [-1, 1]) {
        const phase = sx === 1 ? 0 : Math.PI;

        // Upper leg
        ctx.save();
        ctx.translate(sx * w * 0.21, h * 0.37);
        ctx.rotate(Math.sin(legAnim + phase) * 0.42);
        ctx.fillStyle = col;
        ctx.fillRect(-4, 0, 8, h * 0.22);
        // Foot
        ctx.fillStyle = belly;
        ctx.fillRect(-5, h * 0.19, 10, 5);
        ctx.restore();

        // Arm
        ctx.save();
        ctx.translate(sx * w * 0.41, -h * 0.08);
        ctx.rotate(Math.sin(legAnim + phase + Math.PI) * 0.3);
        ctx.fillStyle = col;
        ctx.fillRect(-3, 0, 6, h * 0.17);
        ctx.restore();
      }
    }

    // Tail
    ctx.strokeStyle = col;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    const tailSway = Math.sin(legAnim * 1.8) * 6;
    ctx.beginPath();
    ctx.moveTo(-w * 0.09, h * 0.3);
    ctx.quadraticCurveTo(-w * 0.58, h * 0.08 + tailSway, -w * 0.44, -h * 0.12 + tailSway);
    ctx.stroke();

    ctx.restore();
  },

  // ────────────────────────────────────────────
  //  FALLBACK COCKROACH DRAWING
  // ────────────────────────────────────────────
  drawFallbackRoach(ctx, entityId, x, y, w, h, charData, state, dt) {
    const col    = charData.fallbackColor || '#8BC34A';
    const shell  = charData.fallbackBelly || '#AED581';
    const legAnim = (this.animTimers[entityId]?.frame || 0) * 0.9;

    ctx.save();
    ctx.translate(x, y);

    // Body
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shell highlight
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.ellipse(w * 0.08, -h * 0.04, w * 0.17, h * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spine line
    ctx.strokeStyle = 'rgba(0,0,0,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.36);
    ctx.lineTo(0, h * 0.36);
    ctx.stroke();

    // Head
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, -h * 0.45, w * 0.30, 0, Math.PI * 2);
    ctx.fill();

    // Antennae
    const aw = Math.sin(legAnim * 3) * 4;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * w * 0.1, -h * 0.57);
      ctx.quadraticCurveTo(sx * w * 0.3, -h * 0.84 + aw * sx, sx * w * 0.37, -h * 0.9);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(sx * w * 0.37, -h * 0.9, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyes
    const eyeColor = charData.id?.includes('chaser') || charData.isChaser ? '#FF0000' : '#FFD700';
    for (const sx of [-1, 1]) {
      ctx.fillStyle = eyeColor;
      ctx.beginPath();
      ctx.arc(sx * w * 0.12, -h * 0.47, w * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(sx * w * 0.10 + 1, -h * 0.47, w * 0.06, 0, Math.PI * 2);
      ctx.fill();
      // Eye shine
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(sx * w * 0.13 + 1.5, -h * 0.49, w * 0.03, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mouth
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -h * 0.37, w * 0.08, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // 6 Legs
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 3; i++) {
      const yo = -h * 0.14 + i * h * 0.19;
      for (const sx of [-1, 1]) {
        const phase = legAnim + i * 2.1 + (sx === 1 ? Math.PI : 0);
        const lx1 = sx * w * 0.41;
        const lx2 = sx * w * 0.70;
        const lx3 = sx * w * 0.80;
        const ly2 = yo + Math.sin(phase) * 5 + 5;
        const ly3 = yo + 10 + Math.sin(phase) * 3;
        ctx.beginPath();
        ctx.moveTo(lx1, yo);
        ctx.lineTo(lx2, ly2);
        ctx.lineTo(lx3, ly3);
        ctx.stroke();
      }
    }

    ctx.restore();
  },

  // ── Draw obstacle (sprite or fallback) ──
  drawObstacle(ctx, obsType, x, y, drawW, drawH) {
    const img = obsType.spritePath ? (this.cache[obsType.spritePath] || null) : null;

    if (img) {
      ctx.drawImage(img, x - drawW / 2, y - drawH, drawW, drawH);
    } else {
      this._drawFallbackObstacle(ctx, obsType, x, y, drawW, drawH);
    }
  },

  _drawFallbackObstacle(ctx, obsType, x, y, drawW, drawH) {
    const bx = x - drawW / 2;
    const by = y - drawH;

    // Main body
    ctx.fillStyle = obsType.color;
    this._rr(ctx, bx, by, drawW, drawH, 4);
    ctx.fill();

    // Top shade
    ctx.fillStyle = obsType.color2 || 'rgba(0,0,0,0.2)';
    this._rr(ctx, bx, by, drawW, drawH * 0.3, 4);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(bx + 2, by + 2, drawW * 0.38, drawH * 0.28);

    // Warning stripes
    if (obsType.stripe) {
      ctx.fillStyle = obsType.stripe;
      const sw = drawW / 8;
      ctx.save();
      ctx.beginPath();
      this._rr(ctx, bx, by, drawW, drawH, 4);
      ctx.clip();
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(bx + i * sw * 2, by, sw, drawH);
      }
      ctx.restore();
    }

    // Type-specific extras
    if (obsType.id === 'car' || obsType.id === 'truck') {
      // Windshield
      ctx.fillStyle = 'rgba(135,206,250,0.5)';
      ctx.fillRect(x - drawW * 0.15, by + 3, drawW * 0.45, drawH * 0.36);
      // Wheels
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(x - drawW * 0.28, y + 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + drawW * 0.28, y + 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (obsType.id === 'cone') {
      // Triangle shape override
      ctx.fillStyle = obsType.color;
      ctx.beginPath();
      ctx.moveTo(x, by);
      ctx.lineTo(x + drawW / 2, y);
      ctx.lineTo(x - drawW / 2, y);
      ctx.closePath();
      ctx.fill();
      // White stripe
      ctx.fillStyle = '#FFF';
      ctx.fillRect(x - drawW * 0.3, by + drawH * 0.5, drawW * 0.6, drawH * 0.12);
    }
  },

  _rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },
};