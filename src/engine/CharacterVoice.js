// Character pitches follow the profile IDs used by CharacterReactions.
const pitches = [455,208,294,162,360,382,211,330,258,512,172,405,185,348,272,420];
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
      line.pitch = .8 + pitch / 950;
      line.rate = 1.14;
      line.volume = this.audio.sfxVolume * .74;
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

  play(player, cue) {
    const audio = this.audio;
    if (audio.muted || !audio.sfxVolume || !audio.init()) return;
    const id = player.profileId || 0;
    const pitch = pitches[id] || 300;
    if (!this.speakLocal(cue.line, pitch)) {
      const upbeat = ['gain', 'win'].includes(cue.emotion);
      const notes = upbeat ? [1, 1.23, 1.51] : [1, .88, .73];
      notes.forEach((ratio, index) => {
        const start = audio.ctx.currentTime + index * (.055 + (id % 3) * .012);
        audio.scheduleTone(pitch * ratio, start, .115, {
          type: id % 2 ? 'triangle' : 'sine', volume: .043,
          attack: .015, release: .075, detune: 6 * (index - 1)
        });
      });
    }
    audio.duckMusic(.45,.64);
  }
}
