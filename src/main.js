import './style.css'; 
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import GameEngine from './core/GameEngine.js';
import { CAR_CONFIGS } from './config/GameConfig.js'; 
import { io } from "socket.io-client";

const game = new GameEngine();
let selectedMode = 'offline'; 
let selectedCar = 0;
let selectedDifficulty = 1; 
let selectedMap = 0; 
let inMenu = true; 

const socket = io('http://localhost:3000');
let currentRoomId = null;
let isHost = false;

// ==========================================
// 1. AAA 3D SHOWCASE SETUP
// ==========================================
const showcaseContainer = document.getElementById('car-showcase');
const showcaseScene = new THREE.Scene();

const aspect = 1000 / 500;
const showcaseCamera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
showcaseCamera.position.set(6, 2.5, 7); 
showcaseCamera.lookAt(0, 0.5, 0); 

const showcaseRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
showcaseRenderer.setSize(1000, 500);
showcaseRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
showcaseContainer.appendChild(showcaseRenderer.domElement);

showcaseScene.add(new THREE.AmbientLight(0xffffff, 0.9));
const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(5, 10, 5);
showcaseScene.add(dirLight);

let currentShowcaseModel = null;
const gltfLoader = new GLTFLoader();

function animateShowcase() {
    if (!inMenu) return; 
    requestAnimationFrame(animateShowcase);
    if (currentShowcaseModel) currentShowcaseModel.rotation.y -= 0.005; 
    showcaseRenderer.render(showcaseScene, showcaseCamera);
}
animateShowcase();

// ==========================================
// 2. UI SYNC & MODEL SWAPPING
// ==========================================
const carName = document.getElementById('car-display-name');
const statSpd = document.getElementById('stat-spd');
const statAcc = document.getElementById('stat-acc');
const statHdl = document.getElementById('stat-hdl');

function updateCarUI() {
    const config = CAR_CONFIGS[selectedCar];
    if (currentShowcaseModel) {
        showcaseScene.remove(currentShowcaseModel);
        currentShowcaseModel = null;
    }
    
    gltfLoader.load(config.modelPath, (gltf) => {
        currentShowcaseModel = gltf.scene;
        currentShowcaseModel.rotation.x = 0.1; // Tilt slightly
        
        const chassis = currentShowcaseModel.getObjectByName("body");
        if (chassis && chassis.isMesh) {
            chassis.material = chassis.material.clone();
            chassis.material.color.setHex(config.color);
        }
        currentShowcaseModel.position.set(0, -0.5, 0); 
        showcaseScene.add(currentShowcaseModel);
    }, undefined, () => {});
    
    carName.innerText = config.name.toUpperCase();
    const colorStr = '#' + config.color.toString(16).padStart(6, '0');
    carName.style.color = colorStr;
    carName.style.textShadow = `0 0 20px ${colorStr}`;

    statSpd.style.width = Math.min(100, (config.maxSpeed / 2.5) * 100) + '%'; statSpd.style.background = colorStr;
    statAcc.style.width = Math.min(100, (config.accel / 0.06) * 100) + '%'; statAcc.style.background = colorStr;
    statHdl.style.width = Math.min(100, (config.handling / 0.06) * 100) + '%'; statHdl.style.background = colorStr;
}

document.getElementById('prev-car').addEventListener('click', () => { selectedCar = (selectedCar - 1 + CAR_CONFIGS.length) % CAR_CONFIGS.length; updateCarUI(); });
document.getElementById('next-car').addEventListener('click', () => { selectedCar = (selectedCar + 1) % CAR_CONFIGS.length; updateCarUI(); });
updateCarUI();

