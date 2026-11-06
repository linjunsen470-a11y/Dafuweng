// @vitest-environment happy-dom
/** DOM SIMULATION ONLY. Scene/audio are mocked; this is not WebGL, visual,
 * browser-layout, asset-load, playback, or performance acceptance evidence. */
import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// Cloud cold module imports can exceed Vitest's default hook timeout.
vi.setConfig({hookTimeout:60000,testTimeout:60000});
const sceneFailure=vi.hoisted(()=>({constructor:false,load:false}));
vi.mock('../src/shanhai/SliceScene.js', () => ({ SliceScene: class {
  constructor() { if(sceneFailure.constructor)throw new Error('WebGL unavailable'); this.renderer = {}; this.moves = []; }
  async load() { if(sceneFailure.load)throw new Error('Asset unavailable'); }
  dispose() {}
  createPawns() {} syncProperties() {} highlight() {} overview() {} rollDice() {} action() {} rotate() {} zoom() {}
  async move(playerId, tileId) { this.moves.push({ playerId, tileId }); }
  async travelByBoat(playerId, from, tileId) { this.moves.push({ playerId, from, tileId }); }
  async react() {}
} }));
vi.mock('../src/shanhai/SliceAudio.js', () => ({ SliceAudio: class {
  constructor() { this.musicEnabled = true; this.sfxEnabled = true; this.played = []; }
  unlock() {} play(name) { this.played.push(name); }
  setMusicEnabled(value) { this.musicEnabled = value; }
  setSfxEnabled(value) { this.sfxEnabled = value; }
} }));

const html = readFileSync(`${process.cwd()}/shanhai.html`, 'utf8');
const $ = selector => document.querySelector(selector);
const click = selector => { const button = $(selector); expect(button, selector).not.toBeNull(); button.click(); };
const game = () => window.shanhai;
const snapshot = () => game().session.snapshot();
const listeners = [];
let originalAdd;
async function boot(ready=true) {
  for (const [name, listener, options] of listeners.splice(0)) window.removeEventListener(name, listener, options);
  vi.clearAllTimers();
  vi.resetModules();
  document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
  await import('../src/shanhai/main.js');
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(0);
  expect(game().ready).toBe(ready);
}
async function finishAnimations() { await vi.advanceTimersByTimeAsync(15000); expect(game().busy).toBe(false); }
async function start() { click('#start-button'); await finishAnimations(); expect(game().active).toBe(true); }
async function remote(step) { click('#remote-button'); click(`[data-step="${step}"]`); await finishAnimations(); }

beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-05T12:00:00Z'));
  localStorage.clear();
  originalAdd = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((name, listener, options) => {
    listeners.push([name, listener, options]); originalAdd(name, listener, options);
  });
  await boot();
});
afterEach(() => {
  for (const [name, listener, options] of listeners.splice(0)) window.removeEventListener(name, listener, options);
  sceneFailure.constructor=false;sceneFailure.load=false;
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); delete window.shanhai;
});

