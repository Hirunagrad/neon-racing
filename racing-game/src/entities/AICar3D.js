import Car3D from './Car3D.js';

export default class AICar3D extends Car3D {
    constructor(scene, config, x, z, color, name, waypoints, difficulty = 1) {
        super(scene, config, x, z, true, color, name);
        this.waypoints = waypoints || [];
        this.currentWaypoint = 0;
        this.difficulty = difficulty;

        // Base Speed Multipliers
        let diffMult = 0.95; // Medium
        if (difficulty === 0) diffMult = 0.70; // Easy (Slower, easy to lap)
        if (difficulty === 2) diffMult = 1.25; // Hard (Faster base speed)

        // Give each AI a slightly different personality so they don't drive in a single line
        let variation = 0.95 + Math.random() * 0.1;

        this.baseAiMaxSpeed = config.maxSpeed * diffMult * variation;
        this.baseAiAccel = config.accel * diffMult * variation;
        
        // Spread them out across the width of the track
        this.laneOffset = (Math.random() - 0.5) * 16; 
    }

    updateAI(canDrive) {
        if (!canDrive || this.finished || this.waypoints.length === 0) return;

        let target = this.waypoints[this.currentWaypoint];
        let targetX = target.x;
        let targetZ = target.z;
        
        // Apply lane offsets mostly on the straights
        if (target.z === 0) targetX += this.laneOffset; 
        if (target.x === 0) targetZ += this.laneOffset; 
        
        let dx = targetX - this.mesh.position.x;
        let dz = targetZ - this.mesh.position.z;
        
        // When they get close enough to the waypoint, target the next one
        if (Math.sqrt(dx*dx + dz*dz) < 40) {
            this.currentWaypoint = (this.currentWaypoint + 1) % this.waypoints.length;
        }

        let targetAngle = Math.atan2(dx, dz);
        let angleDiff = targetAngle - this.angle;
        
        // Normalize the angle so they don't spin in circles
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Steer towards the target
        this.angle += angleDiff * 0.1; 
        this.lastAiTurnDir = angleDiff > 0.1 ? 1 : (angleDiff < -0.1 ? -1 : 0);

        // --- NEW: AI NITROUS LOGIC ---
        let currentAiMaxSpeed = this.baseAiMaxSpeed;
        let currentAiAccel = this.baseAiAccel;

        // "isStraight" checks if the AI is pointing almost directly at its target (not turning sharply)
        let isStraight = Math.abs(angleDiff) < 0.15;
        
        if (isStraight) {
            if (this.difficulty === 2) {
                // HARD MODE: AI uses NOS on straights!
                currentAiMaxSpeed *= 1.45; 
                currentAiAccel *= 1.5;
                if (this.speed > this.config.maxSpeed * 0.8) {
                    this.emitParticles(); // Visually shoot blue flames from AI cars!
                }
            } else if (this.difficulty === 1) {
                // MEDIUM MODE: Mild boost on straights
                currentAiMaxSpeed *= 1.15;
            }
        } else {
            // Let the AI slightly brake on corners so they don't drift into walls
            currentAiMaxSpeed *= 0.85; 
        }

        // Apply acceleration
        this.speed += currentAiAccel; 
        this.speed = Math.min(currentAiMaxSpeed, this.speed);
    }
}