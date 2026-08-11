import { BOARD_TILES, TileType } from './BoardData.js';
import { GRAND_BAY_MAP } from './GrandMapData.js';

function loopPosition(index) {
  const step = 4.4;
  const inner = 15.4;
  const outer = 17.6;
  if (index < 8) return { x: inner - index * step, z: outer };
  if (index < 16) return { x: -outer, z: inner - (index - 8) * step };
  if (index < 24) return { x: -inner + (index - 16) * step, z: -outer };
  return { x: outer, z: -inner + (index - 24) * step };
}

export const CITY_LOOP_MAP = {
  id: 'city-loop',
  name: '霓虹财富城',
  spawnTile: 0,
  theme: 'CITY',
  musicId: 'city-day',
  tiles: BOARD_TILES.map((tile, index) => ({
    ...tile,
    ...({
      12: { type: TileType.COMPANY, name: '天际交通枢纽', icon: '🚝', companyId: 'SKY_TRANSIT', desc: '交通消费进入公司账本' },
      19: { type: TileType.BIG_PROPERTY, name: '霓虹中央广场', large: true, group: 'GOLD', price: 6200, buildCost: 3200, tolls: [900, 2700, 5900, 12600, 27400] },
      28: { type: TileType.MINIGAME, name: '夜光航线馆', icon: '🎮', minigameId: 'ROUTE_MEMORY', desc: '完成航线记忆挑战' }
    }[index] || {}),
    position: loopPosition(index),
    next: [(index + 1) % BOARD_TILES.length],
    previous: [(index - 1 + BOARD_TILES.length) % BOARD_TILES.length]
  }))
};

const islandNames = [
  '潮汐港起点', '椰林海岸', '贝壳市集', '珊瑚长堤', '海风奇遇', '灯塔湾', '海神祭坛', '双潮岔口',
  '西礁浅滩', '沉船水道', '东礁花园', '海豚水道', '月牙沙洲', '蓝洞旅店', '岛民神庙', '雨林木屋',
  '海岛诊所', '火山温泉', '迷雾礁群', '果香庄园', '星光卡片屋', '鲸歌海湾', '漂流奇遇', '棕榈夜市',
  '宝藏银行', '金色沙滩', '风暴神像', '云帆码头', '福星营地', '海景别墅', '群岛交易所', '潮声商店'
];

function islandPosition(index) {
  const angle = Math.PI / 2 - index / BOARD_TILES.length * Math.PI * 2;
  return { x: Math.cos(angle) * 24, z: Math.sin(angle) * 16 };
}

// Dedicated island geometry with a two-route reef fork and island-specific content labels.
export const ISLAND_FORK_MAP = {
  id: 'island-fork',
  name: '潮汐宝藏岛',
  spawnTile: 0,
  theme: 'ISLAND',
  musicId: 'island-breeze',
  tiles: BOARD_TILES.map((tile, index) => {
    let next = [(index + 1) % BOARD_TILES.length];
    if (index === 7) next = [8, 10];
    if (index === 9 || index === 11) next = [12];
    const forkPositions = {
      8: { x: -25, z: 4 },
      9: { x: -21, z: -1 },
      10: { x: -14, z: 7 },
      11: { x: -10, z: 2 },
      12: { x: -17, z: -7 }
    };
    return {
      ...tile,
      name: islandNames[index],
      ...({
        5: { type: TileType.BIG_PROPERTY, name: '灯塔度假区', large: true, group: 'GREEN', price: 4300, buildCost: 2400, tolls: [650, 1900, 4100, 8500, 18400] },
        13: { type: TileType.COMPANY, name: '峰岳材料码头', icon: '⛏️', companyId: 'SUMMIT_MATERIAL', desc: '岛屿材料运输形成公司收入' },
        23: { type: TileType.MINIGAME, name: '夜市分拣赛', icon: '🎮', minigameId: 'HARBOR_SORT', desc: '参加海岛分拣技巧赛' },
        27: { type: TileType.COMPANY, name: '蓝港保险站', icon: '🛟', companyId: 'HARBOR_INSURANCE', desc: '为远航旅客提供保险服务' }
      }[index] || {}),
      position: forkPositions[index] || islandPosition(index),
      next
    };
  })
};

