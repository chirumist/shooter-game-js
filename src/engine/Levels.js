/**
 * Levels.js — Level environments for the 3D shooter game
 * 
 * Contains three distinct level classes:
 * 1. JungleLevel — Dense forest with trees and green fog
 * 2. CityLevel  — Neon-lit night city with buildings
 * 3. WaterLevel — Floating platforms over animated water
 * 
 * Each level provides:
 * - load(scene)       → Build and add level geometry to scene
 * - update(delta)     → Animate level elements per frame
 * - cleanup(scene)    → Remove all level objects from scene
 * - getSpawnPoints()  → Enemy spawn positions
 * - getPlayerSpawn()  → Player starting position
 * - getBounds()       → Level boundary limits
 * - getObstacles()    → Collidable objects for collision detection
 */

import * as THREE from 'three';
import { randomRange, randomInt } from './Utils.js';

// ============================================================
// BASE LEVEL CLASS
// ============================================================

class BaseLevel {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.objects = [];      // All meshes added to scene
    this.obstacles = [];    // Collidable objects (with bounding boxes)
    this.spawnPoints = [];  // Enemy spawn positions
    this.ground = null;
    this.animatables = [];  // Objects that need per-frame updates
  }

  /** Add an object to scene and track it */
  _addToScene(scene, mesh) {
    scene.add(mesh);
    this.objects.push(mesh);
  }

  /** Create the ground plane */
  _createGround(scene, color, size = 100) {
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.9,
      metalness: 0.0,
    });
    this.ground = new THREE.Mesh(geometry, material);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this._addToScene(scene, this.ground);
  }

  /** Create visible themed boundary walls */
  _createBoundaries(scene, size = 48) {
    const wallGeo = new THREE.BoxGeometry(size, 8, 1);
    
    // Glassmorphic neon fence material
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x111122,
      roughness: 0.3,
      metalness: 0.8,
      transparent: true,
      opacity: 0.35,
      emissive: 0x8844ff,
      emissiveIntensity: 0.15,
      side: THREE.DoubleSide
    });

    const positions = [
      { x: 0, z: -size / 2, ry: 0 },
      { x: 0, z: size / 2, ry: 0 },
      { x: -size / 2, z: 0, ry: Math.PI / 2 },
      { x: size / 2, z: 0, ry: Math.PI / 2 },
    ];

    positions.forEach(pos => {
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(pos.x, 4, pos.z);
      wall.rotation.y = pos.ry;
      wall.userData.isWall = true;
      this._addToScene(scene, wall);

      // Create a neon trim along the top of each wall
      const trimGeo = new THREE.BoxGeometry(size, 0.15, 1.05);
      const trimMat = new THREE.MeshBasicMaterial({ color: 0x8844ff });
      const trim = new THREE.Mesh(trimGeo, trimMat);
      trim.position.set(pos.x, 8, pos.z);
      trim.rotation.y = pos.ry;
      this._addToScene(scene, trim);

      // Add to collision obstacles
      const obstacleBox = new THREE.Box3().setFromObject(wall);
      this.obstacles.push({
        position: new THREE.Vector3(pos.x, 4, pos.z),
        radius: 0.5,
        box: obstacleBox
      });
    });
  }

  /** Set up scene lighting and fog */
  _setupAtmosphere(scene, ambientColor, ambientIntensity, fogColor, fogNear, fogFar) {
    // Ambient light
    const ambient = new THREE.AmbientLight(ambientColor, ambientIntensity);
    ambient.name = 'levelAmbient';
    this._addToScene(scene, ambient);
    this.ambientLight = ambient;

    // Hemisphere light for natural sky/ground fill (very cheap, great visual upgrade)
    const hemi = new THREE.HemisphereLight(
      0xccddff, // Sky color (cool blue)
      0x443322, // Ground color (warm brown)
      0.35
    );
    hemi.name = 'levelHemi';
    this._addToScene(scene, hemi);
    this.hemiLight = hemi;

    scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
    scene.background = new THREE.Color(fogColor);
  }

  /** Create a directional light (sun/moon) */
  _createDirectionalLight(scene, color, intensity, x, y, z) {
    const dirLight = new THREE.DirectionalLight(color, intensity);
    dirLight.position.set(x, y, z);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -30;
    this._addToScene(scene, dirLight);
    return dirLight;
  }

  /** Called once to build the level */
  load(_scene) {
    throw new Error('Subclass must implement load()');
  }

  /** Called every frame for level animations */
  update(_delta, _scene) {
    // Base: no-op. Subclasses override for animated levels.
  }

  /** Get player starting position */
  getPlayerSpawn() {
    return new THREE.Vector3(0, 0, 0);
  }

  /** Get enemy spawn positions */
  getSpawnPoints() {
    return this.spawnPoints;
  }

  /** Get level boundary limits */
  getBounds() {
    return { min: -22, max: 22 };
  }

  /** Get obstacle meshes for collision checking */
  getObstacles() {
    return this.obstacles;
  }

  /** Remove all level objects from scene */
  cleanup(scene) {
    this.objects.forEach(obj => {
      scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    this.objects = [];
    this.obstacles = [];
    this.spawnPoints = [];
    this.animatables = [];
    scene.fog = null;
  }
}

// ============================================================
// LEVEL 1: JUNGLE
// ============================================================

export class JungleLevel extends BaseLevel {
  constructor() {
    super('JUNGLE DOMAIN', {
      groundColor: 0x2a4a1a,
      fogColor: 0x1a2e1a,
      ambientColor: 0x88aa66,
      treeCount: 60,
      bushCount: 30,
    });
  }

  load(scene) {
    const c = this.config;

    // Atmosphere — green misty jungle
    this._setupAtmosphere(scene, c.ambientColor, 0.6, c.fogColor, 15, 60);
    this._createDirectionalLight(scene, 0xffffdd, 0.8, 10, 25, 10);

    // Dappled light through canopy
    const canopyLight = new THREE.PointLight(0x88cc44, 0.5, 30);
    canopyLight.position.set(-5, 12, -5);
    this._addToScene(scene, canopyLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({
      color: c.groundColor,
      roughness: 0.85,
      metalness: 0.05,
    });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this._addToScene(scene, this.ground);

    // Ground detail — subtle height variation via small bumps
    for (let i = 0; i < 40; i++) {
      const bump = new THREE.Mesh(
        new THREE.SphereGeometry(randomRange(0.5, 2), 6, 4),
        new THREE.MeshStandardMaterial({ color: 0x335522, roughness: 1.0 })
      );
      bump.position.set(randomRange(-40, 40), -0.3, randomRange(-40, 40));
      bump.scale.y = 0.3;
      bump.receiveShadow = true;
      this._addToScene(scene, bump);
    }

    // Trees — procedural (trunk + canopy)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 });
    const canopyColors = [0x2a6a1a, 0x3a7a2a, 0x1a5a0a, 0x4a8a3a];

    for (let i = 0; i < c.treeCount; i++) {
      const x = randomRange(-40, 40);
      const z = randomRange(-40, 40);

      // Don't place trees too close to player spawn
      if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;

      const treeGroup = new THREE.Group();
      const height = randomRange(3, 6);

      // Trunk
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.2, height, 6),
        trunkMat
      );
      trunk.position.y = height / 2;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      // Canopy (layered cones)
      const canopyMat = new THREE.MeshStandardMaterial({
        color: canopyColors[randomInt(0, canopyColors.length - 1)],
        roughness: 0.8,
      });

      for (let j = 0; j < 3; j++) {
        const radius = randomRange(1.0, 2.0) - j * 0.3;
        const canopy = new THREE.Mesh(
          new THREE.ConeGeometry(radius, 2, 7),
          canopyMat
        );
        canopy.position.y = height + j * 1.0;
        canopy.castShadow = true;
        treeGroup.add(canopy);
      }

      treeGroup.position.set(x, 0, z);
      this._addToScene(scene, treeGroup);

      // Add trunk as obstacle for collision
      const obstacleBox = new THREE.Box3().setFromObject(trunk);
      obstacleBox.translate(new THREE.Vector3(x, 0, z));
      this.obstacles.push({ position: new THREE.Vector3(x, 0, z), radius: 0.3, box: obstacleBox });
    }

    // Bushes
    for (let i = 0; i < c.bushCount; i++) {
      const bush = new THREE.Mesh(
        new THREE.SphereGeometry(randomRange(0.4, 0.8), 6, 5),
        new THREE.MeshStandardMaterial({
          color: canopyColors[randomInt(0, canopyColors.length - 1)],
          roughness: 0.9,
        })
      );
      bush.position.set(
        randomRange(-35, 35),
        randomRange(0.2, 0.4),
        randomRange(-35, 35)
      );
      bush.scale.y = 0.7;
      bush.castShadow = true;
      this._addToScene(scene, bush);
    }

    // Boundaries
    this._createBoundaries(scene);

    // Spawn points (around edges)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this.spawnPoints.push(
        new THREE.Vector3(Math.cos(angle) * 20, 0, Math.sin(angle) * 20)
      );
    }
  }

  getPlayerSpawn() {
    return new THREE.Vector3(0, 0, 0);
  }

  update(_delta) {
    // Subtle ambient animation — could animate fog or light
  }
}

