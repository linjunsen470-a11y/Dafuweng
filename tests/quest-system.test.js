import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { advanceQuestsForEvent, processQuestDeadlines, startQuest } from '../src/game/QuestRules.js';

const configs = [
  { profileIndex: 0, name: '小满', isAI: false },
  { profileIndex: 1, name: '阿土伯', isAI: true }
];

function createGame() {
  const state = new GameState({ seed: 20260812, maxRounds: 30 });
  state.setupGame(configs, 20000);
  return { state, engine: new GameEngine(state), player: state.players[0] };
}

describe('continuous city quests', () => {
  it('starts a fate quest and extends an already active copy', () => {
    const { state, engine, player } = createGame();
    const started = engine.resolveChanceEffect(player, { kind: 'QUEST', questId: 'CITY_TOUR', title: '环城观光委托' });
    expect(started).toMatchObject({ success: true, type: 'QUEST_STARTED', definitionId: 'CITY_TOUR', progress: 0, target: 1 });
    const expiry = state.activeQuests[0].expiresRound;
    expect(engine.resolveChanceEffect(player, { kind: 'QUEST', questId: 'CITY_TOUR' })).toMatchObject({ type: 'QUEST_EXTENDED', expiresRound: expiry + 1 });
    expect(state.activeQuests).toHaveLength(1);
  });

  it('tracks purchases through the engine event stream and pays completion rewards', () => {
    const { state, engine, player } = createGame();
    startQuest(state, player, 'PROPERTY_INVESTOR');
    const beforeCash = player.cash;
    player.currentTile = 1;
    state.phase = 'LANDING_ACTION';

    const purchased = engine.execute({ type: 'PURCHASE_PROPERTY', playerId: player.id, payload: { tileId: 1 } });
    expect(purchased.success).toBe(true);
    expect(state.activeQuests[0].progress).toBe(1);
    const upgraded = engine.execute({ type: 'UPGRADE_PROPERTY', playerId: player.id, payload: { tileId: 1 } });

    expect(upgraded.events).toContainEqual(expect.objectContaining({ type: 'QUEST_COMPLETED', definitionId: 'PROPERTY_INVESTOR' }));
    expect(state.activeQuests).toHaveLength(0);
    expect(state.questHistory[0]).toMatchObject({ status: 'COMPLETED', progress: 2 });
    expect(player.cash).toBe(beforeCash - purchased.cost - upgraded.cost + 2200);
    expect(player.cardPoints).toBe(170);
  });

  it('counts only distinct eligible landmark tiles', () => {
    const { state, player } = createGame();
    startQuest(state, player, 'LANDMARK_ROUTE');
    expect(advanceQuestsForEvent(state, { type: 'PLAYER_STEPPED', playerId: player.id, tileId: 2 })).toHaveLength(1);
    expect(advanceQuestsForEvent(state, { type: 'PLAYER_STEPPED', playerId: player.id, tileId: 2 })).toHaveLength(0);
    expect(advanceQuestsForEvent(state, { type: 'PLAYER_STEPPED', playerId: player.id, tileId: 1 })).toHaveLength(0);
    advanceQuestsForEvent(state, { type: 'PLAYER_STEPPED', playerId: player.id, tileId: 10 });
    const completed = advanceQuestsForEvent(state, { type: 'PLAYER_STEPPED', playerId: player.id, tileId: 12 });
    expect(completed.at(-1)).toMatchObject({ type: 'QUEST_COMPLETED', progress: 3 });
  });

  it('fails expired quests with a bounded points penalty', () => {
    const { state, player } = createGame();
    const started = startQuest(state, player, 'CARD_TACTIC');
    state.round = started.expiresRound + 1;
    player.cardPoints = 10;
    const events = processQuestDeadlines(state);
    expect(events).toEqual([expect.objectContaining({ type: 'QUEST_FAILED', penaltyPoints: 10 })]);
    expect(player.cardPoints).toBe(0);
    expect(state.questHistory[0].status).toBe('FAILED');
  });

  it('round-trips active and resolved quest state in saves', () => {
    const { state, player } = createGame();
    startQuest(state, player, 'CITY_TOUR');
    startQuest(state, player, 'CARD_TACTIC');
    advanceQuestsForEvent(state, { type: 'CARD_USED', playerId: player.id, cardId: 'REMOTE_DICE' });
    const restored = new GameState({ seed: 1 });
    restored.restoreSnapshot(state.createSnapshot());
    expect(restored.activeQuests).toEqual(state.activeQuests);
    expect(restored.questSequence).toBe(2);
  });
});