describe('Shanhai UI integration: DOM simulation with real rules, mocked scene/audio', () => {
  it.each(['constructor','load'])('shows a recoverable loading error for scene %s failure', async failure => {
    vi.spyOn(console,'error').mockImplementation(()=>{});
    sceneFailure[failure]=true;
    await boot(false);
    expect($('#loading').hidden).toBe(false);
    expect($('#loading').getAttribute('role')).toBe('alert');
    expect($('#retry-loading')).not.toBeNull();
    expect($('#start-button').disabled).toBe(true);
    expect($('#resume-button').hidden).toBe(true);
  });

  it('can play when reading the localStorage property throws SecurityError', async () => {
    vi.spyOn(window,'localStorage','get').mockImplementation(()=>{throw new DOMException('Denied','SecurityError');});
    await boot();
    await start();
    await remote(1);
    click('#decision-button');await finishAnimations();
    expect(snapshot().properties.find(([id])=>id===1)[1].owner).toBe(0);
    click('#save-button');
    expect($('#toast').textContent).toContain('不支持本地存档');
    expect($('#save-status').textContent).toContain('无法保存');
    click('#menu-button');click('#confirm-menu');
    expect(game().active).toBe(true);
    expect($('#welcome-panel').hidden).toBe(true);
  });

  it('selects an original character and starts a real engine session', async () => {
    expect($('#start-button').disabled).toBe(false);
    click('[data-character="qinghe"]'); await start();
    expect(game().session.currentPlayer.name).toBe('青禾');
    expect(snapshot().players[1].name).toBe('阿屿');
    expect($('#welcome-panel').hidden).toBe(true);
    expect($('#game-panel').hidden).toBe(false);
    expect($('#roll-button')).not.toBeNull();
  });

  it('consumes a real remote card, buys through UI and rejects duplicate click handlers', async () => {
    await start(); await remote(1);
    expect(snapshot().players[0].currentTile).toBe(1);
    expect(snapshot().players[0].cards).not.toContain('REMOTE_DICE');
    expect(game().scene.moves).toEqual([{ playerId: 0, tileId: 1 }]);
    const before = snapshot(), decision = $('#decision-button');
    expect(before.slice.focus.kind).toBe('PURCHASE');
    decision.click(); decision.click();
    await finishAnimations();
    expect(snapshot().players[0].cash).toBe(before.players[0].cash - before.slice.focus.cost);
    expect(snapshot().properties.find(([id]) => id === 1)[1]).toMatchObject({ owner: 0, level: 0 });
    expect(game().session.focus.kind).toBe('DONE');
    expect($('#end-turn-button')).not.toBeNull();
  });

  it('ends a human turn, animates real AI movement via mocked scene, then rolls normally', async () => {
    await start(); await remote(1); click('#skip-button'); await finishAnimations();
    expect(game().session.currentPlayer.isAI).toBe(false);
    expect(snapshot().round).toBe(2);
    expect(game().scene.moves.some(step => step.playerId === 1)).toBe(true);
    expect(snapshot().matchStatistics.players[1]).toBeTruthy();
    click('#roll-button'); await finishAnimations();
    expect(snapshot().phase).toBe('LANDING_ACTION');
    expect(snapshot().slice.landingResolved).toBe(true);
    expect(game().session.lastRoll.dice[0]).toBeGreaterThanOrEqual(1);
    expect(game().session.lastRoll.dice[0]).toBeLessThanOrEqual(6);
  });

  it('manually saves and restores exact state after a simulated module/page reload', async () => {
    await start(); await remote(1); click('#decision-button'); await finishAnimations();
    click('#save-button'); const before = snapshot();
    expect($('#toast').textContent).toContain('已保存');
    await boot();
    expect($('#resume-button').hidden).toBe(false);
    click('#resume-button'); await finishAnimations();
    const after = snapshot();
    for (const key of ['players', 'properties', 'round', 'rngState', 'currentPlayerIndex', 'phase', 'slice']) expect(after[key], key).toEqual(before[key]);
    expect($('#end-turn-button')).not.toBeNull();
    expect($('#decision-button')).toBeNull();
  });

  it('shows route destinations and exchanges points through the real supply button', async () => {
    await start();await remote(1);click('#skip-button');await finishAnimations();
    const points=snapshot().players[0].cardPoints;
    expect($('#supply-button').disabled).toBe(false);
    const supply=$('#supply-button');supply.click();supply.click();
    expect(snapshot().players[0].cardPoints).toBe(points-45);
    expect($('#supply-button').disabled).toBe(true);
    click('#remote-button');
    expect($('[data-step="1"]').textContent).toContain('贝壳花园');
    const destination=snapshot().properties.find(([id])=>id===2)[1];
    expect($('[data-step="1"]').textContent).toContain(destination.owner===null?'可购买':`${snapshot().players[destination.owner].name}的地产`);
    expect($('[data-step="3"]').textContent).toContain('漂流信笺');
    const before=snapshot();click('.modal-close');
    expect(snapshot()).toEqual(before);
  });

  it('disables forbidden property decisions during bad luck and keeps the turn playable', async () => {
    await start();await remote(1);
    const snap=snapshot();snap.players[0].godType='BAD';snap.players[0].godTurns=3;
    expect(game().session.restore(snap).success).toBe(true);
    expect($('#decision-button').disabled).toBe(true);
    expect($('#action-description').textContent).toContain('衰运');
    const cash=snapshot().players[0].cash;click('#decision-button');
    expect(snapshot().players[0].cash).toBe(cash);
    click('#skip-button');await finishAnimations();
    expect(game().session.state.phase).toBe('PRE_ROLL_ACTION');
    expect($('#roll-button')).not.toBeNull();
  });

  it('toggles music and sound effect preferences independently', () => {
    click('#music-toggle');
    expect(game().audio.musicEnabled).toBe(false); expect(game().audio.sfxEnabled).toBe(true);
    expect($('#music-toggle').getAttribute('aria-label')).toBe('开启背景音乐');
    click('#sfx-toggle');
    expect(game().audio.musicEnabled).toBe(false); expect(game().audio.sfxEnabled).toBe(false);
    click('#music-toggle');
    expect(game().audio.musicEnabled).toBe(true); expect(game().audio.sfxEnabled).toBe(false);
    click('#sfx-toggle'); expect(game().audio.sfxEnabled).toBe(true);
  });

  it('opens and closes guidance and remote modals repeatedly without spending cards', async () => {
    click('#help-button'); expect($('#info-dialog').open).toBe(true);
    click('.modal-close'); expect($('#info-dialog').open).toBe(false);
    click('#help-button'); expect($('#info-dialog').open).toBe(true);
    click('.modal-close'); await start();
    const cards = [...snapshot().players[0].cards];
    for (let i = 0; i < 3; i++) {
      click('#remote-button'); expect($('#info-dialog').open).toBe(true);
      expect(document.querySelectorAll('[data-step]')).toHaveLength(6);
      click('.modal-close'); expect($('#info-dialog').open).toBe(false);
    }
    expect(snapshot().players[0].cards).toEqual(cards);
    expect(snapshot().phase).toBe('PRE_ROLL_ACTION');
  });

  it('saves on return to the welcome menu and continues the same pending decision', async () => {
    await start(); await remote(1);
    const before = snapshot();
    click('#menu-button'); expect($('#info-dialog').open).toBe(true);
    click('#cancel-menu'); expect(game().active).toBe(true);
    click('#menu-button'); click('#confirm-menu');
    expect(game().active).toBe(false);
    expect($('#welcome-panel').hidden).toBe(false);
    expect($('#game-panel').hidden).toBe(true);
    click('#resume-button'); await finishAnimations();
    expect(game().active).toBe(true);
    for (const key of ['players', 'properties', 'rngState', 'phase', 'slice']) expect(snapshot()[key], key).toEqual(before[key]);
    expect($('#decision-button')).not.toBeNull();
  });
});