// ============================================================
// LEVEL 2: CITY
// ============================================================

export class CityLevel extends BaseLevel {
  constructor() {
    super('SHIBUYA DOMAIN', {
      groundColor: 0x556070,     // Daytime concrete/asphalt grey
      fogColor: 0xd0e2f5,        // Bright daylight blue-grey sky/fog
      ambientColor: 0x9db4c0,    // Bright sky ambient fill
      buildingCount: 30,
    });
    this.neonLights = [];
  }

  load(scene) {
    const c = this.config;

    // Atmosphere — bright daylight city
    this._setupAtmosphere(scene, c.ambientColor, 0.8, c.fogColor, 35, 90);
    
    // Sunlight — bright white directional light with shadows
    this._createDirectionalLight(scene, 0xffffff, 1.2, -15, 30, 10);

    // Ground (asphalt)
    this._createGround(scene, c.groundColor, 100);

    // Road markings
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.7 });
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xddcc44, roughness: 0.5 });

    // Main roads (cross pattern)
    [-1, 1].forEach(_dir => {
      const road = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.02, 90),
        roadMat
      );
      road.position.y = 0.01;
      road.receiveShadow = true;
      this._addToScene(scene, road);

      // Center line
      for (let i = -40; i < 40; i += 4) {
        const line = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.03, 1.5),
          lineMat
        );
        line.position.set(0, 0.025, i);
        this._addToScene(scene, line);
      }
    });

    const crossRoad = new THREE.Mesh(
      new THREE.BoxGeometry(90, 0.02, 6),
      roadMat
    );
    crossRoad.position.y = 0.01;
    this._addToScene(scene, crossRoad);

    // Buildings — procedural boxes with modern day materials
    const buildingAreas = [
      { minX: 5, maxX: 40, minZ: 5, maxZ: 40 },
      { minX: -40, maxX: -5, minZ: 5, maxZ: 40 },
      { minX: 5, maxX: 40, minZ: -40, maxZ: -5 },
      { minX: -40, maxX: -5, minZ: -40, maxZ: -5 },
    ];

    // Modern bright building concrete/stone colors
    const buildingColors = [0xe8ecef, 0xd8e0e5, 0xc8d0d5, 0xb8c2cc, 0xf0f3f5, 0xccd4db];
    const bannerColors = [0xff00ff, 0x00ffff, 0xff4444, 0x44ff44, 0xffaa00, 0x4444ff];

    buildingAreas.forEach(area => {
      const count = randomInt(6, 9);
      for (let i = 0; i < count; i++) {
        const x = randomRange(area.minX, area.maxX);
        const z = randomRange(area.minZ, area.maxZ);
        const width = randomRange(3, 8);
        const depth = randomRange(3, 8);
        const height = randomRange(5, 20);

        const building = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          new THREE.MeshStandardMaterial({
            color: buildingColors[randomInt(0, buildingColors.length - 1)],
            roughness: 0.6,
            metalness: 0.2,
          })
        );
        building.position.set(x, height / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        this._addToScene(scene, building);

        // Add as obstacle
        this.obstacles.push({
          position: new THREE.Vector3(x, 0, z),
          radius: Math.max(width, depth) / 2,
          box: new THREE.Box3().setFromObject(building),
        });

        // Modern glass facade vertical stripes (highly optimized: only 1 mesh per building, metallic blue)
        if (Math.random() > 0.4) {
          const stripeWidth = width * randomRange(0.25, 0.4);
          const stripeGeo = new THREE.BoxGeometry(stripeWidth, height + 0.1, depth + 0.05);
          const stripeMat = new THREE.MeshStandardMaterial({
            color: 0x5080b0,
            roughness: 0.1,
            metalness: 0.9,
          });
          const stripe = new THREE.Mesh(stripeGeo, stripeMat);
          stripe.position.set(x, height / 2, z);
          stripe.castShadow = true;
          stripe.receiveShadow = true;
          this._addToScene(scene, stripe);
        }

        // Colorful architectural detail banners (vibrant orange/cyan/magenta panels)
        if (Math.random() > 0.6) {
          const bannerColor = bannerColors[randomInt(0, bannerColors.length - 1)];
          const bannerGeo = new THREE.BoxGeometry(width * 0.5, height * 0.6, depth + 0.08);
          const bannerMat = new THREE.MeshStandardMaterial({
            color: bannerColor,
            roughness: 0.4,
            metalness: 0.1,
          });
          const banner = new THREE.Mesh(bannerGeo, bannerMat);
          banner.position.set(x, height * 0.5, z);
          banner.castShadow = true;
          banner.receiveShadow = true;
          this._addToScene(scene, banner);
        }
      }
    });

    // Street lamps along roads (Daytime: keep geometry but remove PointLights for optimization)
    for (let i = -35; i <= 35; i += 20) {
      [-3.5, 3.5].forEach(offset => {
        const poleGeo = new THREE.CylinderGeometry(0.05, 0.06, 5, 4);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x555566, metalness: 0.5 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(offset, 2.5, i);
        pole.castShadow = true;
        this._addToScene(scene, pole);

        // Light fixture (bulbs off during daytime)
        const fixture = new THREE.Mesh(
          new THREE.SphereGeometry(0.15, 4, 4),
          new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.4 })
        );
        fixture.position.set(offset, 5.1, i);
        this._addToScene(scene, fixture);
      });
    }

    // Boundaries
    this._createBoundaries(scene);

    // Spawn points
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      this.spawnPoints.push(
        new THREE.Vector3(Math.cos(angle) * 18, 0, Math.sin(angle) * 18)
      );
    }
  }

  getPlayerSpawn() {
    return new THREE.Vector3(0, 0, 0);
  }

  update(_delta) {
    // Daytime — no active neon flickering updates needed
  }
}

