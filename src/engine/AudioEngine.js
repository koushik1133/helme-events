export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.currentSound = null;
    this.masterGain = null;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound(zoneId = 'zone-stage') {
    this.initContext();
    if (!this.ctx) return false;

    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.playZoneSound(zoneId);
      return true;
    }
  }

  playZoneSound(zoneId) {
    if (!this.ctx) return;
    this.stopImmediate();

    this.isPlaying = true;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0.001, now);
    this.masterGain.gain.linearRampToValueAtTime(0.25, now + 0.3); // Smooth linear fade-in

    if (zoneId.includes('election')) {
      this.currentSound = this.createRallySoundscape(now);
    } else if (zoneId.includes('function')) {
      this.currentSound = this.createWeddingSoundscape(now);
    } else if (zoneId.includes('meeting')) {
      this.currentSound = this.createSummitSoundscape(now);
    } else if (zoneId.includes('fountain')) {
      this.currentSound = this.createFountainSoundscape(now);
    } else {
      this.currentSound = this.createAmbientChords(now);
    }
  }

  createSummitSoundscape(now) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(196.0, now);
    osc2.frequency.setValueAtTime(293.66, now);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.1, now);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);

    return {
      stop: () => {
        try { osc1.stop(); } catch (e) {}
        try { osc2.stop(); } catch (e) {}
      }
    };
  }

  createRallySoundscape(now) {
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.Q.setValueAtTime(3.0, now);

    whiteNoise.connect(filter);
    filter.connect(this.masterGain);
    whiteNoise.start(now);

    return { stop: () => whiteNoise.stop() };
  }

  createWeddingSoundscape(now) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(293.66, now);
    osc2.frequency.setValueAtTime(440.00, now);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.15, now);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);

    return {
      stop: () => {
        osc1.stop();
        osc2.stop();
      }
    };
  }

  createFountainSoundscape(now) {
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);

    noise.connect(filter);
    filter.connect(this.masterGain);
    noise.start(now);

    return { stop: () => noise.stop() };
  }

  createAmbientChords(now) {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(329.63, now);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.12, now);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain);
    osc.start(now);

    return { stop: () => osc.stop() };
  }

  // 🔊 Calibrated Smooth Gain Ramp Fade-Out (Zero Glitch Clicks)
  stop() {
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.001, now + 0.25);

      setTimeout(() => this.stopImmediate(), 260);
    } else {
      this.stopImmediate();
    }
  }

  stopImmediate() {
    if (this.currentSound && typeof this.currentSound.stop === 'function') {
      try {
        this.currentSound.stop();
      } catch (e) {}
    }
    this.currentSound = null;
    this.isPlaying = false;
  }
}
