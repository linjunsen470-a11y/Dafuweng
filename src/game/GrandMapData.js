import { COLOR_GROUPS, TileType } from './BoardData.js';

const MAIN_COUNT = 84;
const PROPERTY_OFFSETS = new Set([1, 3, 6, 8]);
const SPECIAL_OFFSETS = new Set([2, 5]);
const EXTRA_SPECIAL_IDS = new Set([7, 17, 27, 37, 47, 57, 67, 77]);
const BIG_PROPERTY_IDS = new Set([15, 35, 55, 75]);
const FACILITY_TYPES = new Map([
  [9, TileType.LOTTERY],
  [29, TileType.MAGIC_HOUSE],
  [49, TileType.LOTTERY],
  [69, TileType.MAGIC_HOUSE],
  [79, TileType.MECHANISM],
  [89, TileType.COMPANY],
  [99, TileType.COMPANY],
  [109, TileType.MINIGAME]
]);
const GROUP_IDS = [
  'BAY_1', 'BAY_2', 'BAY_3',
  'OLD_1', 'OLD_2', 'OLD_3',
  'CBD_1', 'CBD_2', 'CBD_3',
  'HILL_1', 'HILL_2', 'HILL_3'
];

const SPECIAL_SEQUENCE = [
  TileType.CHANCE, TileType.COUPON, TileType.CARD_SHOP, TileType.BANK,
  TileType.TREASURE, TileType.CHANCE, TileType.HOSPITAL, TileType.COUPON,
  TileType.STOCK, TileType.CHANCE, TileType.PRISON, TileType.TREASURE,
  TileType.CARD_SHOP, TileType.COUPON, TileType.BANK, TileType.MONSTER,
  TileType.CHANCE, TileType.TREASURE, TileType.HOSPITAL, TileType.COUPON,
  TileType.STOCK, TileType.GOD_FORTUNE, TileType.CHANCE, TileType.PRISON,
  TileType.CARD_SHOP, TileType.TREASURE, TileType.BANK, TileType.GOD_MISFORTUNE,
  TileType.CHANCE, TileType.COUPON, TileType.MONSTER, TileType.GOD_EARTH
];

const SPECIAL_META = {
  [TileType.CHANCE]: { name: '命运路牌', icon: '❓', desc: '触发一件随机事件' },
  [TileType.COUPON]: { name: '点券补给站', icon: '🎟️', couponAmount: 30, desc: '获得 30 点卡片点券' },
  [TileType.CARD_SHOP]: { name: '山海卡片屋', icon: '🃏', desc: '获得卡片点券补给' },
  [TileType.BANK]: { name: '山海银行', icon: '🏦', desc: '结算银行分红奖励' },
  [TileType.STOCK]: { name: '海湾交易所', icon: '📈', desc: '打开股票交易大厅' },
  [TileType.HOSPITAL]: { name: '阳光医院', icon: '🏥', desc: '休养生息 1 回合' },
  [TileType.PRISON]: { name: '海岛警署', icon: '🚔', desc: '探监或暂停 2 回合行动' },
  [TileType.TREASURE]: { name: '山海宝箱', icon: '🎁', desc: '随机获得现金、点券或卡片' },
  [TileType.MONSTER]: { name: '怪兽出没', icon: '👾', desc: '怪兽会夷平一栋最高级的对手建筑' },
  [TileType.GOD_FORTUNE]: { name: '福星驿站', icon: '🌟', spirit: 'LUCK', cardReward: 1, desc: '福星赠送卡片并带来置业好运' },
  [TileType.GOD_MISFORTUNE]: { name: '穷神巷口', icon: '👻', desc: '穷神可能在这里附身' },
  [TileType.GOD_EARTH]: { name: '土地公庙', icon: '⛰️', desc: '土地公会帮助占领沿途空地' }
};

