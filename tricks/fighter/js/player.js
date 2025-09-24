// Player class for fighting game
class Player {
  constructor(x, y, playerNum, color) {
    // Position and physics
    this.x = x;
    this.y = y;
    this.width = 40;
    this.height = 60;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facingRight = playerNum === 1;
    
    // Player properties
    this.playerNum = playerNum;
    this.color = color;
    this.lives = 3;
    this.damage = 0;
    this.maxDamage = 999;
    
    // Movement constants
    this.speed = 5;
    this.jumpPower = 15;
    this.gravity = 0.8;
    this.friction = 0.85;
    this.maxFallSpeed = 20;
    
    // Combat properties
    this.isAttacking = false;
    this.attackCooldown = 0;
    this.isHurt = false;
    this.hurtTime = 0;
    this.invulnerable = false;
    this.invulnerableTime = 0;
    
    // Animation state
    this.animationState = 'idle';
    this.animationFrame = 0;
    this.animationTimer = 0;
    
    // Ledge grabbing
    this.isGrabbingLedge = false;
    this.grabbedLedge = null;
    
    // Special move properties
    this.specialCooldown = 0;
    this.isUsingSpecial = false;
  }

  update(input, stage, otherPlayer) {
    this.handleInput(input, stage);
    this.updatePhysics(stage);
    this.updateCombat(otherPlayer);
    this.updateAnimation();
    this.updateTimers();
  }

  handleInput(input, stage) {
    if (this.isHurt || this.isGrabbingLedge) {
      // Limited input during hurt or ledge grab
      if (this.isGrabbingLedge && input.up) {
        this.climbUpFromLedge();
      }
      return;
    }

    // Horizontal movement
    if (input.left && !input.right) {
      this.vx = -this.speed;
      this.facingRight = false;
      if (this.onGround) this.animationState = 'walk';
    } else if (input.right && !input.left) {
      this.vx = this.speed;
      this.facingRight = true;
      if (this.onGround) this.animationState = 'walk';
    } else {
      this.vx *= this.friction;
      if (this.onGround && Math.abs(this.vx) < 0.1) {
        this.vx = 0;
        this.animationState = 'idle';
      }
    }

    // Jumping
    if (input.up && this.onGround) {
      this.vy = -this.jumpPower;
      this.onGround = false;
      this.animationState = 'jump';
    }

    // Attacks
    if (input.attack && this.attackCooldown <= 0) {
      this.performAttack();
    }

    // Special moves
    if (input.special && this.specialCooldown <= 0) {
      this.performSpecial();
    }
  }

