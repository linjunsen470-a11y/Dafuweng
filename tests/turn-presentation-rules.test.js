import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { getArrivalBrief, getTurnBrief } from '../src/game/TurnPresentationRules.js';

function setup() {
  const state = new GameState({ seed: 1818 });
  state.setupGame([
    { name: '小满', profileIndex: 0, isAI: false },
    { name: '阿土伯', profileIndex: 1, isAI: true }
  ], 20000, { mapId: 'fortune-crossroads' });
  return { state, player: state.players[0], rival: state.players[1] };
}

describe('turn and arrival presentation rules', () => {
  it('builds a correct rank-aware turn brief from ranking entries', () => {
    const { state, player, rival } = setup();
    rival.cash += 10000;
    player.godType = 'FORTUNE';
    player.godTurns = 2;
    const brief = getTurnBrief(state, player);
    expect(brief).toMatchObject({ rank: 2, activeCount: 2, propertyCount: 0, objective: '寻找反超窗口' });
    expect(brief.statuses).toContainEqual(expect.objectContaining({ icon: '✨', tone: 'god' }));
  });

  it('distinguishes investment opportunities, own assets, and rent danger', () => {
    const { state, player, rival } = setup();
    expect(getArrivalBrief(state, player, 4, { kind: 'PURCHASE' })).toMatchObject({ title: '发现可投资地产', tone: 'opportunity', badge: 'LAND FOR SALE' });
    state.propertyManager.buyProperty(4, player.id);
    state.propertyManager.getProperty(4).level = 2;
    expect(getArrivalBrief(state, player, 4, { kind: 'UPGRADE' })).toMatchObject({ title: '返回自有地产', tone: 'owned' });
    state.propertyManager.buyProperty(4, rival.id);
    expect(getArrivalBrief(state, player, 4, { kind: 'RENT', owner: rival })).toMatchObject({ title: '进入对手收费区', tone: 'danger', badge: 'TOLL ZONE' });
  });

  it('gives authored arrival beats to high-frequency special facilities', () => {
    const { state, player } = setup();
    expect(getArrivalBrief(state, player, 9)).toMatchObject({ title: '卡片商店', tone: 'special' });
    expect(getArrivalBrief(state, player, 24)).toMatchObject({ title: '街机挑战场', tone: 'opportunity' });
    expect(getArrivalBrief(state, player, 5)).toMatchObject({ title: '怪兽出没区域', tone: 'danger' });
  });
});
