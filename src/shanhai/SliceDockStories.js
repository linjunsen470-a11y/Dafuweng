/** Original dock neighbors. Conversations never touch game state or RNG. */
export const DOCK_NEIGHBORS=[
 {id:'harbor',tileId:0,name:'阿澜',role:'栈桥船工',place:'绳结货运栈桥',color:'#cf8064',story:'阿澜刚收好一船货物，正在把绳圈和航线木牌归位。',choices:[
  {id:'rope',label:'一起收好绳圈',reply:'阿澜把绳圈挂上木桩：“谢谢，登船的路宽敞多了。去灯塔别院，从这里出发。”'},
  {id:'tide',label:'请教船期与潮汐',reply:'“定班渡轮稳稳到站，快艇便宜些，但四趟大约一趟会改靠漂流信笺。买票前再看清目的地。”'}]},
 {id:'market',tileId:8,name:'小栀',role:'灯下茶摊主',place:'灯笼候船亭',color:'#6597b0',story:'小栀在候船亭摆开茶杯，想请路过的人替两张街坊留言选个位置。',choices:[
  {id:'post',label:'把艺坊留言挂在前面',reply:'小栀把留言夹在灯笼旁：“去云朵画室的客人会先看见它。那边的林间艺坊，种苗和手作都很热闹。”'},
  {id:'route',label:'聊聊商街与换乘',reply:'“这班船到17号云朵画室。快艇若受潮流影响，会回到10号夜市来信；船费照付，到站再选怎么经营。”'}]},
 {id:'garden',tileId:16,name:'木木',role:'花棚育苗人',place:'花棚归港码头',color:'#8caa72',story:'木木把小花盆搬进棚里避风，空出的长凳正好可以坐下聊聊。',choices:[
  {id:'shade',label:'帮花苗挪到阴凉处',reply:'木木把花盆排在棚檐下：“谢谢你留了这片阴凉。下次经过艺坊，也来看看花开了没有。”'},
  {id:'home',label:'问问回港的路',reply:'“归港船到3号海盐面包坊。航线虽然绕过出发站，但不会领起点奖金；快艇也可能改靠22号交换会。”'}]}
];
export const dockNeighbor=id=>DOCK_NEIGHBORS.find(d=>d.id===id);
export function canChatAtDock(dock,session,{active=false,busy=false}={}){return Boolean(dock&&active&&!busy&&session.currentPlayer&&!session.currentPlayer.isAI&&!session.currentPlayer.isBankrupt&&session.currentPlayer.currentTile===dock.tileId&&session.state.phase!=='GAME_OVER');}
