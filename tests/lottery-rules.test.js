import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { chooseAILotteryNumbers, getLotteryOffer, getLotteryPurchasePreview } from '../src/game/LotteryRules.js';

function setup() {
  const state = new GameState({ seed: 1308 });
  state.setupGame([
    { name: '小满', profileIndex: 0, isAI: false },
    { name: '阿土伯', profileIndex: 1, isAI: true }
  ], 20000);
  return { state, engine: new GameEngine(state), player: state.players[0] };
}

describe('city lottery decision model', () => {
  it('exposes crowding, owned tickets, draw timing and cold-number recommendations', () => {
    const { state, player } = setup();
    state.round = 3;
    state.lottery.lastNumber = 8;
    state.lottery.tickets.push({ playerId: 1, number: 4 }, { playerId: 1, number: 4 }, { playerId: 0, number: 7 });
    const offer = getLotteryOffer(state, player);
    expect(offer).toMatchObject({ lastNumber: 8, ownNumbers: [7], totalTickets: 3, roundsUntilDraw: 2 });
    expect(offer.numbers[3]).toMatchObject({ number: 4, ticketCount: 2, rivalCount: 2, owned: false });
    expect(offer.recommendedNumbers).not.toContain(4);
    expect(offer.recommendedNumbers).not.toContain(7);
  });

  it('previews atomic multi-ticket cost, odds, jackpot and expected return', () => {
    const { state, player } = setup();
    const preview = getLotteryPurchasePreview(state, player, [1, 2, 3]);
    expect(preview).toMatchObject({ enabled: true, selections: [1, 2, 3], cost: 600, projectedPot: 2600, winChance: 0.3, expectedPayout: 780 });
    expect(getLotteryPurchasePreview(state, player, [1, 1])).toMatchObject({ enabled: false, reason: '每个号码本次只能选择一次' });
    expect(getLotteryPurchasePreview(state, player, [1, 2, 3, 4])).toMatchObject({ enabled: false, reason: '单次最多购买 3 张' });
  });

  it('blocks repeat ownership and purchases multiple tickets atomically', () => {
    const { state, engine, player } = setup();
    state.lottery.tickets.push({ playerId: player.id, number: 6 });
    expect(engine.buyLottery(player, [6])).toMatchObject({ success: false, reason: '本期不能重复购买已持有号码' });
    const before = player.cash;
    expect(engine.buyLottery(player, [2, 5, 9])).toMatchObject({ success: true, numbers: [2, 5, 9], cost: 600, pot: 2600, winChance: 0.3 });
    expect(player.cash).toBe(before - 600);
    expect(state.lottery.tickets.filter(ticket => ticket.playerId === player.id).map(ticket => ticket.number)).toEqual([6, 2, 5, 9]);
  });

  it('makes AI prefer uncrowded, unowned and affordable numbers', () => {
    const { state } = setup();
    const ai = state.players[1];
    state.lottery.tickets.push({ playerId: 0, number: 1 }, { playerId: ai.id, number: 2 });
    expect(chooseAILotteryNumbers(state, ai, 2)).toEqual([3, 4]);
    ai.cash = 200;
    expect(chooseAILotteryNumbers(state, ai, 3)).toEqual([3]);
  });
});
