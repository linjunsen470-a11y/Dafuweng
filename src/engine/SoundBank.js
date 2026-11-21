// Studio sampled BGM & cartoon foley bank routed through AudioManager's buses.
// Gracefully falls back to procedural Web Audio in test/offline-decode environments.

const BASE = () => (import.meta.env?.BASE_URL || '/');

const BGM_TRACKS = {
  'city-day': 'bgm_city.mp3',
  'grand-bay': 'bgm_city.mp3',
  'island-breeze': 'bgm_island.mp3',
  'taiwan-folk': 'bgm_festival.mp3',
  'fortune-crossroads': 'bgm_festival.mp3'
};

const SFX_FILES = {
  click: 'sfx_click.mp3',
  dice: 'sfx_dice.mp3',
  step: 'sfx_step.mp3',
  coin: 'sfx_coin.mp3',
  big_cash: 'sfx_big_cash.mp3',
  stamp: 'sfx_buy.mp3',
  buy: 'sfx_buy.mp3',
  hammer: 'sfx_upgrade.mp3',
  upgrade: 'sfx_upgrade.mp3',
  missile: 'sfx_missile.mp3',
  blast: 'sfx_mine.mp3',
  mine: 'sfx_mine.mp3',
  brake: 'sfx_brake.mp3',
  clinic: 'sfx_ambulance.mp3',
  ambulance: 'sfx_ambulance.mp3',
  jackpot: 'sfx_good_god.mp3',
  good_god: 'sfx_good_god.mp3',
  sigh: 'sfx_bad_god.mp3',
  bad_god: 'sfx_bad_god.mp3',
  news: 'sfx_news.mp3',
  card: 'sfx_card.mp3',
  stock: 'sfx_coin.mp3',
  cheer: 'sfx_cheer.mp3',
  victory: 'sfx_cheer.mp3'
};

const decodedCache = new WeakMap();
const pendingCache = new WeakMap();

function contextMap(store, ctx) {
  let map = store.get(ctx);
  if (!map) {
    map = new Map();
    store.set(ctx, map);
  }
  return map;
}

export function loadSample(audio, filename) {
  const ctx = audio?.ctx;
  if (!ctx || typeof ctx.decodeAudioData !== 'function' || typeof globalThis.fetch !== 'function') {
    return Promise.resolve(null);
  }
  const buffers = contextMap(decodedCache, ctx);
  if (buffers.has(filename)) return Promise.resolve(buffers.get(filename));
  const inflight = contextMap(pendingCache, ctx);
  if (inflight.has(filename)) return inflight.get(filename);

  const task = globalThis.fetch(`${BASE()}assets/audio/${filename}`)
    .then(res => (res.ok ? res.arrayBuffer() : null))
    .then(raw => (raw ? ctx.decodeAudioData(raw.slice(0)) : null))
    .then(buffer => {
      if (buffer) buffers.set(filename, buffer);
      inflight.delete(filename);
      return buffer;
    })
    .catch(() => {
      inflight.delete(filename);
      return null;
    });
  inflight.set(filename, task);
  return task;
}

export function preloadCoreSamples(audio) {
  if (!audio?.ctx || typeof globalThis.fetch !== 'function') return;
  for (const file of new Set(Object.values(SFX_FILES))) {
    void loadSample(audio, file);
  }
}

export function playSampledSFX(audio, key, { volume = 0.72, rate = 1.0 } = {}) {
  const filename = SFX_FILES[key];
  if (!filename || !audio?.ctx || audio.muted) return false;
  const buffers = contextMap(decodedCache, audio.ctx);
  const buffer = buffers.get(filename);
  if (!buffer) {
    void loadSample(audio, filename);
    return false;
  }
  try {
    const source = audio.ctx.createBufferSource();
    const gain = audio.ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(audio.sfxGain);
    source.onended = () => {
      try { source.disconnect(); gain.disconnect(); } catch {}
    };
    source.start(audio.ctx.currentTime);
    return true;
  } catch {
    return false;
  }
}

