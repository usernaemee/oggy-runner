// ============================================
//  CHASER SYSTEM - js/chaser.js
//  Real AI that follows player
// ============================================

'use strict';

const ChaserSystem = {

  CHASE_SPEED:      3.5,
  LANE_REACT_DELAY: 0.35,  // seconds before chaser reacts to lane change
  ANGER_INTERVAL:   2.0,

  _laneDelay: 0,
  _pendingLane: -1,
  _angerTimer: 0,

  // ── Update chaser ──
  update(dt, gs, move) {
    const ch = gs.chaser;
    if (!ch) return;

    ch.wobble    += dt * 2.8;
    this._angerTimer += dt;

    // ── Chase player lane with reaction delay ──
    const player = gs.player;
    if (player.lane !== this._pendingLane) {
      this._pendingLane  = player.lane;
      this._laneDelay = this.LANE_REACT_DELAY * (0.7 + Math.random() * 0.6);
    }

    if (this._laneDelay > 0) {
      this._laneDelay -= dt;
    } else {
      // Move toward player's lane
      ch.chasingLane = this._pendingLane;
    }

    // Occasional wrong-lane fake-out
    if (Math.random() < 0.005) {
      const fake = Math.floor(Math.random() * 3);
      ch.chasingLane = fake;
      setTimeout(() => { ch.chasingLane = player.lane; }, 800);
    }

    // Smooth x
    const targetX = gs.LANE_POSITIONS[ch.chasingLane];
    ch.wx += (targetX - ch.wx) * this.CHASE_SPEED * dt;

    // ── Chaser always stays behind player ──
    // Player z is fixed at 300. Chaser starts at 80 and floats around 80-130
    const targetZ = 80 + Math.sin(ch.wobble * 0.5) * 18;
    ch.wz += (targetZ - ch.wz) * 1.5 * dt;

    // ── Anger particles ──
    if (this._angerTimer > this.ANGER_INTERVAL) {
      this._angerTimer = 0;
      const pr = Renderer.project(ch.wx, ch.charH, ch.wz);
      if (pr.visible) {
        ParticleSystem.emit(pr.sx, pr.sy - 20, 5, {
          col: '#FF4444',
          sz: 4,
          vx: (Math.random() - 0.5) * 4,
          vy: -(1 + Math.random() * 2),
          grav: 0.04,
          life: 0.6,
        });
      }
    }

    // ── Running dust ──
    if (Math.random() < 0.15 && SaveManager.data.settings.particles !== false) {
      const dp = Renderer.project(ch.wx - 15 + Math.random() * 30, 2, ch.wz - 8);
      if (dp.visible) {
        ParticleSystem.emit(dp.sx, dp.sy, 1, {
          col: '#999',
          sz: 2.5,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -0.6,
          grav: 0.07,
          life: 0.28,
        });
      }
    }
  },
};