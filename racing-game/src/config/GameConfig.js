export const CAR_CONFIGS = [
    { 
        name: "Striker", 
        color: 0xff4757, 
        maxSpeed: 2.2, 
        accel: 0.05, 
        handling: 0.035, 
        modelPath: '/models/car.glb' // <-- MAKE SURE THIS FILE EXISTS IN YOUR FOLDER
    },
    { 
        name: "Nomad", 
        color: 0x2ed573, 
        maxSpeed: 1.8, 
        accel: 0.04, 
        handling: 0.05, 
        modelPath: '/models/car.glb' // Replace with '/models/nomad.glb' when you download one
    },
    { 
        name: "Titan", 
        color: 0xffa502, 
        maxSpeed: 1.5, 
        accel: 0.035, 
        handling: 0.04, 
        modelPath: '/models/truck.glb' // Replace with '/models/titan.glb' when you download one
    }
];

export const AI_COLORS = [0x3498db, 0x9b59b6, 0xe67e22];
export const AI_NAMES = ["Blue Comet", "Purple Phantom", "Orange Thunder"];