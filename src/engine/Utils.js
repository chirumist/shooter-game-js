/**
 * Utils.js — Math helpers, collision detection, and particle effects
 * 
 * This module provides utility functions used across the game engine:
 * - Random number generation
 * - Clamping and interpolation
 * - 3D collision detection (AABB, sphere)
 * - Particle explosion effects
 */

import * as THREE from 'three';

// ============================================================
// RANDOM NUMBER HELPERS
// ============================================================

/** Returns a random float between min (inclusive) and max (exclusive) */
export function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

/** Returns a random integer between min and max (both inclusive) */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Returns a random element from an array */
export function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// ============================================================
// MATH HELPERS
// ============================================================

/** Clamps a value between min and max */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Linearly interpolates between a and b by factor t (0-1) */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Converts degrees to radians */
export function degToRad(degrees) {
  return degrees * (Math.PI / 180);
}

/** Smoothstep interpolation for smoother transitions */
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// ============================================================
// 3D COLLISION DETECTION
// ============================================================

/**
 * Check sphere-sphere collision between two objects.
 * Each object needs a 'position' (Vector3) and a 'radius' (number).
 */
export function checkSphereCollision(objA, objB) {
  const distance = objA.position.distanceTo(objB.position);
  return distance < (objA.radius + objB.radius);
}

/**
 * Check if a point is inside a bounding box.
 * box = { min: Vector3, max: Vector3 }
 */
export function pointInBox(point, box) {
  return (
    point.x >= box.min.x && point.x <= box.max.x &&
    point.y >= box.min.y && point.y <= box.max.y &&
    point.z >= box.min.z && point.z <= box.max.z
  );
}

/**
 * Check sphere vs AABB (Axis-Aligned Bounding Box) collision.
 * Returns true if sphere intersects the box.
 */
export function sphereBoxCollision(spherePos, sphereRadius, box) {
  const x = Math.max(box.min.x, Math.min(spherePos.x, box.max.x));
  const y = Math.max(box.min.y, Math.min(spherePos.y, box.max.y));
  const z = Math.max(box.min.z, Math.min(spherePos.z, box.max.z));

  const distance = Math.sqrt(
    (x - spherePos.x) ** 2 +
    (y - spherePos.y) ** 2 +
    (z - spherePos.z) ** 2
  );

  return distance < sphereRadius;
}

// ============================================================
// PARTICLE EFFECTS
// ============================================================

// Shared geometry for all particles (perf: avoids per-particle geometry allocation)
const _sharedParticleGeo = new THREE.SphereGeometry(0.08, 3, 3);

/**
 * Creates a burst of particle meshes at a given position.
 * Uses shared geometry for performance.
 * 
 * @param {THREE.Scene} scene - The Three.js scene to add particles to
 * @param {THREE.Vector3} position - World position for the burst
 * @param {number} color - Hex color for particles
 * @param {number} count - Number of particles to spawn
 * @returns {Array} Array of particle objects for updating
 */
export function createParticleExplosion(scene, position, color, count = 12) {
  const particles = [];

  for (let i = 0; i < count; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1.0,
    });

    const mesh = new THREE.Mesh(_sharedParticleGeo, material);
    mesh.position.copy(position);

    // Random velocity direction (spread outward in a sphere)
    const velocity = new THREE.Vector3(
      randomRange(-1, 1),
      randomRange(-0.5, 1.5),
      randomRange(-1, 1)
    ).normalize().multiplyScalar(randomRange(2, 6));

    const particle = {
      mesh,
      velocity,
      life: 1.0,           // Starts at 1, decreases to 0
      decay: randomRange(1.5, 3.0), // How fast the particle fades
    };

    scene.add(mesh);
    particles.push(particle);
  }

  return particles;
}

/**
 * Updates all active particles: moves them, fades them, removes dead ones.
 * Call this every frame in the game loop.
 * 
 * @param {Array} particles - Array of particle objects
 * @param {number} delta - Frame delta time in seconds
 * @param {THREE.Scene} scene - Scene to remove dead particles from
 * @returns {Array} Remaining alive particles
 */
