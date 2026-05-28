/**
 * Enemy.js — AI Enemy system with state machine
 * 
 * Each enemy has a finite state machine:
 *   IDLE → PATROL → CHASE → ATTACK → DEAD
 * 
 * Difficulty scales with level:
 *   Level 1 (Jungle): Slow, basic chase, low HP
 *   Level 2 (City):   Medium speed, flanking, medium HP
 *   Level 3 (Water):  Fast, dodging, high HP, ranged attacks
 */

import * as THREE from 'three';
import { randomRange, randomInt, clamp, resolveObstacleCollisions } from './Utils.js';
import { buildEnemy, buildBoss } from './Characters.js';

// ============================================================
// ENEMY STATES
// ============================================================

const STATES = {
  IDLE: 'IDLE',
  PATROL: 'PATROL',
  CHASE: 'CHASE',
  ATTACK: 'ATTACK',
  DEAD: 'DEAD',
  HIT: 'HIT',       // Brief stagger when taking damage
};

// ============================================================
// DIFFICULTY SCALING
// ============================================================

const DIFFICULTY = {
  1: { // Jungle
    meleeHP: 40, rangedHP: 30, bossHP: 280,
    meleeSpeed: 3, rangedSpeed: 2,
    meleeDamage: 8, rangedDamage: 5,
    detectionRange: 15, attackRange: 1.8,
    rangedAttackRange: 12,
    attackCooldown: 1.5,
  },
  2: { // City
    meleeHP: 60, rangedHP: 45, bossHP: 500,
    meleeSpeed: 4.5, rangedSpeed: 3,
    meleeDamage: 12, rangedDamage: 8,
    detectionRange: 20, attackRange: 2.0,
    rangedAttackRange: 15,
    attackCooldown: 1.2,
  },
  3: { // Water
    meleeHP: 80, rangedHP: 60, bossHP: 700,
    meleeSpeed: 6, rangedSpeed: 4,
    meleeDamage: 15, rangedDamage: 12,
    detectionRange: 25, attackRange: 2.2,
    rangedAttackRange: 18,
    attackCooldown: 0.9,
  },
};

// ============================================================
// ENEMY CLASS
// ============================================================