// 3rd Map: Taiwan Loop (宝岛环岛图) with 40 tiles and landmark themes
export const TAIWAN_MAP = {
  id: 'taiwan-loop',
  name: '宝岛环岛图',
  spawnTile: 0,
  theme: 'TAIWAN',
  musicId: 'taiwan-folk',
  tiles: Array.from({ length: 40 }, (_, index) => {
    const baseTile = BOARD_TILES[index % BOARD_TILES.length];
    const step = 3.6;
    const offset = 18.0;
    let pos = { x: 0, z: 0 };
    if (index < 10) pos = { x: offset - index * step, z: offset };
    else if (index < 20) pos = { x: -offset, z: offset - (index - 10) * step };
    else if (index < 30) pos = { x: -offset + (index - 20) * step, z: -offset };
    else pos = { x: offset, z: -offset + (index - 30) * step };

    const taiwanNames = [
      '台北站起点', '西门町 1号', '卡片屋', '信义商圈 2号', '命运卡', '九份老街 3号', '财神送福', '淡水老街 1号',
      '帝国监狱', '阳明山 2号', '证券交易所', '日月潭 3号', '中央银行', '清境农场 1号', '土地公降临', '阿里山 2号',
      '圣玛丽医院', '台南古都 3号', '穷神降临', '安平古堡 1号', '高级卡片屋', '高雄港 2号', '命运卡', '六合夜市 3号',
      '皇家金库', '垦丁大街 1号', '衰神缠身', '台东池上 2号', '福神降临', '花莲太鲁阁 3号', '证券交易所', '宜兰温泉 4号',
      '基隆港 1号', '澎湖湾 2号', '卡片屋', '金门老街 3号', '命运卡', '绿岛风情 1号', '天使降临', '兰屿风光 2号'
    ];

    let next = [(index + 1) % 40];
    if (index === 9) next = [10, 12]; // Branch at Taichung
    if (index === 11) next = [13];
    if (index === 25) next = [26, 28]; // Branch at Kaohsiung
    if (index === 27) next = [29];

    return {
      ...baseTile,
      name: taiwanNames[index] || baseTile.name,
      ...({
        11: { type: TileType.COMPANY, name: '云端计算园', icon: '💻', companyId: 'CLOUD_COMPUTE', desc: '科技服务形成公司营收' },
        17: { type: TileType.BIG_PROPERTY, name: '古都文创园', large: true, group: 'PURPLE', price: 5200, buildCost: 2800, tolls: [760, 2250, 4900, 10300, 22300] },
        23: { type: TileType.MINIGAME, name: '港都金币赛', icon: '🎮', minigameId: 'SKY_COINS', desc: '参加限时金币技巧赛' },
        33: { type: TileType.COMPANY, name: '新星营造港', icon: '🏗️', companyId: 'NOVA_BUILD', desc: '海港工程收入进入公司账本' },
        39: { type: TileType.BIG_PROPERTY, name: '海风度假城', large: true, group: 'GOLD', price: 6500, buildCost: 3400, tolls: [980, 2900, 6300, 13400, 29000] }
      }[index] || {}),
      id: index,
      position: pos,
      next
    };
  })
};

const crossroadsPositions = [
  { x: 0, z: 13 }, { x: -5, z: 15 }, { x: -10, z: 15 }, { x: -15, z: 13 },
  { x: -18, z: 9 }, { x: -18, z: 4 }, { x: -11, z: 9 }, { x: -11, z: 4 },
  { x: -17, z: 0 }, { x: -17, z: -5 }, { x: -15, z: -10 }, { x: -12, z: -14 },
  { x: -7, z: -17 }, { x: -2, z: -17 }, { x: -7, z: -10 }, { x: -2, z: -10 },
  { x: 3, z: -16 }, { x: 8, z: -15 }, { x: 13, z: -13 }, { x: 16, z: -9 },
  { x: 18, z: -4 }, { x: 18, z: 1 }, { x: 11, z: -4 }, { x: 11, z: 1 },
  { x: 17, z: 6 }, { x: 16, z: 11 }, { x: 13, z: 15 }, { x: 8, z: 17 },
  { x: 3, z: 18 }, { x: -2, z: 18 }, { x: -4, z: 14 }, { x: -2, z: 10 }
];

const crossroadsNext = {
  3: [4, 6], 5: [8], 7: [8],
  11: [12, 14], 13: [16], 15: [16],
  19: [20, 22], 21: [24], 23: [24]
};

