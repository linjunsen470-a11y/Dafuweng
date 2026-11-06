import {savingsOptions,chooseSavings,SAVINGS_TILE} from './SliceSavings.js';
import {counterRoute,fenceCounterplay} from './SliceCounterplay.js';
import {propertyFinance} from './SlicePropertyFinance.js';
import {constructionOptions} from './SliceConstruction.js';
import {recordMatchCommand} from '../game/MatchStatistics.js';
import {SLICE_TACTICS} from './SliceTactics.js';
import {CardRules} from '../game/CardRules.js';
import { CARD_CAPACITY } from '../game/InventoryManager.js';
import { cardManager } from '../game/CardManager.js';
import {getMinimumAuctionBid,getAIAuctionBid} from '../game/AuctionRules.js';
import { GameEngine } from '../game/GameEngine.js';
import { GameState } from '../game/GameState.js';
import { SaveManager, getBrowserStorage } from '../game/SaveManager.js';
import { SHANHAI_COAST_MAP, SLICE_CHARACTERS } from './SliceMap.js';
import { sliceMap, sliceRegion, sliceSaveKey, sliceCast } from './SliceMap.js';
import { islandEvent, islandEventForRound } from './SliceEvents.js';
import { commerceOptions, chooseCoastBusiness, COAST_BUSINESSES } from './SliceCommerce.js';
import { LANTERN_STEPS, LANTERN_ENDINGS, MOUNTAIN_STEPS, MOUNTAIN_ENDINGS } from './SliceStory.js';
import { COAST_ROUTES, COAST_SERVICES } from './SliceTransport.js';

export { SHANHAI_COAST_MAP, SLICE_CHARACTERS } from './SliceMap.js';
export const SLICE_SAVE_KEY = 'shanhai-coast:save:v1';
const rejected = reason => ({ success: false, reason, events: [] });

/** DOM-free adapter: the existing engine owns properties and movement;
 * chapter commissions add their own explicit, once-only rewards.
 * The presentation ledger prevents replaying a landing/payment on double clicks.
 */
export class SliceSession {
  constructor({ storage = getBrowserStorage(), seed = 20261105, mapId = SHANHAI_COAST_MAP.id } = {}) {
    this.saves = new SaveManager(storage);
    this.listeners = new Set();
    if(!sliceMap(mapId))throw new Error('未知章节地图');
    this.mapId=mapId;
    this.seed = seed;
    this.epoch = 0;
    this.aiRunning = false;
    this.state = new GameState({ seed });
    this.engine = new GameEngine(this.state, { saveManager: this.saves });
    this.careers = {};
    this.abilities = {};
    this.stories = {};
    this.resetPresentation();
  }

  resetPresentation() {
    this.focus = null;
    this.lastRoll = null;
    this.landingResolved = false;
    this.decisionMade = false;
    this.cardUsed = false;
    this.pendingEvent = null;
    this.lastTransport = null;
    this.lastMovementStop = null;
    this.auctionResults = [];
  }

  get hasCoastFeatures(){return this.mapId===SHANHAI_COAST_MAP.id;}
  region(id){return sliceRegion(id,this.mapId);}
  event(id){return this.pendingEvent?.tileId===id?islandEvent(id,this.mapId,this.pendingEvent.eventId):islandEventForRound(id,this.mapId,this.state.round);}
  get currentPlayer() { return this.state.getCurrentPlayer(); }
  get tiles() { return this.state.mapDefinition.tiles; }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  notify(result) { this.listeners.forEach(listener => listener(this.state, result, this)); return result; }
  command(type, payload = {}) { return this.engine.execute({ type, playerId: this.currentPlayer?.id, payload }); }

  start({ seed = this.seed, characterId = 'ayu', opponentId = null, playerCount = 2, maxRounds = 16, initialCash = 16000 } = {}) {
    this.epoch++;
    this.seed = seed;
    this.state = new GameState({ seed, maxRounds });
    this.engine = new GameEngine(this.state, { saveManager: this.saves });
    const cast=sliceCast(characterId,opponentId,playerCount);
    // Neutral base profiles keep starting funds equal. Original specialties
    // apply only to chapter commissions, not legacy character modifiers.
    this.state.setupGame(cast.map((c, i) => ({ profileIndex: 8, name: c.name, isAI: i > 0 })), initialCash,
      { mapId: this.mapId, maxRounds });
    this.state.players.forEach((p, i) => Object.assign(p, {
      profileId: cast[i].id, characterId: cast[i].id, avatar: cast[i].avatar,
      avatarImg: null, avatarAtlas: null, color: cast[i].color, colorHex: cast[i].colorHex,
      skillName: cast[i].skillName, skillDesc: cast[i].skillDesc
    }));
    this.restoreCareers();
    this.restoreAbilities();
    this.restoreStories();
    this.state.captureTurnCheckpoint();
    this.resetPresentation();
    return this.notify({ success: true, type: 'SLICE_STARTED' });
  }

  roll() {
    const result = this.command('ROLL_DICE');
    if (result.success) {
      this.lastRoll = result;
      this.focus = null;
      const move = this.command('BEGIN_MOVE', { steps: result.steps, source: 'DICE' });
      if (!move.success) return this.notify(move);
    }
    return this.notify(result);
  }

  advanceMove() {
    const pending=this.state.pendingMove,remaining=pending?.remainingSteps;
    const result=this.command('ADVANCE_MOVE');
    const stop=result.success&&result.events?.find(e=>e.type==='OBSTACLE_CONSUMED');
    if(stop&&pending)this.lastMovementStop={kind:'OBSTACLE',playerId:pending.playerId,tileId:stop.tileId,steps:pending.path.length,unused:Math.max(0,remaining-1)};
    return this.notify(result);
  }
  resolveMovement() {
    const results = [];
    while (this.state.pendingMove) {
      const result = this.advanceMove();
      results.push(result);
      if (!result.success) return result;
    }
    return { success: true, type: 'MOVEMENT_RESOLVED', results };
  }

  resolveLanding() {
    if (this.state.phase !== 'LANDING_ACTION') return rejected('当前尚未落地');
    if (this.landingResolved) return rejected('本次落地已结算');
    const tileId = this.currentPlayer.currentTile;
    const landing = this.engine.inspectLanding(this.currentPlayer, tileId);
    this.landingResolved = true;
    const event = this.event(tileId);
    if (event) {
      this.pendingEvent = { tileId, eventId:event.id||'base' };
      this.focus = { kind:'ISLAND_EVENT',title:event.title,description:event.story,tileId,result:{success:true},cost:0 };
      return this.notify({ success:true,type:'ISLAND_EVENT_OPENED',focus:this.focus });
    }
    let result = { success: true, type: 'LANDING_READY', events: [] };
    if (landing.kind === 'RENT') result = this.command('SETTLE_RENT', { tileId });
    else if (landing.kind === 'SPECIAL') result = this.command('RESOLVE_LANDING', { tileId });
    if (this.state.phase === 'DEBT_SETTLEMENT') {
      const debt = this.command('AUTO_SETTLE_DEBT');
      result = { ...debt, events: [...(result.events || []), ...(debt.events || [])], rentResult: result };
    }
    const bankrupt=this.currentPlayer.isBankrupt;
    this.focus = { kind: bankrupt?'BANKRUPT':landing.kind, title: bankrupt?`${this.currentPlayer.name}退出本季`:result.chance?.title || landing.tile.name,
      description: bankrupt?'资产清算后仍不足以偿还债务，本季退出。若仍有两名存续玩家，名下地产将逐块竞拍；无人出价则恢复为可购买地块。只剩一名玩家时直接结算。':result.chance?.desc || landing.tile.desc || '', tileId, result,
      cost: landing.kind === 'PURCHASE' ? this.engine.getPropertyActionCost(this.currentPlayer, tileId, 'BUY')
        : landing.kind === 'UPGRADE' ? this.engine.getPropertyActionCost(this.currentPlayer, tileId, 'UPGRADE') : 0 };
    const commission = result.success === false ? null : this.completeCommission('DELIVERY', tileId);
    return this.notify({ ...result, focus: this.focus, commission });
  }