export class Enemy {
  /**
   * @param {THREE.Scene} scene - Scene to add enemy mesh to
   * @param {string} type - 'melee', 'ranged', or 'boss'
   * @param {THREE.Vector3} position - Spawn position
   * @param {number} difficulty - Level difficulty (1, 2, or 3)
   */
  constructor(scene, type, position, difficulty = 1) {
    this.scene = scene;
    this.type = type;
    this.difficulty = difficulty;
    this.alive = true;

    // Get difficulty config
    const diff = DIFFICULTY[difficulty] || DIFFICULTY[1];
    this.isBoss = type === 'boss';

    // Set stats based on type
    if (this.isBoss) {
      this.maxHP = diff.bossHP;
      this.speed = diff.meleeSpeed * 0.8; // Boss is slightly slower
      this.damage = diff.meleeDamage * 2;
      this.detectionRange = 30;
      this.attackRange = 3.0;
      this.attackCooldown = diff.attackCooldown * 0.8;
    } else if (type === 'ranged') {
      this.maxHP = diff.rangedHP;
      this.speed = diff.rangedSpeed;
      this.damage = diff.rangedDamage;
      this.detectionRange = diff.detectionRange;
      this.attackRange = diff.rangedAttackRange;
      this.attackCooldown = diff.attackCooldown * 1.3;
    } else if (type === 'flying') {
      this.maxHP = Math.round(diff.rangedHP * 0.9); // Flying spirits are slightly more fragile
      this.speed = diff.meleeSpeed * 1.1;           // But fly faster than ranged enemies
      this.damage = diff.rangedDamage;
      this.detectionRange = diff.detectionRange;
      this.attackRange = diff.rangedAttackRange * 0.95;
      this.attackCooldown = diff.attackCooldown * 1.1;
    } else {
      this.maxHP = diff.meleeHP;
      this.speed = diff.meleeSpeed;
      this.damage = diff.meleeDamage;
      this.detectionRange = diff.detectionRange;
      this.attackRange = diff.attackRange;
      this.attackCooldown = diff.attackCooldown;
    }

    this.hp = this.maxHP;
    this.attackTimer = 0;
    this.hitTimer = 0;       // Stagger time remaining
    this.stateTimer = 0;     // Time in current state

    // Build the 3D model
    this.mesh = this.isBoss
      ? buildBoss(difficulty)
      : buildEnemy(type, difficulty);
    this.mesh.position.copy(position);
    if (type === 'flying') {
      this.mesh.position.y += 3.5; // Start elevated in the air
    }
    scene.add(this.mesh);

    // AI State
    this.state = STATES.IDLE;
    this.patrolTarget = null;    // Where to walk when patrolling
    this.lastDirection = new THREE.Vector3(0, 0, 1);

    // Ranged attack projectiles tracking (handled by game loop)
    this.pendingAttack = false;
    this.attackDirection = new THREE.Vector3();

    // Score value
    this.scoreValue = this.isBoss ? 500 : (type === 'ranged' ? 150 : (type === 'flying' ? 120 : 100));
    this.scoreValue *= difficulty; // More points in harder levels
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  /**
   * Main update function — called every frame.
   * Runs the AI state machine and updates position.
   * 
   * @param {number} delta - Frame delta time
   * @param {THREE.Vector3} playerPosition - Current player position
   */
  update(delta, playerPosition, obstacles) {
    if (!this.alive) return;

    // Handle stagger (hit state)
    if (this.state === STATES.HIT) {
      this.hitTimer -= delta;
      // Flash red when hit
      this._flashColor(0xff0000);
      
      // Still animate wings and update Y for flying enemy during hits
      if (this.type === 'flying') {
        const leftWing = this.mesh.getObjectByName('leftWing');
        const rightWing = this.mesh.getObjectByName('rightWing');
        if (leftWing && rightWing) {
          const time = Date.now() * 0.012;
          leftWing.rotation.z = 0.2 + Math.sin(time) * 0.4;
          rightWing.rotation.z = -0.2 - Math.sin(time) * 0.4;
        }
        const targetY = playerPosition.y + 3.5;
        this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetY, 0.05);
      }

      if (this.hitTimer <= 0) {
        this._resetColor();
        this.state = STATES.CHASE; // After hit, always chase player
      }
      return;
    }

    // Update attack cooldown
    this.attackTimer = Math.max(0, this.attackTimer - delta);
    this.stateTimer += delta;

    // Calculate distance to player (target player's chest height)
    const playerTargetPos = playerPosition.clone();
    playerTargetPos.y += 1.0; // Aim at chest height
    const toPlayer = new THREE.Vector3().subVectors(playerTargetPos, this.mesh.position);
    const distToPlayer = toPlayer.length();
    toPlayer.normalize();

    // Run state machine
    switch (this.state) {
      case STATES.IDLE:
        this._updateIdle(delta, distToPlayer);
        break;
      case STATES.PATROL:
        this._updatePatrol(delta, distToPlayer);
        break;
      case STATES.CHASE:
        this._updateChase(delta, toPlayer, distToPlayer);
        break;
      case STATES.ATTACK:
        this._updateAttack(delta, toPlayer, distToPlayer);
        break;
    }

    // Altitude and wing flapping animation
    if (this.type === 'flying') {
      // Smoothly float towards target altitude above player height
      const targetY = playerPosition.y + 3.5;
      this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetY, 0.05);

      // Flap wings procedurally
      const leftWing = this.mesh.getObjectByName('leftWing');
      const rightWing = this.mesh.getObjectByName('rightWing');
      if (leftWing && rightWing) {
        const time = Date.now() * 0.012;
        leftWing.rotation.z = 0.2 + Math.sin(time) * 0.4;
        rightWing.rotation.z = -0.2 - Math.sin(time) * 0.4;
        
        // Wing tilt forward/back
        leftWing.rotation.y = Math.cos(time) * 0.1;
        rightWing.rotation.y = -Math.cos(time) * 0.1;
      }
    } else {
      // Bob animation (subtle float) for ground units
      this.mesh.position.y += Math.sin(Date.now() * 0.003) * 0.002;
    }

    // Rotate aura if exists
    const aura = this.mesh.getObjectByName('aura');
    if (aura) {
      aura.rotation.y += delta * 0.5;
    }