function createMainPositions() {
  const positions = [];
  for (let i = 0; i < 26; i++) positions.push({ x: -50 + i * 4, z: 28 });
  for (let i = 0; i < 16; i++) positions.push({ x: 54, z: 24 - i * 4 });
  for (let i = 0; i < 26; i++) positions.push({ x: 50 - i * 4, z: -36 });
  for (let i = 0; i < 16; i++) positions.push({ x: -54, z: -32 + i * 4 });
  return positions;
}

const positions = [
  ...createMainPositions(),
  { x: 2, z: 24 }, { x: 6, z: 20 }, { x: 10, z: 16 }, { x: 14, z: 12 },
  { x: 18, z: 8 }, { x: 22, z: 8 }, { x: 26, z: 8 }, { x: 30, z: 8 },
  { x: 34, z: 12 }, { x: 38, z: 16 }, { x: 42, z: 20 }, { x: 46, z: 24 },
  { x: 50, z: -16 }, { x: 46, z: -16 }, { x: 42, z: -16 }, { x: 38, z: -16 },
  { x: 34, z: -16 }, { x: 30, z: -16 }, { x: 26, z: -16 }, { x: 22, z: -20 },
  { x: 22, z: -24 }, { x: 22, z: -28 }, { x: 22, z: -32 }, { x: 26, z: -32 },
  { x: -22, z: -32 }, { x: -22, z: -28 }, { x: -26, z: -24 }, { x: -30, z: -20 },
  { x: -34, z: -16 }, { x: -38, z: -12 }, { x: -42, z: -8 }, { x: -46, z: -8 },
  { x: -50, z: -8 }, { x: -50, z: -12 }, { x: -50, z: -16 }, { x: -50, z: -20 }
];

function nextFor(id) {
  if (id === 12) return [13, 84];
  if (id === 36) return [37, 96];
  if (id === 60) return [61, 108];
  if (id === 83) return [0];
  if (id >= 84 && id < 95) return [id + 1];
  if (id === 95) return [24];
  if (id >= 96 && id < 107) return [id + 1];
  if (id === 107) return [48];
  if (id >= 108 && id < 119) return [id + 1];
  if (id === 119) return [72];
  return [id + 1];
}

function previousForLot(id) {
  if (id === 0) return 83;
  if (id === 84) return 12;
  if (id === 96) return 36;
  if (id === 108) return 60;
  return id - 1;
}

function makeLot(id) {
  const current = positions[id];
  // Visual lot anchors only: the automatic normals overlap neighboring roads at these bends.
  const inset = {106:{x:17.4,z:-30},116:{x:-45.4,z:-3.4},118:{x:-45.4,z:-17}}[id];
  if (inset) return {position:inset,rotation:Math.atan2(current.x-inset.x,current.z-inset.z),size:{x:3.5,z:3.5}};
  const previous = positions[previousForLot(id)] || current;
  const next = positions[nextFor(id)[0]] || current;
  const dx = next.x - previous.x;
  const dz = next.z - previous.z;
  const length = Math.hypot(dx, dz) || 1;
  let nx = -dz / length;
  let nz = dx / length;
  if (id < MAIN_COUNT) {
    const radialX = current.x;
    const radialZ = current.z + 4;
    if (nx * radialX + nz * radialZ < 0) { nx *= -1; nz *= -1; }
  } else if (id % 2 === 0) {
    nx *= -1;
    nz *= -1;
  }
  return {
    position: { x: current.x + nx * 4.6, z: current.z + nz * 4.6 },
    rotation: Math.atan2(dx, dz),
    size: { x: 3.5, z: 3.5 }
  };
}

