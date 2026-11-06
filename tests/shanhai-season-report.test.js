import {it,expect} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
import {seasonReport} from '../src/shanhai/SliceSeasonReport.js';
const make=mapId=>{const s=new SliceSession({storage:null,mapId:mapId||'shanhai-coast'});s.start({seed:314,characterId:'xingluo',opponentId:'qinghe'});return s;};
const stable=s=>{const x=s.snapshot();delete x.savedAt;return x;};
it('only presents a finished season and uses the engine winner with cash tie-breaks',()=>{
 const s=make();expect(seasonReport(s)).toBe(null);const p=s.state.propertyManager.getProperty(1);p.owner=0;s.state.players[0].cash-=1200;s.state.checkWinCondition(true);const r=seasonReport(s);expect(r.rankings.map(p=>p.id)).toEqual([1,0]);expect(r.winner.id).toBe(s.state.winner.id);expect(r.rankings[0].assets.total).toBe(r.rankings[1].assets.total);
});
it.each(['shanhai-coast','shanhai-highland'])('reconciles each asset component against the engine on %s without changing state',map=>{
 const s=make(map),p=s.state.players[0],land=s.state.propertyManager.getProperty(1);land.owner=0;land.level=2;land.isMortgaged=true;land.mortgageValue=500;p.deposit=120;p.stocks[s.state.stockMarket.stocks[0].id]={shares:3};s.state.checkWinCondition(true);const before=stable(s),r=seasonReport(s),row=r.rankings.find(r=>r.id===0);expect(row.assets).toEqual(s.state.calculateAssetBreakdown(p));expect(row.parts.reduce((n,[,v])=>n+v,0)).toBe(row.assets.total);expect(row.assets.landValue).toBe(s.state.getTile(1).price-500);expect(row.story.title).toBe(s.getStoryStatus(p).title);expect(r.mapId).toBe(map);expect(stable(s)).toEqual(before);
});
it('keeps the surviving winner first even if a bankrupt row has more leftover assets',()=>{
 const s=make();s.state.players[0].isBankrupt=true;s.state.players[0].cash=99999;s.state.round=4;s.state.checkWinCondition();const r=seasonReport(s);expect(r.rankings.map(r=>r.id)).toEqual([1,0]);expect(r.reason).toContain('提前结束');expect(r.round).toBe(4);
});
it('selects actual retained logs, not invented milestones, and leaves missing old data explicit',()=>{
 const s=make();s.state.logHistory=[{msg:'星罗 在【海雾中的船期】选择帮忙搬运：现金 +¥300。'},{msg:'星罗 完成【海风速递】，获得 ¥600。'},{msg:'青禾 完成【街区焕新】，获得 ¥700。'},{msg:'星罗 成功购买【晨光小屋】(花费 $1200)！'},{msg:'青禾 购买了 1号乐透券'},{msg:'股票行情已更新'}];s.state.checkWinCondition(true);const r=seasonReport(s);expect(r.highlights.map(h=>h.text)).toEqual([s.state.logHistory[0].msg,s.state.logHistory[2].msg,s.state.logHistory[3].msg]);const snap=s.snapshot();delete snap.slice.careers;delete snap.slice.stories;delete snap.logHistory;const restored=make();expect(restored.restore(snap).success).toBe(true);const old=seasonReport(restored);expect(old.highlights).toEqual([]);expect(old.rankings.every(r=>r.completed===0)).toBe(true);expect(old.winner.id).toBe(s.state.winner.id);
});
it('clamps the season-end round and provides map-correct story progress after save restore',()=>{
 for(const map of ['shanhai-coast','shanhai-highland']){const s=make(map);s.state.round=17;s.state.checkWinCondition();const restored=make(map);expect(restored.restore(s.snapshot()).success).toBe(true);const r=seasonReport(restored);expect(r.round).toBe(16);expect(r.maxRounds).toBe(16);expect(r.suggestion).toContain(restored.storyName);expect(r.rankings.map(p=>p.characterId)).toContain('xingluo');}
});
