import {it,expect} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
import {propertyDecision} from '../src/shanhai/SliceCommerce.js';
import {captureAITurn,summarizeAITurn} from '../src/shanhai/SliceTurnSummary.js';
const make=()=>{const s=new SliceSession({storage:null});s.start({seed:314});return s;};
const stable=s=>{const snap=s.snapshot();delete snap.savedAt;return snap;};
it('explains a real AI purchase and commission separately from its net cash change without mutating state',async()=>{
 const s=make();s.useRemoteDice(2);s.resolveMovement();s.resolveLanding();s.endTurn();const before=captureAITurn(s);expect((await s.playAITurn()).success).toBe(true);const snapshot=stable(s),r=summarizeAITurn(s,before);expect(r).toMatchObject({name:'青禾',round:1,partial:false,cashDelta:-500,completed:1,tileId:1});expect(r.changes).toEqual(['新增产权 1号 晨光小屋 · L0']);expect(r.logs.some(l=>l.includes('1,200'))).toBe(true);expect(r.logs.some(l=>l.includes('700'))).toBe(true);expect(stable(s)).toEqual(snapshot);
});
it('labels resumed actions and reports lost or upgraded property using copied before-state',()=>{
 const s=make();s.state.currentPlayerIndex=1;s.state.phase='LANDING_ACTION';s.state.propertyManager.buyProperty(1,1);s.state.propertyManager.buyProperty(3,1);const before=captureAITurn(s);s.state.propertyManager.getProperty(1).level=2;s.state.propertyManager.getProperty(3).owner=0;s.currentPlayer.cash-=600;s.state.addLog('青禾继续了上次的行动');const r=summarizeAITurn(s,before);expect(r.partial).toBe(true);expect(r.changes).toEqual(['1号 晨光小屋 · L0 → L2','失去 3号 海盐面包坊']);expect(r.logs).toEqual(['青禾继续了上次的行动']);expect(before.properties.get(1).level).toBe(0);
});
it('ordinary purchase and upgrade previews use real rents, news and public route risk without changing RNG or assets',()=>{
 const s=make(),p=s.currentPlayer;p.currentTile=2;p.cash=1800;s.state.propertyManager.buyProperty(5,1);s.state.propertyManager.getProperty(5).level=3;s.state.newsEffect={id:'DOUBLE_RENT',remainingRounds:2};const before=stable(s),v=propertyDecision(s.state,p,2,'PURCHASE',1200);expect(v).toMatchObject({cashAfter:600,current:0,after:300,increase:300,threat:{tileId:5,rent:2800}});expect(stable(s)).toEqual(before);
 s.state.propertyManager.buyProperty(2,0);const upgrade=propertyDecision(s.state,p,2,'UPGRADE',600);expect(upgrade).toMatchObject({current:300,after:800,increase:500,cashAfter:1200});s.state.propertyManager.getProperty(5).isMortgaged=true;expect(propertyDecision(s.state,p,2,'UPGRADE',0).threat).toBeNull();expect(propertyDecision(s.state,p,12,'PURCHASE',3200)).toBeNull();
});

it('captures start-of-turn effects and a skipped AI turn without pretending it bought or rolled',()=>{
 const s=make();s.useRemoteDice(2);s.resolveMovement();s.resolveLanding();const ai=s.state.players[1];ai.hospitalTurns=1;const before=captureAITurn(s,ai);expect(before.partial).toBe(false);expect(s.endTurn().success).toBe(true);expect(s.currentPlayer.id).toBe(0);const r=summarizeAITurn(s,before);expect(r.logs.some(l=>l.includes('青禾')&&l.includes('跳过'))).toBe(true);expect(r.changes).toEqual([]);expect(r.cashDelta).toBe(ai.cash-before.cash);
});
