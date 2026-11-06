import {it,expect} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
import {auctionPropertyPreview} from '../src/shanhai/SliceCommerce.js';
const make=(mapId,park=false)=>{
 const s=new SliceSession({storage:null,mapId});s.start({seed:314,playerCount:4});s.state.currentPlayerIndex=1;s.currentPlayer.cash=0;s.currentPlayer.currentTile=17;
 Object.assign(s.state.propertyManager.getProperty(17),{owner:2,level:4});Object.assign(s.state.propertyManager.getProperty(park?12:3),{owner:1,level:0,buildingType:park?'PARK':'RESIDENTIAL'});
 for(const id of park?[11,13]:[1,2,5,6,7])s.state.propertyManager.getProperty(id).owner=0;
 s.state.phase='LANDING_ACTION';s.resolveLanding();return s;
};
const stable=s=>{const v=s.snapshot();delete v.savedAt;return v;};
it.each(['shanhai-coast','shanhai-highland'])('previews the winning owner and existing street rents without mutating saves/RNG on %s',map=>{
 const s=make(map);s.state.round=6;s.state.newsEffect={id:'DOUBLE_RENT',remainingRounds:2};const before=stable(s),q=auctionPropertyPreview(s.state,s.state.players[0],3),rival=auctionPropertyPreview(s.state,s.state.players[3],3);
 expect(q.affected).toHaveLength(5);expect(q.affected.every(r=>r.after===r.before*2)).toBe(true);expect(q.rent).toBe(rival.rent*2);expect(rival.affected).toEqual([]);expect(stable(s)).toEqual(before);
 const restored=new SliceSession({storage:null,mapId:map});expect(restored.restore(before).success).toBe(true);expect(auctionPropertyPreview(restored.state,restored.state.players[0],3)).toEqual(q);
 while(s.getAuctionView()){const v=s.getAuctionView();expect(s.bidAuction(v.bidder.id,v.bidder.id===0?4000:0,v.auction.id).success).toBe(true);}
 expect(s.state.players[0].cash).toBe(12000);expect(s.state.propertyManager.calculateToll(3,s.state.newsEffect,s.state.priceIndex)).toBe(q.rent);for(const r of q.affected)expect(s.state.propertyManager.calculateToll(r.tileId,s.state.newsEffect,s.state.priceIndex)).toBe(r.after);
});
it.each(['shanhai-coast','shanhai-highland'])('shows zero direct park rent and only the eligible neighbor gain on %s',map=>{
 const s=make(map,true);s.state.propertyManager.getProperty(11).isMortgaged=true;const before=stable(s),q=auctionPropertyPreview(s.state,s.state.players[0],12);expect(q.rent).toBe(0);expect(q.buildingName).toBe('邻里花园');expect(q.affected.map(r=>r.tileId)).toEqual([13]);expect(q.affected[0].after).toBe(Math.floor(q.affected[0].before*1.2));expect(stable(s)).toEqual(before);
 while(s.getAuctionView()){const v=s.getAuctionView();s.bidAuction(v.bidder.id,v.bidder.id===0?4000:0,v.auction.id);}expect(s.state.propertyManager.calculateToll(12)).toBe(0);expect(s.state.propertyManager.calculateToll(13)).toBe(q.affected[0].after);
});
it('preserves upgraded lots and ignores invalid or non-property targets',()=>{
 const s=make('shanhai-coast');s.state.propertyManager.getProperty(3).level=2;const q=auctionPropertyPreview(s.state,s.state.players[0],3);expect(q.level).toBe(2);expect(q.rent).toBe(s.state.getTile(3).tolls[2]*2);expect(auctionPropertyPreview(s.state,null,3)).toBe(null);expect(auctionPropertyPreview(s.state,s.state.players[0],0)).toBe(null);
});
