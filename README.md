# 🏎️ Neon Racer 3D

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Three.js](https://img.shields.io/badge/three.js-r150+-black.svg?style=flat&logo=three.js)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=flat&logo=vite&logoColor=white)

**Neon Racer 3D** is a fully-featured, browser-based 3D racing game built entirely in JavaScript using **Three.js** and **Vite**. 

Designed with a focus on both gameplay feel and extreme rendering performance, the game pits players against smart AI opponents across procedurally generated tracks.

## ✨ Features

* **Advanced Engine & Physics:** Custom vehicle physics with drifting, friction, and a manual Nitrous (NOS) system featuring a cooldown/overheat lockout mechanic.
* **Smart AI Opponents:** AI racers dynamically calculate trajectories, adjust speed for corners, and physically use their own Nitrous boosts on straightaways on "Veteran" difficulty.
* **Extreme Optimization:** Engineered for a locked 60 FPS on standard hardware.
  * **Object Pooling:** Zero garbage-collection memory leaks. Exhaust particles and skidmarks are pooled and recycled.
  * **Instanced Rendering:** Background forests and rock formations use `THREE.InstancedMesh` to reduce thousands of draw calls down to a single GPU command.
  * **Procedural Textures:** Asphalt grain, grass, desert sand, and the checkered finish line are generated dynamically via the HTML5 Canvas API, eliminating the need for heavy image assets.
* **Modern UI/UX:** A stunning "Glassmorphism" menu system with a live 3D car showcase, animated backgrounds, dynamic stat bars, and a fully functional pause/results menu.

## 🎮 Controls

* **W / Up Arrow:** Accelerate
* **S / Down Arrow:** Brake / Reverse
* **A / D / Left & Right Arrows:** Steer
* **SPACE:** E-Brake / Drift
* **SHIFT:** Nitrous Boost (Hold)
* **ESC:** Pause Game

## 🛠️ Installation & Setup

**1. Clone the repository:**

```bash
git clone https://github.com/yourusername/neon-racer-3d.git
cd neon-racer-3d
```
**2. Install dependencies:**

```bash
npm install
```

**3. Start the development server:**

```bash
npm run dev
```

👨‍💻 Developed By Hiruna

* Note: This game requires a physical keyboard and is restricted to desktop browsers to ensure the best possible player experience.

<img width="1905" height="941" alt="image" src="https://github.com/user-attachments/assets/e1351f49-05ab-403a-bb10-4b438425a320" />

<img width="1907" height="999" alt="image" src="https://github.com/user-attachments/assets/e5064250-be2c-4f77-9104-16c0a4e33aed" />






