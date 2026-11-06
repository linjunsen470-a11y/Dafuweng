import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { BANK_INTEREST_RATE, chooseAIBankTransfer, getBankCycleInfo, getBankTransferPreview } from '../src/game/BankRules.js';

function setup() {
  const state = new GameState({ seed: 1408 });
  state.setupGame([
    { name: '小满', profileIndex: 0, isAI: false },
    { name: '阿土伯', profileIndex: 1, isAI: true }
  ], 20000, { initialDeposit: 5000 });
  return { state, engine: new GameEngine(state), player: state.players[0] };
}

describe('bank asset-management model', () => {
  it('shares the production interest rate and cycle timing', () => {
    const { state } = setup();
    state.round = 3;
    expect(BANK_INTEREST_RATE).toBe(0.05);
    expect(getBankCycleInfo(state)).toMatchObject({ cycle: 5, roundsUntilSettlement: 2, period: 1 });
    state.round = 5;
    expect(getBankCycleInfo(state).roundsUntilSettlement).toBe(0);
  });

  it('previews deposit balances, yield gain and liquidity risk', () => {
    const { state, player } = setup();
    const stable = getBankTransferPreview(state, player, 'DEPOSIT', 10000);
    expect(stable).toMatchObject({ enabled: true, cashAfter: 10000, depositAfter: 15000, projectedInterest: 750, interestDelta: 500 });
    expect(stable.risk.id).toBe('STABLE');
    const critical = getBankTransferPreview(state, player, 'DEPOSIT', 19000);
    expect(critical).toMatchObject({ cashAfter: 1000, depositAfter: 24000 });
    expect(critical.risk.id).toBe('CRITICAL');
  });

  it('previews withdrawals and rejects unavailable balances', () => {
    const { state, player } = setup();
    expect(getBankTransferPreview(state, player, 'WITHDRAW', 3000)).toMatchObject({ enabled: true, cashAfter: 23000, depositAfter: 2000, projectedInterest: 100, interestDelta: -150 });
    expect(getBankTransferPreview(state, player, 'WITHDRAW', 9000)).toMatchObject({ enabled: false, reason: '存款不足' });
    expect(getBankTransferPreview(state, player, 'DEPOSIT', 0)).toMatchObject({ enabled: false, reason: '请输入大于零的金额' });
  });

  it('uses the preview result in the authoritative transfer command', () => {
    const { engine, player } = setup();
    expect(engine.bankTransfer(player, 'DEPOSIT', 7000)).toMatchObject({ success: true, cash: 13000, deposit: 12000, projectedInterest: 600, risk: 'STABLE' });
    expect(engine.bankTransfer(player, 'WITHDRAW', 2000)).toMatchObject({ success: true, cash: 15000, deposit: 10000, projectedInterest: 500 });
  });

  it('lets AI build reserves or restore liquidity according to its position', () => {
    const { state } = setup();
    const ai = state.players[1];
    ai.aiStrategy = 'ECONOMY';
    expect(chooseAIBankTransfer(state, ai)).toEqual({ direction: 'DEPOSIT', amount: 18000 });
    ai.cash = 2500;
    ai.deposit = 8000;
    expect(chooseAIBankTransfer(state, ai)).toEqual({ direction: 'WITHDRAW', amount: 3000 });
    ai.cash = 6000;
    expect(chooseAIBankTransfer(state, ai)).toBeNull();
  });
});
