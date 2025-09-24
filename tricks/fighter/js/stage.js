// Stage class for fighting game
class Stage {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.groundY = height - 80; // Ground level
    
    // Define platforms
    this.platforms = [
      // Main ground platform
      { x: 0, y: this.groundY, width: width, height: 80 },
      
      // Floating platforms
      { x: 300, y: this.groundY - 150, width: 200, height: 20 },
      { x: 700, y: this.groundY - 150, width: 200, height: 20 },
      { x: 500, y: this.groundY - 250, width: 200, height: 20 },
      
      // Side platforms
      { x: 100, y: this.groundY - 300, width: 150, height: 20 },
      { x: 950, y: this.groundY - 300, width: 150, height: 20 }
    ];
    
    // Background elements
    this.backgroundElements = this.generateBackground();
  }

  generateBackground() {
    const elements = [];
    
    // Generate some background decorations
    for (let i = 0; i < 20; i++) {
      elements.push({
        x: Math.random() * this.width,
        y: Math.random() * (this.height - 200),
        size: Math.random() * 3 + 1,
        color: `rgba(${100 + Math.random() * 100}, ${100 + Math.random() * 100}, ${150 + Math.random() * 100}, 0.3)`,
        speed: Math.random() * 0.5 + 0.1
      });
    }
    
    return elements;
  }

  update() {
    // Animate background elements
    for (let element of this.backgroundElements) {
      element.x -= element.speed;
      if (element.x < -10) {
        element.x = this.width + 10;
      }
    }
  }

  draw(ctx) {
    // Clear canvas
    ctx.fillStyle = '#000814';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#001d3d');
    gradient.addColorStop(0.5, '#003566');
    gradient.addColorStop(1, '#000814');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw background elements (stars/particles)
    for (let element of this.backgroundElements) {
      ctx.fillStyle = element.color;
      ctx.beginPath();
      ctx.arc(element.x, element.y, element.size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw platforms
    for (let platform of this.platforms) {
      if (platform.y === this.groundY) {
        // Main ground - special styling
        ctx.fillStyle = '#2d5016';
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        
        // Grass texture
        ctx.fillStyle = '#4d7c0f';
        ctx.fillRect(platform.x, platform.y, platform.width, 8);
        
        // Add some texture details
        for (let i = 0; i < platform.width; i += 20) {
          ctx.fillStyle = '#65a30d';
          ctx.fillRect(platform.x + i, platform.y + 2, 2, 4);
        }
      } else {
        // Floating platforms
        ctx.fillStyle = '#374151';
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        
        // Platform highlight
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(platform.x, platform.y, platform.width, 4);
        
        // Platform shadow
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(platform.x, platform.y + platform.height - 4, platform.width, 4);
        
        // Ledge indicators
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(platform.x - 2, platform.y, 2, platform.height);
        ctx.fillRect(platform.x + platform.width, platform.y, 2, platform.height);
      }
    }
    
    // Draw stage boundaries
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, this.height);
    ctx.moveTo(this.width, 0);
    ctx.lineTo(this.width, this.height);
    ctx.stroke();
  }

  // Check if a point is on solid ground
  isOnSolidGround(x, y, width, height) {
    for (let platform of this.platforms) {
      if (x + width > platform.x &&
          x < platform.x + platform.width &&
          y + height >= platform.y &&
          y + height <= platform.y + platform.height) {
        return true;
      }
    }
    return false;
  }

  // Get the top Y coordinate of the platform at given X position
  getPlatformY(x, width) {
    let lowestY = this.groundY;
    
    for (let platform of this.platforms) {
      if (x + width > platform.x && x < platform.x + platform.width) {
        if (platform.y < lowestY) {
          lowestY = platform.y;
        }
      }
    }
    
    return lowestY;
  }
}