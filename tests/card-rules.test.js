import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { CardRules } from '../src/game/CardRules.js';
import { CARDS } from '../src/game/CardManager.js';

function createState() {
  const state = new GameState({ seed: 7 });
  state.setupGame([
    { profileIndex: 0, name: '甲', isAI: false },
    { profileIndex: 1, name: '乙', isAI: true },
    { profileIndex: 2, name: '丙', isAI: true }
  ]);
  state.players[0].cards = CARDS.map(card => card.id);
  return state;
}

describe('CardRules', () => {
  it('ships eighteen data-driven card definitions', () => {
    expect(CARDS).toHaveLength(18);
  });

  it('offers every active opponent for player-target cards', () => {
    const state = createState();
    const action = new CardRules(state).getLegalAction(state.players[0], 'TURTLE');
    expect(action.enabled).toBe(true);
    expect(action.targets.map(target => target.id)).toEqual([1, 2]);
  });

  it('does not consume-enable a targeted card without a legal target', () => {
    const state = createState();
    const action = new CardRules(state).getLegalAction(state.players[0], 'DEMOLISH');
    expect(action.enabled).toBe(false);
    expect(action.reason).toBe('当前没有合法目标');
  });

  it('restricts obstacle placement to the configured twenty nearby tiles', () => {
    const state = createState();
    const action = new CardRules(state).getLegalAction(state.players[0], 'OBSTACLE');
    expect(action.targets).toHaveLength(20);
  });
});

