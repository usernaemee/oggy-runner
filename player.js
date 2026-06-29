// ============================================
//  PLAYER SYSTEM - js/player.js
// ============================================

'use strict';

const PlayerSystem = {

  GRAVITY:    38,
  JUMP_FORCE: 15,
  LANE_SPEED: 14,

  // ── Move left ──
  moveLeft() {
    const pl = GameState.player;
    if (!pl || pl.lane <= 0) return;
    pl.lane--;
    pl.targetWX = GameState.LANE_POSITIONS[pl.lane];
    AudioManager.play('lane');
    ParticleSystem.emit(
      Renderer.W / 2, Renderer.H * 0.7,
      3, { col: '#FFF', sz: 3, vx: -3, vy: -1, grav: 0.08, life: 0.25 }
    );
  },

  // ── Move right ──
  moveRight() {
    const pl = GameState.player;
    if (!pl || pl.lane >= 2) return;
    pl.lane++;
    pl.targetWX = GameState.LANE_POSITIONS[pl.lane];
    AudioManager.play('lane');
    ParticleSystem.emit(
      Renderer.W / 2, Renderer.H * 0.7,
      3, { col: '#FFF', sz: 3, vx: 3, vy: -1, grav: 0.08, life: 0.25 }
    );
  },

  // ── Jump ──
  jump() {
    const pl  = GameState.player;
    if (!pl) return;
    if (pl.state === 'jump' || pl.state === 'slide') return;

    const rd = pl.charData;
    const jf = this.JUMP_FORCE * (rd.jumpMult || 1.0);
    pl.vy    = jf;
    pl.state = 'jump';
    AudioManager.play('jump');

    // Foot dust particles
    const pr = Renderer.project(pl.wx, 0, pl.wz);
    ParticleSystem.jumpFX(pr.sx, pr.sy);
  },

  // ── Slide ──
  slide() {
    const pl = GameState.player;
    if (!pl) return;
    if (pl.state === 'jump' || pl.state === 'slide') return;

    pl.state      = 'slide';
    pl.slideTimer = 0.65;
    AudioManager.play('slide');
  },

  // ── Update ──
  update(dt, gs, move) {
    const pl = gs.player;
    if (!pl) return;

    // Smooth lane transition
    pl.wx += (pl.targetWX - pl.wx) * this.LANE_SPEED * dt;

    // Jetpack override
    if (gs.jetpack) {
      pl.wy    = 95;
      pl.state = 'run';
      pl.vy    = 0;
    } else {
      // Gravity / jump
      if (pl.state === 'jump') {
        pl.wy += pl.vy * dt * 55;
        pl.vy -= this.GRAVITY * dt;

        if (pl.wy <= 0) {
          pl.wy    = 0;
          pl.vy    = 0;
          pl.state = 'run';
          // Land particles
          const pr = Renderer.project(pl.wx, 0, pl.wz);
          ParticleSystem.emit(pr.sx, pr.sy, 4, {
            col: '#AAA', sz: 3,
            vx: 0, vy: -0.5,
            grav: 0.1, life: 0.3
          });
        }
      }
    }

    // Slide countdown
    if (pl.state === 'slide') {
      pl.slideTimer -= dt;
      const pr = Renderer.project(pl.wx, 0, pl.wz);
      ParticleSystem.slideFX(pr.sx, pr.sy);
      if (pl.slideTimer <= 0) pl.state = 'run';
    }

    // Invulnerability countdown
    if (pl.invTimer > 0) pl.invTimer -= dt;

    // Running trail (at high speed)
    if (gs.speed > 12 && Math.random() < 0.2 && !SaveManager.data.settings.particles === false) {
      const pr = Renderer.project(pl.wx, pl.wy + 5, pl.wz);
      ParticleSystem.emit(pr.sx, pr.sy, 1, {
        col: pl.charData.fallbackColor + '60',
        sz: 4, vx: 0, vy: 0.5,
        grav: 0.04, life: 0.25,
      });
    }
  },
};