/**
 * GameEngine.js — Core game loop, state machine, and level management
 * 
 * This is the main coordinator that ties together:
 * - Three.js scene, camera, renderer
 * - Player, enemies, weapons, levels
 * - Game state machine: MENU → PLAYING → PAUSED → GAME_OVER → LEVEL_COMPLETE → VICTORY
 * - Wave-based enemy spawning
 * - Score tracking
 * 
 * The engine exposes callbacks that React components listen to for UI updates.
 */

import * as THREE from 'three';
import { Player } from './Player.js';
import { WeaponsManager } from './Weapons.js';
import { Enemy, spawnWaveEnemies } from './Enemy.js';
import { createLevel, LEVEL_INFO } from './Levels.js';
import { createParticleExplosion, updateParticles, getCachedMaterial } from './Utils.js';

// ============================================================
// GAME STATES
// ============================================================

export const GAME_STATES = {
  MENU: 'menu',
  LOADING: 'loading',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'gameOver',
  LEVEL_COMPLETE: 'levelComplete',
  VICTORY: 'victory',
};

// Pre-allocated Vector3 helper to avoid Garbage Collection allocations in render loops
const _tempPlayerChestPos = new THREE.Vector3();

// Shared geometry for enemy projectiles to prevent per-shot memory allocations
const _sharedEnemyProjGeo = new THREE.SphereGeometry(0.12, 6, 6);

// ============================================================
// GAME ENGINE CLASS
// ============================================================

export class GameEngine {
  /**
   * @param {HTMLCanvasElement} canvas - The canvas element to render to
   * @param {Function} onStateChange - Callback when game state changes
   */
  constructor(canvas, onStateChange) {
    this.canvas = canvas;
    this.onStateChange = onStateChange || (() => {});

    // Game state
    this.state = GAME_STATES.MENU;
    this.characterType = 'gojo';
    this.currentLevelIndex = 0;
    this.currentWave = 0;
    this.totalWaves = 5;
    this.score = 0;
    this.kills = 0;
    this.waveComplete = false; // Flag to prevent double wave spawning
    this.isInfinity = false;
    this.survivalTime = 0;

    // Collectible orbs (spawned on enemy death)
    this.orbs = [];

    // Three.js core
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = null;

    // Game objects
    this.player = null;
    this.weapons = null;
    this.level = null;
    this.enemies = [];
    this.enemyProjectiles = []; // Projectiles fired by enemies
    this.particles = [];
    this.enemyProjectileMeshes = [];

    // Animation frame ID (for cleanup)
    this.animationFrameId = null;

    // HUD data (passed to React via callback)
    this.hudData = {
      health: 100,
      maxHealth: 100,
      score: 0,
      wave: 1,
      totalWaves: 5,
      enemyCount: 0,
      cameraMode: 'FPS',
      cooldownPercent: 0,
      levelName: '',
      damageFlash: false,
      weaponName: '',
      weaponTier: 0,
      // Wave announcement (shown briefly between waves)
      waveAnnouncement: null, // { wave, weaponName } or null
    };

    // Performance: throttle React state updates
    this._hudFrameCounter = 0;
    this._hudUpdateInterval = 3; // Only push state to React every 3rd frame

    // Initialize Three.js
    this._initThreeJS();
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  /** Set up Three.js scene, camera, renderer, and basic lighting */
  _initThreeJS() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a15);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    this.camera.position.set(0, 5, 10);
    this.scene.add(this.camera); // Add camera to scene so camera-attached children (like the gun) render

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Manual delta time (avoids deprecated THREE.Clock)
    this._lastFrameTime = performance.now();

