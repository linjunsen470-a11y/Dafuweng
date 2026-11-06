export const HARBOR_CARGO = [
  { icon: '🍌', name: '热带鲜果', bin: 'COLD' },
  { icon: '🧊', name: '冷链冰品', bin: 'COLD' },
  { icon: '🧸', name: '精品玩具', bin: 'GENERAL' },
  { icon: '📚', name: '城市图书', bin: 'GENERAL' },
  { icon: '⚗️', name: '实验试剂', bin: 'HAZARD' },
  { icon: '🔋', name: '能源电池', bin: 'HAZARD' },
  { icon: '🍍', name: '海岛菠萝', bin: 'COLD' },
  { icon: '🎮', name: '游戏设备', bin: 'GENERAL' },
  { icon: '🧪', name: '化工原料', bin: 'HAZARD' },
  { icon: '🥬', name: '高山蔬菜', bin: 'COLD' }
];

export const SKY_OBJECTS = [
  { kind: 'COIN', icon: '🪙', points: 10 },
  { kind: 'COIN', icon: '🪙', points: 10 },
  { kind: 'STAR', icon: '⭐', points: 20 },
  { kind: 'BOMB', icon: '💣', points: -15 },
  { kind: 'COIN', icon: '🪙', points: 10 },
  { kind: 'COIN', icon: '🪙', points: 10 },
  { kind: 'BOMB', icon: '💣', points: -15 },
  { kind: 'STAR', icon: '🌟', points: 20 }
];

export const ROUTE_PATTERNS = [
  [0, 2],
  [0, 2, 1],
  [0, 2, 1, 3],
  [0, 2, 1, 3, 2],
  [0, 2, 1, 3, 2, 0]
];

export const MINIGAME_RANKS = [
  { id: 'S', threshold: 90, icon: '🏆', label: '传奇大师', tone: 'legendary' },
  { id: 'A', threshold: 70, icon: '🥇', label: '金牌高手', tone: 'gold' },
  { id: 'B', threshold: 45, icon: '🥈', label: '银牌新星', tone: 'silver' },
  { id: 'C', threshold: 20, icon: '🥉', label: '铜牌选手', tone: 'bronze' },
  { id: 'D', threshold: 0, icon: '🎟️', label: '挑战者', tone: 'entry' }
];

export function clampMinigameScore(score, maxScore = 100) {
  return Math.max(0, Math.min(maxScore, Math.floor(Number(score) || 0)));
}

export function scoreHarborAttempt(score, correct) {
  return clampMinigameScore(score + (correct ? 10 : -5));
}

export function scoreSkyObject(score, points) {
  return clampMinigameScore(score + Number(points || 0));
}

export function scoreRouteRound(completedRounds) {
  return clampMinigameScore(Number(completedRounds || 0) * 20);
}

export function getMinigamePerformance(gameId, score) {
  const value = clampMinigameScore(score);
  const rank = MINIGAME_RANKS.find(item => value >= item.threshold) || MINIGAME_RANKS.at(-1);
  const nextRank = [...MINIGAME_RANKS].reverse().find(item => item.threshold > value) || null;
  return {
    gameId,
    score: value,
    reward: value * 2,
    rank,
    nextRank,
    pointsToNext: nextRank ? nextRank.threshold - value : 0,
    progress: value / 100
  };
}

export function getAIMinigameScore(gameId, difficulty, rng) {
  const ranges = {
    EASY: [28, 58],
    NORMAL: [48, 82],
    HARD: [68, 96]
  };
  const [minimum, maximum] = ranges[difficulty] || ranges.NORMAL;
  const gameAdjustment = gameId === 'ROUTE_MEMORY' ? -3 : gameId === 'HARBOR_SORT' ? 2 : 0;
  return clampMinigameScore(rng.int(minimum, maximum) + gameAdjustment);
}
