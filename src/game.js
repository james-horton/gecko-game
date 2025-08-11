class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    // Core state
    this.player = null;
    this.sunglasses = null;
    this.cursors = null;
    this.spaceKey = null;
    this.lastDirection = new Phaser.Math.Vector2(1, 0);
    this.enemies = null;
    this.enemiesDefeated = 0;
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

    // Player drop shadow
    {
      const sh = this.make.graphics({ x: 0, y: 0, add: false });
      sh.fillStyle(0x000000, 1);
      sh.fillEllipse(32, 16, 64, 24);
      sh.generateTexture('shadow_oval', 64, 32);
      sh.destroy();
    }

    // Detailed Gecko sprite
    {
      const g1 = this.make.graphics({ x: 0, y: 0, add: false });
      // Tail
      g1.fillStyle(0x26a269, 1);
      g1.fillPoints([{ x: 14, y: 32 }, { x: 2, y: 24 }, { x: 2, y: 40 }], true);
      // Body
      g1.fillStyle(0x2ec27e, 1);
      g1.fillEllipse(48, 34, 72, 36);
      // Belly highlight
      g1.fillStyle(0x9ae6b9, 1);
      g1.fillEllipse(42, 38, 42, 20);
      // Head
      g1.fillStyle(0x2ec27e, 1);
      g1.fillEllipse(76, 28, 28, 22);
      // Spots
      g1.fillStyle(0x238c6a, 1);
      g1.fillCircle(52, 24, 4);
      g1.fillCircle(40, 30, 3);
      g1.fillCircle(60, 38, 3);
      g1.fillCircle(68, 22, 3);
      // Legs
      g1.fillStyle(0x207a5c, 1);
      g1.fillEllipse(36, 52, 16, 6);
      g1.fillEllipse(24, 48, 16, 6);
      g1.fillEllipse(56, 52, 16, 6);
      g1.fillEllipse(68, 48, 16, 6);
      // Eye
      g1.fillStyle(0xffffff, 1);
      g1.fillCircle(86, 24, 5);
      g1.fillStyle(0x000000, 1);
      g1.fillCircle(88, 24, 2);
      g1.fillStyle(0xffffff, 1);
      g1.fillCircle(89, 23, 1);
      // Outline
      g1.lineStyle(2, 0x0e3b2e, 0.6);
      g1.strokeEllipse(48, 34, 72, 36);
      g1.strokeEllipse(76, 28, 28, 22);
      g1.generateTexture('gecko', 96, 64);
      g1.destroy();
    }

    // Sunglasses with reflection
    {
      const sg = this.make.graphics({ x: 0, y: 0, add: false });
      sg.fillStyle(0x0b0b0b, 1);
      sg.fillRoundedRect(0, 0, 22, 12, 4);
      sg.fillRoundedRect(24, 0, 22, 12, 4);
      sg.fillStyle(0x161616, 1);
      sg.fillRect(22, 4, 2, 4);
      sg.lineStyle(2, 0x1a1a1a, 1);
      sg.strokeRoundedRect(0, 0, 22, 12, 4);
      sg.strokeRoundedRect(24, 0, 22, 12, 4);
      sg.fillStyle(0xffffff, 0.15);
      sg.fillTriangle(2, 2, 14, 2, 2, 10);
      sg.fillTriangle(26, 2, 38, 2, 26, 10);
      sg.generateTexture('sunglasses', 46, 12);
      sg.destroy();
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
    this.enemiesDefeated = 0;
    this.isChoosingUpgrade = false;
    this.upgradeChoices = [];
    this.speed = 220;
    this.tongueRange = 120;
    this.attackCooldown = 220;
    this.lastAttackTime = 0;
    this.lastDirection = new Phaser.Math.Vector2(1, 0);

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

    // Player
    this.player = this.physics.add.sprite(this.worldWidth / 2, this.worldHeight / 2, 'gecko');
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

    // Sunglasses follow sprite (not a physics child)
    this.sunglasses = this.add.sprite(this.player.x, this.player.y - 6, 'sunglasses');
    this.sunglasses.setDepth(10);

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Tongue visualization
    this.tongue = this.add.graphics();
    this.tongue.setDepth(9);
    this.tongueTip = this.add.image(0, 0, 'tongue_tip').setVisible(false).setDepth(10);

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
  
    // Keep shadow and sunglasses aligned
    const headOffset = new Phaser.Math.Vector2(18, -6).rotate(angle);
    this.sunglasses.setPosition(this.player.x + headOffset.x, this.player.y + headOffset.y);
    this.sunglasses.setRotation(angle);
    this.shadow.setPosition(this.player.x, this.player.y + 18);

    // Invulnerability blink
    const inv = now < this.invulnUntil;
    this.player.setAlpha(inv ? 0.6 : 1);
    this.sunglasses.setAlpha(inv ? 0.7 : (this.isDead ? 0.3 : 1));
  
    // Attack input (space)
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && !this.isChoosingUpgrade && !this.isDead) {
      if (now - this.lastAttackTime >= this.attackCooldown) {
        this.lastAttackTime = now;
        this.performTongueAttack();
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

      const ec = e.getCenter();
      const r = e.body ? Math.min(e.body.width, e.body.height) * 0.5 : Math.min(e.displayWidth, e.displayHeight) * this.enemyBodyRadiusFactor;
      if (Phaser.Geom.Intersects.LineToCircle(line, new Phaser.Geom.Circle(ec.x, ec.y, r))) {
        // FX
        this.hitEmitter.explode(Phaser.Math.Between(8, 12), e.x, e.y);
        this.cameras.main.shake(100, 0.004);
        if (this.sfxOn) this.sfxHit();
        const pop = this.add.image(e.x, e.y, e.texture.key).setDepth((e.depth || 4) + 1);
        pop.setScale(e.scaleX || 1, e.scaleY || 1);
        this.tweens.add({
          targets: pop,
          y: e.y - 6,
          scale: (e.scaleX || 1) * 1.2,
          alpha: 0,
          duration: 200,
          ease: 'Quad.easeOut',
          onComplete: () => pop.destroy()
        });

        e.destroy();
        this.enemiesDefeated++;
        killsThisAttack++;
        this.killsText.setText('Kills: ' + this.enemiesDefeated);
        // Respawn after a short delay to keep pressure
        this.time.delayedCall(600, () => this.spawnEnemy());
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

  spawnEnemy() {
    const margin = 40;
    const x = Phaser.Math.Between(margin, this.worldWidth - margin);
    const y = Phaser.Math.Between(margin, this.worldHeight - margin);
    const type = Phaser.Math.Between(0, 1) === 0 ? 'enemy_beetle' : 'enemy_fly';
    const enemy = this.enemies.create(x, y, type);
    enemy.setData('type', type);
    enemy.setCollideWorldBounds(true);
    enemy.setBounce(1, 1);
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
    if (type === 'enemy_beetle') {
      const sp = Phaser.Math.Between(40, 80);
      const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
      enemy.setVelocity(Math.cos(ang) * sp, Math.sin(ang) * sp);
    } else {
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
    }
  }

  // World-bounds collision logging for enemies
  onWorldBoundsCollision(body, up, down, left, right) {
    if (!body || !body.gameObject) return;
    const go = body.gameObject;

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
      const btn = this.add.text(this.worldWidth / 2, y, text, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#333333',
        padding: { x: 18, y: 12 },
        align: 'center'
      }).setOrigin(0.5).setDepth(32).setInteractive({ useHandCursor: true });
      btn.setStroke('#000000', 2);
      btn.setShadow(0, 2, '#000000', 2, true, true);
      btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#555555' }));
      btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#333333' }));
      btn.on('pointerdown', onClick);
      return btn;
    };

    const spacing = 80;
    const startY = this.worldHeight / 2 - spacing;
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


  // Enemy contact damage
  onPlayerEnemyOverlap(player, enemy) {
    if (!enemy || !enemy.active || this.isDead) return;


    const dmg = enemy.getData('type') === 'enemy_beetle' ? 2 : 1;
    this.takeDamage(dmg, enemy);
  }

  takeDamage(amount = 1, source = null) {
    if (this.isDead) return;
    const now = this.time.now;
    if (now < this.invulnUntil) return;

    this.health = Math.max(0, this.health - amount);
    this.invulnUntil = now + this.invulnDuration;

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

    // Visual state
    this.player.setTint(0x444444);
    this.sunglasses.setAlpha(0.3);

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