// Existing grand-bay service frontages, never additional road connections.
const FACILITIES = [
  { id:102, type:'CARD_SHOP', model:'hill_supply_pavilion', x:24.3, z:-10.5, height:2.85, width:3.8, depth:3.2, title:'102 · 山路补给铺', detail:'点券换卡 / 道具', color:'#8f6247' },
  { id:99, type:'COMPANY', model:'company_summit_yard', x:36.5, z:-10.5, height:3.4, width:3.8, depth:3.2, title:'99 · 峰岳材料', detail:'服务费 · 股市董事会', color:'#8f6247' },
  { id:112, type:'BANK', model:'civic_bank', x:-29.8, z:-11.8, height:3.75, width:4.2, depth:3, title:'112 · 山径银行', detail:'现金与存款 · 自主调配', color:'#317d88' },
  { id:89, type:'COMPANY', model:'company_cloud_court', x:22, z:2.5, height:3.3, width:3.8, depth:3.2, title:'89 · 云端计算', detail:'到访服务费 · 董事长免付', color:'#317d88' },
  { id:79, type:'MECHANISM', model:'return_tide_gate', x:-48.3, z:12, height:3.9, width:3.4, depth:3.1, title:'79 · 潮汐机关塔', detail:'到访选路 · 查看岔路方案', color:'#317d88' },
  { id:82, type:'STOCK', model:'old_town_exchange', x:-47.8, z:22, height:4.2, width:4.2, depth:3, title:'82 · 返港交易所', detail:'到访看行情 · 掷骰前买卖', color:'#317d88' },
  { id:47, type:'CARD_SHOP', model:'market_clock_gallery', x:30, z:-41.5, height:3.7, width:3.2, depth:2.7, title:'47 · 钟楼卡片屋', detail:'到访补给 · 点券换卡', color:'#8f6247' },
  { id:109, type:'MINIGAME', model:'civic_arcade', x:-17, z:-27, height:2.75, width:3.6, depth:2.8, title:'109 · 云端游乐屋', detail:'点击挑战 · 按分兑奖', color:'#317d88' },
  { id:57, type:'BANK', model:'civic_bank', x:-10, z:-30.8, height:3.75, width:4.2, depth:3.0, title:'57 · 商务银行', detail:'现金与存款 · 自主调配', color:'#317d88' },
  { id:65, type:'CHANCE', model:'civic_notice', x:-42, z:-30.8, height:2.6, width:3.4, depth:2.75, title:'65 · 城市公告亭', detail:'落地抽事件 · 有得有失', color:'#317d88' },
  { id:32, type:'STOCK', model:'old_town_exchange', x:48.8, z:0, height:4.2, width:4.2, depth:3.0, title:'32 · 交易所', detail:'到访看行情 · 掷骰前买卖', color:'#8f6247' },
  { id: 7, type: 'CARD_SHOP', model: 'market_clock_gallery', x: -22, z: 23.2, height: 3.7, width: 3.2, depth: 2.7, title: '7 · 卡片屋', detail: '点券换卡 / 道具', color: '#aa684a' },
  { id: 9, type: 'LOTTERY', model: 'harbor_lottery', x: -14, z: 23.2, height: 2.5, width: 2.7, depth: 2.7, title: '9 · 乐透站', detail: '现金选号 · 开奖', color: '#ad6553' },
  { id: 12, type: 'BANK', model: 'harbor_bank', x: -3, z: 21.6, height: 3.2, width: 3.6, depth: 2.8, title: '12 · 银行', detail: '存取现金 · 分岔', color: '#337c75' },
];

export function harborFacility(map, tile) {
  return map?.id === 'grand-bay' ? FACILITIES.find(s => s.id === tile.id && s.type === tile.type) : undefined;
}

export function facilityFacing(tile, spec) {
  return Math.atan2(tile.position.x - spec.x, tile.position.z - spec.z);
}
