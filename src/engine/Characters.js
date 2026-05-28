/**
 * Characters.js — Procedural 3D character model builder
 * 
 * Builds low-poly stylized character models inspired by Jujutsu Kaisen:
 * - Gojo Satoru: White hair, blindfold, blue aura
 * - Ryomen Sukuna: Pink hair, four eyes, red aura
 * - Cursed Spirit Enemies: Dark amorphous creatures
 * - Boss Enemies: Larger variants with unique features
 */

import * as THREE from 'three';

// ============================================================
// MATERIAL PRESETS
// ============================================================

const MATERIALS = {
  // Gojo materials — enhanced with subtle emissive on key parts
  gojoSkin: new THREE.MeshStandardMaterial({ color: 0xf5deb3, roughness: 0.55, metalness: 0.02 }),
  gojoHair: new THREE.MeshStandardMaterial({ color: 0xe8e8f0, roughness: 0.25, metalness: 0.15, emissive: 0x222233, emissiveIntensity: 0.15 }),
  gojoBlindfold: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.15, metalness: 0.3 }),
  gojoUniform: new THREE.MeshStandardMaterial({ color: 0x1a1a3e, roughness: 0.45, metalness: 0.08 }),
  gojoCollar: new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.35, metalness: 0.05 }),

  // Sukuna materials — warm tones with emissive on markings
  sukunaSkin: new THREE.MeshStandardMaterial({ color: 0xf0d0b0, roughness: 0.55, metalness: 0.02 }),
  sukunaHair: new THREE.MeshStandardMaterial({ color: 0xe8a0b0, roughness: 0.25, metalness: 0.1, emissive: 0x331111, emissiveIntensity: 0.15 }),
  sukunaKimono: new THREE.MeshStandardMaterial({ color: 0x2a1520, roughness: 0.45, metalness: 0.08 }),
  sukunaMarks: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.2, emissive: 0x110000, emissiveIntensity: 0.3 }),
  sukunaSash: new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.35, emissive: 0x330000, emissiveIntensity: 0.2 }),

  // Enemy materials — enhanced for menacing glow
  cursedFlesh: new THREE.MeshStandardMaterial({ color: 0x2d1f3d, roughness: 0.7, metalness: 0.15, emissive: 0x0d0818, emissiveIntensity: 0.3 }),
  cursedEyes: new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff0000, emissiveIntensity: 2.5 }),
  cursedArmor: new THREE.MeshStandardMaterial({ color: 0x1a0a2e, roughness: 0.35, metalness: 0.4, emissive: 0x0a0520, emissiveIntensity: 0.2 }),

  // Boss materials — stronger glow
  bossBody: new THREE.MeshStandardMaterial({ color: 0x3d1a4a, roughness: 0.5, metalness: 0.3, emissive: 0x1a0a2a, emissiveIntensity: 0.25 }),
  bossEyes: new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 3.5 }),
};

// ============================================================
// GOJO SATORU MODEL
// ============================================================

/**
 * Builds a procedural Gojo Satoru character model.
 * Features: White/silver spiky hair, black blindfold, dark blue uniform,
 * white collar, blue aura glow.
 * 
 * @returns {THREE.Group} The complete character model
 */
