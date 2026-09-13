/**
 * Zone soundscapes — pure Web Audio synthesis, no audio files.
 *
 * Every bed is built from layered detuned oscillators, LFO movement, filtered
 * noise and a generated convolution reverb, so each zone has its own character:
 * a mandap does not sound like a corporate summit.
 */

const FADE_IN = 0.6;
const FADE_OUT = 0.35;
const TARGET_GAIN = 0.22;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.currentSound = null;
    this.masterGain = null;
    this.reverb = null;
    this.reverbGain = null;
    this.stopTimer = null;
    // Incremented on every start/stop so a pending fade-out timer can never
    // silence a soundscape that started after it was scheduled.
    this.generation = 0;
    this.noiseBuffer = null;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Shared plate-style reverb, fed from a send bus.
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this.createImpulseResponse(2.6, 2.2);
      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.value = 0.35;
      this.reverbGain.connect(this.reverb);
      this.reverb.connect(this.masterGain);
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  /* ------------------------------------------------------------ primitives */

  /** Exponentially decaying stereo noise burst — a serviceable room impulse. */
  createImpulseResponse(seconds = 2.5, decay = 2.0) {
    const rate = this.ctx.sampleRate;
    const length = Math.max(1, Math.floor(rate * seconds));
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return impulse;
  }

  /** Looping white-noise buffer, generated once and reused. */
  getNoiseBuffer() {
    if (!this.noiseBuffer) {
      const length = this.ctx.sampleRate * 4;
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < length; i++) {
        // Lightly smoothed noise — less hissy than raw white noise.
        const white = Math.random() * 2 - 1;
        last = (last + 0.04 * white) / 1.04;
        data[i] = last * 3.2;
      }
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  /** A low-frequency oscillator modulating an AudioParam. */
  makeLFO(rateHz, depth, param, baseValue, now, type = 'sine') {
    const lfo = this.ctx.createOscillator();
    lfo.type = type;
    lfo.frequency.setValueAtTime(rateHz, now);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(depth, now);
    lfo.connect(amp);
    param.setValueAtTime(baseValue, now);
    amp.connect(param);
    lfo.start(now);
    return lfo;
  }

  /**
   * A sustained voice: two detuned oscillators through a lowpass, with a slow
   * filter sweep. This is what turns a "dial tone" into something that breathes.
   */
  makeVoice(freq, now, {
    type = 'sawtooth', detune = 6, gain = 0.06, cutoff = 900,
    sweepRate = 0.07, sweepDepth = 320, q = 1.2, reverbSend = 0.4, attack = FADE_IN
  } = {}) {
    const nodes = [];
    const oscillators = [];
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.linearRampToValueAtTime(gain, now + attack);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(q, now);
    nodes.push(this.makeLFO(sweepRate, sweepDepth, filter.frequency, cutoff, now));

    for (const cents of [-detune, detune]) {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime(cents, now);
      osc.connect(filter);
      osc.start(now);
      nodes.push(osc);
      oscillators.push(osc);
    }

    filter.connect(out);
    out.connect(this.masterGain);
    if (reverbSend > 0) {
      const send = this.ctx.createGain();
      send.gain.setValueAtTime(reverbSend, now);
      out.connect(send);
      send.connect(this.reverbGain);
    }
    return { nodes, out, oscillators };
  }

  /** A filtered, slowly swelling noise bed. */
  makeNoiseBed(now, {
    filterType = 'lowpass', cutoff = 800, q = 0.8, gain = 0.05,
    swellRate = 0.08, swellDepth = 0.025, sweepRate = 0, sweepDepth = 0, reverbSend = 0.3
  } = {}) {
    const nodes = [];
    const src = this.ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer();
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.setValueAtTime(q, now);
    if (sweepRate > 0) {
      nodes.push(this.makeLFO(sweepRate, sweepDepth, filter.frequency, cutoff, now));
    } else {
      filter.frequency.setValueAtTime(cutoff, now);
    }

    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.linearRampToValueAtTime(gain, now + FADE_IN);
    if (swellDepth > 0) {
      nodes.push(this.makeLFO(swellRate, swellDepth, out.gain, gain, now + FADE_IN));
    }

    src.connect(filter);
    filter.connect(out);
    out.connect(this.masterGain);
    if (reverbSend > 0) {
      const send = this.ctx.createGain();
      send.gain.setValueAtTime(reverbSend, now);
      out.connect(send);
      send.connect(this.reverbGain);
    }
    src.start(now);
    nodes.push(src);
    return { nodes, out };
  }

  /** One short struck/plucked event — bells, droplets, dhol thumps, stings. */
  strike(at, {
    freq = 880, type = 'sine', gain = 0.08, decay = 1.4,
    cutoff = 0, pitchDropTo = 0, reverbSend = 0.6
  } = {}) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (pitchDropTo) osc.frequency.exponentialRampToValueAtTime(pitchDropTo, at + decay * 0.6);

    let node = osc;
    if (cutoff) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, at);
      osc.connect(filter);
      node = filter;
    }

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, at + decay);

    node.connect(env);
    env.connect(this.masterGain);
    if (reverbSend > 0) {
      const send = this.ctx.createGain();
      send.gain.setValueAtTime(reverbSend, at);
      env.connect(send);
      send.connect(this.reverbGain);
    }
    osc.start(at);
    osc.stop(at + decay + 0.1);
  }

  /**
   * Repeating scheduler with a lookahead window. Returns a handle whose
   * `clear()` is called by the soundscape's stop().
   */
  everyBeat(intervalSec, callback) {
    let nextTime = this.ctx.currentTime + 0.2;
    const tick = () => {
      const horizon = this.ctx.currentTime + 0.6;
      while (nextTime < horizon) {
        callback(nextTime);
        nextTime += intervalSec;
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return { clear: () => clearInterval(id) };
  }

  /** Bundle a set of layers into the common `{ stop }` contract. */
  bundle(layers, schedulers = []) {
    return {
      stop: () => {
        for (const s of schedulers) {
          try { s.clear(); } catch { /* already cleared */ }
        }
        for (const layer of layers) {
          for (const node of layer.nodes) {
            try { node.stop(); } catch { /* buffer sources / oscillators only */ }
            try { node.disconnect(); } catch { /* already detached */ }
          }
          try { layer.out.disconnect(); } catch { /* already detached */ }
        }
      }
    };
  }

  /* ----------------------------------------------------------- soundscapes */

  /**
   * Mandap / wedding function: a tanpura-style Sa–Pa drone, a reedy shehnai
   * voice with vibrato above it, and sparse ghungroo shimmer.
   */
  createWeddingSoundscape(now) {
    const layers = [];
    // Drone in C: Sa (130.81) and Pa (196.00), plus the octave.
    layers.push(this.makeVoice(130.81, now, { type: 'sawtooth', detune: 5, gain: 0.055, cutoff: 520, sweepRate: 0.05, sweepDepth: 160 }));
    layers.push(this.makeVoice(196.00, now, { type: 'triangle', detune: 8, gain: 0.040, cutoff: 760, sweepRate: 0.038, sweepDepth: 220 }));
    layers.push(this.makeVoice(261.63, now, { type: 'sine', detune: 3, gain: 0.030, cutoff: 1400, sweepRate: 0.06, sweepDepth: 300 }));

    // Reedy lead with a slow vibrato — the shehnai colour.
    const lead = this.makeVoice(392.00, now, {
      type: 'sawtooth', detune: 10, gain: 0.028, cutoff: 1600,
      sweepRate: 0.09, sweepDepth: 700, q: 3.5, reverbSend: 0.65, attack: 2.5
    });
    // Vibrate the lead oscillators themselves — iterate a snapshot, since the
    // LFOs we create are pushed onto the same nodes array.
    for (const osc of lead.oscillators.slice()) {
      lead.nodes.push(this.makeLFO(5.2, 9, osc.detune, osc.detune.value, now));
    }
    layers.push(lead);

    // Ghungroo shimmer every ~4.5s, lightly randomised.
    const shimmer = this.everyBeat(4.5, at => {
      const notes = [1046.5, 1174.7, 1318.5, 1568.0];
      const f = notes[Math.floor(Math.random() * notes.length)];
      this.strike(at, { freq: f, type: 'triangle', gain: 0.035, decay: 2.4, reverbSend: 0.8 });
    });

    return this.bundle(layers, [shimmer]);
  }

  /**
   * Political rally: distant crowd swell, a low PA system hum, and a dhol
   * pulse driving the ground underneath it.
   */
  createRallySoundscape(now) {
    const layers = [];
    // Crowd: mid-band noise with a slow, uneven swell.
    layers.push(this.makeNoiseBed(now, {
      filterType: 'bandpass', cutoff: 620, q: 0.9, gain: 0.075,
      swellRate: 0.11, swellDepth: 0.045, sweepRate: 0.07, sweepDepth: 260, reverbSend: 0.5
    }));
    // Distant air / open ground.
    layers.push(this.makeNoiseBed(now, {
      filterType: 'lowpass', cutoff: 240, q: 0.5, gain: 0.05, swellRate: 0.05, swellDepth: 0.02, reverbSend: 0.2
    }));
    // PA hum — a slightly dirty low drone, as any outdoor rig has.
    layers.push(this.makeVoice(55, now, { type: 'sawtooth', detune: 4, gain: 0.05, cutoff: 180, sweepRate: 0.03, sweepDepth: 60, reverbSend: 0.1 }));

    // Dhol pulse at roughly 132 BPM, accent on the down-beat.
    let beat = 0;
    const dhol = this.everyBeat(60 / 132, at => {
      const accent = beat % 4 === 0;
      this.strike(at, {
        freq: accent ? 92 : 74, type: 'sine', gain: accent ? 0.10 : 0.05,
        decay: accent ? 0.42 : 0.26, pitchDropTo: accent ? 48 : 44, reverbSend: 0.35
      });
      if (beat % 4 === 2) {
        this.strike(at, { freq: 1500, type: 'square', gain: 0.012, decay: 0.09, cutoff: 2600, reverbSend: 0.25 });
      }
      beat++;
    });

    return this.bundle(layers, [dhol]);
  }

  /**
   * Corporate summit: conditioned air, a clean warm pad in fifths, and an
   * occasional high ping. Deliberately restrained — it should not draw focus.
   */
  createSummitSoundscape(now) {
    const layers = [];
    layers.push(this.makeNoiseBed(now, {
      filterType: 'lowpass', cutoff: 380, q: 0.4, gain: 0.042,
      swellRate: 0.04, swellDepth: 0.012, reverbSend: 0.2
    }));
    layers.push(this.makeVoice(98.00, now, { type: 'triangle', detune: 4, gain: 0.05, cutoff: 480, sweepRate: 0.035, sweepDepth: 120, reverbSend: 0.3 }));
    layers.push(this.makeVoice(146.83, now, { type: 'sine', detune: 6, gain: 0.045, cutoff: 900, sweepRate: 0.045, sweepDepth: 260, reverbSend: 0.35 }));
    layers.push(this.makeVoice(293.66, now, { type: 'sine', detune: 3, gain: 0.022, cutoff: 1800, sweepRate: 0.055, sweepDepth: 400, reverbSend: 0.5, attack: 3 }));

    const ping = this.everyBeat(11, at => {
      this.strike(at, { freq: 1567.98, type: 'sine', gain: 0.022, decay: 3.0, reverbSend: 0.9 });
    });

    return this.bundle(layers, [ping]);
  }

  /** Fountain plaza: moving water, a soft evening pad, and droplet accents. */
  createFountainSoundscape(now) {
    const layers = [];
    // Main body of water — a broad band that slides gently.
    layers.push(this.makeNoiseBed(now, {
      filterType: 'bandpass', cutoff: 1500, q: 0.7, gain: 0.075,
      swellRate: 0.17, swellDepth: 0.03, sweepRate: 0.13, sweepDepth: 900, reverbSend: 0.45
    }));
    // Splash top-end.
    layers.push(this.makeNoiseBed(now, {
      filterType: 'highpass', cutoff: 3200, q: 0.6, gain: 0.028,
      swellRate: 0.29, swellDepth: 0.016, reverbSend: 0.6
    }));
    // Warm evening pad underneath.
    layers.push(this.makeVoice(110.00, now, { type: 'triangle', detune: 5, gain: 0.038, cutoff: 420, sweepRate: 0.04, sweepDepth: 130, reverbSend: 0.3 }));
    layers.push(this.makeVoice(164.81, now, { type: 'sine', detune: 4, gain: 0.030, cutoff: 1000, sweepRate: 0.05, sweepDepth: 260, reverbSend: 0.4 }));

    // Irregular droplets.
    const drops = this.everyBeat(1.6, at => {
      if (Math.random() > 0.55) return;
      this.strike(at + Math.random() * 0.4, {
        freq: 900 + Math.random() * 1400, type: 'sine',
        gain: 0.016, decay: 0.5, pitchDropTo: 380, reverbSend: 0.85
      });
    });

    return this.bundle(layers, [drops]);
  }

  /** Default house ambience: a slow, wide pad that drifts between two chords. */
  createAmbientChords(now) {
    const layers = [];
    // Em9-ish stack, voiced wide.
    const chord = [82.41, 123.47, 164.81, 246.94, 329.63];
    chord.forEach((freq, i) => {
      layers.push(this.makeVoice(freq, now, {
        type: i < 2 ? 'sawtooth' : 'sine',
        detune: 4 + i * 2,
        gain: 0.045 - i * 0.006,
        cutoff: 420 + i * 320,
        sweepRate: 0.03 + i * 0.012,
        sweepDepth: 150 + i * 90,
        reverbSend: 0.35 + i * 0.06,
        attack: 1.2 + i * 0.5
      }));
    });

    // A distant bell marks time without becoming a rhythm.
    const bell = this.everyBeat(13, at => {
      this.strike(at, { freq: 659.25, type: 'sine', gain: 0.026, decay: 4.0, reverbSend: 0.95 });
    });

    return this.bundle(layers, [bell]);
  }

  /* --------------------------------------------------------------- control */

  toggleSound(zoneId = 'zone-stage') {
    this.initContext();
    if (!this.ctx) return false;

    if (this.isPlaying) {
      this.stop();
      return false;
    }
    this.playZoneSound(zoneId);
    return true;
  }

  playZoneSound(zoneId) {
    this.initContext();
    if (!this.ctx) return;

    // Cancel any in-flight fade-out so a fast off→on cannot be killed by a
    // stale timer, and tear down the previous bed immediately.
    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.generation++;
    this.teardownCurrent();

    this.isPlaying = true;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(Math.max(this.masterGain.gain.value, 0.0001), now);
    this.masterGain.gain.linearRampToValueAtTime(TARGET_GAIN, now + FADE_IN);

    const id = String(zoneId || '');
    if (id.includes('election') || id.includes('rally')) {
      this.currentSound = this.createRallySoundscape(now);
    } else if (id.includes('function') || id.includes('mandap') || id.includes('wedding')) {
      this.currentSound = this.createWeddingSoundscape(now);
    } else if (id.includes('meeting') || id.includes('summit') || id.includes('conference')) {
      this.currentSound = this.createSummitSoundscape(now);
    } else if (id.includes('fountain')) {
      this.currentSound = this.createFountainSoundscape(now);
    } else {
      this.currentSound = this.createAmbientChords(now);
    }
  }

  /** Fade out, then tear down — but flip `isPlaying` synchronously. */
  stop() {
    // Synchronous: the UI and any immediate re-trigger must see the truth now.
    this.isPlaying = false;
    const generation = ++this.generation;

    if (!this.masterGain || !this.ctx) {
      this.teardownCurrent();
      return;
    }

    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(Math.max(this.masterGain.gain.value, 0.0001), now);
    this.masterGain.gain.linearRampToValueAtTime(0.0001, now + FADE_OUT);

    if (this.stopTimer !== null) clearTimeout(this.stopTimer);
    this.stopTimer = setTimeout(() => {
      this.stopTimer = null;
      // A newer generation means something started during the fade — leave it be.
      if (generation !== this.generation) return;
      this.teardownCurrent();
    }, FADE_OUT * 1000 + 60);
  }

  /** Immediate, unconditional teardown of the current soundscape. */
  teardownCurrent() {
    if (this.currentSound && typeof this.currentSound.stop === 'function') {
      try { this.currentSound.stop(); } catch { /* nodes already gone */ }
    }
    this.currentSound = null;
  }

  /** Backwards-compatible alias. */
  stopImmediate() {
    this.isPlaying = false;
    this.generation++;
    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(0.0001, now);
    }
    this.teardownCurrent();
  }
}