  get awaitingAuctionContinue(){return this.state.phase==='LANDING_ACTION'&&this.currentPlayer?.isBankrupt&&this.auctionResults.length>0;}

  getAuctionView(){
    const a=this.state.auction;
    if(this.state.phase!=='AUCTION'||!a?.bankruptcy)return null;
    const bidder=this.state.players[a.bidderOrder[a.bidderIndex]],tile=this.state.getTile(a.tileId);
    return {auction:a,bidder,tile,property:this.state.propertyManager.getProperty(a.tileId),minimum:getMinimumAuctionBid(a),
      beneficiary:this.state.players[a.beneficiaryId]||null,remaining:this.state.bankruptcyAuctionQueue.length};
  }

  bidAuction(playerId,amount,auctionId){
    const view=this.getAuctionView();
    if(!view||view.auction.id!==auctionId)return rejected('这块地产的竞拍已结束或发生变更');
    if(view.bidder?.id!==playerId)return rejected('尚未轮到你出价');
    if(!Number.isInteger(amount)||amount<0||(amount>0&&amount%100!==0))return rejected('请输入整百金额；放弃请使用放弃按钮');
    const result=this.engine.execute({type:'PLACE_BID',playerId,payload:{amount}});
    if(result.success){
      if(result.completed)this.auctionResults.push(structuredClone(result.auction));
      else this.state.addLog(`${view.bidder.name}${amount?`出价 ¥${amount} 竞拍`:'放弃竞拍'}【${view.tile.name}】。`,'info');
    }
    return this.notify(result);
  }

  bidAuctionAI(){
    const view=this.getAuctionView();
    if(!view?.bidder?.isAI)return rejected('当前应由玩家选择出价或放弃');
    return this.bidAuction(view.bidder.id,getAIAuctionBid(view.bidder,view.auction,this.state),view.auction.id);
  }

  decide(type, expectedKind, buildingType = 'MALL') {
    if (!this.landingResolved || this.decisionMade || this.focus?.kind !== expectedKind) return rejected('本回合没有可执行的地产操作');
    const commercial=this.state.getTile(this.focus.tileId).type==='BIG_PROPERTY';
    if(type==='PURCHASE_PROPERTY'&&commercial&&!COAST_BUSINESSES.some(b=>b.id===buildingType))return rejected('请选择商场或花园');
    const result = this.command(type, { tileId: this.focus.tileId, buildingType: commercial ? buildingType : undefined });
    if (result.success) {
      this.decisionMade = true;
      this.focus = { ...this.focus, kind: 'DONE', result };
      result.commission = this.completeCommission('RENEWAL');
    }
    return this.notify(result);
  }
  purchase(buildingType = 'MALL') { return this.decide('PURCHASE_PROPERTY', 'PURCHASE', buildingType); }
  upgrade() { return this.decide('UPGRADE_PROPERTY', 'UPGRADE'); }

  getSavingsOptions(){return savingsOptions(this);}
  useSavings(id){
    const quote=this.getSavingsOptions().find(o=>o.id===id);
    if(!quote||quote.blockedReason)return rejected(quote?.blockedReason||'当前没有这项林场服务');
    const result=this.command('BANK_TRANSFER',{tileId:SAVINGS_TILE,direction:quote.direction,amount:quote.amount});
    if(!result.success)return this.notify(result);
    const description=`${quote.direction==='DEPOSIT'?'存入':'取出'} ¥${quote.amount}；现金 ¥${result.cash}，存款 ¥${result.deposit}。原补给奖励不重复领取。`;
    this.focus={...this.focus,title:'林场储蓄亭',description,result};
    return this.notify({...result,description});
  }

  getPropertyFinance(tileId){return propertyFinance(this,Number(tileId));}

  financeProperty(tileId,action){
    const quote=this.getPropertyFinance(tileId);
    if(!quote||quote.action!==action)return rejected('地产状态已变化，请重新查看报价');
    if(quote.blockedReason)return rejected(quote.blockedReason);
    // The same engine commands/costs used by every seat and debt settlement.
    return this.notify(this.command(action,{tileId:quote.tileId}));
  }

  getConstructionOptions(){return constructionOptions(this);}

  contractUpgrade(tileId){
    const quote=this.getConstructionOptions().find(o=>o.tileId===Number(tileId));
    if(!quote||quote.blockedReason)return rejected(quote?.blockedReason||'只能选择自己的地产');
    const player=this.currentPlayer,cashBefore=player.cash;
    // Chapter-only pre-roll permission. Reuse the engine's ordinary upgrade
    // validation/costs without faking a landing, moving the pawn or drawing RNG.
    const result=this.engine.upgradeProperty(player,quote.tileId);
    if(!result.success)return this.notify(result);
    player.cash-=quote.fee;this.cardUsed=true;
    recordMatchCommand(this.state.matchStatistics,{playerId:player.id,commandType:'UPGRADE_PROPERTY',result,cashBefore,cashAfter:player.cash,round:this.state.round});
    const description=`异地施工 → ${quote.tileId}号 ${quote.name} · L${quote.level} → L${result.level}，合计 ¥${quote.cost}（含上门费 ¥${quote.fee}）。本回合还需普通掷骰。`;
    this.state.addLog(`🏗 ${player.name}：${description}`,'gold');
    // No renewal commission: this did not involve arriving at the property.
    return this.notify({...result,type:'CONSTRUCTION_COMPLETED',cost:quote.cost,fee:quote.fee,tacticName:'异地施工',description});
  }

  /** A public cash preference, never an extra rule or a look at future dice. */
  getAIPropertyBudget(fromTileId=this.currentPlayer?.currentTile){
    if(!this.currentPlayer||this.state.round>=this.state.maxRounds)return {reserve:1800,threat:null};
    const p=this.currentPlayer;
    const threat=this.getTravelOptions(p.direction||1,fromTileId).filter(o=>o.kind==='RENT')
      .map(o=>({tileId:o.tileId,rent:this.state.propertyManager.calculateToll(o.tileId,this.state.newsEffect,this.state.priceIndex,p)}))
      .filter(o=>o.rent>0).sort((a,b)=>b.rent-a.rent||a.tileId-b.tileId)[0]||null;
    return {reserve:Math.max(1800,(threat?.rent||0)+1000),threat};
  }