export function buildGojo() {
  const group = new THREE.Group();
  group.name = 'gojo';

  // ---- BODY (torso) ----
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.3, 1.0, 8),
    MATERIALS.gojoUniform
  );
  torso.position.y = 1.2;
  torso.castShadow = true;
  group.add(torso);

  // ---- COLLAR (white high collar) ----
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.36, 0.2, 8),
    MATERIALS.gojoCollar
  );
  collar.position.y = 1.8;
  collar.castShadow = true;
  group.add(collar);

  // ---- HEAD ----
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 12, 10),
    MATERIALS.gojoSkin
  );
  head.position.y = 2.15;
  head.scale.set(1, 1.1, 0.95);
  head.castShadow = true;
  group.add(head);

  // ---- BLINDFOLD ----
  const blindfold = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.08, 0.3),
    MATERIALS.gojoBlindfold
  );
  blindfold.position.set(0, 2.18, 0.05);
  group.add(blindfold);

  // ---- HAIR (spiky white) ----
  const hairGroup = new THREE.Group();
  const spikeGeo = new THREE.ConeGeometry(0.06, 0.25, 5);

  // Top spikes
  for (let i = 0; i < 10; i++) {
    const spike = new THREE.Mesh(spikeGeo, MATERIALS.gojoHair);
    const angle = (i / 10) * Math.PI * 2;
    const radius = 0.15;
    spike.position.set(
      Math.cos(angle) * radius,
      2.4 + Math.random() * 0.1,
      Math.sin(angle) * radius
    );
    spike.rotation.set(
      Math.sin(angle) * 0.4,
      0,
      Math.cos(angle) * 0.4
    );
    hairGroup.add(spike);
  }

  // Center spikes (taller)
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.35, 5),
      MATERIALS.gojoHair
    );
    spike.position.set(
      (Math.random() - 0.5) * 0.1,
      2.45 + Math.random() * 0.08,
      (Math.random() - 0.5) * 0.1
    );
    spike.rotation.set(
      (Math.random() - 0.5) * 0.3,
      0,
      (Math.random() - 0.5) * 0.3
    );
    hairGroup.add(spike);
  }
  group.add(hairGroup);

  // ---- ARMS ----
  const armGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.8, 6);
  const leftArm = new THREE.Mesh(armGeo, MATERIALS.gojoUniform);
  leftArm.position.set(-0.45, 1.3, 0);
  leftArm.rotation.z = 0.15;
  leftArm.castShadow = true;
  leftArm.name = 'leftArm';
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, MATERIALS.gojoUniform);
  rightArm.position.set(0.45, 1.3, 0);
  rightArm.rotation.z = -0.15;
  rightArm.castShadow = true;
  rightArm.name = 'rightArm';
  group.add(rightArm);

  // ---- HANDS ----
  const handGeo = new THREE.SphereGeometry(0.07, 6, 6);
  const leftHand = new THREE.Mesh(handGeo, MATERIALS.gojoSkin);
  leftHand.position.set(-0.5, 0.85, 0);
  group.add(leftHand);

  const rightHand = new THREE.Mesh(handGeo, MATERIALS.gojoSkin);
  rightHand.position.set(0.5, 0.85, 0);
  group.add(rightHand);

  // ---- SCI-FI GUN (blue-tinted, attached to right hand) ----
  const gunGroup = new THREE.Group();
  gunGroup.name = 'gun';
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x222244, roughness: 0.2, metalness: 0.8 });
  const gunAccent = new THREE.MeshStandardMaterial({ color: 0x4488ff, emissive: 0x2244ff, emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.1 });
  // Gun body
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.35), gunMat);
  gunGroup.add(gunBody);
  // Barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.25, 6), gunMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.01, 0.28);
  gunGroup.add(barrel);
  // Energy core (glowing ring)
  const core = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 8), gunAccent);
  core.rotation.y = Math.PI / 2;
  core.position.set(0, 0, 0.1);
  gunGroup.add(core);
  // Scope
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 5), gunMat);
  scope.position.set(0, 0.06, 0.05);
  gunGroup.add(scope);
  // Grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), gunMat);
  grip.position.set(0, -0.08, -0.05);
  grip.rotation.x = 0.2;
  gunGroup.add(grip);
  // Position on right hand
  gunGroup.position.set(0.5, 0.88, 0.15);
  gunGroup.rotation.set(0, 0, -0.1);
  group.add(gunGroup);

  // ---- LEGS ----
  const legGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.7, 6);
  const leftLeg = new THREE.Mesh(legGeo, MATERIALS.gojoUniform);
  leftLeg.position.set(-0.15, 0.35, 0);
  leftLeg.castShadow = true;
  leftLeg.name = 'leftLeg';
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, MATERIALS.gojoUniform);
  rightLeg.position.set(0.15, 0.35, 0);
  rightLeg.castShadow = true;
  rightLeg.name = 'rightLeg';
  group.add(rightLeg);

  // ---- BLUE AURA (point light + glow sphere) ----
  const auraLight = new THREE.PointLight(0x4488ff, 1.5, 8);
  auraLight.position.y = 1.5;
  group.add(auraLight);

  const auraMat = new THREE.MeshBasicMaterial({
    color: 0x4488ff,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  });
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 12, 12),
    auraMat
  );
  aura.position.y = 1.5;
  aura.name = 'aura';
  group.add(aura);

  // Store metadata for gameplay
  group.userData = {
    type: 'gojo',
    height: 2.6,
    radius: 0.35,
    projectileColor: 0x4488ff,
    specialColor: 0x8844ff,
    auraColor: 0x4488ff,
  };

  return group;
}

