/**
 * Weapons.js — Projectile and attack system
 * 
 * Handles the creation, movement, and collision detection of projectiles.
 * Different attack visuals for each character:
 * - Gojo: Blue/purple energy spheres (Limitless)
 * - Sukuna: Red slash crescents (Cleave/Dismantle)
 * 
 * Also manages special attacks with cooldowns.
 */

import * as THREE from 'three';
import { createParticleExplosion, updateParticles } from './Utils.js';

// ============================================================
// WEAPON TIER SYSTEM — New weapon every wave (5 tiers)
// ============================================================

const WEAPON_TIERS = {
  gojo: [
    { name: 'Infinity Spark',     fireRate: 0.35, damageMultiplier: 1.0, projectileCount: 1, spread: 0,    sizeMultiplier: 1.0 },
    { name: 'Blue Infinity',      fireRate: 0.28, damageMultiplier: 1.2, projectileCount: 2, spread: 0.08, sizeMultiplier: 1.0 },
    { name: 'Limitless Barrage',  fireRate: 0.13, damageMultiplier: 1.0, projectileCount: 1, spread: 0,    sizeMultiplier: 1.1 },
    { name: 'Hollow Spread',      fireRate: 0.22, damageMultiplier: 1.4, projectileCount: 3, spread: 0.12, sizeMultiplier: 1.2 },
    { name: 'Unlimited Void',     fireRate: 0.16, damageMultiplier: 2.0, projectileCount: 2, spread: 0.06, sizeMultiplier: 1.6 },
  ],
  sukuna: [
    { name: 'Cursed Slash',       fireRate: 0.35, damageMultiplier: 1.0, projectileCount: 1, spread: 0,    sizeMultiplier: 1.0 },
    { name: 'Twin Cleave',        fireRate: 0.28, damageMultiplier: 1.2, projectileCount: 2, spread: 0.08, sizeMultiplier: 1.0 },
    { name: 'Rapid Dismantle',    fireRate: 0.13, damageMultiplier: 1.0, projectileCount: 1, spread: 0,    sizeMultiplier: 1.1 },
    { name: 'Malevolent Shrine',  fireRate: 0.22, damageMultiplier: 1.4, projectileCount: 3, spread: 0.12, sizeMultiplier: 1.2 },
    { name: 'Divine Flame',       fireRate: 0.16, damageMultiplier: 2.0, projectileCount: 2, spread: 0.06, sizeMultiplier: 1.6 },
  ],
};

// ============================================================
// PROJECTILE CONFIGURATIONS (base stats, modified by tiers)
// ============================================================

const PROJECTILE_CONFIG = {
  gojo: {
    speed: 40,
    damage: 20,
    color: 0x4488ff,
    emissive: 0x2244ff,
    size: 0.15,
    trailColor: 0x88bbff,
    lifetime: 3.0,
  },
  sukuna: {
    speed: 45,
    damage: 25,
    color: 0xff2222,
    emissive: 0xff0000,
    size: 0.12,
    trailColor: 0xff6644,
    lifetime: 3.0,
  },
};

const SPECIAL_CONFIG = {
  gojo: {
    speed: 25,
    damage: 60,
    color: 0x8844ff,
    emissive: 0x6622ff,
    size: 0.4,
    trailColor: 0xbb88ff,
    lifetime: 4.0,
    cooldown: 5.0, // seconds
    name: 'Hollow Purple',
  },
  sukuna: {
    speed: 35,
    damage: 50,
    color: 0xff6600,
    emissive: 0xff4400,
    size: 0.3,
    trailColor: 0xffaa44,
    lifetime: 4.0,
    cooldown: 4.0,
    name: 'Dismantle',
  },
};

// ============================================================
// WEAPONS MANAGER CLASS
// ============================================================

export class WeaponsManager {
  /**
   * @param {THREE.Scene} scene - The Three.js scene
   */
  constructor(scene) {
    this.scene = scene;
    this.projectiles = [];   // Active projectile objects
    this.particles = [];     // Active particle effects
    this.specialCooldown = 0; // Remaining cooldown time for special attack
    this.characterType = 'gojo';

    // Weapon tier system (0-4, one per wave)
    this.weaponTier = 0;
    this._tierConfig = null;

    // Shared geometry for trails (perf: avoids per-particle allocation)
    this._trailGeo = new THREE.SphereGeometry(0.04, 3, 3);
  }

