export default class AudioManager {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.engineOsc = null;
    this.engineGain = null;
  }

  init() {
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.startEngine();
  }

  playTone(freq, type, duration, vol = 0.1) {
    let osc = this.ctx.createOscillator();
    let gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.ctx.currentTime + duration,
    );
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  startEngine() {
    if (this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = "sawtooth";

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.05; // Low volume rumble

    let filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 300; // Muffle the harsh sawtooth

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
  }

  updateEngine(speed, maxSpeed, isAccelerating) {
    if (!this.engineOsc) return;

    // Base pitch determined by the car's rolling speed
    let basePitch = 40 + (Math.abs(speed) / maxSpeed) * 130;

    // Spike the pitch instantly if the gas pedal is pressed (engine load)
    if (isAccelerating) {
      basePitch += 50;
    }

    // Smoothly transition to the new pitch so it doesn't pop
    this.engineOsc.frequency.setTargetAtTime(
      basePitch,
      this.ctx.currentTime,
      0.1,
    );
  }

  stopEngine() {
    if (this.engineGain) {
      this.engineGain.gain.exponentialRampToValueAtTime(
        0.001,
        this.ctx.currentTime + 1,
      );
      setTimeout(() => {
        if (this.engineOsc) {
          this.engineOsc.stop();
          this.engineOsc = null;
        }
      }, 1000);
    }
  }

  playBoost() {
    let osc = this.ctx.createOscillator();
    let gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      1200,
      this.ctx.currentTime + 0.3,
    ); // Quick upward pitch sweep
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.8);
  }

  playFinish() {
    // Little victory melody
    this.playTone(523.25, "square", 0.2, 0.05); // C5
    setTimeout(() => this.playTone(659.25, "square", 0.2, 0.05), 150); // E5
    setTimeout(() => this.playTone(783.99, "square", 0.4, 0.05), 300); // G5
    setTimeout(() => this.playTone(1046.5, "square", 0.6, 0.05), 500); // C6
  }
}
