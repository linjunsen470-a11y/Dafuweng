import {isPropertyTile} from '../game/BoardData.js';

const LABELS={START:'起点',ROAD:'通行',CARD_SHOP:'卡片',BANK:'银行',LOTTERY:'乐透',STOCK:'股票',HOSPITAL:'医院',PRISON:'监狱',CHANCE:'事件',COUPON:'点券',TREASURE:'宝箱',MONSTER:'怪兽',MAGIC_HOUSE:'魔法',MECHANISM:'机关',COMPANY:'公司',MINIGAME:'挑战',GOD_FORTUNE:'福神',GOD_MISFORTUNE:'衰神',GOD_EARTH:'土地',GOD_BAD:'恶神',GOD_ANGEL:'天使',GOD_DEMON:'恶魔'};
export function harborTileStyle(tile){
 return {district:({OLD_1:'老街',OLD_2:'钟楼',OLD_3:'锦绣',CBD_1:'商务',CBD_3:'返港'}[tile.group]||''),label:tile.id===30?'老城':isPropertyTile(tile)?(tile.large?'商业':'地产'):(LABELS[tile.type]||'事件'),background:tile.type==='ROAD'?'#788b88':isPropertyTile(tile)?'#eef0db':'#fff0cf',ink:tile.type==='ROAD'?'#ffffff':'#233e40',fork:(tile.next||[]).length>1};
}
// Match the actual outgoing graph, including diagonals, without adding routes.
export function harborForkDirections(map){
 if(map?.id!=='grand-bay')return [];
 return map.tiles.filter(t=>t.next?.length>1).flatMap(from=>from.next.map(id=>{
  const to=map.tiles.find(t=>t.id===id),dx=to.position.x-from.position.x,dz=to.position.z-from.position.z,length=Math.hypot(dx,dz);
  return {from:from.id,to:id,x:from.position.x+dx/length*2.15,z:from.position.z+dz/length*2.15,dx:dx/length,dz:dz/length};
 }));
}