// ============================================================
// LEVEL 3: WATER
// ============================================================

export class WaterLevel extends BaseLevel {
  constructor() {
    super('OCEAN DOMAIN', {
      fogColor: 0x0a1a2e,
      ambientColor: 0x4488bb,
    });
    this.waterMesh = null;
    this.platforms = [];
    this.movingPlatforms = [];
    this.time = 0;
  }

  load(scene) {
    const c = this.config;

    // Atmosphere — deep ocean blue
    this._setupAtmosphere(scene, c.ambientColor, 0.5, c.fogColor, 20, 80);
    this._createDirectionalLight(scene, 0xaaddff, 0.7, 5, 25, 10);

    // Underwater caustic lights
    for (let i = 0; i < 5; i++) {
      const caustic = new THREE.PointLight(0x44aaff, 0.6, 15);
      caustic.position.set(
        randomRange(-20, 20),
        -1,
        randomRange(-20, 20)
      );
      this._addToScene(scene, caustic);
      this.animatables.push(caustic);
    }

    // Water plane (translucent, animated)
    const waterGeo = new THREE.PlaneGeometry(120, 120, 60, 60);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1166aa,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.y = -2;
    this.waterMesh.receiveShadow = true;
    this._addToScene(scene, this.waterMesh);

    // Floating platforms (the actual playable ground)
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x556677,
      roughness: 0.7,
      metalness: 0.2,
    });
    const platformEdgeMat = new THREE.MeshStandardMaterial({
      color: 0x44aadd,
      emissive: 0x2288aa,
      emissiveIntensity: 0.5,
    });

    // Main central platform (large)
    const mainPlatform = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 6, 0.5, 12),
      platformMat
    );
    mainPlatform.position.y = 0;
    mainPlatform.receiveShadow = true;
    mainPlatform.castShadow = true;
    this._addToScene(scene, mainPlatform);
    this.obstacles.push({
      position: new THREE.Vector3(0, 0, 0),
      radius: 6,
      isGround: true,
    });
    this.platforms.push({ mesh: mainPlatform, radius: 6 });

    // Edge glow for main platform
    const mainEdge = new THREE.Mesh(
      new THREE.TorusGeometry(6, 0.08, 8, 24),
      platformEdgeMat
    );
    mainEdge.rotation.x = Math.PI / 2;
    mainEdge.position.y = 0.25;
    this._addToScene(scene, mainEdge);

    // Surrounding platforms (medium)
    const surroundPositions = [
      { x: 14, z: 0 }, { x: -14, z: 0 },
      { x: 0, z: 14 }, { x: 0, z: -14 },
      { x: 10, z: 10 }, { x: -10, z: 10 },
      { x: 10, z: -10 }, { x: -10, z: -10 },
    ];

    surroundPositions.forEach(pos => {
      const radius = randomRange(2.5, 4);
      const plat = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, 0.4, 10),
        platformMat
      );
      plat.position.set(pos.x, randomRange(-0.5, 0.5), pos.z);
      plat.receiveShadow = true;
      plat.castShadow = true;
      this._addToScene(scene, plat);
      this.obstacles.push({
        position: new THREE.Vector3(pos.x, plat.position.y, pos.z),
        radius: radius,
        isGround: true,
      });
      this.platforms.push({ mesh: plat, radius });

      // Edge glow
      const edge = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.06, 8, 20),
        platformEdgeMat
      );
      edge.rotation.x = Math.PI / 2;
      edge.position.set(pos.x, plat.position.y + 0.2, pos.z);
      this._addToScene(scene, edge);
    });

    // Moving platforms (bridges between areas)
    const movingDefs = [
      { start: { x: 7, z: 0 }, end: { x: 7, z: 7 }, speed: 1.5 },
      { start: { x: -7, z: 0 }, end: { x: -7, z: -7 }, speed: 1.2 },
      { start: { x: 0, z: 7 }, end: { x: 7, z: 7 }, speed: 1.8 },
    ];

    movingDefs.forEach(def => {
      const plat = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 0.3, 2.5),
        new THREE.MeshStandardMaterial({
          color: 0x668899,
          roughness: 0.5,
          emissive: 0x224455,
          emissiveIntensity: 0.3,
        })
      );
      plat.position.set(def.start.x, 0, def.start.z);
      plat.castShadow = true;
      this._addToScene(scene, plat);

      this.movingPlatforms.push({
        mesh: plat,
        start: new THREE.Vector3(def.start.x, 0, def.start.z),
        end: new THREE.Vector3(def.end.x, 0, def.end.z),
        speed: def.speed,
        t: 0,
        direction: 1,
      });
    });

    // Waterfall particles (decorative columns of "water")
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const dist = 25;

      // Waterfall column
      const fall = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.3, 15, 8),
        new THREE.MeshBasicMaterial({
          color: 0x66bbff,
          transparent: true,
          opacity: 0.3,
        })
      );
      fall.position.set(
        Math.cos(angle) * dist,
        5,
        Math.sin(angle) * dist
      );
      this._addToScene(scene, fall);
      this.animatables.push(fall);
    }

    // Coral/rock decorations around platforms
    for (let i = 0; i < 20; i++) {
      const coral = new THREE.Mesh(
        new THREE.ConeGeometry(randomRange(0.3, 0.8), randomRange(1, 3), 5),
        new THREE.MeshStandardMaterial({
          color: [0xff6688, 0xff8844, 0x44ccaa, 0xaa66ff][randomInt(0, 3)],
          roughness: 0.7,
        })
      );
      coral.position.set(
        randomRange(-30, 30),
        -1.5,
        randomRange(-30, 30)
      );
      this._addToScene(scene, coral);
    }

    // No traditional boundaries — falling off platforms is the hazard
    // But add spawn points on platforms
    surroundPositions.forEach(pos => {
      this.spawnPoints.push(new THREE.Vector3(pos.x, 1, pos.z));
    });
  }

  getPlayerSpawn() {
    return new THREE.Vector3(0, 1, 0);
  }

  getBounds() {
    return { min: -30, max: 30 };
  }

  update(delta) {
    this.time += delta;

    // Animate water surface (wave effect)
    if (this.waterMesh) {
      const positions = this.waterMesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        // Only modify Y (which is actually Z after rotation)
        // Since the plane is rotated, we modify Y in local space
        const wave = Math.sin(x * 0.3 + this.time * 1.5) * 0.3 +
                     Math.cos(z * 0.3 + this.time * 1.2) * 0.2;
        positions.setZ(i, wave); // Z in local space = Y in world after rotation
      }
      positions.needsUpdate = true;
    }

    // Animate moving platforms (back and forth)
    this.movingPlatforms.forEach(mp => {
      mp.t += mp.direction * mp.speed * delta * 0.3;
      if (mp.t >= 1) { mp.t = 1; mp.direction = -1; }
      if (mp.t <= 0) { mp.t = 0; mp.direction = 1; }

      mp.mesh.position.lerpVectors(mp.start, mp.end, mp.t);
    });

    // Animate caustic lights
    this.animatables.forEach((obj, i) => {
      if (obj.isPointLight) {
        obj.intensity = 0.4 + Math.sin(this.time * 2 + i) * 0.3;
      }
    });
  }
}

