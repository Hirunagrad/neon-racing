import * as THREE from "three";
import { CAR_CONFIGS, AI_COLORS, AI_NAMES } from "../config/GameConfig.js";
import InputManager from "../systems/InputManager.js";
import AudioManager from "../systems/AudioManager.js";
import Environment from "../world/Environment.js";
import Car3D from "../entities/Car3D.js";
import AICar3D from "../entities/AICar3D.js";

export default class GameEngine {
  constructor() {
    this.container = document.getElementById("game-container");
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3d8c40, 0.6));
    const dirLight = new THREE.DirectionalLight(0xfffff0, 1.5);
    dirLight.position.set(150, 250, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.top = 250;
    dirLight.shadow.camera.bottom = -250;
    dirLight.shadow.camera.left = -250;
    dirLight.shadow.camera.right = 250;
    this.scene.add(dirLight);

    this.input = new InputManager();
    this.audio = new AudioManager(); 

    this.maxLaps = 3;
    this.reqFrame = null;
    this.canDrive = false;
    this.isRunning = false;
    this.isPaused = false; // NEW PAUSE STATE
    this.orbitAngle = 0;

    window.addEventListener("resize", () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      }, false);
  }

  start(carIndex, mapIndex = 0, difficulty = 1) {
    if (this.reqFrame) cancelAnimationFrame(this.reqFrame);

    this.audio.init();

    while (this.scene.children.length > 2)
      this.scene.remove(this.scene.children[2]);

    this.environment = new Environment(this.scene, mapIndex);
    const startPos = this.environment.startPositions;

    this.car = new Car3D(
      this.scene, CAR_CONFIGS[carIndex], startPos.player.x, startPos.player.z, false, null, "You (Player)"
    );
    this.car.angle = startPos.player.a;

    this.aiCars = [];
    for (let i = 0; i < 3; i++) {
      let aiConfig = CAR_CONFIGS[Math.floor(Math.random() * CAR_CONFIGS.length)];
      let aiPos = startPos.ai[i] || { x: 0, z: 0, a: 0 };
      let aiX = aiPos.x + (Math.random() * 4 - 2);
      let aiZ = aiPos.z;
      
      let ai = new AICar3D(
        this.scene, aiConfig, aiX, aiZ, AI_COLORS[i], AI_NAMES[i], this.environment.waypoints, difficulty
      );
      ai.angle = aiPos.a;
      this.aiCars.push(ai);
    }

    document.getElementById("lap-counter").innerText = "0";
    document.getElementById("time-display").innerText = "0.00";
    document.getElementById("finish-display").classList.add("hidden");
    document.getElementById("results-layer").classList.add("hidden");
    document.getElementById("pause-layer").classList.add("hidden");
    document.getElementById("hud").classList.remove("hidden");

    this.isRunning = true;
    this.isPaused = false;
    this.canDrive = false;
    this.orbitAngle = Math.PI;

    this.updateCamera();
    this.runCountdown();
    this.loop();
  }

  // --- NEW: PAUSE LOGIC ---
  togglePause() {
    // Prevent pausing during countdown or after finishing
    if (!this.isRunning || !this.canDrive || this.car.finished) return; 

    this.isPaused = !this.isPaused;

    if (this.isPaused) {
        this.pauseStartTime = Date.now();
        this.audio.stopEngine();
        document.getElementById('pause-layer').classList.remove('hidden');
    } else {
        // Shift the start time forward so the timer doesn't jump when resuming
        this.startTime += (Date.now() - this.pauseStartTime);
        document.getElementById('pause-layer').classList.add('hidden');
    }
  }

  runCountdown() {
    let count = 3;
    let cdElem = document.getElementById("countdown-display");

    cdElem.innerText = count;
    cdElem.style.color = "#ffeb3b";
    cdElem.classList.remove("hidden");
    cdElem.classList.add("pop");
    this.audio.playTone(440, "sine", 0.1, 0.1); 

    let interval = setInterval(() => {
      cdElem.classList.remove("pop");
      void cdElem.offsetWidth;

      count--;

      if (count > 0) {
        cdElem.innerText = count;
        cdElem.classList.add("pop");
        this.audio.playTone(440, "sine", 0.1, 0.1); 
      } else if (count === 0) {
        cdElem.innerText = "GO!";
        cdElem.style.color = "#2ed573";
        cdElem.classList.add("pop");
        this.audio.playTone(880, "sine", 0.3, 0.15); 

        this.canDrive = true;
        this.startTime = Date.now();
      } else {
        cdElem.classList.add("hidden");
        clearInterval(interval);
      }
    }, 1000);
  }

  keepCarOnTrack(carObj) {
    if (this.environment.mapIndex !== 0) return;

    let pos = carObj.mesh.position;
    let trackCenterDist = 0; let pushX = 0; let pushZ = 0;

    if (pos.z > -100 && pos.z < 100) {
      trackCenterDist = Math.abs(pos.x - (pos.x < 0 ? -80 : 80));
      pushX = pos.x > (pos.x < 0 ? -80 : 80) ? -1 : 1;
    } else {
      let centerY = pos.z <= -100 ? -100 : 100;
      let distToCenter = Math.sqrt(pos.x * pos.x + (pos.z - centerY) * (pos.z - centerY));
      trackCenterDist = Math.abs(distToCenter - 80);
      pushX = (0 - pos.x) / distToCenter;
      pushZ = (centerY - pos.z) / distToCenter;
      if (distToCenter < 80) { pushX *= -1; pushZ *= -1; }
    }

    if (trackCenterDist > 18) {
      carObj.mesh.position.x += pushX * 0.5;
      carObj.mesh.position.z += pushZ * 0.5;
      carObj.speed *= 0.8;
    }
  }

  checkCollisions() {
    const allCars = [this.car, ...this.aiCars];
    const radius = 2.5; 

    for (let i = 0; i < allCars.length; i++) {
      for (let j = i + 1; j < allCars.length; j++) {
        const c1 = allCars[i]; const c2 = allCars[j];
        const dx = c1.mesh.position.x - c2.mesh.position.x;
        const dz = c1.mesh.position.z - c2.mesh.position.z;
        const distSq = dx * dx + dz * dz;
        const minDist = radius * 2;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;
          const nx = dx / (dist || 1);
          const nz = dz / (dist || 1);

          c1.mesh.position.x += nx * overlap * 0.5; c1.mesh.position.z += nz * overlap * 0.5;
          c2.mesh.position.x -= nx * overlap * 0.5; c2.mesh.position.z -= nz * overlap * 0.5;
          c1.speed *= 0.85; c2.speed *= 0.85;
        }
      }
    }
  }

  checkItems() {
    this.environment.boosts.forEach((b) => {
      [this.car, ...this.aiCars].forEach((car) => {
        if (car.finished) return;
        let dx = car.mesh.position.x - b.group.position.x;
        let dz = car.mesh.position.z - b.group.position.z;

        if (Math.sqrt(dx * dx + dz * dz) < 10.0 && car.boostTimer < 110) {
          car.boostTimer = 120;
          if (car === this.car) this.audio.playBoost(); 
        }
      });
    });
  }

  checkLaps(carObj) {
    if (carObj.finished) return;

    let cp = this.environment.checkpoints[carObj.currentCheckpoint];
    let dx = carObj.mesh.position.x - cp.x;
    let dz = carObj.mesh.position.z - cp.z;

    if (Math.sqrt(dx * dx + dz * dz) < cp.r) {
      carObj.currentCheckpoint++;

      if (carObj.currentCheckpoint >= this.environment.checkpoints.length) {
        carObj.currentCheckpoint = 0;
        carObj.laps++;

        if (carObj === this.car) {
          document.getElementById("lap-counter").innerText = carObj.laps;
        }

        if (carObj.laps >= this.maxLaps) {
          carObj.finished = true;
          carObj.finishTime = ((Date.now() - this.startTime) / 1000).toFixed(2);
          if (carObj === this.car) this.triggerPlayerFinish();
        }
      }
    }
  }

  updateCamera() {
    if (this.car.finished) {
      this.orbitAngle += 0.01;
      const radius = 20;
      const cx = this.car.mesh.position.x + Math.sin(this.orbitAngle) * radius;
      const cz = this.car.mesh.position.z + Math.cos(this.orbitAngle) * radius;

      const targetPos = new THREE.Vector3(cx, this.car.mesh.position.y + 6, cz);
      this.camera.position.lerp(targetPos, 0.05);
      this.camera.lookAt(this.car.mesh.position);
    } else {
      const relativeCameraOffset = new THREE.Vector3(0, 10, -22);
      const cameraOffset = relativeCameraOffset.applyMatrix4(this.car.mesh.matrixWorld);
      this.camera.position.lerp(cameraOffset, 0.1);

      const lookAtPos = this.car.mesh.position.clone();
      lookAtPos.y += 2;
      this.camera.lookAt(lookAtPos);
    }
  }

  calculatePositions() {
    let allCars = [this.car, ...this.aiCars];
    allCars.sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      let scoreA = a.laps * 10 + a.currentCheckpoint;
      let scoreB = b.laps * 10 + b.currentCheckpoint;
      return scoreB - scoreA;
    });
    return allCars;
  }

  triggerPlayerFinish() {
    let finElem = document.getElementById("finish-display");
    finElem.classList.remove("hidden");
    finElem.classList.add("pop");

    this.audio.playFinish(); 
    this.audio.stopEngine(); 

    setTimeout(() => finElem.classList.add("hidden"), 2000);
    setTimeout(() => this.showResultsScreen(), 3000);
  }

  showResultsScreen() {
    document.getElementById("hud").classList.add("hidden");
    const nosContainer = document.getElementById("nos-container");
    if (nosContainer) nosContainer.style.display = 'none';

    let resultsLayer = document.getElementById("results-layer");
    let tableBody = document.getElementById("results-body");

    tableBody.innerHTML = "";
    let standings = this.calculatePositions();

    standings.forEach((racer, index) => {
      let tr = document.createElement("tr");
      if (racer === this.car) tr.classList.add("player-row");
      let timeStr = racer.finished ? racer.finishTime + "s" : "DNF (Still Racing)";

      tr.innerHTML = `<td>${index + 1}</td><td>${racer.name}</td><td>${timeStr}</td>`;
      tableBody.appendChild(tr);
    });

    resultsLayer.classList.remove("hidden");
  }

  stopGame() {
    this.isRunning = false;
    this.isPaused = false;
    this.audio.stopEngine();
    if (this.reqFrame) cancelAnimationFrame(this.reqFrame);
    document.getElementById("results-layer").classList.add("hidden");
    document.getElementById("pause-layer").classList.add("hidden");
    document.getElementById("hud").classList.add("hidden");
    document.getElementById("ui-layer").classList.remove("hidden");
    
    const nosContainer = document.getElementById("nos-container");
    if (nosContainer) nosContainer.style.display = 'block';
  }

  loop() {
    if (!this.isRunning) return;

    // --- NEW: PAUSE FREEZE ---
    if (this.isPaused) {
        // Still render the camera so the screen doesn't go black, but skip all math
        this.renderer.render(this.scene, this.camera);
        this.reqFrame = requestAnimationFrame(() => this.loop());
        return;
    }

    if (this.canDrive && !this.car.finished) {
      let currentTimer = (Date.now() - this.startTime) / 1000;
      document.getElementById("time-display").innerText = currentTimer.toFixed(2);

      let currentStandings = this.calculatePositions();
      let playerRank = currentStandings.indexOf(this.car) + 1;
      let suffix = ["th", "st", "nd", "rd"][playerRank > 3 ? 0 : playerRank];
      document.getElementById("position-display").innerText = playerRank + suffix;

      let displaySpeed = Math.round(Math.abs(this.car.speed) * 85);
      document.getElementById("speed-display").innerText = displaySpeed;

      const nosBar = document.getElementById("nos-bar");
      if (nosBar) {
          nosBar.style.width = this.car.nitrous + "%";
          if (this.car.nosLockout) {
              nosBar.style.background = "red";
          } else if (this.car.nitrous < 25) {
              nosBar.style.background = "orange";
          } else {
              nosBar.style.background = "linear-gradient(90deg, #00ffff, #0055ff)";
          }
      }

      let isAccelerating = this.input.isPressed(["ArrowUp", "KeyW"]);
      this.audio.updateEngine(this.car.speed, this.car.config.maxSpeed * 1.6, isAccelerating);
    }

    this.car.update(this.input, this.canDrive);
    this.keepCarOnTrack(this.car);
    if (this.canDrive) this.checkLaps(this.car, true);

    this.aiCars.forEach((ai) => {
      ai.updateAI(this.canDrive);
      ai.update(this.input, this.canDrive);
      this.keepCarOnTrack(ai);
      if (this.canDrive) this.checkLaps(ai, false);
    });

    this.checkCollisions();
    this.checkItems();
    this.updateCamera();

    this.renderer.render(this.scene, this.camera);
    this.reqFrame = requestAnimationFrame(() => this.loop());
  }
}