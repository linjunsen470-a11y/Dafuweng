import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { AIPlayer } from '../src/game/AIPlayer.js';
import { getRouteChoicePlans } from '../src/game/RouteDecisionRules.js';

function setup() {
  const state = new GameState({ seed: 1808 });
  state.setupGame([
    { name: '小满', profileIndex: 0, isAI: false },
    { name: '阿土伯', profileIndex: 1, isAI: true }
  ], 30000, { mapId: 'fortune-crossroads' });
  state.boardGods = [];
  state.roadEntities = [];
  const player = state.players[0];
  player.currentTile = 3;
  return { state, player, rival: state.players[1] };
}

describe('branch route tactical forecast', () => {
  it('projects every remaining step instead of scoring only the entrance tile', () => {
    const { state, player } = setup();
    const plans = getRouteChoicePlans(state, player, [4, 6], 2);
    expect(plans.find(plan => plan.optionId === 4)).toMatchObject({ pathIds: [4, 5], destinationId: 5 });
    expect(plans.find(plan => plan.optionId === 6)).toMatchObject({ pathIds: [6, 7], destinationId: 7 });
    expect(plans.filter(plan => plan.recommended)).toHaveLength(1);
  });

  it('detects an intermediate mine as the actual early landing point', () => {
    const { state, player } = setup();
    state.roadEntities.push({ id: 'test-mine', type: 'MINE', tileId: 5, data: {} });
    const plan = getRouteChoicePlans(state, player, [4, 6], 3).find(candidate => candidate.optionId === 4);
    expect(plan).toMatchObject({ pathIds: [4, 5], destinationId: 5, stoppedEarly: true });
    expect(plan.encounters).toContainEqual(expect.objectContaining({ label: '道路地雷', tone: 'danger' }));
    expect(AIPlayer.chooseRoute(player, [4, 6], state, 3)).toBe(6);
  });

  it('avoids a high-rent destination even when the entrance itself is safe', () => {
    const { state, player, rival } = setup();
    state.propertyManager.buyProperty(4, rival.id);
    state.propertyManager.getProperty(4).level = 4;
    const plans = getRouteChoicePlans(state, player, [4, 6], 1);
    const risky = plans.find(plan => plan.optionId === 4);
    expect(risky.toll).toBeGreaterThan(0);
    expect(risky.outcome).toContain('预计租金');
    expect(AIPlayer.chooseRoute(player, [4, 6], state, 1)).toBe(6);
  });
});