export function updateParticles(particles, delta, scene) {
  return particles.filter(p => {
    // Move particle by velocity (avoid clone — use addScaledVector)
    p.mesh.position.addScaledVector(p.velocity, delta);

    // Apply gravity
    p.velocity.y -= 9.8 * delta;

    // Fade out
    p.life -= p.decay * delta;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      // Don't dispose shared geometry! Only dispose material.
      p.mesh.material.dispose();
      return false;
    }

    p.mesh.material.opacity = p.life;
    p.mesh.scale.setScalar(Math.max(0.1, p.life));
    return true;
  });
}

// ============================================================
// POSITION HELPERS
// ============================================================

/**
 * Generates a random position within given bounds on the XZ plane.
 * Y is always set to the provided height (default 0).
 */
export function randomPositionXZ(minX, maxX, minZ, maxZ, y = 0) {
  return new THREE.Vector3(
    randomRange(minX, maxX),
    y,
    randomRange(minZ, maxZ)
  );
}

/**
 * Creates an easing animation function (ease-out cubic).
 * Used for smooth camera transitions, UI animations, etc.
 */
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Creates an easing animation function (ease-in-out quad).
 */
export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ============================================================
// OBJECT POOLING
// ============================================================

/**
 * Simple object pool to reuse meshes (reduces garbage collection).
 * Used for projectiles and particles that are created/destroyed frequently.
 */
export class ObjectPool {
  constructor(createFn, resetFn, initialSize = 20) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }

  /** Get an object from the pool (or create a new one if empty) */
  get() {
    if (this.pool.length > 0) {
      const obj = this.pool.pop();
      this.resetFn(obj);
      return obj;
    }
    return this.createFn();
  }

  /** Return an object to the pool for reuse */
  release(obj) {
    this.pool.push(obj);
  }

  /** Dispose all pooled objects */
  dispose() {
    this.pool.length = 0;
  }
}

/**
 * Resolves collision between a sphere (object position & radius) and a Box3 or bounding circle.
 * Modifies the position vector to keep it outside the obstacle.
 * 
 * @param {THREE.Vector3} position - The moving object's position (modified in place)
 * @param {number} radius - The moving object's collision radius
 * @param {Array} obstacles - Array of obstacles from the level
 */
export function resolveObstacleCollisions(position, radius, obstacles) {
  if (!obstacles || obstacles.length === 0) return;

  obstacles.forEach(obs => {
    // If it has a box (Box3)
    if (obs.box) {
      // Find closest point on AABB to sphere center
      const closestPoint = new THREE.Vector3(
        Math.max(obs.box.min.x, Math.min(position.x, obs.box.max.x)),
        Math.max(obs.box.min.y, Math.min(position.y, obs.box.max.y)),
        Math.max(obs.box.min.z, Math.min(position.z, obs.box.max.z))
      );

      // Distance from closest point to sphere center
      const distance = position.distanceTo(closestPoint);

      if (distance < radius) {
        // Collision detected! Push sphere away along normal
        const pushDir = new THREE.Vector3().subVectors(position, closestPoint);
        if (pushDir.lengthSq() === 0) {
          pushDir.set(0, 0, 1);
        }
        pushDir.normalize();
        
        // Push outside the box
        const pushAmount = radius - distance;
        position.addScaledVector(pushDir, pushAmount);
      }
    } else if (obs.radius && obs.position) {
      // Circle/cylinder check (XZ plane)
      const toObs = new THREE.Vector3().subVectors(position, obs.position);
      toObs.y = 0; // Flat circular check
      const dist = toObs.length();
      const minDist = radius + obs.radius;

      if (dist < minDist) {
        toObs.normalize();
        const pushAmount = minDist - dist;
        position.addScaledVector(toObs, pushAmount);
      }
    }
  });
}
