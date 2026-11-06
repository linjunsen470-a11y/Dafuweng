/**
 * Original procedural soundtrack and sound-design system.
 * Everything is synthesized with Web Audio so the game stays offline-ready
 * and does not depend on licensed music or sound libraries.
 */

import { getAdaptiveMusicProfile, MUSIC_MOOD_PROFILES } from '../game/AdaptiveMusicRules.js';

export { MUSIC_MOOD_PROFILES };

export const THEME_LIBRARY = Object.freeze({
  'city-day': {
    title: '财富晴空', bpm: 108, lead: 'triangle', pad: 'sine',
    chords: [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]],
    bass: [36, 33, 41, 43],
    melody: [72, null, 76, 74, 72, 67, 69, 71, 72, 76, 79, 76, 74, 72, 71, 67]
  },
  'island-breeze': {
    title: '海岛假日', bpm: 100, lead: 'sine', pad: 'triangle',
    chords: [[62, 66, 69], [67, 71, 74], [69, 73, 76], [66, 69, 73]],
    bass: [38, 43, 45, 42],
    melody: [74, 76, 78, null, 81, 78, 76, 74, 69, 71, 74, 76, 78, 76, 74, 71]
  },
  'taiwan-folk': {
    title: '宝岛巡游', bpm: 112, lead: 'triangle', pad: 'sine',
    chords: [[64, 67, 71], [62, 66, 69], [57, 61, 64], [59, 62, 66]],
    bass: [40, 38, 33, 35],
    melody: [76, 79, 83, 79, 78, 76, 71, null, 69, 71, 74, 76, 74, 71, 69, 66]
  },
  'grand-bay': {
    title: '山海港湾', bpm: 96, lead: 'triangle', pad: 'sine',
    chords: [[57, 61, 64], [54, 57, 61], [62, 66, 69], [64, 68, 71]],
    bass: [33, 30, 38, 40],
    melody: [69, null, 73, 76, 73, 71, 69, 64, 66, 69, 71, 73, 76, 73, 71, 68]
  },
  'fortune-crossroads': {
    title: '福星岔路', bpm: 118, lead: 'square', pad: 'triangle',
    chords: [[59, 63, 66], [64, 68, 71], [56, 59, 63], [61, 64, 68]],
    bass: [35, 40, 32, 37],
    melody: [71, 75, 78, 75, 83, 78, 75, 71, 76, 80, 83, 80, 75, 76, 78, null]
  }
});