// ============================================================
// RYOMEN SUKUNA MODEL
// ============================================================

/**
 * Builds a procedural Ryomen Sukuna character model.
 * Features: Pink hair, four eyes (markings), dark kimono,
 * red sash, cursed markings, red aura.
 * 
 * @returns {THREE.Group} The complete character model
 */
export function buildSukuna() {
  const group = new THREE.Group();
  group.name = 'sukuna';

  // ---- BODY (torso — wider/more muscular) ----
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.32, 1.05, 8),
    MATERIALS.sukunaKimono
  );
  torso.position.y = 1.2;
  torso.castShadow = true;
  group.add(torso);

  // ---- SASH (red diagonal) ----
  const sash = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.08, 0.35),
    MATERIALS.sukunaSash
  );
  sash.position.set(0, 1.0, 0.15);
  sash.rotation.z = 0.3;
  group.add(sash);

  // ---- HEAD ----
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 12, 10),
    MATERIALS.sukunaSkin
  );
  head.position.y = 2.15;
  head.scale.set(1, 1.05, 0.95);
  head.castShadow = true;
  group.add(head);

  // ---- FACE MARKINGS (dark lines) ----
  const markGeo = new THREE.BoxGeometry(0.02, 0.15, 0.02);
  // Vertical marks under eyes
  [-0.1, 0.1].forEach(x => {
    const mark = new THREE.Mesh(markGeo, MATERIALS.sukunaMarks);
    mark.position.set(x, 2.08, 0.23);
    group.add(mark);
  });
  // Nose bridge mark
  const noseMark = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.12, 0.02),
    MATERIALS.sukunaMarks
  );
  noseMark.position.set(0, 2.12, 0.24);
  group.add(noseMark);

  // ---- FOUR EYES (extra pair on forehead) ----
  const eyeGeo = new THREE.SphereGeometry(0.025, 6, 6);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xcc0000,
    emissive: 0xcc0000,
    emissiveIntensity: 1.5,
  });
  // Normal eyes
  [-0.09, 0.09].forEach(x => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(x, 2.18, 0.23);
    group.add(eye);
  });
  // Extra forehead eyes
  [-0.07, 0.07].forEach(x => {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 6, 6),
      eyeMat
    );
    eye.position.set(x, 2.28, 0.2);
    group.add(eye);
  });

  // ---- HAIR (pink, slightly shorter spikes) ----
  const hairGroup = new THREE.Group();
  const spikeGeo = new THREE.ConeGeometry(0.055, 0.2, 5);

  for (let i = 0; i < 12; i++) {
    const spike = new THREE.Mesh(spikeGeo, MATERIALS.sukunaHair);
    const angle = (i / 12) * Math.PI * 2;
    const radius = 0.16;
    spike.position.set(
      Math.cos(angle) * radius,
      2.38 + Math.random() * 0.08,
      Math.sin(angle) * radius
    );
    spike.rotation.set(
      Math.sin(angle) * 0.5,
      0,
      Math.cos(angle) * 0.5
    );
    hairGroup.add(spike);
  }
  // Center tuft
  for (let i = 0; i < 4; i++) {
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.28, 5),
      MATERIALS.sukunaHair
    );
    spike.position.set(
      (Math.random() - 0.5) * 0.08,
      2.42 + Math.random() * 0.06,
      (Math.random() - 0.5) * 0.08
    );
    hairGroup.add(spike);
  }
  group.add(hairGroup);

  // ---- ARMS ----
  const armGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.8, 6);
  const leftArm = new THREE.Mesh(armGeo, MATERIALS.sukunaSkin);
  leftArm.position.set(-0.5, 1.3, 0);
  leftArm.rotation.z = 0.15;
  leftArm.castShadow = true;
  leftArm.name = 'leftArm';
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, MATERIALS.sukunaSkin);
  rightArm.position.set(0.5, 1.3, 0);
  rightArm.rotation.z = -0.15;
  rightArm.castShadow = true;
  rightArm.name = 'rightArm';
  group.add(rightArm);

  // ---- MOUTH MARKING ON HAND ----
  const mouthMark = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.02, 0.04),
    MATERIALS.sukunaMarks
  );
  mouthMark.position.set(0.5, 0.88, 0.04);
  group.add(mouthMark);

  // ---- HANDS ----
  const handGeo = new THREE.SphereGeometry(0.075, 6, 6);
  const leftHand = new THREE.Mesh(handGeo, MATERIALS.sukunaSkin);
  leftHand.position.set(-0.55, 0.85, 0);
  group.add(leftHand);
  const rightHand = new THREE.Mesh(handGeo, MATERIALS.sukunaSkin);
  rightHand.position.set(0.55, 0.85, 0);
  group.add(rightHand);

  // ---- SCI-FI GUN (red-tinted, attached to right hand) ----
  const gunGroup = new THREE.Group();
  gunGroup.name = 'gun';
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x331111, roughness: 0.2, metalness: 0.8 });
  const gunAccent = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.1 });
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.35), gunMat);
  gunGroup.add(gunBody);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.25, 6), gunMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.01, 0.28);
  gunGroup.add(barrel);
  const core = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 8), gunAccent);
  core.rotation.y = Math.PI / 2;
  core.position.set(0, 0, 0.1);
  gunGroup.add(core);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 5), gunMat);
  scope.position.set(0, 0.06, 0.05);
  gunGroup.add(scope);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), gunMat);
  grip.position.set(0, -0.08, -0.05);
  grip.rotation.x = 0.2;
  gunGroup.add(grip);
  gunGroup.position.set(0.55, 0.88, 0.15);
  gunGroup.rotation.set(0, 0, -0.1);
  group.add(gunGroup);

  // ---- LEGS ----
  const legGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.7, 6);
  const leftLeg = new THREE.Mesh(legGeo, MATERIALS.sukunaKimono);
  leftLeg.position.set(-0.15, 0.35, 0);
  leftLeg.castShadow = true;
  leftLeg.name = 'leftLeg';
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, MATERIALS.sukunaKimono);
  rightLeg.position.set(0.15, 0.35, 0);
  rightLeg.castShadow = true;
  rightLeg.name = 'rightLeg';
  group.add(rightLeg);

  // ---- RED AURA ----
  const auraLight = new THREE.PointLight(0xff2222, 1.5, 8);
  auraLight.position.y = 1.5;
  group.add(auraLight);

  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xff2222,
    transparent: true,
    opacity: 0.13,
    side: THREE.DoubleSide,
  });
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 12, 12),
    auraMat
  );
  aura.position.y = 1.5;
  aura.name = 'aura';
  group.add(aura);

  group.userData = {
    type: 'sukuna',
    height: 2.6,
    radius: 0.4,
    projectileColor: 0xff2222,
    specialColor: 0xff6600,
    auraColor: 0xff2222,
  };

  return group;
}

