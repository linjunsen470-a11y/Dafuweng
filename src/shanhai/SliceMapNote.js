/** A repeatable, cosmetic route-reading interaction. No RNG, rewards or save fields. */
export function mountainMapNote(session,reverse=false){
 if(session.mapId!=='shanhai-highland'||!session.currentPlayer)return null;
 const p=session.currentPlayer,direction=(p.direction||1)*(reverse?-1:1);
 let path=session.state.mapRuntime.projectPath(p.currentTile,3,direction);
 const fence=path.findIndex(id=>session.state.propertyManager.getProperty(id)?.hasObstacle);
 if(fence>=0)path=path.slice(0,fence+1);
 const target=path.at(-1),opposite=session.state.mapRuntime.projectPath(p.currentTile,3,-direction).at(-1);
 const candidates=[...new Set([target,opposite,p.currentTile])];
 for(const tile of session.tiles){if(candidates.length>=3)break;if(!candidates.includes(tile.id))candidates.push(tile.id);}
 const route=path.map(id=>({id,name:session.state.getTile(id).name}));
 const lines={taoning:'陶宁在路口画了工具记号：“围栏未必都要拆，先想清楚这一步要停在哪里。”',ayu:'阿屿把停点圈在包裹单旁：“先把门牌找准，再看这一程能不能送到。”',qinghe:'青禾在路边画了小叶子：“先看会停在哪里，经营和周转也要留点余地。”',xingluo:'星罗在图角添上细箭头：“路线是选择的起点，不是一定赚钱的保证。”'};
 return {reverse,startId:p.currentTile,startName:session.state.getTile(p.currentTile).name,direction,target,route,fence:fence>=0,
  choices:candidates.sort((a,b)=>a-b).map(id=>({id,name:session.state.getTile(id).name})),
  reply:lines[p.characterId]||lines.ayu};
}
