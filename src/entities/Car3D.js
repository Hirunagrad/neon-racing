import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default class Car3D {
  constructor(scene, config, x, z, isAI = false, aiColor = null, name = "Player") {
    this.config = config || { maxSpeed: 2.0, accel: 0.05, handling: 0.04, color: 0xaaaaaa, modelPath: '/models/car.glb' };
    this.name = name;
    this.scene = scene;
    this.mesh = new THREE.Group();

    this.mesh.position.set(x, 0.15, z);

    this.speed = 0;
    this.angle = 0;
    this.friction = 0.95;
    this.isAI = isAI;
    this.boostTimer = 0;
    this.nitrous = 100;
    this.nosLockout = false;

    this.isBoosting = false;
    this.isSkidding = false;
    this.turnDir = 0;

    this.laps = 0;
    this.currentCheckpoint = 0;
    this.finished = false;
    this.finishTime = 0;

    this.wheels = [];
    this.chassis = null;

    this.particlePoolSize = 60;
    this.particles = [];
    this.particleIndex = 0;
    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);

    this.particleTexture = this.createParticleTexture();
    this.particleMat = new THREE.SpriteMaterial({
      map: this.particleTexture, color: 0x00ffff, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });

    for (let i = 0; i < this.particlePoolSize; i++) {
      let sprite = new THREE.Sprite(this.particleMat);
      sprite.visible = false;
      this.particleGroup.add(sprite);
      this.particles.push({ mesh: sprite, life: 0, vel: new THREE.Vector3() });
    }

    this.skidPoolSize = 60;
    this.skidMarks = [];
    this.skidIndex = 0;
    this.skidCounter = 0;
    this.skidMarkGroup = new THREE.Group();
    this.scene.add(this.skidMarkGroup);

    this.skidGeo = new THREE.PlaneGeometry(0.8, 0.8);
    this.skidGeo.rotateX(-Math.PI / 2);
    this.skidMat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide,
    });

    for (let i = 0; i < this.skidPoolSize; i++) {
      let mark = new THREE.Mesh(this.skidGeo, this.skidMat);
      mark.visible = false;
      this.skidMarkGroup.add(mark);
      this.skidMarks.push({ mesh: mark, life: 0 });
    }

    const shadowGeo = new THREE.PlaneGeometry(2.5, 5.0);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.createShadowTexture(), transparent: true, opacity: 0.6, depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.y = -0.03;
    this.mesh.add(shadow);

    let carColor = aiColor || this.config.color;
    this.loadRealModel(carColor, this.config.modelPath);

    scene.add(this.mesh);
  }

  // --- NEW: Safe cleanup method for multiplayer swapping ---
  destroy() {
      this.scene.remove(this.mesh);
      this.scene.remove(this.particleGroup);
      this.scene.remove(this.skidMarkGroup);
  }

  createParticleTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255, 255, 255, 1)"); grad.addColorStop(0.2, "rgba(0, 255, 255, 1)");
    grad.addColorStop(0.5, "rgba(0, 100, 255, 0.5)"); grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  createShadowTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(0, 0, 0, 0.8)"); grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }

  emitParticles() {
    const offset = 1.2;
    const px = this.mesh.position.x - Math.sin(this.angle) * offset;
    const pz = this.mesh.position.z - Math.cos(this.angle) * offset;
    const py = this.mesh.position.y + 0.5;

    for (let k = 0; k < 2; k++) {
      let p = this.particles[this.particleIndex];
      p.mesh.position.set(px + (Math.random() - 0.5) * 0.5, py + (Math.random() - 0.5) * 0.3, pz + (Math.random() - 0.5) * 0.5);
      p.mesh.scale.setScalar(0.8);
      p.mesh.visible = true; p.life = 1.0;
      p.vel.set((Math.random() - 0.5) * 0.1, Math.random() * 0.1, (Math.random() - 0.5) * 0.1);
      this.particleIndex = (this.particleIndex + 1) % this.particlePoolSize;
    }
  }

  updateParticles() {
    for (let i = 0; i < this.particlePoolSize; i++) {
      let p = this.particles[i];
      if (p.life > 0) {
        p.life -= 0.05; p.mesh.position.add(p.vel); p.mesh.scale.setScalar(1 + (1 - p.life) * 2);
        if (p.life <= 0) p.mesh.visible = false;
      }
    }
  }

  createSkidMarks() {
    if (this.skidCounter > 0) { this.skidCounter--; return; }
    this.skidCounter = 3;

    this.wheels.forEach((wheel) => {
      if (!wheel.isFront && wheel.group) {
        const pos = new THREE.Vector3(); wheel.group.getWorldPosition(pos);
        let m = this.skidMarks[this.skidIndex];
        m.mesh.position.copy(pos); m.mesh.position.y = 0.11; m.mesh.rotation.y = this.angle;
        m.mesh.scale.setScalar(1.0); m.mesh.visible = true; m.life = 1.0;
        this.skidIndex = (this.skidIndex + 1) % this.skidPoolSize;
      }
    });
  }

  updateSkidMarks() {
    for (let i = 0; i < this.skidPoolSize; i++) {
      let m = this.skidMarks[i];
      if (m.life > 0) {
        m.life -= 0.01; m.mesh.scale.setScalar(Math.max(0, m.life));
        if (m.life <= 0) m.mesh.visible = false;
      }
    }
  }

  loadRealModel(carColor, modelPath) {
    const loader = new GLTFLoader();
    loader.load(modelPath, (gltf) => {
      const carModel = gltf.scene;
      carModel.traverse((child) => {
        if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
      });
      this.chassis = carModel.getObjectByName("body");
      if (this.chassis && this.chassis.isMesh) {
        this.chassis.material = this.chassis.material.clone();
        this.chassis.material.color.setHex(carColor);
      }
      let fl = carModel.getObjectByName("wheel-front-left");
      let fr = carModel.getObjectByName("wheel-front-right");
      let bl = carModel.getObjectByName("wheel-back-left");
      let br = carModel.getObjectByName("wheel-back-right");

      if (fl) this.wheels.push({ group: fl, isFront: true });
      if (fr) this.wheels.push({ group: fr, isFront: true });
      if (bl) this.wheels.push({ group: bl, isFront: false });
      if (br) this.wheels.push({ group: br, isFront: false });
      this.mesh.add(carModel);
    });
  }

  updateNetworkVisuals(data) {
    if (this.wheels.length > 0) {
      this.wheels.forEach((w) => {
        if (w.group) {
          w.group.rotation.x -= data.speed * 0.5;
          if (w.isFront) w.group.rotation.y = data.turnDir * 0.5;
        }
      });
    }
    if (this.chassis) this.chassis.rotation.z = data.turnDir * (data.speed / this.config.maxSpeed) * 0.1;
    
    // The visual animations triggered by other players!
    if (data.isBoosting) this.emitParticles();
    if (data.isSkidding) this.createSkidMarks();

    this.updateSkidMarks();
    this.updateParticles();
  }

  update(input, canDrive) {
    this.turnDir = 0;
    this.isBoosting = false;
    this.isSkidding = false;
    let currentMaxSpeed = this.config.maxSpeed;

    if (this.boostTimer > 0) {
      this.boostTimer--; this.speed += 0.08; currentMaxSpeed *= 1.6;
    }

    if (canDrive && !this.isAI && !this.finished) {
      let holdingShift = input.isPressed(["ShiftLeft", "ShiftRight"]);
      if (!holdingShift && this.nitrous > 15) this.nosLockout = false;

      if (holdingShift && !this.nosLockout && this.nitrous > 0 && this.speed > 0.5) {
        this.isBoosting = true;
        this.nitrous -= 0.6;
        if (this.nitrous <= 0) { this.nitrous = 0; this.nosLockout = true; }
        currentMaxSpeed *= 1.5; this.speed += 0.06; this.emitParticles();
      } else {
        this.nitrous += 0.15; if (this.nitrous > 100) this.nitrous = 100;
      }
    }

    if (!this.isAI) {
      if (this.boostTimer > 0 || this.isBoosting) document.getElementById("speed-lines").classList.add("boosting");
      else document.getElementById("speed-lines").classList.remove("boosting");
    }

    if (canDrive && !this.finished) {
      if (!this.isAI) {
        if (input.isPressed(["ArrowUp", "KeyW"])) this.speed += this.config.accel;
        if (input.isPressed(["ArrowDown", "KeyS"])) this.speed -= this.config.accel;
        if (input.isPressed(["Space"])) this.speed *= 0.8;

        if (Math.abs(this.speed) > 0.1) {
          this.turnDir = this.speed > 0 ? 1 : -1;
          if (input.isPressed(["ArrowLeft", "KeyA"])) { this.angle += this.config.handling * this.turnDir; this.turnDir = 1; } 
          else if (input.isPressed(["ArrowRight", "KeyD"])) { this.angle -= this.config.handling * this.turnDir; this.turnDir = -1; } 
          else this.turnDir = 0;
        }
      } else {
        this.turnDir = this.lastAiTurnDir || 0;
      }
    }

    this.speed = Math.max(-currentMaxSpeed / 2, Math.min(currentMaxSpeed, this.speed));
    if (!this.finished && canDrive) this.speed *= this.friction; else if (this.finished) this.speed *= 0.98;

    this.mesh.rotation.y = this.angle;
    this.mesh.position.x += Math.sin(this.angle) * this.speed;
    this.mesh.position.z += Math.cos(this.angle) * this.speed;

    if (this.chassis) this.chassis.rotation.z = this.turnDir * (this.speed / currentMaxSpeed) * 0.1;

    if (this.wheels.length > 0) {
      this.wheels.forEach((w) => {
        if (w.group) {
          w.group.rotation.x -= this.speed * 0.5;
          if (w.isFront && !this.finished) w.group.rotation.y = this.turnDir * 0.5;
          else if (this.finished) w.group.rotation.y = 0;
        }
      });
    }

    if (canDrive && !this.finished) {
      if (this.isAI) {
        if (this.lastAiTurnDir && this.lastAiTurnDir !== 0 && Math.abs(this.speed) > this.config.maxSpeed * 0.7) this.isSkidding = true;
      } else {
        const isTurning = input.isPressed(["ArrowLeft", "KeyA"]) || input.isPressed(["ArrowRight", "KeyD"]);
        const isBraking = input.isPressed(["Space"]);
        const isFast = Math.abs(this.speed) > this.config.maxSpeed * (this.isBoosting ? 0.4 : 0.6);
        if ((isTurning && isFast) || (isBraking && Math.abs(this.speed) > 0.2)) this.isSkidding = true;
      }
    }

    if (this.isSkidding) this.createSkidMarks();
    this.updateSkidMarks();
    this.updateParticles();
  }
}