export const clampVolume = value => Math.max(0, Math.min(1, Number(value) || 0));
export const midiToFrequency = note => 440 * (2 ** ((Number(note) - 69) / 12));
export const getThemeConfig = themeId => THEME_LIBRARY[themeId] || THEME_LIBRARY['city-day'];

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try { this.muted = globalThis.localStorage?.getItem('fortune-empire:audio-muted') === '1'; } catch {}
    this.sfxVolume = 0.8;
    this.musicVolume = 0.22;
    this.sfxGain = null;
    this.musicGain = null;
    this.musicFilter = null;
    this.masterCompressor = null;
    this.musicTimer = null;
    this.currentTheme = null;
    this.musicBar = 0;
    this.activeMusicNodes = new Set();
    this.atmosphere = { weather: 'CLEAR', timeOfDay: 'DAY' };
    this.musicContext = {};
    this.musicMood = 'CALM';
    this.duckRestoreTimer = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.musicFilter = this.ctx.createBiquadFilter();
      this.masterCompressor = this.ctx.createDynamicsCompressor();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 6200;
      this.masterCompressor.threshold.value = -18;
      this.masterCompressor.knee.value = 12;
      this.masterCompressor.ratio.value = 4;
      this.masterCompressor.attack.value = 0.006;
      this.masterCompressor.release.value = 0.24;
      this.sfxGain.gain.value = this.muted ? 0 : this.sfxVolume;
      this.musicGain.gain.value = this.muted ? 0 : this.musicVolume;
      this.musicGain.connect(this.musicFilter);
      this.musicFilter.connect(this.masterCompressor);
      this.sfxGain.connect(this.masterCompressor);
      this.masterCompressor.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    try { globalThis.localStorage?.setItem('fortune-empire:audio-muted', this.muted ? '1' : '0'); } catch {}
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(this.muted ? 0 : this.sfxVolume, this.ctx.currentTime, 0.02);
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.muted ? 0 : this.musicVolume, this.ctx.currentTime, 0.04);
    return this.muted;
  }

  setSfxVolume(value) {
    this.sfxVolume = clampVolume(value);
    if (this.sfxGain && !this.muted) this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.025);
    return this.sfxVolume;
  }

  setMusicVolume(value) {
    this.musicVolume = clampVolume(value);
    if (this.musicGain && !this.muted) this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.04);
    return this.musicVolume;
  }

  setAtmosphere({ weather = this.atmosphere.weather, timeOfDay = this.atmosphere.timeOfDay } = {}) {
    this.atmosphere = { weather, timeOfDay };
    if (this.musicFilter && this.ctx) {
      const stormy = weather === 'RAIN' || weather === 'STORM';
      const cutoff = stormy ? 3100 : timeOfDay === 'NIGHT' ? 4300 : timeOfDay === 'SUNSET' ? 5200 : 6800;
      this.musicFilter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.18);
    }
    this.setMusicContext({ weather, timeOfDay });
    return { ...this.atmosphere };
  }

  setMusicContext(context = {}) {
    this.musicContext = {
      ...this.musicContext,
      ...context,
      eventType: Object.prototype.hasOwnProperty.call(context, 'eventType') ? context.eventType : null,
      ...this.atmosphere
    };
    const previous = this.musicMood;
    const profile = getAdaptiveMusicProfile(this.musicContext);
    this.musicMood = profile.mood;
    if (this.musicFilter && this.ctx) {
      const atmosphereCutoff = this.atmosphere.weather === 'STORM' ? 3300
        : this.atmosphere.weather === 'RAIN' ? 4000
          : this.atmosphere.timeOfDay === 'NIGHT' ? 4600 : profile.filter;
      this.musicFilter.frequency.setTargetAtTime(Math.min(profile.filter, atmosphereCutoff), this.ctx.currentTime, 0.28);
    }
    if (previous !== this.musicMood && this.ctx && !this.muted) this.playMoodTransition(previous, this.musicMood);
    return { ...profile };
  }

  duckMusic(duration = 0.7, amount = 0.42) {
    if (!this.ctx || !this.musicGain || this.muted) return false;
    if (this.duckRestoreTimer) globalThis.clearTimeout(this.duckRestoreTimer);
    this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicGain.gain.setTargetAtTime(this.musicVolume * Math.max(0.1, amount), this.ctx.currentTime, 0.025);
    this.duckRestoreTimer = globalThis.setTimeout(() => {
      this.duckRestoreTimer = null;
      if (this.ctx && this.musicGain && !this.muted) this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.16);
    }, Math.round(duration * 1000));
    return true;
  }

  playMoodTransition(previous, next) {
    if (!this.ctx || previous === next) return false;
    const now = this.ctx.currentTime;
    const upward = ['DRIVE', 'TENSION', 'FINALE'].includes(next);
    const notes = upward ? [392, 523.25, 659.25] : next === 'CRISIS' ? [220, 207.65, 164.81] : [523.25, 440];
    notes.forEach((frequency, index) => this.scheduleTone(frequency, now + index * 0.075, 0.28, {
      type: next === 'CRISIS' ? 'sawtooth' : 'triangle', volume: 0.045, attack: 0.018, release: 0.18
    }));
    this.duckMusic(0.5, 0.58);
    return true;
  }

  playMapTheme(themeId = 'city-day') {
    if (!this.init()) return false;
    if (this.currentTheme === themeId && this.musicTimer) return true;
    this.stopMusic();
    this.currentTheme = themeId;
    this.musicBar = 0;
    const theme = getThemeConfig(themeId);
    const barMilliseconds = Math.round((60000 / theme.bpm) * 4);
    const pulse = () => {
      if (!this.ctx || this.muted) return;
      this.scheduleMusicBar(theme, this.musicBar++);
    };
    pulse();
    this.musicTimer = globalThis.setInterval(pulse, barMilliseconds);
    return true;
  }

  scheduleMusicBar(theme, barIndex) {
    const profile = MUSIC_MOOD_PROFILES[this.musicMood] || MUSIC_MOOD_PROFILES.CALM;
    const beat = 60 / theme.bpm;
    const start = this.ctx.currentTime + 0.045;
    const chord = theme.chords[barIndex % theme.chords.length];
    chord.forEach((note, index) => this.scheduleTone(midiToFrequency(note), start, beat * 3.85, {
      destination: this.musicGain, type: theme.pad, volume: (index === 0 ? 0.038 : 0.025) * (0.72 + profile.intensity * 0.28),
      attack: 0.18, release: 0.5, detune: (index - 1) * 3, trackMusic: true
    }));
    this.scheduleTone(midiToFrequency(theme.bass[barIndex % theme.bass.length]), start, beat * 1.72, {
      destination: this.musicGain, type: 'triangle', volume: 0.055 * profile.bassDrive, attack: 0.035, release: 0.28, trackMusic: true
    });
    this.scheduleTone(midiToFrequency(theme.bass[barIndex % theme.bass.length] + 7), start + beat * 2, beat * 1.65, {
      destination: this.musicGain, type: 'sine', volume: 0.038, attack: 0.03, release: 0.25, trackMusic: true
    });

    for (let step = 0; step < 8; step++) {
      const note = theme.melody[(barIndex * 8 + step) % theme.melody.length];
      const playLead = step === 0 || ((step + barIndex) % 8) / 7 <= profile.leadDensity;
      if (playLead && note !== null && note !== undefined) this.scheduleTone(midiToFrequency(note), start + step * beat / 2, beat * 0.4, {
        destination: this.musicGain, type: theme.lead, volume: theme.lead === 'square' ? 0.018 : 0.032,
        attack: 0.018, release: 0.09, trackMusic: true
      });
      if (step % 2 === 0 && profile.percussion >= 0.45) this.scheduleNoise(start + step * beat / 2, 0.045, {
        destination: this.musicGain, volume: (step % 4 === 0 ? 0.014 : 0.009) * profile.percussion, highpass: 5200, trackMusic: true
      });
      if (step % 4 === 0 && profile.percussion >= 0.6) this.scheduleTone(step ? 92 : 78, start + step * beat / 2, 0.11, {
        destination: this.musicGain, type: 'sine', volume: 0.045 * profile.percussion, attack: 0.004, release: 0.08, trackMusic: true
      });
    }
    if (['TENSION', 'CRISIS', 'FINALE'].includes(this.musicMood)) {
      const root = theme.bass[barIndex % theme.bass.length] + (this.musicMood === 'CRISIS' ? 1 : 12);
      for (let step = 0; step < 4; step++) this.scheduleTone(midiToFrequency(root + (step % 2 ? 7 : 0)), start + step * beat, beat * 0.28, {
        destination: this.musicGain, type: this.musicMood === 'CRISIS' ? 'sawtooth' : 'triangle', volume: this.musicMood === 'CRISIS' ? 0.014 : 0.025, attack: 0.008, release: 0.08, trackMusic: true
      });
    }
    if (this.atmosphere.weather === 'RAIN' || this.atmosphere.weather === 'STORM') {
      this.scheduleNoise(start, beat * 3.9, {
        destination: this.musicGain, volume: this.atmosphere.weather === 'STORM' ? 0.012 : 0.007,
        highpass: 900, lowpass: 4200, trackMusic: true
      });
    }
    if (this.atmosphere.weather === 'SNOW') {
      [0.5, 1.5, 2.75].forEach((offset, index) => this.scheduleTone(midiToFrequency(chord[index % chord.length] + 24), start + beat * offset, beat * 0.55, {
        destination: this.musicGain, type: 'sine', volume: 0.012, attack: 0.06, release: 0.36, trackMusic: true
      }));
    }
    if (this.atmosphere.timeOfDay === 'NIGHT') this.scheduleTone(midiToFrequency(chord[0] - 12), start, beat * 3.9, {
      destination: this.musicGain, type: 'sine', volume: 0.018, attack: 0.4, release: 0.7, trackMusic: true
    });
  }

  stopMusic() {
    if (this.musicTimer) globalThis.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.activeMusicNodes.forEach(node => {
      try { node.stop(); } catch {}
      try { node.disconnect(); } catch {}
    });
    this.activeMusicNodes.clear();
    this.currentTheme = null;
    this.musicBar = 0;
    if (this.duckRestoreTimer) globalThis.clearTimeout(this.duckRestoreTimer);
    this.duckRestoreTimer = null;
  }

  scheduleTone(frequency, start, duration, options = {}) {
    if (!this.ctx) return null;
    const destination = options.destination || this.sfxGain;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = options.type || 'sine';
    oscillator.frequency.setValueAtTime(Math.max(24, frequency), start);
    oscillator.detune.value = options.detune || 0;
    const volume = Math.max(0.001, options.volume || 0.08);
    const attack = Math.min(duration * 0.45, options.attack ?? 0.008);
    const release = Math.min(duration * 0.7, options.release ?? 0.08);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.max(0.004, attack));
    gain.gain.setValueAtTime(volume, Math.max(start + attack, start + duration - release));
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    if (options.trackMusic) this.activeMusicNodes.add(oscillator);
    oscillator.onended = () => {
      this.activeMusicNodes.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    return oscillator;
  }

  scheduleNoise(start, duration, options = {}) {
    if (!this.ctx) return null;
    const size = Math.max(1, Math.ceil(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < size; index++) data[index] = (Math.random() * 2 - 1) * (1 - index / size * 0.16);
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    let tail = source;
    source.buffer = buffer;
    if (options.highpass) {
      const highpass = this.ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = options.highpass;
      tail.connect(highpass);
      tail = highpass;
    }
    if (options.lowpass) {
      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = options.lowpass;
      tail.connect(lowpass);
      tail = lowpass;
    }
    tail.connect(gain);
    gain.connect(options.destination || this.sfxGain);
    gain.gain.setValueAtTime(Math.max(0.001, options.volume || 0.04), start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    if (options.trackMusic) this.activeMusicNodes.add(source);
    source.onended = () => {
      this.activeMusicNodes.delete(source);
      try { source.disconnect(); gain.disconnect(); } catch {}
    };
    source.start(start);
    source.stop(start + duration + 0.01);
    return source;
  }

  playSFX(name) {
    const effects = {
      click: () => this.playClick(), coin: () => this.playCoinSound(), dice: () => this.playDiceRoll(),
      build: () => this.playBuildSound(), card: () => this.playCardSpell(), bankrupt: () => this.playBankruptSound(),
      victory: () => this.playVictory(), confirm: () => this.playConfirm(), danger: () => this.playDanger(), turn: () => this.playTurn()
    };
    if (['danger', 'bankrupt', 'victory', 'card', 'build'].includes(name)) this.duckMusic(name === 'victory' ? 1.4 : 0.72, name === 'danger' || name === 'bankrupt' ? 0.3 : 0.46);
    return (effects[name] || effects.click)();
  }

  playClick() {
    if (this.muted || !this.init()) return false;
    const now = this.ctx.currentTime;
    this.scheduleTone(720, now, 0.055, { type: 'sine', volume: 0.09, release: 0.035 });
    this.scheduleTone(420, now + 0.018, 0.045, { type: 'triangle', volume: 0.045, release: 0.025 });
    return true;
  }

  playConfirm() {
    if (this.muted || !this.init()) return false;
    const now = this.ctx.currentTime;
    [659.25, 830.61, 987.77].forEach((frequency, index) => this.scheduleTone(frequency, now + index * 0.055, 0.16, { type: 'sine', volume: 0.09, release: 0.1 }));
    return true;
  }

  playDanger() {
    if (this.muted || !this.init()) return false;
    const now = this.ctx.currentTime;
    [196, 164.81].forEach((frequency, index) => this.scheduleTone(frequency, now + index * 0.15, 0.22, { type: 'sawtooth', volume: 0.075, attack: 0.012, release: 0.12 }));
    return true;
  }

  playTurn() {
    if (this.muted || !this.init()) return false;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((frequency, index) => this.scheduleTone(frequency, now + index * 0.07, 0.24, { type: 'triangle', volume: 0.07, release: 0.16 }));
    return true;
  }

  playDiceRoll() {
    if (this.muted || !this.init()) return false;
    const now = this.ctx.currentTime;
    [0, 0.07, 0.15, 0.24].forEach((offset, index) => {
      this.scheduleNoise(now + offset, 0.075, { volume: 0.085 - index * 0.012, highpass: 480, lowpass: 2400 });
      this.scheduleTone(150 - index * 12, now + offset + 0.025, 0.07, { type: 'triangle', volume: 0.045, release: 0.04 });
    });
    return true;
  }

  playCoinSound() {
    if (this.muted || !this.init()) return false;
    const now = this.ctx.currentTime;
    [987.77, 1318.51, 1567.98].forEach((frequency, index) => this.scheduleTone(frequency, now + index * 0.065, 0.24, { type: 'sine', volume: 0.11 - index * 0.018, release: 0.17 }));
    return true;
  }

  playBuildSound() {
    if (this.muted || !this.init()) return false;
    const now = this.ctx.currentTime;
    this.scheduleNoise(now, 0.16, { volume: 0.06, highpass: 180, lowpass: 900 });
    [261.63, 329.63, 392, 523.25].forEach((frequency, index) => this.scheduleTone(frequency, now + 0.07 + index * 0.07, 0.25, { type: 'triangle', volume: 0.095, release: 0.16 }));
    return true;
  }

  playCardSpell() {
    if (this.muted || !this.init()) return false;
    const now = this.ctx.currentTime;
    [440, 554.37, 659.25, 880, 1108.73].forEach((frequency, index) => this.scheduleTone(frequency, now + index * 0.045, 0.3, { type: index % 2 ? 'triangle' : 'sine', volume: 0.07, release: 0.21, detune: index * 2 }));
    return true;
  }

  playBankruptSound() {
    if (this.muted || !this.init()) return false;
    const now = this.ctx.currentTime;
    [293.66, 261.63, 220, 146.83].forEach((frequency, index) => this.scheduleTone(frequency, now + index * 0.14, 0.42, { type: index === 3 ? 'sawtooth' : 'triangle', volume: 0.09, release: 0.28 }));
    return true;
  }

  playVictory() {
    if (this.muted || !this.init()) return false;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((frequency, index) => this.scheduleTone(frequency, now + index * 0.11, index === 4 ? 0.8 : 0.36, { type: 'triangle', volume: 0.12, release: index === 4 ? 0.58 : 0.22 }));
    [523.25, 659.25, 783.99].forEach(frequency => this.scheduleTone(frequency, now + 0.44, 0.9, { type: 'sine', volume: 0.055, attack: 0.08, release: 0.62 }));
    return true;
  }
}

export const audioManager = new AudioManager();
