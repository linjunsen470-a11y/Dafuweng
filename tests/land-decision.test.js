import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/game/GameEngine.js';
import { GameState } from '../src/game/GameState.js';
import { isPropertyTile } from '../src/game/BoardData.js';
import { createLandDecisionModel } from '../src/ui/DialogUI.js';

function createGame() {
  const state = new GameState({ seed: 20260813 });
  state.setupGame([
    { profileIndex: 0, name: '林小满', isAI: false },
    { profileIndex: 1, name: '顾田野', isAI: true }
  ], 20000, { mapId: 'city-loop' });
  return { state, engine: new GameEngine(state), player: state.players[0] };
}

describe('land investment decision model', () => {
  it('uses the authoritative engine quote and exposes cash and rent projections', () => {
    const { state, engine, player } = createGame();
    const tile = state.mapDefinition.tiles.find(isPropertyTile);
    const quote = engine.getPropertyActionCost(player, tile.id, 'BUY');
    const model = createLandDecisionModel({ tileData: tile, player, state, action: 'BUY', quote });
    expect(quote).toBe(Math.round(tile.price * 0.85));
    expect(model).toMatchObject({ cost: quote, affordable: true, cash: 20000, cashAfter: 20000 - quote, currentLevel: 0, targetLevel: 0 });
    expect(model.rentGrowth).toHaveLength(5);
    expect(model.rentGrowth[4].value).toBeGreaterThan(model.rentGrowth[0].value);
    expect(model.paybackPasses).toBeGreaterThan(0);
  });

  it('previews a completed district and its doubled base rent', () => {
    const { state, engine, player } = createGame();
    const tile = state.mapDefinition.tiles.find(item => isPropertyTile(item) && item.group);
    const district = state.mapDefinition.tiles.filter(item => isPropertyTile(item) && item.group === tile.group);
    district.filter(item => item.id !== tile.id).forEach(item => state.propertyManager.buyProperty(item.id, player.id));
    const model = createLandDecisionModel({
      tileData: tile, player, state, action: 'BUY',
      quote: engine.getPropertyActionCost(player, tile.id, 'BUY')
    });
    expect(model).toMatchObject({ districtOwned: district.length, districtTotal: district.length, completesDistrict: true });
    expect(model.currentToll).toBe((tile.tolls[0] || 0) * 2);
  });

  it('marks unaffordable investments without producing negative remaining cash', () => {
    const { state, player } = createGame();
    const tile = state.mapDefinition.tiles.find(isPropertyTile);
    player.cash = 100;
    const model = createLandDecisionModel({ tileData: tile, player, state, action: 'UPGRADE', quote: 2400 });
    expect(model).toMatchObject({ affordable: false, cashAfter: 0, cost: 2400, targetLevel: 1 });
  });
});