    // Resolve obstacle collisions
    if (obstacles && obstacles.length > 0) {
      resolveObstacleCollisions(this.mesh.position, this.getRadius(), obstacles);
    }
  }

  /**
   * Apply damage to this enemy.
   * @param {number} amount - Damage to deal
   * @returns {boolean} True if the enemy died from this hit
   */
  takeDamage(amount) {
    if (!this.alive) return false;

    this.hp -= amount;

    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.state = STATES.DEAD;
      this._die();
      return true;
    }

    // Enter hit state (brief stagger)
    this.state = STATES.HIT;
    this.hitTimer = 0.2;

    // Knockback
    const knockback = this.lastDirection.clone().negate().multiplyScalar(0.5);
    this.mesh.position.add(knockback);

    return false;
  }

  /** Get the world position of this enemy */
  getPosition() {
    return this.mesh.position.clone();
  }

  /** Get the collision radius */
  getRadius() {
    return this.mesh.userData.radius || 0.5;
  }

  /** Check if enemy has a pending ranged attack */
  consumeAttack() {
    if (this.pendingAttack) {
      this.pendingAttack = false;
      return {
        position: this.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)),
        direction: this.attackDirection.clone(),
        damage: this.damage,
      };
    }
    return null;
  }

  /** Remove enemy from scene and clean up */
  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  // ============================================================
  // STATE MACHINE — PRIVATE METHODS
  // ============================================================

  /** IDLE: Stand still, look around, transition to PATROL or CHASE */
  _updateIdle(delta, distToPlayer) {
    // If player is in detection range, start chasing
    if (distToPlayer < this.detectionRange) {
      this.state = STATES.CHASE;
      this.stateTimer = 0;
      return;
    }

    // After some idle time, start patrolling
    if (this.stateTimer > randomRange(1, 3)) {
      this.state = STATES.PATROL;
      this.stateTimer = 0;
      this._pickPatrolTarget();
    }
  }

  /** PATROL: Walk to a random nearby point */
  _updatePatrol(delta, distToPlayer) {
    // If player is detected, start chasing
    if (distToPlayer < this.detectionRange) {
      this.state = STATES.CHASE;
      this.stateTimer = 0;
      return;
    }

    // Move toward patrol target
    if (this.patrolTarget) {
      const toTarget = new THREE.Vector3().subVectors(this.patrolTarget, this.mesh.position);
      const dist = toTarget.length();

      if (dist < 1.0) {
        // Reached patrol target, go idle
        this.state = STATES.IDLE;
        this.stateTimer = 0;
        return;
      }

      toTarget.y = 0; // Flatten movement vector horizontally
      toTarget.normalize();
      this.mesh.position.add(toTarget.multiplyScalar(this.speed * 0.3 * delta));
      this._faceDirection(toTarget);
      this.lastDirection.copy(toTarget);
    }

    // Timeout patrol after too long
    if (this.stateTimer > 5) {
      this.state = STATES.IDLE;
      this.stateTimer = 0;
    }
  }

  /** CHASE: Move toward the player */
  _updateChase(delta, toPlayer, distToPlayer) {
    // If player is in attack range, switch to attack
    if (distToPlayer < this.attackRange) {
      this.state = STATES.ATTACK;
      this.stateTimer = 0;
      return;
    }

    // If player is too far away, go back to patrol
    if (distToPlayer > this.detectionRange * 1.5) {
      this.state = STATES.PATROL;
      this.stateTimer = 0;
      this._pickPatrolTarget();
      return;
    }

    // Move toward player
    let moveDir = toPlayer.clone();

    // Level 2+: Add flanking behavior (approach at an angle)
    if (this.difficulty >= 2 && !this.isBoss) {
      const flankAngle = Math.sin(this.stateTimer * 2) * 0.5;
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), flankAngle);
    }

    // Level 3: Add dodge behavior when projectiles are near
    // (simplified: random strafe while chasing)
    if (this.difficulty >= 3) {
      const strafeDir = new THREE.Vector3(-moveDir.z, 0, moveDir.x);
      strafeDir.multiplyScalar(Math.sin(this.stateTimer * 3) * 0.4);
      moveDir.add(strafeDir).normalize();
    }

    moveDir.y = 0; // Keep on ground plane
    moveDir.normalize();

    this.mesh.position.add(moveDir.multiplyScalar(this.speed * delta));
    this._faceDirection(toPlayer);
    this.lastDirection.copy(toPlayer);
  }

  /** ATTACK: Deal damage to the player (melee or ranged) */
  _updateAttack(delta, toPlayer, distToPlayer) {
    // Face the player
    this._faceDirection(toPlayer);

    // If player moved out of range, chase again
    if (distToPlayer > this.attackRange * 1.3) {
      this.state = STATES.CHASE;
      this.stateTimer = 0;
      return;
    }

    // Attack when cooldown is ready
    if (this.attackTimer <= 0) {
      if (this.type === 'ranged' || this.type === 'flying' || (this.isBoss && distToPlayer > 3)) {
        // Ranged attack — signal to game loop
        this.pendingAttack = true;
        this.attackDirection.copy(toPlayer);
      } else {
        // Melee attack — signal to game loop
        this.pendingAttack = true;
        this.attackDirection.copy(toPlayer);
      }
      this.attackTimer = this.attackCooldown;

      // Visual: lunge forward slightly (skip for flying spirits to keep flight stable)
      if (this.type !== 'flying') {
        this.mesh.position.add(toPlayer.clone().multiplyScalar(0.2));
      }
    }
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /** Pick a random patrol target near current position */
  _pickPatrolTarget() {
    const range = 8;
    this.patrolTarget = new THREE.Vector3(
      this.mesh.position.x + randomRange(-range, range),
      0,
      this.mesh.position.z + randomRange(-range, range)
    );
    // Clamp within level bounds
    this.patrolTarget.x = clamp(this.patrolTarget.x, -20, 20);
    this.patrolTarget.z = clamp(this.patrolTarget.z, -20, 20);
  }

  /** Rotate mesh to face a direction vector */
  _faceDirection(direction) {
    const angle = Math.atan2(direction.x, direction.z);
    this.mesh.rotation.y = angle;
  }

  /** Flash the enemy a color (for hit feedback) */
  _flashColor(color) {
    this.mesh.traverse(child => {
      if (child.isMesh && child.material && !child.material._originalColor) {
        child.material._originalColor = child.material.color.getHex();
        child.material.color.setHex(color);
      }
    });
  }

  /** Reset to original colors after flash */
  _resetColor() {
    this.mesh.traverse(child => {
      if (child.isMesh && child.material && child.material._originalColor) {
        child.material.color.setHex(child.material._originalColor);
        delete child.material._originalColor;
      }
    });
  }

  /** Death sequence: remove mesh immediately, no particles */
  _die() {
    // Remove mesh immediately without particles or delay
    this.dispose();
  }
}