  chooseAIConstruction(){
    if(this.state.round>=this.state.maxRounds)return null;
    const p=this.currentPlayer,task=this.careers[p.id]?.active;
    // Keep a reachable delivery opportunity; never look at future dice/events.
    if(task?.kind==='DELIVERY'&&this.getTravelOptions().some(o=>o.tileId===task.targetId))return null;
    const {reserve}=this.getAIPropertyBudget();
    return this.getConstructionOptions().filter(o=>!o.blockedReason&&o.nearRival&&o.nextRent>o.currentRent&&o.cashAfter>=reserve)
      .sort((a,b)=>(b.nextRent-b.currentRent)/b.cost-(a.nextRent-a.currentRent)/a.cost||a.tileId-b.tileId)[0]||null;
  }

  getCommerceOptions(tileId, player=this.currentPlayer) { return commerceOptions(this.state,player,tileId); }

  changeBusiness(tileId,buildingType) {
    const option=this.getCommerceOptions(tileId).find(b=>b.id===buildingType);
    if(!option||option.blockedReason)return rejected(option?.blockedReason||'请选择商场或花园');
    return this.notify(this.command('CHOOSE_BUILDING_TYPE',{tileId,buildingType}));
  }

  get storySteps(){return this.hasCoastFeatures?LANTERN_STEPS:MOUNTAIN_STEPS;}
  get storyEndings(){return this.hasCoastFeatures?LANTERN_ENDINGS:MOUNTAIN_ENDINGS;}
  get storyName(){return this.hasCoastFeatures?'海风花灯':'一窑新茶';}
  restoreStories(saved={}) {
    this.stories=Object.fromEntries(this.state.players.map(p=>{
      const old=saved?.[p.id],stage=Number.isInteger(old?.stage)&&old.stage>=0&&old.stage<=4?old.stage:0;
      const ending=Object.hasOwn(this.storyEndings,old?.ending)?old.ending:null;
      return [p.id,{stage:stage===4&&!ending?3:stage,ending:stage===4?ending:null,startedRound:Number.isInteger(old?.startedRound)?old.startedRound:null,commissionKind:['DELIVERY','RENEWAL'].includes(old?.commissionKind)?old.commissionKind:null}];
    }));
  }

  getStoryStatus(player=this.currentPlayer) {
    if(!player)return null;const record=this.stories[player.id]||{stage:0},step=this.storySteps[record.stage];
    let blockedReason='';
    if(player.id!==this.currentPlayer?.id||player.isBankrupt||!['PRE_ROLL_ACTION','LANDING_ACTION'].includes(this.state.phase))blockedReason='请在自己的回合推进故事';
    else if(this.pendingEvent)blockedReason='先处理本站来信';
    else if(this.state.phase==='LANDING_ACTION'&&!this.landingResolved)blockedReason='先完成本站落地结算';
    else if(step.targetId!==null&&player.currentTile!==step.targetId)blockedReason=`需要实际停靠 ${step.targetId}号站；经过不算`;
    return {...record,...step,blockedReason,endingInfo:this.storyEndings[record.ending]||null};
  }

  advanceStory(action) {
    const status=this.getStoryStatus();
    if(!status||status.blockedReason||!status.actions.some(a=>a.id===action))return rejected(status?.blockedReason||'当前没有这一步故事行动');
    const p=this.currentPlayer,record=this.stories[p.id];let description;
    if(!this.hasCoastFeatures){
      if(action==='accept'){record.stage=1;record.startedRound=this.state.round;description='阿棠递来茶会便笺：先去10号柴窑与陶九一起开窑。';}
      else if(action==='collect'){record.stage=3;description='阿棠递来新茶：到22号处理山路来信，再决定茶会的去处。';}
      else{record.stage=4;record.ending=action;description=`一窑新茶完成 · 获得纪念称号「${this.storyEndings[action].title}」。${this.storyEndings[action].text}`;}
    }else if(action==='accept'){record.stage=1;record.startedRound=this.state.round;description='阿澜递来便笺：先完成一份海湾委托，再找8号站的小栀取灯罩。';}
    else if(action==='collect'){record.stage=3;description='小栀递来纸灯罩：带到16号花棚，与木木决定灯该照向哪里。';}
    else{record.stage=4;record.ending=action;description=`海风花灯完成 · 获得纪念称号「${LANTERN_ENDINGS[action].title}」。${LANTERN_ENDINGS[action].text}`;}
    this.state.addLog(`✦ ${p.name}：${description}`,'gold');
    return this.notify({success:true,type:'STORY_ADVANCED',stage:record.stage,description});
  }

  advanceAIStory() {
    const status=this.getStoryStatus();if(!status||status.blockedReason||!status.actions.length)return;
    this.advanceStory(status.stage===3?(this.hasCoastFeatures?(this.currentPlayer.characterId==='ayu'?'harbor':'garden'):(this.currentPlayer.characterId==='ayu'?'trail':'teahouse')):status.actions[0].id);
  }

  restoreAbilities(saved={}) {
    this.abilities=Object.fromEntries(this.state.players.map(p=>{
      const value=saved?.[p.id];
      return [p.id,{readyRound:Number.isInteger(value?.readyRound)&&value.readyRound>0?value.readyRound:1,last:typeof value?.last==='string'?value.last:null}];
    }));
  }

  getAbilityPreview(player=this.currentPlayer) {
    if(!player)return null;
    if(['xingluo','taoning'].includes(player.characterId)){
      const builder=player.characterId==='taoning',cardId=builder?'CLEAR_ROAD':'REMOTE_DICE',cardName=builder?'清路工具包':'遥控骰子',cost=builder?20:0;
      const record=this.abilities[player.id]||{readyRound:1},cashCost=builder?0:500;
      let blockedReason='';
      if(this.state.phase!=='PRE_ROLL_ACTION'||player.id!==this.currentPlayer?.id||player.isBankrupt)blockedReason='仅在自己的掷骰前使用';
      else if(this.state.round<record.readyRound)blockedReason=`第 ${record.readyRound} 轮可再次使用`;
      else if(this.cardUsed)blockedReason='本回合策略机会已使用';
      else if(player.cards.includes(cardId))blockedReason=`已持有${cardName}，先用完再制作`;
      else if(player.cards.length>=CARD_CAPACITY)blockedReason='卡片栏已满';
      else if(player.cash<cashCost)blockedReason='现金不足 ¥500';
      else if(player.cardPoints<cost)blockedReason='点券不足';
      return {id:builder?'TOOL_KIT':'CHART_DICE',name:builder?'随身工坊':'行路制图',cost,cashCost,reward:{cash:0,points:0,cardId,cardName},readyRound:record.readyRound,last:record.last,blockedReason,
        description:builder?'支付20点券制作一份清路工具包，比普通30点券补给节省10点券。制作不清路、不消耗策略机会；使用时仍占本回合策略机会，只清施工围栏。无额外委托奖励。':'支付 ¥500 制作一张遥控骰子，换取选路机会。制作不移动、不消耗策略机会；使用卡片时仍遵循每回合一次的限制。无额外委托奖励。'};
    }
    const courier=player.characterId==='ayu',record=this.abilities[player.id]||{readyRound:1};
    const task=this.careers[player.id]?.active,region=this.region(player.currentTile);
    const plots=this.tiles.filter(t=>this.region(t.id).id===region.id)
      .map(t=>this.state.propertyManager.getProperty(t.id)).filter(p=>p?.owner===player.id&&!p.isMortgaged);
    const cultivation=plots.reduce((n,p)=>n+1+p.level,0);
    const reward=courier?this.commissionReward('DELIVERY',player):{cash:200+100*Math.min(4,cultivation),points:0};
    const cost=courier?20:30,reachable=[player.currentTile,...this.state.mapRuntime.projectPath(player.currentTile,2,player.direction||1)];
    let blockedReason='';
    if(this.state.phase!=='PRE_ROLL_ACTION'||player.id!==this.currentPlayer?.id||player.isBankrupt)blockedReason='仅在自己的掷骰前使用';
    else if(this.state.round<record.readyRound)blockedReason=`第 ${record.readyRound} 轮可再次使用`;
    else if(courier&&task?.kind!=='DELIVERY')blockedReason='先接下一份速递委托';
    else if(courier&&(task.dueRound<this.state.round||!reachable.includes(task.targetId)))blockedReason='委托目的地须在前方两步内（含当前站）';
    else if(!courier&&!plots.length)blockedReason=`${region.name}没有可用的自有地产（抵押地不计）`;
    else if(player.cardPoints<cost)blockedReason='点券不足';
    return {id:courier?'RELAY':'FLOWER_FAIR',name:courier?'驿站接力':'社区花市',cost,reward,readyRound:record.readyRound,last:record.last,blockedReason,
      targetId:courier&&task?.kind==='DELIVERY'?task.targetId:null,
      description:courier?'由前方两步内的驿站代送速递委托，领取原委托奖励，不移动、不消耗骰子。':`${region.name}可用自有地产 ${plots.length} 处；按地块与建筑等级筹办花市，获得 ¥${reward.cash}（上限 ¥600）。`};
  }

