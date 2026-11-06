import { TileType } from '../game/BoardData.js';

export const COAST_REGIONS = [
  { id:'HARBOR',name:'晨光港口',color:'#d9a174',tileColor:'#f3dfc9',description:'低价住宅 · 搬运赚现金，也可筹资出海或购入点券。' },
  { id:'MARKET',name:'灯塔商街',color:'#7caec2',tileColor:'#d8e8ed',description:'中档住宅与市集 · 用点券换现金，或参与夜市合伙。' },
  { id:'GARDEN',name:'林间艺坊',color:'#86a87a',tileColor:'#e1ead6',description:'高价住宅 · 育苗、交换与委托延期，兼顾周转和目标。' }
];
export const coastRegion = tileId => COAST_REGIONS[Math.floor(Number(tileId)/8)] || COAST_REGIONS[0];

/** Isolated coastal chapter. It is not added to the legacy five-map picker. */
export const SHANHAI_COAST_MAP = {
  id: 'shanhai-coast', name: '山海都市岛 · 蓝湾海岸', theme: 'ISLAND',
  spawnTile: 0, musicId: 'saltwind-promenade', passBonus: 2000,
  tiles: Array.from({ length: 24 }, (_, id) => {
    const names = ['蓝湾出发站', '晨光小屋', '贝壳花园', '海盐面包坊', '漂流信笺', '风帆公寓',
      '珊瑚巷', '潮声书屋', '海风补给', '灯塔别院', '海湾奇遇', '落日茶舍',
      '蓝湾市集', '青石小院', '白帆旅居', '栈桥人家', '远方来信', '云朵画室',
      '潮汐宝箱', '海棠小楼', '林间补给', '望海居', '岛屿奇遇', '渔火小馆'];
    const angle = Math.PI * 0.75 - id / 24 * Math.PI * 2;
    const position = { x: Math.round((14 + Math.sin(id * 1.7) * 0.7) * Math.cos(angle) * 100) / 100,
      z: Math.round((10 + Math.cos(id * 1.1) * 0.5) * Math.sin(angle) * 100) / 100 };
    const base = { id, name: names[id], position, next: [(id + 1) % 24], previous: [(id + 23) % 24], region: 'BAY' };
    if (id === 0) return { ...base, type: TileType.START, icon: '⚑', desc: '每次经过领取 $2,000 航程奖励' };
    if ([4, 10, 16, 22].includes(id)) return { ...base, type: TileType.CHANCE, icon: '✦', desc: `${coastRegion(id).name}的海岛来信：停靠后选择方案，先看成本与风险再决定。` };
    if ([8, 20].includes(id)) return { ...base, type: TileType.COUPON, couponAmount: 30, icon: '✧', desc: '领取 30 点券' };
    if (id === 18) return { ...base, type: TileType.TREASURE, icon: '◇', desc: '发现现金、点券或卡片' };
    if (id === 12) return { ...base, type: TileType.BIG_PROPERTY, large: true, group: 'BAY_3', price: 3200, buildCost: 1200, tolls: [350, 700, 1200, 1900, 3000], desc: '商业市集：访客消费后获得 15 + 等级 × 10 点券' };
    const band = Math.floor(id / 8);
    return { ...base, type: TileType.PROPERTY, group: ['BAY_1', 'BAY_2', 'BAY_3'][band], price: 1200 + band * 400, buildCost: 600 + band * 200, tolls: [150 + band * 50, 400 + band * 100, 800 + band * 150, 1400 + band * 200, 2300 + band * 300], desc: '从空地到海湾地标，共五个建筑阶段' };
  })
};

export const SLICE_CHARACTERS = [
  { id: 'ayu', name: '阿屿', role: '海岛快递员', description: '把沿途的风景，送到每个人身边。', skillName: '顺风速递', skillDesc: '完成速递委托额外获得 ¥300。', color: '#f5816c', colorHex: 0xf5816c, avatar: '🧢' },
  { id: 'qinghe', name: '青禾', role: '植物学家', description: '让每一座小屋，都长出自己的春天。', skillName: '街区园艺师', skillDesc: '完成焕新委托额外获得 ¥300。', color: '#42b8a6', colorHex: 0x42b8a6, avatar: '🌿' },
  { id:'xingluo',name:'星罗',role:'地图测绘师',description:'把陌生的道路，画成下一步的选择。',skillName:'行路制图',skillDesc:'每三轮可花 ¥500 制作一张遥控骰子；已有时不能制作，无委托加成。',color:'#8b72ba',colorHex:0x8b72ba,avatar:'🧭' },
  {id:'taoning',name:'陶宁',role:'街区修缮师',description:'把工具备好，让路和街坊都顺一点。',skillName:'随身工坊',skillDesc:'每三轮可用20点券制作一份清路工具包；已有时不重复制作，无委托加成。',color:'#c58a38',colorHex:0xc58a38,avatar:'🔧'}
];

