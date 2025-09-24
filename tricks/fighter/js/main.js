// Main game controller
class FightingGame {
  constructor() {
    this.gameEngine = null;
    this.uiElements = {};
    this.currentScreen = 'start';
    
    this.initializeUI();
    this.setupEventListeners();
  }

  initializeUI() {
    // Get UI elements
    this.uiElements = {
      startScreen: document.getElementById('startScreen'),
      gameScreen: document.getElementById('gameScreen'),
      endScreen: document.getElementById('endScreen'),
      startButton: document.getElementById('startButton'),
      playAgainButton: document.getElementById('playAgainButton'),
      backToMenuButton: document.getElementById('backToMenuButton'),
      gameCanvas: document.getElementById('gameCanvas'),
      gameTimer: document.getElementById('gameTimer'),
      p1Lives: document.getElementById('p1Lives'),
      p1Damage: document.getElementById('p1Damage'),
      p2Lives: document.getElementById('p2Lives'),
      p2Damage: document.getElementById('p2Damage'),
      winnerText: document.getElementById('winnerText')
    };

    // Initialize game engine
    this.gameEngine = new GameEngine(this.uiElements.gameCanvas);
  }

  setupEventListeners() {
    // Start button
    this.uiElements.startButton.addEventListener('click', () => {
      this.startGame();
    });

    // Play again button
    this.uiElements.playAgainButton.addEventListener('click', () => {
      this.restartGame();
    });

    // Back to menu button
    this.uiElements.backToMenuButton.addEventListener('click', () => {
      this.showStartScreen();
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      this.handleResize();
    });

    // Handle visibility change (pause when tab is not active)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.gameEngine.gameState === 'playing') {
        this.gameEngine.pause();
      } else if (!document.hidden && this.gameEngine.gameState === 'paused') {
        this.gameEngine.resume();
      }
    });

    // Prevent default keyboard behaviors for game keys
    document.addEventListener('keydown', (e) => {
      if ([
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyK', 'KeyL'
      ].includes(e.code)) {
        e.preventDefault();
      }

      // ESC to pause/unpause
      if (e.code === 'Escape') {
        if (this.gameEngine.gameState === 'playing') {
          this.gameEngine.pause();
        } else if (this.gameEngine.gameState === 'paused') {
          this.gameEngine.resume();
        }
      }
    });
  }

  startGame() {
    this.showGameScreen();
    this.gameEngine.reset();
    this.gameEngine.start();
    this.startUIUpdateLoop();
  }

  restartGame() {
    this.gameEngine.reset();
    this.gameEngine.start();
    this.showGameScreen();
    this.startUIUpdateLoop();
  }

  showStartScreen() {
    this.currentScreen = 'start';
    this.uiElements.startScreen.style.display = 'flex';
    this.uiElements.gameScreen.style.display = 'none';
    this.uiElements.endScreen.style.display = 'none';
    
    if (this.gameEngine) {
      this.gameEngine.stop();
    }
  }

  showGameScreen() {
    this.currentScreen = 'game';
    this.uiElements.startScreen.style.display = 'none';
    this.uiElements.gameScreen.style.display = 'flex';
    this.uiElements.endScreen.style.display = 'none';
  }

  showEndScreen() {
    this.currentScreen = 'end';
    this.uiElements.startScreen.style.display = 'none';
    this.uiElements.gameScreen.style.display = 'none';
    this.uiElements.endScreen.style.display = 'flex';
  }

  startUIUpdateLoop() {
    const updateUI = () => {
      if (this.currentScreen === 'game') {
        const gameState = this.gameEngine.getGameState();
        
        // Update timer
        this.uiElements.gameTimer.textContent = gameState.gameTime;
        
        // Update Player 1 UI
        this.uiElements.p1Lives.textContent = '♥'.repeat(gameState.player1.lives);
        this.uiElements.p1Damage.textContent = `${gameState.player1.damage}%`;
        
        // Update Player 2 UI
        this.uiElements.p2Lives.textContent = '♥'.repeat(gameState.player2.lives);
        this.uiElements.p2Damage.textContent = `${gameState.player2.damage}%`;
        
        // Check for game end
        if (gameState.gameState === 'gameOver') {
          this.handleGameEnd(gameState.winner);
          return;
        }
        
        requestAnimationFrame(updateUI);
      }
    };
    
    updateUI();
  }

  handleGameEnd(winner) {
    let winnerText = '';
    
    switch (winner) {
      case 'player1':
        winnerText = 'Player 1 Wins!';
        this.uiElements.winnerText.classList.add('winner-glow');
        break;
      case 'player2':
        winnerText = 'Player 2 Wins!';
        this.uiElements.winnerText.classList.add('winner-glow');
        break;
      case 'draw':
        winnerText = "It's a Draw!";
        break;
      default:
        winnerText = 'Game Over';
    }
    
    this.uiElements.winnerText.textContent = winnerText;
    this.showEndScreen();
    
    // Remove glow effect after animation
    setTimeout(() => {
      this.uiElements.winnerText.classList.remove('winner-glow');
    }, 3000);
  }

  handleResize() {
    // Adjust canvas size while maintaining aspect ratio
    const container = this.uiElements.gameScreen;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight - 100; // Account for UI
    
    const aspectRatio = 1200 / 600; // Original canvas aspect ratio
    
    let newWidth, newHeight;
    
    if (containerWidth / containerHeight > aspectRatio) {
      newHeight = containerHeight;
      newWidth = newHeight * aspectRatio;
    } else {
      newWidth = containerWidth;
      newHeight = newWidth / aspectRatio;
    }
    
    this.uiElements.gameCanvas.style.width = `${newWidth}px`;
    this.uiElements.gameCanvas.style.height = `${newHeight}px`;
  }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
  const game = new FightingGame();
  
  // Handle initial resize
  setTimeout(() => {
    game.handleResize();
  }, 100);
});

// Export for potential external access
window.FightingGame = FightingGame;