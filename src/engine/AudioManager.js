/**
 * Web Audio API Sound Synthesizer & Audio Manager
 * Direct procedural synthesis for zero-lag high quality audio effects
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.sfxVolume = 0.8;
    this.musicVolume = 0.22;
    this.sfxGain = null;
    this.musicGain = null;
    this.musicTimer = null;
    this.currentTheme = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.musicGain.gain.value = this.musicVolume;
      this.sfxGain.connect(this.ctx.destination);
      this.musicGain.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.sfxGain) this.sfxGain.gain.value = this.muted ? 0 : this.sfxVolume;
    if (this.musicGain) this.musicGain.gain.value = this.muted ? 0 : this.musicVolume;
    return this.muted;
  }

  setSfxVolume(value) {
    this.sfxVolume = Math.max(0, Math.min(1, Number(value)));
    if (this.sfxGain && !this.muted) this.sfxGain.gain.value = this.sfxVolume;
  }

  setMusicVolume(value) {
    this.musicVolume = Math.max(0, Math.min(1, Number(value)));
    if (this.musicGain && !this.muted) this.musicGain.gain.value = this.musicVolume;
  }

  playMapTheme(themeId = 'city-day') {
    this.init();
    if (this.currentTheme === themeId && this.musicTimer) return;
    this.stopMusic();
    this.currentTheme = themeId;
    const themes = {
      'city-day': [261.63, 329.63, 392, 523.25],
      'island-breeze': [293.66, 392, 440, 587.33],
      'taiwan-folk': [329.63, 392, 493.88, 659.25],
      'grand-bay': [220, 277.18, 329.63, 440],
      'fortune-crossroads': [246.94, 311.13, 369.99, 493.88]
    };
    const notes = themes[themeId] || themes['city-day'];
    let cursor = 0;
    const pulse = () => {
      if (this.muted || !this.ctx) return;
      const now = this.ctx.currentTime;
      [0, 1].forEach(offset => {
        const oscillator = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        oscillator.type = offset ? 'sine' : 'triangle';
        oscillator.frequency.value = notes[(cursor + offset * 2) % notes.length] / (offset ? 2 : 1);
        gain.gain.setValueAtTime(offset ? 0.06 : 0.045, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.7);
        oscillator.connect(gain);
        gain.connect(this.musicGain);
        oscillator.start(now);
        oscillator.stop(now + 1.8);
      });
      cursor = (cursor + 1) % notes.length;
    };
    pulse();
    this.musicTimer = window.setInterval(pulse, 1800);
  }

  stopMusic() {
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.currentTheme = null;
  }

  playClick() {
    if (this.muted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playDiceRoll() {
    if (this.muted) return;
    this.init();
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start();
  }

  playCoinSound() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(987.77, now); // B5
    osc1.frequency.setValueAtTime(1318.51, now + 0.08); // E6

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.3);

    osc1.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc1.stop(now + 0.3);
  }

  playBuildSound() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const freqs = [261.63, 329.63, 392.00, 523.25]; // C E G C
    freqs.forEach((f, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + index * 0.06);

      gain.gain.setValueAtTime(0.2, now + index * 0.06);
      gain.gain.linearRampToValueAtTime(0.01, now + index * 0.06 + 0.15);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now + index * 0.06);
      osc.stop(now + index * 0.06 + 0.15);
    });
  }

  playCardSpell() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.25);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  playBankruptSound() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.5);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  playVictory() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.12);
      gain.gain.setValueAtTime(0.25, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.01, now + i * 0.12 + 0.3);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.3);
    });
  }
}

export const audioManager = new AudioManager();