  useAbility() {
    const preview=this.getAbilityPreview();
    if(!preview||preview.blockedReason)return rejected(preview?.blockedReason||'当前无法使用主动能力');
    const player=this.currentPlayer;player.cardPoints-=preview.cost;
    const commission=preview.id==='RELAY'?this.completeCommission('DELIVERY',preview.targetId):null;
    if(preview.id==='FLOWER_FAIR')player.cash+=preview.reward.cash;
    if(['CHART_DICE','TOOL_KIT'].includes(preview.id)){player.cash-=preview.cashCost;player.cards.push(preview.reward.cardId);}
    const description=preview.id==='TOOL_KIT'?`随身工坊：支付20点券，制作一份清路工具包；使用时消耗本回合策略机会，第 ${this.state.round+3} 轮可再次制作。`:preview.id==='CHART_DICE'?`行路制图：支付 ¥${preview.cashCost}，制作一张遥控骰子；使用时消耗本回合策略机会，第 ${this.state.round+3} 轮可再次制作。`:`${preview.name}：支付 ${preview.cost} 点券，获得 ¥${preview.reward.cash}${preview.reward.points?` 与 ${preview.reward.points} 点券`:''}；第 ${this.state.round+3} 轮可再次使用。`;
    this.abilities[player.id]={readyRound:this.state.round+3,last:description};
    this.state.addLog(`✦ ${player.name} ${description}`,'gold');
    return this.notify({success:true,type:'ABILITY_USED',abilityId:preview.id,abilityName:preview.name,description,commission,cash:preview.reward.cash-(preview.cashCost||0),pointCost:preview.cost});
  }

  getIslandChoices() {
    const event=this.event(this.pendingEvent?.tileId),player=this.currentPlayer;
    if(!event||!player)return [];
    const task=this.careers[player.id]?.active;
    return event.choices.map(choice=>{
      let blockedReason=player.cash<(choice.cost||0)?'现金不足':player.cardPoints<(choice.pointCost||0)?'点券不足':'';
      if(choice.extend){
        if(!task)blockedReason='没有进行中的委托';
        else if(task.dueRound>=this.state.maxRounds)blockedReason='不能延到本季结束之后';
        else if(task.kind==='DELIVERY'&&task.targetId===player.currentTile)blockedReason='已经抵达目标，处理完来信即可交付';
      }
      return {...choice,blockedReason,...(choice.turnBack?{routePreview:this.getTrailTurnPreview()}: {})};
    });
  }

  chooseIslandEvent(choiceId) {
    if(!this.pendingEvent||this.state.phase!=='LANDING_ACTION'||!this.landingResolved
      ||this.pendingEvent.tileId!==this.currentPlayer.currentTile)return rejected('当前没有等待选择的海岛来信');
    const choice=this.getIslandChoices().find(c=>c.id===choiceId);
    if(!choice||choice.blockedReason)return rejected(choice?.blockedReason||'请选择有效的方案');
    const player=this.currentPlayer,tileId=this.pendingEvent.tileId,event=this.event(tileId);
    // Never inspect a future draw in previews or AI scoring.
    const won=choice.chance?this.state.rng.int(1,100)<=choice.chance:true;
    const cashDelta=(won?(choice.cash||0):(choice.failureCash||0))-(choice.cost||0);
    const pointsDelta=(won?(choice.points||0):(choice.failurePoints||0))-(choice.pointCost||0);
    player.cash+=cashDelta;player.cardPoints+=pointsDelta;
    let extension='';
    if(choice.turnBack){player.direction=-(player.direction||1);const next=this.state.mapRuntime.projectPath(tileId,1,player.direction)[0];extension=`方向已反转，下次朝 ${next}号 ${this.state.getTile(next).name} 行走；本次仍停在 ${tileId}号。`;}
    if(choice.extend){const task=this.careers[player.id].active;task.dueRound++;extension=`委托已延至第 ${task.dueRound} 轮。`;}
    const description=`${choice.name}：${(won?choice.successText:choice.failureText)||(choice.chance?(won?'顺利完成。':'未获回款。'):'')}现金 ${cashDelta>=0?'+':''}¥${cashDelta}，点券 ${pointsDelta>=0?'+':''}${pointsDelta}。${extension}`;
    this.pendingEvent=null;
    const result={success:true,type:'ISLAND_EVENT_RESOLVED',choiceId,won,cashDelta,pointsDelta};
    this.focus={kind:'EVENT_DONE',tileId,title:event.title,description,result,cost:0};
    this.state.addLog(`✦ ${player.name} 在【${event.title}】选择${description}`,'info');
    result.commission=this.completeCommission('DELIVERY',tileId);
    if(!this.hasCoastFeatures&&tileId===10&&this.stories[player.id]?.stage===1){this.stories[player.id].stage=2;result.storyAdvanced=true;this.state.addLog(`✦ ${player.name} 与陶九一起开窑，下一站：16号向阿棠领取新茶。`,'gold');}
    return this.notify(result);
  }

