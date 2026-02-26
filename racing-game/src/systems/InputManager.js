export default class InputManager {
    constructor() {
        this.keys = {};
        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);
    }
    isPressed(codes) { return codes.some(code => this.keys[code]); }
}