// ============================================================
// ENEMY SPAWNER — Creates enemies for each wave
// ============================================================

/**
 * Creates a batch of enemies for a wave.
 * 
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {number} wave - Current wave number (1-based)
 * @param {number} level - Current level (1=Jungle, 2=City, 3=Water)
 * @param {Array} spawnPoints - Available spawn positions
 * @param {boolean} isBossWave - Whether this is the final boss wave
 * @returns {Array<Enemy>} Array of spawned enemies
 */
export function spawnWaveEnemies(scene, wave, level, spawnPoints, isBossWave) {
  const enemies = [];

  if (isBossWave) {
    // Spawn the boss at a random spawn point
    const bossSpawn = spawnPoints[randomInt(0, spawnPoints.length - 1)];
    enemies.push(new Enemy(scene, 'boss', bossSpawn.clone(), level));

    // Also spawn some minions with the boss
    const minionCount = level;
    for (let i = 0; i < minionCount; i++) {
      const spawn = spawnPoints[randomInt(0, spawnPoints.length - 1)];
      enemies.push(new Enemy(scene, 'melee', spawn.clone(), level));
    }
  } else {
    // Normal wave: mix of melee, ranged, and flying enemies
    const meleeCount = 2 + wave + Math.floor(level * 0.5);
    const rangedCount = Math.max(0, wave - 1 + Math.floor(level * 0.5));
    const flyingCount = Math.max(0, wave - 2 + Math.floor(level * 0.5));

    for (let i = 0; i < meleeCount; i++) {
      const spawn = spawnPoints[randomInt(0, spawnPoints.length - 1)];
      const offsetSpawn = spawn.clone().add(
        new THREE.Vector3(randomRange(-3, 3), 0, randomRange(-3, 3))
      );
      enemies.push(new Enemy(scene, 'melee', offsetSpawn, level));
    }

    for (let i = 0; i < rangedCount; i++) {
      const spawn = spawnPoints[randomInt(0, spawnPoints.length - 1)];
      const offsetSpawn = spawn.clone().add(
        new THREE.Vector3(randomRange(-3, 3), 0, randomRange(-3, 3))
      );
      enemies.push(new Enemy(scene, 'ranged', offsetSpawn, level));
    }

    for (let i = 0; i < flyingCount; i++) {
      const spawn = spawnPoints[randomInt(0, spawnPoints.length - 1)];
      const offsetSpawn = spawn.clone().add(
        new THREE.Vector3(randomRange(-3, 3), 3.5, randomRange(-3, 3)) // Spawn higher up
      );
      enemies.push(new Enemy(scene, 'flying', offsetSpawn, level));
    }
  }

  return enemies;
}
