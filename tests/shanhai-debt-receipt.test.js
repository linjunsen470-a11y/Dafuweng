import {it,expect} from 'vitest';import {SliceSession} from '../src/shanhai/SliceSession.js';import {debtReceipt} from '../src/shanhai/SliceDebtReceipt.js';
const make=(mapId='shanhai-highland',deposit=5000,seat=0)=>{const s=new SliceSession({storage:null,mapId});s.start({seed:314,playerCount:4});s.state.round=14;s.state.currentPlayerIndex=seat;s.currentPlayer.cash=200;s.currentPlayer.deposit=deposit;s.currentPlayer.currentTile=2;s.state.phase='LANDING_ACTION';Object.assign(s.state.propertyManager.getProperty(2),{owner:2,level:4});return s;};
const stable=s=>{const v=s.snapshot();delete v.savedAt;return v;};
it('shows actual deposit liquidation and paid rent on both maps without changing any game state',()=>{
 for(const map of ['shanhai-coast','shanhai-highland']){const s=make(map);s.resolveLanding();const before=stable(s),r=debtReceipt(s);expect(r).toMatchObject({paid:r.due,shortfall:0,bankrupt:false,depositUsed:r.due-200,cash:0,deposit:5200-r.due});expect(stable(s)).toEqual(before);const copy=make(map);copy.restore(s.snapshot());expect(debtReceipt(copy)).toEqual(r);expect(stable(copy)).toEqual(before);}
});
it('distinguishes partial payment from debt owed at bankruptcy and survives auction proceeds',()=>{
 const s=make('shanhai-highland',100);Object.assign(s.state.propertyManager.getProperty(3),{owner:0,level:1});s.resolveLanding();const r=debtReceipt(s);expect(r.bankrupt).toBe(true);expect(r.depositUsed).toBe(100);expect(r.buildingSold).toBeGreaterThan(0);expect(r.mortgaged).toBeGreaterThan(0);expect(r.shortfall).toBe(r.due-r.paid);expect(r.paid).toBe(300+r.buildingSold+r.mortgaged);const before=stable(s);expect(debtReceipt(s)).toEqual(r);expect(stable(s)).toEqual(before);
 while(s.getAuctionView())expect(s.bidAuctionAI().success).toBe(true);expect(debtReceipt(s)).toEqual(r);
});
it('uses the same receipt for the fourth AI and hides incomplete old records rather than guessing',()=>{
 const s=make('shanhai-coast',100,3);s.resolveLanding();expect(debtReceipt(s)).toMatchObject({name:s.state.players[3].name,paid:300,depositUsed:100,bankrupt:true});delete s.focus.result.rentResult;expect(debtReceipt(s).paid).toBe(300);delete s.focus.result.events;expect(debtReceipt(s)).toBeNull();
});
it('does not show debt for cash payments, waived rents or a new turn',()=>{
 const s=make();s.currentPlayer.cash=10000;s.resolveLanding();expect(debtReceipt(s)).toBeNull();s.resetPresentation();expect(debtReceipt(s)).toBeNull();
});
