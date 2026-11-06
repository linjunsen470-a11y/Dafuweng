// Original, chapter-only events. Prices, odds and outcomes are public; opening
// an event never draws RNG. The session draws only when a risky choice is made.
export const ISLAND_EVENTS = {
  4: { title:'海雾中的船期',story:'码头正在为下一班货船招募帮手。你可以稳妥接活，也可以自付运费，赌一趟顺风。',choices:[
    {id:'work',name:'帮忙搬运',detail:'稳妥收入：获得 ¥300。',cash:300},
    {id:'sail',name:'承包远航货舱',detail:'先付 ¥400；60% 收回 ¥1,200（净赚 ¥800），40% 无回款（损失 ¥400）。',cost:400,chance:60,cash:1200},
    {id:'supply',name:'采购航程点券',detail:'支付 ¥300，获得 45 点券，足够补充一张遥控骰子。',cost:300,points:45}
  ]},
  10: { title:'灯塔下的夜市',story:'夜市正在招募合伙人。现金能买一晚的摊位，点券也能换来下一次置业的周转金。',choices:[
    {id:'help',name:'协助布置摊位',detail:'稳妥收入：获得 20 点券。',points:20},
    {id:'stall',name:'合办海风夜摊',detail:'先付 ¥700；50% 收回 ¥1,800（净赚 ¥1,100），50% 无回款（损失 ¥700）。',cost:700,chance:50,cash:1800},
    {id:'exchange',name:'兑换周转金',detail:'交出 30 点券，获得 ¥500；下一张遥控骰子可能要再攒一攒。',pointCost:30,cash:500}
  ]},
  16: { title:'温室里的互助信',story:'温室需要人手和种苗资金。若你的委托快到期，也可以请邻里协助争取一天宽限。',choices:[
    {id:'volunteer',name:'帮忙整理种苗',detail:'稳妥收入：获得 20 点券。',points:20},
    {id:'nursery',name:'合资培育花苗',detail:'先付 ¥400；75% 收回 ¥1,000（净赚 ¥600），25% 无回款（损失 ¥400）。',cost:400,chance:75,cash:1000},
    {id:'extend',name:'请邻里协调委托',detail:'交出 20 点券，将当前未完成委托延长 1 轮；不超过本季最后一轮。',pointCost:20,extend:true}
  ]},
  22: { title:'林间交换会',story:'画室前摆起了交换摊。你可以出售闲置，换回现金，或资助一批尚未找到买家的手作品。',choices:[
    {id:'sell',name:'出售闲置材料',detail:'稳妥收入：获得 ¥200。',cash:200},
    {id:'exchange',name:'出让收藏点券',detail:'交出 40 点券，获得 ¥800；放弃一些选路余地，保留置业现金。',pointCost:40,cash:800},
    {id:'craft',name:'资助手作联展',detail:'先付 ¥600；50% 收回 ¥1,700（净赚 ¥1,100），50% 无回款（损失 ¥600）。',cost:600,chance:50,cash:1700}
  ]}
};
// Pending saves pin the event id; absent ids deliberately mean the original event.
export const islandEvent = (tileId,mapId='shanhai-coast',eventId='base') => {
  if(!Number.isInteger(tileId))return null;
  const variant=SEASONAL_EVENTS[mapId];
  if(variant?.tileId===tileId&&variant.id===eventId)return variant;
  return (mapId==='shanhai-highland'?HIGHLAND_EVENTS:ISLAND_EVENTS)[tileId]||null;
};
export const islandEventForRound = (tileId,mapId,round) => {
  const variant=SEASONAL_EVENTS[mapId];
  return variant?.tileId===tileId&&round%2===0?variant:islandEvent(tileId,mapId);
};