export const HIGHLAND_REGIONS = [
  {id:'HARBOR',name:'枫林驿路',color:'#c38c47',tileColor:'#e9cf9f',description:'低价茶农住宅 · 收茶、修路与驿站周转。'},
  {id:'MARKET',name:'陶窑街市',color:'#b96c50',tileColor:'#e9c2a8',description:'中档商住 · 窑火集市和手作经营。'},
  {id:'GARDEN',name:'云台茶坡',color:'#7e8e54',tileColor:'#d7dfad',description:'高价山居 · 16号可采茶赚钱，或付¥250转向返程；22号承运茶箱。'}
];
const highlandNames=['枫谷驿站','茶农小院','石桥客舍','枫叶书屋','驿路来信','青瓦茶舍','晒茶小楼','古道民居','山路补给','陶工小院','窑场来信','柴窑茶馆','枫谷集会所','陶艺公寓','红砖工坊','山集小楼','茶坡来信','云台山居','林间宝箱','茶田别院','林场储蓄亭','望山小筑','山林来信','归谷茶楼'];
// A rounded rectangular mountain circuit, with a different geographic route from the coast.
const highlandRoute=[[-13,9],[-8,9],[-3,9],[2,9],[7,9],[12,9],[15,7],[15,3],[15,-1],[15,-5],[15,-9],[15,-13],[11,-13],[6,-13],[1,-13],[-4,-13],[-9,-13],[-14,-13],[-16,-9],[-16,-5],[-16,-1],[-16,3],[-16,7],[-16,11]];
export const SHANHAI_HIGHLAND_MAP = {
 id:'shanhai-highland',name:'山海都市岛 · 枫谷山城',theme:'HIGHLAND',spawnTile:0,musicId:'maple-tea-waltz',passBonus:2000,
 tiles:SHANHAI_COAST_MAP.tiles.map((t,id)=>{
  const band=Math.floor(id/8),base={...t,name:highlandNames[id],position:{x:highlandRoute[id][0],z:highlandRoute[id][1]},next:[(id+1)%24],previous:[(id+23)%24],region:'HIGHLAND',group:t.group?`VALLEY_${band}`:undefined};
  if(t.type===TileType.PROPERTY)Object.assign(base,{price:1000+band*600,buildCost:500+band*250,tolls:[130+band*80,350+band*160,720+band*230,1250+band*330,2100+band*430],desc:'山城地产：可购买与升级，参考租金随物价与产权变化。'});
  if(t.type===TileType.BIG_PROPERTY)Object.assign(base,{price:3400,buildCost:1400,tolls:[380,760,1300,2100,3300],desc:'山集经营：可选商场收租或花园带动邻地。'});
  if(t.type===TileType.CHANCE)base.desc='山城来信：停靠后选择方案，先看费用与风险。';
  if(id===20)base.desc='领取原有30点券；实际停靠后，可在石木储蓄亭存入现金或取出存款。存款按原五轮结息规则计算。';
  if(id===0)base.desc='经过驿站领取 ¥2,000，新一圈继续经营。';
  return base;
 })
};
export const SLICE_MAPS=[SHANHAI_COAST_MAP,SHANHAI_HIGHLAND_MAP];
export const sliceMap=id=>SLICE_MAPS.find(m=>m.id===id);
export const sliceRegions=mapId=>mapId===SHANHAI_HIGHLAND_MAP.id?HIGHLAND_REGIONS:COAST_REGIONS;
export const sliceRegion=(id,mapId)=>sliceRegions(mapId)[Math.floor(Number(id)/8)]||sliceRegions(mapId)[0];
export const sliceSaveKey=mapId=>`${mapId}:save:v1`;

/** Seat order shared by the welcome preview and actual game; old callers stay two-player. */
export function sliceCast(characterId='ayu',opponentId=null,playerCount=2){
 const first=SLICE_CHARACTERS.find(c=>c.id===characterId)||SLICE_CHARACTERS[0];
 const other=SLICE_CHARACTERS.find(c=>c.id===opponentId&&c.id!==first.id)||SLICE_CHARACTERS.find(c=>c.id!==first.id);
 const count=[2,3,4].includes(Number(playerCount))?Number(playerCount):2;return [first,other,...SLICE_CHARACTERS.filter(c=>c!==first&&c!==other)].slice(0,count);
}