export function startSampledBGM(audio, themeId, onLoaded = null) {
  const filename = BGM_TRACKS[themeId] || BGM_TRACKS['city-day'];
  if (!audio?.ctx || typeof globalThis.fetch !== 'function') return false;
  const token = (audio._bgmLoadToken = (audio._bgmLoadToken || 0) + 1);
  void loadSample(audio, filename).then(buffer => {
    if (!buffer || audio._bgmLoadToken !== token || audio.currentTheme !== themeId || !audio.ctx) return;
    try {
      if (audio.musicTimer) {
        globalThis.clearInterval(audio.musicTimer);
        audio.musicTimer = null;
      }
      audio.activeMusicNodes.forEach(node => {
        try { node.stop(); } catch {}
        try { node.disconnect(); } catch {}
      });
      audio.activeMusicNodes.clear();
      const source = audio.ctx.createBufferSource();
      const gain = audio.ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.setValueAtTime(0.001, audio.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.92, audio.ctx.currentTime + 0.45);
      source.connect(gain);
      gain.connect(audio.musicGain);
      audio.activeMusicNodes.add(source);
      source.onended = () => {
        audio.activeMusicNodes.delete(source);
        try { source.disconnect(); gain.disconnect(); } catch {}
      };
      source.start(audio.ctx.currentTime);
      onLoaded?.(source);
    } catch {}
  });
  return true;
}

export function mallet(audio, hz, start, duration, wood = false) {
  const bus = { destination: audio.musicGain, trackMusic: true, attack: 0.005 };
  audio.scheduleTone(hz, start, duration, { ...bus, type: wood ? 'triangle' : 'sine', volume: 0.049, release: duration * 0.7 });
  audio.scheduleTone(hz * (wood ? 3 : 4.02), start, 0.054, { ...bus, type: 'sine', volume: 0.013, release: 0.034 });
}

export function playSceneSound(audio, kind) {
  if (audio.muted || !audio.init()) return false;
  if (['missile', 'blast', 'mine', 'bad_god', 'sigh', 'jackpot', 'good_god', 'news'].includes(kind)) {
    audio.duckMusic(0.8, 0.35);
  }
  if (playSampledSFX(audio, kind, { volume: kind === 'click' ? 0.45 : 0.78 })) return true;

  const now = audio.ctx.currentTime;
  const note = (hz, at, length, volume, end = hz) => {
    const oscillator = audio.scheduleTone(hz, now + at, length, { type: 'sine', volume, release: length * 0.68 });
    oscillator?.frequency.exponentialRampToValueAtTime(end, now + at + length);
  };
  const knock = (at, lowpass) => audio.scheduleNoise(now + at, 0.065, { volume: 0.08, highpass: 110, lowpass });
  switch (kind) {
    case 'stamp':
    case 'buy':
      knock(0, 1200); note(215, 0, 0.15, 0.12, 78); break;
    case 'hammer':
    case 'upgrade':
      [0, 0.13, 0.24].forEach(offset => knock(offset, 1750));
      [880, 1109, 1319].forEach((hz, i) => note(hz, 0.28 + i * 0.04, 0.16, 0.045)); break;
    case 'missile':
      note(340, 0, 0.39, 0.055, 1360); knock(0.45, 1900); note(180, 0.45, 0.22, 0.13, 48); break;
    case 'blast':
    case 'mine':
      knock(0, 2100); note(180, 0, 0.25, 0.12, 48); break;
    case 'brake':
      note(860, 0, 0.14, 0.05, 220); note(160, 0.12, 0.17, 0.065, 420); break;
    case 'jackpot':
    case 'good_god':
      [392, 494, 587, 784].forEach((hz, i) => note(hz, i * 0.07, 0.19, 0.06)); break;
    case 'sigh':
    case 'bad_god':
      note(460, 0, 0.13, 0.05, 365); note(365, 0.12, 0.26, 0.06, 196); break;
    case 'stock':
      [620, 780, 980].forEach((hz, i) => note(hz, i * 0.06, 0.15, 0.045)); break;
    case 'news':
      [587, 587, 784].forEach((hz, i) => note(hz, i * 0.08, 0.16, 0.06)); break;
    case 'big_cash':
      [987, 1318, 1568, 2093].forEach((hz, i) => note(hz, i * 0.055, 0.2, 0.07)); break;
    default: return false;
  }
  return true;
}
