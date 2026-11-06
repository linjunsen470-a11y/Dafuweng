import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { chooseAIMarketAction, expireMarketOffers, getMarketAsset } from '../src/game/MarketRules.js';

function setup() {
  const state = new GameState({ seed: 8102 });
  state.setupGame([0, 1].map((profileIndex, index) => ({ profileIndex, name: `交易玩家 ${index + 1}`,
    isAI: index === 1, aiDifficulty: 'HARD', aiStrategy: index ? 'CARD' : 'PROPERTY' })), 30000, { mapId: 'city-loop' });
  return { state, engine: new GameEngine(state), seller: state.players[0], buyer: state.players[1] };
}

describe('player asset market', () => {
  it('values upgraded properties and rejects mortgages, duplicate listings, and extreme prices', () => {
    const { state, engine, seller } = setup();
    state.propertyManager.buyProperty(1, seller.id);
    state.propertyManager.upgradeProperty(1);
    const asset = getMarketAsset(state, 'PROPERTY', 1);
    expect(asset.referenceValue).toBeGreaterThan(state.getTile(1).price);
    expect(engine.createMarketOffer(seller, { kind: 'PROPERTY', contentId: 1, price: asset.referenceValue * 3 }).success).toBe(false);
    const listed = engine.createMarketOffer(seller, { kind: 'PROPERTY', contentId: 1, price: asset.referenceValue });
    expect(listed).toMatchObject({ success: true, offer: { referenceValue: asset.referenceValue, expiresRound: 6 } });
    expect(engine.createMarketOffer(seller, { kind: 'PROPERTY', contentId: 1, price: asset.referenceValue }).reason).toBe('该资产已经挂牌');
    engine.cancelMarketOffer(seller, listed.offer.id);
    state.propertyManager.getProperty(1).isMortgaged = true;
    expect(engine.createMarketOffer(seller, { kind: 'PROPERTY', contentId: 1, price: asset.referenceValue }).reason).toBe('抵押中的地产不能挂牌');
  });

  it('transfers one card, records the transaction, and supports cancellation', () => {
    const { state, engine, seller, buyer } = setup();
    seller.cards = ['REMOTE_DICE', 'REMOTE_DICE'];
    buyer.cards = [];
    const reference = getMarketAsset(state, 'CARD', 'REMOTE_DICE').referenceValue;
    const offer = engine.createMarketOffer(seller, { kind: 'CARD', contentId: 'REMOTE_DICE', price: reference });
    expect(engine.acceptMarketOffer(buyer, offer.offer.id)).toMatchObject({ success: true, price: reference });
    expect(seller.cards).toEqual(['REMOTE_DICE']);
    expect(buyer.cards).toEqual(['REMOTE_DICE']);
    expect(state.marketHistory.at(-1)).toMatchObject({ type: 'SOLD', buyerId: buyer.id });
    const next = engine.createMarketOffer(seller, { kind: 'CARD', contentId: 'REMOTE_DICE', price: reference });
    expect(engine.cancelMarketOffer(seller, next.offer.id)).toMatchObject({ success: true, type: 'MARKET_OFFER_CANCELLED' });
    expect(state.marketHistory.at(-1)).toMatchObject({ type: 'CANCELLED' });
  });

  it('expires stale offers and lets AI buy a discounted relevant asset while preserving reserve', () => {
    const { state, engine, seller, buyer } = setup();
    seller.cards = ['REMOTE_DICE'];
    buyer.cards = [];
    const reference = getMarketAsset(state, 'CARD', 'REMOTE_DICE').referenceValue;
    const offer = engine.createMarketOffer(seller, { kind: 'CARD', contentId: 'REMOTE_DICE', price: Math.round(reference * 0.75) });
    expect(chooseAIMarketAction(buyer, state)).toEqual({ type: 'BUY', offerId: offer.offer.id });
    buyer.cash = 1900;
    expect(chooseAIMarketAction(buyer, state)).toBeNull();
    state.round = offer.offer.expiresRound + 1;
    expect(expireMarketOffers(state)).toHaveLength(1);
    expect(state.marketOffers).toHaveLength(0);
    expect(state.marketHistory.at(-1)).toMatchObject({ type: 'EXPIRED' });
  });

  it('migrates basic V7 offers into V8 market records', () => {
    const { state, seller } = setup();
    seller.cards = ['REMOTE_DICE'];
    const legacy = state.createSnapshot();
    legacy.version = 7;
    delete legacy.marketHistory;
    legacy.marketOffers = [{ id: 'OLD', sellerId: seller.id, kind: 'CARD', contentId: 'REMOTE_DICE', price: 500 }];
    const restored = new GameState({ seed: 1 });
    restored.restoreSnapshot(legacy);
    expect(restored.createSnapshot()).toMatchObject({ version: 11, marketOffers: [{ id: 'OLD', createdRound: 1, expiresRound: 6 }], marketHistory: [] });
  });
});
