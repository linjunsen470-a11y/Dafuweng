import { COLOR_GROUPS, TileType } from './BoardData.js';

export const BOARD_THEME_PROFILES = Object.freeze({
  GRAND_BAY: { road: '#263746', shoulder: '#d7c89e', lane: '#d8f7ff', asphalt: '#233544', plinth: '#102636' },
  CITY: { road: '#303846', shoulder: '#e0b85c', lane: '#7dd3fc', asphalt: '#293442', plinth: '#131d2b' },
  ISLAND: { road: '#425968', shoulder: '#e6cf8a', lane: '#baf5f2', asphalt: '#354d5a', plinth: '#16303b' },
  TAIWAN: { road: '#3b4650', shoulder: '#dfbe72', lane: '#a7f3d0', asphalt: '#303f49', plinth: '#182832' },
  CROSSROADS: { road: '#344451', shoulder: '#d4ad60', lane: '#93e7ff', asphalt: '#2a3c48', plinth: '#132734' }
});

const TYPE_ACCENTS = Object.freeze({
  [TileType.START]: '#ffd166', [TileType.ROAD]: '#8fb4c1', [TileType.CHANCE]: '#22d3ee',
  [TileType.CARD_SHOP]: '#f472d0', [TileType.BANK]: '#f6c453', [TileType.STOCK]: '#45c5db',
  [TileType.HOSPITAL]: '#fb7185', [TileType.PRISON]: '#94a3b8', [TileType.LOTTERY]: '#fb923c',
  [TileType.MAGIC_HOUSE]: '#c084fc', [TileType.MECHANISM]: '#60a5fa', [TileType.COMPANY]: '#38bdf8',
  [TileType.MINIGAME]: '#f472b6', [TileType.COUPON]: '#facc15', [TileType.TREASURE]: '#fb923c',
  [TileType.MONSTER]: '#a78bfa', [TileType.GOD_FORTUNE]: '#fde047', [TileType.GOD_MISFORTUNE]: '#818cf8',
  [TileType.GOD_EARTH]: '#84cc16'
});

export function getBoardThemeProfile(theme = 'CITY') {
  return BOARD_THEME_PROFILES[theme] || BOARD_THEME_PROFILES.CITY;
}

export function getTileDistrict(mapDefinition, tile) {
  if (!mapDefinition?.districts?.length) return null;
  if (tile?.group) {
    const prefix = tile.group.split('_')[0];
    const byPrefix = { BAY: 0, OLD: 1, CBD: 2, HILL: 3 }[prefix];
    if (byPrefix !== undefined) return mapDefinition.districts[byPrefix] || null;
  }
  if (mapDefinition.theme === 'GRAND_BAY') {
    return mapDefinition.districts[Math.min(mapDefinition.districts.length - 1, Math.floor((Number(tile?.id) || 0) / 30))] || null;
  }
  return null;
}

export function getTileVisualSpec(mapDefinition, tile = {}) {
  const theme = getBoardThemeProfile(mapDefinition?.theme);
  const district = getTileDistrict(mapDefinition, tile);
  const groupColor = tile.group && COLOR_GROUPS[tile.group]?.color;
  const typeAccent = TYPE_ACCENTS[tile.type];
  const accent = groupColor
    || (tile.type === TileType.ROAD ? district?.color || typeAccent : typeAccent || district?.color)
    || '#8fb4c1';
  return {
    accent,
    districtId: district?.id || null,
    districtName: district?.name || '',
    road: theme.road,
    shoulder: theme.shoulder,
    lane: district?.color || theme.lane,
    asphalt: theme.asphalt,
    plinth: theme.plinth,
    isRoad: tile.type === TileType.ROAD,
    isFacility: [
      TileType.BANK, TileType.STOCK, TileType.CARD_SHOP, TileType.HOSPITAL, TileType.PRISON,
      TileType.LOTTERY, TileType.MAGIC_HOUSE, TileType.MECHANISM, TileType.COMPANY, TileType.MINIGAME
    ].includes(tile.type)
  };
}
