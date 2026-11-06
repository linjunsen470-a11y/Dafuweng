/** Read-only season summary. Assets and victory remain owned by the rules engine. */
export function seasonReport(session){
 const s=session.state;if(s.phase!=='GAME_OVER')return null;
 const rankings=s.players.map(p=>({id:p.id,name:p.name,characterId:p.characterId,isAI:p.isAI,tieCash:p.cash,bankrupt:p.isBankrupt,assets:s.calculateAssetBreakdown(p),
  completed:session.careers[p.id]?.completed||0,earned:session.careers[p.id]?.earned||0,story:session.getStoryStatus(p)}))
  .sort((a,b)=>Number(a.bankrupt)-Number(b.bankrupt)||b.assets.total-a.assets.total||b.tieCash-a.tieCash||a.id-b.id);
 // The saved engine winner is authoritative, including early bankruptcy endings.
 const winner=s.winner?rankings.find(r=>r.id===s.winner.id):rankings.find(r=>!r.bankrupt);
 if(winner){rankings.splice(rankings.indexOf(winner),1);rankings.unshift(winner);}
 for(const r of rankings){const a=r.assets;r.parts=[['现金',a.cash],['土地净值',a.landValue],['建筑估值',a.buildingValue]];
  for(const [label,key] of [['存款','deposit'],['股票市值','stockValue'],['企业权益','commercialValue']])if(a[key])r.parts.push([label,a[key]]);
  const adjustment=a.total-r.parts.reduce((sum,[,value])=>sum+value,0);if(adjustment)r.parts.push(['取整调整',adjustment]);
 }
 const groups=[['来信选择',/在【.*】选择/],['角色能力',/行路制图：|社区花市：|驿站接力：/],['经营变化',/成功购买【|升级至|异地施工|改建/],['路线与道具',/施工围栏 →|回程路签 →|清路工具包 →|船费|乘船/],['委托完成',/完成【.*】.*获得/]];
 const logs=s.logHistory||[],highlights=[];
 for(const [label,pattern] of groups){const index=logs.findLastIndex(l=>pattern.test(l.msg));if(index>=0)highlights.push({label,index,text:logs[index].msg});}
 highlights.sort((a,b)=>a.index-b.index);
 const human=rankings.find(r=>!r.isAI);
 return {mapId:session.mapId,mapName:s.mapDefinition.name,round:Math.min(s.round,s.maxRounds),maxRounds:s.maxRounds,
  reason:s.winReason==='LAST_PLAYER'?'其他对手破产，提前结束':'按净值结算',winner,rankings,highlights,
  suggestion:human?.story.stage<4?`下次可以试着完成「${session.storyName}」，用遥控落点串起故事目标。`:human?.assets.propertyCount===0?'下次试着保留一笔购地资金，比较现金与地产的取舍。':'下次换一位角色或一张地图，尝试不同的路线与经营选择。'};
}
