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
    // Wasp spawning control
    this.waspsUnlocked = false;     // locked until first kill
    this.maxActiveWasps = 3;        // cap simultaneous wasps
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

    // Visual polish
    this.bg = null;
    this.shadow = null;
    this.hitParticles = null;
    this.hitEmitter = null;
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

    // Enemies: beetle
    {
      const eg = this.make.graphics({ x: 0, y: 0, add: false });
      // Legs
      eg.lineStyle(2, 0x3a0d0d, 1);
      eg.beginPath();
      eg.moveTo(10, 24); eg.lineTo(2, 30);
      eg.moveTo(16, 26); eg.lineTo(8, 32);
      eg.moveTo(28, 26); eg.lineTo(36, 32);
      eg.moveTo(22, 24); eg.lineTo(30, 30);
      eg.strokePath();
      // Shell
      eg.fillStyle(0x8c1d1d, 1);
      eg.fillEllipse(20, 16, 36, 24);
      // Highlight
      eg.fillStyle(0xb23333, 1);
      eg.fillEllipse(20, 12, 26, 14);
      // Head
      eg.fillStyle(0x4a1212, 1);
      eg.fillCircle(8, 16, 7);
      // Eyes
      eg.fillStyle(0xffffff, 1);
      eg.fillCircle(6, 14, 2);
      eg.fillCircle(10, 14, 2);
      eg.fillStyle(0x000000, 1);
      eg.fillCircle(6, 14, 1);
      eg.fillCircle(10, 14, 1);
      // Ridge
      eg.lineStyle(1, 0x3a0d0d, 0.6);
      eg.strokeEllipse(20, 16, 34, 22);
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
    this.lastDirection = new Phaser.Math.Vector2(1, 0);
    this.sprayUses = 0;

    // Clear transient refs
    this.tongue = null;
    this.tongueTip = null;
    this.upgradeUI = [];

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
    for (let i = 0; i < 8; i++) {
      this.spawnEnemy();
    }
    
    // Projectiles (enemy shots)
    this.projectiles = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.player, this.projectiles, this.onPlayerProjectileOverlap, null, this);
    
    // Hearts
    this.hearts = this.physics.add.group({ allowGravity: false, immovable: true });
    this.physics.add.overlap(this.player, this.hearts, this.onPlayerHeartOverlap, null, this);
    
    // Armor pickups
    this.armors = this.physics.add.group({ allowGravity: false, immovable: true });
    this.physics.add.overlap(this.player, this.armors, this.onPlayerArmorOverlap, null, this);

    // Spray can pickups
    this.sprayCans = this.physics.add.group({ allowGravity: false, immovable: true });
    this.physics.add.overlap(this.player, this.sprayCans, this.onPlayerSprayOverlap, null, this);
    
    // Text UI
    this.killsText = this.add.text(8, 8, 'Kills: 0', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#eaffea'
    }).setDepth(20);
    this.killsText.setStroke('#000000', 3);
    this.killsText.setShadow(0, 2, '#000000', 2, true, true);

    // Health UI
    this.healthGfx = this.add.graphics().setDepth(20);
    this.healthText = this.add.text(8, 56, 'HP: ' + this.health + '/' + this.maxHealth, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff'
    }).setDepth(20);
    this.healthText.setStroke('#000000', 3);
    this.healthText.setShadow(0, 2, '#000000', 2, true, true);
    this.updateHealthUI();

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
   
    // Movement
    const speed = this.isDead ? 0 : this.speed;
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
    
    // Invulnerability blink
    const inv = now < this.invulnUntil;
    this.player.setAlpha(inv ? 0.6 : 1);
    if (this.armorOverlay) {
      this.armorOverlay.setAlpha(inv ? 0.55 : (this.isDead ? 0.25 : 0.7));
    }
    
    // Attack input (space)
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && !this.isChoosingUpgrade && !this.isDead) {
      if (now - this.lastAttackTime >= this.attackCooldown) {
        this.lastAttackTime = now;
        if (this.sprayUses > 0) {
          this.performSprayAttack();
        } else {
          this.performTongueAttack();
        }
      }
    }

    // Enemy AI (ranged behaviors)
    if (this.enemies && !this.isDead && !this.isChoosingUpgrade) {
      const ecs = this.enemies.getChildren();
      for (let i = 0; i < ecs.length; i++) {
        const e = ecs[i];
        if (!e || !e.active) continue;
        if (e.getData('type') === 'enemy_wasp') {
          this.updateWaspAI(e, now);
        }
      }
    }
  }

  performTongueAttack() {
    console.debug('[Audio] performTongueAttack', { sfxOn: this.sfxOn, ctxState: this.audioCtx && this.audioCtx.state });
    // SFX
    if (this.sfxOn) this.sfxTongue();
    // Draw attack with layered color for depth
    const start = this.player.getCenter();
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

    // Kill enemies within cone
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
        // Instant kill
        this.hitEmitter.explode(Phaser.Math.Between(8, 12), e.x, e.y);
        const killed = this.damageEnemy(e, 9999);
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

    enemy.destroy();
    this.trySpawnHeart(hx, hy);
    this.trySpawnArmor(hx, hy);
    this.trySpawnSprayCan(hx, hy);

    this.enemiesDefeated++;
    if (this.killsText) this.killsText.setText('Kills: ' + this.enemiesDefeated);
    // Unlock ranged enemies (wasps) after the very first kill
    if (this.enemiesDefeated === 1) {
      this.waspsUnlocked = true;
    }

    // Respawn after a short delay to keep pressure
    this.time.delayedCall(600, () => this.spawnEnemy());

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
    enemy.setRotation(Math.atan2(dir.y, dir.x));

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
    const margin = 40;
    const x = Phaser.Math.Between(margin, this.worldWidth - margin);
    const y = Phaser.Math.Between(margin, this.worldHeight - margin);
    // Determine allowed enemy types based on wasp unlock and cap
    let waspCount = 0;
    if (this.enemies && this.enemies.getChildren) {
      const cs = this.enemies.getChildren();
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i];
        if (c && c.active && c.getData && c.getData('type') === 'enemy_wasp') waspCount++;
      }
    }
    const canSpawnWasp = this.waspsUnlocked && waspCount < this.maxActiveWasps;
    const pool = canSpawnWasp
      ? ['enemy_beetle', 'enemy_fly', 'enemy_wasp', 'enemy_caterpillar']
      : ['enemy_beetle', 'enemy_fly', 'enemy_caterpillar'];
    const type = pool[Phaser.Math.Between(0, pool.length - 1)];
    const enemy = this.enemies.create(x, y, type);
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
    let contactDamage = 1;

    if (type === 'enemy_beetle') {
      contactDamage = 2;
      const sp = Phaser.Math.Between(40, 80);
      const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
      enemy.setVelocity(Math.cos(ang) * sp, Math.sin(ang) * sp);
    } else if (type === 'enemy_fly') {
      const sp = Phaser.Math.Between(70, 120);
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
      hp = 3; // bigger, slower, tougher
      contactDamage = 2;
      const sp = Phaser.Math.Between(15, 35);
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
    if (this.projectiles && this.projectiles.contains(go)) {
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
  
  // Health bar and text
  updateHealthUI() {
    if (!this.healthGfx) return;
    const x = 8;
    const y = 38;
    const w = 140;
    const h = 14;
    const pct = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);

    this.healthGfx.clear();
    // Border/Backdrop
    this.healthGfx.fillStyle(0x000000, 0.4);
    this.healthGfx.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 8);
    // Background
    this.healthGfx.fillStyle(0x2b0d0d, 0.95);
    this.healthGfx.fillRoundedRect(x, y, w, h, 6);
    // Fill
    const fillColor = pct > 0.5 ? 0x27ae60 : (pct > 0.25 ? 0xf39c12 : 0xe74c3c);
    this.healthGfx.fillStyle(fillColor, 1);
    this.healthGfx.fillRoundedRect(x, y, Math.max(0, Math.floor(w * pct)), h, 6);
    // Shine
    if (pct > 0) {
      this.healthGfx.fillStyle(0xffffff, 0.15);
      this.healthGfx.fillRoundedRect(x + 4, y + 3, Math.max(0, Math.floor((w - 8) * pct)), 4, 3);
    }

    if (this.healthText) {
      this.healthText.setText('HP: ' + this.health + '/' + this.maxHealth);
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
  
  // Enemy contact damage
  onPlayerEnemyOverlap(player, enemy) {
    if (!enemy || !enemy.active || this.isDead) return;

    const dmg = enemy.getData('contactDamage') != null
      ? enemy.getData('contactDamage')
      : (enemy.getData('type') === 'enemy_beetle' ? 2 : 1);
    const now = this.time.now;
    try {
      console.info('[HIT] enemy overlap', {
        type: enemy.getData && enemy.getData('type'),
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