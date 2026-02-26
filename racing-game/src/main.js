import './style.css'; 
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import GameEngine from './core/GameEngine.js';
import { CAR_CONFIGS } from './config/GameConfig.js'; 

const game = new GameEngine();
let selectedCar = 0;
let selectedDifficulty = 1; 
let selectedMap = 0; 
let inMenu = true; 

// ==========================================
// 1. MINI 3D SHOWCASE SETUP
// ==========================================
const showcaseContainer = document.getElementById('car-showcase');
const showcaseScene = new THREE.Scene();

const showcaseCamera = new THREE.PerspectiveCamera(45, 280 / 160, 0.1, 100);
showcaseCamera.position.set(4, 2.5, 5); 
showcaseCamera.lookAt(0, 0.8, 0); 

const showcaseRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
showcaseRenderer.setSize(280, 160);
showcaseRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
showcaseContainer.appendChild(showcaseRenderer.domElement);

showcaseScene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 10, 5);
showcaseScene.add(dirLight);

let currentShowcaseModel = null;
const gltfLoader = new GLTFLoader();

function animateShowcase() {
    if (!inMenu) return; 
    requestAnimationFrame(animateShowcase);
    
    if (currentShowcaseModel) {
        currentShowcaseModel.rotation.y -= 0.01; 
    }
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

    gltfLoader.load(
        config.modelPath, 
        (gltf) => {
            currentShowcaseModel = gltf.scene;
            const chassis = currentShowcaseModel.getObjectByName("body");
            if (chassis && chassis.isMesh) {
                chassis.material = chassis.material.clone();
                chassis.material.color.setHex(config.color);
            }
            currentShowcaseModel.position.set(0, 0, 0);
            showcaseScene.add(currentShowcaseModel);
        },
        undefined,
        (error) => { console.warn(`Could not load 3D model for menu: ${config.modelPath}`); }
    );
    
    carName.innerText = config.name.toUpperCase();
    const colorStr = '#' + config.color.toString(16).padStart(6, '0');
    carName.style.color = colorStr;
    carName.style.textShadow = `0 0 10px ${colorStr}80`;

    const spdPct = (config.maxSpeed / 2.5) * 100;
    const accPct = (config.accel / 0.06) * 100;
    const hdlPct = (config.handling / 0.06) * 100;

    statSpd.style.width = Math.min(100, spdPct) + '%'; statSpd.style.background = colorStr;
    statAcc.style.width = Math.min(100, accPct) + '%'; statAcc.style.background = colorStr;
    statHdl.style.width = Math.min(100, hdlPct) + '%'; statHdl.style.background = colorStr;
}

document.getElementById('prev-car').addEventListener('click', () => { selectedCar = (selectedCar - 1 + CAR_CONFIGS.length) % CAR_CONFIGS.length; updateCarUI(); });
document.getElementById('next-car').addEventListener('click', () => { selectedCar = (selectedCar + 1) % CAR_CONFIGS.length; updateCarUI(); });
updateCarUI();

// ==========================================
// 3. GAME STATE CONTROLS
// ==========================================
document.querySelectorAll('#map-select .card:not(.disabled)').forEach(card => {
    card.addEventListener('click', () => {
        document.querySelectorAll('#map-select .card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedMap = parseInt(card.dataset.map);
    });
});

document.querySelectorAll('#diff-select .card').forEach(card => {
    card.addEventListener('click', () => {
        document.querySelectorAll('#diff-select .card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedDifficulty = parseInt(card.dataset.diff);
    });
});

// START
document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('ui-layer').classList.add('hidden');
    inMenu = false; 
    game.start(selectedCar, selectedMap, selectedDifficulty); 
});

// END RACE MENU BUTTON
document.getElementById('menu-btn').addEventListener('click', () => {
    inMenu = true; animateShowcase(); game.stopGame();
});

// --- NEW: PAUSE MENU LISTENERS ---
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') game.togglePause();
});

document.getElementById('pause-toggle-btn').addEventListener('click', () => game.togglePause());
document.getElementById('resume-btn').addEventListener('click', () => game.togglePause());

document.getElementById('restart-btn').addEventListener('click', () => {
    game.stopGame();
    // Re-hide the UI because stopGame brings it back by default
    document.getElementById('ui-layer').classList.add('hidden');
    inMenu = false;
    game.start(selectedCar, selectedMap, selectedDifficulty);
});

document.getElementById('quit-btn').addEventListener('click', () => {
    game.stopGame();
    inMenu = true;
    animateShowcase();
});