// ============================================================
// ENEMY MODELS
// ============================================================

/**
 * Builds a cursed spirit enemy model.
 * type: 'melee' — dark blob creature that charges at player
 * type: 'ranged' — floating spirit that shoots projectiles
 * 
 * @param {string} type - 'melee' or 'ranged'
 * @param {number} difficulty - 1, 2, or 3 (scales size/detail)
 * @returns {THREE.Group} The enemy model
 */
export function buildEnemy(type = 'melee', difficulty = 1) {
  const group = new THREE.Group();
  group.name = `enemy_${type}`;

  const scale = 0.8 + difficulty * 0.15;

  if (type === 'melee') {
    // Amorphous body (deformed sphere)
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.4 * scale, 8, 6),
      MATERIALS.cursedFlesh
    );
    body.position.y = 0.6 * scale;
    body.scale.set(1, 1.3, 0.9);
    body.castShadow = true;
    group.add(body);

    // Menacing eyes
    [-0.12, 0.12].forEach(x => {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.06 * scale, 6, 6),
        MATERIALS.cursedEyes
      );
      eye.position.set(x * scale, 0.75 * scale, 0.3 * scale);
      group.add(eye);
    });

    // Tentacle-like arms
    [-1, 1].forEach(side => {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05 * scale, 0.03 * scale, 0.6 * scale, 5),
        MATERIALS.cursedFlesh
      );
      arm.position.set(side * 0.35 * scale, 0.4 * scale, 0);
      arm.rotation.z = side * 0.5;
      group.add(arm);
    });

    // Legs/base
    const base = new THREE.Mesh(
      new THREE.ConeGeometry(0.3 * scale, 0.3 * scale, 6),
      MATERIALS.cursedFlesh
    );
    base.position.y = 0.15 * scale;
    base.rotation.x = Math.PI;
    group.add(base);

  } else if (type === 'ranged') {
    // Floating head-like form
    const body = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.35 * scale, 0),
      MATERIALS.cursedArmor
    );
    body.position.y = 1.2 * scale;
    body.castShadow = true;
    group.add(body);

    // Single large eye
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.1 * scale, 8, 8),
      MATERIALS.cursedEyes
    );
    eye.position.set(0, 1.25 * scale, 0.3 * scale);
    group.add(eye);

    // Floating tendrils below
    for (let i = 0; i < 3; i++) {
      const tendril = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02 * scale, 0.01 * scale, 0.5 * scale, 4),
        MATERIALS.cursedFlesh
      );
      const angle = (i / 3) * Math.PI * 2;
      tendril.position.set(
        Math.cos(angle) * 0.15 * scale,
        0.8 * scale,
        Math.sin(angle) * 0.15 * scale
      );
      tendril.rotation.x = Math.sin(angle) * 0.3;
      tendril.rotation.z = Math.cos(angle) * 0.3;
      group.add(tendril);
    }
  } else if (type === 'flying') {
    // Flying spirit with wings
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.35 * scale, 8, 8),
      MATERIALS.cursedArmor
    );
    body.position.y = 1.2 * scale;
    body.castShadow = true;
    group.add(body);

    // Glowing eyes
    [-0.09, 0.09].forEach(x => {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 * scale, 6, 6),
        MATERIALS.cursedEyes
      );
      eye.position.set(x * scale, 1.25 * scale, 0.28 * scale);
      group.add(eye);
    });

    // Left Wing Pivot Group (allows pivoting at the body shoulder)
    const leftWingGroup = new THREE.Group();
    leftWingGroup.name = 'leftWing';
    leftWingGroup.position.set(-0.3 * scale, 1.2 * scale, 0);
    const leftWingMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.6 * scale, 0.05 * scale, 0.25 * scale),
      MATERIALS.cursedFlesh
    );
    leftWingMesh.position.set(-0.3 * scale, 0, 0); // Offset mesh to the left
    leftWingGroup.add(leftWingMesh);
    group.add(leftWingGroup);

    // Right Wing Pivot Group (allows pivoting at the body shoulder)
    const rightWingGroup = new THREE.Group();
    rightWingGroup.name = 'rightWing';
    rightWingGroup.position.set(0.3 * scale, 1.2 * scale, 0);
    const rightWingMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.6 * scale, 0.05 * scale, 0.25 * scale),
      MATERIALS.cursedFlesh
    );
    rightWingMesh.position.set(0.3 * scale, 0, 0); // Offset mesh to the right
    rightWingGroup.add(rightWingMesh);
    group.add(rightWingGroup);

    // Tail/tendril below
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(0.08 * scale, 0.6 * scale, 4),
      MATERIALS.cursedFlesh
    );
    tail.position.set(0, 0.7 * scale, -0.1 * scale);
    tail.rotation.x = 0.3;
    group.add(tail);
  }

  group.userData = {
    type: type,
    difficulty: difficulty,
    radius: 0.4 * scale,
    height: type === 'melee' ? 1.0 * scale : (type === 'flying' ? 1.5 * scale : 1.6 * scale),
  };

  return group;
}

