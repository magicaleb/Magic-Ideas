// Input Manager for 2-Player Fighting Game
class InputManager {
  constructor() {
    this.keys = new Set();
    this.player1Keys = {
      left: 'KeyA',
      right: 'KeyD', 
      up: 'KeyW',
      down: 'KeyS',
      attack: 'KeyF',
      special: 'KeyG'
    };
    this.player2Keys = {
      left: 'ArrowLeft',
      right: 'ArrowRight',
      up: 'ArrowUp', 
      down: 'ArrowDown',
      attack: 'KeyK',
      special: 'KeyL'
    };
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('keydown', (e) => {
      e.preventDefault();
      this.keys.add(e.code);
    });

    document.addEventListener('keyup', (e) => {
      e.preventDefault();
      this.keys.delete(e.code);
    });

    // Prevent default browser behaviors
    document.addEventListener('keydown', (e) => {
      if ([
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyK', 'KeyL'
      ].includes(e.code)) {
        e.preventDefault();
      }
    });
  }

  isPressed(keyCode) {
    return this.keys.has(keyCode);
  }

  getPlayerInput(playerNum) {
    const keys = playerNum === 1 ? this.player1Keys : this.player2Keys;
    
    return {
      left: this.isPressed(keys.left),
      right: this.isPressed(keys.right),
      up: this.isPressed(keys.up),
      down: this.isPressed(keys.down),
      attack: this.isPressed(keys.attack),
      special: this.isPressed(keys.special)
    };
  }

  // For handling single key press events (not held)
  wasJustPressed(keyCode) {
    // This would need frame-based tracking for proper implementation
    // For now, we'll use the continuous press system
    return this.isPressed(keyCode);
  }
}