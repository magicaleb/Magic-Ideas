// Game Engine for 2-Player Fighting Game
class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false; // Pixel art style
    
    // Game state
    this.gameState = 'menu'; // menu, playing, paused, gameOver
    this.gameTime = 99; // seconds
    this.gameTimer = 0;
    
    // Game objects
    this.inputManager = new InputManager();
    this.soundManager = new SoundManager();
    this.stage = new Stage(canvas.width, canvas.height);
    
    // Players
    this.player1 = new Player(200, 100, 1, '#4ade80'); // Green
    this.player2 = new Player(1000, 100, 2, '#f87171'); // Red
    
    // Game loop
    this.lastTime = 0;
    this.running = false;
    
    // Winner tracking
    this.winner = null;
  }

  start() {
    this.gameState = 'playing';
    this.running = true;
    this.soundManager.resumeAudioContext();
    this.soundManager.startBackgroundMusic();
    this.gameLoop();
  }

  stop() {
    this.running = false;
    this.gameState = 'gameOver';
    this.soundManager.stopBackgroundMusic();
  }

  pause() {
    this.running = false;
    this.gameState = 'paused';
  }

  resume() {
    if (this.gameState === 'paused') {
      this.running = true;
      this.gameState = 'playing';
      this.gameLoop();
    }
  }

  reset() {
    // Reset game state
    this.gameTime = 99;
    this.gameTimer = 0;
    this.winner = null;
    
    // Reset players
    this.player1 = new Player(200, 100, 1, '#4ade80');
    this.player2 = new Player(1000, 100, 2, '#f87171');
    
    // Reset stage
    this.stage = new Stage(this.canvas.width, this.canvas.height);
  }

  gameLoop(currentTime = 0) {
    if (!this.running) return;
    
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    
    // Target 60 FPS
    if (deltaTime >= 16.67) {
      this.update();
      this.render();
    }
    
    requestAnimationFrame((time) => this.gameLoop(time));
  }

  update() {
    if (this.gameState !== 'playing') return;
    
    // Update game timer
    this.gameTimer++;
    if (this.gameTimer >= 60) { // 60 frames = 1 second at 60fps
      this.gameTime--;
      this.gameTimer = 0;
      
      if (this.gameTime <= 0) {
        this.endGame('time');
      }
    }
    
    // Get input for both players
    const p1Input = this.inputManager.getPlayerInput(1);
    const p2Input = this.inputManager.getPlayerInput(2);
    
    // Update players
    this.player1.update(p1Input, this.stage, this.player2);
    this.player2.update(p2Input, this.stage, this.player1);
    
    // Update stage
    this.stage.update();
    
    // Check for game end conditions
    this.checkGameEnd();
    
    // Play sound effects based on player states
    this.handleSoundEffects();
  }

  handleSoundEffects() {
    // Check for jumps
    if (this.player1.animationState === 'jump' && this.player1.vy < -10) {
      // Only play sound at start of jump
    }
    
    // Check for attacks
    if (this.player1.isAttacking && this.player1.attackCooldown === 19) {
      this.soundManager.playSound('attack');
    }
    if (this.player2.isAttacking && this.player2.attackCooldown === 19) {
      this.soundManager.playSound('attack');
    }
    
    // Check for special moves
    if (this.player1.isUsingSpecial && this.player1.specialCooldown === 119) {
      this.soundManager.playSound('special');
    }
    if (this.player2.isUsingSpecial && this.player2.specialCooldown === 119) {
      this.soundManager.playSound('special');
    }
    
    // Check for hits (when players take damage)
    if (this.player1.isHurt && this.player1.hurtTime === 19) {
      this.soundManager.playSound('hit');
    }
    if (this.player2.isHurt && this.player2.hurtTime === 19) {
      this.soundManager.playSound('hit');
    }
  }

  checkGameEnd() {
    // Check if either player is out of lives
    if (this.player1.lives <= 0) {
      this.endGame('player2');
    } else if (this.player2.lives <= 0) {
      this.endGame('player1');
    }
  }

  endGame(winner) {
    this.stop();
    this.winner = winner;
    
    if (winner === 'time') {
      // Determine winner by least damage or most lives
      if (this.player1.lives > this.player2.lives) {
        this.winner = 'player1';
      } else if (this.player2.lives > this.player1.lives) {
        this.winner = 'player2';
      } else if (this.player1.damage < this.player2.damage) {
        this.winner = 'player1';
      } else if (this.player2.damage < this.player1.damage) {
        this.winner = 'player2';
      } else {
        this.winner = 'draw';
      }
    }
    
    // Play victory sound
    if (this.winner !== 'draw') {
      this.soundManager.playSound('victory');
    }
  }

  render() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw stage
    this.stage.draw(this.ctx);
    
    // Draw players
    this.player1.draw(this.ctx);
    this.player2.draw(this.ctx);
    
    // Draw debug info
    this.drawDebugInfo();
  }

  drawDebugInfo() {
    // Draw collision boxes (for debugging)
    if (false) { // Set to true for debugging
      this.ctx.strokeStyle = '#ff0000';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(this.player1.x, this.player1.y, this.player1.width, this.player1.height);
      this.ctx.strokeRect(this.player2.x, this.player2.y, this.player2.width, this.player2.height);
    }
  }

  // Public methods for external control
  getGameState() {
    return {
      gameState: this.gameState,
      gameTime: this.gameTime,
      player1: {
        lives: this.player1.lives,
        damage: this.player1.damage,
        x: this.player1.x,
        y: this.player1.y
      },
      player2: {
        lives: this.player2.lives,
        damage: this.player2.damage,
        x: this.player2.x,
        y: this.player2.y
      },
      winner: this.winner
    };
  }

  // Handle window resize
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.stage = new Stage(width, height);
  }
}