import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { MODE_PROFILES, applyModeCycleEffects, getModeOverview, getModeStartBonus } from '../src/game/ModeRules.js';

function setup(mode = 'STANDARD', count = 2) {
  const state = new GameState({ seed: 5510, maxRounds: mode === 'QUICK' ? 24 : mode === 'HEAT' ? 30 : 40 });
  state.setupGame(Array.from({ length: count }, (_, index) => ({ profileIndex: 5,
    name: `模式玩家 ${index + 1}`, isAI: index > 0, teamId: index % 2 })), 20000,
  { mode, mapId: 'city-loop', maxRounds: mode === 'QUICK' ? 24 : mode === 'HEAT' ? 30 : 40, teams: mode === 'TEAM' });
  return { state, engine: new GameEngine(state), player: state.players[0] };
}

function crossStart(state, engine, player) {
  player.currentTile = 31;
  const before = player.cash;
  engine.beginMove(player, 1);
  const result = engine.advanceMove(player);
  return { before, result };
}

describe('distinct game mode rules', () => {
  it('makes quick mode a high-income 24-round economy instead of only shortening the clock', () => {
    const { state, engine, player } = setup('QUICK');
    expect(state.maxRounds).toBe(24);
    expect(state.economicCycle.roundsPerPeriod).toBe(4);
    expect(getModeStartBonus(state, player, 2000)).toBe(3000);
    expect(engine.purchaseProperty(player, 1)).toMatchObject({ success: true, cost: 900 });
    expect(engine.upgradeProperty(player, 1)).toMatchObject({ success: true, cost: 540 });
    const crossing = crossStart(state, engine, player);
    expect(player.cash - crossing.before).toBe(3000);
    expect(crossing.result.events).toContainEqual(expect.objectContaining({ type: 'START_BONUS_GRANTED', amount: 3000 }));
  });

  it('shares a start dividend with a living teammate', () => {
    const { state, engine, player } = setup('TEAM', 4);
    const teammate = state.players[2];
    const teammateCash = teammate.cash;
    const crossing = crossStart(state, engine, player);
    expect(teammate.cash).toBe(teammateCash + 500);
    expect(crossing.result.events).toContainEqual(expect.objectContaining({ type: 'TEAM_START_DIVIDEND', playerId: teammate.id, amount: 500 }));
  });

  it('strengthens the challenge lord at start and on every economic cycle', () => {
    const { state } = setup('CHALLENGE', 4);
    const lord = state.players.find(player => player.isLord);
    expect(getModeStartBonus(state, lord, 2000)).toBe(2500);
    const cashBefore = lord.cash;
    const pointsBefore = lord.cardPoints;
    const events = applyModeCycleEffects(state);
    expect(events).toContainEqual(expect.objectContaining({ type: 'LORD_REINFORCED', playerId: lord.id, cash: 1750, cardPoints: 40 }));
    expect(lord.cash).toBe(cashBefore + 1750);
    expect(lord.cardPoints).toBe(pointsBefore + 40);
  });

  it('reduces passive start income in heat mode while retaining a 30-round target', () => {
    const { state, engine, player } = setup('HEAT');
    expect(state.maxRounds).toBe(30);
    const crossing = crossStart(state, engine, player);
    expect(player.cash - crossing.before).toBe(1000);
    expect(crossing.result.events).toContainEqual(expect.objectContaining({ type: 'START_BONUS_GRANTED', amount: 1000 }));
  });

  it('builds mode-specific standings for individuals, teams, and the lord confrontation', () => {
    const team = setup('TEAM', 4).state;
    const teamOverview = getModeOverview(team);
    expect(teamOverview).toMatchObject({ profile: { id: 'TEAM' }, standings: [{ active: 2 }, { active: 2 }] });
    expect(teamOverview.standings.every(entry => entry.members.length === 2)).toBe(true);

    const challenge = setup('CHALLENGE', 4).state;
    const challengeOverview = getModeOverview(challenge);
    expect(challengeOverview.standings.map(entry => entry.id).sort()).toEqual(['CHALLENGERS', 'LORD']);
    expect(challengeOverview.standings.find(entry => entry.id === 'CHALLENGERS').members).toHaveLength(3);
    expect(Object.keys(MODE_PROFILES)).toHaveLength(5);
  });

  it('migrates saved quick games to the current four-round economic cycle', () => {
    const { state } = setup('QUICK');
    const snapshot = state.createSnapshot();
    snapshot.economicCycle.roundsPerPeriod = 5;

    const restored = new GameState({ seed: 5511 });
    restored.restoreSnapshot(snapshot);

    expect(restored.gameMode).toBe('QUICK');
    expect(restored.economicCycle.roundsPerPeriod).toBe(4);
  });
});
