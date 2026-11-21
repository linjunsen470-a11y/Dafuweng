import * as THREE from 'three';
import { COLOR_GROUPS, TileType, isPropertyTile } from '../game/BoardData.js';
import { getTileVisualSpec } from '../game/BoardVisualRules.js';
import { harborTileStyle } from './HarborBoardStyle.js';

const TILE_THEMES = {
  [TileType.START]: { bg: '#ff5252', band: '#ffd54f', icon: '🏁', label: '起点', ink: '#ffffff' },
  [TileType.BANK]: { bg: '#ffb300', band: '#fff3c4', icon: '🏦', label: '银行', ink: '#4a2600' },
  [TileType.STOCK]: { bg: '#00a896', band: '#d4fff5', icon: '📈', label: '股市', ink: '#ffffff' },
  [TileType.CARD_SHOP]: { bg: '#ec4899', band: '#ffe0f2', icon: '🃏', label: '商店', ink: '#ffffff' },
  [TileType.CHANCE]: { bg: '#ff8f00', band: '#fff3b0', icon: '❓', label: '命运', ink: '#ffffff' },
  [TileType.HOSPITAL]: { bg: '#fff8f6', band: '#ef4444', icon: '🏥', label: '医院', ink: '#b91c1c' },
  [TileType.PRISON]: { bg: '#64748b', band: '#f59e0b', icon: '⛓️', label: '监狱', ink: '#ffffff' },
  [TileType.LOTTERY]: { bg: '#f97316', band: '#fef08a', icon: '🎰', label: '乐透', ink: '#ffffff' },
  [TileType.MAGIC_HOUSE]: { bg: '#8b5cf6', band: '#f3e8ff', icon: '🔮', label: '魔法', ink: '#ffffff' },
  [TileType.MECHANISM]: { bg: '#2563eb', band: '#dbeafe', icon: '⚙️', label: '机关', ink: '#ffffff' },
  [TileType.COMPANY]: { bg: '#0284c7', band: '#e0f2fe', icon: '🏢', label: '公司', ink: '#ffffff' },
  [TileType.MINIGAME]: { bg: '#f43f5e', band: '#ffe4e6', icon: '🎮', label: '挑战', ink: '#ffffff' },
  [TileType.COUPON]: { bg: '#eab308', band: '#fef9c3', icon: '🎟️', label: '点券', ink: '#422006' },
  [TileType.TREASURE]: { bg: '#ea580c', band: '#ffedd5', icon: '💎', label: '宝箱', ink: '#ffffff' },
  [TileType.MONSTER]: { bg: '#7c3aed', band: '#ede9fe', icon: '🦊', label: '怪兽', ink: '#ffffff' },
  [TileType.GOD_FORTUNE]: { bg: '#facc15', band: '#fffbeb', icon: '✨', label: '福神', ink: '#713f12' },
  [TileType.GOD_MISFORTUNE]: { bg: '#6366f1', band: '#e0e7ff', icon: '⛈️', label: '衰神', ink: '#ffffff' },
  [TileType.GOD_EARTH]: { bg: '#65a30d', band: '#ecfccb', icon: '🍀', label: '土地', ink: '#ffffff' }
};

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawHouseGlyph(ctx, cx, cy, scale, fill, stroke, isBig) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  if (isBig) {
    // Twin-tower commercial badge silhouette
    ctx.beginPath();
    ctx.rect(-40, -18, 34, 52);
    ctx.rect(-2, -38, 42, 72);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff9db';
    for (const [wx, wy] of [[-30, -6], [-16, -6], [-30, 12], [-16, 12], [8, -24], [24, -24], [8, -6], [24, -6], [8, 12], [24, 12]]) {
      ctx.fillRect(wx, wy, 9, 10);
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(44, -4);
    ctx.lineTo(32, -4);
    ctx.lineTo(32, 34);
    ctx.lineTo(10, 34);
    ctx.lineTo(10, 10);
    ctx.lineTo(-10, 10);
    ctx.lineTo(-10, 34);
    ctx.lineTo(-32, 34);
    ctx.lineTo(-32, -4);
    ctx.lineTo(-44, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawRoadMedallion(ctx, tileData) {
  // Compact clean stepping-stone marker on dark warm asphalt so the path reads clearly.
  ctx.save();
  ctx.beginPath();
  ctx.arc(192, 192, 114, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(28, 35, 44, 0.55)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(192, 186, 104, 0, Math.PI * 2);
  ctx.fillStyle = '#fff5d6';
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#d49d46';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(192, 186, 84, 0, Math.PI * 2);
  ctx.fillStyle = '#4e6273';
  ctx.fill();

  // Crisp double forward arrow icon (canvas +Y maps to +Z forward on BoxGeometry top face)
  ctx.fillStyle = '#fff4c8';
  ctx.beginPath();
  ctx.moveTo(192, 246);
  ctx.lineTo(240, 198);
  ctx.lineTo(214, 198);
  ctx.lineTo(192, 220);
  ctx.lineTo(170, 198);
  ctx.lineTo(144, 198);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(192, 206);
  ctx.lineTo(240, 158);
  ctx.lineTo(214, 158);
  ctx.lineTo(192, 180);
  ctx.lineTo(170, 158);
  ctx.lineTo(144, 158);
  ctx.closePath();
  ctx.fill();

  ctx.font = '900 32px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#25313d';
  ctx.strokeText(String(tileData.id), 192, 130);
  ctx.fillStyle = '#fff7da';
  ctx.fillText(String(tileData.id), 192, 130);
  ctx.restore();
}

function toCssColor(value, fallback = '#f59e0b') {
  if (value == null) return fallback;
  if (typeof value === 'number') return '#' + value.toString(16).padStart(6, '0');
  return String(value);
}

function drawPropertyTile(ctx, tileData, districtColor, ownerColor, level) {
  const isBig = Boolean(tileData.large || tileData.type === TileType.BIG_PROPERTY);
  const ownerCss = ownerColor != null ? toCssColor(ownerColor) : null;
  const districtCss = toCssColor(districtColor, '#f59e0b');
  const frameColor = ownerCss || districtCss;
  const size = 384;

  // Soft drop shadow
  drawRoundedRect(ctx, 22, 28, size - 44, size - 44, 52);
  ctx.fillStyle = 'rgba(30, 22, 14, 0.36)';
  ctx.fill();

  // Outer crisp warm-white enamel bezel
  drawRoundedRect(ctx, 20, 18, size - 40, size - 40, 50);
  ctx.fillStyle = ownerCss || '#fff7e0';
  ctx.fill();
  ctx.lineWidth = 14;
  ctx.strokeStyle = ownerCss ? '#fff9e6' : frameColor;
  ctx.stroke();

  // Inner bright cream card face
  drawRoundedRect(ctx, 38, 36, size - 76, size - 76, 36);
  ctx.fillStyle = ownerCss ? '#fffdf3' : '#fff8e5';
  ctx.fill();

  // Vibrant top color header bar (district or owner color)
  ctx.save();
  drawRoundedRect(ctx, 38, 36, size - 76, size - 76, 36);
  ctx.clip();
  const headerGrad = ctx.createLinearGradient(0, 36, 0, 126);
  headerGrad.addColorStop(0, frameColor);
  headerGrad.addColorStop(1, frameColor);
  ctx.fillStyle = headerGrad;
  ctx.fillRect(38, 36, size - 76, 86);
  // Specular highlight strip on header
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(38, 36, size - 76, 26);
  ctx.restore();

  // Header badge text: stars if owned, or "商业地" / "#id" if vacant
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 36px "Noto Sans SC", sans-serif';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(42, 24, 10, 0.72)';
  const headerText = ownerCss
    ? (level > 0 ? '★'.repeat(Math.min(5, level)) : '⚑ 已购')
    : (isBig ? '★ 商业地' : `#${tileData.id}`);
  ctx.strokeText(headerText, 192, 82);
  ctx.fillStyle = ownerCss && level > 0 ? '#ffe45e' : '#ffffff';
  ctx.fillText(headerText, 192, 82);

  // Center house / commercial building glyph
  drawHouseGlyph(ctx, 192, 202, 1.18, frameColor, '#4d2e14', isBig);

  // Bottom crisp price or street name pill
  const footerText = tileData.price ? `$${tileData.price.toLocaleString()}` : tileData.name.slice(0, 4);
  drawRoundedRect(ctx, 72, 278, 240, 52, 24);
  ctx.fillStyle = ownerCss ? frameColor : '#5b391a';
  ctx.fill();
  ctx.font = '900 30px "Outfit", "Noto Sans SC", sans-serif';
  ctx.fillStyle = '#fff9df';
  ctx.fillText(footerText, 192, 305);
}

function drawSpecialTile(ctx, tileData, specLabel) {
  const theme = TILE_THEMES[tileData.type] || { bg: '#38bdf8', band: '#e0f2fe', icon: '★', label: specLabel || '事件', ink: '#ffffff' };
  const label = tileData.id === 30 && specLabel === '老城' ? '老城' : theme.label;
  const size = 384;

  // Drop shadow
  drawRoundedRect(ctx, 20, 26, size - 40, size - 40, 54);
  ctx.fillStyle = 'rgba(28, 20, 14, 0.42)';
  ctx.fill();

  // Outer thick gold/cream frame
  drawRoundedRect(ctx, 18, 16, size - 36, size - 36, 52);
  ctx.fillStyle = theme.band;
  ctx.fill();
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#6c4119';
  ctx.stroke();

  // Inner vivid candy surface
  drawRoundedRect(ctx, 36, 34, size - 72, size - 72, 38);
  const grad = ctx.createLinearGradient(0, 34, 0, size - 38);
  grad.addColorStop(0, theme.bg);
  grad.addColorStop(1, theme.bg);
  ctx.fillStyle = grad;
  ctx.fill();

  // Glossy top crescent
  ctx.save();
  drawRoundedRect(ctx, 36, 34, size - 72, size - 72, 38);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.26)';
  ctx.beginPath();
  ctx.ellipse(192, 54, 170, 68, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Large crisp icon
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 116px sans-serif';
  ctx.fillText(theme.icon, 192, 162);

  // High-contrast bold Chinese label pill
  drawRoundedRect(ctx, 64, 248, 256, 76, 30);
  ctx.fillStyle = 'rgba(42, 24, 10, 0.78)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255, 246, 208, 0.88)';
  ctx.stroke();

  ctx.font = '900 48px "Noto Sans SC", sans-serif';
  ctx.fillStyle = '#fff9df';
  ctx.fillText(label, 192, 288);
}

// Creates a high-contrast Richman-4 style board tile material usable on all 5 maps.
export function createRichTileMaterial(tileData, mapDefinition, { ownerColor = null, level = 0, anisotropy = 4 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 384;
  const ctx = canvas.getContext('2d');
  const spec = harborTileStyle(tileData);
  const visual = getTileVisualSpec(mapDefinition, tileData);
  const districtColor = (tileData.group && COLOR_GROUPS[tileData.group]?.color) || visual.accent;

  if (tileData.type === TileType.ROAD) {
    drawRoadMedallion(ctx, tileData);
  } else if (isPropertyTile(tileData)) {
    drawPropertyTile(ctx, tileData, districtColor, ownerColor, level);
  } else {
    drawSpecialTile(ctx, tileData, spec.label);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return new THREE.MeshStandardMaterial({
    map: texture,
    alphaTest: 0.35,
    roughness: 0.42,
    metalness: 0.04
  });
}
