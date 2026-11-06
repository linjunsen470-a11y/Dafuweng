import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { chooseAIMechanismRoute, getMechanismRoutePlans } from '../src/game/MechanismRules.js';

function setup() {
  const state = new GameState({ seed: 1708 });
  state.setupGame([
    { name: '小满', profileIndex: 0, isAI: false },
    { name: '阿土伯', profileIndex: 1, isAI: true }
  ], 30000, { mapId: 'grand-bay' });
  return { state, engine: new GameEngine(state), player: state.players[0] };
}

describe('tidal mechanism route-control model', () => {
  it('builds two authored network plans across all three rejoining branches', () => {
    const { state, player } = setup();
    const plans = getMechanismRoutePlans(state, player);
    expect(plans).toHaveLength(2);
    expect(plans.map(plan => plan.id)).toEqual(['MAIN', 'BRANCH']);
    expect(plans.every(plan => plan.segments.length === 3)).toBe(true);
    expect(plans[0]).toMatchObject({ routeIndex: 0, name: '环城主干道', nodeCount: 36, enabled: true, active: false });
    expect(plans[1]).toMatchObject({ routeIndex: 1, name: '潮汐探索线', nodeCount: 39, enabled: true, active: false });
    expect(plans[0].segments.map(segment => segment.rejoinTileId)).toEqual([24, 48, 72]);
    expect(plans.every(plan => plan.propertyCount < plan.nodeCount)).toBe(true);
    expect(plans.every(plan => plan.propertyCount + plan.facilityCount <= plan.nodeCount)).toBe(true);
  });

  it('locks a selected scheme authoritatively and blocks redundant activation', () => {
    const { state, engine, player } = setup();
    expect(engine.triggerMapMechanism(player, 0)).toMatchObject({ success: true, type: 'MECHANISM_TRIGGERED', activeRoute: 0, routeName: '环城主干道', branchCount: 3 });
    expect(state.mechanismState).toEqual({ activeRoute: 0, locked: true });
    expect(state.mapRuntime.getNextOptions(12)).toEqual([13]);
    expect(state.mapRuntime.getNextOptions(36)).toEqual([37]);
    expect(engine.triggerMapMechanism(player, 0)).toMatchObject({ success: false, reason: '当前方案已在运行' });
    expect(engine.triggerMapMechanism(player, 1)).toMatchObject({ success: true, activeRoute: 1, routeName: '潮汐探索线' });
    expect(state.mapRuntime.getNextOptions(12)).toEqual([84]);
  });

  it('preserves main-route locking through a save restore', () => {
    const { state, engine, player } = setup();
    engine.triggerMapMechanism(player, 0);
    const restored = new GameState({ seed: 1 });
    restored.restoreSnapshot(state.createSnapshot());
    expect(restored.mechanismState).toEqual({ activeRoute: 0, locked: true });
    expect(restored.mapRuntime.getNextOptions(12)).toEqual([13]);
  });

  it('reports route economics, facilities and current occupants', () => {
    const { state, player } = setup();
    state.players[1].currentTile = 84;
    state.propertyManager.buyProperty(13, player.id);
    const plans = getMechanismRoutePlans(state, player);
    expect(plans[0].ownProperties).toBe(1);
    expect(plans[0].ownTollPotential).toBeGreaterThan(0);
    expect(plans[1].playersOnRoute.map(candidate => candidate.name)).toContain('阿土伯');
    expect(plans.every(plan => plan.facilityCount > 0)).toBe(true);
  });

  it('keeps AI route choices actionable and aware of active locking', () => {
    const { state, engine } = setup();
    const ai = state.players[1];
    const first = chooseAIMechanismRoute(state, ai);
    expect(first.enabled).toBe(true);
    engine.triggerMapMechanism(ai, first.routeIndex);
    const next = chooseAIMechanismRoute(state, ai);
    expect(next.enabled).toBe(true);
    expect(next.routeIndex).not.toBe(first.routeIndex);
  });
});