    // Handle window resize
    this._onResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._onResize);

    // Handle V key for camera toggle, Escape for pause
    this._onKeyPress = this._handleKeyPress.bind(this);
    document.addEventListener('keydown', this._onKeyPress);

    // Prevent context menu on right click
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Start render loop (runs even in menu for background rendering)
    this._startRenderLoop();
  }

  /** Handle window resize */
  _handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /** Handle global key presses */
  _handleKeyPress(e) {
    // Camera toggle KeyV is disabled to keep view locked to FPS
    if (e.code === 'Escape') {
      if (this.state === GAME_STATES.PLAYING) {
        this.pause();
      } else if (this.state === GAME_STATES.PAUSED) {
        this.resume();
      }
    }
  }

  // ============================================================
  // GAME STATE MANAGEMENT
  // ============================================================

  /**
   * Called when a character is selected on the start screen.
   * Initializes the game and loads the first level.
   * 
   * @param {string} character - 'gojo' or 'sukuna'
   */
  selectCharacter(character, isInfinity = false) {
    this.characterType = character;
    this.score = 0;
    this.kills = 0;
    this.isInfinity = isInfinity;
    this.survivalTime = 0;
    if (isInfinity) {
      this.currentLevelIndex = 3; // Index 3 is Unlimited Void (Infinity Level)
      this.startLevel(3);
    } else {
      this.currentLevelIndex = 0;
      this.startLevel(0);
    }
  }

  /**
   * Load and start a specific level.
   * @param {number} levelIndex - 0, 1, or 2
   */
  startLevel(levelIndex) {
    this.state = GAME_STATES.LOADING;
    this._emitStateChange();

    // Clean up previous level
    this._cleanupLevel();

    this.currentLevelIndex = levelIndex;
    const levelInfo = LEVEL_INFO[levelIndex];
    this.totalWaves = levelInfo.waves;
    this.currentWave = 0;

    // Create and load the new level
    this.level = createLevel(levelIndex);
    this.level.load(this.scene);

    // Create player
    this.player = new Player(this.scene, this.camera, this.characterType);
    this.player.reset(this.level.getPlayerSpawn());

    // Create weapons manager
    this.weapons = new WeaponsManager(this.scene);
    this.weapons.setCharacterType(this.characterType);
    this.weapons.setWeaponTier(0); // Start with tier 0 weapon

    // Update HUD
    this.hudData.levelName = levelInfo.name;
    this.hudData.wave = 1;
    this.hudData.totalWaves = this.totalWaves;
    this.hudData.health = this.player.health;
    this.hudData.maxHealth = this.player.maxHealth;
    this.hudData.score = this.score;
    this.hudData.enemyCount = 0;
    this.hudData.weaponName = this.weapons.getWeaponName();
    this.hudData.weaponTier = 0;
    this.hudData.waveAnnouncement = null;
    this.hudData.survivalTime = 0;

    // Short loading delay for effect
    setTimeout(() => {
      this.state = GAME_STATES.PLAYING;
      this._emitStateChange();

      // Request pointer lock (desktop only)
      const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (!isMobile && this.canvas.requestPointerLock) {
        this.canvas.requestPointerLock();
      }

      // Spawn first wave with announcement
      this._spawnNextWave();
    }, 1500);
  }

  /** Pause the game */
  pause() {
    if (this.state !== GAME_STATES.PLAYING) return;
    this.state = GAME_STATES.PAUSED;
    document.exitPointerLock();
    if (this.player) this.player.resetKeys();
    this._emitStateChange();
  }

  /** Resume from pause */
  resume() {
    if (this.state !== GAME_STATES.PAUSED) return;
    this.state = GAME_STATES.PLAYING;
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isMobile && this.canvas.requestPointerLock) {
      this.canvas.requestPointerLock();
    }
    this._emitStateChange();
  }

  /** Handle game over */
  gameOver() {
    this.state = GAME_STATES.GAME_OVER;
    document.exitPointerLock();
    if (this.player) this.player.resetKeys();
    this.hudData.finalScore = this.score;
    this.hudData.finalKills = this.kills;
    this.hudData.finalLevel = this.currentLevelIndex + 1;
    this.hudData.finalSurvivalTime = this.isInfinity ? this.survivalTime : undefined;
    this._emitStateChange();
  }

  /** Restart the entire game */
  restart() {
    this._cleanupLevel();
    this.score = 0;
    this.kills = 0;
    this.currentLevelIndex = 0;
    this.state = GAME_STATES.MENU;
    this._emitStateChange();
  }

  /** Advance to next level */
  nextLevel() {
    this.currentLevelIndex++;
    if (this.currentLevelIndex >= 3) {
      // Won all levels!
      this.state = GAME_STATES.VICTORY;
      this.hudData.victoryScore = this.score;
      this.hudData.victoryKills = this.kills;
      document.exitPointerLock();
      this._emitStateChange();
    } else {
      this.startLevel(this.currentLevelIndex);
    }
  }

  /** Quit to main menu */
  quitToMenu() {
    this._cleanupLevel();
    this.state = GAME_STATES.MENU;
    document.exitPointerLock();
    this._emitStateChange();
  }

  // ============================================================
  // GAME LOOP
  // ============================================================

  /** Start the main render/update loop */
  _startRenderLoop() {
    const loop = () => {
      this.animationFrameId = requestAnimationFrame(loop);

      // Manual delta calculation (replaces deprecated THREE.Clock)
      const now = performance.now();
      const delta = Math.min((now - this._lastFrameTime) / 1000, 0.05);
      this._lastFrameTime = now;

      if (this.state === GAME_STATES.PLAYING) {
        this._update(delta);
      }

      // Always render (even in menus, for background animation)
      if (this.level && this.state !== GAME_STATES.MENU) {
        this.level.update(delta, this.scene);
      }
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  /** Main game update — called every frame while PLAYING */
  _update(delta) {
    if (!this.player || !this.player.alive) return;

    if (this.isInfinity) {
      this.survivalTime += delta;
      this.hudData.survivalTime = Math.floor(this.survivalTime);
    }

    const obstacles = this.level ? this.level.getObstacles() : [];

    // Update player
    const bounds = this.level ? this.level.getBounds() : { min: -50, max: 50 };
    this.player.update(delta, this.weapons, bounds, obstacles);

    // Update weapons (move projectiles)
    this.weapons.update(delta);

    // Check player projectile hits on enemies
    const hits = this.weapons.checkCollisions(this.enemies);
    hits.forEach(hit => {
      const killed = hit.enemy.takeDamage(hit.damage);
      if (killed) {
        this.score += hit.enemy.scoreValue;
        this.kills++;
        // Spawn a health pickup orb at the enemy's death position
        this._spawnOrb(hit.enemy.getPosition());

        // Spawn a power-up with a 15% probability on enemy death
        if (Math.random() < 0.15) {
          this._spawnPowerUp(hit.enemy.getPosition());
        }
      }
    });

    // Update enemies
    const playerPos = this.player.getPosition();

    // Update and collect orbs
    this._updateOrbs(delta, playerPos);

    // Update and collect power-ups
    this._updatePowerUps(delta, playerPos);
    
    const newMinions = [];
    this.enemies.forEach(enemy => {
      if (!enemy.alive) return;
      enemy.update(delta, playerPos, obstacles);

      // Boss minion spawning logic during Boss Wave
      if (enemy.isBoss) {
        if (enemy.minionSpawnTimer === undefined) {
          enemy.minionSpawnTimer = 4.0; // Initial delay before first spawn
        }
        enemy.minionSpawnTimer -= delta;
        if (enemy.minionSpawnTimer <= 0) {
          enemy.minionSpawnTimer = 8.0; // Spawn new minions every 8 seconds
          
          const bossPos = enemy.getPosition();
          // Spawn 2 small, fast minion enemies
          for (let s = 0; s < 2; s++) {
            const spawnPos = bossPos.clone().add(new THREE.Vector3(
              (Math.random() - 0.5) * 6,
              0,
              (Math.random() - 0.5) * 6
            ));
            
            // Create a normal melee enemy
            const minion = new Enemy(this.scene, 'melee', spawnPos, this.currentLevelIndex + 1);
            
            // Customize to be a small and fast minion
            minion.mesh.scale.set(0.6, 0.6, 0.6); // 60% size
            minion.speed = minion.speed * 1.5;     // 50% faster
            minion.maxHP = Math.round(minion.maxHP * 0.4); // 40% health (fragile)
            minion.hp = minion.maxHP;
            minion.damage = Math.round(minion.damage * 0.6); // 60% standard damage
            
            // Customize visuals: tint materials reddish to mark as a minion
            minion.mesh.traverse(child => {
              if (child.isMesh && child.material) {
                child.material = child.material.clone();
                child.material.color?.setHex(0xff3355);
              }
            });
            
            newMinions.push(minion);
            
            // Spawn particle feedback
            const particles = createParticleExplosion(this.scene, spawnPos, 0xff3355, 6);
            this.particles.push(...particles);
          }
        }
      }

      // Check if enemy has an attack to execute
      const attack = enemy.consumeAttack();
      if (attack) {
        if (enemy.type === 'melee' || (enemy.isBoss && enemy.getPosition().distanceTo(playerPos) < 3)) {
          // Melee hit — check distance
          const dist = enemy.getPosition().distanceTo(playerPos);
          if (dist < enemy.attackRange + 0.5) {
            const died = this.player.takeDamage(enemy.damage);
            if (died) {
              this.gameOver();
              return;
            }
          }
        } else {
          // Ranged attack — create enemy projectile
          this._createEnemyProjectile(attack.position, attack.direction, attack.damage);
        }
      }
    });

    // Safely add newly spawned minions after iteration to avoid array mutation issues
    if (newMinions.length > 0) {
      this.enemies.push(...newMinions);
    }

    // Update enemy projectiles
    this._updateEnemyProjectiles(delta);

    // Remove dead enemies from list
    this.enemies = this.enemies.filter(e => e.alive);

    // Update particles
    this.particles = updateParticles(this.particles, delta, this.scene);

    // Check if wave is complete
    if (this.enemies.length === 0 && !this.waveComplete) {
      this.waveComplete = true; // Prevent double-triggering
      this._onWaveComplete();
    }

    // Update HUD data
    this.hudData.health = this.player.health;
    this.hudData.maxHealth = this.player.maxHealth;
    this.hudData.score = this.score;
    this.hudData.enemyCount = this.enemies.length;
    this.hudData.cooldownPercent = this.weapons.getSpecialCooldownPercent();
    this.hudData.damageFlash = this.player.isDamageFlashing();
    
    // Forward active weapon override name (Shotgun/Railgun) to HUD, or defaults
    this.hudData.weaponName = this.player.weaponOverride
      ? (this.player.weaponOverride.charAt(0).toUpperCase() + this.player.weaponOverride.slice(1))
      : this.weapons.getWeaponName();
    this.hudData.weaponTier = this.weapons.getWeaponTier();

    // Forward power-up countdowns to HUD
    this.hudData.speedPowerupTime = Math.ceil(this.player.speedPowerupTimer);
    this.hudData.damagePowerupTime = Math.ceil(this.player.damagePowerupTimer);
    this.hudData.weaponOverride = this.player.weaponOverride;
    this.hudData.weaponOverrideTime = Math.ceil(this.player.weaponOverrideTimer);

    // Throttle React state updates for performance (only every Nth frame)
    this._hudFrameCounter++;
    if (this._hudFrameCounter >= this._hudUpdateInterval || this.hudData.damageFlash || this.player.speedPowerupTimer > 0 || this.player.damagePowerupTimer > 0 || this.player.weaponOverrideTimer > 0) {
      this._hudFrameCounter = 0;
      this._emitStateChange();
    }
  }

  // ============================================================
  // WAVE MANAGEMENT
  // ============================================================

  /** Spawn the next wave of enemies */
  _spawnNextWave() {
    this.currentWave++;
    this.waveComplete = false;

    // Wave 5 is the boss wave in campaign, or every 5th wave in Infinity Mode
    const isBossWave = this.isInfinity 
      ? (this.currentWave % 5 === 0) 
      : (this.currentWave >= this.totalWaves);

    if (this.currentWave > this.totalWaves) {
      // All waves cleared — this shouldn't happen but safety check
      return;
    }

    const spawnPoints = this.level ? this.level.getSpawnPoints() : [];
    const levelNum = this.currentLevelIndex + 1;

    const newEnemies = spawnWaveEnemies(
      this.scene,
      this.currentWave,
      levelNum,
      spawnPoints,
      isBossWave
    );

    this.enemies.push(...newEnemies);

    // Upgrade weapon for this wave (tier = wave - 1, so wave 1 = tier 0, wave 2 = tier 1, etc.)
    const newTier = this.currentWave - 1;
    this.weapons.setWeaponTier(newTier);

    // Set wave announcement (will be shown as a popup in the UI)
    this.hudData.waveAnnouncement = {
      wave: this.currentWave,
      totalWaves: this.totalWaves,
      weaponName: this.weapons.getWeaponName(),
      weaponTier: newTier,
      isBossWave,
    };

    this.hudData.wave = this.currentWave;
    this.hudData.enemyCount = this.enemies.length;
    this._emitStateChange();

    // Clear announcement after 3 seconds
    setTimeout(() => {
      this.hudData.waveAnnouncement = null;
      this._emitStateChange();
    }, 3000);
  }

  /** Called when all enemies in current wave are defeated */
  _onWaveComplete() {
    if (this.currentWave < this.totalWaves) {
      // More waves to go — spawn next after a brief delay
      setTimeout(() => {
        if (this.state === GAME_STATES.PLAYING) {
          this._spawnNextWave();
        }
      }, 2500);
    } else {
      // All 5 waves cleared — level complete!
      this.state = GAME_STATES.LEVEL_COMPLETE;
      document.exitPointerLock();
      if (this.player) this.player.resetKeys();

      this.hudData.levelScore = this.score;
      this.hudData.clearMessage = LEVEL_INFO[this.currentLevelIndex]?.subtitle || 'Level cleared!';
      this._emitStateChange();
    }
  }

  // ============================================================
  // COLLECTIBLE HEALING CRYSTALS (Green health pickups)
  // ============================================================

  /** Spawn a glowing green health crystal at the given position */
  _spawnOrb(position) {
    // Scaling health value: 2 HP on wave 1, increasing by 2 per wave, capped at 10 HP max
    const healthVal = Math.min(10, this.currentWave * 2);

    // Octahedron geometry for a stylized floating crystal
    const orbGeo = new THREE.OctahedronGeometry(0.22, 0);
    const orbMat = new THREE.MeshBasicMaterial({
      color: 0x33ff77,
      transparent: true,
      opacity: 0.85,
    });
    const mesh = new THREE.Mesh(orbGeo, orbMat);
    mesh.position.copy(position);
    mesh.position.y = 0.6; // Float above ground

    // Outer green glow ring
    const ringGeo = new THREE.TorusGeometry(0.3, 0.02, 6, 12);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x55ffaa,
      transparent: true,
      opacity: 0.5,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    mesh.add(ring);

    this.scene.add(mesh);
    this.orbs.push({
      mesh,
      age: 0,
      lifetime: 15, // Disappears after 15 seconds
      baseY: 0.6,
      healthValue: healthVal,
    });
  }

  /** Update health crystals: float animation, check player collection, fade old items */
  _updateOrbs(delta, playerPos) {
    this.orbs = this.orbs.filter(orb => {
      orb.age += delta;

      // Float bobbing animation
      orb.mesh.position.y = orb.baseY + Math.sin(orb.age * 3) * 0.15;
      orb.mesh.rotation.y += delta * 2.5;

      // Pulse glow
      orb.mesh.material.opacity = 0.65 + Math.sin(orb.age * 5) * 0.2;

      // Check collection distance
      const dist = orb.mesh.position.distanceTo(playerPos);
      if (dist < 2.0) {
        // Collected! Heal player and spawn green particles
        this.player.heal(orb.healthValue || 20);
        
        const particles = createParticleExplosion(
          this.scene, orb.mesh.position, 0x33ff77, 8
        );
        this.particles.push(...particles);

        // Remove from scene
        this.scene.remove(orb.mesh);
        orb.mesh.geometry.dispose();
        orb.mesh.material.dispose();
        return false;
      }

      // Fade out near end of lifetime
      if (orb.age > orb.lifetime - 2) {
        const fadeT = (orb.lifetime - orb.age) / 2;
        orb.mesh.material.opacity *= fadeT;
      }

      // Remove expired orbs
      if (orb.age >= orb.lifetime) {
        this.scene.remove(orb.mesh);
        orb.mesh.geometry.dispose();
        orb.mesh.material.dispose();
        return false;
      }

      return true;
    });
  }

  /** Clean up all orbs (level cleanup) */
  _cleanupOrbs() {
    this.orbs.forEach(orb => {
      this.scene.remove(orb.mesh);
      orb.mesh.geometry.dispose();
      orb.mesh.material.dispose();
    });
    this.orbs = [];
  }

  /** Spawn a power-up item at a given location */
  _spawnPowerUp(position) {
    const types = ['speed', 'damage', 'shotgun', 'railgun'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let geo;
    let color;
    let emissive;
    
    if (type === 'speed') {
      geo = new THREE.SphereGeometry(0.22, 8, 8);
      color = 0x00ffff; // Cyan
      emissive = 0x00ffff;
    } else if (type === 'damage') {
      geo = new THREE.SphereGeometry(0.22, 8, 8);
      color = 0xff2222; // Red
      emissive = 0xff2222;
    } else if (type === 'shotgun') {
      geo = new THREE.TorusGeometry(0.18, 0.06, 6, 16);
      color = 0xffcc00; // Gold
      emissive = 0xffcc00;
    } else { // railgun
      geo = new THREE.TorusGeometry(0.18, 0.06, 6, 16);
      color = 0xff00ff; // Magenta
      emissive = 0xff00ff;
    }
    
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.2,
      metalness: 0.8,
      emissive: emissive,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
    });
    
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.position.y = 0.8; // Float slightly higher than health orb
    
    // Add point light for glow
    const light = new THREE.PointLight(color, 1.2, 4);
    mesh.add(light);
    
    this.scene.add(mesh);
    
    if (!this.powerUps) this.powerUps = [];
    this.powerUps.push({
      mesh,
      type,
      age: 0,
      lifetime: 15,
      baseY: 0.8,
    });
  }

  /** Update power-ups logic: float, rotate, collect */
  _updatePowerUps(delta, playerPos) {
    if (!this.powerUps) this.powerUps = [];
    
    this.powerUps = this.powerUps.filter(pu => {
      pu.age += delta;
      
      // Float bobbing
      pu.mesh.position.y = pu.baseY + Math.sin(pu.age * 3.5) * 0.12;
      
      // Rotation (toruses rotate dynamically)
      if (pu.type === 'shotgun' || pu.type === 'railgun') {
        pu.mesh.rotation.x += delta * 1.5;
        pu.mesh.rotation.y += delta * 2.5;
      } else {
        pu.mesh.rotation.y += delta * 2.0;
      }
      
      // Pulse emission
      if (pu.mesh.material) {
        pu.mesh.material.emissiveIntensity = 0.6 + Math.sin(pu.age * 5) * 0.3;
      }
      
      // Collection check
      const dist = pu.mesh.position.distanceTo(playerPos);
      if (dist < 2.0) {
        this._applyPowerUp(pu.type);
        
        let pColor = 0xffffff;
        if (pu.type === 'speed') pColor = 0x00ffff;
        else if (pu.type === 'damage') pColor = 0xff2222;
        else if (pu.type === 'shotgun') pColor = 0xffcc00;
        else if (pu.type === 'railgun') pColor = 0xff00ff;
        
        const particles = createParticleExplosion(
          this.scene, pu.mesh.position, pColor, 12
        );
        this.particles.push(...particles);
        
        this.scene.remove(pu.mesh);
        pu.mesh.geometry?.dispose();
        pu.mesh.material?.dispose();
        return false;
      }
      
      // Fade out
      if (pu.age > pu.lifetime - 2) {
        const fadeT = (pu.lifetime - pu.age) / 2;
        if (pu.mesh.material) {
          pu.mesh.material.opacity = fadeT * 0.9;
        }
      }
      
      if (pu.age >= pu.lifetime) {
        this.scene.remove(pu.mesh);
        pu.mesh.geometry?.dispose();
        pu.mesh.material?.dispose();
        return false;
      }
      
      return true;
    });
  }

  /** Apply the power-up to the player */
  _applyPowerUp(type) {
    if (!this.player) return;
    
    if (type === 'speed') {
      this.player.speedPowerupTimer = 10.0;
    } else if (type === 'damage') {
      this.player.damagePowerupTimer = 10.0;
    } else if (type === 'shotgun') {
      this.player.weaponOverride = 'shotgun';
      this.player.weaponOverrideTimer = 15.0;
    } else if (type === 'railgun') {
      this.player.weaponOverride = 'railgun';
      this.player.weaponOverrideTimer = 15.0;
    }
  }

  // ============================================================
  // ENEMY PROJECTILES
  // ============================================================

  /** Create a projectile fired by an enemy */
  _createEnemyProjectile(origin, direction, damage) {
    const mesh = new THREE.Mesh(
      _sharedEnemyProjGeo,
      getCachedMaterial(0xff3333, 0.9)
    );
    mesh.position.copy(origin);

    const light = new THREE.PointLight(0xff3333, 0.8, 4);
    mesh.add(light);

    this.scene.add(mesh);

    this.enemyProjectileMeshes.push({
      mesh,
      velocity: direction.clone().multiplyScalar(15),
      damage,
      age: 0,
      lifetime: 4,
    });
  }

  /** Update enemy projectiles — move and check collisions with player */
  _updateEnemyProjectiles(delta) {
    this.enemyProjectileMeshes = this.enemyProjectileMeshes.filter(proj => {
      proj.mesh.position.addScaledVector(proj.velocity, delta);
      proj.age += delta;

      // Check collision with player
      if (this.player && this.player.alive) {
        _tempPlayerChestPos.copy(this.player.getPosition());
        _tempPlayerChestPos.y += 1.0;
        
        const distSq = proj.mesh.position.distanceToSquared(_tempPlayerChestPos);
        if (distSq < 1.0) {
          const died = this.player.takeDamage(proj.damage);

          // Impact particles
          const particles = createParticleExplosion(
            this.scene, proj.mesh.position.clone(), 0xff3333, 6
          );
          this.particles.push(...particles);

          // Remove projectile
          this.scene.remove(proj.mesh);
          // Shared geometry and cached material are reused; do not dispose them.

          if (died) this.gameOver();
          return false;
        }
      }

      // Remove if too old
      if (proj.age >= proj.lifetime) {
        this.scene.remove(proj.mesh);
        // Shared geometry and cached material are reused; do not dispose them.
        return false;
      }

      return true;
    });
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  /** Clean up current level, player, enemies, projectiles */
  _cleanupLevel() {
    // Remove enemies
    this.enemies.forEach(e => e.dispose());
    this.enemies = [];

    // Remove enemy projectiles
    this.enemyProjectileMeshes.forEach(p => {
      this.scene.remove(p.mesh);
      // Shared geometry and cached material are reused; do not dispose them.
    });
    this.enemyProjectileMeshes = [];

    // Remove particles
    this.particles.forEach(p => {
      this.scene.remove(p.mesh);
      // Shared geometry and cached material are reused; do not dispose them.
    });
    this.particles = [];

    // Remove active power-ups
    if (this.powerUps) {
      this.powerUps.forEach(pu => {
        this.scene.remove(pu.mesh);
        pu.mesh.geometry?.dispose();
        pu.mesh.material?.dispose();
      });
      this.powerUps = [];
    }

    // Remove collectible orbs
    this._cleanupOrbs();

    // Remove player
    if (this.player) {
      this.player.dispose();
      this.player = null;
    }

    // Remove weapons
    if (this.weapons) {
      this.weapons.dispose();
      this.weapons = null;
    }

    // Remove level
    if (this.level) {
      this.level.cleanup(this.scene);
      this.level = null;
    }
  }

  /** Emit state change to React layer */
  _emitStateChange() {
    this.onStateChange({
      state: this.state,
      hud: { ...this.hudData },
    });
  }

  /** Full cleanup — call when component unmounts */
  dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('keydown', this._onKeyPress);

    this._cleanupLevel();

    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