  /**
   * Set which character's weapon style to use.
   * @param {string} type - 'gojo' or 'sukuna'
   */
  setCharacterType(type) {
    this.characterType = type;
    this._updateTierConfig();
  }

  /**
   * Upgrade weapon to next tier (called each wave).
   * @param {number} tier - Weapon tier (0-4)
   * @returns {object|null} The new tier config, or null if invalid
   */
  setWeaponTier(tier) {
    const tiers = WEAPON_TIERS[this.characterType];
    if (!tiers) return null;
    this.weaponTier = Math.min(tier, tiers.length - 1);
    this._updateTierConfig();
    return this._tierConfig;
  }

  /** Get current weapon name */
  getWeaponName() {
    return this._tierConfig?.name || 'Basic';
  }

  /** Get current weapon tier index */
  getWeaponTier() {
    return this.weaponTier;
  }

  /** Get current fire rate (seconds between shots) */
  getFireRate() {
    return this._tierConfig?.fireRate || 0.35;
  }

  /** @private Update cached tier config */
  _updateTierConfig() {
    const tiers = WEAPON_TIERS[this.characterType];
    if (tiers) {
      this._tierConfig = tiers[Math.min(this.weaponTier, tiers.length - 1)];
    }
  }

  /**
   * Fire projectile(s) from the given position in the given direction.
   * Uses the current weapon tier to determine count, spread, and damage.
   * 
   * @param {THREE.Vector3} origin - Where the projectile starts
   * @param {THREE.Vector3} direction - Normalized direction vector
   */
  /**
   * Fire projectile(s) from the given position in the given direction.
   * Uses the current weapon tier to determine count, spread, and damage.
   * Also supports shotgun and railgun overrides and damage power-ups.
   * 
   * @param {THREE.Vector3} origin - Where the projectile starts
   * @param {THREE.Vector3} direction - Normalized direction vector
   * @param {string|null} override - 'shotgun', 'railgun', or null
   * @param {boolean} hasDamagePowerup - Whether the 2.0x damage boost is active
   */
  shoot(origin, direction, override = null, hasDamagePowerup = false) {
    const baseConfig = PROJECTILE_CONFIG[this.characterType];
    const tier = this._tierConfig;

    // Apply tier multipliers and damage power-up
    let damageMultiplier = tier?.damageMultiplier || 1;
    if (hasDamagePowerup) {
      damageMultiplier *= 2.0;
    }

    const config = {
      ...baseConfig,
      damage: Math.round(baseConfig.damage * damageMultiplier),
      size: baseConfig.size * (tier?.sizeMultiplier || 1),
    };

    if (override === 'shotgun') {
      // Shotgun: 5-bullet wide spread (yellow-gold theme)
      config.color = 0xffcc00;
      config.emissive = 0xff9900;
      config.trailColor = 0xffddaa;
      config.size = 0.08;
      config.speed = 45;
      config.damage = Math.round(config.damage * 0.7); // slightly lower damage per pellet

      const count = 5;
      const spreadAngle = 0.15;
      const upAxis = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * spreadAngle;
        const spreadDir = direction.clone().applyAxisAngle(upAxis, offset);
        
        // Add subtle vertical spread for realism
        const rightAxis = new THREE.Vector3().crossVectors(direction, upAxis).normalize();
        const verticalOffset = (Math.random() - 0.5) * 0.06;
        spreadDir.applyAxisAngle(rightAxis, verticalOffset);
        
        this._createProjectile(origin.clone(), spreadDir, config, false, false);
      }
    } else if (override === 'railgun') {
      // Railgun: Single fast piercing beam (magenta theme)
      config.color = 0xff00ff;
      config.emissive = 0xff00bb;
      config.trailColor = 0xffaaff;
      config.size = 0.25;
      config.speed = 80;
      config.damage = Math.round(config.damage * 3.5); // Very high damage

      this._createProjectile(origin.clone(), direction.clone(), config, false, true);
    } else {
      // Normal weapons based on character type and tier
      const count = tier?.projectileCount || 1;
      const spreadAngle = tier?.spread || 0;

      if (count === 1) {
        this._createProjectile(origin.clone(), direction.clone(), config, false, false);
      } else {
        const upAxis = new THREE.Vector3(0, 1, 0);
        for (let i = 0; i < count; i++) {
          const offset = (i - (count - 1) / 2) * spreadAngle;
          const spreadDir = direction.clone().applyAxisAngle(upAxis, offset);
          this._createProjectile(origin.clone(), spreadDir, config, false, false);
        }
      }
    }
  }

  /**
   * Fire a special attack (if cooldown is ready).
   * Returns true if the special was fired, false if still on cooldown.
   * 
   * @param {THREE.Vector3} origin - Where the projectile starts
   * @param {THREE.Vector3} direction - Normalized direction vector
   * @param {boolean} hasDamagePowerup - Whether the 2.0x damage boost is active
   * @returns {boolean} Whether the special attack was fired
   */
  specialAttack(origin, direction, hasDamagePowerup = false) {
    if (this.specialCooldown > 0) return false;

    const baseConfig = SPECIAL_CONFIG[this.characterType];
    const config = {
      ...baseConfig,
      damage: Math.round(baseConfig.damage * (hasDamagePowerup ? 2.0 : 1.0)),
    };
    this._createProjectile(origin, direction, config, true, false);
    this.specialCooldown = config.cooldown;
    return true;
  }

  /**
   * Creates a projectile mesh and adds it to the active projectiles list.
   * Uses emissive materials instead of per-projectile PointLights for performance.
   * @private
   */
  _createProjectile(origin, direction, config, isSpecial, isRailgun = false) {
    // Create the projectile mesh with emissive glow (no PointLight needed)
    let mesh;
    const mat = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.95,
    });

    if (isRailgun) {
      // Railgun: elongated cylinder aligned along direction
      const geo = new THREE.CylinderGeometry(config.size * 0.2, config.size * 0.2, config.size * 2.5, 6);
      mesh = new THREE.Mesh(geo, mat);
      
      const alignAxis = new THREE.Vector3(0, 1, 0);
      mesh.quaternion.setFromUnitVectors(alignAxis, direction.clone().normalize());
    } else if (this.characterType === 'sukuna' && !isSpecial) {
      // Sukuna's normal attack: crescent slash shape
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.absarc(0, 0, config.size, 0, Math.PI, false);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
      mesh = new THREE.Mesh(geo, mat);
    } else {
      // Gojo's attacks and specials: energy sphere
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(config.size, isSpecial ? 8 : 6, isSpecial ? 8 : 6),
        mat
      );
    }

    mesh.position.copy(origin);

    // Only add a PointLight to special attacks (not every normal projectile)
    if (isSpecial) {
      const light = new THREE.PointLight(config.color, 2, 8);
      mesh.add(light);
    } else if (isRailgun) {
      // Railgun has a glowing magenta point light
      const light = new THREE.PointLight(config.color, 1.5, 6);
      mesh.add(light);
    }

    this.scene.add(mesh);

    // Store projectile data
    this.projectiles.push({
      mesh,
      velocity: direction.clone().multiplyScalar(config.speed),
      damage: config.damage,
      lifetime: config.lifetime,
      age: 0,
      isSpecial,
      isRailgun,
      hitEnemies: isRailgun ? new Set() : null,
      color: config.color,
      trailColor: config.trailColor,
      trailTimer: 0,
    });
  }

  /**
   * Update all active projectiles: move them, check lifetime, spawn trails.
   * Call this every frame.
   * 
   * @param {number} delta - Frame delta time in seconds
   */
  update(delta) {
    // Update special attack cooldown
    if (this.specialCooldown > 0) {
      this.specialCooldown = Math.max(0, this.specialCooldown - delta);
    }

    // Update projectiles
    this.projectiles = this.projectiles.filter(proj => {
      // Move projectile (avoid clone — use addScaledVector)
      proj.mesh.position.addScaledVector(proj.velocity, delta);

      // Age the projectile
      proj.age += delta;

      // Rotate for visual effect
      if (!proj.isRailgun) {
        proj.mesh.rotation.x += delta * 5;
        proj.mesh.rotation.z += delta * 3;
      } else {
        // Rotate railgun cylinder around its local length axis
        proj.mesh.rotateY(delta * 10);
      }

      // Spawn trail particles at reduced rate (50ms instead of 30ms)
      proj.trailTimer += delta;
      if (proj.trailTimer > 0.05) {
        proj.trailTimer = 0;
        this._spawnTrailParticle(proj);
      }

      // Remove if too old
      if (proj.age >= proj.lifetime) {
        this._removeProjectile(proj);
        return false;
      }

      return true;
    });

    // Update particles
    this.particles = updateParticles(this.particles, delta, this.scene);
  }

  /**
   * Spawns a small trail particle behind a projectile.
   * Uses shared geometry for performance.
   * @private
   */
  _spawnTrailParticle(proj) {
    const trailMesh = new THREE.Mesh(
      this._trailGeo,
      new THREE.MeshBasicMaterial({
        color: proj.trailColor,
        transparent: true,
        opacity: 0.6,
      })
    );
    trailMesh.position.copy(proj.mesh.position);
    this.scene.add(trailMesh);

    this.particles.push({
      mesh: trailMesh,
      velocity: new THREE.Vector3(0, 0, 0),
      life: 0.35,
      decay: 2.5,
    });
  }

  /**
   * Check collisions between active projectiles and an array of enemies.
   * Returns an array of { enemy, damage, position, isSpecial } for each hit.
   * Hit projectiles are removed.
   * 
   * @param {Array} enemies - Array of enemy objects with .position and .radius
   * @returns {Array} Array of hit records
   */
  checkCollisions(enemies) {
    const hits = [];

    this.projectiles = this.projectiles.filter(proj => {
      for (const enemy of enemies) {
        if (!enemy.alive) continue;

        // Skip if this enemy was already hit by this piercing railgun projectile
        if (proj.isRailgun && proj.hitEnemies.has(enemy)) continue;

        const distanceSq = proj.mesh.position.distanceToSquared(enemy.getPosition());
        const hitRadius = enemy.getRadius() + 0.3;
        const hitRadiusSq = hitRadius * hitRadius;

        if (distanceSq < hitRadiusSq) {
          // HIT! Record the hit
          hits.push({
            enemy,
            damage: proj.damage,
            position: proj.mesh.position.clone(),
            isSpecial: proj.isSpecial,
          });

          // Create impact particles
          const impactParticles = createParticleExplosion(
            this.scene,
            proj.mesh.position.clone(),
            proj.color,
            proj.isSpecial ? 20 : 8
          );
          this.particles.push(...impactParticles);

          if (proj.isRailgun) {
            // Railgun pierces: record hit but do not delete projectile
            proj.hitEnemies.add(enemy);
          } else {
            // Remove normal projectile
            this._removeProjectile(proj);
            return false;
          }
        }
      }
      return true;
    });

    return hits;
  }

  /**
   * Remove a projectile mesh from the scene and clean up.
   * @private
   */
  _removeProjectile(proj) {
    this.scene.remove(proj.mesh);
    if (proj.mesh.geometry) proj.mesh.geometry.dispose();
    if (proj.mesh.material) proj.mesh.material.dispose();
  }

  /**
   * Get the current special attack cooldown as a percentage (0-1).
   * 0 = ready, 1 = full cooldown.
   */
  getSpecialCooldownPercent() {
    const maxCooldown = SPECIAL_CONFIG[this.characterType]?.cooldown || 5;
    return this.specialCooldown / maxCooldown;
  }

  /**
   * Check if special attack is ready.
   */
  isSpecialReady() {
    return this.specialCooldown <= 0;
  }

  /**
   * Get the max cooldown for the current character's special.
   */
  getMaxCooldown() {
    return SPECIAL_CONFIG[this.characterType]?.cooldown || 5;
  }

  /**
   * Clean up all projectiles and particles.
   */
  dispose() {
    this.projectiles.forEach(proj => this._removeProjectile(proj));
    this.projectiles = [];

    this.particles.forEach(p => {
      this.scene.remove(p.mesh);
      if (p.mesh.geometry) p.mesh.geometry.dispose();
      if (p.mesh.material) p.mesh.material.dispose();
    });
    this.particles = [];
  }
}
