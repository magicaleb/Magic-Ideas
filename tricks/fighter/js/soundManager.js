// Sound Manager for fighting game
class SoundManager {
  constructor() {
    this.audioContext = null;
    this.sounds = {};
    this.musicPlaying = false;
    this.musicGainNode = null;
    
    this.initAudioContext();
    this.generateSounds();
  }

  initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.log('Web Audio API not supported');
    }
  }

  // Generate chiptune-style sounds procedurally
  generateSounds() {
    if (!this.audioContext) return;

    // Generate different sound effects
    this.sounds = {
      jump: this.createJumpSound(),
      attack: this.createAttackSound(),
      hit: this.createHitSound(),
      special: this.createSpecialSound(),
      ko: this.createKOSound(),
      victory: this.createVictorySound()
    };
  }

  createJumpSound() {
    return () => {
      if (!this.audioContext) return;
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(660, this.audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.2);
    };
  }

  createAttackSound() {
    return () => {
      if (!this.audioContext) return;
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.15);
    };
  }

  createHitSound() {
    return () => {
      if (!this.audioContext) return;
      
      // Create noise burst for hit effect
      const bufferSize = this.audioContext.sampleRate * 0.1;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
      }
      
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();
      
      source.buffer = buffer;
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      filter.type = 'lowpass';
      filter.frequency.value = 1000;
      
      gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
      
      source.start();
    };
  }

  createSpecialSound() {
    return () => {
      if (!this.audioContext) return;
      
      const oscillator1 = this.audioContext.createOscillator();
      const oscillator2 = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator1.type = 'triangle';
      oscillator2.type = 'square';
      
      oscillator1.frequency.setValueAtTime(330, this.audioContext.currentTime);
      oscillator2.frequency.setValueAtTime(440, this.audioContext.currentTime);
      
      oscillator1.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.3);
      oscillator2.frequency.exponentialRampToValueAtTime(1100, this.audioContext.currentTime + 0.3);
      
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);
      
      oscillator1.start();
      oscillator2.start();
      oscillator1.stop(this.audioContext.currentTime + 0.4);
      oscillator2.stop(this.audioContext.currentTime + 0.4);
    };
  }

  createKOSound() {
    return () => {
      if (!this.audioContext) return;
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(110, this.audioContext.currentTime + 0.8);
      
      gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.8);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.8);
    };
  }

  createVictorySound() {
    return () => {
      if (!this.audioContext) return;
      
      const notes = [523, 659, 784, 1047]; // C, E, G, C octave
      let time = this.audioContext.currentTime;
      
      notes.forEach((freq, index) => {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'triangle';
        oscillator.frequency.value = freq;
        
        gainNode.gain.setValueAtTime(0.3, time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
        
        oscillator.start(time);
        oscillator.stop(time + 0.3);
        
        time += 0.2;
      });
    };
  }

  playSound(soundName) {
    if (this.sounds[soundName]) {
      try {
        this.sounds[soundName]();
      } catch (e) {
        console.log('Could not play sound:', soundName);
      }
    }
  }

  startBackgroundMusic() {
    if (!this.audioContext || this.musicPlaying) return;
    
    this.musicPlaying = true;
    this.playChiptuneLoop();
  }

  stopBackgroundMusic() {
    this.musicPlaying = false;
    if (this.musicGainNode) {
      this.musicGainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
    }
  }

  playChiptuneLoop() {
    if (!this.audioContext || !this.musicPlaying) return;
    
    // Simple chiptune melody loop
    const melody = [
      { freq: 440, duration: 0.25 }, // A
      { freq: 523, duration: 0.25 }, // C
      { freq: 659, duration: 0.25 }, // E
      { freq: 784, duration: 0.25 }, // G
      { freq: 659, duration: 0.25 }, // E
      { freq: 523, duration: 0.25 }, // C
      { freq: 440, duration: 0.5 },  // A
      { freq: 0, duration: 0.25 }    // Rest
    ];
    
    let time = this.audioContext.currentTime;
    
    melody.forEach(note => {
      if (note.freq > 0) {
        const oscillator = this.audioContext.createOscillator();
        this.musicGainNode = this.audioContext.createGain();
        
        oscillator.connect(this.musicGainNode);
        this.musicGainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'square';
        oscillator.frequency.value = note.freq;
        
        this.musicGainNode.gain.setValueAtTime(0.1, time);
        this.musicGainNode.gain.setValueAtTime(0.1, time + note.duration * 0.8);
        this.musicGainNode.gain.exponentialRampToValueAtTime(0.01, time + note.duration);
        
        oscillator.start(time);
        oscillator.stop(time + note.duration);
      }
      
      time += note.duration;
    });
    
    // Schedule next loop
    if (this.musicPlaying) {
      setTimeout(() => this.playChiptuneLoop(), time * 1000 - this.audioContext.currentTime * 1000);
    }
  }

  // Resume AudioContext on user interaction (required by browsers)
  resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}