import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { ITEM_CAPACITY } from '../src/game/InventoryManager.js';
import { chooseAIResearchProject, getResearchProjectPreview, getResearchProjectViews } from '../src/game/ResearchRules.js';

function setup() {
  const state = new GameState({ seed: 1608 });
  state.setupGame([
    { name: '小满', profileIndex: 0, isAI: false },
    { name: '阿土伯', profileIndex: 1, isAI: true }
  ], 30000, { mapId: 'fortune-crossroads' });
  const player = state.players[0];
  state.propertyManager.buyProperty(18, player.id, 'LAB');
  return { state, engine: new GameEngine(state), player, tileId: 18 };
}

describe('research laboratory decision model', () => {
  it('maps five authored technologies onto the laboratory level tree', () => {
    const { state, player, tileId } = setup();
    const projects = getResearchProjectViews(state, player, tileId);
    expect(projects).toHaveLength(5);
    expect(projects.map(project => project.researchLevel)).toEqual([1, 2, 3, 4, 5]);
    expect(projects[0]).toMatchObject({ id: 'ROBOT_WORKER', unlocked: true, enabled: true, labLevel: 1, rounds: 1 });
    expect(projects[1]).toMatchObject({ id: 'TIME_MACHINE', unlocked: false, enabled: false, reason: '需要研究所等级 2' });
    projects.forEach(project => expect(project.tactical.length).toBeGreaterThan(12));
  });

  it('unlocks advanced tiers and applies chairman acceleration', () => {
    const { state, player, tileId } = setup();
    state.propertyManager.getProperty(tileId).level = 4;
    const techCompany = state.companyManager.companies.find(company => company.perk === 'TECH');
    techCompany.chairmanId = player.id;
    const nuclear = getResearchProjectPreview(state, player, tileId, 'NUCLEAR_MISSILE');
    expect(nuclear).toMatchObject({ unlocked: true, enabled: true, researchLevel: 5, rounds: 3, accelerated: true });
  });

  it('blocks guaranteed delivery loss when the technology inventory is full', () => {
    const { state, engine, player, tileId } = setup();
    player.items = Array(ITEM_CAPACITY).fill('BARRIER');
    expect(getResearchProjectPreview(state, player, tileId, 'ROBOT_WORKER')).toMatchObject({ enabled: false, reason: '科技道具栏已满' });
    expect(engine.startResearch(player, tileId, 'ROBOT_WORKER')).toMatchObject({ success: false, reason: '科技道具栏已满' });
    expect(state.researchTasks).toHaveLength(0);
  });

  it('marks an active queue and prevents a second project on the same laboratory', () => {
    const { state, engine, player, tileId } = setup();
    expect(engine.startResearch(player, tileId, 'ROBOT_WORKER')).toMatchObject({ success: true, itemName: '建筑机器人', discipline: '城市建造', completesRound: 2 });
    const projects = getResearchProjectViews(state, player, tileId);
    expect(projects[0]).toMatchObject({ active: true, enabled: false, reason: '研究所已有任务' });
    expect(projects.every(project => !project.enabled)).toBe(true);
  });

  it('lets AI choose useful unlocked projects instead of the last list item', () => {
    const { state, player, tileId } = setup();
    state.propertyManager.getProperty(tileId).level = 4;
    player.aiStrategy = 'PROPERTY';
    expect(chooseAIResearchProject(state, player, tileId).id).toBe('ROBOT_WORKER');
    player.items.push('ROBOT_WORKER', 'ROBOT_WORKER', 'ROBOT_WORKER');
    expect(chooseAIResearchProject(state, player, tileId).id).toBe('ENGINEERING_CAR');
    player.aiStrategy = 'AGGRESSIVE';
    expect(chooseAIResearchProject(state, player, tileId).id).toBe('NUCLEAR_MISSILE');
  });
});