let specialIndex = 0;
const tiles = positions.map((position, id) => {
  const next = nextFor(id);
  if (id === 0) return { id, type: TileType.START, name: '山海启航站', icon: '🚩', desc: '经过或停留领取 $1,200', position, next };
  if (BIG_PROPERTY_IDS.has(id)) {
    const price = 5200 + Math.floor(id / 20) * 900;
    return {
      id,
      type: TileType.BIG_PROPERTY,
      name: ['海湾度假村', '锦绣购物中心', '星河连锁总部', '云顶主题乐园'][[...BIG_PROPERTY_IDS].indexOf(id)],
      icon: '🏨',
      desc: '可经营连锁商业的大型地产',
      price,
      buildCost: Math.round(price * 0.65 / 50) * 50,
      tolls: [0.22, 0.7, 1.6, 3.6, 7.8].map(multiplier => Math.round(price * multiplier / 10) * 10),
      position,
      lot: makeLot(id),
      next,
      large: true,
      buildingType: 'CHAIN_STORE'
    };
  }
  if (FACILITY_TYPES.has(id)) {
    const type = FACILITY_TYPES.get(id);
    const meta = {
      [TileType.LOTTERY]: { name: '山海乐透站', icon: '🎰', desc: '购买号码并参与每轮乐透开奖' },
      [TileType.MAGIC_HOUSE]: { name: '奇迹魔法屋', icon: '🔮', desc: '选择一项改变全局局势的魔法' },
      [TileType.MECHANISM]: { name: '潮汐机关塔', icon: '⚙️', desc: '切换本轮岛屿岔路通行方向' },
      [TileType.COMPANY]: id === 89
        ? { name: '云端计算', icon: '💻', companyId: 'CLOUD_COMPUTE', desc: '数字服务收入进入公司账本' }
        : { name: '峰岳材料', icon: '⛏️', companyId: 'SUMMIT_MATERIAL', desc: '材料业务收入进入公司账本' },
      [TileType.MINIGAME]: { name: '云端游乐场', icon: '🎮', minigameId: 'SKY_COINS', desc: '完成小游戏赢取点券' }
    }[type];
    return { id, type, ...meta, position, next };
  }
  const offset = id % 10;
  if (PROPERTY_OFFSETS.has(offset)) {
    const groupIndex = Math.floor(id / 10);
    const group = GROUP_IDS[groupIndex];
    const withinGroup = [...PROPERTY_OFFSETS].indexOf(offset);
    const districtTier = Math.floor(groupIndex / 3);
    const price = 1000 + districtTier * 850 + (groupIndex % 3) * 260 + withinGroup * 160;
    return {
      id,
      type: TileType.PROPERTY,
      name: `${COLOR_GROUPS[group].name} ${withinGroup + 1}号`,
      group,
      price,
      buildCost: Math.round(price * 0.56 / 50) * 50,
      tolls: [0.15, 0.45, 1, 2.2, 4.8].map(multiplier => Math.round(price * multiplier / 10) * 10),
      position,
      lot: makeLot(id),
      next
    };
  }
  if (SPECIAL_OFFSETS.has(offset) || EXTRA_SPECIAL_IDS.has(id)) {
    const type = SPECIAL_SEQUENCE[specialIndex++];
    return { id, type, ...SPECIAL_META[type], position, next };
  }
  return { id, type: TileType.ROAD, name: '山海道路', icon: '•', desc: '继续前进', position, next };
});

export const GRAND_BAY_MAP = {
  id: 'grand-bay',
  name: '山海都市岛',
  spawnTile: 0,
  theme: 'GRAND_BAY',
  musicId: 'grand-bay',
  defaultDiceCount: 2,
  passBonus: 1200,
  roadWidth: 2.8,
  tileSize: 2.25,
  bounds: { minX: -72, maxX: 72, minZ: -54, maxZ: 54 },
  camera: { center: { x: 0, z: -4 }, overviewDistance: 148, followHeight: 16, followDistance: 20 },
  districts: [
    { id: 'HARBOR', name: '碧蓝海港', color: '#27b6c7' },
    { id: 'OLD_TOWN', name: '锦绣老城', color: '#e6964d' },
    { id: 'CBD', name: '星河都市', color: '#6979e7' },
    { id: 'HILLS', name: '云顶田园', color: '#6ba956' }
  ],
  tiles
};
