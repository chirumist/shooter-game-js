/**
 * Player.js — Player controller with TPS/FPS camera, movement, and input
 * 
 * Handles:
 * - WASD movement relative to camera facing direction
 * - Mouse look via Pointer Lock API
 * - TPS (third-person) and FPS (first-person) camera modes
 * - Jump with gravity
 * - Sprint with shift key
 * - Shooting and special attacks (delegates to WeaponsManager)
 * - Health and damage system
 */

import * as THREE from 'three';
import { clamp, lerp, resolveObstacleCollisions } from './Utils.js';
import { buildGojo, buildSukuna } from './Characters.js';

// ============================================================
// PLAYER CONFIGURATION
// ============================================================

const CONFIG = {
  moveSpeed: 8,
  sprintMultiplier: 1.6,
  jumpForce: 10,
  gravity: 22,
  mouseSensitivity: 0.002,
  maxHealth: 100,
  // Camera offsets
  tps: {
    distance: 5,
    height: 3,
    lookAtHeight: 1.5,
    lerpSpeed: 8,
  },
  fps: {
    eyeHeight: 2.0,
    lerpSpeed: 12,
  },
};

// ============================================================
// PLAYER CLASS
// ============================================================

export class Player {
  /**
   * @param {THREE.Scene} scene - The Three.js scene
   * @param {THREE.PerspectiveCamera} camera - The main camera
   * @param {string} characterType - 'gojo' or 'sukuna'
   */
  constructor(scene, camera, characterType = 'gojo') {
    this.scene = scene;
    this.camera = camera;
    this.characterType = characterType;

    // Build character model
    this.mesh = characterType === 'sukuna' ? buildSukuna() : buildGojo();
    this.mesh.position.set(0, 0, 0);
    scene.add(this.mesh);

    // Player state
    this.health = CONFIG.maxHealth;
    this.maxHealth = CONFIG.maxHealth;
    this.alive = true;
    this.score = 0;
    this.kills = 0;

    // Movement state
    this.velocity = new THREE.Vector3();
    this.isGrounded = true;
    this.isSprinting = false;
    this.groundY = 0; // Current ground height

    // Camera state
    this.cameraMode = 'fps'; // Locked to First Person
    this.yaw = 0;            // Horizontal rotation (mouse X)
    this.pitch = 0;          // Vertical rotation (mouse Y)

    // Set up FPS Gun
    const gun = this.mesh.getObjectByName('gun');
    if (gun) {
      // Remove gun from player body mesh
      this.mesh.remove(gun);
      // Attach gun directly to camera so it moves and rotates with it (both yaw & pitch)
      this.camera.add(gun);
      // Position gun in front of camera (right side, slightly down, pointing forward)
      gun.position.set(0.22, -0.22, -0.42);
      gun.rotation.set(0, Math.PI, 0); // Rotate 180 deg so barrel points down camera -Z
      this.gun = gun;
    }

    // Hide player body mesh in First Person view
    this.mesh.visible = false;

    // Input state (set by event listeners)
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
    };
    this.mouseButtons = {
      left: false,
      right: false,
    };
    this.mouseDelta = { x: 0, y: 0 };

    // Shooting state
    this.shootCooldown = 0;
    this.shootRate = 0.3; // Default fire rate, overridden by weapon tier

    // Raycaster for TPS aiming (reused to avoid GC)
    this._aimRaycaster = new THREE.Raycaster();
    this._aimScreenCenter = new THREE.Vector2(0, 0);

    // Damage feedback
    this.damageFlashTimer = 0;
    this.invincibilityTimer = 0; // Brief invincibility after taking damage

    // Power-ups state
    this.speedPowerupTimer = 0;
    this.damagePowerupTimer = 0;
    this.weaponOverride = null;
    this.weaponOverrideTimer = 0;

