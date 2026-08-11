import { describe, expect, it } from 'vitest';
import { getAIAuctionBid, getMinimumAuctionBid } from '../src/game/AuctionRules.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { GameState } from '../src/game/GameState.js';

function setup(playerCount = 4, cash = 12000) {
  const state = new GameState({ seed: 777 });
  state.setupGame(Array.from({ length: playerCount }, (_, index) => ({
    profileIndex: index,
    name: `竞拍者 ${index}`,
    isAI: index > 0,
    aiDifficulty: 'NORMAL'
  })), cash, { mapId: 'city-loop' });
  state.propertyManager.buyProperty(1, 0);
  return { state, engine: new GameEngine(state), players: state.players };
}

describe('multi-round property auctions', () => {
  it('continues raising bids until every challenger has passed', () => {
    const { state, engine, players } = setup();
    const sellerCash = players[0].cash;
    const buyerCash = players[1].cash;
    expect(engine.startAuction(players[0], 1, 500).success).toBe(true);

    expect(engine.placeBid(players[1], 600).completed).toBeUndefined();
    expect(engine.placeBid(players[2], 800).completed).toBeUndefined();
    expect(engine.placeBid(players[3], 0).completed).toBeUndefined();
    expect(state.auction).toMatchObject({ bidderIndex: 0, biddingRound: 2, highestBidderId: 2 });
    expect(engine.placeBid(players[1], 900).completed).toBeUndefined();
    const result = engine.placeBid(players[2], 0);

    expect(result).toMatchObject({ success: true, completed: true, auction: { status: 'RESOLVED', highestBid: 900, highestBidderId: 1, biddingRound: 2 } });
    expect(result.auction.bidHistory.map(record => record.action)).toEqual(['BID', 'BID', 'PASS', 'BID', 'PASS']);
    expect(state.propertyManager.getProperty(1).owner).toBe(1);
    expect(players[0].cash).toBe(sellerCash + 900);
    expect(players[1].cash).toBe(buyerCash - 900);
  });

  it('automatically eliminates challengers who cannot afford the next bid', () => {
    const { state, engine, players } = setup(3);
    players[2].cash = 550;
    engine.startAuction(players[0], 1, 500);
    const result = engine.placeBid(players[1], 500);

    expect(result).toMatchObject({ completed: true, auction: { highestBidderId: 1, passedBidderIds: [2] } });
    expect(result.auction.bidHistory).toContainEqual(expect.objectContaining({ playerId: 2, action: 'AUTO_PASS' }));
    expect(state.auction).toBeNull();
  });

  it('enforces the advertised one-hundred-dollar bid step', () => {
    const { state, engine, players } = setup(3);
    engine.startAuction(players[0], 1, 500);
    expect(engine.placeBid(players[1], 650)).toMatchObject({ success: false, minimum: 500 });
    expect(state.auction.bidHistory).toHaveLength(0);
    expect(state.auction.bidderIndex).toBe(0);
  });

  it('cancels the sale when all bidders pass without an opening bid', () => {
    const { state, engine, players } = setup(3);
    engine.startAuction(players[0], 1, 500);
    expect(engine.placeBid(players[1], 0).completed).toBeUndefined();
    const result = engine.placeBid(players[2], 0);

    expect(result).toMatchObject({ completed: true, auction: { status: 'CANCELLED', highestBidderId: null } });
    expect(state.propertyManager.getProperty(1).owner).toBe(0);
  });

  it('uses cash reserves and difficulty when AI values a lot', () => {
    const { state, engine, players } = setup(3);
    const bidder = players[1];
    bidder.cash = 2500;
    engine.startAuction(players[0], 1, 500);
    const minimum = getMinimumAuctionBid(state.auction);
    bidder.aiDifficulty = 'EASY';
    expect(getAIAuctionBid(bidder, state.auction, state)).toBe(0);
    bidder.aiDifficulty = 'HARD';
    expect(getAIAuctionBid(bidder, state.auction, state)).toBeGreaterThanOrEqual(minimum);
  });

  it('migrates a legacy in-progress auction with safe multi-round defaults', () => {
    const { state, engine, players } = setup(3);
    engine.startAuction(players[0], 1, 500);
    const legacy = state.createSnapshot();
    legacy.version = 6;
    delete legacy.auction.activeBidderIds;
    delete legacy.auction.passedBidderIds;
    delete legacy.auction.bidHistory;
    delete legacy.auction.biddingRound;
    delete legacy.phaseBeforeAuction;

    const restored = new GameState({ seed: 1 });
    restored.restoreSnapshot(legacy);
    expect(restored.auction).toMatchObject({ activeBidderIds: [1, 2], passedBidderIds: [], bidHistory: [], biddingRound: 1 });
    expect(restored.phaseBeforeAuction).toBe('PRE_ROLL_ACTION');
  });
});
