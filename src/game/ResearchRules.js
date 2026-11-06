import { ITEMS } from './ContentRegistry.js';
import { ITEM_CAPACITY } from './InventoryManager.js';
import { hasChairmanPerk } from './CompanyRules.js';

export const RESEARCH_PROJECT_META = {
  ROBOT_WORKER: { discipline: 'CONSTRUCTION', label: '城市建造', color: '#4ade80', tactical: '免费升级指定地产，快速形成高租金资产。' },
  TIME_MACHINE: { discipline: 'RECOVERY', label: '时序保障', color: '#c084fc', tactical: '恢复上回合状态，为高风险投资提供容错。' },
  TELEPORTER: { discipline: 'MOBILITY', label: '空间机动', color: '#38bdf8', tactical: '传送到任意道路，精确争夺设施与关键地块。' },
  ENGINEERING_CAR: { discipline: 'CONTROL', label: '工程压制', color: '#f59e0b', tactical: '连续拆除途经的敌方建筑，改变地产优势。' },
  NUCLEAR_MISSILE: { discipline: 'DESTRUCTION', label: '终局威慑', color: '#fb7185', tactical: '大范围摧毁建筑并使玩家住院的顶级科技。' }
};

export function getResearchProjectViews(state, player, tileId) {
  const property = state.propertyManager.getProperty(Number(tileId));
  const labLevel = property?.buildingType === 'LAB' ? property.level + 1 : 0;
  const activeTask = state.researchTasks.find(task => task.playerId === player.id && task.tileId === Number(tileId)) || null;
  const accelerated = hasChairmanPerk(state, player.id, 'TECH');
  const inventoryCount = player.items?.length || 0;
  return ITEMS.filter(item => item.researchLevel).map(item => {
    const unlocked = item.researchLevel <= labLevel;
    const rounds = Math.max(1, (item.researchRounds || 1) - (accelerated ? 1 : 0));
    let reason = '';
    if (!property || property.owner !== player.id || property.buildingType !== 'LAB') reason = '必须在自己的研究所研发';
    else if (!unlocked) reason = `需要研究所等级 ${item.researchLevel}`;
    else if (activeTask) reason = '研究所已有任务';
    else if (inventoryCount >= ITEM_CAPACITY) reason = '科技道具栏已满';
    const meta = RESEARCH_PROJECT_META[item.id] || { discipline: 'TECH', label: '实验科技', color: '#38bdf8', tactical: item.description };
    return {
      ...item,
      ...meta,
      labLevel,
      unlocked,
      enabled: !reason,
      reason,
      rounds,
      accelerated,
      active: activeTask?.itemId === item.id,
      activeTask,
      ownedCount: (player.items || []).filter(id => id === item.id).length,
      inventoryCount,
      inventoryCapacity: ITEM_CAPACITY,
      completesRound: state.round + rounds
    };
  });
}

export function getResearchProjectPreview(state, player, tileId, itemId) {
  return getResearchProjectViews(state, player, tileId).find(item => item.id === itemId) || null;
}

export function chooseAIResearchProject(state, player, tileId) {
  const strategyWeights = {
    PROPERTY: { ROBOT_WORKER: 70, ENGINEERING_CAR: 55, NUCLEAR_MISSILE: 35 },
    AGGRESSIVE: { NUCLEAR_MISSILE: 80, ENGINEERING_CAR: 65, TELEPORTER: 40 },
    ECONOMY: { TIME_MACHINE: 65, ROBOT_WORKER: 55, TELEPORTER: 30 },
    BALANCED: { TELEPORTER: 55, TIME_MACHINE: 45, ROBOT_WORKER: 40 }
  };
  const weights = strategyWeights[player.aiStrategy] || strategyWeights.BALANCED;
  return getResearchProjectViews(state, player, tileId)
    .filter(project => project.enabled)
    .sort((a, b) => ((weights[b.id] || b.researchLevel * 8) - b.ownedCount * 28)
      - ((weights[a.id] || a.researchLevel * 8) - a.ownedCount * 28)
      || b.researchLevel - a.researchLevel)[0] || null;
}
