// Expressive cartoon vocal blips (Animal Crossing / Richman-4 playful exclamations)
// with optional local Chinese speech synthesis toggle.
const VOICE_PROFILES = [
  { pitch: 440, formant: 1450, speed: 0.052 }, // 0 林小满 元气女声
  { pitch: 185, formant: 760, speed: 0.072 },  // 1 顾田野 憨厚大叔
  { pitch: 310, formant: 1180, speed: 0.058 }, // 2 洛晶晶 干练高冷
  { pitch: 158, formant: 680, speed: 0.076 },  // 3 巴洛克 豪爽低沉
  { pitch: 350, formant: 1260, speed: 0.048 }, // 4 风间岚 迅捷清亮
  { pitch: 390, formant: 1380, speed: 0.062 }, // 5 米娅 温柔轻快
  { pitch: 215, formant: 860, speed: 0.060 },  // 6 霍克 豪迈牛仔
  { pitch: 320, formant: 1150, speed: 0.050 }, // 7 阿飞 热血少年
  { pitch: 270, formant: 1050, speed: 0.068 }, // 8 奥黛拉 优雅御姐
  { pitch: 520, formant: 1680, speed: 0.046 }, // 9 棠果 甜美萝莉
  { pitch: 168, formant: 720, speed: 0.064 },  // 10 黑泽隼 酷帅剑客
  { pitch: 460, formant: 1560, speed: 0.049 }, // 11 米洛 机灵神童
  { pitch: 235, formant: 980, speed: 0.054 },  // 12 丹尼 街头潮男
  { pitch: 365, formant: 1320, speed: 0.056 }, // 13 莎拉 清脆知性
  { pitch: 295, formant: 1120, speed: 0.055 }, // 14 宫本凌 爽朗女侠
  { pitch: 495, formant: 1620, speed: 0.047 }  // 15 金宝宝 奶声萌娃
];
const preference = 'fortune-empire:spoken-lines';

export class CharacterVoice {
  constructor(audio) {
    this.audio = audio;
    this.spoken = false;
    try { this.spoken = localStorage.getItem(preference) === '1'; } catch {}
  }

  setSpoken(enabled) {
    this.spoken = enabled;
    try { localStorage.setItem(preference, enabled ? '1' : '0'); } catch {}
    if (!enabled) this.stop();
  }

  stop() {
    if (this.utterance) globalThis.speechSynthesis?.cancel();
    this.utterance = null;
  }

  speakLocal(text, pitch) {
    if (!this.spoken || !globalThis.SpeechSynthesisUtterance) return false;
    try {
      const synth = globalThis.speechSynthesis;
      const voice = synth?.getVoices().find(v => v.localService && /^zh/i.test(v.lang));
      if (!voice) return false;
      this.stop();
      const line = new SpeechSynthesisUtterance(text);
      line.voice = voice;
      line.lang = voice.lang;
      line.pitch = 0.8 + pitch / 950;
      line.rate = 1.14;
      line.volume = this.audio.sfxVolume * 0.74;
      line.onend = line.onerror = () => {
        if (this.utterance === line) this.utterance = null;
      };
      this.utterance = line;
      synth.speak(line);
      return true;
    } catch {
      this.utterance = null;
      return false;
    }
  }

  playVocalSyllable(pitch, formantHz, start, dur, endRatio = 1.0) {
    const ctx = this.audio.ctx;
    if (!ctx || typeof ctx.createBiquadFilter !== 'function') {
      this.audio.scheduleTone(pitch, start, dur, { type: 'triangle', volume: 0.05, attack: 0.01, release: dur * 0.6 });
      return;
    }
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(Math.max(80, pitch), start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(70, pitch * endRatio), start + dur);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(formantHz, start);
    filter.Q.value = 3.8;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.095, start + Math.min(0.016, dur * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audio.sfxGain);
    osc.onended = () => {
      try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch {}
    };
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  play(player, cue) {
    const audio = this.audio;
    if (audio.muted || !audio.sfxVolume || !audio.init()) return;
    const id = player.profileId || 0;
    const profile = VOICE_PROFILES[id] || { pitch: 300, formant: 1100, speed: 0.058 };
    if (!this.speakLocal(cue.line, profile.pitch)) {
      const upbeat = ['gain', 'win'].includes(cue.emotion);
      const crisis = ['crisis', 'bankrupt'].includes(cue.emotion);
      const contour = upbeat
        ? [[1.0, 1.18, 1.05], [1.22, 1.38, 1.15], [1.45, 1.62, 1.2]]
        : crisis
          ? [[1.1, 0.85, 0.9], [0.88, 0.68, 0.82], [0.72, 0.56, 0.72]]
          : [[1.04, 0.92, 0.95], [0.9, 0.76, 0.84]];
      const now = audio.ctx.currentTime;
      contour.forEach(([startMul, endMul, formMul], index) => {
        this.playVocalSyllable(
          profile.pitch * startMul,
          profile.formant * formMul,
          now + index * (profile.speed + 0.022),
          profile.speed * 1.45,
          endMul / startMul
        );
      });
    }
    audio.duckMusic(0.45, 0.64);
  }
}
