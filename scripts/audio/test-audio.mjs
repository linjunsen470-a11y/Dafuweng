import assert from 'node:assert/strict';
import { SliceAudio } from '../../src/shanhai/SliceAudio.js';
const listeners = new Map();
globalThis.document = { hidden: false, addEventListener: (name, cb) => listeners.set(name, cb), removeEventListener: name => listeners.delete(name) };
let plays = 0, pauses = 0, fetches = 0, stopped = 0;
class FakeAudio {
  canPlayType() { return 'probably'; }
  play() { plays++; return Promise.resolve(); }
  pause() { pauses++; }
  addEventListener(name, cb) { this[name] = cb; }
  removeAttribute() {}
  load() {}
}
class FakeContext {
  state = 'running'; currentTime = 1;
  createGain() { return { gain: { value: 1 }, connect() {} }; }
  resume() { return Promise.resolve(); }
  decodeAudioData() { return Promise.resolve({}); }
  createBufferSource() { return { connect() {}, disconnect() {}, start() {}, stop() { stopped++; } }; }
  close() { return Promise.resolve(); }
}
globalThis.Audio = FakeAudio;
globalThis.window = { AudioContext: FakeContext };
globalThis.fetch = async () => { fetches++; return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) }; };
const audio = new SliceAudio();
assert.equal(fetches, 0, 'construction does not load sound');
assert.equal(plays, 0, 'construction does not autoplay');
assert.equal(audio.play('dice'), false);
await audio.unlock();
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(fetches, 13);
assert.equal(audio.buffers.size, 13);
assert.equal(plays, 1);
assert.equal(audio.play('dice'), true);
assert.equal(audio.play('dice'), false, 'duplicate effect throttled');
audio.setSfxEnabled(false);
assert.equal(audio.play('step'), false);
assert.equal(stopped, 1, 'mute stops current voices, so unmute cannot revive tails');
assert.equal(audio.gain.gain.value, 0);
audio.setSfxVolume(.4);
audio.setSfxEnabled(true);
assert.equal(audio.gain.gain.value, .4);
audio.setMusicEnabled(false);
assert.equal(pauses, 1);
audio.setMusicVolume(3);
assert.equal(audio.music.volume, 1);
audio.setMusicEnabled(true);
assert.equal(plays, 2);
document.hidden = true; listeners.get('visibilitychange')();
assert.equal(pauses, 2);
assert.equal(audio.play('event-success'), false, 'hidden page does not play AI effects');
audio.dispose(); audio.dispose();
assert.equal(listeners.size, 0);
assert.equal(stopped, 1);
assert.equal(audio.play('win'), false);
assert.equal(await audio.unlock(), false);
document.hidden = false;
const mountain = new SliceAudio({musicTrack:'maple-tea-waltz', musicEnabled:false});
const previousPlays=plays; await mountain.unlock(); await mountain.effectsReady;
assert.equal(plays,previousPlays,'saved mute respected at first gesture');
assert.match(mountain.music.src,/maple-tea-waltz.ogg$/);
mountain.music.error(); assert.match(mountain.music.src,/maple-tea-waltz.mp3$/);
assert.equal(plays,previousPlays,'format fallback respects mute');
assert.equal(mountain.play('bankruptcy'),true);mountain.setSfxVolume(0);assert.equal(mountain.sources.size,0,'zero volume stops tails'); assert.equal(mountain.play('ability'),false);
mountain.setSfxVolume(.25);assert.equal(mountain.play('event-success'),true);
assert.equal(mountain.play('event-fail'),true);
document.hidden=true;listeners.get('visibilitychange')();assert.equal(mountain.sources.size,0);
mountain.dispose();
console.log('PASS: gesture gating, one-time fetch, independent controls, throttling, visibility silence, disposal, map track/fallback, new event cues, zero volume');

// Browser policy failures must be recoverable with a later explicit gesture.
let denied=true;
class RestrictedContext extends FakeContext {state='suspended';resume(){if(denied)return Promise.reject(new Error('NotAllowedError'));this.state='running';return Promise.resolve();}}
class RestrictedAudio extends FakeAudio {play(){return denied?Promise.reject(new Error('NotAllowedError')):Promise.resolve();}}
globalThis.window.AudioContext=RestrictedContext;globalThis.Audio=RestrictedAudio;document.hidden=false;
const restricted=new SliceAudio();assert.equal(await restricted.unlock(),false);await restricted.effectsReady;assert.equal(restricted.play('ability'),false);const loaded=fetches;denied=false;assert.equal(await restricted.unlock(),true);assert.equal(fetches,loaded,'retry reuses decoded effects');assert.equal(restricted.play('ability'),true);assert.equal(restricted.play('auction-sold'),true);restricted.dispose();
console.log('PASS: three action cues, zero-volume tail stop, blocked playback and later gesture recovery without reloading effects');