  chooseAIIslandEvent() {
    const choices=this.getIslandChoices().filter(c=>!c.blockedReason),player=this.currentPlayer;
    const task=this.careers[player.id]?.active;
    const extension=choices.find(c=>c.extend&&task?.dueRound<=this.state.round+1);
    if(extension)return this.chooseIslandEvent(extension.id);
    const pointValue=player.cardPoints<45?18:10;
    const prudent=choices.filter(c=>!c.chance||player.cash-(c.cost||0)>=3000);
    const score=c=>((c.chance??100)/100)*((c.cash||0)+(c.points||0)*pointValue)+(1-(c.chance??100)/100)*((c.failureCash||0)+(c.failurePoints||0)*pointValue)-(c.cost||0)-(c.pointCost||0)*pointValue+(c.turnBack&&!player.cards.includes('TURN_AROUND')?c.routePreview.current.meanRent-c.routePreview.reverse.meanRent:0);
    prudent.sort((a,b)=>score(b)-score(a));
    return this.chooseIslandEvent(prudent[0]?.id||choices[0]?.id);
  }

  restoreCareers(saved = {}) {
    this.careers = {};
    for (const player of this.state.players) {
      const role = SLICE_CHARACTERS.find(c => c.id === player.characterId);
      if (role) Object.assign(player, { skillName: role.skillName, skillDesc: role.skillDesc });
      const career = structuredClone(saved?.[player.id] || {});
      const active = career.active;
      if (active && (!['DELIVERY','RENEWAL'].includes(active.kind)
        || !Number.isInteger(active.dueRound) || active.dueRound < this.state.round
        || (active.kind === 'DELIVERY' && !this.tiles.some(t => t.id === active.targetId)))) career.active = null;
      this.careers[player.id] = { active: null, settledRound: 0, completed: 0, earned: 0, last: null, ...career };
    }
  }

  commissionReward(kind, player = this.currentPlayer) {
    const specialist = (kind === 'DELIVERY' && player.characterId === 'ayu')
      || (kind === 'RENEWAL' && player.characterId === 'qinghe');
    return { cash: (kind === 'DELIVERY' ? 600 : 400) + (specialist ? 300 : 0), points: kind === 'DELIVERY' ? 15 : 35, specialist };
  }

  getCommissionOffers(player = this.currentPlayer) {
    if (!player) return [];
    const steps = 3 + ((this.state.round - 1 + player.id) % 4);
    const targetId = this.state.mapRuntime.projectPath(player.currentTile, steps, player.direction || 1).at(-1);
    return [
      { kind: 'DELIVERY', title: '海风速递', targetId, description: `停靠${this.state.getTile(targetId).name}，把岛民的包裹送达。` },
      { kind: 'RENEWAL', title: '街区焕新', targetId: null, description: '实际停靠后买地或升级一次；异地施工和改建不计入。' }
    ].map(offer => ({ ...offer, ...this.commissionReward(offer.kind, player), dueRound: Math.min(this.state.maxRounds, this.state.round + 2) }));
  }

  acceptCommission(kind) {
    const career = this.careers[this.currentPlayer?.id];
    const offer = this.getCommissionOffers().find(item => item.kind === kind);
    if (!offer || !career || this.state.phase !== 'PRE_ROLL_ACTION' || career.active || career.settledRound === this.state.round)
      return rejected('只能在掷骰前接单；每人同时一单，结单当轮不能再接。');
    career.active = { kind, targetId: offer.targetId, dueRound: offer.dueRound, acceptedRound: this.state.round };
    career.last = null;
    this.state.addLog(`✉️ ${this.currentPlayer.name} 接下【${offer.title}】：${offer.description} 第 ${offer.dueRound} 轮结束前有效。`, 'info');
    return this.notify({ success: true, type: 'COMMISSION_ACCEPTED', offer });
  }

  completeCommission(kind, tileId = null) {
    const player = this.currentPlayer, career = this.careers[player?.id], active = career?.active;
    if (!active || active.kind !== kind || active.dueRound < this.state.round || player.isBankrupt || this.state.phase === 'GAME_OVER'
      || (kind === 'DELIVERY' && active.targetId !== tileId)) return null;
    const reward = this.commissionReward(kind, player);
    career.active = null;
    career.settledRound = this.state.round;
    career.completed++;
    career.earned += reward.cash;
    career.last = { status: 'COMPLETE', kind, ...reward };
    player.cash += reward.cash;
    player.cardPoints += reward.points;
    this.state.addLog(`✉️ ${player.name} 完成【${kind === 'DELIVERY' ? '海风速递' : '街区焕新'}】，获得 ¥${reward.cash} 和 ${reward.points} 点券${reward.specialist ? '（含专长奖励）' : ''}。`, 'gold');
    const story=this.stories[player.id];
    const storyAdvanced=this.hasCoastFeatures&&story?.stage===1;
    if(storyAdvanced){story.stage=2;story.commissionKind=kind;this.state.addLog(`✦ ${player.name} 已办好便笺上的约定，下一站：8号找小栀取灯罩。`,'gold');}
    return {...career.last,storyAdvanced};
  }

  previewDestination(tileId) {
    const player=this.currentPlayer,landing=this.engine.inspectLanding(player,tileId);
    const action=landing.kind==='PURCHASE'?'BUY':landing.kind==='UPGRADE'?'UPGRADE':null;
    const cost=action?this.engine.getPropertyActionCost(player,tileId,action):null;
    return {tileId,name:landing.tile.name,kind:landing.kind,region:this.region(tileId),event:this.event(tileId),
      owner:landing.owner?.name??null,cost,blockedReason:action?this.getPropertyBlockReason(landing.kind,cost):''};
  }

  getTransportOptions() {
    if(!this.hasCoastFeatures)return [];
    const player=this.currentPlayer;
    const route=COAST_ROUTES.find(r=>r.from===player?.currentTile);
    if(!route)return [];
    return COAST_SERVICES.map(service=>({...service,routeId:route.id,routeName:route.name,from:route.from,
      destination:this.previewDestination(route.to),alternative:service.chance<100?this.previewDestination(route.divert):null,
      blockedReason:this.state.phase!=='PRE_ROLL_ACTION'||this.state.pendingMove||this.cardUsed||player.isBankrupt
        ?'仅在掷骰前可乘船':player.cash<service.fare?'船费不足':''}));
  }

  takeTransport(routeId,serviceId) {
    const option=this.getTransportOptions().find(o=>o.routeId===routeId&&o.id===serviceId);
    if(!option||option.blockedReason)return rejected(option?.blockedReason||'当前地点没有这条航线');
    const rngBefore=this.state.rng.state;
    const diverted=option.chance<100&&this.state.rng.int(1,100)>option.chance;
    const destination=diverted?option.alternative:option.destination;
    const result=this.command('TELEPORT_PLAYER',{tileId:destination.tileId});
    if(!result.success){this.state.rng.state=rngBefore;return this.notify(result);}
    // Commit fare and the outcome together before notifying/saving. Landing uses
    // the normal once-only ledger, so an animation interruption cannot redraw.
    this.currentPlayer.cash-=option.fare;
    this.lastTransport={routeId,serviceId,from:option.from,tileId:destination.tileId,fare:option.fare,diverted,
      description:`${option.name} · 船费 ¥${option.fare} · ${diverted?'受潮汐影响，改靠':'抵达'} ${destination.tileId}号 ${destination.name}。本回合不再掷骰，跳过起点不领奖。`};
    this.focus=null;this.lastRoll=null;
    this.state.addLog(`⚓ ${this.currentPlayer.name}：${this.lastTransport.description}`,'info');
    return this.notify({...result,type:'TRANSPORT_ARRIVED',transport:this.lastTransport});
  }