const crossroadsOverrides = {
  0: { name: '风铃港起点', icon: '🚩' },
  1: { name: '云杉空地', group: 'GREEN', price: 900, buildCost: 550, tolls: [120, 360, 820, 1800, 4000] },
  2: { type: TileType.COMPANY, name: '极光百货', icon: '🏬', companyId: 'AURORA_RETAIL', desc: '消费会形成公司营收，最大股东担任董事长' },
  3: { type: TileType.CHANCE, name: '西岔路口', icon: '↗️', desc: '选择山谷或集市路线' },
  4: { type: TileType.PROPERTY, name: '苔石空地', group: 'GREEN', price: 1200, buildCost: 700, tolls: [160, 480, 1050, 2300, 5100] },
  5: { type: TileType.MONSTER, name: '怪兽巢穴', icon: '👾', desc: '怪兽会夷平一栋最高级的对手建筑' },
  6: { type: TileType.GOD_FORTUNE, name: '福星花径', icon: '🌟', spirit: 'LUCK', cardReward: 1, desc: '福星赠送一张卡片并带来置业好运' },
  7: { type: TileType.COMPANY, name: '蓝港保险', icon: '🛟', companyId: 'HARBOR_INSURANCE', desc: '保险业务收入按经济周期向股东分红' },
  8: { type: TileType.PROPERTY, name: '潮汐空地', group: 'BLUE', price: 1700, buildCost: 950, tolls: [230, 700, 1600, 3300, 7200] },
  9: { type: TileType.CARD_SHOP, name: '风车卡片屋', icon: '🃏' },
  10: { type: TileType.PROPERTY, name: '灯塔空地', group: 'BLUE', price: 2100, buildCost: 1150, tolls: [310, 930, 2050, 4200, 9100] },
  11: { type: TileType.CHANCE, name: '南岔路口', icon: '↔️', desc: '选择滨海或森林路线' },
  12: { type: TileType.TREASURE, name: '宝箱海滩', icon: '🎁', desc: '随机获得现金、点券或卡片' },
  13: { type: TileType.PROPERTY, name: '珊瑚空地', group: 'BLUE', price: 2300, buildCost: 1250, tolls: [350, 1050, 2300, 4700, 10200] },
  14: { type: TileType.PROPERTY, name: '松果空地', group: 'PURPLE', price: 2500, buildCost: 1400, tolls: [390, 1180, 2550, 5100, 11200] },
  15: { type: TileType.COUPON, name: '森林点券站', icon: '🎟️', couponAmount: 30, desc: '获得 30 点卡片点券' },
  16: { type: TileType.BANK, name: '星河银行', icon: '🏦' },
  17: { type: TileType.PROPERTY, name: '月桂空地', group: 'PURPLE', price: 2900, buildCost: 1650, tolls: [460, 1380, 2900, 6000, 13200] },
  18: { type: TileType.BIG_PROPERTY, name: '新星未来城', icon: '🏙️', large: true, group: 'PURPLE', price: 4800, buildCost: 2600, tolls: [720, 2100, 4600, 9800, 21200], desc: '可建设五类商业设施' },
  19: { type: TileType.CHANCE, name: '东岔路口', icon: '↖️', desc: '选择矿谷或花园路线' },
  20: { type: TileType.PROPERTY, name: '金砂空地', group: 'GOLD', price: 3400, buildCost: 1950, tolls: [580, 1750, 3700, 7700, 16800] },
  21: { type: TileType.TREASURE, name: '矿谷宝箱', icon: '💎', desc: '随机获得现金、点券或卡片' },
  22: { type: TileType.GOD_FORTUNE, name: '大福星驿站', icon: '⭐', spirit: 'LUCK', cardReward: 2, desc: '大福星赠送两张卡片并带来置业好运' },
  23: { type: TileType.PROPERTY, name: '花冠空地', group: 'GOLD', price: 3900, buildCost: 2200, tolls: [680, 2050, 4300, 9100, 19800] },
  24: { type: TileType.MINIGAME, name: '港湾游乐场', icon: '🎮', minigameId: 'HARBOR_SORT', desc: '完成技巧挑战赢取点券' },
  25: { type: TileType.PROPERTY, name: '晴空空地', group: 'GOLD', price: 4500, buildCost: 2500, tolls: [790, 2400, 5000, 10600, 23000] },
  26: { type: TileType.STOCK, name: '云端交易所', icon: '📈' },
  27: { type: TileType.PROPERTY, name: '虹桥空地', group: 'GOLD', price: 5100, buildCost: 2850, tolls: [920, 2850, 6100, 13200, 28500] },
  28: { type: TileType.COMPANY, name: '新星营造', icon: '🏗️', companyId: 'NOVA_BUILD', desc: '城市建设消费会进入公司账本' },
  29: { type: TileType.PROPERTY, name: '星幕空地', group: 'PURPLE', price: 3200, buildCost: 1800, tolls: [520, 1550, 3300, 6900, 15100] },
  30: { type: TileType.HOSPITAL, name: '风铃诊所', icon: '🏥' },
  31: { type: TileType.COUPON, name: '港口点券箱', icon: '🎫', couponAmount: 10, desc: '获得 10 点卡片点券' }
};

// Original, genre-inspired map: three explicit route choices with matching rejoins.
export const FORTUNE_CROSSROADS_MAP = {
  id: 'fortune-crossroads',
  name: '福星岔路岛',
  spawnTile: 0,
  theme: 'CROSSROADS',
  musicId: 'fortune-crossroads',
  tiles: BOARD_TILES.map((tile, index) => {
    const mapped = {
      ...tile,
      ...crossroadsOverrides[index],
      id: index,
      position: crossroadsPositions[index],
      next: crossroadsNext[index] || [(index + 1) % BOARD_TILES.length]
    };
    if (![TileType.PROPERTY, TileType.BIG_PROPERTY].includes(mapped.type)) {
      delete mapped.group;
      delete mapped.price;
      delete mapped.buildCost;
      delete mapped.tolls;
    }
    return mapped;
  })
};

export { GRAND_BAY_MAP };

export const MAP_DEFINITIONS = [GRAND_BAY_MAP, FORTUNE_CROSSROADS_MAP, CITY_LOOP_MAP, ISLAND_FORK_MAP, TAIWAN_MAP];

export function getMapDefinition(mapId = CITY_LOOP_MAP.id) {
  return MAP_DEFINITIONS.find(map => map.id === mapId) || CITY_LOOP_MAP;
}
