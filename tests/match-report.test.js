import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { createMatchReport } from '../src/game/MatchReportRules.js';
import { normalizeMatchStatistics, recordMatchCommand } from '../src/game/MatchStatistics.js';

function game(mode = 'STANDARD') {
  const state = new GameState({ seed: 42 });
  state.setupGame([
    { name: '甲', profileIndex: 0, isAI: false, teamId: 0 },
    { name: '乙', profileIndex: 1, isAI: true, teamId: 1 },
    { name: '丙', profileIndex: 2, isAI: true, teamId: 0 },
    { name: '丁', profileIndex: 3, isAI: true, teamId: 1 }
  ], 20000, { mode, teams: mode === 'TEAM', mapId: 'city-loop' });
  return state;
}

describe('比赛统计与结算规则', () => {
  it('records serializable command statistics and restores V11', () => {
    const state = game();
    recordMatchCommand(state.matchStatistics, { playerId: 0, commandType: 'USE_CARD', result: { success: true }, cashBefore: 100, cashAfter: 350, round: 2 });
    expect(state.matchStatistics.players[0]).toMatchObject({ cardsUsed: 1, cashIn: 250 });
    const snapshot = state.createSnapshot();
    expect(snapshot.version).toBe(11);
    const restored = new GameState();
    restored.restoreSnapshot(snapshot);
    expect(restored.matchStatistics).toEqual(state.matchStatistics);
  });

  it('uses player id as the final deterministic tie breaker', () => {
    const state = game();
    state.players.forEach(player => { player.cash = 10000; player.deposit = 0; });
    expect(createMatchReport(state).rankings.map(row => row.player.id)).toEqual([0, 1, 2, 3]);
  });

  it('places the declared winning team first and emits all commercial awards', () => {
    const state = game('TEAM');
    state.winningTeamId = 1;
    state.winReason = 'LAST_TEAM';
    state.winner = state.players[1];
    const report = createMatchReport(state);
    expect(report.teams[0].id).toBe(1);
    expect(report.awards.map(award => award.id)).toEqual(['PROPERTY_KING', 'CASH_KING', 'CARD_MASTER', 'INVESTOR', 'BUSINESS_TYCOON']);
    expect(report.reasonLabel).toContain('队伍');
  });

  it('declares award ties and resolves recipients with the ranking comparator', () => {
    const state = game();
    state.players.forEach(player => { player.cash = 10000; player.deposit = 0; });
    const report = createMatchReport(state);
    const cashAward = report.awards.find(item => item.id === 'CASH_KING');
    expect(cashAward).toMatchObject({ playerId: 0, value: 10000, tieBroken: true, tiedPlayerIds: [0, 1, 2, 3] });
    expect(report.margin).toBe(0);
    expect(report.highlights[0]).toMatchObject({ icon: '🏆', round: null });
  });

  it('sanitizes malformed legacy counters instead of leaking invalid values', () => {
    const normalized = normalizeMatchStatistics({ players: [{ playerId: 0, cardsUsed: '-4', cashIn: '250', turns: 'oops', bankruptRound: 0 }] }, [{ id: 0 }]);
    expect(normalized.players[0]).toMatchObject({ cardsUsed: 0, cashIn: 250, turns: 0, bankruptRound: 1 });
  });

  it('gives old snapshots safe zero statistics', () => {
    const state = game();
    const legacy = { ...state.createSnapshot(), version: 10 };
    delete legacy.matchStatistics;
    delete legacy.matchConfig;
    const restored = new GameState();
    restored.restoreSnapshot(legacy);
    expect(restored.matchStatistics.players).toHaveLength(4);
    expect(restored.matchStatistics.players[0].rentIncome).toBe(0);
    expect(restored.matchConfig.playerConfigs).toHaveLength(4);
  });
});