// ============================================================
// LEVEL 4: UNLIMITED VOID (Infinity Survival)
// ============================================================

export class UnlimitedVoidLevel extends BaseLevel {
  constructor() {
    super('UNLIMITED VOID', {
      groundColor: 0x050512,
      fogColor: 0x020208,
      ambientColor: 0x554488,
    });
    this.time = 0;
  }

  load(scene) {
    const c = this.config;

    // Atmosphere — deep violet void
    this._setupAtmosphere(scene, c.ambientColor, 0.4, c.fogColor, 20, 70);
    this.dirLight = this._createDirectionalLight(scene, 0xbb88ff, 0.8, 5, 25, 5);

    // Glowing point lights representing floating cursed energy rifts
    for (let idx = 0; idx < 4; idx++) {
      const colors = [0x4488ff, 0x8844ff, 0xff2222, 0x00ffcc];
      const rift = new THREE.PointLight(colors[idx], 1.2, 20);
      const angle = (idx / 4) * Math.PI * 2;
      rift.position.set(Math.cos(angle) * 15, 2, Math.sin(angle) * 15);
      this._addToScene(scene, rift);
      this.animatables.push(rift);
    }

    // Ground platform (circular obsidian platform)
    const groundGeo = new THREE.CylinderGeometry(25, 25, 0.5, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: c.groundColor,
      roughness: 0.2,
      metalness: 0.9,
    });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.position.y = -0.25;
    this.ground.receiveShadow = true;
    this._addToScene(scene, this.ground);

