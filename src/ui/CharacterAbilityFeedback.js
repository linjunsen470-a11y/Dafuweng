// Presentation only: authoritative charges remain in GameEngine.
export function rentAbility(player) {
  if (player?.skillName === '土地公庇护') return { multiplier: 1.2, label: '土地公庇护 · 地主租金 +20%' };
  if (player?.skillName === '皇家威严') return { multiplier: 1.25, label: '皇家威严 · 地主租金 +25%' };
  return { multiplier: 1, label: '' };
}
export function costAbilityNote(player, action, quote) {
  if (!(quote > 0) || player?.godType === 'LUCK' || player?.skillName !== '商业奇才') return '';
  return `商业奇才 · ${action === 'UPGRADE' ? '升级' : '购地'}85折，已计入报价`;
}