export const HIGHLAND_EVENTS = {
 4:{title:'驿路上的收茶车',story:'山路刚通车，驿站需要帮手整理新茶。也有人愿意包下整车货，赶早市。',choices:[
 {id:'sort',name:'帮忙分拣新茶',detail:'稳妥收入：获得 ¥250。',cash:250},
 {id:'wagon',name:'合租早市货车',detail:'先付 ¥450；65% 收回 ¥1,150（净赚 ¥700），35% 无回款（损失 ¥450）。',cost:450,chance:65,cash:1150},
 {id:'voucher',name:'换取驿站点券',detail:'支付 ¥250，获得 40 点券。',cost:250,points:40}]},
 10:{title:'柴窑试烧',story:'陶工邀请街坊一起开窑。可以帮忙换点券，也可以承担试烧的损耗。',choices:[
 {id:'pack',name:'帮忙包装陶器',detail:'稳妥收入：获得 25 点券。',points:25},
 {id:'kiln',name:'预订试烧窑位',detail:'先付 ¥650；55% 收回 ¥1,650（净赚 ¥1,000），45% 无回款（损失 ¥650）。',cost:650,chance:55,cash:1650},
 {id:'sell',name:'出让收藏点券',detail:'交出 30 点券，获得 ¥450。',pointCost:30,cash:450}]},
 16:{title:'茶坡互助日',story:'茶坡分出两条回程路。茶农阿棠可以带你改走另一侧山路，也欢迎留下采茶、摆摊或协调委托。返程向导只改变之后的方向，不会立刻送你到站。',choices:[
 {id:'pick',name:'协助采茶',detail:'稳妥收入：获得 ¥220，保持当前方向。',cash:220},
 {id:'turnback',name:'请茶农带路返程',detail:'支付 ¥250，反转自己的行走方向，持续到再次转向；本次不领取采茶收入。仍停在16号，下回合再走，不消耗卡片、不加掷骰、不跳过落地结算。',cost:250,turnBack:true,successText:'阿棠把回程路标转向另一侧，你记下了下一站。'},
 {id:'tea',name:'合办试饮茶摊',detail:'先付 ¥350；70% 收回 ¥900（净赚 ¥550），30% 无回款（损失 ¥350）。',cost:350,chance:70,cash:900},
 {id:'extend',name:'协调委托期限',detail:'交出 20 点券，将当前委托延长1轮，不超过本季最后一轮。',pointCost:20,extend:true}]},
 22:{title:'雨后的盘山货道',story:'雨后石脊近路可能落石，谷底绕行道较稳妥。货栈邀请你承运茶箱，也可留下修路。以下只结算货运委托，角色仍停在22号站，不跳格、不额外领取经过奖励。',choices:[
 {id:'trail',name:'整理古道路标',detail:'稳妥收入：获得 ¥200 和 10 点券。',cash:200,points:10},
 {id:'craft',name:'走石脊近路运茶',detail:'先付 ¥300；60% 运达收回 ¥1,100（净赚 ¥800）；40% 遇落石退货，无回款（损失 ¥300）。角色不移动。',cost:300,chance:60,cash:1100,successText:'茶箱穿过石脊，赶上收货。',failureText:'石脊落石封路，茶箱退回，运费不退。'},
 {id:'guide',name:'雇向导走谷底绕行道',detail:'先付 ¥500，稳妥收回 ¥850（净赚 ¥350）；资金不足无法承运。角色不移动。',cost:500,cash:850,successText:'向导沿谷底绕行，茶箱安全交付。'},
 {id:'exchange',name:'换取修路周转金',detail:'交出 40 点券，获得 ¥700。',pointCost:40,cash:700}]}
};

// Two public, predictable visiting activities; no extra draw on arrival or preview.
export const SEASONAL_EVENTS = {
 'shanhai-coast':{id:'PRINT_FAIR',tileId:22,title:'林间拓印试展',story:'双数轮，林间交换会改办拓印试展。画坊收取点券作为展位材料押额：展出顺利可拿现金，遇潮湿则退还部分点券。只结算本次选择，不接取任务、不发放卡片。',choices:[
  {id:'hang',name:'协助布置展板',detail:'稳妥收入：获得 ¥200，不消耗点券。',cash:200},
  {id:'exhibit',name:'认领拓印展位',detail:'先交 30 点券；70% 获得 ¥900（点券净减30）；30% 受潮撤展，无现金收入、退回15点券（净损失15点券）。',pointCost:30,chance:70,cash:900,failurePoints:15,successText:'拓印画顺利展出，画坊付清展位分成。',failureText:'海风带来潮气，拓印画撤展；画坊退回15点券。'},
  {id:'shelter',name:'租用有顶展架',detail:'先付 ¥400 和 10 点券，保证收回 ¥750（净赚 ¥350，净减10点券），不抽取天气结果。',cost:400,pointCost:10,cash:750,successText:'有顶展架护住拓印画，约定分成如数到账。'}
 ]},
 'shanhai-highland':{id:'TEA_DRYING',tileId:22,title:'雨后晒场抢晴',story:'双数轮，盘山货栈开放临时晒场。散户可以帮忙翻茶，也可预付一批鲜叶的晾晒费用；露天省钱但怕阵雨，租棚则能保住约定回款。只结算本次经营，人物不移动。',choices:[
  {id:'rake',name:'帮忙翻晒茶叶',detail:'稳妥收入：获得 ¥250，无需投入。',cash:250},
  {id:'sun',name:'抢晴露天晾晒',detail:'先付 ¥500；60% 晒成收回 ¥1,400（净赚 ¥900）；40% 遇阵雨，转售湿叶收回 ¥250（净损失 ¥250）。',cost:500,chance:60,cash:1400,failureCash:250,successText:'晴窗持续到收工，整批干茶售出。',failureText:'阵雨提前到来，湿叶转售收回 ¥250。'},
  {id:'roof',name:'租棚慢烘保收',detail:'先付 ¥700，保证收回 ¥1,050（净赚 ¥350），不抽取天气结果；须先备足租棚资金。',cost:700,cash:1050,successText:'棚内慢烘完成，茶商按约收货。'}
 ]}
};
