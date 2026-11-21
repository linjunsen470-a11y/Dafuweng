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
  // Sunny Richman-4 ceramic stepping stone with bold sunset-orange forward chevrons.
  ctx.save();
  // Warm drop shadow
  ctx.beginPath();
  ctx.arc(192, 198, 126, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(92, 54, 18, 0.34)';
  ctx.fill();

  // Outer warm terracotta-gold rim
  ctx.beginPath();
  ctx.arc(192, 190, 122, 0, Math.PI * 2);
  ctx.fillStyle = '#e07a32';
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#fff5d6';
  ctx.stroke();

  // Inner sunlit ivory ceramic pad
  ctx.beginPath();
  ctx.arc(192, 190, 102, 0, Math.PI * 2);
  const padGrad = ctx.createRadialGradient(170, 152, 14, 192, 190, 106);
  padGrad.addColorStop(0, '#fffef5');
  padGrad.addColorStop(0.68, '#ffefc8');
  padGrad.addColorStop(1, '#f0ce8c');
  ctx.fillStyle = padGrad;
  ctx.fill();

  // Glossy specular crescent
  ctx.save();
  ctx.beginPath();
  ctx.arc(192, 190, 96, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
  ctx.beginPath();
  ctx.ellipse(192, 118, 86, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Crisp double forward chevron (canvas +Y maps to +Z forward on BoxGeometry top face)
  const drawChevron = (tipY) => {
    ctx.beginPath();
    ctx.moveTo(192, tipY);
    ctx.lineTo(246, tipY - 48);
    ctx.lineTo(218, tipY - 48);
    ctx.lineTo(192, tipY - 24);
    ctx.lineTo(166, tipY - 48);
    ctx.lineTo(138, tipY - 48);
    ctx.closePath();
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#fff9e6';
    ctx.stroke();
    ctx.fillStyle = '#e65100';
    ctx.fill();
  };
  drawChevron(264);
  drawChevron(218);

  // Tile number pill at top
  drawRoundedRect(ctx, 144, 104, 96, 40, 20);
  ctx.fillStyle = '#7c3f12';
  ctx.fill();
  ctx.font = '900 28px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff8dc';
  ctx.fillText(String(tileData.id), 192, 125);
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

  // Solid outer ceramic bevel matching 3D block side walls (prevents hollow corners)
  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(255, 252, 236, 0.34)';
  ctx.fillRect(0, 0, size, 16);
  ctx.fillStyle = 'rgba(72, 38, 12, 0.22)';
  ctx.fillRect(0, size - 16, size, 16);

  // Outer thick glossy enamel bezel
  drawRoundedRect(ctx, 14, 14, size - 28, size - 28, 44);
  ctx.fillStyle = ownerCss || '#fff6d8';
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = ownerCss ? '#fff9e6' : frameColor;
  ctx.stroke();

  // Inner bright sunlit cream card face
  drawRoundedRect(ctx, 32, 32, size - 64, size - 64, 34);
  const cardGrad = ctx.createLinearGradient(0, 32, 0, size - 36);
  cardGrad.addColorStop(0, '#fffef7');
  cardGrad.addColorStop(1, '#ffefd0');
  ctx.fillStyle = cardGrad;
  ctx.fill();

  // Vibrant top color header bar (district or owner color)
  ctx.save();
  drawRoundedRect(ctx, 32, 32, size - 64, size - 64, 34);
  ctx.clip();
  ctx.fillStyle = frameColor;
  ctx.fillRect(32, 32, size - 64, 92);
  // Glossy candy top sheen
  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  ctx.fillRect(32, 32, size - 64, 30);
  ctx.restore();

  // Header badge text: stars if owned, or "商业地" / "#id" if vacant
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 36px "Noto Sans SC", sans-serif';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(54, 28, 10, 0.78)';
  const headerText = ownerCss
    ? (level > 0 ? '★'.repeat(Math.min(5, level)) : '⚑ 已购')
    : (isBig ? '★ 商业地' : `#${tileData.id}`);
  ctx.strokeText(headerText, 192, 80);
  ctx.fillStyle = ownerCss && level > 0 ? '#ffe45e' : '#ffffff';
  ctx.fillText(headerText, 192, 80);

  // Center house / commercial building glyph
  drawHouseGlyph(ctx, 192, 200, 1.2, frameColor, '#5a3312', isBig);

  // Bottom crisp price or street name pill
  const footerText = tileData.price ? `$${tileData.price.toLocaleString()}` : tileData.name.slice(0, 4);
  drawRoundedRect(ctx, 64, 274, 256, 56, 26);
  ctx.fillStyle = ownerCss ? frameColor : '#6e3c14';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255, 249, 224, 0.85)';
  ctx.stroke();
  ctx.font = '900 30px "Outfit", "Noto Sans SC", sans-serif';
  ctx.fillStyle = '#fff9df';
  ctx.fillText(footerText, 192, 303);
}

function drawSpecialTile(ctx, tileData, specLabel) {
  const theme = TILE_THEMES[tileData.type] || { bg: '#38bdf8', band: '#e0f2fe', icon: '★', label: specLabel || '事件', ink: '#ffffff' };
  const label = tileData.id === 30 && specLabel === '老城' ? '老城' : theme.label;
  const size = 384;

  // Solid warm gold ceramic bevel matching 3D block side walls
  ctx.fillStyle = '#e5a438';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(255, 252, 232, 0.4)';
  ctx.fillRect(0, 0, size, 16);
  ctx.fillStyle = 'rgba(84, 46, 12, 0.24)';
  ctx.fillRect(0, size - 16, size, 16);

  // Outer thick gold/cream frame
  drawRoundedRect(ctx, 14, 14, size - 28, size - 28, 46);
  ctx.fillStyle = theme.band;
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#6c4119';
  ctx.stroke();

  // Inner vivid candy surface
  drawRoundedRect(ctx, 32, 32, size - 64, size - 64, 34);
  ctx.fillStyle = theme.bg;
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

const specialTileTextureCache = new Map();

// Creates a high-contrast Richman-4 style board tile material usable on all 5 maps.
export function createRichTileMaterial(tileData, mapDefinition, { ownerColor = null, level = 0, anisotropy = 4 } = {}) {
  const spec = harborTileStyle(tileData);
  const visual = getTileVisualSpec(mapDefinition, tileData);
  const districtColor = (tileData.group && COLOR_GROUPS[tileData.group]?.color) || visual.accent;
  const clampedAniso = Math.min(4, anisotropy || 4);

  const isSpecial = tileData.type !== TileType.ROAD && !isPropertyTile(tileData);
  const specialKey = isSpecial ? `${tileData.type}|${tileData.id === 30 && spec.label === '老城' ? '老城' : ''}` : null;
  if (specialKey && specialTileTextureCache.has(specialKey)) {
    return new THREE.MeshStandardMaterial({
      map: specialTileTextureCache.get(specialKey),
      alphaTest: 0.35,
      roughness: 0.42,
      metalness: 0.04
    });
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.scale(256 / 384, 256 / 384);

  if (tileData.type === TileType.ROAD) {
    drawRoadMedallion(ctx, tileData);
  } else if (isPropertyTile(tileData)) {
    drawPropertyTile(ctx, tileData, districtColor, ownerColor, level);
  } else {
    drawSpecialTile(ctx, tileData, spec.label);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = clampedAniso;
  if (specialKey) {
    texture.userData.sharedBoardTexture = true;
    specialTileTextureCache.set(specialKey, texture);
  }
  return new THREE.MeshStandardMaterial({
    map: texture,
    alphaTest: 0.35,
    roughness: 0.42,
    metalness: 0.04
  });
}