    // Set up input listeners
    this._setupInputListeners();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  /**
   * Main update function — called every frame.
   * Handles movement, camera, and shooting.
   * 
   * @param {number} delta - Frame delta time
   * @param {object} weapons - WeaponsManager instance
   * @param {object} levelBounds - { min, max } bounds
   * @returns {object} State changes (for UI updates)
   */
  update(delta, weapons, levelBounds, obstacles) {
    if (!this.alive) return {};

    const stateChanges = {};

    // Update timers
    this.shootCooldown = Math.max(0, this.shootCooldown - delta);
    this.invincibilityTimer = Math.max(0, this.invincibilityTimer - delta);
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - delta);

    // Update power-up timers
    this.speedPowerupTimer = Math.max(0, this.speedPowerupTimer - delta);
    this.damagePowerupTimer = Math.max(0, this.damagePowerupTimer - delta);
    this.weaponOverrideTimer = Math.max(0, this.weaponOverrideTimer - delta);
    if (this.weaponOverrideTimer <= 0) {
      this.weaponOverride = null;
    }

    // Process mouse look
    this._updateMouseLook();

    // Process movement
    this._updateMovement(delta, levelBounds, obstacles);

    // Read fire rate from weapons tier system
    this.shootRate = weapons.getFireRate ? weapons.getFireRate() : 0.3;

    // Process shooting
    if (this.mouseButtons.left && this.shootCooldown <= 0) {
      this._shoot(weapons);
      this.shootCooldown = this.shootRate;
      stateChanges.shot = true;
    }
    if (this.mouseButtons.right) {
      const fired = this._specialAttack(weapons);
      if (fired) stateChanges.specialFired = true;
      this.mouseButtons.right = false; // Single-fire special
    }

    // Update camera position
    this._updateCamera(delta);

    // Animate player model
    this._animateModel(delta);

