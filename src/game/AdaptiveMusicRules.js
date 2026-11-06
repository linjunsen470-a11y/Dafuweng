export const MUSIC_MOOD_PROFILES = Object.freeze({
  CALM: { id: 'CALM', label: '悠闲经营', intensity: 0.48, leadDensity: 0.52, percussion: 0.25, bassDrive: 0.72, filter: 5900 },
  DRIVE: { id: 'DRIVE', label: '财富竞逐', intensity: 0.72, leadDensity: 0.78, percussion: 0.62, bassDrive: 0.94, filter: 6800 },
  TENSION: { id: 'TENSION', label: '局势紧张', intensity: 0.88, leadDensity: 0.9, percussion: 0.82, bassDrive: 1.08, filter: 6100 },
  CRISIS: { id: 'CRISIS', label: '财务危机', intensity: 0.92, leadDensity: 0.68, percussion: 0.9, bassDrive: 1.16, filter: 3900 },
  FINALE: { id: 'FINALE', label: '终局决战', intensity: 1, leadDensity: 1, percussion: 1, bassDrive: 1.22, filter: 7600 }
});

const CRISIS_EVENTS = new Set(['DEBT_REQUIRED', 'PLAYER_BANKRUPT', 'MINE_EXPLODED', 'HOSPITALIZED', 'JAILED']);
const DRIVE_EVENTS = new Set(['PROPERTY_PURCHASED', 'PROPERTY_UPGRADED', 'RENT_PAID', 'CARD_USED', 'MAGIC_CAST', 'MINIGAME_COMPLETED']);

export function getAdaptiveMusicMood(context = {}) {
  const round = Math.max(1, Number(context.round) || 1);
  const maxRounds = Math.max(round, Number(context.maxRounds) || 40);
  const progress = round / maxRounds;
  if (context.phase === 'GAME_OVER' || context.gameOver) return 'FINALE';
  if (CRISIS_EVENTS.has(context.eventType) || context.phase === 'DEBT_SETTLEMENT' || context.pendingDebt) return 'CRISIS';
  if (progress >= 0.82 || (context.activePlayers || 4) <= 2) return 'FINALE';
  if (context.weather === 'STORM' || progress >= 0.6) return 'TENSION';
  if (context.gameMode === 'HEAT' || DRIVE_EVENTS.has(context.eventType) || progress >= 0.25) return 'DRIVE';
  return 'CALM';
}

export function getAdaptiveMusicProfile(context = {}) {
  const mood = getAdaptiveMusicMood(context);
  return { ...MUSIC_MOOD_PROFILES[mood], mood };
}
