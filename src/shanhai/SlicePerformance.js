import {expressionFor,EXPRESSION_LABELS} from './SliceExpressions.js';
/** Original deterministic dialogue. Presentation only: no RNG or save state. */
const LINES={
 taoning:{boarding:'扣紧工具箱，过水也要稳稳当当。',sailing:'沿着岸线看看，哪里还需要搭把手。',diverted:'换了码头，先检查新的落脚点。',alighting:'工具带齐，脚下踩稳。',arrival:'到站了，先看看街上的路况。',event:'先量量手里的材料，再决定怎么做。',success:'这点功夫没白费，账也记好了。',setback:'这一回没修顺，留些预算再来。',purchase:'有了落脚的铺面，就能慢慢经营。',upgrade:'添一层，也把基础打牢。',rent:'借过邻居的地，费用已经结清。',commission:'答应街坊的活，办妥了。',ability:'工具备好了，需要清路时再拿出来。'},
 xingluo:{boarding:'收好地图，先记住对岸的门牌。',sailing:'水路也是路，沿着灯塔校准方向。',diverted:'改靠的位置已记下，重新画一条路线。',alighting:'脚下这一步，落在新的坐标上。',arrival:'到了，先看前面的路和手里的预算。',event:'把条件列清楚，再选值得走的那条路。',success:'这次选路有收获，记进旅途手册。',setback:'地图记下了风险，下一程留些余地。',purchase:'这处门牌，添进我的地图。',upgrade:'新的楼层，是这条街的新地标。',rent:'经过别人的地标，费用也记清楚。',commission:'把路走通，也把约定完成。',ability:'路线绘好了，这张骰子留给关键的一步。'},
 ayu:{boarding:'包裹扎紧，下一站就交给海风。',sailing:'沿着灯塔走，这条水路我记下了。',diverted:'潮水换了方向，先确认新的靠岸点。',alighting:'脚下站稳，带着好消息上岸。',arrival:'到站了，看看这条街有什么新机会。',event:'岛民有新消息，先看清要付出什么。',success:'这一趟有收获，账也记清楚了。',setback:'这趟没等到回款，下次留足周转钱。',purchase:'记下这个门牌，以后这里也是我的一站。',upgrade:'熟悉的门牌，有了新的模样。',rent:'借过邻居的好风景，租金已经付好了。',commission:'包裹和心意，都送到了。',ability:'近处的驿站搭把手，这单接力送达。'},
 qinghe:{boarding:'护好花苗，慢一点也没关系。',sailing:'海风真好，去看看另一边的花园。',diverted:'顺着潮水换个码头，花苗还稳稳的。',alighting:'一步一步，把新的风景带上岸。',arrival:'到了，看看这里适合种下什么计划。',event:'邻里送来了消息，选一件力所能及的事。',success:'大家一起照料，小小的投入也有了回响。',setback:'这次还没开花，先把余下的资金照料好。',purchase:'从一小块土地开始，慢慢长成喜欢的地方。',upgrade:'又长高了一层，街角更有生气了。',rent:'谢谢邻居的照料，这一站的租金付好了。',commission:'邻里的约定完成了，下次再一起动手。',ability:'把街坊请到花市来，让花苗也帮忙经营。'}
};
export function characterFeedback(player,kind,detail=''){
 const lines=LINES[player?.characterId]||LINES.ayu;
 return {speaker:player?.name||'海湾同行者',characterId:Object.hasOwn(LINES,player?.characterId)?player.characterId:'ayu',kind,mood:expressionFor(kind),moodLabel:EXPRESSION_LABELS[expressionFor(kind)],title:detail,line:lines[kind]||lines.arrival};
}
