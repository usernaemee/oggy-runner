// ============================================
//  WORLD SYSTEM - js/world.js
//  Obstacle, coin, powerup spawning + movement
// ============================================

'use strict';

const WorldSystem = {

  MIN_OBS_INTERVAL: 20,
  BASE_OBS_INTERVAL: 55,

  // ── Update world ──
  update(dt, gs, move) {
    this._moveObjects(gs, move);
    this._recycleEnvironment(gs, move);
    this._spawn(gs);
  },

  // ── Move all objects toward camera ──
  _moveObjects(gs, move) {
    // Obstacles
    for (const o of gs.obstacles) o.wz -= move;
    // Coins
    for (const c of gs.coins) {
      c.wz -= move;
      // Magnet pull
      if (gs.magnet) {
        const rd  = gs.player.charData;
        const mag = 100 * (rd.magnetMult || 1.0);
        const dx  = gs.player.wx - c.wx;
        const dz  = gs.player.wz - c.wz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < mag) {
          c.wx += dx * 5 * 0.016;
          c.wz += dz * 3 * 0.016;
        }
      }
    }
    // Power-ups
    for (const p of gs.powerups) p.wz -= move;

    // Remove gone
    gs.obstacles = gs.obstacles.filter(o => o.wz > -80);
    gs.coins     = gs.coins.filter(c => c.wz > -80);
    gs.powerups  = gs.powerups.filter(p => p.wz > -80);

    // Score for passed obstacles
    for (const o of gs.obstacles) {
      if (!o.scored && o.wz < gs.player.wz - 20) {
        o.scored = true;
        gs.score += 10 * gs.multi;
        gs.passedObs++;
      }
    }
  },

  // ── Recycle buildings / trees / clouds ──
  _recycleEnvironment(gs, move) {
    for (const b of gs.buildings) {
      b.wz -= move * 0.28;
      if (b.wz < gs.player.wz - 200) {
        b.wz  += 32 * 110;
        b.h    = 70 + Math.random() * 150;
        b.winRows = Math.floor(b.h / 18);
        b.color = `hsl(${200 + Math.random() * 40},${14 + Math.random() * 10}%,${17 + Math.random() * 13}%)`;
      }
    }

    for (const t of gs.trees) {
      t.wz -= move * 0.28;
      if (t.wz < gs.player.wz - 200) t.wz += 22 * 140;
    }

    for (const cl of gs.clouds) {
      cl.wz -= move * 0.08;
      if (cl.wz < gs.player.wz - 200) {
        cl.wz = gs.player.wz + 3000 + Math.random() * 1000;
        cl.wx = (Math.random() - 0.5) * 400;
      }
    }
  },

  // ── Spawn logic ──
  _spawn(gs) {
    const playerZ = gs.player.wz;

    // Obstacles
    if (playerZ + gs.nextObsZ < gs.obstacles[gs.obstacles.length - 1]?.wz === false
      || gs.obstacles.length === 0
      || gs.obstacles[gs.obstacles.length - 1].wz < playerZ + gs.nextObsZ) {
      // Only spawn if nothing too close ahead
      const spawnZ = playerZ + 550 + Math.random() * 250;
      this._spawnObstacle(gs, spawnZ);
      const interval = Math.max(this.MIN_OBS_INTERVAL,
        this.BASE_OBS_INTERVAL - gs.distance * 0.002);
      gs.nextObsZ = interval + Math.random() * 30;
    }

    // Coins
    if (gs.distance * 7 > gs.nextCoinZ) {
      this._spawnCoinPattern(gs, gs.player.wz + 500 + Math.random() * 200);
      gs.nextCoinZ = gs.distance * 7 + 18 + Math.random() * 14;
    }

    // Power-ups
    if (gs.distance * 7 > gs.nextPUZ) {
      this._spawnPowerup(gs, gs.player.wz + 550);
      gs.nextPUZ = gs.distance * 7 + 160 + Math.random() * 220;
    }
  },

  // ── Spawn obstacle ──
  _spawnObstacle(gs, spawnZ) {
    const type     = ObstacleTypes[Math.floor(Math.random() * ObstacleTypes.length)];
    const lane     = Math.floor(Math.random() * 3);
    const laneX    = gs.LANE_POSITIONS[lane];

    // Check not too close to existing
    const tooClose = gs.obstacles.some(o =>
      o.lane === lane && Math.abs(o.wz - spawnZ) < 80
    );
    if (tooClose) return;

    gs.obstacles.push({
      wx:       laneX,
      wz:       spawnZ,
      lane,
      typeData: type,
      scored:   false,
    });

    // Sometimes double obstacle (leave 1 lane clear)
    const difficulty = Math.min(0.5, 0.15 + gs.distance * 0.00008);
    if (Math.random() < difficulty) {
      let l2 = lane;
      let tries = 0;
      while (l2 === lane && tries < 5) {
        l2 = Math.floor(Math.random() * 3);
        tries++;
      }
      if (l2 !== lane) {
        const t2 = ObstacleTypes[Math.floor(Math.random() * ObstacleTypes.length)];
        gs.obstacles.push({
          wx:       gs.LANE_POSITIONS[l2],
          wz:       spawnZ + Math.random() * 15,
          lane:     l2,
          typeData: t2,
          scored:   false,
        });
      }
    }
  },

  // ── Spawn coin pattern ──
  _spawnCoinPattern(gs, spawnZ) {
    const lane    = Math.floor(Math.random() * 3);
    const pattern = Math.floor(Math.random() * 5);

    const addCoin = (laneIdx, z, yOff = 0) => {
      const l = Math.max(0, Math.min(2, laneIdx));
      gs.coins.push({
        wx:       gs.LANE_POSITIONS[l],
        wz:       z,
        lane:     l,
        yOff,
        bobPhase: Math.random() * Math.PI * 2,
        value:    1,
      });
    };

    switch (pattern) {
      case 0: // Straight line
        for (let i = 0; i < 6; i++) addCoin(lane, spawnZ + i * 22);
        break;

      case 1: // Arc (jump line)
        for (let i = 0; i < 7; i++)
          addCoin(lane, spawnZ + i * 22, Math.sin(i / 6 * Math.PI) * 38);
        break;

      case 2: // Zigzag
        for (let i = 0; i < 6; i++)
          addCoin(lane + (i % 2 === 0 ? 0 : (lane < 2 ? 1 : -1)), spawnZ + i * 26);
        break;

      case 3: // Full row
        for (let l = 0; l < 3; l++) addCoin(l, spawnZ);
        for (let l = 0; l < 3; l++) addCoin(l, spawnZ + 22);
        break;

      case 4: // Two lanes
        for (let i = 0; i < 5; i++) {
          addCoin(Math.max(0, lane - 1), spawnZ + i * 22);
          addCoin(Math.min(2, lane + 1), spawnZ + i * 22);
        }
        break;
    }
  },

  // ── Spawn powerup ──
  _spawnPowerup(gs, spawnZ) {
    const available = ShopData.powerups.filter(p =>
      SaveManager.hasItem(p.id) || p.price === 0
    );
    if (!available.length) return;

    const item = available[Math.floor(Math.random() * available.length)];
    const lane = Math.floor(Math.random() * 3);

    gs.powerups.push({
      wx:       gs.LANE_POSITIONS[lane],
      wz:       spawnZ,
      lane,
      itemData: item,
      bobPhase: Math.random() * Math.PI * 2,
    });
  },

  // ── Coin rain event ──
  spawnCoinRain(gs) {
    const baseZ = gs.player.wz + 100;
    for (let i = 0; i < 35; i++) {
      const lane = Math.floor(Math.random() * 3);
      gs.coins.push({
        wx:       gs.LANE_POSITIONS[lane],
        wz:       baseZ + i * 18,
        lane,
        yOff:     0,
        bobPhase: Math.random() * Math.PI * 2,
        value:    2,
      });
    }
  },
};