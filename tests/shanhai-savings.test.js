import {it,expect} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
import {makeSavingsKiosk} from '../src/shanhai/SliceHighlandArt.js';
const make=(mapId='shanhai-highland',seat=0)=>{const s=new SliceSession({storage:null,mapId});s.start({seed:314,playerCount:4});s.state.currentPlayerIndex=seat;return s;};
const land=(s,id=20)=>{s.currentPlayer.currentTile=id;s.state.phase='LANDING_ACTION';s.resetPresentation();s.resolveLanding();};
const stable=s=>{const v=s.snapshot();delete v.savedAt;return v;};
it('retains the original 30 points and makes savings optional, local and read-only to preview',()=>{
 const s=make(),points=s.currentPlayer.cardPoints;expect(s.getSavingsOptions().every(q=>q.blockedReason)).toBe(true);land(s);expect(s.currentPlayer.cardPoints).toBe(points+30);
 const before=stable(s);expect(s.getSavingsOptions()[0]).toMatchObject({amount:1000,cashAfter:15000,depositAfter:1000,projectedInterest:50,settlementRound:5});expect(stable(s)).toEqual(before);expect(s.endTurn().success).toBe(true);
 const coast=make('shanhai-coast');land(coast);expect(coast.getSavingsOptions()).toEqual([]);expect(coast.useSavings('store').success).toBe(false);
});
it('stores and withdraws through existing balances without changing net worth, cards, position or RNG',()=>{
 const s=make();land(s);const p=s.currentPlayer,net=s.state.calculateNetWorth(p),rng=s.state.rng.state,points=p.cardPoints;
 expect(s.useSavings('store')).toMatchObject({success:true,amount:1000,cash:15000,deposit:1000});expect(s.state.calculateNetWorth(p)).toBe(net);expect(s.cardUsed).toBe(false);expect(p.currentTile).toBe(20);expect(p.cardPoints).toBe(points);expect(s.state.rng.state).toBe(rng);
 const saved=s.snapshot(),copy=make();expect(copy.restore(saved).success).toBe(true);expect(copy.resolveLanding().success).toBe(false);expect(copy.currentPlayer.cardPoints).toBe(points);expect(copy.currentPlayer.deposit).toBe(1000);
 expect(copy.useSavings('take')).toMatchObject({success:true,cash:16000,deposit:0});const after=stable(copy);expect(copy.useSavings('take').success).toBe(false);expect(stable(copy)).toEqual(after);
});
it('rejects passing, wrong location/phase, bankruptcy and insufficient funds without mutation',()=>{
 for(const change of [s=>s.currentPlayer.currentTile=19,s=>s.state.phase='PRE_ROLL_ACTION',s=>s.landingResolved=false,s=>s.currentPlayer.isBankrupt=true,s=>s.currentPlayer.cash=999]){const s=make();land(s);change(s);const before=stable(s);expect(s.useSavings('store').success).toBe(false);expect(stable(s)).toEqual(before);}
});
it('uses actual five-round interest and automatic debt withdrawal rather than protecting money from rent',()=>{
 const s=make();land(s);s.useSavings('store');s.state.round=5;s.state.onRoundEnd();expect(s.currentPlayer.deposit).toBe(1050);expect(s.getSavingsOptions()[0].settlementRound).toBe(10);
 s.currentPlayer.cash=0;s.state.propertyManager.buyProperty(1,1);const toll=s.state.propertyManager.calculateToll(1,s.state.newsEffect,s.state.priceIndex,s.currentPlayer);land(s,1);expect(s.currentPlayer.isBankrupt).toBe(false);expect(s.currentPlayer.deposit).toBe(1050-toll);
 s.state.round=16;land(s);expect(s.getSavingsOptions()[0]).toMatchObject({settlementRound:20,settlesThisSeason:false});
});
it('restores old settled coupon visits without another reward and supports old deposit balances',()=>{
 const s=make();land(s);const old=s.snapshot();old.slice.focus.title='林场补给';old.players[0].deposit=1300;const copy=make();copy.restore(old);expect(copy.getSavingsOptions()[1].amount).toBe(1300);const pts=copy.currentPlayer.cardPoints;copy.useSavings('take');expect(copy.currentPlayer.cardPoints).toBe(pts);expect(copy.currentPlayer.deposit).toBe(0);
});
it('the fourth AI uses the same service and a restored completed transfer is not repeated',async()=>{
 const s=make('shanhai-highland',3);s.currentPlayer.currentTile=20;s.state.phase='LANDING_ACTION';let receipt;
 await s.playAITurn({onLanding:async f=>{if(f.result.type==='BANK_TRANSFERRED')receipt=s.snapshot();}});expect(receipt.players[3].deposit).toBe(1000);expect(s.currentPlayer.id).toBe(0);
 const copy=make();copy.restore(receipt);await copy.playAITurn();expect(copy.state.players[3].deposit).toBe(s.state.players[3].deposit);expect(copy.state.players[3].cash).toBe(s.state.players[3].cash);
 const poor=make('shanhai-highland',2);land(poor);poor.currentPlayer.cash=100;poor.currentPlayer.deposit=1300;await poor.playAITurn();expect(poor.state.players[2].cash).toBe(1400);expect(poor.state.players[2].deposit).toBe(0);
});
it('the original kiosk has a compact shared palette, stays off the numbered road and creates no textures',()=>{
 const g=makeSavingsKiosk(),materials=new Set();let meshes=0,triangles=0;g.traverse(m=>{if(m.isMesh){meshes++;materials.add(m.material);expect(m.material.map).toBeNull();triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;}});expect(g.name).toBe('mountain-savings-kiosk');expect(g.position.x).toBe(-13.3);expect(meshes).toBeLessThan(30);expect(materials.size).toBeLessThanOrEqual(7);expect(triangles).toBeLessThan(500);
});
