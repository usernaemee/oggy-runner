// ============================================
//  COLLISION SYSTEM - js/collision.js
// ============================================

'use strict';

const CollisionSystem = {

  // ── Main check ──
  check(gs, dt) {
    const pl = gs.player;
    if (!pl || pl.invTimer > 0) return;

    this._checkObstacles(gs, pl);
    this._checkCoins(gs, pl);
    this._checkPowerups(gs, pl);
  },

  // ── Obstacle collisions ──
  _checkObstacles(gs, pl) {
    const rd      = pl.charData;
    const hitScale = gs.giant ? 0.3 : (rd.hitboxScale || 1.0);
    const hbW     = pl.charW * 0.42 * hitScale;
    const hbH     = pl.state === 'slide' ? pl.charH * 0.28 : pl.charH * 0.72;

    for (let i = gs.obstacles.length - 1; i >= 0; i--) {
      const o = gs.obstacles[i];

      // Z range check (only obstacles within zone)
      const dz = Math.abs(o.wz - pl.wz);
      if (dz > 28) continue;

      // X range check
      const dx = Math.abs(pl.wx - o.wx);
      if (dx > hbW + o.typeData.w * 0.44) continue;

      // ── HIT DETECTED ──
      let hit = false;

      if (o.typeData.elevated) {
        // Beam: must slide under
        if (pl.state !== 'slide' && !(pl.state === 'jump' && pl.wy > 22)) {
          hit = true;
        }
      } else {
        // Ground obstacle: must jump over
        if (pl.wy < o.typeData.h * 0.5) {
          // Slide doesn't help against solid obstacles
          if (pl.state !== 'slide' || o.typeData.action !== 'slide') {
            hit = true;
          }
        }
      }

      if (!hit) continue;

      // ── Giant: smash through ──
      if (gs.giant) {
        gs.obstacles.splice(i, 1);
        gs.score += 50 * gs.multi;
        Renderer.shake(5);
        const pr = Renderer.project(o.wx, o.typeData.h / 2, o.wz);
        ParticleSystem.crashFX(pr.sx, pr.sy);
        AudioManager.play('hit');
        SaveManager.data.stats.obstaclesSmashed++;
        continue;
      }

      // ── Invisible: pass through ──
      if (gs.invisible) continue;

      // ── Shield: absorb hit ──
      if (gs.shield) {
        gs.shield     = false;
        pl.invTimer   = 1.2;
        GameFlow.deactivatePowerup(true);
        gs.obstacles.splice(i, 1);
        Renderer.shake(9);
        AudioManager.play('hit');
        AudioManager.vib(80);
        const pr = Renderer.project(pl.wx, pl.charH / 2, pl.wz);
        ParticleSystem.shieldFX(pr.sx, pr.sy);
        UIManager.toast('Shield broken!', 'ti');
        continue;
      }

      // ── Normal hit: GAME OVER ──
      GameFlow.triggerGameOver();
      return;
    }
  },

  // ── Coin collisions ──
  _checkCoins(gs, pl) {
    const rd         = pl.charData;
    const magRange   = gs.magnet ? (90 * (rd.magnetMult || 1.0)) : 30;

    for (let i = gs.coins.length - 1; i >= 0; i--) {
      const c  = gs.coins[i];
      const dz = Math.abs(c.wz - pl.wz);
      const dx = Math.abs(pl.wx - c.wx);

      if (dz < magRange && dx < magRange) {
        // Collect
        const coinVal = c.value * (rd.coinMult || 1.0);
        gs.coins  += Math.round(coinVal);
        gs.score  += Math.round(coinVal * 5 * gs.multi);

        const pr = Renderer.project(c.wx, 18 + (c.yOff || 0), c.wz);
        ParticleSystem.coinFX(pr.sx, pr.sy);
        AudioManager.play('coin');

        gs.coins.splice(i, 1);
      }
    }
  },

  // ── Powerup collisions ──
  _checkPowerups(gs, pl) {
    for (let i = gs.powerups.length - 1; i >= 0; i--) {
      const pu = gs.powerups[i];
      const dz = Math.abs(pu.wz - pl.wz);
      const dx = Math.abs(pl.wx - pu.wx);

      if (dz < 32 && dx < 36) {
        const pr = Renderer.project(pu.wx, 30, pu.wz);
        ParticleSystem.powFX(pr.sx, pr.sy);
        GameFlow.activatePowerup(pu.itemData);
        gs.powerups.splice(i, 1);
      }
    }
  },
};