    // Obstacles - floating monoliths
    const blockMat = new THREE.MeshStandardMaterial({
      color: 0x110c22,
      roughness: 0.1,
      metalness: 0.95,
      emissive: 0x0a0518,
    });

    const positions = [
      { x: 10, z: 10 }, { x: -10, z: 10 },
      { x: 10, z: -10 }, { x: -10, z: -10 }
    ];

    positions.forEach((pos, idx) => {
      const height = randomRange(4, 8);
      const width = randomRange(2, 3);
      
      const monolith = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, width),
        blockMat
      );
      monolith.position.set(pos.x, height / 2, pos.z);
      monolith.castShadow = true;
      monolith.receiveShadow = true;
      this._addToScene(scene, monolith);

      // Neon glowing horizontal bands around monoliths
      const stripeGeo = new THREE.BoxGeometry(width + 0.05, 0.15, width + 0.05);
      const colors = [0x4488ff, 0x8844ff, 0xff2222, 0x00ffcc];
      const stripeMat = new THREE.MeshBasicMaterial({
        color: colors[idx % 4],
      });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.set(pos.x, height * 0.7, pos.z);
      this._addToScene(scene, stripe);

      // Add to collision obstacles list
      const obstacleBox = new THREE.Box3().setFromObject(monolith);
      this.obstacles.push({
        position: new THREE.Vector3(pos.x, 0, pos.z),
        radius: width * 0.7,
        box: obstacleBox
      });
    });

    // Invisible boundary walls
    this._createBoundaries(scene, 50);

    // Spawn points around the circular platform edge
    for (let idx = 0; idx < 8; idx++) {
      const angle = (idx / 8) * Math.PI * 2;
      this.spawnPoints.push(
        new THREE.Vector3(Math.cos(angle) * 18, 0.5, Math.sin(angle) * 18)
      );
    }
  }

  getPlayerSpawn() {
    return new THREE.Vector3(0, 1, 0);
  }

  getBounds() {
    return { min: -24, max: 24 };
  }

  update(delta, scene) {
    this.time += delta;

    // Light/Dark Cycle (30s Light, 30s Dark, with 3s smooth lerp transitions)
    const cycleProgress = this.time % 60;
    let t = 1; // 1 = fully Light, 0 = fully Dark
    if (cycleProgress < 30) {
      // Light Mode Phase: transition from Dark to Light over the first 3s
      t = cycleProgress < 3.0 ? (cycleProgress / 3.0) : 1.0;
    } else {
      // Dark Mode Phase: transition from Light to Dark over the first 3s
      const darkProgress = cycleProgress - 30;
      t = darkProgress < 3.0 ? (1.0 - (darkProgress / 3.0)) : 0.0;
    }

    // Smoothly interpolate Fog and Lights
    if (scene && scene.fog) {
      // Dark fog is near black (0x020208), light fog is bright indigo (0x3a2c73)
      const fogColor = new THREE.Color(0x020208).lerp(new THREE.Color(0x3a2c73), t);
      scene.fog.color.copy(fogColor);
      scene.background.copy(fogColor);
    }

    if (this.ambientLight) {
      // Dark ambient color/intensity vs light ambient color/intensity
      const ambientColor = new THREE.Color(0x1a0d33).lerp(new THREE.Color(0x665599), t);
      this.ambientLight.color.copy(ambientColor);
      this.ambientLight.intensity = THREE.MathUtils.lerp(0.15, 0.8, t);
    }

    if (this.hemiLight) {
      this.hemiLight.intensity = THREE.MathUtils.lerp(0.1, 0.45, t);
    }

    if (this.dirLight) {
      this.dirLight.intensity = THREE.MathUtils.lerp(0.08, 1.2, t);
    }

    // Animate point lights (cursed energy rifts)
    this.animatables.forEach((light, i) => {
      if (light.isPointLight) {
        // Point lights shine brighter and pulse harder in Dark mode for atmospheric glow
        const baseIntensity = THREE.MathUtils.lerp(1.6, 1.0, t);
        light.intensity = baseIntensity + Math.sin(this.time * 2.5 + i) * 0.4;
        const angle = this.time * 0.2 + (i * Math.PI / 2);
        light.position.x = Math.cos(angle) * 15;
        light.position.z = Math.sin(angle) * 15;
      }
    });
  }
}

// ============================================================
// LEVEL FACTORY
// ============================================================

/**
 * Creates a level instance by index.
 * @param {number} index - 0=Jungle, 1=City, 2=Water, 3=Unlimited Void
 * @returns {BaseLevel} Level instance
 */
export function createLevel(index) {
  switch (index) {
    case 0: return new JungleLevel();
    case 1: return new CityLevel();
    case 2: return new WaterLevel();
    case 3: return new UnlimitedVoidLevel();
    default: return new JungleLevel();
  }
}

/** Level metadata for UI display */
export const LEVEL_INFO = [
  { name: 'JUNGLE DOMAIN', subtitle: 'Purify the cursed forest', waves: 5, enemies: { melee: 3, ranged: 1 } },
  { name: 'SHIBUYA DOMAIN', subtitle: 'Survive the neon nightmare', waves: 5, enemies: { melee: 4, ranged: 2 } },
  { name: 'OCEAN DOMAIN', subtitle: 'Conquer the abyss', waves: 5, enemies: { melee: 5, ranged: 3 } },
  { name: 'UNLIMITED VOID', subtitle: 'Survive the infinite expansion', waves: Infinity, enemies: { melee: 3, ranged: 1, flying: 1 } },
];