  chooseAITransport() {
    const player=this.currentPlayer,task=this.careers[player.id]?.active;
    const options=this.getTransportOptions().filter(o=>!o.blockedReason);
    const local=this.getTravelOptions();
    const localOpportunity=local.some(o=>['PURCHASE','UPGRADE'].includes(o.kind)&&!o.blockedReason&&o.cost<=player.cash-this.getAIPropertyBudget(o.tileId).reserve);
    // Public goals and costs only; prefer certainty, keep the same cash reserve.
    return options.find(o=>{
      const d=o.destination,delivery=task?.kind==='DELIVERY'&&task.targetId===d.tileId;
      const renewal=task?.kind==='RENEWAL'&&!localOpportunity&&['PURCHASE','UPGRADE'].includes(d.kind)&&!d.blockedReason;
      return (delivery||renewal)&&player.cash-o.fare-(renewal?d.cost:0)>=(renewal?this.getAIPropertyBudget(d.tileId).reserve:1800);
    });
  }

  /** Read-only route planning: no dice draws, money changes or landing effects. */
  getTravelOptions(direction=this.currentPlayer?.direction||1,fromTileId=this.currentPlayer?.currentTile) {
    const player=this.currentPlayer;
    if(!player)return [];
    return [1,2,3,4,5,6].map(steps=>{
      let path=this.state.mapRuntime.projectPath(fromTileId,steps,direction);
      const stop=path.findIndex(id=>this.state.propertyManager.getProperty(id)?.hasObstacle);if(stop>=0)path=path.slice(0,stop+1);
      return {steps,obstacleStop:stop>=0,...this.previewDestination(path.at(-1)),
        passesStart:path.includes(this.state.mapDefinition.spawnTile)};
    });
  }

  /** Compare visible ordinary-die stops; never sample future dice or events. */
  getTrailTurnPreview() {
    const p=this.currentPlayer,pm=this.state.propertyManager;
    const route=direction=>{
      const stops=this.getTravelOptions(direction).map(o=>({...o,rent:o.kind==='RENT'?pm.calculateToll(o.tileId,this.state.newsEffect,this.state.priceIndex):0}));
      return {direction,stops,meanRent:Math.round(stops.reduce((sum,o)=>sum+o.rent,0)/6)};
    };
    return {current:route(p.direction||1),reverse:route(-(p.direction||1))};
  }

  getPropertyBlockReason(kind=this.focus?.kind,cost=this.focus?.cost||0) {
    if(!['PURCHASE','UPGRADE'].includes(kind))return '';
    if(this.currentPlayer?.godType==='BAD')return `衰运影响中，暂时无法${kind==='PURCHASE'?'购买':'升级'}，可先路过`;
    return this.currentPlayer?.cash<cost?'现金不足，可先路过':'';
  }

  getTactics(){
    const p=this.currentPlayer;if(!p)return [];
    const timing=this.state.phase!=='PRE_ROLL_ACTION'||this.state.pendingMove||p.isBankrupt?'只能在自己的掷骰前操作':this.cardUsed?'本回合策略机会已使用；仍可普通掷骰':'';
    return SLICE_TACTICS.map(def=>{const card=cardManager.getCardById(def.id),cost=this.engine.getCardCost(p,card),count=p.cards.filter(id=>id===def.id).length;
      const targets=new CardRules(this.state).getTargets(p,card).map(t=>{
        if(def.id==='BORROW_PASS'){const r=counterRoute(this,p.direction||1);return {...t,detail:`只作用于${p.name}。沿当前方向普通1–6步，${r.stops.filter(o=>o.rent>0).length}/6种点数落到对手收费地；最高参考租金 ¥${r.maxRent} → 本回合 ¥0。围栏照常截停，不清路、不转向、不影响产权。未落到收费地也消耗；其他费用照常，不保护下一回合。仅供规划，不预测骰子或后续事件。`};}
        if(def.id==='SWAP_STOPS'){const other=this.state.players[t.id],before=counterRoute(this,p.direction||1).maxRent,after=counterRoute(this,p.direction||1,null,other.currentTile).maxRent;return {...t,detail:`你：${p.currentTile}号 → ${other.currentTile}号；${other.name}：${other.currentTile}号 → ${p.currentTile}号。双方方向不变，不结算落点。你接下来1–6步的最高参考租金 ¥${before} → ¥${after}（按当前产权与围栏，非必付金额）。对方下回合可转向、遥控或再次换站；住院、入狱、停留或梦游者不能交换。`};}
        if(def.id==='TURN_AROUND'){const other=this.state.players[t.id],direction=-(other.direction||1),next=this.state.mapRuntime.projectPath(other.currentTile,1,direction)[0];return {...t,detail:`${other.name}：${other.currentTile}号，转向后朝 ${next}号 ${this.state.getTile(next).name} 行进；不立即移动。`};}
        const prop=this.state.propertyManager.getProperty(t.id),owner=prop?.owner!=null?this.state.players[prop.owner]?.name:'无主',rent=prop?.owner!=null?this.state.propertyManager.calculateToll(t.id,this.state.newsEffect,this.state.priceIndex):0;
        return {...t,detail:`${t.id}号 ${t.label} · ${owner} · 参考租金 ¥${rent}。${def.id==='OBSTACLE'?'下一位经过者（含自己）在此停下并结算。':'清除后可继续通过；仍可能受其他事件影响。'}`};
      });
      return {...def,cost,count,targets,buyBlocked:timing||(p.cards.length>=CARD_CAPACITY?'卡片栏已满':p.cardPoints<cost?'点券不足':''),useBlocked:timing||(!count?'尚未持有':!targets.length?'没有合法目标':'')};
    });
  }
  buyTactic(id){const offer=this.getTactics().find(t=>t.id===id);if(!offer||offer.buyBlocked)return rejected(offer?.buyBlocked||'没有这件策略道具');return this.notify(this.command('BUY_CARD',{cardId:id}));}
  useTactic(id,targetId){
    const offer=this.getTactics().find(t=>t.id===id),target=offer?.targets.find(t=>String(t.id)===String(targetId));
    if(!offer||offer.useBlocked||!target)return rejected(offer?.useBlocked||'请选择合法目标');
    const result=this.command('USE_CARD',{cardId:id,targetId:target.id});
    if(result.success){
      this.cardUsed=true;result.tacticName=offer.name;
      let effect=id==='TURN_AROUND'?'方向已反转。':id==='CLEAR_ROAD'?'围栏已清除。':'围栏已放置，也会拦住自己。';
      if(id==='BORROW_PASS')effect='已举旗，仅本回合免租；围栏仍截停，其他费用照常。未遇收费地也消耗，下次自己行动时失效。';
      if(id==='SWAP_STOPS'){
        const e=result.events.find(e=>e.type==='POSITIONS_SWAPPED');
        effect=`${this.currentPlayer.name}从${e.from}号到${e.to}号，${target.label}从${e.to}号到${e.from}号；方向不变，未结算落点。对方下回合可转向、遥控或再次换站。`;
      }
      result.description=`${offer.name} → ${target.label}。${effect}本回合还需普通掷骰。`;
      this.state.addLog(`✦ ${this.currentPlayer.name}：${result.description}`,'accent');
    }
    return this.notify(result);
  }
  useAITactic(){
    if(this.cardUsed||this.state.phase!=='PRE_ROLL_ACTION')return null;
    const p=this.currentPlayer,pm=this.state.propertyManager,path=this.state.mapRuntime.projectPath(p.currentTile,6,p.direction||1);
    let id,target,swapReason;const counter=fenceCounterplay(this);
    if(counter&&counter.clearSaving>=150){id='CLEAR_ROAD';target=counter.tileId;}
    else{
      const danger=dir=>counterRoute(this,dir).maxRent;
      if(danger(p.direction||1)>=700&&danger(-(p.direction||1))<danger(p.direction||1)*.5){id='TURN_AROUND';target=p.id;}
      else{const swap=this.getTactics().find(t=>t.id==='SWAP_STOPS').targets.map(t=>({...t,rent:counterRoute(this,p.direction||1,null,this.state.players[t.id].currentTile).maxRent})).sort((a,b)=>a.rent-b.rent||a.id-b.id);
        if(swap[0]&&danger(p.direction||1)-swap[0].rent>=700){id='SWAP_STOPS';target=swap[0].id;swapReason=`换站后六种点数的最高参考租金由 ¥${danger(p.direction||1)} 降至 ¥${swap[0].rent}（按公开产权与围栏，未预测骰子）。`;}
        else if(counterRoute(this,p.direction||1).meanRent>=400&&danger(p.direction||1)>=700&&this.getTactics().find(t=>t.id==='BORROW_PASS').targets.length){id='BORROW_PASS';target=p.id;}
        else{const rivals=this.state.players.filter(o=>o.id!==p.id&&!o.isBankrupt);const nearby=rivals.flatMap(rival=>this.state.mapRuntime.projectPath(rival.currentTile,3,rival.direction||1));const legal=this.getTactics().find(t=>t.id==='OBSTACLE').targets;
        target=nearby.find(t=>!path.includes(t)&&pm.getProperty(t)?.owner===p.id&&pm.calculateToll(t,this.state.newsEffect,this.state.priceIndex)>=150&&legal.some(l=>l.id===t));if(target!==undefined)id='OBSTACLE';}}
    }
    if(!id){if(counter)this.state.addLog(`↔ ${p.name} 查看 ${counter.tileId}号围栏：保留时参考平均租金 ¥${counter.keep.meanRent}，清除后 ¥${counter.clear.meanRent}，暂不花卡清路。`,'info');return null;}const offer=this.getTactics().find(t=>t.id===id);
    if(!offer.count){if(offer.buyBlocked||p.cardPoints-offer.cost<45)return null;if(!this.buyTactic(id).success)return null;}
    const result=this.useTactic(id,target);if(result.success&&id==='CLEAR_ROAD'&&counter){const reason=`清路后六种点数的参考平均租金由 ¥${counter.keep.meanRent} 降至 ¥${counter.clear.meanRent}（未计个人状态与事件）。`;result.description+=reason;this.state.addLog(`↔ ${p.name}：${reason}`,'info');}if(result.success&&swapReason){result.description+=swapReason;this.state.addLog(`↔ ${p.name}：${swapReason}`,'info');}return result;
  }

