class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    // Core state
    this.player = null;
    this.cursors = null;
    this.spaceKey = null;
    this.lastDirection = new Phaser.Math.Vector2(1, 0);
    this.enemies = null;
    this.enemiesDefeated = 0;
    // Ranged enemy/projectiles
    this.projectiles = null;
    this.shooterMoveSpeed = 100;
    this.shooterProjectileSpeed = 260;
    this.shooterMinCooldown = 900; // ms
    this.shooterMaxCooldown = 1600; // ms

    // Spider behavior + traps
    this.spiderMinSpeed = 28;
    this.spiderMaxSpeed = 55;
    // Turn less often to travel farther between course corrections
    this.spiderTurnIntervalMin = 1000;  // ms
    this.spiderTurnIntervalMax = 15000;  // ms
    // Slow trap laying so webs are more spaced out
    this.spiderWebCooldownMin = 5000;   // ms
    this.spiderWebCooldownMax = 10000;   // ms
    this.spiderWalkSwapInterval = 110;  // ms between leg frames while moving
    this.spiderContactDamage = 1;
    // Cap simultaneous spiders and limit per-turn heading change for smoother wandering
    this.maxActiveSpiders = 2;
    this.spiderTurnMaxDeltaDeg = 35;

    // Web traps and slow effect
    this.webTraps = null;
    this.maxActiveWebTraps = 5;
    this.slowMultiplier = 0.5;   // 50% speed while slowed
    this.slowUntil = 0;
    this.webOverlay = null;

    // Wasp spawning control
    this.waspsUnlocked = false;     // locked until threshold
    this.maxActiveWasps = 5;        // cap simultaneous wasps
    // Spawn gating
    this.postKillSpawnDelayMs = 1500;
    this.nextAllowedSpawnAt = 0;
    // Loot / pickups
    this.hearts = null;
    this.heartDropChance = 0.25; // 25% chance to drop a heart on enemy death
    this.heartHealAmount = 1;
    this.armors = null;
    this.armorDropChance = 0.15; // 15% chance to drop armor on enemy death
    this.hasArmor = false;
    this.armorOverlay = null;
    // Armor durability (number of hits while armored)
    this.maxArmorHits = 5;
    this.armorHitsRemaining = 0;
    // Spray weapon pickups
    this.sprayCans = null;
    this.sprayDropChance = 0.12; // 12% chance to drop a spray can on enemy death
    this.sprayUses = 0;
    this.maxSprayUses = 5;
    this.sprayCanOverlay = null;
    this.sprayGfx = null;
    this.sprayEmitter = null;
    this.sprayRange = 200;
    this.sprayHalfAngle = Phaser.Math.DegToRad(25);
    this.sprayText = null;
    // Upgrades / combat
    this.isChoosingUpgrade = false;
    this.upgradeChoices = [];
    this.tongueRange = 120;
    this.attackCooldown = 220;
    this.lastAttackTime = 0;
    this.isAttacking = false;
    this.tongue = null;
    this.tongueTip = null;
    this.speed = 220;
    this.upgradeUI = [];
    this.worldWidth = 800;
    this.worldHeight = 600;

    // Spawn safety (prevent enemies from spawning on/too close to player or shelter)
    this.spawnMinDistPlayer = 140;
    this.spawnMinDistShelter = 120;
    this.spawnMaxAttempts = 20;
    // Boss spawn safety
    this.bossMinDistFromPlayer = 200;

    // Combat / Health
    this.maxHealth = 5;
    this.health = this.maxHealth;
    this.invulnDuration = 800; // ms of invulnerability after a hit
    this.invulnUntil = 0;
    this.isDead = false;

    // Hitbox tuning
    this.playerBodyRadiusFactor = 0.38; // circle radius = min(frameW, frameH) * factor
    this.enemyBodyRadiusFactor = 0.36;  // tighter enemy bodies

    // UI / FX
    this.healthGfx = null;
    this.healthText = null;
    this.redFlash = null;
    // Hearts UI
    this.healthHeartsContainer = null;
    this.healthHeartSlots = [];
    this.heartTexW = 0;
    this.heartTexH = 0;
    this.heartScale = 0.6;
    this.heartSpacing = 4;

    // Visual polish
    this.bg = null;
    this.shadow = null;
    this.hitParticles = null;
    this.hitEmitter = null;

    // Shelter/Home Base
    this.shelter = null;
    this.shelterMaxHealth = 20;
    this.shelterHealth = this.shelterMaxHealth;
    this.shelterHealthGfx = null;
    this.shelterHealthText = null;
    this.shelterDamageInterval = 450; // ms between damage ticks per enemy
    // Shelter progression + turret defense
    this.shelterLevel = 1;
    this.maxShelterLevel = 3;
    this.shelterHasTurret = false;
    this.shelterUpgradeHealthBoost = 8;
    this.allyProjectiles = null;
    // Turret baseline: starts slower with limited range; later upgrades improve slightly
    this.shelterRangeBase = 180;
    this.shelterShootCooldownBase = 1800;
    this.shelterRange = this.shelterRangeBase;
    this.shelterShootCooldown = this.shelterShootCooldownBase;
    this.nextShelterShotAt = 0;
    this.shelterProjectileSpeed = 50;
    this.shelterProjectileDamage = 1;
    // Turret visuals (separate rotating head unlocked at level >= 3)
    this.shelterTurret = null;
    this.shelterTurretOffset = new Phaser.Math.Vector2(0, -12);
    this.turretMuzzleLen = 22;
    this.isGameOver = false;

    // Boss configuration
    this.bossSpawnInterval = 15;   // spawn a boss every 15 kills
    this.bossSpeed = 16;           // super slow
    this.bossMaxHpBase = 18;       // heavier tank with a lot of health
    this.bossBarWidth = 38;        // mini health bar above boss
    this.bossBarHeight = 6;
    this.bossCornerMargin = 40;    // margin from screen edges for corner spawns

    // Debug: facing diagnostics
    this.debugFacing = true;
    this._nextFacingLogAt = 0;
  }

  preload() {
    // Procedural textures for richer visuals (no external assets)

    // Ground tile
    {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x0b2012, 1);
      g.fillRect(0, 0, 64, 64);
      // blades
      for (let i = 0; i < 70; i++) {
        const x = Phaser.Math.Between(0, 60);
        const y = Phaser.Math.Between(0, 60);
        const h = Phaser.Math.Between(4, 10);
        g.fillStyle(Phaser.Math.Between(0, 1) ? 0x1e6b3f : 0x2b8c54, 1);
        g.fillTriangle(x, y + h, x + 2, y, x + 4, y + h);
      }
      // subtle speckles
      g.fillStyle(0x0e2a17, 0.25);
      for (let i = 0; i < 30; i++) {
        const x = Phaser.Math.Between(0, 63);
        const y = Phaser.Math.Between(0, 63);
        g.fillRect(x, y, 1, 1);
      }
      g.generateTexture('ground_tile', 64, 64);
      g.destroy();
    }

    // Small flower textures for background decoration
    {
      const makeFlower = (key, petalColor, centerColor) => {
        const f = this.make.graphics({ x: 0, y: 0, add: false });
        const cx = 8, cy = 8;
        // Petals
        f.fillStyle(petalColor, 1);
        const petals = 6;
        for (let i = 0; i < petals; i++) {
          const ang = (Math.PI * 2 / petals) * i;
          const px = cx + Math.cos(ang) * 5;
          const py = cy + Math.sin(ang) * 5;
          f.fillCircle(px, py, 4);
        }
        // Center
        f.fillStyle(centerColor, 1);
        f.fillCircle(cx, cy, 3);
        // Tiny highlight
        f.fillStyle(0xffffff, 0.3);
        f.fillCircle(cx + 1, cy - 1, 1);
        f.generateTexture(key, 16, 16);
        f.destroy();
      };

      makeFlower('flower_white',    0xffffff, 0xffd54f);
      makeFlower('flower_pink',     0xff77a9, 0xfff176);
      makeFlower('flower_blue',     0x77c1ff, 0xffecb3);
      makeFlower('flower_lavender', 0xb388ff, 0xfff59d);
    }

    // Player drop shadow
    {
      const sh = this.make.graphics({ x: 0, y: 0, add: false });
      sh.fillStyle(0x000000, 1);
      sh.fillEllipse(32, 16, 64, 24);
      sh.generateTexture('shadow_oval', 64, 32);
      sh.destroy();
    }

    // Shelter (home base) texture
    {
      const s = this.make.graphics({ x: 0, y: 0, add: false });
      // Roof
      s.fillStyle(0x2d2b2a, 1);
      s.fillTriangle(4, 22, 60, 22, 32, 6);
      // Walls
      s.fillStyle(0x6b4f2e, 1);
      s.fillRoundedRect(8, 22, 48, 24, 4);
      // Door
      s.fillStyle(0x1b1b1b, 1);
      s.fillRoundedRect(32 - 6, 28, 12, 16, 2);
      // Outlines
      s.lineStyle(2, 0x000000, 0.25);
      s.strokeTriangle(4, 22, 60, 22, 32, 6);
      s.strokeRoundedRect(8, 22, 48, 24, 4);
      s.generateTexture('shelter_home', 64, 48);
      s.destroy();
    }

    // Shelter (level 2) fortified texture without turret (turret will be a separate animated sprite)
    {
      const s2 = this.make.graphics({ x: 0, y: 0, add: false });
      // Roof (reinforced)
      s2.fillStyle(0x2b2f33, 1);
      s2.fillTriangle(4, 22, 60, 22, 32, 4);
      // Walls (base)
      s2.fillStyle(0x6b4f2e, 1);
      s2.fillRoundedRect(8, 22, 48, 24, 4);
      // Metal plating strip
      s2.fillStyle(0xaab7c4, 0.85);
      s2.fillRoundedRect(10, 24, 44, 10, 3);
      // Door
      s2.fillStyle(0x0a0a0a, 1);
      s2.fillRoundedRect(32 - 6, 28, 12, 16, 2);
      // Outlines
      s2.lineStyle(2, 0x000000, 0.28);
      s2.strokeTriangle(4, 22, 60, 22, 32, 4);
      s2.strokeRoundedRect(8, 22, 48, 24, 4);
      s2.generateTexture('shelter_home_lv2', 64, 48);
      s2.destroy();
    }

    // Shelter turret head texture (separate sprite; points to the right at angle 0)
    {
      const t = this.make.graphics({ x: 0, y: 0, add: false });
      // Base block
      t.fillStyle(0xaab7c4, 1);
      t.fillRoundedRect(2, 6, 10, 8, 2);
      // Barrel
      t.fillStyle(0x88e0ff, 1);
      t.fillRect(12, 9, 14, 2);
      // Small muzzle cap
      t.fillStyle(0xb0ecff, 1);
      t.fillRect(26, 8, 2, 4);
      // Outline
      t.lineStyle(1, 0x2b4f5f, 0.8);
      t.strokeRoundedRect(2.5, 6.5, 9, 7, 2);
      t.strokeRect(12.5, 9.5, 13, 1);
      t.generateTexture('shelter_turret_head', 30, 20);
      t.destroy();
    }

    // Ally projectile (turret bolt)
    {
      const ap = this.make.graphics({ x: 0, y: 0, add: false });
      ap.fillStyle(0xb0ecff, 1);
      ap.fillTriangle(2, 6, 6, 2, 10, 6);
      ap.fillTriangle(6, 10, 2, 6, 10, 6);
      ap.lineStyle(1, 0x2b4f5f, 1);
      ap.strokeTriangle(2, 6, 6, 2, 10, 6);
      ap.strokeTriangle(6, 10, 2, 6, 10, 6);
      ap.generateTexture('shelter_projectile', 12, 12);
      ap.destroy();
    }

    // Upgrade glow pulse texture
    {
      const ug = this.make.graphics({ x: 0, y: 0, add: false });
      const cx = 32, cy = 32;
      ug.fillStyle(0x88e0ff, 0.22);
      ug.fillCircle(cx, cy, 28);
      ug.fillStyle(0x88e0ff, 0.14);
      ug.fillCircle(cx, cy, 20);
      ug.fillStyle(0xffffff, 0.12);
      ug.fillCircle(cx, cy, 12);
      ug.generateTexture('upgrade_glow', 64, 64);
      ug.destroy();
    }

    // Chameleon sprite: coiled tail, casque crest, stripe bands, turret eye
    {
      const g1 = this.make.graphics({ x: 0, y: 0, add: false });
      // Palette
      const cBase   = 0x6ecb3a;  // body base
      const cBelly  = 0xcdf7b8;  // belly/underside
      const cDark   = 0x3b8c2a;  // dorsal/dark limbs
      const cStripe = 0x2e6d21;  // banding
      const cOutline= 0x103d1a;  // outline

      // Tail: coiled spiral made of circles
      g1.fillStyle(cBase, 1);
      for (let i = 0; i <= 18; i++) {
        const t = i / 18;
        const ang = t * Math.PI * 2.2 + Math.PI * 0.25;
        const rr  = 15 - t * 11;
        const cx = 30 - Math.cos(ang) * (8 + t * 14);
        const cy = 42 - Math.sin(ang) * (8 + t * 10);
        g1.fillCircle(cx, cy, Math.max(3, rr));
      }
      // Dorsal shade on tail
      g1.fillStyle(cDark, 0.85);
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const ang = t * Math.PI * 2.2 + Math.PI * 0.25;
        const rr  = (12 - t * 9) * 0.55;
        const cx = 30 - Math.cos(ang) * (8 + t * 14);
        const cy = 40 - Math.sin(ang) * (8 + t * 10);
        g1.fillCircle(cx, cy, Math.max(1, rr));
      }

      // Body
      g1.fillStyle(cBase, 1);
      g1.fillEllipse(50, 36, 74, 38);

      // Belly highlight
      g1.fillStyle(cBelly, 1);
      g1.fillEllipse(46, 40, 46, 20);

      // Head with casque crest
      g1.fillStyle(cBase, 1);
      g1.fillEllipse(80, 30, 30, 22);
      // Casque (crest)
      g1.fillTriangle(72, 18, 90, 18, 82, 8);

      // Mouth line (subtle)
      g1.lineStyle(2, cOutline, 0.6);
      g1.beginPath();
      g1.moveTo(82, 34);
      g1.lineTo(94, 32);
      g1.strokePath();

      // Legs
      g1.fillStyle(cDark, 1);
      g1.fillEllipse(34, 56, 18, 8);
      g1.fillEllipse(22, 50, 18, 8);
      g1.fillEllipse(58, 56, 18, 8);
      g1.fillEllipse(70, 50, 18, 8);
      // Zygodactyl toe pads
      g1.fillStyle(0x2f7a25, 1);
      const toes = [
        {x: 40, y: 58}, {x: 36, y: 60},
        {x: 18, y: 50}, {x: 22, y: 52},
        {x: 64, y: 58}, {x: 60, y: 60},
        {x: 72, y: 50}, {x: 76, y: 51}
      ];
      for (const t of toes) g1.fillCircle(t.x, t.y, 2.4);

      // Turret eye with highlight
      g1.fillStyle(0xffffff, 1);
      g1.fillCircle(88, 24, 6);
      g1.fillStyle(0x24342a, 1);
      g1.fillCircle(88, 24, 2.8);
      g1.fillStyle(0xffffff, 0.8);
      g1.fillCircle(90, 23, 1.3);

      // Body banding
      g1.fillStyle(cStripe, 0.95);
      g1.fillEllipse(56, 26, 22, 8);
      g1.fillEllipse(66, 36, 24, 8);
      g1.fillEllipse(74, 44, 20, 7);

      // Body sheen
      g1.fillStyle(0xffffff, 0.10);
      g1.fillEllipse(60, 24, 26, 12);

      // Outlines
      g1.lineStyle(2, cOutline, 0.6);
      g1.strokeEllipse(50, 36, 74, 38);
      g1.strokeEllipse(80, 30, 30, 22);

      g1.generateTexture('chameleon', 96, 64);
      g1.destroy();
    }

    // Enemies: beetle (gnarly staghorn variant; same red palette)
    {
      const eg = this.make.graphics({ x: 0, y: 0, add: false });
      // Palette (unchanged reds)
      const C_SHELL = 0x8c1d1d;
      const C_HILITE = 0xb23333;
      const C_HEAD = 0x4a1212;
      const C_OUT = 0x3a0d0d;

      // Legs - splayed and spiky for a gnarlier silhouette
      eg.lineStyle(2, C_OUT, 1);
      eg.beginPath();
      // Front pair (angled forward)
      eg.moveTo(18, 10); eg.lineTo(10, 4);
      eg.moveTo(18, 12); eg.lineTo(10, 8);
      // Middle pair (wide stance)
      eg.moveTo(22, 18); eg.lineTo(32, 10);
      eg.moveTo(22, 20); eg.lineTo(32, 26);
      // Rear pair (kicked back)
      eg.moveTo(28, 22); eg.lineTo(36, 28);
      eg.moveTo(26, 20); eg.lineTo(34, 30);
      eg.strokePath();

      // Elytra (shell) - slightly longer and narrower
      eg.fillStyle(C_SHELL, 1);
      eg.fillEllipse(22, 16, 34, 22);

      // Pronotum (neck plate) to emphasize stag profile
      eg.fillStyle(C_SHELL, 1);
      eg.fillRoundedRect(12, 10, 12, 12, 3);

      // Head
      eg.fillStyle(C_HEAD, 1);
      eg.fillCircle(8, 16, 6);

      // Stag mandibles/horns - big twin prongs
      eg.fillStyle(C_HEAD, 1);
      // Upper horn
      eg.fillTriangle(8, 16, 2, 8, 6, 12);
      // Lower horn
      eg.fillTriangle(8, 16, 2, 24, 6, 20);
      // Horn tips
      eg.fillTriangle(1, 8, 4, 8, 2, 6);
      eg.fillTriangle(1, 24, 4, 24, 2, 26);

      // Eye
      eg.fillStyle(0xffffff, 1);
      eg.fillCircle(9, 13, 2);
      eg.fillStyle(0x000000, 1);
      eg.fillCircle(9, 13, 1);

      // Shell highlight and central seam/ridge
      eg.fillStyle(C_HILITE, 1);
      eg.fillEllipse(22, 12, 24, 12);

      eg.lineStyle(1, C_OUT, 0.75);
      // Central seam
      eg.beginPath();
      eg.moveTo(22, 6); eg.lineTo(22, 26);
      eg.strokePath();
      // Elytra rim
      eg.strokeEllipse(22, 16, 32, 20);
      // Pronotum outline
      eg.lineStyle(1, C_OUT, 0.5);
      eg.strokeRoundedRect(12, 10, 12, 12, 3);

      eg.generateTexture('enemy_beetle', 40, 32);
      eg.destroy();
    }

    // Enemies: fly
    {
      const fg = this.make.graphics({ x: 0, y: 0, add: false });
      // Wings
      fg.fillStyle(0xccddff, 0.45);
      fg.fillEllipse(26, 10, 16, 10);
      fg.fillEllipse(26, 22, 16, 10);
      // Body
      fg.fillStyle(0x2e2e38, 1);
      fg.fillEllipse(16, 16, 24, 18);
      // Head
      fg.fillStyle(0x3a3a46, 1);
      fg.fillCircle(6, 16, 7);
      // Eye
      fg.fillStyle(0xffffff, 1);
      fg.fillCircle(4, 14, 2);
      fg.fillStyle(0x000000, 1);
      fg.fillCircle(4, 14, 1);
      // Segment line
      fg.lineStyle(1, 0x1f1f27, 0.6);
      fg.strokeEllipse(16, 16, 20, 14);
      fg.generateTexture('enemy_fly', 40, 32);
      fg.destroy();
    }

    // Enemies: ant (fast chaser, easy to see)
    {
      const ag = this.make.graphics({ x: 0, y: 0, add: false });
      // Body segments (bright orange for visibility)
      ag.fillStyle(0xff7a1a, 1);
      // Head, thorax, abdomen
      ag.fillEllipse(8, 16, 10, 8);
      ag.fillEllipse(18, 16, 12, 9);
      ag.fillEllipse(30, 16, 14, 10);
      // Subtle highlights
      ag.fillStyle(0xffc27a, 0.7);
      ag.fillEllipse(30, 14, 8, 3);
      ag.fillEllipse(18, 14, 7, 2.5);
      // Legs (three pairs)
      ag.lineStyle(2, 0x3a1f0a, 1);
      ag.beginPath();
      ag.moveTo(16, 12); ag.lineTo(10, 8);
      ag.moveTo(16, 20); ag.lineTo(10, 24);
      ag.moveTo(22, 12); ag.lineTo(28, 8);
      ag.moveTo(22, 20); ag.lineTo(28, 24);
      ag.moveTo(26, 12); ag.lineTo(34, 8);
      ag.moveTo(26, 20); ag.lineTo(34, 24);
      ag.strokePath();
      // Antennae
      ag.beginPath();
      ag.moveTo(6, 14); ag.lineTo(2, 10);
      ag.moveTo(6, 18); ag.lineTo(2, 22);
      ag.strokePath();
      // Eye
      ag.fillStyle(0xffffff, 1);
      ag.fillCircle(6, 15, 1.5);
      ag.fillStyle(0x000000, 1);
      ag.fillCircle(6, 15, 0.7);
      // Segment outlines
      ag.lineStyle(1, 0x2b0d0d, 0.6);
      ag.strokeEllipse(8, 16, 10, 8);
      ag.strokeEllipse(18, 16, 12, 9);
      ag.strokeEllipse(30, 16, 14, 10);
      ag.generateTexture('enemy_ant', 40, 32);
      ag.destroy();
    }
    
    // Enemies: wasp (ranged)
    {
      const wg = this.make.graphics({ x: 0, y: 0, add: false });
      // Wings
      wg.fillStyle(0xccddff, 0.45);
      wg.fillEllipse(28, 10, 18, 12);
      wg.fillEllipse(28, 22, 18, 12);
      // Body with yellow stripes
      wg.fillStyle(0x1f1f1f, 1);
      wg.fillEllipse(16, 16, 28, 18);
      wg.fillStyle(0xffd600, 1);
      wg.fillRect(6, 10, 18, 4);
      wg.fillRect(6, 16, 18, 4);
      wg.fillRect(6, 22, 18, 4);
      // Head
      wg.fillStyle(0x1f1f1f, 1);
      wg.fillCircle(6, 16, 6);
      // Eye
      wg.fillStyle(0xffffff, 1);
      wg.fillCircle(4, 14, 2);
      wg.fillStyle(0x000000, 1);
      wg.fillCircle(4, 14, 1);
      // Stinger tip
      wg.fillStyle(0xffd600, 1);
      wg.fillTriangle(28, 16, 36, 14, 36, 18);
      // Outline
      wg.lineStyle(1, 0x111111, 0.6);
      wg.strokeEllipse(16, 16, 26, 16);
      wg.generateTexture('enemy_wasp', 40, 32);
      wg.destroy();
    }

    // Enemies: caterpillar (tank)
    {
      const cg = this.make.graphics({ x: 0, y: 0, add: false });
      // Body segments - yellow base
      const segs = 6;
      cg.fillStyle(0xffd600, 1);
      for (let i = 0; i < segs; i++) {
        const cx = 12 + i * 9;
        cg.fillEllipse(cx, 18, 18, 14);
      }
      // Black stripes on each segment (vertical narrow ellipses to stay within body)
      cg.fillStyle(0x111111, 1);
      for (let i = 0; i < segs; i++) {
        const cx = 12 + i * 9;
        cg.fillEllipse(cx - 4, 18, 3, 12);
        cg.fillEllipse(cx,     18, 3, 14);
        cg.fillEllipse(cx + 4, 18, 3, 12);
      }
      // Head - yellow with two stripes
      cg.fillStyle(0xffd600, 1);
      cg.fillEllipse(10, 18, 20, 16);
      cg.fillStyle(0x111111, 1);
      cg.fillEllipse(10 - 4, 18, 4, 14);
      cg.fillEllipse(10 + 4, 18, 4, 14);
      // Legs (dark)
      cg.lineStyle(2, 0x111111, 1);
      for (let lx = 14; lx <= 56; lx += 8) {
        cg.beginPath();
        cg.moveTo(lx, 28); cg.lineTo(lx - 4, 34);
        cg.moveTo(lx, 28); cg.lineTo(lx + 4, 34);
        cg.strokePath();
      }
      // Eye
      cg.fillStyle(0xffffff, 1);
      cg.fillCircle(6, 14, 2);
      cg.fillStyle(0x000000, 1);
      cg.fillCircle(6, 14, 1);
      cg.generateTexture('enemy_caterpillar', 64, 36);
      cg.destroy();
    }

    // Enemies: spider (wanderer) - two frames for leg scuttle
    {
      const makeSpider = (key, legOffset = 0) => {
        const sg = this.make.graphics({ x: 0, y: 0, add: false });
        const W = 40, H = 32;
        // Body (abdomen + cephalothorax)
        sg.fillStyle(0x1b1b1b, 1);
        sg.fillEllipse(22, 16, 22, 16); // abdomen
        sg.fillStyle(0x2a2a2a, 1);
        sg.fillEllipse(14, 16, 12, 10); // thorax
        // Eye glint
        sg.fillStyle(0xffffff, 0.7);
        sg.fillCircle(11, 13, 1.2);
        // Legs (8) - animate via angle/length offset
        sg.lineStyle(2, 0x111111, 1);
        const cx = 16, cy = 16;
        for (let i = 0; i < 4; i++) {
          const baseAng = (-Math.PI * 0.55) + i * (Math.PI * 0.22);
          const mirror = -baseAng;
          const amp = 0.25;
          const delta = (i % 2 === 0 ? 1 : -1) * amp * legOffset;
          const a1 = baseAng + delta;
          const a2 = mirror - delta;
          const len = 12 + i * 1.5;
          const p1x = cx + Math.cos(a1) * 8;
          const p1y = cy + Math.sin(a1) * 6;
          const p2x = p1x + Math.cos(a1) * len;
          const p2y = p1y + Math.sin(a1) * len;
          const q1x = cx + Math.cos(a2) * 8;
          const q1y = cy + Math.sin(a2) * 6;
          const q2x = q1x + Math.cos(a2) * len;
          const q2y = q1y + Math.sin(a2) * len;
          sg.beginPath(); sg.moveTo(p1x, p1y); sg.lineTo(p2x, p2y); sg.strokePath();
          sg.beginPath(); sg.moveTo(q1x, q1y); sg.lineTo(q2x, q2y); sg.strokePath();
        }
        // Subtle highlight
        sg.fillStyle(0x444444, 0.35);
        sg.fillEllipse(22, 12, 16, 6);
        // Outline
        sg.lineStyle(1, 0x0d0d0d, 0.6);
        sg.strokeEllipse(22, 16, 22, 16);
        sg.strokeEllipse(14, 16, 12, 10);
        sg.generateTexture(key, W, H);
        sg.destroy();
      };
      makeSpider('enemy_spider_1', 1);
      makeSpider('enemy_spider_2', -1);
    }
 
    // Enemies: snake (rainbow slithering chaser)
    {
      const sg = this.make.graphics({ x: 0, y: 0, add: false });
      const W = 80, H = 26;
      // Build a rainbow body using colored bands
      const bands = [
        0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x007aff, 0x5856d6, 0xaf52de
      ];
      // Base silhouette
      sg.fillStyle(0x000000, 0);
      sg.fillRect(0, 0, W, H);
      // Body shape: series of overlapping ellipses to form a rounded tube
      for (let i = 0; i < bands.length; i++) {
        const c = bands[i];
        sg.fillStyle(c, 1);
        const t = i / (bands.length - 1);
        const cx = 10 + t * 58;
        const rY = 8 + Math.sin(t * Math.PI) * 2.5;
        sg.fillEllipse(cx, H / 2, 20, rY * 2);
      }
      // Head (slightly bigger ellipse)
      sg.fillStyle(0xffcc00, 1);
      sg.fillEllipse(12, H / 2, 18, 14);
      // Eye
      sg.fillStyle(0xffffff, 1);
      sg.fillCircle(8, H / 2 - 3, 2.4);
      sg.fillStyle(0x000000, 1);
      sg.fillCircle(8, H / 2 - 3, 1.2);
      // Subtle outline
      sg.lineStyle(1, 0x111111, 0.6);
      sg.strokeEllipse(40, H / 2, 64, 18);
      sg.strokeEllipse(12, H / 2, 18, 14);
      sg.generateTexture('enemy_snake', W, H);
      sg.destroy();
    }
 
    // Stun stars overlay
    {
      const st = this.make.graphics({ x: 0, y: 0, add: false });
      const W = 36, H = 36;
      st.clear();
      // Stars
      const star = (cx, cy, r, color) => {
        st.fillStyle(color, 1);
        for (let i = 0; i < 5; i++) {
          const a1 = (i * 2 * Math.PI) / 5 - Math.PI / 2;
          const a2 = a1 + Math.PI / 5;
          const x1 = cx + Math.cos(a1) * r;
          const y1 = cy + Math.sin(a1) * r;
          const x2 = cx + Math.cos(a2) * (r * 0.5);
          const y2 = cy + Math.sin(a2) * (r * 0.5);
          st.fillTriangle(cx, cy, x1, y1, x2, y2);
        }
      };
      star(W * 0.35, H * 0.35, 8, 0xfff59d);
      star(W * 0.65, H * 0.6, 6, 0xffeb3b);
      st.fillStyle(0xffffff, 0.16);
      st.fillCircle(W / 2, H / 2, 14);
      st.generateTexture('stun_stars', W, H);
      st.destroy();
    }
 
    // Web trap (static)
    {
      const w = this.make.graphics({ x: 0, y: 0, add: false });
      const W = 40, H = 40;
      const cx = W / 2, cy = H / 2;
      w.clear();
      w.lineStyle(2, 0xffffff, 0.9);
      // Radials
      const spokes = 8;
      for (let i = 0; i < spokes; i++) {
        const ang = (Math.PI * 2 / spokes) * i;
        w.beginPath();
        w.moveTo(cx, cy);
        w.lineTo(cx + Math.cos(ang) * (W * 0.46), cy + Math.sin(ang) * (H * 0.46));
        w.strokePath();
      }
      // Rings
      const rings = [0.15, 0.32, 0.48, 0.64, 0.78];
      for (const r of rings) {
        w.beginPath();
        w.strokeCircle(cx, cy, Math.min(W, H) * r * 0.5);
      }
      // Soft glow
      w.fillStyle(0xffffff, 0.06);
      w.fillCircle(cx, cy, 18);
      w.generateTexture('web_trap', W, H);
      w.destroy();
    }
    
    // Projectile: stinger
    {
      const pg = this.make.graphics({ x: 0, y: 0, add: false });
      pg.fillStyle(0xffef66, 1);
      pg.fillTriangle(2, 4, 14, 8, 2, 12);
      pg.lineStyle(1, 0x6b5e00, 1);
      pg.strokeTriangle(2, 4, 14, 8, 2, 12);
      pg.generateTexture('stinger_projectile', 16, 16);
      pg.destroy();
    }

    // Tongue tip + splat particle
    {
      const tg = this.make.graphics({ x: 0, y: 0, add: false });
      tg.fillStyle(0xff94c2, 1);
      tg.fillCircle(6, 6, 6);
      tg.fillStyle(0xffffff, 0.5);
      tg.fillCircle(9, 4, 2);
      tg.generateTexture('tongue_tip', 12, 12);
      tg.destroy();

      const sp = this.make.graphics({ x: 0, y: 0, add: false });
      sp.fillStyle(0xff7fb4, 1);
      sp.fillCircle(4, 4, 4);
      sp.generateTexture('splat_particle', 8, 8);
      sp.destroy();
    }
    
    // Heart pickup
    {
      const hg = this.make.graphics({ x: 0, y: 0, add: false });
      hg.fillStyle(0xff4d6d, 1);
      // Two circles + triangle to form a heart
      hg.fillCircle(10, 9, 8);
      hg.fillCircle(20, 9, 8);
      hg.fillTriangle(2, 13, 28, 13, 16, 28);
      // Small gloss highlight
      hg.fillStyle(0xffffff, 0.18);
      hg.fillCircle(8, 7, 3);
      hg.generateTexture('heart_pickup', 32, 32);
      hg.destroy();
    }

    // Armor pickup (chainmail icon)
    {
      const ag = this.make.graphics({ x: 0, y: 0, add: false });
      // Background plate
      ag.fillStyle(0x2b2f33, 1);
      ag.fillRoundedRect(0, 0, 32, 32, 4);
      // Chain rings pattern
      ag.lineStyle(2, 0xc0c9d6, 1);
      for (let ry = 6; ry <= 26; ry += 6) {
        for (let rx = 6; rx <= 26; rx += 6) {
          ag.strokeCircle(rx, ry, 3);
        }
      }
      // Neckline
      ag.fillStyle(0x000000, 0.15);
      ag.fillCircle(16, 6, 5);
      // Gloss highlight
      ag.fillStyle(0xffffff, 0.08);
      ag.fillRoundedRect(2, 2, 10, 6, 3);
      ag.generateTexture('armor_pickup', 32, 32);
      ag.destroy();
    }

    // Armor overlay texture rendered on the chameleon when equipped
    {
      const og = this.make.graphics({ x: 0, y: 0, add: false });
      // Transparent base
      og.fillStyle(0x000000, 0);
      og.fillRect(0, 0, 96, 64);
      // Chain pattern sized to chameleon sprite (96x64)
      og.lineStyle(2, 0xbac6d6, 0.8);
      for (let yy = 8; yy <= 56; yy += 12) {
        for (let xx = 12; xx <= 84; xx += 12) {
          og.strokeCircle(xx, yy, 5);
        }
      }
      // Vest shading
      og.fillStyle(0x0a0a0a, 0.10);
      og.fillRoundedRect(14, 14, 68, 36, 10);
      og.generateTexture('armor_overlay', 96, 64);
      og.destroy();
    }
    
    // Spray can pickup texture
    {
      const sc = this.make.graphics({ x: 0, y: 0, add: false });
      // Can body
      sc.fillStyle(0xc62828, 1);
      sc.fillRoundedRect(6, 8, 20, 20, 4);
      // Label circle
      sc.fillStyle(0xffffee, 0.85);
      sc.fillCircle(16, 18, 6);
      // "Bug" icon
      sc.fillStyle(0x000000, 1);
      sc.fillCircle(16, 18, 2);
      sc.lineStyle(2, 0x000000, 1);
      sc.beginPath();
      sc.moveTo(13, 14); sc.lineTo(11, 12);
      sc.moveTo(13, 22); sc.lineTo(11, 24);
      sc.moveTo(19, 14); sc.lineTo(21, 12);
      sc.moveTo(19, 22); sc.lineTo(21, 24);
      sc.strokePath();
      // Top cap + nozzle
      sc.fillStyle(0xb0bec5, 1);
      sc.fillRect(10, 6, 12, 4);
      sc.fillStyle(0xeeeeee, 1);
      sc.fillRect(18, 4, 4, 4);
      sc.fillStyle(0x000000, 1);
      sc.fillRect(20, 4, 2, 2);
      // Gloss
      sc.fillStyle(0xffffff, 0.18);
      sc.fillRoundedRect(8, 10, 8, 6, 3);
      sc.generateTexture('spray_can', 32, 32);
      sc.destroy();
    }

    // Spray particle texture
    {
      const pp = this.make.graphics({ x: 0, y: 0, add: false });
      pp.fillStyle(0xe8fff4, 0.95);
      pp.fillCircle(4, 4, 3.5);
      pp.fillStyle(0xffffff, 0.35);
      pp.fillCircle(5, 3, 1.2);
      pp.generateTexture('spray_particle', 8, 8);
      pp.destroy();
    }

    // Upgrade panel background
    {
      const bg = this.make.graphics({ x: 0, y: 0, add: false });
      bg.fillStyle(0x222222, 0.95);
      bg.fillRoundedRect(0, 0, 520, 360, 12);
      bg.lineStyle(2, 0xffffff, 0.2);
      bg.strokeRoundedRect(1, 1, 518, 358, 12);
      bg.generateTexture('upgrade_bg', 520, 360);
      bg.destroy();
    }

    // Boss enemy texture (heavy tanky grub with horns)
    {
      const bg = this.make.graphics({ x: 0, y: 0, add: false });
      const W = 80, H = 60;
      // Segmented body (purple)
      const segs = 7;
      bg.fillStyle(0x9b59b6, 1);
      for (let i = 0; i < segs; i++) {
        const cx = 10 + i * 10;
        const rx = 18 + Math.min(i, segs - 1 - i) * 2;
        bg.fillEllipse(cx + 10, H / 2, rx, 16);
      }
      // Dark vertical stripes
      bg.fillStyle(0x4a235a, 1);
      for (let i = 0; i < segs; i++) {
        const cx = 10 + i * 10;
        bg.fillEllipse(cx + 10, H / 2, 6, 18);
      }
      // Head (wider, armored)
      bg.fillStyle(0x8e44ad, 1);
      bg.fillEllipse(16, H / 2, 28, 20);
      // Horns
      bg.fillStyle(0x4a235a, 1);
      bg.fillTriangle(6, H / 2, 0, H / 2 - 10, 2, H / 2 - 2);
      bg.fillTriangle(6, H / 2, 0, H / 2 + 10, 2, H / 2 + 2);
      // Eye
      bg.fillStyle(0xffffff, 1);
      bg.fillCircle(12, H / 2 - 4, 3);
      bg.fillStyle(0x000000, 1);
      bg.fillCircle(12, H / 2 - 4, 1.5);
      // Outline hints
      bg.lineStyle(1, 0x2e1042, 0.6);
      bg.strokeEllipse(16, H / 2, 28, 20);
      bg.strokeEllipse(46, H / 2, 56, 20);
      // Texture
      bg.generateTexture('enemy_boss', W, H);
      bg.destroy();
    }
  }

  init() {
    // Reset core state on scene (re)start. Phaser calls init() on start and restart.
    const before = {
      health: this.health,
      isDead: this.isDead,
      enemiesDefeated: this.enemiesDefeated,
      speed: this.speed,
      tongueRange: this.tongueRange,
      attackCooldown: this.attackCooldown
    };

    // Baseline values
    this.maxHealth = 5;
    this.health = this.maxHealth;
    this.isDead = false;
    this.hasArmor = false;
    this.armorHitsRemaining = 0;
    this.enemiesDefeated = 0;
    this.waspsUnlocked = false;
    this.isChoosingUpgrade = false;
    this.upgradeChoices = [];
    this.speed = 220;
    this.tongueRange = 120;
    this.attackCooldown = 220;
    this.lastAttackTime = 0;
    this.slowUntil = 0;
    this.lastDirection = new Phaser.Math.Vector2(1, 0);
    this.sprayUses = 0;
    this.nextAllowedSpawnAt = 0;

    // Shelter baseline
    this.shelterMaxHealth = 20;
    this.shelterHealth = this.shelterMaxHealth;
    this.shelterLevel = 1;
    this.maxShelterLevel = 3;
    this.shelterHasTurret = false;
    this.shelterUpgradeHealthBoost = 8;
    // Turret baseline stats (become active at level >= 2)
    this.shelterRangeBase = 180;
    this.shelterShootCooldownBase = 1800;
    this.shelterRange = this.shelterRangeBase;
    this.shelterShootCooldown = this.shelterShootCooldownBase;
    this.nextShelterShotAt = 0;
    this.shelterProjectileSpeed = 50;
    this.shelterProjectileDamage = 1;
    this.isGameOver = false;

    // Clear transient refs
    this.tongue = null;
    this.tongueTip = null;
    this.upgradeUI = [];
    // Reset hearts UI refs
    this.healthHeartsContainer = null;
    this.healthHeartSlots = [];
    this.heartTexW = 0;
    this.heartTexH = 0;

    // Shelter refs
    this.shelter = null;
    this.shelterHealthGfx = null;
    this.shelterHealthText = null;
    this.shelterTurret = null;

    console.info('[Scene] init() reset', {
      before,
      after: {
        health: this.health,
        isDead: this.isDead,
        enemiesDefeated: this.enemiesDefeated,
        speed: this.speed,
        tongueRange: this.tongueRange,
        attackCooldown: this.attackCooldown
      }
    });
  }

  create() {
    console.info('[Scene] create() start', { health: this.health, isDead: this.isDead });
    // World bounds
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);

    // Debug: listen for world-bounds collisions (enemies only log)
    this.physics.world.on('worldbounds', this.onWorldBoundsCollision, this);

    // Background
    this.bg = this.add.tileSprite(0, 0, this.worldWidth, this.worldHeight, 'ground_tile').setOrigin(0).setDepth(0);

    // Flowers decoration scattered over grass
    {
      const flowerKeys = ['flower_white', 'flower_pink', 'flower_blue', 'flower_lavender'];
      const area = this.worldWidth * this.worldHeight;
      const count = Math.round(area / 50000); // roughly 10 for 800x600
      for (let i = 0; i < count; i++) {
        const key = flowerKeys[Phaser.Math.Between(0, flowerKeys.length - 1)];
        const x = Phaser.Math.Between(10, this.worldWidth - 10);
        const y = Phaser.Math.Between(10, this.worldHeight - 10);
        const img = this.add.image(x, y, key);
        img.setDepth(0.8); // below shadow (1), above ground (0)
        img.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
        img.setScale(Phaser.Math.FloatBetween(0.7, 1.15));
        img.setAlpha(Phaser.Math.FloatBetween(0.9, 1));
      }
    }

    // Shelter (home base) - static
    this.shelter = this.physics.add.staticImage(120, this.worldHeight - 100, 'shelter_home');
    this.shelter.setDepth(3);
    // Animated turret head (hidden until shelter upgrades to level 3)
    this.shelterTurret = this.add.image(
      this.shelter.x + (this.shelterTurretOffset ? this.shelterTurretOffset.x : 0),
      this.shelter.y + (this.shelterTurretOffset ? this.shelterTurretOffset.y : -12),
      'shelter_turret_head'
    ).setDepth(7).setVisible(false);
    this.shelterTurret.setOrigin(0.18, 0.5);
    // Compute muzzle length so projectiles spawn at the barrel tip regardless of origin/scale
    // Texture is 30px wide, muzzle cap around ~93% of width; originX is 0.18 (≈5.4px from left).
    // Using displayWidth keeps this correct if we ever scale the turret head.
    this.turretMuzzleLen = Math.max(10, this.shelterTurret.displayWidth * (0.93 - this.shelterTurret.originX));

    // Player
    this.player = this.physics.add.sprite(this.worldWidth / 2, this.worldHeight / 2, 'chameleon');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(5);
    // Tighter circular physics body for player
    {
      const pMin = Math.min(this.player.width, this.player.height);
      const r = Math.floor(pMin * this.playerBodyRadiusFactor);
      const ox = this.player.width / 2 - r;
      const oy = this.player.height / 2 - r;
      this.player.body.setCircle(r, ox, oy);
    }

    // Shadow under player (not physics)
    this.shadow = this.add.image(this.player.x, this.player.y + 18, 'shadow_oval').setAlpha(0.35).setDepth(1);

    // Armor overlay (non-physics); shown when armor is equipped
    this.armorOverlay = this.add.image(this.player.x, this.player.y, 'armor_overlay').setVisible(false);
    this.armorOverlay.setDepth(8).setAlpha(0.7);

    // Spray can overlay (shows when holding spray weapon)
    this.sprayCanOverlay = this.add.image(this.player.x, this.player.y, 'spray_can').setVisible(false);
    this.sprayCanOverlay.setDepth(11);
    this.sprayCanOverlay.setScale(0.8);

    // Web slow overlay (visual cue while slowed)
    this.webOverlay = this.add.image(this.player.x, this.player.y, 'web_trap').setVisible(false);
    this.webOverlay.setDepth(12).setScale(0.7).setAlpha(0.6);
    // Stun overlay (visual cue while stunned)
    this.stunOverlay = this.add.image(this.player.x, this.player.y - 8, 'stun_stars').setVisible(false);
    this.stunOverlay.setDepth(13).setScale(0.9).setAlpha(0.9);
    
    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Tongue visualization
    this.tongue = this.add.graphics();
    this.tongue.setDepth(9);
    this.tongueTip = this.add.image(0, 0, 'tongue_tip').setVisible(false).setDepth(10);

    // Spray visualization
    this.sprayGfx = this.add.graphics();
    this.sprayGfx.setDepth(9);
    this.sprayEmitter = this.add.particles(0, 0, 'spray_particle', {
      speed: { min: 20, max: 120 },
      angle: { min: -10, max: 10 },
      gravityY: 0,
      scale: { start: 1.0, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 260,
      quantity: 0,
      emitting: false,
      blendMode: 'ADD'
    });

    // Particles for hits
    this.hitEmitter = this.add.particles(0, 0, 'splat_particle', {
      speed: { min: 40, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: 300,
      lifespan: 500,
      quantity: 0,
      blendMode: 'ADD',
      emitting: false
    });

    // Enemies
    this.enemies = this.physics.add.group();
    // Progressive difficulty: compute settings and seed initial enemies
    this.recomputeDifficulty();
    this.maintainSpawns();
    // Keep population topped up over time
    this.spawnTimer = this.time.addEvent({ delay: this.spawnCheckInterval || 800, loop: true, callback: this.maintainSpawns, callbackScope: this });
    // Damage shelter when tanks overlap it
    this.physics.add.overlap(this.shelter, this.enemies, this.onShelterEnemyOverlap, null, this);
    this.physics.add.collider(this.enemies, this.shelter, null, (enemyObj, shelterObj) => {
      const t = enemyObj && enemyObj.getData && enemyObj.getData('type');
      return t === 'enemy_beetle' || t === 'enemy_caterpillar' || t === 'enemy_boss';
    }, this);
    
    // Projectiles (enemy shots)
    this.projectiles = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.player, this.projectiles, this.onPlayerProjectileOverlap, null, this);
    
    // Ally projectiles (shelter defense)
    this.allyProjectiles = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.enemies, this.allyProjectiles, this.onEnemyHitByAllyProjectile, null, this);
    
    // Hearts
    this.hearts = this.physics.add.group({ allowGravity: false, immovable: true });
    this.physics.add.overlap(this.player, this.hearts, this.onPlayerHeartOverlap, null, this);
    
    // Armor pickups
    this.armors = this.physics.add.group({ allowGravity: false, immovable: true });
    this.physics.add.overlap(this.player, this.armors, this.onPlayerArmorOverlap, null, this);

    // Spray can pickups
    this.sprayCans = this.physics.add.group({ allowGravity: false, immovable: true });
    this.physics.add.overlap(this.player, this.sprayCans, this.onPlayerSprayOverlap, null, this);

    // Web traps (spider hazards)
    this.webTraps = this.physics.add.group({ allowGravity: false, immovable: true });
    this.physics.add.overlap(this.player, this.webTraps, this.onPlayerWebOverlap, null, this);
    
    // Text UI
    this.killsText = this.add.text(8, 8, 'Kills: 0', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#eaffea'
    }).setDepth(20);
    this.killsText.setStroke('#000000', 3);
    this.killsText.setShadow(0, 2, '#000000', 2, true, true);
    // Move kills to top-right
    this.killsText.setOrigin(1, 0);
    this.killsText.setPosition(this.worldWidth - 8, 8);

    // Health UI: Zelda-style hearts at top-left (where Kills used to be)
    this.healthHeartsContainer = this.add.container(8, 8).setDepth(20);
    this.updateHealthUI();

    // Shelter UI
    this.shelterHealthGfx = this.add.graphics().setDepth(20);
    this.shelterHealthText = this.add.text(8, 32, 'Shelter: ' + this.shelterHealth + '/' + this.shelterMaxHealth, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff'
    }).setDepth(20);
    this.shelterHealthText.setStroke('#000000', 3);
    this.shelterHealthText.setShadow(0, 2, '#000000', 2, true, true);
    this.updateShelterUI();

    // Damage flash overlay
    this.redFlash = this.add
      .rectangle(this.worldWidth / 2, this.worldHeight / 2, this.worldWidth, this.worldHeight, 0xff0000, 0)
      .setDepth(35);

    // Enemy attacks via contact damage
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerEnemyOverlap, null, this);

    // Spawn protection
    this.invulnUntil = this.time.now + 1000;

    // Audio
    this.initAudio();
    // One-time audio test on first click to verify unlock
    if (this.input) {
      this.input.once('pointerdown', () => {
        console.info('[Audio] pointerdown -> test tone', { sfxOn: this.sfxOn, ctxState: this.audioCtx && this.audioCtx.state });
        if (this.sfxOn) this.sfxUpgradeOpen();
      });
    }
  }

  update() {
    if (!this.player) return;

    const now = this.time.now;
    const stunned = now < (this.stunUntil || 0);
   
    // Movement
    const speed = this.isDead ? 0 : this.getCurrentSpeed(now);
    let vx = 0;
    let vy = 0;
    if (this.cursors.left.isDown) vx -= speed;
    if (this.cursors.right.isDown) vx += speed;
    if (this.cursors.up.isDown) vy -= speed;
    if (this.cursors.down.isDown) vy += speed;
    this.player.setVelocity(vx, vy);
  
    // Update last facing direction
    if (vx !== 0 || vy !== 0) {
      this.lastDirection.set(vx, vy).normalize();
    }
    const angle = Math.atan2(this.lastDirection.y, this.lastDirection.x);
  
    // Rotate player to face direction
    this.player.setRotation(angle);
  
    // Keep shadow, and armor aligned
    const headOffset = new Phaser.Math.Vector2(18, -6).rotate(angle);
    this.shadow.setPosition(this.player.x, this.player.y + 18);
    // Armor overlay follows player
    if (this.armorOverlay) {
      this.armorOverlay.setPosition(this.player.x, this.player.y);
      this.armorOverlay.setRotation(angle);
      this.armorOverlay.setVisible(this.hasArmor);
    }
    // Spray can overlay follows player when active
    if (this.sprayCanOverlay) {
      const handOffset = new Phaser.Math.Vector2(20, 4).rotate(angle);
      this.sprayCanOverlay.setPosition(this.player.x + handOffset.x, this.player.y + handOffset.y);
      this.sprayCanOverlay.setRotation(angle + 0.2);
      this.sprayCanOverlay.setVisible(this.sprayUses > 0);
    }

    // Web slow overlay follows player while slowed
    if (this.webOverlay) {
      this.webOverlay.setPosition(this.player.x, this.player.y);
      this.webOverlay.setRotation(angle);
      this.webOverlay.setVisible(now < this.slowUntil);
    }
    // Stun overlay follows player while stunned
    if (this.stunOverlay) {
      this.stunOverlay.setPosition(this.player.x, this.player.y - 8);
      this.stunOverlay.setRotation(now * 0.012);
      this.stunOverlay.setVisible(stunned);
    }
    
    // Invulnerability blink
    const inv = now < this.invulnUntil;
    this.player.setAlpha(inv ? 0.6 : 1);
    if (this.armorOverlay) {
      this.armorOverlay.setAlpha(inv ? 0.55 : (this.isDead ? 0.25 : 0.7));
    }
    
    // Attack input (space)
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && !this.isChoosingUpgrade && !this.isDead && !stunned) {
      if (now - this.lastAttackTime >= this.attackCooldown) {
        this.lastAttackTime = now;
        if (this.sprayUses > 0) {
          this.performSprayAttack();
        } else {
          this.performTongueAttack();
        }
      }
    }

    // Enemy AI (behaviors)
    if (this.enemies && !this.isChoosingUpgrade && !this.isGameOver) {
      const ecs = this.enemies.getChildren();
      for (let i = 0; i < ecs.length; i++) {
        const e = ecs[i];
        if (!e || !e.active) continue;
        const type = e.getData && e.getData('type');
        if (type === 'enemy_wasp') {
          this.updateWaspAI(e, now);
        } else if (type === 'enemy_fly' || type === 'enemy_ant') {
          this.updateFlyAI(e, now);
        } else if (type === 'enemy_beetle' || type === 'enemy_caterpillar') {
          this.updateTankAI(e, now);
        } else if (type === 'enemy_boss') {
          this.updateBossAI(e, now);
        } else if (type === 'enemy_snake') {
          this.updateSnakeAI(e, now);
        } else if (type === 'enemy_spider') {
          this.updateSpiderAI(e, now);
        }
      }
    }

    // Shelter turret defense
    if (this.shelterHasTurret && this.shelter && this.enemies && !this.isChoosingUpgrade && !this.isGameOver) {
      // Always aim the turret at the nearest enemy, even when not firing
      this.updateShelterTurretAim(now);
      this.debugTurretGateTick(now);
      this.updateShelterDefense(now);
    }

    // Debug: facing/backpedal diagnostics
    this.debugFacingTick(now);
  }

  // Debug helper: logs when an enemy is moving opposite its facing or when wasps backpedal
  debugFacingTick(now) {
    if (!this.debugFacing || !this.enemies) return;
    if (now < (this._nextFacingLogAt || 0)) return;
    this._nextFacingLogAt = now + 1000; // throttle to 1 Hz

    const ecs = this.enemies.getChildren();
    let samples = 0;
    for (let i = 0; i < ecs.length; i++) {
      const e = ecs[i];
      if (!e || !e.active || !e.body) continue;
      const type = e.getData && e.getData('type');

      const v = e.body.velocity || { x: 0, y: 0 };
      const vlen = Math.hypot(v.x, v.y);
      if (vlen < 5) continue; // ignore near-zero movement

      const fwd = { x: Math.cos(e.rotation || 0), y: Math.sin(e.rotation || 0) };
      const vnorm = { x: v.x / vlen, y: v.y / vlen };
      const dotFV = fwd.x * vnorm.x + fwd.y * vnorm.y;

      // Target-based backpedal detection (for wasps hovering)
      let dist = null;
      let backpedal = false;
      if ((type === 'enemy_wasp' || type === 'enemy_fly') && this.player) {
        const pc = this.player.getCenter();
        const epos = e.getCenter();
        const dx = pc.x - epos.x, dy = pc.y - epos.y;
        dist = Math.hypot(dx, dy);
        if (type === 'enemy_wasp') {
          const desired = 200; // same as AI target distance
          if (dist > 0.0001) {
            const dir = { x: dx / dist, y: dy / dist };
            const dotDV = dir.x * vnorm.x + dir.y * vnorm.y;
            backpedal = dist < desired * 0.75 && dotDV < -0.1;
          }
        }
      } else if ((type === 'enemy_beetle' || type === 'enemy_caterpillar') && this.shelter) {
        const epos = e.getCenter();
        const dx = this.shelter.x - epos.x, dy = this.shelter.y - epos.y;
        dist = Math.hypot(dx, dy);
      }

      if (backpedal || dotFV < -0.1) {
        try {
          console.debug('[Diag] Enemy facing vs velocity', {
            type,
            pos: { x: Math.round(e.x), y: Math.round(e.y) },
            rotDeg: Math.round((e.rotation || 0) * 180 / Math.PI),
            v: { x: Math.round(v.x), y: Math.round(v.y) },
            faceVsMoveDot: Math.round(dotFV * 100) / 100,
            waspBackpedal: !!backpedal,
            dist: dist != null ? Math.round(dist) : null
          });
        } catch (err) {}
      }

      samples++;
      if (samples >= 5) break; // cap per tick
    }
  }

  performTongueAttack() {
    console.debug('[Audio] performTongueAttack', { sfxOn: this.sfxOn, ctxState: this.audioCtx && this.audioCtx.state });
    // SFX
    if (this.sfxOn) this.sfxTongue();
    // Draw attack with layered color for depth
    // Compute mouth world position (offset from sprite center, rotated to face lastDirection)
    const angle = Math.atan2(this.lastDirection.y, this.lastDirection.x);
    const center = this.player.getCenter();
    // Mouth is around (82,33) in a 96x64 sprite whose center is (48,32) => local offset ~ (+34, +1)
    const mouthOffset = new Phaser.Math.Vector2(34, 1).rotate(angle);
    const start = new Phaser.Math.Vector2(center.x + mouthOffset.x, center.y + mouthOffset.y);
    const len = this.tongueRange;
    const end = new Phaser.Math.Vector2(start.x + this.lastDirection.x * len, start.y + this.lastDirection.y * len);

    this.tongue.clear();
    this.tongue.lineStyle(12, 0xd94884, 0.9);
    this.tongue.beginPath();
    this.tongue.moveTo(start.x, start.y);
    this.tongue.lineTo(end.x, end.y);
    this.tongue.strokePath();
    this.tongue.lineStyle(6, 0xff94c2, 1);
    this.tongue.beginPath();
    this.tongue.moveTo(start.x, start.y);
    this.tongue.lineTo(end.x, end.y);
    this.tongue.strokePath();

    // Tongue tip
    this.tongueTip.setPosition(end.x, end.y).setVisible(true);

    // Damage enemies along line
    const line = new Phaser.Geom.Line(start.x, start.y, end.x, end.y);
    const enemies = this.enemies.getChildren();
    let killsThisAttack = 0;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (!e.active) continue;

      const type = e.getData && e.getData('type');
      let hit = false;
      if (type === 'enemy_caterpillar') {
        // Use expanded axis-aligned rectangle for elongated body (wider head/tail coverage)
        const b = e.getBounds();
        const padW = 8;
        const padH = 4;
        const rect = new Phaser.Geom.Rectangle(b.x - padW / 2, b.y - padH / 2, b.width + padW, b.height + padH);
        hit = Phaser.Geom.Intersects.LineToRectangle(line, rect);
      } else if (type === 'enemy_snake') {
        // Use an oriented rectangle aligned to the snake's rotation for accurate tongue hits.
        // Slightly pad thickness to ensure edge/tongue-tip grazes still count.
        const ec = e.getCenter();
        const ang = e.rotation || 0;
        const w = (e.displayWidth || e.width) * 0.95;         // near full visual length
        const h = Math.max(10, (e.displayHeight || e.height) * 1.35); // wider thickness to match body
        hit = this.lineIntersectsOrientedRect(line, ec, w, h, ang);
      } else {
        const ec = e.getCenter();
        const r = e.body ? Math.min(e.body.width, e.body.height) * 0.5 : Math.min(e.displayWidth, e.displayHeight) * this.enemyBodyRadiusFactor;
        hit = Phaser.Geom.Intersects.LineToCircle(line, new Phaser.Geom.Circle(ec.x, ec.y, r));
      }
      if (hit) {
        // Hit FX each time
        this.hitEmitter.explode(Phaser.Math.Between(8, 12), e.x, e.y);
        this.cameras.main.shake(100, 0.004);
        if (this.sfxOn) this.sfxHit();
  
        const killed = this.damageEnemy(e, 1);
        if (killed) {
          killsThisAttack++;
        }
      }
    }

    // Show upgrade every 10 kills
    if (killsThisAttack > 0 && this.enemiesDefeated % 10 === 0 && !this.isChoosingUpgrade) {
      this.showUpgradeSelection();
    }

    // Retract tongue shortly after
    this.time.delayedCall(160, () => {
      this.tongue.clear();
      this.tongueTip.setVisible(false);
    });
  }

  // Accurate line-vs-oriented-rectangle intersection (used for snake tongue hits)
  lineIntersectsOrientedRect(line, center, width, height, angleRad) {
    const hw = width / 2;
    const hh = height / 2;

    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    // Axes: forward (along length) and perpendicular (thickness)
    const ax = cos, ay = sin;
    const px = -sin, py = cos;

    const cx = center.x, cy = center.y;

    // Corner points (p0..p3) around the center
    const p0x = cx - ax * hw - px * hh, p0y = cy - ay * hw - py * hh; // back-left
    const p1x = cx + ax * hw - px * hh, p1y = cy + ay * hw - py * hh; // front-left
    const p2x = cx + ax * hw + px * hh, p2y = cy + ay * hw + py * hh; // front-right
    const p3x = cx - ax * hw + px * hh, p3y = cy - ay * hw + py * hh; // back-right

    const t1 = new Phaser.Geom.Triangle(p0x, p0y, p1x, p1y, p2x, p2y);
    const t2 = new Phaser.Geom.Triangle(p0x, p0y, p2x, p2y, p3x, p3y);

    // Phaser 3.60 doesn't expose LineToTriangle; use robust fallback
    if (!this._diagLoggedNoLTT && !(Phaser.Geom.Intersects && Phaser.Geom.Intersects.LineToTriangle)) {
      this._diagLoggedNoLTT = true;
      try {
        console.warn('[Geom] Phaser.Geom.Intersects.LineToTriangle missing; using fallback line-vs-triangle test');
      } catch (e) {}
    }

    return this.lineIntersectsTriangle(line, t1) || this.lineIntersectsTriangle(line, t2);
  }

  // Fallback: robust line-segment vs triangle intersection compatible with Phaser 3.60+
  lineIntersectsTriangle(line, tri) {
    if (!line || !tri) return false;

    // If either endpoint lies inside the triangle, it's an intersection
    if (Phaser.Geom.Triangle.Contains(tri, line.x1, line.y1) || Phaser.Geom.Triangle.Contains(tri, line.x2, line.y2)) {
      return true;
    }

    // Check against each triangle edge as a segment
    const e1 = new Phaser.Geom.Line(tri.x1, tri.y1, tri.x2, tri.y2);
    const e2 = new Phaser.Geom.Line(tri.x2, tri.y2, tri.x3, tri.y3);
    const e3 = new Phaser.Geom.Line(tri.x3, tri.y3, tri.x1, tri.y1);

    return Phaser.Geom.Intersects.LineToLine(line, e1)
        || Phaser.Geom.Intersects.LineToLine(line, e2)
        || Phaser.Geom.Intersects.LineToLine(line, e3);
  }

  performSprayAttack() {
    // SFX
    if (this.sfxOn) this.sfxSpray();

    // Parameters
    const start = this.player.getCenter();
    const angle = Math.atan2(this.lastDirection.y, this.lastDirection.x);
    const range = this.sprayRange;
    const half = this.sprayHalfAngle;

    // Draw spray cone
    this.sprayGfx.clear();
    this.sprayGfx.fillStyle(0xb3ffe3, 0.35);
    const a1 = angle - half;
    const a2 = angle + half;
    const tip1 = new Phaser.Math.Vector2(start.x + Math.cos(a1) * range, start.y + Math.sin(a1) * range);
    const tip2 = new Phaser.Math.Vector2(start.x + Math.cos(a2) * range, start.y + Math.sin(a2) * range);
    this.sprayGfx.fillTriangle(start.x, start.y, tip1.x, tip1.y, tip2.x, tip2.y);

    // Emit mist particles along center line
    if (this.sprayEmitter) {
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const px = start.x + Math.cos(angle) * range * t + Phaser.Math.Between(-6, 6);
        const py = start.y + Math.sin(angle) * range * t + Phaser.Math.Between(-6, 6);
        this.sprayEmitter.explode(Phaser.Math.Between(2, 4), px, py);
      }
    }

    // Damage enemies within cone (1 dmg per enemy per spray)
    const enemies = this.enemies.getChildren();
    let killsThisAttack = 0;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (!e.active) continue;
      const ec = e.getCenter();
      const dx = ec.x - start.x;
      const dy = ec.y - start.y;
      const dist = Math.hypot(dx, dy);
      if (dist > range) continue;
      const angTo = Math.atan2(dy, dx);
      const delta = Phaser.Math.Angle.Wrap(angTo - angle);
      if (Math.abs(delta) <= half) {
        // Deal 1 damage (never instant-kill; only kills if target has 1 HP)
        this.hitEmitter.explode(Phaser.Math.Between(8, 12), e.x, e.y);
        const killed = this.damageEnemy(e, 1);
        if (killed) killsThisAttack++;
      }
    }

    // Clear spray graphics shortly after
    this.time.delayedCall(120, () => {
      this.sprayGfx.clear();
    });

    // Also clear any enemy projectiles caught in the cone
    if (this.projectiles) {
      const ps = this.projectiles.getChildren();
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        if (!p.active) continue;
        const pc = p.getCenter();
        const dx = pc.x - start.x;
        const dy = pc.y - start.y;
        const dist = Math.hypot(dx, dy);
        if (dist > range) continue;
        const angTo = Math.atan2(dy, dx);
        const delta = Phaser.Math.Angle.Wrap(angTo - angle);
        if (Math.abs(delta) <= half) {
          this.hitEmitter.explode(3, p.x, p.y);
          p.destroy();
        }
      }
    }

    // Consume a use and update UI/overlay
    this.sprayUses = Math.max(0, this.sprayUses - 1);
    this.updateSprayUI();

    // Show upgrade every 10 kills (aligned with tongue behavior)
    if (killsThisAttack > 0 && this.enemiesDefeated % 10 === 0 && !this.isChoosingUpgrade) {
      this.showUpgradeSelection();
    }
  }

  damageEnemy(enemy, amount = 1) {
    if (!enemy || !enemy.active) return false;
    const curHp = enemy.getData('hp') != null ? enemy.getData('hp') : 1;
    const newHp = Math.max(0, curHp - amount);
    enemy.setData('hp', newHp);

    if (newHp > 0) {
      return false;
    }

    // Death FX + loot + respawn
    const hx = enemy.x;
    const hy = enemy.y;

    const pop = this.add.image(hx, hy, enemy.texture.key).setDepth((enemy.depth || 4) + 1);
    pop.setScale(enemy.scaleX || 1, enemy.scaleY || 1);
    this.tweens.add({
      targets: pop,
      y: hy - 6,
      scale: (enemy.scaleX || 1) * 1.2,
      alpha: 0,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => pop.destroy()
    });

    // Cleanup boss visuals if present
    const hpGfx = enemy.getData && enemy.getData('hpGfx');
    if (hpGfx && hpGfx.destroy) hpGfx.destroy();
    const aura = enemy.getData && enemy.getData('aura');
    if (aura && aura.destroy) aura.destroy();

    enemy.destroy();
    this.trySpawnHeart(hx, hy);
    this.trySpawnArmor(hx, hy);
    this.trySpawnSprayCan(hx, hy);

    this.enemiesDefeated++;
    if (this.killsText) this.killsText.setText('Kills: ' + this.enemiesDefeated);
    // Recompute difficulty based on new kill count
    this.recomputeDifficulty();

    // Spawn boss on kill milestones (every bossSpawnInterval kills)
    if (!this.isGameOver && this.enemiesDefeated > 0 && (this.enemiesDefeated % (this.bossSpawnInterval || 15) === 0)) {
      // Prevent multiple bosses from existing at once
      const hasBoss = this.enemies.getChildren().some(e => e && e.active && e.getData && e.getData('type') === 'enemy_boss');
      if (!hasBoss) this.spawnBoss();
    }

    // Post-death spawn delay gate to avoid instant refill
    const now = this.time.now;
    this.nextAllowedSpawnAt = Math.max(this.nextAllowedSpawnAt || 0, now + this.postKillSpawnDelayMs);
    // Prompt a spawn check shortly after the delay to top up if needed
    this.time.delayedCall(this.postKillSpawnDelayMs + 20, () => {
      if (!this.isGameOver) this.maintainSpawns();
    });

    return true;
  }

  updateWaspAI(enemy, now) {
    if (!this.player || !enemy || !enemy.body || this.isDead || this.isChoosingUpgrade) return;

    const p = this.player.getCenter();
    const epos = enemy.getCenter();
    const dir = new Phaser.Math.Vector2(p.x - epos.x, p.y - epos.y);
    const dist = dir.length();
    if (dist > 0.0001) dir.normalize();

    // Movement: hover near a comfortable range
    const desired = 200;
    const speed = this.shooterMoveSpeed;
    if (dist < desired * 0.75) {
      enemy.setVelocity(-dir.x * speed, -dir.y * speed);
    } else if (dist > desired * 1.25) {
      enemy.setVelocity(dir.x * speed, dir.y * speed);
    } else {
      enemy.setVelocity(0, 0);
    }

    // Face the player
    enemy.setRotation(Math.atan2(dir.y, dir.x) + Math.PI);

    // Firing
    const nextAt = enemy.getData('nextShotAt') || 0;
    if (now >= nextAt && dist > 80) {
      const sx = epos.x + dir.x * 18;
      const sy = epos.y + dir.y * 12;
      this.spawnStinger(sx, sy, dir);
      const cd = Phaser.Math.Between(this.shooterMinCooldown, this.shooterMaxCooldown);
      enemy.setData('nextShotAt', now + cd);
      if (this.sfxOn) {
        this.playTone({ type: 'square', startFreq: 800, endFreq: 1200, duration: 0.05, attack: 0.001, volume: 0.08 });
      }
    }
  }

  spawnStinger(x, y, dir) {
    if (!this.projectiles) return;
    const proj = this.projectiles.create(x, y, 'stinger_projectile');
    proj.setDepth(6);
    const ang = Math.atan2(dir.y, dir.x);
    proj.setRotation(ang);
    if (proj.setAngle) proj.setAngle(Phaser.Math.RadToDeg(ang));
    if (proj.body) {
      proj.body.setAllowGravity(false);
      proj.setCollideWorldBounds(true);
      proj.body.onWorldBounds = true;
    }
    const speed = this.shooterProjectileSpeed;
    proj.setVelocity(dir.x * speed, dir.y * speed);
    // Tighter circle for hitbox
    if (proj.body && proj.body.setCircle) {
      const r = Math.floor(Math.min(proj.width, proj.height) * 0.32);
      const ox = proj.width / 2 - r;
      const oy = proj.height / 2 - r;
      proj.body.setCircle(r, ox, oy);
    }
    return proj;
  }

  // Ally projectile spawn (shelter turret)
  spawnAllyProjectile(x, y, dir) {
    if (!this.allyProjectiles) return null;
    const proj = this.allyProjectiles.create(x, y, 'shelter_projectile');
    proj.setDepth(6);
    const ang = Math.atan2(dir.y, dir.x);
    proj.setRotation(ang);
    if (proj.setAngle) proj.setAngle(Phaser.Math.RadToDeg(ang));
    if (proj.body) {
      proj.body.setAllowGravity(false);
      proj.setCollideWorldBounds(true);
      proj.body.onWorldBounds = true;
      if (proj.body.setCircle) {
        const r = Math.floor(Math.min(proj.width, proj.height) * 0.38);
        const ox = proj.width / 2 - r;
        const oy = proj.height / 2 - r;
        proj.body.setCircle(r, ox, oy);
      }
    }
    const spd = this.shelterProjectileSpeed || 320;
    proj.setVelocity(dir.x * spd, dir.y * spd);
    return proj;
  }

  // Find closest enemy in turret range (returns { target, tc, sx, sy } or null)
  findShelterTarget() {
    if (!this.shelter || !this.enemies) return null;
    const range = this.shelterRange || 240;
    const sx = this.shelter.x;
    const sy = this.shelter.y;
    const cs = this.enemies.getChildren ? this.enemies.getChildren() : [];
    let target = null;
    let bestD2 = Number.POSITIVE_INFINITY;
    for (let i = 0; i < cs.length; i++) {
      const e = cs[i];
      if (!e || !e.active) continue;
      const ec = e.getCenter();
      const dx = ec.x - sx;
      const dy = ec.y - sy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2 && d2 <= range * range) {
        bestD2 = d2;
        target = e;
      }
    }
    if (!target) return null;
    const tc = target.getCenter();
    return { target, tc, sx, sy };
  }

  // Rotate the turret head to track the nearest enemy target (visible at level >= 2)
  updateShelterTurretAim(now) {
    if (!this.shelterHasTurret || !this.shelterTurret) return;
    const found = this.findShelterTarget();
    // Keep turret attached to shelter roof
    const baseX = this.shelter.x + (this.shelterTurretOffset ? this.shelterTurretOffset.x : 0);
    const baseY = this.shelter.y + (this.shelterTurretOffset ? this.shelterTurretOffset.y : -12);
    this.shelterTurret.setPosition(baseX, baseY);
    if (!found) return;
    const ang = Math.atan2(found.tc.y - baseY, found.tc.x - baseX);
    this.shelterTurret.setRotation(ang);
  }

  // Fire from the turret when off cooldown, using the turret head muzzle position
  updateShelterDefense(now) {
    // Gating + diagnostics
    if (!this.shelter || !this.enemies || this.isChoosingUpgrade || this.isGameOver) {
      try {
        console.debug('[Turret] gate skip', {
          reason: 'disabled_or_missing',
          hasShelter: !!this.shelter,
          hasEnemies: !!this.enemies,
          isChoosingUpgrade: this.isChoosingUpgrade,
          isGameOver: this.isGameOver
        });
      } catch (err) {}
      return;
    }
    if (!this.shelterHasTurret) {
      try {
        console.debug('[Turret] gate skip', { reason: 'no_turret', level: this.shelterLevel });
      } catch (err) {}
      return;
    }
    // Require level 3 to actually fire; level 2 only shows/aims the turret head
    if (this.shelterLevel < 3) {
      try {
        console.debug('[Turret] gate level', { level: this.shelterLevel, requires: 3 });
      } catch (err) {}
      return;
    }
    if (now < (this.nextShelterShotAt || 0)) {
      try {
        console.debug('[Turret] gate cooldown', {
          now,
          nextAt: this.nextShelterShotAt,
          msRemaining: (this.nextShelterShotAt || 0) - now
        });
      } catch (err) {}
      return;
    }

    const found = this.findShelterTarget();
    if (!found) {
      try { console.debug('[Turret] gate no-target'); } catch (err) {}
      return;
    }

    // Compute muzzle world position from turret head if available
    const baseX = this.shelter.x + (this.shelterTurretOffset ? this.shelterTurretOffset.x : 0);
    const baseY = this.shelter.y + (this.shelterTurretOffset ? this.shelterTurretOffset.y : -12);
    const ang = Math.atan2(found.tc.y - baseY, found.tc.x - baseX);
    const muzzleLen = this.turretMuzzleLen != null ? this.turretMuzzleLen : 14;
    const startX = baseX + Math.cos(ang) * muzzleLen;
    const startY = baseY + Math.sin(ang) * muzzleLen;
    try {
      console.debug('[Turret] fire spawn', {
        baseX: Math.round(baseX), baseY: Math.round(baseY),
        angDeg: Math.round(ang * 180 / Math.PI),
        muzzleLen,
        startX: Math.round(startX), startY: Math.round(startY)
      });
    } catch (err) {}

    const dir = new Phaser.Math.Vector2(Math.cos(ang), Math.sin(ang));
    this.spawnAllyProjectile(startX, startY, dir);
    this.nextShelterShotAt = now + (this.shelterShootCooldown || 1000);

    // Muzzle flash
    const flash = this.add.graphics();
    flash.setDepth(7);
    flash.fillStyle(0xb0ecff, 0.85);
    flash.fillCircle(startX, startY, 4);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 1.6,
      scaleY: 1.6,
      duration: 120,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy()
    });

    if (this.sfxOn) this.sfxShelterShot();
  }

  // Turret gate diagnostics (throttled)
  debugTurretGateTick(now) {
    if (now < (this._nextTurretGateLogAt || 0)) return;
    this._nextTurretGateLogAt = now + 1000;
    try {
      const enemyCount = (this.enemies && this.enemies.getChildren) ? this.enemies.getChildren().filter(e => e && e.active).length : 0;
      console.debug('[Turret] gate', {
        level: this.shelterLevel,
        hasTurret: this.shelterHasTurret,
        now,
        nextShelterShotAt: this.nextShelterShotAt,
        cooldownRemaining: Math.max(0, (this.nextShelterShotAt || 0) - now),
        enemyCount
      });
    } catch (err) {}
  }

  onEnemyHitByAllyProjectile(enemy, proj) {
    if (!enemy || !enemy.active || !proj || !proj.active) return;
    this.hitEmitter.explode(Phaser.Math.Between(4, 6), enemy.x, enemy.y);
    proj.destroy();
    this.damageEnemy(enemy, this.shelterProjectileDamage || 1);
  }

  handleShelterUpgrade(up) {
    // Level up
    this.shelterLevel = Math.min(this.maxShelterLevel || 3, (this.shelterLevel || 1) + 1);

    // Health boost and full repair
    const boost = up && up.healthBoost != null ? up.healthBoost : (this.shelterUpgradeHealthBoost || 8);
    this.shelterMaxHealth += boost;
    this.shelterHealth = this.shelterMaxHealth;
    this.updateShelterUI();

    // Activate turret system from level 2; show visuals and enable firing at level >= 3; scale a bit with higher levels
    if (this.shelterLevel >= 2) {
      const prevNextShot = this.nextShelterShotAt || null;
      this.shelterHasTurret = true;
      // Improvements kick in from level 3 onward; level 2 uses baseline
      const improve = Math.max(0, this.shelterLevel - 2);
      const baseRange = (this.shelterRangeBase != null) ? this.shelterRangeBase : (this.shelterRange || 180);
      const baseCd = (this.shelterShootCooldownBase != null) ? this.shelterShootCooldownBase : (this.shelterShootCooldown || 1800);
      this.shelterRange = baseRange + improve * 20; // slight range increase per upgrade
      this.shelterShootCooldown = Math.max(700, baseCd - improve * 120); // slightly faster fire rate per upgrade
      if (this.shelterLevel >= 3) {
        this.shelterProjectileDamage = Math.min(5, (this.shelterProjectileDamage || 1) + 1);
      }
      this.nextShelterShotAt = 0; // Armed schedule; firing gated until level >= 3

      // Diagnostics: confirm activation and schedule
      try {
        console.info('[Turret] activated', {
          level: this.shelterLevel,
          baseRange,
          baseCd,
          range: this.shelterRange,
          shootCooldown: this.shelterShootCooldown,
          prevNextShot,
          nextNextShot: this.nextShelterShotAt,
          timeNow: this.time.now
        });
      } catch (err) {}

      // Position turret head; visible only when it can fire (level >= 3)
      if (this.shelterTurret) {
        this.shelterTurret.setVisible(this.shelterLevel >= 3);
        this.shelterTurret.setPosition(
          this.shelter.x + (this.shelterTurretOffset ? this.shelterTurretOffset.x : 0),
          this.shelter.y + (this.shelterTurretOffset ? this.shelterTurretOffset.y : -12)
        );
        this.shelterTurret.setRotation(0);
      }
    }

    // Swap to fortified visual
    if (this.shelter && this.shelter.texture && this.shelter.texture.key !== 'shelter_home_lv2') {
      this.shelter.setTexture('shelter_home_lv2');
    }

    // Visual celebration
    this.animateShelterUpgrade();

    // Floating text
    const label = this.add.text(this.shelter.x, this.shelter.y - 30, 'Shelter Upgraded!', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#eaffff'
    }).setOrigin(0.5).setDepth(33);
    label.setStroke('#002b36', 4);
    label.setShadow(0, 2, '#000000', 2, true, true);
    this.tweens.add({
      targets: label,
      y: label.y - 24,
      alpha: 0,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy()
    });
  }

  animateShelterUpgrade() {
    if (!this.shelter) return;

    // Glow pulse under shelter
    const glow = this.add.image(this.shelter.x, this.shelter.y, 'upgrade_glow').setDepth(2).setAlpha(0.6).setScale(0.6);
    this.tweens.add({
      targets: glow,
      alpha: 0,
      scale: 1.8,
      duration: 420,
      ease: 'Quad.easeOut',
      onComplete: () => glow.destroy()
    });

    // Shelter pop
    this.tweens.add({
      targets: this.shelter,
      scale: { from: 1.0, to: 1.08 },
      yoyo: true,
      repeat: 1,
      duration: 200,
      ease: 'Quad.easeOut'
    });
  }
 
  updateFlyAI(enemy, now) {
    if (!this.player || !enemy || !enemy.body) return;
    const p = this.player.getCenter();
    const epos = enemy.getCenter();
    const dir = new Phaser.Math.Vector2(p.x - epos.x, p.y - epos.y);
    const dist = dir.length();
    if (dist > 0.0001) dir.normalize();
    const speed = enemy.getData('speed') || 100;
    enemy.setVelocity(dir.x * speed, dir.y * speed);
    enemy.setRotation(Math.atan2(dir.y, dir.x) + Math.PI);
  }

  updateTankAI(enemy, now) {
    if (!this.shelter || !enemy || !enemy.body) return;
    const sx = this.shelter.x;
    const sy = this.shelter.y;
    const epos = enemy.getCenter();
    const dir = new Phaser.Math.Vector2(sx - epos.x, sy - epos.y);
    const dist = dir.length();
    if (dist > 0.0001) dir.normalize();
    const base = enemy.getData('speed') || 40;
    enemy.setVelocity(dir.x * base, dir.y * base);
    enemy.setRotation(Math.atan2(dir.y, dir.x) + Math.PI);
  }

  // Spider: random wanderer AI + web laying
  updateSpiderAI(enemy, now) {
    if (!enemy || !enemy.body) return;

    // Re-pick direction at intervals (smaller heading changes for smoother, longer runs)
    const nextTurnAt = enemy.getData('nextTurnAt') || 0;
    if (now >= nextTurnAt) {
      const prev = enemy.getData('dirAngle');
      const maxTurn = Phaser.Math.DegToRad(this.spiderTurnMaxDeltaDeg != null ? this.spiderTurnMaxDeltaDeg : 35);
      const delta = Phaser.Math.FloatBetween(-maxTurn, maxTurn);
      const baseAng = (prev != null) ? prev : Phaser.Math.FloatBetween(-Math.PI, Math.PI);
      const ang = Phaser.Math.Angle.Wrap(baseAng + delta);

      const baseSp = Phaser.Math.Between(this.spiderMinSpeed || 28, this.spiderMaxSpeed || 55);
      const sp = Math.max(10, Math.floor(baseSp * (this.enemySpeedScale || 1)));
      enemy.setData('speed', sp);
      enemy.setVelocity(Math.cos(ang) * sp, Math.sin(ang) * sp);
      enemy.setData('dirAngle', ang);

      const dt = Phaser.Math.Between(this.spiderTurnIntervalMin || 700, this.spiderTurnIntervalMax || 1600);
      enemy.setData('nextTurnAt', now + dt);
    }

    // Face movement direction
    const v = enemy.body.velocity || { x: 0, y: 0 };
    const vlen = Math.hypot(v.x, v.y);
    if (vlen > 0.01) {
      enemy.setRotation(Math.atan2(v.y, v.x) + Math.PI);
    }

    // Legs scuttle animation while moving
    if (vlen > 5) {
      const swapAt = enemy.getData('walkSwapAt') || 0;
      if (now >= swapAt) {
        const frame = enemy.getData('frame') === 2 ? 1 : 2;
        enemy.setTexture(frame === 1 ? 'enemy_spider_1' : 'enemy_spider_2');
        enemy.setData('frame', frame);
        enemy.setData('walkSwapAt', now + (this.spiderWalkSwapInterval || 110));
      }
    }

    // Periodically drop webs
    const nextWebAt = enemy.getData('nextWebAt') || 0;
    if (now >= nextWebAt) {
      this.spawnWebTrap(enemy.x, enemy.y);
      const cd = Phaser.Math.Between(this.spiderWebCooldownMin || 1400, this.spiderWebCooldownMax || 2600);
      enemy.setData('nextWebAt', now + cd);
    }
  }

  // Snake: slithering chaser with sine wiggle; retreats while player is stunned by it
  updateSnakeAI(enemy, now) {
    if (!enemy || !enemy.body || !this.player) return;
    const p = this.player.getCenter();
    const epos = enemy.getCenter();
    const dx = p.x - epos.x;
    const dy = p.y - epos.y;
    const dist = Math.hypot(dx, dy);
    let dirX = 0, dirY = 0;
    if (dist > 0.0001) {
      dirX = dx / dist;
      dirY = dy / dist;
    }
    // If this snake has recently stunned the player, back away until timer expires
    const avoid = now < (enemy.getData('avoidUntil') || 0);
    if (avoid) {
      dirX = -dirX;
      dirY = -dirY;
    }
    // Wiggle by oscillating the heading angle
    const baseAng = Math.atan2(dirY, dirX);
    const phase = (enemy.getData('phase') || 0) + now * 0.006 * (enemy.getData('wiggleSpeed') || 2);
    const wiggleDeg = enemy.getData('wiggleDeg') != null ? enemy.getData('wiggleDeg') : 22;
    const ang = baseAng + Math.sin(phase) * Phaser.Math.DegToRad(wiggleDeg);
    const sp = enemy.getData('speed') || 140;
    enemy.setVelocity(Math.cos(ang) * sp, Math.sin(ang) * sp);
    enemy.setRotation(ang + Math.PI);
  }

  // Return current movement speed, considering slow and stun debuffs
  getCurrentSpeed(now) {
    const base = this.speed || 0;
    if (now < (this.stunUntil || 0)) {
      return 0;
    }
    if (now < (this.slowUntil || 0)) {
      const mult = this.slowMultiplier != null ? this.slowMultiplier : 0.5;
      return Math.floor(base * mult);
    }
    return base;
  }

  // Spawn a web trap at x,y with cap enforcement
  spawnWebTrap(x, y) {
    if (!this.webTraps) return null;
    // Enforce cap
    const kids = this.webTraps.getChildren ? this.webTraps.getChildren() : [];
    const active = kids.filter(w => w && w.active);
    if (active.length >= (this.maxActiveWebTraps || 5)) {
      // Destroy oldest by spawn time; fallback to first
      let oldest = null;
      let bestT = Number.POSITIVE_INFINITY;
      for (let i = 0; i < active.length; i++) {
        const w = active[i];
        const t = (w.getData && w.getData('spawnedAt')) || 0;
        if (t < bestT) { bestT = t; oldest = w; }
      }
      if (!oldest && active.length > 0) oldest = active[0];
      if (oldest && oldest.destroy) oldest.destroy();
    }
    const web = this.webTraps.create(x, y, 'web_trap');
    web.setDepth(2);
    if (web.body && web.body.setCircle) {
      const r = Math.floor(Math.min(web.width, web.height) * 0.38);
      const ox = (web.width / 2) - r;
      const oy = (web.height / 2) - r;
      web.body.setCircle(r, ox, oy);
      web.body.setAllowGravity(false);
      web.body.immovable = true;
      web.body.setBounce(0, 0);
      web.setVelocity(0, 0);
    }
    if (web.setAngle) web.setAngle(Phaser.Math.Between(0, 360));
    web.setData('spawnedAt', this.time.now);
    return web;
  }

  // Web trap overlap -> apply slow and consume
  onPlayerWebOverlap(player, web) {
    if (!web || !web.active) return;
    const now = this.time.now;
    // 3 seconds slow; extend if re-applied
    this.slowUntil = Math.max(this.slowUntil || 0, now + 3000);
    // Consume web
    if (this.sfxOn) this.sfxPickup();
    web.destroy();
  }

  onShelterEnemyOverlap(shelter, enemy) {
    if (!enemy || !enemy.active || this.isGameOver) return;
    const t = enemy.getData && enemy.getData('type');
    if (t !== 'enemy_beetle' && t !== 'enemy_caterpillar' && t !== 'enemy_boss') return;
    const now = this.time.now;
    const next = enemy.getData('nextShelterDamageAt') || 0;
    if (now < next) return;
    enemy.setData('nextShelterDamageAt', now + this.shelterDamageInterval);
    const dmg = enemy.getData('contactDamage') != null ? enemy.getData('contactDamage') : 1;
    this.damageShelter(dmg, enemy);
    // FX
    if (this.hitEmitter) this.hitEmitter.explode(Phaser.Math.Between(4, 8), enemy.x, enemy.y);
    this.cameras.main.shake(90, 0.003);
  }

  damageShelter(amount = 1, source = null) {
    if (this.isGameOver) return;
    this.shelterHealth = Math.max(0, this.shelterHealth - amount);
    this.updateShelterUI();
    if (this.sfxOn) this.sfxHurt();
    if (this.shelterHealth <= 0) {
      this.onShelterDestroyed();
    }
  }

  onShelterDestroyed() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.isDead = true; // freeze inputs similar to player death
    if (this.sfxOn) this.sfxDie();
    this.physics.pause();

    // Clear any active enemy projectiles
    if (this.projectiles) this.projectiles.clear(true, true);

    // Visual state
    if (this.player) this.player.setTint(0x444444);
    if (this.shelter) this.shelter.setTint(0x555555);

    // Overlay UI
    const overlay = this.add
      .rectangle(this.worldWidth / 2, this.worldHeight / 2, this.worldWidth, this.worldHeight, 0x000000, 0.7)
      .setDepth(40);
    const title = this.add.text(this.worldWidth / 2, this.worldHeight / 2 - 20, 'Shelter Destroyed', {
      fontFamily: 'monospace',
      fontSize: '42px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(41);
    title.setShadow(0, 4, '#000000', 4, true, true);

    const prompt = this.add.text(this.worldWidth / 2, this.worldHeight / 2 + 40, 'Press R to Restart', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(41);
    prompt.setShadow(0, 2, '#000000', 2, true, true);

    this.input.keyboard.once('keydown-R', () => this.scene.restart());
    this.input.once('pointerdown', () => this.scene.restart());
  }

  updateShelterUI() {
    if (!this.shelterHealthGfx) return;
    const x = 8;
    const y = 58;
    const w = 140;
    const h = 14;
    const pct = Phaser.Math.Clamp(this.shelterHealth / this.shelterMaxHealth, 0, 1);

    this.shelterHealthGfx.clear();
    // Border/Backdrop
    this.shelterHealthGfx.fillStyle(0x000000, 0.4);
    this.shelterHealthGfx.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 8);
    // Background
    this.shelterHealthGfx.fillStyle(0x10212b, 0.95);
    this.shelterHealthGfx.fillRoundedRect(x, y, w, h, 6);
    // Fill color
    const fillColor = pct > 0.5 ? 0x2e86c1 : (pct > 0.25 ? 0xf39c12 : 0xe74c3c);
    this.shelterHealthGfx.fillStyle(fillColor, 1);
    this.shelterHealthGfx.fillRoundedRect(x, y, Math.max(0, Math.floor(w * pct)), h, 6);
    // Shine
    if (pct > 0) {
      this.shelterHealthGfx.fillStyle(0xffffff, 0.15);
      this.shelterHealthGfx.fillRoundedRect(x + 4, y + 3, Math.max(0, Math.floor((w - 8) * pct)), 4, 3);
    }

    if (this.shelterHealthText) {
      this.shelterHealthText.setText('Shelter: ' + this.shelterHealth + '/' + this.shelterMaxHealth);
    }
  }

  onPlayerProjectileOverlap(player, proj) {
    if (!proj || !proj.active || this.isDead) return;
    const now = this.time.now;
    try {
      console.info('[HIT] projectile overlap', {
        type: proj.texture ? proj.texture.key : null,
        amount: 1,
        hasArmor: this.hasArmor,
        health: this.health,
        now,
        invulnUntil: this.invulnUntil,
        invulnActive: now < this.invulnUntil
      });
    } catch (e) {}
    this.takeDamage(1, proj);
    this.hitEmitter.explode(6, proj.x, proj.y);
    proj.destroy();
  }

  spawnEnemy() {
    const now = this.time.now;
    if ((this.nextAllowedSpawnAt || 0) > now) return null;
    const margin = 40;
    // Enforce max active enemies cap
    let activeCount = 0;
    if (this.enemies && this.enemies.getChildren) {
      const cs = this.enemies.getChildren();
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i];
        if (c && c.active) activeCount++;
      }
    }
    const cap = this.maxActiveEnemies != null ? this.maxActiveEnemies : 8;
    if (activeCount >= cap) return null;

    // Spawn position (safe: never too close to player or shelter)
    let sx = null, sy = null;
    const minPlayer = this.spawnMinDistPlayer != null ? this.spawnMinDistPlayer : 140;
    const minShelter = this.spawnMinDistShelter != null ? this.spawnMinDistShelter : 120;
    const attempts = this.spawnMaxAttempts != null ? this.spawnMaxAttempts : 20;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const tx = Phaser.Math.Between(margin, this.worldWidth - margin);
      const ty = Phaser.Math.Between(margin, this.worldHeight - margin);
      // Check distance to player
      let safe = true;
      if (this.player && typeof this.player.getCenter === 'function') {
        const pc = this.player.getCenter();
        const dx = tx - pc.x, dy = ty - pc.y;
        if (dx*dx + dy*dy < minPlayer * minPlayer) safe = false;
      }
      // Check distance to shelter
      if (safe && this.shelter) {
        const dx = tx - this.shelter.x, dy = ty - this.shelter.y;
        if (dx*dx + dy*dy < minShelter * minShelter) safe = false;
      }
      if (safe) { sx = tx; sy = ty; break; }
    }
    if (sx == null) return null;
    const x = sx;
    const y = sy;

    // Count wasps/spiders for caps and pick weighted type
    let waspCount = 0;
    let spiderCount = 0;
    if (this.enemies && this.enemies.getChildren) {
      const cs = this.enemies.getChildren();
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i];
        if (!c || !c.active || !c.getData) continue;
        const t = c.getData('type');
        if (t === 'enemy_wasp') waspCount++;
        else if (t === 'enemy_spider') spiderCount++;
      }
    }
    const type = this.chooseEnemyType ? this.chooseEnemyType(waspCount, spiderCount) : 'enemy_fly';
    const texKey = (type === 'enemy_spider') ? 'enemy_spider_1' : type;
    const enemy = this.enemies.create(x, y, texKey);
    enemy.setData('type', type);
    enemy.setCollideWorldBounds(true);
    if (type === 'enemy_wasp') {
      enemy.setBounce(0, 0);
    } else {
      enemy.setBounce(1, 1);
    }
    if (enemy.body) enemy.body.onWorldBounds = true;
    enemy.setDepth(4);
    // Tighter circular physics body for enemy
    {
      const eMin = Math.min(enemy.width, enemy.height);
      const er = Math.floor(eMin * this.enemyBodyRadiusFactor);
      const eox = enemy.width / 2 - er;
      const eoy = enemy.height / 2 - er;
      if (enemy.body && enemy.body.setCircle) {
        enemy.body.setCircle(er, eox, eoy);
      }
    }
    // Per-type stats and behavior
    let hp = 1;
    let contactDamage = (type === 'enemy_fly') ? 0.5 : 1;

    if (type === 'enemy_beetle') {
      contactDamage = 2;
      const baseSp = Phaser.Math.Between(40, 80);
      const sp = Math.max(10, Math.floor(baseSp * (this.enemySpeedScale || 1)));
      enemy.setData('speed', sp);
      const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
      enemy.setVelocity(Math.cos(ang) * sp, Math.sin(ang) * sp);
    } else if (type === 'enemy_fly') {
      const baseSp = Phaser.Math.Between(70, 120);
      const sp = Math.max(10, Math.floor(baseSp * (this.enemySpeedScale || 1)));
      enemy.setData('speed', sp);
      const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
      enemy.setVelocity(Math.cos(ang) * sp, Math.sin(ang) * sp);
      this.tweens.add({
        targets: enemy,
        scale: { from: 0.95, to: 1.08 },
        duration: 360,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } else if (type === 'enemy_caterpillar') {
      hp = (this.caterpillarHp != null ? this.caterpillarHp : 3); // bigger, slower, tougher
      contactDamage = 2;
      const baseSp = Phaser.Math.Between(15, 35);
      const sp = Math.max(8, Math.floor(baseSp * (this.enemySpeedScale || 1)));
      enemy.setData('speed', sp);
      const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
      enemy.setVelocity(Math.cos(ang) * sp, Math.sin(ang) * sp);
      this.tweens.add({
        targets: enemy,
        scaleY: { from: 0.98, to: 1.02 },
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } else if (type === 'enemy_ant') {
      // fast chaser that targets the player; keep speed independent of player upgrades
      hp = 1;
      contactDamage = 0.5;
      const baseSp = Phaser.Math.Between(180, 200);
      const sp = Math.max(10, baseSp); // do not scale with enemySpeedScale
      const maxAntSpeed = 150; // stay a bit below baseline player speed (220) regardless of upgrades
      const finalSp = Math.min(sp, maxAntSpeed);
      enemy.setData('speed', finalSp);
      const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
      enemy.setVelocity(Math.cos(ang) * finalSp, Math.sin(ang) * finalSp);
      this.tweens.add({
        targets: enemy,
        scale: { from: 0.98, to: 1.04 },
        duration: 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } else if (type === 'enemy_snake') {
      // Rainbow snake: moderate-speed chaser that stuns and then retreats
      hp = 1;
      contactDamage = 0.5;
      const sp = 100; // moderate speed
      enemy.setData('speed', sp);
      // Randomize wiggle characteristics
      enemy.setData('phase', Phaser.Math.FloatBetween(0, Math.PI * 2));
      enemy.setData('wiggleSpeed', Phaser.Math.FloatBetween(1.6, 2.6));
      enemy.setData('wiggleDeg', 22);
      // Visual scale: make snake ~65% size and adjust hitbox
      const snakeScale = 0.65;
      enemy.setScale(snakeScale);
      // Recompute circular physics body to match scaled visual
      if (enemy.body && enemy.body.setCircle) {
        const base = Math.min(enemy.width, enemy.height);
        const r = Math.floor(base * (this.enemyBodyRadiusFactor || 0.36) * snakeScale);
        const ox = enemy.width / 2 - r;
        const oy = enemy.height / 2 - r;
        enemy.body.setCircle(r, ox, oy);
      }
      // Start heading toward player initially
      if (this.player) {
        const pc = this.player.getCenter();
        const ec = enemy.getCenter();
        const dx = pc.x - ec.x, dy = pc.y - ec.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist, ny = dy / dist;
        enemy.setVelocity(nx * sp, ny * sp);
        enemy.setRotation(Math.atan2(ny, nx) + Math.PI);
      } else {
        const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
        enemy.setVelocity(Math.cos(a) * sp, Math.sin(a) * sp);
        enemy.setRotation(a + Math.PI);
      }
      // Subtle slither scale
      this.tweens.add({
        targets: enemy,
        scaleY: { from: snakeScale * 0.96, to: snakeScale * 1.04 },
        scaleX: { from: snakeScale * 1.02, to: snakeScale * 0.98 },
        duration: 360,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      enemy.setBounce(1, 1);
    } else if (type === 'enemy_spider') {
      hp = 1;
      contactDamage = this.spiderContactDamage != null ? this.spiderContactDamage : 1;
      const baseSp = Phaser.Math.Between(this.spiderMinSpeed || 28, this.spiderMaxSpeed || 55);
      const sp = Math.max(10, Math.floor(baseSp * (this.enemySpeedScale || 1)));
      enemy.setData('speed', sp);
      const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
      enemy.setVelocity(Math.cos(ang) * sp, Math.sin(ang) * sp);
      enemy.setData('dirAngle', ang);
      enemy.setData('frame', 1);
      const now = this.time.now;
      enemy.setData('walkSwapAt', now + (this.spiderWalkSwapInterval || 110));
      enemy.setData('nextTurnAt', now + Phaser.Math.Between(this.spiderTurnIntervalMin || 700, this.spiderTurnIntervalMax || 1600));
      enemy.setData('nextWebAt', now + Phaser.Math.Between(this.spiderWebCooldownMin || 1400, this.spiderWebCooldownMax || 2600));
    } else {
      // enemy_wasp: ranged pursuer
      enemy.setVelocity(0, 0);
      enemy.setDrag(0, 0);
      enemy.setData('nextShotAt', this.time.now + Phaser.Math.Between(this.shooterMinCooldown, this.shooterMaxCooldown));
      this.tweens.add({
        targets: enemy,
        scale: { from: 0.98, to: 1.05 },
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    enemy.setData('hp', hp);
    enemy.setData('contactDamage', contactDamage);
  }
  
  // Loot: health heart drop
  trySpawnHeart(x, y) {
    if (!this.hearts) return;
    if (Math.random() >= this.heartDropChance) return;
    const heart = this.hearts.create(x, y, 'heart_pickup');
    heart.setDepth(4);
    if (heart.body && heart.body.setCircle) {
      const r = Math.floor(Math.min(heart.width, heart.height) * 0.4);
      const ox = (heart.width / 2) - r;
      const oy = (heart.height / 2) - r;
      heart.body.setCircle(r, ox, oy);
      heart.body.setAllowGravity(false);
      heart.body.immovable = true;
      heart.body.setBounce(0, 0);
      heart.setVelocity(0, 0);
    }
    // Gentle bobbing to draw attention
    this.tweens.add({
      targets: heart,
      y: heart.y - 6,
      scale: { from: 1.0, to: 1.08 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  // Loot: armor drop (chainmail icon)
  trySpawnArmor(x, y) {
    if (!this.armors) return;
    if (Math.random() >= this.armorDropChance) return;
    const armor = this.armors.create(x, y, 'armor_pickup');
    armor.setDepth(4);
    if (armor.body && armor.body.setCircle) {
      const r = Math.floor(Math.min(armor.width, armor.height) * 0.4);
      const ox = (armor.width / 2) - r;
      const oy = (armor.height / 2) - r;
      armor.body.setCircle(r, ox, oy);
      armor.body.setAllowGravity(false);
      armor.body.immovable = true;
      armor.body.setBounce(0, 0);
      armor.setVelocity(0, 0);
    }
    // Gentle bobbing
    this.tweens.add({
      targets: armor,
      y: armor.y - 6,
      scale: { from: 1.0, to: 1.08 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  // Loot: spray can drop
  trySpawnSprayCan(x, y) {
    if (!this.sprayCans) return;
    if (Math.random() >= this.sprayDropChance) return;
    const can = this.sprayCans.create(x, y, 'spray_can');
    can.setDepth(4);
    if (can.body && can.body.setCircle) {
      const r = Math.floor(Math.min(can.width, can.height) * 0.38);
      const ox = (can.width / 2) - r;
      const oy = (can.height / 2) - r;
      can.body.setCircle(r, ox, oy);
      can.body.setAllowGravity(false);
      can.body.immovable = true;
      can.body.setBounce(0, 0);
      can.setVelocity(0, 0);
    }
    // Bobbing
    this.tweens.add({
      targets: can,
      y: can.y - 6,
      scale: { from: 1.0, to: 1.06 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  onPlayerHeartOverlap(player, heart) {
    if (!heart || !heart.active) return;
    // Heal
    if (this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + this.heartHealAmount);
      this.updateHealthUI();
    }
    // Pickup FX
    if (this.sfxOn) this.sfxPickup();
    const pop = this.add.image(heart.x, heart.y, 'heart_pickup').setDepth(11);
    this.tweens.add({
      targets: pop,
      y: heart.y - 12,
      scale: 1.3,
      alpha: 0,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => pop.destroy()
    });
    heart.destroy();
  }

  onPlayerArmorOverlap(player, armor) {
    if (!armor || !armor.active) return;
    this.hasArmor = true;
    this.armorHitsRemaining = this.maxArmorHits;
    try {
      console.info('[ARMOR] equipped', { maxHits: this.maxArmorHits, hitsRemaining: this.armorHitsRemaining });
    } catch (e) {}

    // Visual feedback
    if (this.armorOverlay) {
      this.armorOverlay.setVisible(true);
      this.armorOverlay.setAlpha(0.7);
      // Pickup pop FX
      const pop = this.add.image(armor.x, armor.y, 'armor_pickup').setDepth(11);
      this.tweens.add({
        targets: pop,
        y: armor.y - 12,
        scale: 1.2,
        alpha: 0,
        duration: 220,
        ease: 'Quad.easeOut',
        onComplete: () => pop.destroy()
      });
    }

    // Subtle tint to indicate armored state
    if (this.player) this.player.setTint(0xb9c6d0);

    if (this.sfxOn) this.sfxPickup();
    armor.destroy();
  }

  onPlayerSprayOverlap(player, can) {
    if (!can || !can.active) return;
    this.sprayUses = this.maxSprayUses;
    this.updateSprayUI();

    // Visual pop
    const pop = this.add.image(can.x, can.y, 'spray_can').setDepth(11);
    this.tweens.add({
      targets: pop,
      y: can.y - 12,
      scale: 1.2,
      alpha: 0,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => pop.destroy()
    });

    if (this.sfxOn) this.sfxPickup();
    can.destroy();
  }
  
  // World-bounds collision logging for enemies
  onWorldBoundsCollision(body, up, down, left, right) {
    if (!body || !body.gameObject) return;
    const go = body.gameObject;

    // Destroy projectiles when they hit world bounds
    if ((this.projectiles && this.projectiles.contains(go)) || (this.allyProjectiles && this.allyProjectiles.contains(go))) {
      go.destroy();
      return;
    }

    // Only track enemies
    if (!this.enemies || !this.enemies.contains(go)) return;

    const sides = [];
    if (left) sides.push('left');
    if (right) sides.push('right');
    if (up) sides.push('up');
    if (down) sides.push('down');

    console.debug('[Enemy] worldbounds', {
      type: go.getData && go.getData('type'),
      x: Math.round(go.x), y: Math.round(go.y),
      vx: Math.round(body.velocity.x), vy: Math.round(body.velocity.y),
      sides: sides.join('|') || 'none'
    });
  }

  showUpgradeSelection() {
    this.isChoosingUpgrade = true;
    this.physics.pause();
    if (this.sfxOn) this.sfxUpgradeOpen();

    // Dark overlay and panel
    const overlay = this.add.rectangle(this.worldWidth / 2, this.worldHeight / 2, this.worldWidth, this.worldHeight, 0x000000, 0.7).setDepth(30);
    const panel = this.add.image(this.worldWidth / 2, this.worldHeight / 2, 'upgrade_bg').setDepth(31);
    const title = this.add.text(this.worldWidth / 2, this.worldHeight / 2 - 130, 'Choose an Upgrade', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(32);
    title.setShadow(0, 3, '#000000', 3, true, true);

    this.upgradeChoices = this.getRandomUpgrades(3);

    const makeButton = (y, text, onClick) => {
      // Create a container so we can draw a custom rounded box + label
      const container = this.add.container(this.worldWidth / 2, y).setDepth(32);

      // Label
      const label = this.add.text(0, 0, text, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        align: 'center'
      }).setOrigin(0.5);
      label.setShadow(0, 2, '#000000', 2, true, true);

      // Compute box size from label with padding
      const paddingX = 22;
      const paddingY = 12;
      const w = Math.ceil(label.width + paddingX * 2);
      const h = Math.ceil(label.height + paddingY * 2);
      const radius = 12; // slightly more rounded edges

      // Rounded rect background with border
      const box = this.add.graphics();
      const draw = (mode = 'normal') => {
        box.clear();
        let fill = 0x333333;
        let fillA = 0.95;
        let stroke = 0xffffff;
        let strokeA = 0.28;
        if (mode === 'hover') { fill = 0x4a4a4a; strokeA = 0.35; }
        if (mode === 'down')  { fill = 0x2f2f2f; strokeA = 0.40; }
        box.fillStyle(fill, fillA);
        box.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
        box.lineStyle(2, stroke, strokeA);
        box.strokeRoundedRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1, radius);
      };
      draw('normal');

      container.add([box, label]);
      container.setSize(w, h);
      container.setInteractive({ useHandCursor: true });

      // Hover/press effects + click
      container.on('pointerover', () => draw('hover'));
      container.on('pointerout', () => draw('normal'));
      container.on('pointerdown', () => draw('down'));
      container.on('pointerup', () => {
        draw('hover');
        onClick();
      });

      return container;
    };

    // Slightly increase spacing and add extra gap below the title
    const spacing = 88;
    const startY = this.worldHeight / 2 - spacing + 24;
    const btns = [];
    for (let i = 0; i < this.upgradeChoices.length; i++) {
      const up = this.upgradeChoices[i];
      const y = startY + i * spacing;
      const text = up.description;
      btns.push(makeButton(y, text, () => this.applyUpgrade(up)));
    }

    // Keep references for cleanup
    this.upgradeUI = [overlay, panel, title, ...btns];
  }

  getRandomUpgrades(count) {
    const all = [
      { type: 'speed', value: 60, description: 'Increased Movement Speed\n+60 speed' },
      { type: 'tongue', value: 80, description: 'Longer Tongue\n+80 range' },
      { type: 'attack', value: 0.25, description: 'Faster Attacks\n-25% cooldown' }
    ];
    // Offer shelter upgrade if not at max level
    if ((this.shelterLevel || 1) < (this.maxShelterLevel || 3)) {
      const boost = this.shelterUpgradeHealthBoost || 8;
      const desc = 'Upgrade Shelter';
      all.push({ type: 'shelter_upgrade', healthBoost: boost, description: desc });
    }
    // Shuffle
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, Math.min(count, all.length));
  }

  applyUpgrade(up) {
    if (this.sfxOn) this.sfxUpgradeSelect();
    // Apply
    switch (up.type) {
      case 'speed':
        this.speed += up.value;
        break;
      case 'tongue':
        this.tongueRange += up.value;
        break;
      case 'attack':
        this.attackCooldown = Math.max(80, Math.floor(this.attackCooldown * (1 - up.value)));
        break;
      case 'shelter_upgrade':
        this.handleShelterUpgrade(up);
        break;
    }

    // Cleanup UI
    for (const obj of this.upgradeUI) {
      if (obj && obj.destroy) obj.destroy();
    }
    this.upgradeUI.length = 0;

    this.isChoosingUpgrade = false;
    this.physics.resume();
  }
  initAudio() {
    const hasPhaser = !!this.sound;
    const phaserCtx = hasPhaser ? this.sound.context : null;
    const phaserUsingWA = !!(hasPhaser && this.sound.usingWebAudio);
    const AC = window.AudioContext || window.webkitAudioContext;

    console.info('[Audio] initAudio()', {
      hasPhaser,
      phaserUsingWebAudio: phaserUsingWA,
      phaserHasCtx: !!phaserCtx,
      hasWindowAC: !!AC
    });

    // Prefer Phaser's WebAudio context when available
    if (phaserUsingWA && phaserCtx) {
      this.audioCtx = phaserCtx;
      console.info('[Audio] Using Phaser AudioContext', { state: this.audioCtx.state });
    } else if (AC) {
      console.warn('[Audio] Falling back to standalone AudioContext (Phaser usingWebAudio=' + phaserUsingWA + ')');
      try {
        this.audioCtx = new AC();
      } catch (e) {
        console.error('[Audio] AudioContext creation failed', e);
        this.sfxOn = false;
        return;
      }
    } else {
      console.warn('[Audio] No WebAudio available in this environment');
      this.sfxOn = false;
      return;
    }

    try {
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.audioCtx.destination);
      console.info('[Audio] masterGain configured', { gain: this.masterGain.gain.value });
    } catch (e) {
      console.error('[Audio] masterGain setup failed', e);
      this.sfxOn = false;
      return;
    }

    const tryResume = (src) => {
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        console.info('[Audio] resume() requested via', src);
        this.audioCtx.resume().then(() => {
          console.info('[Audio] resumed; state=', this.audioCtx.state);
        }).catch(err => {
          console.error('[Audio] resume() failed', err);
        });
      }
    };

    // Unlock on first gesture from Phaser
    if (this.input) {
      this.input.once('pointerdown', () => tryResume('pointerdown'));
      if (this.input.keyboard) {
        this.input.keyboard.once('keydown', () => tryResume('keydown'));
      }
    }
    // Extra safety: unlock on a window click as well
    window.addEventListener('click', () => tryResume('window-click'), { once: true, passive: true });

    this.sfxOn = true;
    console.info('[Audio] SFX enabled');
  }

  playTone(opts = {}) {
    if (!this.sfxOn || !this.audioCtx || !this.masterGain) {
      console.warn('[Audio] playTone skipped', { sfxOn: this.sfxOn, hasCtx: !!this.audioCtx, hasMaster: !!this.masterGain });
      return;
    }

    const ctx = this.audioCtx;
    const type = opts.type || 'sine';
    const startFreq = Math.max(1, opts.startFreq || 440);
    const endFreq = Math.max(1, opts.endFreq == null ? startFreq : opts.endFreq);
    const duration = Math.max(0.01, opts.duration || 0.1);
    const attack = Math.max(0, Math.min(duration, opts.attack == null ? 0.005 : opts.attack));
    const peak = Math.max(0.0001, Math.min(1, opts.volume == null ? 0.2 : opts.volume));
    const startTime = ctx.currentTime + (opts.delay || 0);

    console.debug('[Audio] playTone', { type, startFreq, endFreq, duration, attack, peak, startTime, ctxState: ctx.state });

    const osc = ctx.createOscillator();
    osc.type = type;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peak, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.frequency.setValueAtTime(startFreq, startTime);
    if (endFreq !== startFreq) {
      try {
        osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
      } catch (err) {
        osc.frequency.linearRampToValueAtTime(endFreq, startTime + duration);
      }
    }

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.onended = () => {
      try { osc.disconnect(); } catch (e) {}
      try { gain.disconnect(); } catch (e) {}
      console.debug('[Audio] tone ended');
    };

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  sfxTongue() {
    const base = 300 + Phaser.Math.Between(-20, 20);
    this.playTone({ type: 'sawtooth', startFreq: base, endFreq: base + 500, duration: 0.12, attack: 0.005, volume: 0.12 });
  }

  sfxSpray() {
    // Quick hiss made of layered tones
    const base = 800 + Phaser.Math.Between(-40, 40);
    this.playTone({ type: 'triangle', startFreq: base, endFreq: 600, duration: 0.08, attack: 0.001, volume: 0.10 });
    this.playTone({ type: 'square', startFreq: base * 0.9, endFreq: 500, duration: 0.06, attack: 0.001, volume: 0.06, delay: 0.01 });
  }

  sfxShelterShot() {
    // Bright short zap for turret
    const base = 720 + Phaser.Math.Between(-30, 30);
    this.playTone({ type: 'square', startFreq: base, endFreq: base + 220, duration: 0.06, attack: 0.001, volume: 0.10 });
    this.playTone({ type: 'triangle', startFreq: base + 220, endFreq: base + 120, duration: 0.05, attack: 0.001, volume: 0.06, delay: 0.02 });
  }
 
  sfxHit() {
    const base = 900 + Phaser.Math.Between(-60, 60);
    this.playTone({ type: 'square', startFreq: base, endFreq: 140, duration: 0.12, attack: 0.001, volume: 0.18 });
    this.playTone({ type: 'triangle', startFreq: base * 0.7, endFreq: 120, duration: 0.12, attack: 0.001, volume: 0.10, delay: 0.005 });
  }

  sfxUpgradeOpen() {
    this.playTone({ type: 'triangle', startFreq: 380, endFreq: 720, duration: 0.22, attack: 0.005, volume: 0.12 });
  }

  sfxUpgradeSelect() {
    this.playTone({ type: 'square', startFreq: 600, endFreq: 900, duration: 0.16, attack: 0.001, volume: 0.14 });
  }
  
  sfxPickup() {
    // Pleasant pickup chirp
    this.playTone({ type: 'triangle', startFreq: 680, endFreq: 1000, duration: 0.10, attack: 0.001, volume: 0.12 });
    this.playTone({ type: 'sine', startFreq: 1000, endFreq: 1400, duration: 0.08, attack: 0.001, volume: 0.06, delay: 0.02 });
  }
  
  // Hearts UI (Zelda-style)
  updateHealthUI() {
    // Initialize container if needed
    if (!this.healthHeartsContainer) {
      this.healthHeartsContainer = this.add.container(8, 8).setDepth(20);
    }

    // Resolve texture dimensions once
    if (!this.heartTexW || !this.heartTexH) {
      const timg = this.add.image(0, 0, 'heart_pickup').setVisible(false);
      this.heartTexW = timg.width;
      this.heartTexH = timg.height;
      timg.destroy();
    }

    const slotsNeeded = Math.max(0, Math.floor(this.maxHealth || 0));

    if (!this.healthHeartSlots) this.healthHeartSlots = [];

    // Rebuild slots if maxHealth changed
    if (this.healthHeartSlots.length !== slotsNeeded) {
      // Destroy old
      for (const s of this.healthHeartSlots) {
        if (s && s.bg && s.bg.destroy) s.bg.destroy();
        if (s && s.fg && s.fg.destroy) s.fg.destroy();
      }
      this.healthHeartSlots = [];

      const step = Math.round(this.heartTexW * (this.heartScale || 0.6)) + (this.heartSpacing || 4);
      for (let i = 0; i < slotsNeeded; i++) {
        const x = i * step;
        const bg = this.add.image(x, 0, 'heart_pickup')
          .setOrigin(0, 0)
          .setScale(this.heartScale || 0.6)
          .setTint(0x444444)
          .setAlpha(0.45);
        const fg = this.add.image(x, 0, 'heart_pickup')
          .setOrigin(0, 0)
          .setScale(this.heartScale || 0.6);
        this.healthHeartsContainer.add(bg);
        this.healthHeartsContainer.add(fg);
        this.healthHeartSlots.push({ bg, fg });
      }
    }

    // Update fill levels
    const hp = Math.max(0, this.health || 0);
    const fullW = this.heartTexW;
    const fullH = this.heartTexH;

    for (let i = 0; i < this.healthHeartSlots.length; i++) {
      const { fg } = this.healthHeartSlots[i];
      const heartIndex = i + 1; // 1-based
      if (hp >= heartIndex) {
        // full
        if (fg.setCrop) fg.setCrop(0, 0, fullW, fullH);
        fg.setVisible(true);
        fg.clearTint();
        fg.setAlpha(1);
      } else if (hp >= heartIndex - 0.5) {
        // half (left half)
        if (fg.setCrop) fg.setCrop(0, 0, Math.ceil(fullW / 2), fullH);
        fg.setVisible(true);
        fg.clearTint();
        fg.setAlpha(1);
      } else {
        // empty: hide foreground; background remains grey
        fg.setVisible(false);
      }
    }
  }

  updateSprayUI() {
    if (!this.sprayText) return;
    if (this.sprayUses > 0) {
      this.sprayText.setText('Spray: ' + this.sprayUses + '/' + this.maxSprayUses);
      this.sprayText.setVisible(true);
    } else {
      this.sprayText.setText('');
      this.sprayText.setVisible(false);
    }
  }
  
  // Enemy contact interactions
  onPlayerEnemyOverlap(player, enemy) {
    if (!enemy || !enemy.active || this.isDead) return;

    const type = enemy.getData && enemy.getData('type');

    // Boss does not harm the player; it only targets the shelter
    if (type === 'enemy_boss') return;

    // Rainbow snake: 0.5 dmg + stun; then backs away until stun ends
    if (type === 'enemy_snake') {
      const now = this.time.now;
      // Apply stun regardless of i-frames to enforce the control effect
      const stunMs = 1100;
      this.stunUntil = Math.max(this.stunUntil || 0, now + stunMs);
      // Tag this snake to avoid the player until stun expires
      enemy.setData('avoidUntil', now + stunMs);
      // Push initial movement away immediately
      if (enemy.body) {
        const pc = this.player.getCenter();
        const ec = enemy.getCenter();
        const dx = ec.x - pc.x, dy = ec.y - pc.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist, ny = dy / dist;
        const sp = enemy.getData('speed') || 140;
        enemy.setVelocity(nx * sp, ny * sp);
        enemy.setRotation(Math.atan2(ny, nx) + Math.PI);
      }
      // Damage (respects armor/invuln as usual)
      this.takeDamage(0.5, enemy);
      // FX
      if (this.hitEmitter) this.hitEmitter.explode(Phaser.Math.Between(6, 10), enemy.x, enemy.y);
      if (this.sfxOn) this.sfxHit();
      return;
    }

    // Ants deal 0.5 damage on contact and die instantly
    if (type === 'enemy_ant') {
      const now = this.time.now;
      try {
        console.info('[HIT] ant contact -> 0.5 dmg + instant kill', {
          type,
          intendedDamage: 0.5,
          hasArmor: this.hasArmor,
          health: this.health,
          now,
          invulnUntil: this.invulnUntil,
          invulnActive: now < this.invulnUntil
        });
      } catch (e) {}

      // Apply player damage first (respects invulnerability/armor), then kill the ant
      this.takeDamage(0.5, enemy);

      // FX and kill
      if (this.hitEmitter) this.hitEmitter.explode(Phaser.Math.Between(8, 12), enemy.x, enemy.y);
      if (this.sfxOn) this.sfxHit();
      this.damageEnemy(enemy, 9999);
      return;
    }

    const dmg = enemy.getData('contactDamage') != null
      ? enemy.getData('contactDamage')
      : (type === 'enemy_beetle' ? 2 : 1);
    const now = this.time.now;
    try {
      console.info('[HIT] enemy overlap', {
        type,
        contactDamage: dmg,
        hasArmor: this.hasArmor,
        health: this.health,
        now,
        invulnUntil: this.invulnUntil,
        invulnActive: now < this.invulnUntil
      });
    } catch (e) {}
    this.takeDamage(dmg, enemy);
  }

  takeDamage(amount = 1, source = null) {
    if (this.isDead) return;
    const now = this.time.now;
    if (now < this.invulnUntil) return;

    // Armor reduces incoming damage by half
    const usedArmor = !!this.hasArmor;
    const halved = usedArmor ? (amount * 0.5) : amount;
    const finalDmg = usedArmor ? Math.floor(halved) : amount;

    // Debug: log damage computation to validate rounding/armor
    try {
      const srcType = source && source.getData ? source.getData('type') : (source && source.texture ? source.texture.key : null);
      const healthBefore = this.health;
      console.info('[DMG] takeDamage', {
        amount,
        hasArmor: usedArmor,
        halved,
        rounding: usedArmor ? 'floor' : 'none',
        finalDmg,
        healthBefore,
        healthAfter: Math.max(0, healthBefore - finalDmg),
        invulnActive: now < this.invulnUntil,
        srcType
      });
    } catch (e) {
      // no-op
    }

    this.health = Math.max(0, this.health - finalDmg);
    this.invulnUntil = now + this.invulnDuration;

    // Track armor durability: consume one hit while armored
    if (this.hasArmor) {
      this.armorHitsRemaining = Math.max(0, (this.armorHitsRemaining || 0) - 1);
      console.info('[ARMOR] hit consumed', { remaining: this.armorHitsRemaining });
      if (this.armorHitsRemaining === 0) {
        // Armor breaks: remove effect and visuals
        this.hasArmor = false;
        if (this.armorOverlay) this.armorOverlay.setVisible(false);
        if (this.player) this.player.clearTint();
        console.info('[ARMOR] broke and removed');
      }
    }

    // SFX and camera shake
    if (this.sfxOn) this.sfxHurt();
    this.cameras.main.shake(120, 0.006);

    // Screen flash
    if (this.redFlash) {
      this.redFlash.setAlpha(0.25);
      this.tweens.add({ targets: this.redFlash, alpha: 0, duration: 160, ease: 'Quad.easeOut' });
    }

    // Knockback
    if (source && this.player && this.player.body) {
      const p = this.player.getCenter();
      const s = source.getCenter();
      const dir = new Phaser.Math.Vector2(p.x - s.x, p.y - s.y).normalize();
      this.player.body.velocity.x += dir.x * 200;
      this.player.body.velocity.y += dir.y * 200;
    }

    this.updateHealthUI();

    if (this.health <= 0) {
      this.onPlayerDeath();
    }
  }

  onPlayerDeath() {
    if (this.isDead) return;
    this.isDead = true;
    this.isGameOver = true;

    if (this.sfxOn) this.sfxDie();
    this.physics.pause();

    // Clear any active enemy projectiles
    if (this.projectiles) {
      this.projectiles.clear(true, true);
    }

    // Visual state
    this.player.setTint(0x444444);

    // Overlay UI
    const overlay = this.add
      .rectangle(this.worldWidth / 2, this.worldHeight / 2, this.worldWidth, this.worldHeight, 0x000000, 0.7)
      .setDepth(40);
    const title = this.add.text(this.worldWidth / 2, this.worldHeight / 2 - 20, 'Game Over', {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(41);
    title.setShadow(0, 4, '#000000', 4, true, true);

    const prompt = this.add.text(this.worldWidth / 2, this.worldHeight / 2 + 40, 'Press R to Restart', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(41);
    prompt.setShadow(0, 2, '#000000', 2, true, true);

    console.info('[Scene] Game Over - waiting for restart');
    this.input.keyboard.once('keydown-R', () => {
      console.info('[Scene] keydown-R -> scene.restart()');
      this.scene.restart();
    });
    this.input.once('pointerdown', () => {
      console.info('[Scene] pointerdown -> scene.restart()');
      this.scene.restart();
    });
  }

  sfxHurt() {
    const base = 520 + Phaser.Math.Between(-20, 20);
    this.playTone({ type: 'sawtooth', startFreq: base, endFreq: 240, duration: 0.10, attack: 0.001, volume: 0.12 });
    this.playTone({ type: 'square', startFreq: base * 0.8, endFreq: 180, duration: 0.10, attack: 0.001, volume: 0.08, delay: 0.03 });
  }

  sfxDie() {
    this.playTone({ type: 'triangle', startFreq: 220, endFreq: 60, duration: 0.40, attack: 0.002, volume: 0.14 });
  }
  // Progressive difficulty recomputation (kill-based)
  recomputeDifficulty() {
    const k = this.enemiesDefeated || 0;
    const level = Math.floor(k / 8);

    if (this.waspUnlockKills == null) this.waspUnlockKills = 16;
    if (this.spawnCheckInterval == null) this.spawnCheckInterval = 1000;

    // Population cap: starts gentle and ramps up slower
    this.maxActiveEnemies = Math.min(3 + level, 16);
    if (k < 5) this.maxActiveEnemies = 3;

    // Unlock ranged enemies later
    this.waspsUnlocked = k >= this.waspUnlockKills;

    // Cap simultaneous wasps, ramp more slowly
    const extraWasp = this.waspsUnlocked ? Math.floor((k - this.waspUnlockKills) / 10) + 1 : 0;
    this.maxActiveWasps = Math.max(0, Math.min(3, extraWasp));

    // Global enemy speed scaling
    this.enemySpeedScale = 0.9 + Math.min(0.3, level * 0.05); // 0.9 -> 1.2

    // Tanky enemy HP
    this.caterpillarHp = 3 + Math.max(0, Math.floor(level / 6));

    // Shooter tuning
    this.shooterMoveSpeed = 85 + Math.min(35, level * 4); // 85..120
    this.shooterProjectileSpeed = 240 + Math.min(120, level * 8); // 240..360

    const minCd = 1150 - level * 40;
    const maxCd = 1900 - level * 60;
    this.shooterMinCooldown = Math.max(700, Math.floor(minCd));
    this.shooterMaxCooldown = Math.max(this.shooterMinCooldown + 200, Math.floor(maxCd));

    // Shelter damage pacing: keeps early game gentler
    this.shelterDamageInterval = Math.max(450, 650 - level * 20);
  }

  // Keep active enemy population near the cap
  maintainSpawns() {
    if (!this.enemies || this.isGameOver || this.isChoosingUpgrade) return;
    const now = this.time.now;
    if ((this.nextAllowedSpawnAt || 0) > now) return;
    const cs = this.enemies.getChildren ? this.enemies.getChildren() : [];
    let activeCount = 0;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c && c.active) activeCount++;
    }
    const cap = this.maxActiveEnemies != null ? this.maxActiveEnemies : 8;
    const need = Math.max(0, cap - activeCount);
    for (let i = 0; i < need; i++) this.spawnEnemy();
  }

  // Weighted enemy selection that evolves with kills and respects wasp caps
  chooseEnemyType(waspCount = 0, spiderCount = 0) {
    const k = this.enemiesDefeated || 0;
    let weights;
    if (k < 5) {
      weights = { enemy_fly: 3, enemy_beetle: 0, enemy_caterpillar: 0, enemy_wasp: 0 };
    } else if (k < 10) {
      weights = { enemy_fly: 3, enemy_beetle: 1, enemy_caterpillar: 0, enemy_wasp: 0 };
    } else if (k < 16) {
      weights = { enemy_fly: 3, enemy_beetle: 2, enemy_caterpillar: 1, enemy_wasp: 0 };
    } else if (k < 24) {
      weights = { enemy_fly: 2, enemy_beetle: 2, enemy_caterpillar: 1, enemy_wasp: 1 };
    } else if (k < 34) {
      weights = { enemy_fly: 2, enemy_beetle: 3, enemy_caterpillar: 2, enemy_wasp: 2 };
    } else {
      weights = { enemy_fly: 2, enemy_beetle: 3, enemy_caterpillar: 3, enemy_wasp: 3 };
    }

    const canSpawnWasp = this.waspsUnlocked && waspCount < (this.maxActiveWasps || 0);
    if (!canSpawnWasp) weights.enemy_wasp = 0;

    // Add ant weights (fast but weak)
    if (k < 5) {
      weights.enemy_ant = 1;
    } else if (k < 10) {
      weights.enemy_ant = 2;
    } else if (k < 16) {
      weights.enemy_ant = 3;
    } else if (k < 24) {
      weights.enemy_ant = 3;
    } else if (k < 34) {
      weights.enemy_ant = 3;
    } else {
      weights.enemy_ant = 3;
    }
    // Add snake weights (moderate-speed chaser that stuns)
    const snakeWeight = (k < 5) ? 0 : (k < 10) ? 1 : (k < 16) ? 2 : (k < 24) ? 2 : 3;
    weights.enemy_snake = (weights.enemy_snake || 0) + snakeWeight;
    // Add spider weights (random wanderers that lay webs)
    const spiderWeight = (k < 5) ? 1 : (k < 16) ? 2 : 3;
    weights.enemy_spider = (weights.enemy_spider || 0) + spiderWeight;

    const canSpawnSpider = spiderCount < (this.maxActiveSpiders || 2);
    if (!canSpawnSpider) weights.enemy_spider = 0;

    const bag = [];
    for (const [key, w] of Object.entries(weights)) {
      for (let i = 0; i < w; i++) bag.push(key);
    }
    if (bag.length === 0) return 'enemy_fly';
    const idx = Phaser.Math.Between(0, bag.length - 1);
    return bag[idx];
  }
  // Boss AI: super slow tank that targets the shelter only
  updateBossAI(enemy, now) {
    if (!enemy || !enemy.body || !this.shelter) return;

    const epos = enemy.getCenter();
    const sx = this.shelter.x;
    const sy = this.shelter.y;
    const dir = new Phaser.Math.Vector2(sx - epos.x, sy - epos.y);
    const dist = dir.length();
    if (dist > 0.0001) dir.normalize();

    const sp = enemy.getData('speed') || (this.bossSpeed || 16);
    enemy.setVelocity(dir.x * sp, dir.y * sp);
    enemy.setRotation(Math.atan2(dir.y, dir.x) + Math.PI);

    // Visuals: keep aura and HP bar aligned
    const aura = enemy.getData && enemy.getData('aura');
    if (aura && aura.setPosition) aura.setPosition(enemy.x, enemy.y);
    this.drawBossHpBar(enemy);
  }

  // Draw mini health bar above a boss enemy
  drawBossHpBar(enemy) {
    const gfx = enemy.getData && enemy.getData('hpGfx');
    if (!gfx) return;

    const hp = Math.max(0, enemy.getData('hp') != null ? enemy.getData('hp') : 0);
    const maxHp = Math.max(1, enemy.getData('maxHp') != null ? enemy.getData('maxHp') : hp);
    const pct = Phaser.Math.Clamp(hp / maxHp, 0, 1);

    const bw = this.bossBarWidth != null ? this.bossBarWidth : 38;
    const bh = this.bossBarHeight != null ? this.bossBarHeight : 6;

    const x = Math.floor(enemy.x - bw / 2);
    const yOffset = (enemy.displayHeight ? enemy.displayHeight * 0.6 : 36) + 10;
    const y = Math.floor(enemy.y - yOffset);

    gfx.clear();
    // Border/backdrop
    gfx.fillStyle(0x000000, 0.5);
    gfx.fillRoundedRect(x - 2, y - 2, bw + 4, bh + 4, 3);
    // Background
    gfx.fillStyle(0x10212b, 0.95);
    gfx.fillRoundedRect(x, y, bw, bh, 3);
    // Fill
    const fillColor = pct > 0.66 ? 0x2ecc71 : (pct > 0.33 ? 0xf39c12 : 0xe74c3c);
    const fillW = Math.max(0, Math.floor(bw * pct));
    if (fillW > 0) {
      gfx.fillStyle(fillColor, 1);
      gfx.fillRoundedRect(x, y, fillW, bh, 3);
      // Shine
      gfx.fillStyle(0xffffff, 0.18);
      gfx.fillRoundedRect(x + 2, y + 1, Math.max(0, fillW - 4), Math.max(1, Math.floor(bh * 0.35)), 2);
    }
    gfx.setDepth(12);
  }

  // Spawn the boss at a random corner, excluding the shelter's corner
  spawnBoss() {
    if (this.isGameOver || !this.enemies || !this.shelter) return null;

    // Guard: only one boss at a time
    const kids = this.enemies.getChildren ? this.enemies.getChildren() : [];
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      if (k && k.active && k.getData && k.getData('type') === 'enemy_boss') {
        try { console.info('[Boss] spawn skipped; already active'); } catch (e) {}
        return null;
      }
    }

    const margin = this.bossCornerMargin != null ? this.bossCornerMargin : 40;
    const corners = [
      { x: margin, y: margin, name: 'tl' },
      { x: this.worldWidth - margin, y: margin, name: 'tr' },
      { x: margin, y: this.worldHeight - margin, name: 'bl' },
      { x: this.worldWidth - margin, y: this.worldHeight - margin, name: 'br' }
    ];

    // Determine which corner is the shelter's corner (closest)
    const sx = this.shelter.x;
    const sy = this.shelter.y;
    let shelterCornerIdx = 0;
    let bestD2 = Number.POSITIVE_INFINITY;
    for (let i = 0; i < corners.length; i++) {
      const c = corners[i];
      const dx = c.x - sx;
      const dy = c.y - sy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; shelterCornerIdx = i; }
    }
    const pool = corners.filter((_, i) => i !== shelterCornerIdx);
    let choice = pool[Phaser.Math.Between(0, pool.length - 1)];
    // Keep boss from spawning too close to the player as well
    if (this.player && this.bossMinDistFromPlayer != null && pool.length > 0) {
      const pc = this.player.getCenter ? this.player.getCenter() : { x: this.player.x, y: this.player.y };
      const minD2 = this.bossMinDistFromPlayer * this.bossMinDistFromPlayer;
      const safe = pool.filter(c => {
        const dx = c.x - pc.x, dy = c.y - pc.y;
        return (dx*dx + dy*dy) >= minD2;
      });
      if (safe.length > 0) {
        choice = safe[Phaser.Math.Between(0, safe.length - 1)];
      } else {
        // Fallback: choose the farthest corner from the player among allowed corners
        let best = pool[0];
        let bestD2 = -1;
        for (const c of pool) {
          const dx = c.x - pc.x, dy = c.y - pc.y;
          const d2 = dx*dx + dy*dy;
          if (d2 > bestD2) { bestD2 = d2; best = c; }
        }
        choice = best;
      }
    }

    const enemy = this.enemies.create(choice.x, choice.y, 'enemy_boss');
    enemy.setData('type', 'enemy_boss');
    enemy.setDepth(4);
    enemy.setCollideWorldBounds(true);
    enemy.setBounce(1, 1);
    // Slightly larger boss for better presence
    enemy.setScale(1.15);

    if (enemy.body && enemy.body.setCircle) {
      // Enlarge physics body proportionally to visual scale to keep collisions aligned
      const base = Math.min(enemy.width, enemy.height);
      const r = Math.floor(base * 0.40 * 1.15);
      const ox = enemy.width / 2 - r;
      const oy = enemy.height / 2 - r;
      enemy.body.setCircle(r, ox, oy);
    }

    // Stats
    const maxHp = this.bossMaxHpBase != null ? this.bossMaxHpBase : 18;
    enemy.setData('hp', maxHp);
    enemy.setData('maxHp', maxHp);
    enemy.setData('contactDamage', 3); // damage to shelter when overlapping
    const sp = this.bossSpeed != null ? this.bossSpeed : 16;
    enemy.setData('speed', sp);

    // Aura visual to mark as boss
    const aura = this.add.image(enemy.x, enemy.y, 'upgrade_glow')
      .setTint(0xff66aa)
      .setAlpha(0.45)
      .setScale(0.7)
      .setDepth(enemy.depth - 0.1);
    this.tweens.add({
      targets: aura,
      alpha: { from: 0.35, to: 0.65 },
      scale: { from: 0.6, to: 0.9 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    enemy.setData('aura', aura);

    // HP bar graphics
    const hpGfx = this.add.graphics().setDepth(12);
    enemy.setData('hpGfx', hpGfx);

    // Initial heading toward shelter
    const epos = enemy.getCenter();
    const dir = new Phaser.Math.Vector2(sx - epos.x, sy - epos.y);
    const dist = dir.length();
    if (dist > 0.0001) dir.normalize();
    enemy.setVelocity(dir.x * sp, dir.y * sp);
    enemy.setRotation(Math.atan2(dir.y, dir.x) + Math.PI);

    this.drawBossHpBar(enemy);

    try {
      console.info('[Boss] spawned', { at: { x: Math.round(enemy.x), y: Math.round(enemy.y) }, hp: maxHp, speed: sp });
    } catch (e) {}

    return enemy;
  }
}
 
// Game configuration and bootstrapping
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#0a0a0a',
  audio: { disableWebAudio: false, noAudio: false },
  scene: [GameScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  }
};

new Phaser.Game(config);