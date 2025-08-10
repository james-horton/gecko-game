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
    this.tongueRange = 100;
    this.attackCooldown = 250;
    this.lastAttackTime = 0;
    this.isAttacking = false;
    this.tongue = null;
    this.speed = 200;
    this.upgradeUI = [];
    this.worldWidth = 800;
    this.worldHeight = 600;
  }

  preload() {
    // Generate placeholder textures to run without external assets
    // Gecko
    const g1 = this.make.graphics({ x: 0, y: 0, add: false });
    g1.fillStyle(0x00ff66, 1);
    g1.fillRoundedRect(0, 0, 60, 34, 16);
    g1.fillStyle(0x00cc55, 1);
    g1.fillCircle(12, 17, 7);
    g1.generateTexture('gecko', 60, 34);
    g1.destroy();

    // Sunglasses
    const sg = this.make.graphics({ x: 0, y: 0, add: false });
    sg.fillStyle(0x000000, 1);
    sg.fillRoundedRect(0, 0, 34, 10, 5);
    sg.fillStyle(0x333333, 1);
    sg.fillRect(16, 2, 2, 6);
    sg.generateTexture('sunglasses', 34, 10);
    sg.destroy();

    // Enemy
    const eg = this.make.graphics({ x: 0, y: 0, add: false });
    eg.fillStyle(0xff4444, 1);
    eg.fillCircle(16, 16, 16);
    eg.lineStyle(2, 0x770000, 1);
    eg.strokeCircle(16, 16, 16);
    eg.generateTexture('enemy', 32, 32);
    eg.destroy();

    // Upgrade panel background
    const bg = this.make.graphics({ x: 0, y: 0, add: false });
    bg.fillStyle(0x222222, 0.95);
    bg.fillRoundedRect(0, 0, 520, 360, 12);
    bg.lineStyle(2, 0xffffff, 0.2);
    bg.strokeRoundedRect(1, 1, 518, 358, 12);
    bg.generateTexture('upgrade_bg', 520, 360);
    bg.destroy();
  }

  create() {
    // World bounds
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);

    // Player
    this.player = this.physics.add.sprite(this.worldWidth / 2, this.worldHeight / 2, 'gecko');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(5);

    // Sunglasses follow sprite (not a physics child)
    this.sunglasses = this.add.sprite(this.player.x, this.player.y - 8, 'sunglasses');
    this.sunglasses.setDepth(10);

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Tongue visualization
    this.tongue = this.add.graphics();
    this.tongue.setDepth(9);

    // Enemies
    this.enemies = this.physics.add.group();
    for (let i = 0; i < 6; i++) {
      this.spawnEnemy();
    }

    // Simple text UI
    this.killsText = this.add.text(8, 8, 'Kills: 0', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' }).setDepth(20);
  }

  update() {
    if (!this.player) return;

    // Movement
    const speed = this.speed;
    let vx = 0;
    let vy = 0;
    if (this.cursors.left.isDown) vx -= speed;
    if (this.cursors.right.isDown) vx += speed;
    if (this.cursors.up.isDown) vy -= speed;
    if (this.cursors.down.isDown) vy += speed;
    this.player.setVelocity(vx, vy);

    // Keep sunglasses aligned
    this.sunglasses.setPosition(this.player.x + (this.lastDirection.x * 4), this.player.y - 8 + (this.lastDirection.y * 2));

    // Update last facing direction
    if (vx !== 0 || vy !== 0) {
      this.lastDirection.set(vx, vy).normalize();
    }

    // Attack input (space)
    const now = this.time.now;
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && !this.isChoosingUpgrade) {
      if (now - this.lastAttackTime >= this.attackCooldown) {
        this.lastAttackTime = now;
        this.performTongueAttack();
      }
    }
  }

  performTongueAttack() {
    // Draw attack
    const start = this.player.getCenter();
    const len = this.tongueRange;
    const end = new Phaser.Math.Vector2(start.x + this.lastDirection.x * len, start.y + this.lastDirection.y * len);

    this.tongue.clear();
    this.tongue.lineStyle(8, 0xff69b4, 1);
    this.tongue.beginPath();
    this.tongue.moveTo(start.x, start.y);
    this.tongue.lineTo(end.x, end.y);
    this.tongue.strokePath();

    // Damage enemies along line
    const line = new Phaser.Geom.Line(start.x, start.y, end.x, end.y);
    const enemies = this.enemies.getChildren();
    let killsThisAttack = 0;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (!e.active) continue;
      if (Phaser.Geom.Intersects.LineToRectangle(line, e.getBounds())) {
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
    this.time.delayedCall(150, () => {
      this.tongue.clear();
    });
  }

  spawnEnemy() {
    const margin = 40;
    const x = Phaser.Math.Between(margin, this.worldWidth - margin);
    const y = Phaser.Math.Between(margin, this.worldHeight - margin);
    const enemy = this.enemies.create(x, y, 'enemy');
    enemy.setCollideWorldBounds(true);
    // Give a small random drift
    const sp = Phaser.Math.Between(40, 80);
    const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
    enemy.setVelocity(Math.cos(ang) * sp, Math.sin(ang) * sp);
  }

  showUpgradeSelection() {
    this.isChoosingUpgrade = true;
    this.physics.pause();

    // Dark overlay and panel
    const overlay = this.add.rectangle(this.worldWidth / 2, this.worldHeight / 2, this.worldWidth, this.worldHeight, 0x000000, 0.7).setDepth(30);
    const panel = this.add.image(this.worldWidth / 2, this.worldHeight / 2, 'upgrade_bg').setDepth(31);
    const title = this.add.text(this.worldWidth / 2, this.worldHeight / 2 - 130, 'Choose an Upgrade', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(32);

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
}

// Game configuration and bootstrapping
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#0a0a0a',
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