  getRemoteSupply() {
    const player=this.currentPlayer,card=cardManager.getCardById('REMOTE_DICE');
    const cost=player?this.engine.getCardCost(player,card):card.cost;
    return {cost,points:player?.cardPoints||0,available:Boolean(player
      &&this.state.phase==='PRE_ROLL_ACTION'&&!this.cardUsed
      &&!player.cards.includes('REMOTE_DICE')&&player.cards.length<CARD_CAPACITY&&player.cardPoints>=cost)};
  }

  buyRemoteDice() {
    if(!this.getRemoteSupply().available)return rejected('请在掷骰前、没有遥控骰子且点券足够时补充');
    return this.notify(this.command('BUY_CARD',{cardId:'REMOTE_DICE'}));
  }

  /** A focused, existing remote-dice card, not a debug movement shortcut. */
  useRemoteDice(value) {
    if (this.cardUsed || this.state.phase !== 'PRE_ROLL_ACTION') return rejected('本回合不能再使用遥控骰子');
    if (!Number.isInteger(value) || value < 1 || value > 6) return rejected('请选择 1 至 6');
    const result = this.command('USE_CARD', { cardId: 'REMOTE_DICE', value });
    if (result.success) {
      this.cardUsed = true;
      this.lastRoll = { success: true, dice: [value], steps: result.followUp.steps, remote: true };
      this.focus = null;
      this.command('BEGIN_MOVE', { steps: result.followUp.steps, source: 'DICE' });
    }
    return this.notify(result);
  }

  endTurn() {
    if (!this.landingResolved) return rejected('请先完成落地结算');
    if (this.pendingEvent) return rejected('请先选择海岛来信的处理方案');
    const player = this.currentPlayer, career = this.careers[player.id], round = this.state.round;
    const result = this.command('END_TURN');
    // Expire at this player's deadline turn end, without a hidden penalty.
    if (result.success && career?.active && round >= career.active.dueRound) {
      career.last = { status: 'EXPIRED', kind: career.active.kind };
      career.active = null;
      career.settledRound = round;
      this.state.addLog(`✉️ ${player.name} 的委托已到期，没有扣款，下轮可接新单。`, 'info');
    }
    if (result.success) this.resetPresentation();
    return this.notify(result);
  }

