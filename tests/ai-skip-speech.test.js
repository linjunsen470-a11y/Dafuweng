import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { AISkipSpeechUI } from '../src/ui/AISkipSpeechUI.js';

const configs = [
  { profileIndex: 0, name: '林小满', isAI: false },
  { profileIndex: 1, name: '顾田野 AI', isAI: true },
  { profileIndex: 2, name: '洛晶晶 AI', isAI: true },
  { profileIndex: 3, name: '巴洛克 AI', isAI: true }
];

function installMiniDocument() {
  const prev = globalThis.document;
  const children = [];
  const makeNode = () => {
    const slots = { '.ai-skip-name': { textContent: '' }, '.ai-skip-badge': { textContent: '' }, '.ai-skip-line': { textContent: '' } };
    const classes = new Set();
    const el = {
      className: '',
      innerHTML: '',
      offsetWidth: 320,
      style: { setProperty: vi.fn() },
      setAttribute: vi.fn(),
      querySelector: sel => slots[sel],
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
      remove: () => { const idx = children.indexOf(el); if (idx >= 0) children.splice(idx, 1); }
    };
    return el;
  };
  globalThis.document = {
    documentElement: { classList: { contains: () => false } },
    body: { appendChild: el => { children.push(el); return el; } },
    createElement: makeNode,
    querySelector: sel => (sel === '.ai-skip-speech' ? children[0] || null : null)
  };
  return () => { globalThis.document = prev; };
}

describe('AI skip-turn reporting and comic speech bubble', () => {
  let restoreDocument = null;
  afterEach(() => { restoreDocument?.(); restoreDocument = null; vi.useRealTimers(); });

  it('GameState.nextTurn reports skipped turns for jail, hospital, hotel, and hibernate without dropping turns', () => {
    const state = new GameState({ seed: 2026, maxRounds: 10 });
    state.setupGame(configs, 20000);
    state.players[1].hospitalTurns = 2;
    state.players[2].jailTurns = 1;
    state.players[3].hotelTurns = 1;

    const transition = state.nextTurn();
    expect(state.currentPlayerIndex).toBe(0);
    expect(transition.skipped).toEqual([
      { playerId: 1, reason: 'HOSPITAL', remaining: 1 },
      { playerId: 2, reason: 'JAIL', remaining: 0 },
      { playerId: 3, reason: 'HOTEL', remaining: 0 }
    ]);

    state.players[1].hospitalTurns = 0;
    state.players[1].hibernateTurns = 2;
    const second = state.nextTurn();
    expect(state.currentPlayerIndex).toBe(2);
    expect(second.skipped).toEqual([
      { playerId: 1, reason: 'HIBERNATE', remaining: 1 }
    ]);
  });

  it('AISkipSpeechUI renders a warm comic dialogue card and cleans up on timeout', async () => {
    restoreDocument = installMiniDocument();
    vi.useFakeTimers();
    const voiceCalls = [];
    const ui = new AISkipSpeechUI({
      playCharacterVoice: (player, mood) => voiceCalls.push([player.name, mood])
    });
    const player = { id: 1, name: '钱夫人', isAI: true, color: '#ef4444', avatar: '👒' };

    const pending = ui.showBubble({
      player,
      mapId: 'grand-bay',
      reason: 'HOSPITAL',
      remaining: 1,
      duration: 800
    });

    const card = document.querySelector('.ai-skip-speech');
    expect(card).toBeTruthy();
    expect(card.querySelector('.ai-skip-name')?.textContent).toBe('钱夫人 AI');
    expect(card.querySelector('.ai-skip-badge')?.textContent).toContain('医院');
    expect(card.querySelector('.ai-skip-line')?.textContent).toContain('还剩 1 回合');
    expect(voiceCalls).toEqual([['钱夫人', 'misfortune']]);

    vi.advanceTimersByTime(1100);
    await pending;
    expect(document.querySelector('.ai-skip-speech')).toBeNull();
  });

  it('AI does not place MINE_ITEM or OBSTACLE on its own forward path on Round 1', async () => {
    const { GameEngine } = await import('../src/game/GameEngine.js');
    const { AIPlayer } = await import('../src/game/AIPlayer.js');
    const state = new GameState({ seed: 2026, maxRounds: 10 });
    state.setupGame(configs, 20000);
    const engine = new GameEngine(state);

    const ai = state.players[1];
    const itemDecision = AIPlayer.decideItemUsage(ai, state, engine);
    expect(['MINE_ITEM', 'BARRIER']).not.toContain(itemDecision?.itemId);

    const cardDecision = AIPlayer.decideCardUsage(ai, state, engine);
    expect(['OBSTACLE', 'MINE']).not.toContain(cardDecision?.cardId);
  });
});
