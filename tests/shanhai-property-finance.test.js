import {it,expect} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
const maps=['shanhai-coast','shanhai-highland'];
const make=(mapId=maps[0],seat=0)=>{const s=new SliceSession({mapId,storage:null});s.start({seed:314,playerCount:4});s.state.currentPlayerIndex=seat;s.state.propertyManager.buyProperty(1,seat);return s;};
const stable=s=>{const value=s.snapshot();delete value.savedAt;return value;};
it.each(maps)('%s quotes and mortgages/redeems through the engine without RNG, movement or strategy consumption',mapId=>{
 for(const seat of [0,3]){
  const s=make(mapId,seat),before=stable(s),q=s.getPropertyFinance(1),net=s.state.calculateNetWorth(s.currentPlayer);
  expect(stable(s)).toEqual(before);expect(q.blockedReason).toBe('');expect(q.principal).toBe(s.state.getTile(1).price/2);
  expect(s.financeProperty(1,q.action)).toMatchObject({success:true,type:'PROPERTY_MORTGAGED',value:q.principal});expect(s.currentPlayer.cash).toBe(q.cashAfter);expect(s.state.calculateNetWorth(s.currentPlayer)-net).toBe(q.netWorthDelta);expect(s.state.propertyManager.calculateToll(1)).toBe(q.afterRent);
  const after=stable(s);expect(s.financeProperty(1,q.action).success).toBe(false);expect(stable(s)).toEqual(after);
  const redeem=s.getPropertyFinance(1);expect(redeem.action).toBe('REDEEM_PROPERTY');const old=stable(s);const clone=make(mapId);expect(clone.restore(old).success).toBe(true);expect(clone.getPropertyFinance(1)).toEqual(redeem);
  expect(clone.financeProperty(1,redeem.action)).toMatchObject({success:true,cost:redeem.redeemCost});expect(clone.currentPlayer.cash).toBe(redeem.cashAfter);expect(clone.state.calculateNetWorth(clone.currentPlayer)-net).toBe(-redeem.fee);expect(clone.state.propertyManager.calculateToll(1)).toBe(redeem.afterRent);
  expect(clone.currentPlayer.currentTile).toBe(before.players[seat].currentTile);expect(clone.state.rng.state).toBe(before.rngState);expect(clone.cardUsed).toBe(false);expect(clone.state.phase).toBe('PRE_ROLL_ACTION');
 }
});
it('keeps buildings and rejects another owner, wrong phase, movement, bankruptcy, listing and research without side effects',()=>{
 const changes=[s=>s.state.propertyManager.getProperty(1).level=1,s=>s.state.phase='LANDING_ACTION',s=>s.state.phase='AUCTION',s=>s.state.phase='GAME_OVER',s=>s.currentPlayer.isBankrupt=true,s=>s.state.pendingMove={remainingSteps:2},s=>s.state.marketOffers.push({kind:'PROPERTY',contentId:1}),s=>s.state.researchTasks.push({tileId:1})];
 for(const change of changes){const s=make();change(s);const before=stable(s);expect(s.getPropertyFinance(1).blockedReason).toBeTruthy();expect(s.financeProperty(1,'MORTGAGE_PROPERTY').success).toBe(false);expect(stable(s)).toEqual(before);}
 const s=make();s.state.propertyManager.getProperty(1).owner=2;const before=stable(s);expect(s.getPropertyFinance(1)).toBeNull();expect(s.financeProperty(1,'MORTGAGE_PROPERTY').success).toBe(false);expect(stable(s)).toEqual(before);
});
it('requires the full redemption amount and restores older mortgage snapshots without new fields',()=>{
 const s=make();s.command('MORTGAGE_PROPERTY',{tileId:1});const old=s.snapshot(),copy=make();copy.restore(old);const q=copy.getPropertyFinance(1);copy.currentPlayer.cash=q.redeemCost-1;const before=stable(copy);expect(copy.financeProperty(1,'REDEEM_PROPERTY').success).toBe(false);expect(stable(copy)).toEqual(before);copy.currentPlayer.cash=q.redeemCost;expect(copy.financeProperty(1,'REDEEM_PROPERTY').success).toBe(true);expect(copy.currentPlayer.cash).toBe(0);
});
it.each(maps)('%s reports actual garden neighbor losses and restoration; monopoly follows existing rules',mapId=>{
 const s=make(mapId),pm=s.state.propertyManager;pm.buyProperty(12,0,'PARK');pm.buyProperty(11,0);pm.buyProperty(13,0);s.state.newsEffect={id:'DOUBLE_RENT'};s.state.round=6;
 const q=s.getPropertyFinance(12);expect(q.currentRent).toBe(0);expect(q.affected.map(r=>r.tileId)).toEqual([11,13]);expect(q.affected.every(r=>r.before>r.after)).toBe(true);s.financeProperty(12,q.action);
 for(const r of q.affected)expect(pm.calculateToll(r.tileId,s.state.newsEffect,s.state.priceIndex)).toBe(r.after);
 const back=s.getPropertyFinance(12);s.financeProperty(12,back.action);for(const r of back.affected)expect(pm.calculateToll(r.tileId,s.state.newsEffect,s.state.priceIndex)).toBe(r.after);
 const ids=s.tiles.filter(t=>t.group===s.state.getTile(1).group&&t.type==='PROPERTY').map(t=>t.id);for(const id of ids)pm.buyProperty(id,0);const monopoly=s.getPropertyFinance(1);expect(monopoly.affected).toEqual([]);
});
it('shows cash exposure along current direction, respecting a stopping fence and excluding unreachable/free lots',()=>{
 const s=make(),pm=s.state.propertyManager;pm.buyProperty(5,1);pm.getProperty(5).level=4;s.currentPlayer.cash=500;
 const q=s.getPropertyFinance(1);expect(q.threat.tileId).toBe(5);expect(q.cashAfter).toBe(500+q.principal);pm.getProperty(2).hasObstacle=true;expect(s.getPropertyFinance(1).threat).toBeNull();pm.getProperty(2).hasObstacle=false;s.currentPlayer.direction=-1;expect(s.getPropertyFinance(1).threat).toBeNull();
});
it('compares an existing upgrade with hold/mortgage and keeps the existing strategy lock',()=>{
 const s=make();s.state.round=8;const build=s.getConstructionOptions()[0];s.financeProperty(1,'MORTGAGE_PROPERTY');expect(s.contractUpgrade(1).success).toBe(false);s.financeProperty(1,'REDEEM_PROPERTY');expect(s.contractUpgrade(1)).toMatchObject({success:true,cost:build.cost});expect(s.cardUsed).toBe(true);expect(s.getPropertyFinance(1).blockedReason).toContain('建筑');
});