  async playAITurn({ onRoll = async () => {}, onStep = async () => {}, onLanding = async () => {}, onTransport = async () => {}, onAbility = async () => {} } = {}) {
    if (this.aiRunning || !this.currentPlayer?.isAI || this.state.phase === 'GAME_OVER') return rejected('当前不是可执行的 AI 回合');
    if(this.state.phase==='AUCTION'||this.awaitingAuctionContinue)return {success:true,type:'AUCTION_PENDING'};
    this.aiRunning = true;
    const epoch = this.epoch;
    try {
      if (this.state.phase === 'PRE_ROLL_ACTION') {
        this.advanceAIStory();
        if (!this.careers[this.currentPlayer.id]?.active) this.acceptCommission(this.currentPlayer.characterId === 'ayu' ? 'DELIVERY' : 'RENEWAL');
        const ability=this.getAbilityPreview();
        // Public costs only. Keep a remote-dice budget unless cash is tight.
        const shouldUse=ability.id==='TOOL_KIT'?this.tiles.some(t=>this.state.propertyManager.getProperty(t.id)?.hasObstacle)&&this.currentPlayer.cardPoints-ability.cost>=45:ability.id==='CHART_DICE'?this.currentPlayer.cash-ability.cashCost>=1800&&(this.currentPlayer.cardPoints<45||this.currentPlayer.cash>=6000):(ability.id==='RELAY'||this.currentPlayer.cardPoints-ability.cost>=45||this.currentPlayer.cash<3000);
        if(!ability.blockedReason&&shouldUse){
          const result=this.useAbility();if(!result.success)return result;
          await onAbility(result,this);if(this.epoch!==epoch)return rejected('对局已变更');
        }
        const tactic=this.useAITactic();if(tactic?.success){await onAbility(tactic,this);if(this.epoch!==epoch)return rejected('对局已变更');}
        const construction=this.chooseAIConstruction();
        if(construction){const result=this.contractUpgrade(construction.tileId);if(!result.success)return result;await onAbility(result,this);if(this.epoch!==epoch)return rejected('对局已变更');}
        const transport=this.chooseAITransport();
        if(transport){
          const trip=this.takeTransport(transport.routeId,transport.id);
          if(!trip.success)return trip;
          await onTransport(trip.transport,this);
          if(this.epoch!==epoch)return rejected('对局已变更');
        }
      }
      if (this.state.phase === 'PRE_ROLL_ACTION') {
        const options=this.getTravelOptions();
        const assignment=this.careers[this.currentPlayer.id]?.active;
        const delivery=assignment?.kind==='DELIVERY'&&options.find(option=>option.tileId===assignment.targetId);
        const story=this.getStoryStatus(),storyStop=story.stage>=(this.hasCoastFeatures?2:1)&&story.stage<=3?options.find(o=>o.tileId===story.targetId):null;
        const opportunity=delivery||storyStop||options.find(option=>['PURCHASE','UPGRADE'].includes(option.kind)&&!option.blockedReason&&option.cost<=this.currentPlayer.cash-this.getAIPropertyBudget(option.tileId).reserve);
        // Use the same purchasable card and public route information as the human.
        if(opportunity&&(delivery||storyStop||assignment?.kind==='RENEWAL'||options.some(option=>option.kind==='RENT'))) {
          if(!this.currentPlayer.cards.includes('REMOTE_DICE'))this.buyRemoteDice();
          if(this.currentPlayer.cards.includes('REMOTE_DICE'))this.useRemoteDice(opportunity.steps);
        }
        const roll=this.state.pendingMove?this.lastRoll:this.roll();
        if (!roll.success) return roll;
        await onRoll(roll, this);
      }
      while (this.state.pendingMove && this.epoch === epoch) {
        const step = this.advanceMove();
        if (!step.success) return step;
        await onStep(step, this);
      }
      if (this.epoch !== epoch) return rejected('对局已变更');
      if (!this.landingResolved) this.resolveLanding();
      await onLanding(this.focus, this);
      if (this.epoch !== epoch) return rejected('对局已变更');
      if (this.state.phase === 'GAME_OVER') return { success: true, type: 'GAME_OVER' };
      if(this.state.phase==='AUCTION')return {success:true,type:'AUCTION_PENDING'};
      if (this.pendingEvent) {
        const choice=this.chooseAIIslandEvent();
        if(!choice.success)return choice;
        await onLanding(this.focus,this);
      }
      const savings=chooseSavings(this);if(savings){const result=this.useSavings(savings.id);if(!result.success)return result;await onLanding(this.focus,this);if(this.epoch!==epoch)return rejected('对局已变更');}
      // Same commands/costs as the human; keep the existing construction reserve policy.
      const budget=this.getAIPropertyBudget(),propertyChoice=['PURCHASE','UPGRADE'].includes(this.focus?.kind)&&(this.focus.kind!=='UPGRADE'||this.state.propertyManager.getProperty(this.focus.tileId).buildingType!=='PARK'||this.careers[this.currentPlayer.id]?.active?.kind==='RENEWAL');
      if(propertyChoice&&!this.getPropertyBlockReason()&&this.focus.cost<=this.currentPlayer.cash-1800&&this.focus.cost>this.currentPlayer.cash-budget.reserve){
        this.state.addLog(`${this.currentPlayer.name} 暂缓${this.focus.kind==='PURCHASE'?'购地':'升级'}：前方可达${budget.threat.tileId}号参考租金 ¥${budget.threat.rent}，按留现 ¥${budget.reserve} 判断；可达不等于必经，不预知下次骰子。`,'info');
      }
      if (propertyChoice&&!this.getPropertyBlockReason() && this.focus.cost <= this.currentPlayer.cash - budget.reserve) {
        if (this.focus.kind === 'PURCHASE') this.purchase(chooseCoastBusiness(this.state,this.currentPlayer,this.focus.tileId));
        else if (this.focus.kind === 'UPGRADE' && (this.state.propertyManager.getProperty(this.focus.tileId).buildingType!=='PARK'||this.careers[this.currentPlayer.id]?.active?.kind==='RENEWAL')) this.upgrade();
      }
      this.advanceAIStory();
      return this.endTurn();
    } finally { this.aiRunning = false; }
  }

  snapshot() {
    return { ...this.state.createSnapshot(), slice: { version: 1, focus: structuredClone(this.focus),
      lastRoll: structuredClone(this.lastRoll), lastMovementStop: structuredClone(this.lastMovementStop), landingResolved: this.landingResolved,
      decisionMade: this.decisionMade, cardUsed: this.cardUsed, careers: structuredClone(this.careers),pendingEvent:structuredClone(this.pendingEvent),lastTransport:structuredClone(this.lastTransport),abilities:structuredClone(this.abilities),stories:structuredClone(this.stories),auctionResults:structuredClone(this.auctionResults) } };
  }
  restore(snapshot) {
    if (snapshot?.mapId !== this.mapId || !snapshot.slice || snapshot.slice.version !== 1) return rejected('这不是当前地图的存档');
    const imported = this.saves.importSnapshot(snapshot);
    if (!imported.success) return imported;
    try {
      const state = new GameState({ seed: snapshot.seed });
      state.restoreSnapshot(imported.snapshot);
      this.state = state;
      this.engine = new GameEngine(state, { saveManager: this.saves });
      this.epoch++;
      this.resetPresentation();
      const ledger = structuredClone(snapshot.slice);
      this.focus = ledger.focus ?? null;
      this.lastRoll = ledger.lastRoll ?? null;
      this.lastMovementStop = ledger.lastMovementStop ?? null;
      this.landingResolved = Boolean(ledger.landingResolved);
      this.decisionMade = Boolean(ledger.decisionMade);
      this.cardUsed = Boolean(ledger.cardUsed);
      this.restoreCareers(ledger.careers);
      this.restoreAbilities(ledger.abilities);
      this.restoreStories(ledger.stories);
      this.pendingEvent=ledger.pendingEvent&&islandEvent(ledger.pendingEvent.tileId,this.mapId)?{tileId:ledger.pendingEvent.tileId,eventId:ledger.pendingEvent.eventId||'base'}:null;
      if(this.pendingEvent){const event=this.event(this.pendingEvent.tileId);this.focus={...this.focus,kind:'ISLAND_EVENT',tileId:this.pendingEvent.tileId,title:event.title,description:event.story,result:{success:true},cost:0};}
      this.lastTransport=ledger.lastTransport??null;
      this.auctionResults=Array.isArray(ledger.auctionResults)?ledger.auctionResults:[];
      return this.notify({ success: true, type: 'SLICE_RESTORED' });
    } catch (error) { return rejected(`存档无法恢复：${error.message}`); }
  }
  save() {
    if (!this.saves.storage) return rejected('浏览器不支持本地存档');
    return this.saves.write(sliceSaveKey(this.mapId), this.snapshot());
  }
  load() { const result = this.saves.read(sliceSaveKey(this.mapId)); return result.success ? this.restore(result.snapshot) : result; }
}