    return stateChanges;
  }

  /**
   * Apply damage to the player.
   * @param {number} amount - Damage amount
   * @returns {boolean} True if the player died
   */
  takeDamage(amount) {
    if (!this.alive || this.invincibilityTimer > 0) return false;

    this.health -= amount;
    this.damageFlashTimer = 0.3; // Flash effect duration
    this.invincibilityTimer = 0.3; // Brief invincibility

    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  /** Heal the player */
  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  /** Get the player's world position */
  getPosition() {
    return this.mesh.position.clone();
  }

  /** Get the direction the player is facing */
  getDirection() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    return dir;
  }

  /**
   * Get the aiming direction.
   * In FPS mode: uses camera direction directly.
   * In TPS mode: casts a ray from camera through the crosshair (screen center)
   * to find what the player is aiming at, then calculates direction from
   * the projectile origin to that target. This fixes TPS aim accuracy.
   */
  getAimDirection() {
    if (this.cameraMode === 'tps') {
      // TPS: Cast ray from camera center (crosshair) into the scene
      this._aimRaycaster.setFromCamera(this._aimScreenCenter, this.camera);

      // Get a target point far along the ray (where the crosshair points)
      const aimTarget = new THREE.Vector3();
      this._aimRaycaster.ray.at(100, aimTarget);

      // Calculate direction from projectile spawn point to aim target
      const origin = this.mesh.position.clone();
      origin.y += 1.5; // Chest height
      const dir = aimTarget.sub(origin).normalize();
      return dir;
    } else {
      // FPS: Use camera rotation directly
      const dir = new THREE.Vector3(0, 0, -1);
      dir.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      return dir.normalize();
    }
  }

  /** Toggle between TPS and FPS camera modes */
  toggleCameraMode() {
    // Locked to FPS mode
    this.cameraMode = 'fps';
    this.mesh.visible = false;
    return 'fps';
  }

  /** Reset player to starting state */
  reset(position) {
    this.health = CONFIG.maxHealth;
    this.alive = true;
    this.velocity.set(0, 0, 0);
    this.mesh.position.copy(position);
    this.mesh.visible = false; // Always invisible in FPS mode
    this.isGrounded = true;
    this.groundY = position.y;
    this.invincibilityTimer = 1.0; // Brief spawn protection

    // Reset power-ups
    this.speedPowerupTimer = 0;
    this.damagePowerupTimer = 0;
    this.weaponOverride = null;
    this.weaponOverrideTimer = 0;
  }

  /** Check if player should flash red (just took damage) */
  isDamageFlashing() {
    return this.damageFlashTimer > 0;
  }

  /** Get the collision radius */
  getRadius() {
    return 0.4;
  }

  /** Clean up and remove from scene */
  dispose() {
    this._removeInputListeners();
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
    
    // Dispose camera-attached FPS gun
    if (this.gun) {
      this.camera.remove(this.gun);
      this.gun.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      this.gun = null;
    }
  }

  // ============================================================
  // MOVEMENT & PHYSICS
  // ============================================================

  /** Process WASD movement relative to camera direction */
  _updateMovement(delta, bounds, obstacles) {
    let speed = CONFIG.moveSpeed * (this.keys.sprint ? CONFIG.sprintMultiplier : 1);
    if (this.speedPowerupTimer > 0) {
      speed *= 1.5;
    }

    // Calculate forward and right vectors based on yaw
    const forward = new THREE.Vector3(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw)
    );
    const right = new THREE.Vector3(
      Math.cos(this.yaw),
      0,
      -Math.sin(this.yaw)
    );

    // Build movement vector
    const moveDir = new THREE.Vector3();
    if (this.keys.forward) moveDir.add(forward);
    if (this.keys.backward) moveDir.sub(forward);
    if (this.keys.left) moveDir.sub(right);
    if (this.keys.right) moveDir.add(right);

    if (moveDir.length() > 0) {
      moveDir.normalize();
      this.mesh.position.x += moveDir.x * speed * delta;
      this.mesh.position.z += moveDir.z * speed * delta;
    }

    // Resolve obstacle collisions
    if (obstacles && obstacles.length > 0) {
      resolveObstacleCollisions(this.mesh.position, this.getRadius(), obstacles);
    }

    // Jump
    if (this.keys.jump && this.isGrounded) {
      this.velocity.y = CONFIG.jumpForce;
      this.isGrounded = false;
      this.keys.jump = false; // Single press jump
    }

    // Apply gravity
    if (!this.isGrounded) {
      this.velocity.y -= CONFIG.gravity * delta;
      this.mesh.position.y += this.velocity.y * delta;

      // Ground check
      if (this.mesh.position.y <= this.groundY) {
        this.mesh.position.y = this.groundY;
        this.velocity.y = 0;
        this.isGrounded = true;
      }
    }

    // Clamp to level bounds
    if (bounds) {
      this.mesh.position.x = clamp(this.mesh.position.x, bounds.min, bounds.max);
      this.mesh.position.z = clamp(this.mesh.position.z, bounds.min, bounds.max);
    }

    // Rotate character model to face movement direction
    if (moveDir.length() > 0 && this.cameraMode === 'tps') {
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      this.mesh.rotation.y = lerp(this.mesh.rotation.y, targetAngle, 0.15);
    } else if (this.cameraMode === 'fps') {
      this.mesh.rotation.y = this.yaw;
    }
  }

  // ============================================================
  // CAMERA
  // ============================================================

  /** Update mouse look from accumulated mouse delta */
  _updateMouseLook() {
    this.yaw -= this.mouseDelta.x * CONFIG.mouseSensitivity;
    this.pitch -= this.mouseDelta.y * CONFIG.mouseSensitivity;

    // Clamp pitch to prevent flipping
    this.pitch = clamp(this.pitch, -Math.PI / 3, Math.PI / 3);

    // Reset mouse delta after processing
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
  }

  /** Update camera position and look-at based on current mode */
  _updateCamera(delta) {
    const tps = CONFIG.tps;
    const fps = CONFIG.fps;
    const playerPos = this.mesh.position;

    if (this.cameraMode === 'tps') {
      // Third-person: camera behind and above player
      const cameraOffset = new THREE.Vector3(
        Math.sin(this.yaw) * tps.distance,
        tps.height,
        Math.cos(this.yaw) * tps.distance
      );

      // Apply pitch to camera height
      cameraOffset.y += Math.sin(this.pitch) * tps.distance * 0.5;

      const targetPos = playerPos.clone().add(cameraOffset);
      const lookAt = playerPos.clone().add(new THREE.Vector3(0, tps.lookAtHeight, 0));

      // Smooth camera follow
      this.camera.position.lerp(targetPos, tps.lerpSpeed * delta);
      this.camera.lookAt(lookAt);

    } else {
      // First-person: camera at eye level
      const targetPos = new THREE.Vector3(
        playerPos.x,
        playerPos.y + fps.eyeHeight,
        playerPos.z
      );

      this.camera.position.lerp(targetPos, fps.lerpSpeed * delta);

      // Set camera rotation from yaw/pitch
      const lookDir = this.getAimDirection();
      const lookTarget = this.camera.position.clone().add(lookDir.multiplyScalar(10));
      this.camera.lookAt(lookTarget);
    }
  }

  // ============================================================
  // SHOOTING
  // ============================================================

  /** Fire a normal projectile */
  _shoot(weapons) {
    const origin = new THREE.Vector3();
    const dir = this.getAimDirection();
    if (this.gun) {
      this.gun.getWorldPosition(origin);
      // Spawn slightly in front of the gun barrel position
      origin.addScaledVector(dir, 0.3);
    } else {
      origin.copy(this.mesh.position);
      origin.y += 1.5; // Fallback to chest height
      origin.addScaledVector(dir, 0.8);
    }
    weapons.shoot(origin, dir, this.weaponOverride, this.damagePowerupTimer > 0);
  }

  /** Fire a special attack */
  _specialAttack(weapons) {
    const origin = new THREE.Vector3();
    const dir = this.getAimDirection();
    if (this.gun) {
      this.gun.getWorldPosition(origin);
      // Spawn slightly in front of the gun barrel position
      origin.addScaledVector(dir, 0.3);
    } else {
      origin.copy(this.mesh.position);
      origin.y += 1.5;
      origin.addScaledVector(dir, 0.8);
    }
    return weapons.specialAttack(origin, dir, this.damagePowerupTimer > 0);
  }

  // ============================================================
  // ANIMATION
  // ============================================================

  /**
   * Procedural humanoid walk animation.
   * Arms swing opposite to legs (natural gait), body bobs.
   */
  _animateModel(delta) {
    // Pulse gun energy core (even in first person where body mesh is hidden)
    const gun = this.gun || this.mesh.getObjectByName('gun');
    if (gun) {
      const core = gun.children.find(c => c.geometry?.type === 'TorusGeometry');
      if (core && core.material.emissiveIntensity !== undefined) {
        core.material.emissiveIntensity = 0.4 + Math.sin(Date.now() * 0.005) * 0.3;
      }
    }

    if (!this.mesh.visible) return;

    const isMoving = this.keys.forward || this.keys.backward ||
                     this.keys.left || this.keys.right;

    // Animate aura
    const aura = this.mesh.getObjectByName('aura');
    if (aura) {
      aura.rotation.y += delta * 1.5;
      const scale = 1 + Math.sin(Date.now() * 0.003) * 0.1;
      aura.scale.setScalar(scale);
    }

    // Get named limbs
    const leftArm = this.mesh.getObjectByName('leftArm');
    const rightArm = this.mesh.getObjectByName('rightArm');
    const leftLeg = this.mesh.getObjectByName('leftLeg');
    const rightLeg = this.mesh.getObjectByName('rightLeg');

    // Track animation phase
    if (!this._walkPhase) this._walkPhase = 0;

    if (isMoving && this.isGrounded) {
      // Walking / sprinting animation
      const speed = this.keys.sprint ? 14 : 9;
      const swingAmount = this.keys.sprint ? 0.5 : 0.35;
      this._walkPhase += delta * speed;

      const swing = Math.sin(this._walkPhase);

      // Legs: stride forward/back (opposite to each other)
      if (leftLeg) leftLeg.rotation.x = swing * swingAmount;
      if (rightLeg) rightLeg.rotation.x = -swing * swingAmount;

      // Arms: swing opposite to legs (natural walk)
      if (leftArm) leftArm.rotation.x = -swing * swingAmount * 0.7;
      if (rightArm) rightArm.rotation.x = swing * swingAmount * 0.5; // Less swing for gun arm

      this.mesh.children.forEach(child => {
        if (child.name !== 'leftLeg' && child.name !== 'rightLeg') {
          // Subtle bob for torso/head (not legs)
        }
      });

      // Slight body tilt in direction of movement
      this.mesh.children.forEach(child => {
        if (child.name === 'torso' || !child.name) {
          // Already handled by rotation
        }
      });
    } else {
      // Idle animation — gentle breathing sway
      this._walkPhase *= 0.9; // Smoothly return to rest
      const breathe = Math.sin(Date.now() * 0.002) * 0.02;

      if (leftArm) leftArm.rotation.x = breathe;
      if (rightArm) rightArm.rotation.x = -breathe * 0.5;
      if (leftLeg) leftLeg.rotation.x *= 0.85;
      if (rightLeg) rightLeg.rotation.x *= 0.85;
    }

    // Gun energy core pulse
    if (gun) {
      const core = gun.children.find(c => c.geometry?.type === 'TorusGeometry');
      if (core && core.material.emissiveIntensity !== undefined) {
        core.material.emissiveIntensity = 0.4 + Math.sin(Date.now() * 0.005) * 0.3;
      }
    }
  }

  // ============================================================
  // INPUT HANDLERS
  // ============================================================

  _setupInputListeners() {
    // Bind so we can remove them later
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
  }

  _removeInputListeners() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
  }

  _handleKeyDown(e) {
    // Prevent browser scrolling for game keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }

    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    this.keys.forward = true; break;
      case 'KeyS': case 'ArrowDown':  this.keys.backward = true; break;
      case 'KeyA': case 'ArrowLeft':  this.keys.left = true; break;
      case 'KeyD': case 'ArrowRight': this.keys.right = true; break;
      case 'Space':                    this.keys.jump = true; e.preventDefault(); break;
      case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = true; break;
    }
  }

  _handleKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    this.keys.forward = false; break;
      case 'KeyS': case 'ArrowDown':  this.keys.backward = false; break;
      case 'KeyA': case 'ArrowLeft':  this.keys.left = false; break;
      case 'KeyD': case 'ArrowRight': this.keys.right = false; break;
      case 'Space':                    this.keys.jump = false; break;
      case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = false; break;
    }
  }

  _handleMouseMove(e) {
    // Only process if pointer is locked (game is active)
    if (document.pointerLockElement) {
      this.mouseDelta.x += e.movementX;
      this.mouseDelta.y += e.movementY;
    }
  }

  _handleMouseDown(e) {
    if (e.button === 0) this.mouseButtons.left = true;
    if (e.button === 2) { this.mouseButtons.right = true; e.preventDefault(); }
  }

  _handleMouseUp(e) {
    if (e.button === 0) this.mouseButtons.left = false;
    if (e.button === 2) this.mouseButtons.right = false;
  }

  /** Reset all keys (called when game loses focus) */
  resetKeys() {
    Object.keys(this.keys).forEach(k => this.keys[k] = false);
    this.mouseButtons.left = false;
    this.mouseButtons.right = false;
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
  }
}
