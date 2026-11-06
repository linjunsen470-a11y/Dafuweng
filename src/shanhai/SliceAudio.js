/** Gesture-gated, dependency-free audio for the original chapter scores. */
const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
const EFFECTS = ['dice', 'step', 'purchase', 'upgrade', 'rent', 'event', 'event-success', 'event-fail', 'turn', 'win', 'ability', 'auction-sold', 'bankruptcy'];

export class SliceAudio {
  constructor({ musicVolume = 0.28, sfxVolume = 0.65, musicEnabled = true, sfxEnabled = true, musicTrack = 'saltwind-promenade', baseUrl } = {}) {
    this.musicTrack = musicTrack === 'maple-tea-waltz' ? musicTrack : 'saltwind-promenade';
    this.musicVolume = clamp(musicVolume);
    this.sfxVolume = clamp(sfxVolume);
    this.musicEnabled = musicEnabled;
    this.sfxEnabled = sfxEnabled;
    this.unlocked = false;
    this.disposed = false;
    this.context = null;
    this.music = null;
    this.buffers = new Map();
    this.sources = new Set();
    this.lastPlayed = new Map();
    this.abortController = new AbortController();
    this.baseUrl = baseUrl ?? `${import.meta.env?.BASE_URL ?? '/'}shanhai/audio/`;
    this.onVisibility = () => {
      if (document.hidden) { this.music?.pause(); this.stopEffects(); }
      else if (this.unlocked && this.musicEnabled) this.startMusic();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** Call directly from pointerdown/click/keydown, never from a timer or page load. */
  async unlock() {
    if (this.disposed || typeof window === 'undefined') return false;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    try {
      if (!this.context && AudioContext) {
        this.context = new AudioContext();
        this.gain = this.context.createGain();
        this.gain.gain.value = this.sfxEnabled ? this.sfxVolume : 0;
        this.gain.connect(this.context.destination);
        this.effectsReady = this.loadEffects();
      }
      // Both playback requests happen synchronously within the gesture scope.
      const resume = this.context?.resume();
      if (!this.music) {
        this.music = new Audio();
        this.music.loop = true;
        this.music.preload = 'none';
        this.music.volume = this.musicVolume;
        const format = this.music.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
        this.music.src = `${this.baseUrl}${this.musicTrack}.${format}`;
        this.music.addEventListener('error', () => {
          // One alternate format attempt. Missing assets never break the game.
          if (this.disposed || this.triedFallback) return;
          this.triedFallback = true;
          this.music.src = `${this.baseUrl}${this.musicTrack}.${format === 'ogg' ? 'mp3' : 'ogg'}`;
          if (this.musicEnabled && this.unlocked) this.startMusic();
        });
      }
      this.unlocked = true;
      if (this.musicEnabled) this.startMusic();
      await resume;
      return true;
    } catch { return false; }
  }

  async loadEffects() {
    await Promise.all(EFFECTS.map(async name => {
      try {
        const response = await fetch(`${this.baseUrl}${name}.wav`, { signal: this.abortController.signal });
        if (!response.ok) return;
        const bytes = await response.arrayBuffer();
        if (this.disposed || !this.context) return;
        const buffer = await this.context.decodeAudioData(bytes);
        if (!this.disposed) this.buffers.set(name, buffer);
      } catch { /* Audio is optional; a missing asset must not interrupt play. */ }
    }));
  }

  startMusic() {
    if (this.disposed || !this.unlocked || !this.musicEnabled || !this.music || (typeof document !== 'undefined' && document.hidden)) return;
    const result = this.music.play();
    result?.catch(() => {}); // A later explicit gesture can retry browser rejection.
  }

  play(name) {
    if (this.disposed || !this.unlocked || !this.sfxEnabled || !this.sfxVolume || (typeof document !== 'undefined' && document.hidden) || !this.context || this.context.state !== 'running') return false;
    const buffer = this.buffers.get(name);
    if (!buffer) return false; // Do not queue stale sounds while files load.
    const now = this.context.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -Infinity) < (name === 'step' ? 0.065 : 0.04)) return false;
    this.lastPlayed.set(name, now);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain);
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); };
    source.start();
    return true;
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = Boolean(enabled);
    if (this.musicEnabled) this.startMusic(); else this.music?.pause();
    return this.musicEnabled;
  }
  setSfxEnabled(enabled) {
    this.sfxEnabled = Boolean(enabled);
    if (this.gain) this.gain.gain.value = this.sfxEnabled ? this.sfxVolume : 0;
    if (!this.sfxEnabled) this.stopEffects();
    return this.sfxEnabled;
  }
  setMusicVolume(volume) {
    this.musicVolume = clamp(volume);
    if (this.music) this.music.volume = this.musicVolume;
  }
  setSfxVolume(volume) {
    this.sfxVolume = clamp(volume);
    if (!this.sfxVolume) this.stopEffects();
    if (this.gain) this.gain.gain.value = this.sfxEnabled ? this.sfxVolume : 0;
  }
  stopEffects() {
    for (const source of this.sources) { try { source.stop(); source.disconnect(); } catch {} }
    this.sources.clear();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abortController.abort();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.music) { this.music.pause(); this.music.removeAttribute('src'); this.music.load(); }
    this.stopEffects();
    this.buffers.clear();
    this.context?.close().catch(() => {});
  }
}
export default SliceAudio;
