/** Original chapter presentation over existing card commands and saved inventories. */
export const SLICE_TACTICS=[
 {id:'OBSTACLE',name:'施工围栏',symbol:'▥',detail:'在前后10格内放置一处围栏。下一位经过者停在该格，围栏随即移除；也会拦住自己，抵达后照常结算。'},
 {id:'CLEAR_ROAD',name:'清路工具包',symbol:'⌁',detail:'清除地图上一处施工围栏，保护接下来的路线。只清围栏，不处理地雷或其他路面事件。'},
 {id:'TURN_AROUND',name:'回程路签',symbol:'↶',detail:'选择自己或对手，反转其行走方向；不立即移动，方向持续到再次转向。可以避租，也可能错过目标。'},
 {id:'SWAP_STOPS',name:'换站风筝',symbol:'↔',detail:'与前后六格内一名自由行动对手互换站位，方向不变。不立即付租、领奖、交委托或触发路面事件；之后仍须普通掷骰。对方下回合可用回程路签、遥控骰子或再次换站反制。'},
 {id:'BORROW_PASS',name:'借道通行旗',symbol:'⚑',detail:'只为自己举旗，本回合免付对手地产租金；未遇租金也消耗。围栏仍会截停，其他事件费用照常。占用本回合策略机会，不能再遥控、换站或乘船；下次自己行动时失效，不影响对手后续收租。'},
];

/** Read-only presentation data, regenerated from current legal targets before use. */
export function tacticBoardView(session,id,selectedId=null){
 const offer=session.getTactics().find(t=>t.id===id);if(!offer||offer.useBlocked)return null;
 const playerTarget=['TURN_AROUND','SWAP_STOPS','BORROW_PASS'].includes(id);
 const targets=offer.targets.map((t,index)=>{const p=playerTarget?session.state.players[t.id]:null,tile=session.state.getTile(p?p.currentTile:t.id);
   return {...t,tileId:tile.id,x:tile.position.x+(p?(index-(session.state.players.length-1)/2)*.9:0),z:tile.position.z+(p?(index===1?-.7:.7):0),markerLabel:p?p.name:String(t.id),selected:String(t.id)===String(selectedId)};
 });
 const selected=targets.find(t=>t.selected)||null;
 const player=selected&&playerTarget?session.state.players[selected.id]:null;
 return {id,name:offer.name,targets,selected,playerTarget,path:player&&id==='TURN_AROUND'?session.state.mapRuntime.projectPath(player.currentTile,3,-(player.direction||1)):[]};
}
