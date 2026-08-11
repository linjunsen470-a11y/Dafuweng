import { describe, expect, it } from 'vitest';
import { describePresentationEvent } from '../src/ui/PresentationUI.js';

function createState() {
  const players = [
    { id: 0, name: '小满', color: '#f00' },
    { id: 1, name: '阿土伯', color: '#fa0' }
  ];
  return {
    players,
    round: 3,
    currentPlayerIndex: 0,
    getCurrentPlayer: () => players[0],
    getTile: id => ({ id, name: id === 7 ? '珊瑚湾' : `地块${id}` }),
    getCardById: id => ({ id, name: '遥控骰子' })
  };
}

describe('presentation event descriptions', () => {
  it('describes a property purchase as both spending and a success toast', () => {
    const cues = describePresentationEvent({ type: 'PROPERTY_PURCHASED', tileId: 7, cost: 1800 }, createState());
    expect(cues).toEqual([
      { kind: 'cash', playerId: 0, amount: -1800, label: '购入地产' },
      { kind: 'toast', icon: '🏡', title: '成功购入地产', detail: '小满 · 珊瑚湾 · $1,800', tone: 'success' }
    ]);
  });

  it('shows both sides of a rent transfer', () => {
    const cues = describePresentationEvent({ type: 'RENT_PAID', amount: 900, ownerId: 1 }, createState());
    expect(cues.filter(cue => cue.kind === 'cash')).toEqual([
      { kind: 'cash', playerId: 0, amount: -900, label: '支付过路费' },
      { kind: 'cash', playerId: 1, amount: 900, label: '收到过路费' }
    ]);
    expect(cues.at(-1).detail).toContain('小满 向 阿土伯 支付 $900');
  });

  it('turns a transition into a round-aware turn cue', () => {
    const state = createState();
    const cues = describePresentationEvent({
      type: 'TURN_CHANGED',
      transition: { gameOver: false, currentPlayer: state.players[1] }
    }, state);
    expect(cues).toEqual([{ kind: 'turn', playerId: 1, round: 3 }]);
  });

  it('keeps per-step movement silent to avoid notification spam', () => {
    expect(describePresentationEvent({ type: 'PLAYER_STEPPED', playerId: 0, tileId: 2 }, createState())).toEqual([]);
  });
});