// ==========================================
// 3. MAIN MENU BUTTONS (VIEW 1)
// ==========================================
document.querySelectorAll('#mode-select .selection-card').forEach(card => {
    card.addEventListener('click', () => {
        document.querySelectorAll('#mode-select .selection-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedMode = card.dataset.mode;
        
        const diffSection = document.getElementById('difficulty-section');
        const startBtn = document.getElementById('start-btn');
        if (selectedMode === 'online') {
            diffSection.style.opacity = '0.2'; diffSection.style.pointerEvents = 'none';
            startBtn.innerText = "ENTER LOBBY";
        } else {
            diffSection.style.opacity = '1'; diffSection.style.pointerEvents = 'auto';
            startBtn.innerText = "START ENGINE";
        }
    });
});

document.querySelectorAll('#map-select .selection-card:not(.disabled)').forEach(card => {
    card.addEventListener('click', () => {
        document.querySelectorAll('#map-select .selection-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected'); selectedMap = parseInt(card.dataset.map);
    });
});

document.querySelectorAll('#diff-select .selection-card').forEach(card => {
    card.addEventListener('click', () => {
        document.querySelectorAll('#diff-select .selection-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected'); selectedDifficulty = parseInt(card.dataset.diff);
    });
});

document.getElementById('start-btn').addEventListener('click', () => {
    if (selectedMode === 'offline') {
        document.getElementById('menu-screen').classList.add('hidden');
        inMenu = false; 
        game.start(selectedCar, selectedMap, selectedDifficulty, 'offline'); 
    } else {
        document.getElementById('view-main').classList.add('hidden');
        document.getElementById('view-lobby-join').classList.remove('hidden');
    }
});

// ==========================================
// 4. LOBBY NETWORKING LOGIC (VIEWS 2 & 3)
// ==========================================
function renderLobbyPlayers(players) {
    const list = document.getElementById('players-list');
    list.innerHTML = '';
    
    players.forEach((p) => {
        const row = document.createElement('div');
        row.style.cssText = "display: flex; justify-content: space-between; padding: 12px 15px; background: rgba(0,0,0,0.6); border-radius: 4px; border: 1px solid #333; font-size: 18px; font-family: 'Orbitron'; align-items: center;";
        
        let nameColor = p.id === socket.id ? "var(--primary)" : "#fff";
        let title = p.playerName; 
        if (p.id === socket.id) title += " (You)";
        if (p.isHost) title += " <span style='font-size:12px; color:var(--accent); margin-left:10px;'>HOST</span>";

        let carName = CAR_CONFIGS[p.carIndex].name;
        
        row.innerHTML = `<span style="color: ${nameColor};">${title}</span><span style="color: #aaa; font-size:14px;">${carName}</span>`;
        list.appendChild(row);
    });
}

document.getElementById('create-room-btn').addEventListener('click', () => {
    const name = document.getElementById('player-name-input').value.trim() || "HOST";
    socket.emit('createRoom', { carIndex: selectedCar, playerName: name });
});

document.getElementById('join-room-btn').addEventListener('click', () => {
    const code = document.getElementById('room-code-input').value.toUpperCase();
    const name = document.getElementById('player-name-input').value.trim() || "PLAYER";
    if (code.length === 4) {
        document.getElementById('room-error').innerText = "";
        socket.emit('joinRoom', { roomId: code, carIndex: selectedCar, playerName: name });
    } else {
        document.getElementById('room-error').innerText = "INVALID CODE.";
    }
});

socket.on('roomCreated', (roomId) => {
    currentRoomId = roomId; isHost = true;
    document.getElementById('view-lobby-join').classList.add('hidden');
    document.getElementById('view-room').classList.remove('hidden');
    document.getElementById('display-room-code').innerText = roomId;
    
    document.getElementById('start-race-btn').classList.remove('hidden');
    document.getElementById('waiting-host-msg').classList.add('hidden');
});

socket.on('roomJoined', (roomId) => {
    currentRoomId = roomId; isHost = false;
    document.getElementById('view-lobby-join').classList.add('hidden');
    document.getElementById('view-room').classList.remove('hidden');
    document.getElementById('display-room-code').innerText = roomId;
    
    document.getElementById('start-race-btn').classList.add('hidden');
    document.getElementById('waiting-host-msg').classList.remove('hidden');
});

socket.on('roomError', (msg) => {
    document.getElementById('room-error').innerText = msg;
});

socket.on('lobbyUpdated', (players) => {
    renderLobbyPlayers(players);
    let me = players.find(p => p.id === socket.id);
    if (me && me.isHost) {
        isHost = true;
        document.getElementById('start-race-btn').classList.remove('hidden');
        document.getElementById('waiting-host-msg').classList.add('hidden');
    }
});

document.getElementById('start-race-btn').addEventListener('click', () => {
    socket.emit('startGame', currentRoomId);
});

socket.on('gameStarted', (players) => {
    document.getElementById('menu-screen').classList.add('hidden');
    inMenu = false;
    game.start(selectedCar, selectedMap, selectedDifficulty, 'online', socket, currentRoomId, players);
});

document.getElementById('leave-room-btn').addEventListener('click', () => {
    socket.emit('leaveRoom');
    document.getElementById('view-room').classList.add('hidden');
    document.getElementById('view-lobby-join').classList.remove('hidden');
});

document.getElementById('lobby-back-btn').addEventListener('click', () => {
    document.getElementById('view-lobby-join').classList.add('hidden');
    document.getElementById('view-main').classList.remove('hidden');
});

// ==========================================
// 5. IN-GAME PAUSE / END MENUS
// ==========================================
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') game.togglePause();
});

document.getElementById('pause-toggle-btn').addEventListener('click', () => game.togglePause());
document.getElementById('resume-btn').addEventListener('click', () => game.togglePause());

document.getElementById('restart-btn').addEventListener('click', () => {
    game.stopGame();
    document.getElementById('menu-screen').classList.remove('hidden'); // Show menu!
    document.getElementById('view-main').classList.remove('hidden');
    document.getElementById('view-lobby-join').classList.add('hidden');
    document.getElementById('view-room').classList.add('hidden');
    inMenu = true;
    animateShowcase();
});

const returnToMenu = () => {
    if (selectedMode === 'online') socket.emit('leaveRoom');
    game.stopGame();
    inMenu = true; animateShowcase();
    
    document.getElementById('menu-screen').classList.remove('hidden'); // Show menu!
    document.getElementById('view-room').classList.add('hidden');
    if (selectedMode === 'online') {
        document.getElementById('view-lobby-join').classList.remove('hidden');
        document.getElementById('view-main').classList.add('hidden');
    } else {
        document.getElementById('view-main').classList.remove('hidden');
        document.getElementById('view-lobby-join').classList.add('hidden');
    }
};

document.getElementById('quit-btn').addEventListener('click', returnToMenu);
document.getElementById('menu-btn').addEventListener('click', returnToMenu);