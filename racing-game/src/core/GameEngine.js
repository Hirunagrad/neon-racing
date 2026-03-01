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
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3d8c40, 0.6));
    const dirLight = new THREE.DirectionalLight(0xfffff0, 1.5);
    dirLight.position.set(150, 250, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    this.scene.add(dirLight);

    this.input = new InputManager();
    this.audio = new AudioManager(); 

    this.maxLaps = 3;
    this.reqFrame = null;
    this.canDrive = false;
    this.isRunning = false;
    this.isPaused = false;
    this.orbitAngle = Math.PI;

    this.mode = 'offline';
    this.socket = null;
    this.roomId = null;
    this.networkCars = {};

    window.addEventListener("resize", () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }, false);
  }

  start(carIndex, mapIndex = 0, difficulty = 1, mode = 'offline', externalSocket = null, roomId = null, initialPlayers = []) {
    if (this.reqFrame) cancelAnimationFrame(this.reqFrame);
    this.audio.init();

    this.mode = mode;
    this.socket = externalSocket;
    this.roomId = roomId;

    while (this.scene.children.length > 2) this.scene.remove(this.scene.children[2]);

    this.environment = new Environment(this.scene, mapIndex);
    const startPos = this.environment.startPositions;

    this.aiCars = [];
    this.networkCars = {};

    if (this.mode === 'offline') {
        this.car = new Car3D(this.scene, CAR_CONFIGS[carIndex], startPos.player.x, startPos.player.z, false, null, "You");
        this.car.angle = startPos.player.a;

        for (let i = 0; i < 3; i++) {
            let aiConf = CAR_CONFIGS[Math.floor(Math.random() * CAR_CONFIGS.length)];
            let ai = new AICar3D(this.scene, aiConf, startPos.ai[i].x, startPos.ai[i].z, AI_COLORS[i], AI_NAMES[i], this.environment.waypoints, difficulty);
            ai.angle = startPos.ai[i].a;
            this.aiCars.push(ai);
        }
        
        document.getElementById('restart-btn').classList.remove('hidden');

    } else if (this.mode === 'online') {
        let playerArray = Array.isArray(initialPlayers) ? initialPlayers : Object.values(initialPlayers || {});

        let myIndex = playerArray.findIndex(p => p.id === this.socket.id);
        if(myIndex === -1) myIndex = 0;
        
        let myName = playerArray[myIndex] ? playerArray[myIndex].playerName : "You";

        let myStartX = startPos.player.x + (myIndex % 2 === 0 ? 4 : -4);
        let myStartZ = startPos.player.z + (Math.floor(myIndex / 2) * 12);

        this.car = new Car3D(this.scene, CAR_CONFIGS[carIndex], myStartX, myStartZ, false, null, myName);
        this.car.angle = startPos.player.a;

        this.socket.off('playerMoved');
        this.socket.off('playerFinished');
        this.socket.off('playerDisconnected');

        this.socket.on('playerMoved', (playerInfo) => {
            if (this.networkCars[playerInfo.id] && this.networkCars[playerInfo.id].mesh) {
                let netCar = this.networkCars[playerInfo.id];
                netCar.mesh.position.x = playerInfo.x;
                netCar.mesh.position.z = playerInfo.z;
                netCar.angle = playerInfo.rotation;
                netCar.mesh.rotation.y = playerInfo.rotation;
                
                netCar.laps = playerInfo.laps || 0;
                netCar.currentCheckpoint = playerInfo.checkpoint || 0;
                
                netCar.networkData = {
                    speed: playerInfo.speed || 0,
                    turnDir: playerInfo.turnDir || 0,
                    isBoosting: playerInfo.isBoosting || false,
                    isSkidding: playerInfo.isSkidding || false
                };
            }
        });

        this.socket.on('playerFinished', (playerInfo) => {
            let netCar = this.networkCars[playerInfo.id];
            if (netCar) {
                netCar.finished = true;
                netCar.finishTime = playerInfo.finishTime;
                if (this.car.finished) this.showResultsScreen();
            }
        });

        this.socket.on('playerDisconnected', (id) => {
            if (this.networkCars[id]) {
                this.networkCars[id].destroy();
                delete this.networkCars[id];
            }
        });

        playerArray.forEach((p, index) => {
            if (p.id !== this.socket.id) {
                let netStartX = startPos.player.x + (index % 2 === 0 ? 4 : -4);
                let netStartZ = startPos.player.z + (Math.floor(index / 2) * 12);
                let netConfig = CAR_CONFIGS[p.carIndex];
                let netName = p.playerName || `Player ${index+1}`;

                const netCar = new Car3D(this.scene, netConfig, netStartX, netStartZ, true, netConfig.color, netName);
                netCar.angle = startPos.player.a;
                this.networkCars[p.id] = netCar;
            }
        });
        
        document.getElementById('restart-btn').classList.add('hidden');
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

  togglePause() {
    if (!this.isRunning || !this.canDrive || this.car.finished) return; 
    
    this.isPaused = !this.isPaused;

    if (this.isPaused) {
        this.pauseStartTime = Date.now();
        this.audio.stopEngine();
        document.getElementById('pause-layer').classList.remove('hidden');
        if (this.mode === 'online') document.getElementById('online-pause-warning').classList.remove('hidden');
        else document.getElementById('online-pause-warning').classList.add('hidden');
    } else {
        if (this.mode === 'offline') this.startTime += (Date.now() - this.pauseStartTime);
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
    if (this.environment.mapIndex !== 0 || !carObj || !carObj.mesh) return; 
    let pos = carObj.mesh.position;
    if (isNaN(pos.x) || isNaN(pos.z)) return;

    let dist = 0; let pushX = 0; let pushZ = 0;

    if (pos.z > -100 && pos.z < 100) {
      dist = Math.abs(pos.x - (pos.x < 0 ? -80 : 80));
      pushX = pos.x > (pos.x < 0 ? -80 : 80) ? -1 : 1;
    } else {
      let centerY = pos.z <= -100 ? -100 : 100;
      let d = Math.sqrt(pos.x * pos.x + (pos.z - centerY) * (pos.z - centerY));
      dist = Math.abs(d - 80);
      pushX = (0 - pos.x) / d; pushZ = (centerY - pos.z) / d;
      if (d < 80) { pushX *= -1; pushZ *= -1; }
    }
    if (dist > 18) {
      carObj.mesh.position.x += pushX * 0.5;
      carObj.mesh.position.z += pushZ * 0.5;
      carObj.speed *= 0.8;
    }
  }

  checkCollisions() {
    const allCars = [this.car, ...this.aiCars, ...Object.values(this.networkCars)];
    const radius = 2.5; 

    for (let i = 0; i < allCars.length; i++) {
      for (let j = i + 1; j < allCars.length; j++) {
        const c1 = allCars[i]; const c2 = allCars[j];
        if (!c1 || !c2 || !c1.mesh || !c2.mesh) continue; 
        if (isNaN(c1.mesh.position.x) || isNaN(c2.mesh.position.x)) continue;

        const dx = c1.mesh.position.x - c2.mesh.position.x;
        const dz = c1.mesh.position.z - c2.mesh.position.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < (radius*2) * (radius*2)) {
          const dist = Math.sqrt(distSq);
          const overlap = (radius*2) - dist;
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
    if (!this.car || !this.car.mesh) return;
    this.environment.boosts.forEach((b) => {
      [this.car, ...this.aiCars].forEach((car) => {
        if (!car || !car.mesh || car.finished) return;
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
    if (!carObj || !carObj.mesh || carObj.finished) return;
    let cp = this.environment.checkpoints[carObj.currentCheckpoint];
    let dx = carObj.mesh.position.x - cp.x;
    let dz = carObj.mesh.position.z - cp.z;

    if (Math.sqrt(dx * dx + dz * dz) < cp.r) {
      carObj.currentCheckpoint++;
      if (carObj.currentCheckpoint >= this.environment.checkpoints.length) {
        carObj.currentCheckpoint = 0;
        carObj.laps++;
        if (carObj === this.car) document.getElementById("lap-counter").innerText = carObj.laps;

        if (carObj.laps >= this.maxLaps) {
          carObj.finished = true;
          carObj.finishTime = ((Date.now() - this.startTime) / 1000).toFixed(2);
          
          if (carObj === this.car) {
              if (this.mode === 'online' && this.socket && this.socket.connected) {
                  this.socket.emit('playerFinished', { roomId: this.roomId, finishTime: carObj.finishTime });
              }
              this.triggerPlayerFinish();
          }
        }
      }
    }
  }

  updateCamera() {
    if (!this.car || !this.car.mesh || isNaN(this.car.mesh.position.x)) return;
    
    if (this.car.finished) {
      this.orbitAngle += 0.01;
      const radius = 20;
      const cx = this.car.mesh.position.x + Math.sin(this.orbitAngle) * radius;
      const cz = this.car.mesh.position.z + Math.cos(this.orbitAngle) * radius;
      const targetPos = new THREE.Vector3(cx, this.car.mesh.position.y + 6, cz);
      this.camera.position.lerp(targetPos, 0.05);
      this.camera.lookAt(this.car.mesh.position);
    } else {
      const offset = new THREE.Vector3(0, 10, -22).applyMatrix4(this.car.mesh.matrixWorld);
      this.camera.position.lerp(offset, 0.1);
      const lookAtPos = this.car.mesh.position.clone();
      lookAtPos.y += 2;
      this.camera.lookAt(lookAtPos);
    }
  }

  calculatePositions() {
    let allCars = [this.car, ...this.aiCars, ...Object.values(this.networkCars)];
    allCars.sort((a, b) => {
      if (a.finished && b.finished) return parseFloat(a.finishTime) - parseFloat(b.finishTime);
      if (a.finished) return -1;
      if (b.finished) return 1;

      let scoreA = (a.laps || 0) * 100 + (a.currentCheckpoint || 0) * 10;
      let scoreB = (b.laps || 0) * 100 + (b.currentCheckpoint || 0) * 10;

      if (scoreA !== scoreB) {
          return scoreB - scoreA;
      }

      let cpIndexA = (a.currentCheckpoint || 0) % this.environment.checkpoints.length;
      let cpA = this.environment.checkpoints[cpIndexA];
      
      let cpIndexB = (b.currentCheckpoint || 0) % this.environment.checkpoints.length;
      let cpB = this.environment.checkpoints[cpIndexB];

      if (cpA && cpB && a.mesh && b.mesh) {
          let distA = Math.pow(a.mesh.position.x - cpA.x, 2) + Math.pow(a.mesh.position.z - cpA.z, 2);
          let distB = Math.pow(b.mesh.position.x - cpB.x, 2) + Math.pow(b.mesh.position.z - cpB.z, 2);
          return distA - distB; 
      }

      return 0;
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
    document.getElementById("nos-container").style.display = 'none';
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
    
    // THE CRITICAL FIX: Safe return to the menu!
    document.getElementById("menu-screen").classList.remove("hidden");
    document.getElementById("nos-container").style.display = 'block';
  }

  loop() {
    if (!this.isRunning) return;

    if (this.isPaused && this.mode === 'offline') {
        this.renderer.render(this.scene, this.camera);
        this.reqFrame = requestAnimationFrame(() => this.loop());
        return;
    }

    try {
        let currentInput = (this.isPaused) ? { isPressed: () => false } : this.input;

        if (this.canDrive && this.car && !this.car.finished) {
          let currentTimer = (Date.now() - this.startTime) / 1000;
          document.getElementById("time-display").innerText = currentTimer.toFixed(2);
          
          let displaySpeed = Math.round(Math.abs(this.car.speed) * 85);
          document.getElementById("speed-display").innerText = displaySpeed;

          let currentStandings = this.calculatePositions();
          let playerRank = currentStandings.indexOf(this.car) + 1;
          
          let suffix = "th";
          if (playerRank === 1) suffix = "st";
          else if (playerRank === 2) suffix = "nd";
          else if (playerRank === 3) suffix = "rd";
          
          document.getElementById("position-display").innerText = playerRank + suffix;

          let isAccelerating = currentInput.isPressed(["ArrowUp", "KeyW"]);
          this.audio.updateEngine(this.car.speed, this.car.config.maxSpeed * 1.6, isAccelerating);

          const nosBar = document.getElementById("nos-bar");
          if (nosBar) {
              nosBar.style.width = this.car.nitrous + "%";
              if (this.car.nosLockout) nosBar.style.background = "red";
              else if (this.car.nitrous < 25) nosBar.style.background = "orange";
              else nosBar.style.background = "linear-gradient(90deg, #00ffff, #0055ff)";
          }

          if (this.mode === 'online' && this.socket && this.socket.connected) {
              this.socket.emit('playerMovement', {
                  roomId: this.roomId,
                  x: this.car.mesh.position.x,
                  z: this.car.mesh.position.z,
                  rotation: this.car.angle,
                  speed: this.car.speed,
                  turnDir: this.car.turnDir,
                  isBoosting: this.car.isBoosting,
                  isSkidding: this.car.isSkidding,
                  laps: this.car.laps,
                  checkpoint: this.car.currentCheckpoint
              });
          }
        }

        if (this.car) {
            this.car.update(currentInput, this.canDrive);
            this.keepCarOnTrack(this.car);
            if (this.canDrive) this.checkLaps(this.car, true);
        }

        if (this.mode === 'offline') {
            this.aiCars.forEach((ai) => {
              ai.updateAI(this.canDrive);
              ai.update(this.input, this.canDrive);
              this.keepCarOnTrack(ai);
              if (this.canDrive) this.checkLaps(ai, false);
            });
        } else {
            Object.values(this.networkCars).forEach(netCar => {
                if (netCar.networkData) netCar.updateNetworkVisuals(netCar.networkData);
            });
        }

        this.checkCollisions();
        this.checkItems();
        this.updateCamera();

    } catch (err) { console.warn("Recovered from game loop error:", err); }

    this.renderer.render(this.scene, this.camera);
    this.reqFrame = requestAnimationFrame(() => this.loop());
  }
}