/**
 * Builds a boss enemy model — larger and more menacing.
 * 
 * @param {number} level - Level number (1=Jungle, 2=City, 3=Water)
 * @returns {THREE.Group} The boss model
 */
export function buildBoss(level = 1) {
  const group = new THREE.Group();
  group.name = 'boss';

  const colors = [
    { body: 0x2a4a2a, eye: 0x00ff44, aura: 0x44ff44 }, // Jungle — green
    { body: 0x4a2a4a, eye: 0xff44ff, aura: 0xff44ff }, // City — purple
    { body: 0x1a3a5a, eye: 0x44ddff, aura: 0x44ddff }, // Water — cyan
  ];
  const c = colors[level - 1] || colors[0];

  const bodyMat = new THREE.MeshStandardMaterial({ color: c.body, roughness: 0.5, metalness: 0.3 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: c.eye, emissive: c.eye, emissiveIntensity: 3.0 });

  // Massive body
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(1.0, 10, 8),
    bodyMat
  );
  body.position.y = 1.5;
  body.scale.set(1, 1.4, 0.85);
  body.castShadow = true;
  group.add(body);

  // Multiple eyes
  const eyePositions = [
    { x: -0.3, y: 1.8, z: 0.7 },
    { x: 0.3, y: 1.8, z: 0.7 },
    { x: 0, y: 2.1, z: 0.65 },
    { x: -0.15, y: 1.5, z: 0.75 },
    { x: 0.15, y: 1.5, z: 0.75 },
  ];
  eyePositions.forEach(pos => {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      eyeMat
    );
    eye.position.set(pos.x, pos.y, pos.z);
    group.add(eye);
  });

  // Horns
  [-0.5, 0.5].forEach(x => {
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.8, 6),
      bodyMat
    );
    horn.position.set(x, 2.6, -0.1);
    horn.rotation.z = x > 0 ? -0.3 : 0.3;
    group.add(horn);
  });

  // Large arms
  [-1, 1].forEach(side => {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.1, 1.2, 6),
      bodyMat
    );
    arm.position.set(side * 0.9, 1.0, 0);
    arm.rotation.z = side * 0.4;
    arm.castShadow = true;
    group.add(arm);

    // Claws
    for (let i = 0; i < 3; i++) {
      const claw = new THREE.Mesh(
        new THREE.ConeGeometry(0.04, 0.25, 4),
        bodyMat
      );
      claw.position.set(
        side * 1.1 + (i - 1) * 0.06 * side,
        0.3,
        (i - 1) * 0.06
      );
      claw.rotation.z = side * 0.8;
      group.add(claw);
    }
  });

  // Boss aura
  const auraLight = new THREE.PointLight(c.aura, 3, 15);
  auraLight.position.y = 1.5;
  group.add(auraLight);

  const auraMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 12, 12),
    new THREE.MeshBasicMaterial({ color: c.aura, transparent: true, opacity: 0.1, side: THREE.DoubleSide })
  );
  auraMesh.position.y = 1.5;
  auraMesh.name = 'aura';
  group.add(auraMesh);

  group.userData = {
    type: 'boss',
    difficulty: level,
    radius: 1.0,
    height: 3.0,
    isBoss: true,
  };

  return group;
}