  updatePhysics(stage) {
    if (this.isGrabbingLedge) return;

    // Apply gravity
    this.vy += this.gravity;
    this.vy = Math.min(this.vy, this.maxFallSpeed);

    // Update position
    this.x += this.vx;
    this.y += this.vy;

    // Ground collision
    if (this.y + this.height >= stage.groundY) {
      this.y = stage.groundY - this.height;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // Platform collision
    for (let platform of stage.platforms) {
      if (this.vy > 0 && // Falling
          this.x + this.width > platform.x &&
          this.x < platform.x + platform.width &&
          this.y + this.height > platform.y &&
          this.y + this.height < platform.y + 20) {
        
        this.y = platform.y - this.height;
        this.vy = 0;
        this.onGround = true;
      }
    }

    // Check for ledge grabbing
    this.checkLedgeGrab(stage);

    // Screen boundaries
    this.x = Math.max(0, Math.min(this.x, stage.width - this.width));
    
    // Fall off screen (lose a life)
    if (this.y > stage.height + 100) {
      this.loseLife();
    }
  }

  checkLedgeGrab(stage) {
    if (this.vy <= 0 || this.onGround) return;

    for (let platform of stage.platforms) {
      // Check right edge
      if (this.x + this.width >= platform.x + platform.width - 5 &&
          this.x + this.width <= platform.x + platform.width + 10 &&
          this.y >= platform.y - this.height &&
          this.y <= platform.y + 10) {
        
        this.grabLedge(platform, 'right');
        return;
      }
      
      // Check left edge  
      if (this.x <= platform.x + 5 &&
          this.x >= platform.x - 10 &&
          this.y >= platform.y - this.height &&
          this.y <= platform.y + 10) {
        
        this.grabLedge(platform, 'left');
        return;
      }
    }
  }

  grabLedge(platform, side) {
    this.isGrabbingLedge = true;
    this.grabbedLedge = { platform, side };
    this.vy = 0;
    this.vx = 0;
    this.animationState = 'ledgeGrab';
    
    if (side === 'right') {
      this.x = platform.x + platform.width - this.width;
      this.facingRight = false;
    } else {
      this.x = platform.x;
      this.facingRight = true;
    }
    this.y = platform.y - this.height;
  }

  climbUpFromLedge() {
    if (!this.isGrabbingLedge) return;
    
    const platform = this.grabbedLedge.platform;
    this.y = platform.y - this.height;
    this.isGrabbingLedge = false;
    this.grabbedLedge = null;
    this.onGround = true;
  }

  performAttack() {
    this.isAttacking = true;
    this.attackCooldown = 20; // frames
    this.animationState = 'attack';
  }

  performSpecial() {
    this.isUsingSpecial = true;
    this.specialCooldown = 120; // frames (2 seconds at 60fps)
    this.animationState = 'special';
    
    // Different special moves per player
    if (this.playerNum === 1) {
      this.fireballSpecial();
    } else {
      this.dashSpecial();
    }
  }

  fireballSpecial() {
    // Simple projectile simulation
    // In a full implementation, this would create a projectile object
    console.log(`Player ${this.playerNum} uses Fireball!`);
  }

  dashSpecial() {
    // Dash attack
    this.vx = this.facingRight ? 15 : -15;
    console.log(`Player ${this.playerNum} uses Dash Attack!`);
  }

  updateCombat(otherPlayer) {
    if (this.isAttacking && !this.invulnerable) {
      // Check if we hit the other player
      if (this.isColliding(otherPlayer) && !otherPlayer.invulnerable) {
        this.hitPlayer(otherPlayer);
      }
    }
  }

  isColliding(other) {
    return this.x < other.x + other.width &&
           this.x + this.width > other.x &&
           this.y < other.y + other.height &&
           this.y + this.height > other.y;
  }

  hitPlayer(otherPlayer) {
    const baseDamage = 15;
    const knockbackBase = 8;
    
    // Apply damage
    otherPlayer.takeDamage(baseDamage);
    
    // Calculate knockback based on damage
    const knockbackMultiplier = 1 + (otherPlayer.damage / 100);
    const knockbackX = this.facingRight ? knockbackBase : -knockbackBase;
    const knockbackY = -5;
    
    otherPlayer.applyKnockback(knockbackX * knockbackMultiplier, knockbackY * knockbackMultiplier);
  }

  takeDamage(amount) {
    this.damage += amount;
    this.damage = Math.min(this.damage, this.maxDamage);
    this.isHurt = true;
    this.hurtTime = 20;
    this.invulnerable = true;
    this.invulnerableTime = 60;
    this.animationState = 'hurt';
  }

  applyKnockback(vx, vy) {
    this.vx = vx;
    this.vy = vy;
    this.onGround = false;
  }

  loseLife() {
    this.lives--;
    this.damage = 0;
    
    // Respawn
    if (this.playerNum === 1) {
      this.x = 200;
    } else {
      this.x = 1000;
    }
    this.y = 100;
    this.vx = 0;
    this.vy = 0;
    this.invulnerable = true;
    this.invulnerableTime = 120;
  }

  updateAnimation() {
    this.animationTimer++;
    if (this.animationTimer >= 10) { // Change frame every 10 game frames
      this.animationFrame = (this.animationFrame + 1) % 4;
      this.animationTimer = 0;
    }
  }

  updateTimers() {
    if (this.attackCooldown > 0) {
      this.attackCooldown--;
      if (this.attackCooldown === 0) {
        this.isAttacking = false;
      }
    }
    
    if (this.specialCooldown > 0) {
      this.specialCooldown--;
      if (this.specialCooldown === 0) {
        this.isUsingSpecial = false;
      }
    }
    
    if (this.hurtTime > 0) {
      this.hurtTime--;
      if (this.hurtTime === 0) {
        this.isHurt = false;
      }
    }
    
    if (this.invulnerableTime > 0) {
      this.invulnerableTime--;
      if (this.invulnerableTime === 0) {
        this.invulnerable = false;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    
    // Flashing effect when invulnerable
    if (this.invulnerable && Math.floor(this.invulnerableTime / 5) % 2) {
      ctx.globalAlpha = 0.5;
    }
    
    // Flip sprite if facing left
    if (!this.facingRight) {
      ctx.scale(-1, 1);
      ctx.translate(-this.x - this.width, 0);
    } else {
      ctx.translate(this.x, 0);
    }
    
    // Draw simple rectangular sprite with color coding
    ctx.fillStyle = this.color;
    ctx.fillRect(0, this.y, this.width, this.height);
    
    // Add simple animation effects based on state
    if (this.animationState === 'attack') {
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(this.facingRight ? this.width : -20, this.y + 20, 15, 10);
    }
    
    if (this.animationState === 'special') {
      ctx.fillStyle = '#44ff44';
      ctx.fillRect(-5, this.y - 5, this.width + 10, this.height + 10);
    }
    
    ctx.restore();
    
    // Draw player info
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(`P${this.playerNum}`, this.x, this.y - 5);
  }
}