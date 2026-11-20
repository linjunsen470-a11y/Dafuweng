import {afterEach,expect,it,vi} from 'vitest';
import {AudioManager} from '../src/engine/AudioManager.js';
afterEach(()=>vi.unstubAllGlobals());
it('restores mute before creating either audio bus and persists unmute',()=>{
 const storage={getItem:vi.fn(()=> '1'),setItem:vi.fn()};vi.stubGlobal('localStorage',storage);
 const node=()=>({gain:{value:1},frequency:{value:0},threshold:{},knee:{},ratio:{},attack:{},release:{},connect:vi.fn()});
 vi.stubGlobal('AudioContext',class {state='running';createGain=node;createBiquadFilter=node;createDynamicsCompressor=node;});
 const a=new AudioManager();expect(a.muted).toBe(true);a.init();expect(a.sfxGain.gain.value).toBe(0);expect(a.musicGain.gain.value).toBe(0);
 a.sfxGain.gain.setTargetAtTime=vi.fn();a.musicGain.gain.setTargetAtTime=vi.fn();expect(a.toggleMute()).toBe(false);expect(storage.setItem).toHaveBeenCalledWith('fortune-empire:audio-muted','0');
});
it('keeps in-session mute usable when storage access throws',()=>{
 vi.stubGlobal('localStorage',{getItem(){throw new Error('SecurityError');},setItem(){throw new Error('SecurityError');}});
 const a=new AudioManager();expect(a.muted).toBe(false);expect(a.toggleMute()).toBe(true);expect(a.playConfirm()).toBe(false);
});

it('reads optional lines with a local Chinese voice and falls back to character tones offline', () => {
  const manager = new AudioManager();
  manager.init = () => true;
  manager.ctx = {currentTime: 0};
  manager.scheduleTone = vi.fn();
  manager.duckMusic = vi.fn();
  const cloud = {localService: false, lang: 'zh-CN'};
  const local = {localService: true, lang: 'zh-TW'};
  const synth = {getVoices: () => [cloud, local], speak: vi.fn(), cancel: vi.fn()};
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', class {constructor(text) {this.text = text;}});
  const react = () => manager.voice.play({profileId: 2}, {emotion: 'gain', line: '收租啦！'});
  react();
  expect(manager.scheduleTone).toHaveBeenCalledTimes(3);
  manager.voice.setSpoken(true);
  react();
  expect(synth.speak).toHaveBeenCalledWith(expect.objectContaining({voice:local, text:'收租啦！'}));
  manager.toggleMute();
  expect(synth.cancel).toHaveBeenCalledOnce();
  react();
  expect(synth.speak).toHaveBeenCalledTimes(1);
  manager.toggleMute();
  synth.getVoices = () => [cloud];
  react();
  expect(manager.scheduleTone).toHaveBeenCalledTimes(6);
});
