import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { MAP_DEFINITIONS } from '../src/game/MapData.js';
import { BUILDINGS, COMPANIES, GODS, ITEMS, MAGIC_CONDITIONS, MAGIC_EFFECTS, MINIGAMES } from '../src/game/ContentRegistry.js';
import { CHANCE_CARDS, NEWS_EVENTS } from '../src/game/EventManager.js';
import { CARD_CAPACITY, ITEM_CAPACITY } from '../src/game/InventoryManager.js';

function setup(mapId = 'fortune-crossroads', profiles = [0, 1]) {
  const state = new GameState({ seed: 24680, maxRounds: 40 });
  state.setupGame(profiles.map((profileIndex, index) => ({
    profileIndex,
    name: `验收玩家 ${index + 1}`,
    isAI: index > 0,
    aiDifficulty: 'HARD'
  })), 30000, { mapId });
  return { state, engine: new GameEngine(state), players: state.players };
}

describe('production content registry', () => {
  it('ships the promised strategy content counts with unique ids', () => {
    const catalogues = [BUILDINGS, COMPANIES, GODS, ITEMS, MAGIC_CONDITIONS, MAGIC_EFFECTS, MINIGAMES];
    expect(BUILDINGS).toHaveLength(5);
    expect(COMPANIES).toHaveLength(6);
    expect(GODS).toHaveLength(8);
    expect(ITEMS).toHaveLength(13);
    expect(MAGIC_CONDITIONS).toHaveLength(10);
    expect(MAGIC_EFFECTS).toHaveLength(10);
    expect(MINIGAMES).toHaveLength(3);
    expect(CHANCE_CARDS).toHaveLength(48);
    expect(NEWS_EVENTS).toHaveLength(24);
    catalogues.forEach(values => expect(new Set(values.map(value => value.id)).size).toBe(values.length));
  });

  it('gives every map a distinct topology and an economic/activity vertical slice', () => {
    const signatures = MAP_DEFINITIONS.map(map => map.tiles.map(tile => `${tile.id}:${(tile.next || []).join('.')}`).join('|'));
    expect(new Set(signatures).size).toBe(5);
    MAP_DEFINITIONS.forEach(map => {
      expect(map.tiles.some(tile => tile.type === 'BIG_PROPERTY'), `${map.id} commercial property`).toBe(true);
      expect(map.tiles.some(tile => tile.type === 'COMPANY'), `${map.id} company`).toBe(true);
      expect(map.tiles.some(tile => tile.type === 'MINIGAME'), `${map.id} minigame`).toBe(true);
    });
  });
});

describe('production economy vertical slice', () => {
  it.each([
    ['PARK', 'WALK', 0],
    ['GAS_STATION', 'WALK', 0],
    ['GAS_STATION', 'CAR', 1],
    ['MALL', 'WALK', 1],
    ['HOTEL', 'WALK', 1],
    ['LAB', 'WALK', 0]
  ])('applies %s commercial rent rules for a %s visitor', (buildingType, vehicle, expectedSign) => {
    const { state, players: [owner, visitor] } = setup();
    state.propertyManager.buyProperty(18, owner.id, buildingType);
    state.propertyManager.upgradeProperty(18);
    visitor.vehicle = vehicle;
    const toll = state.propertyManager.calculateToll(18, null, 1, visitor);
    expect(Math.sign(toll)).toBe(expectedSign);
  });

  it('enforces separate card and item capacities and supports buying and selling', () => {
    const { state, engine, players: [player] } = setup();
    player.cardPoints = 1000;
    while (player.items.length < ITEM_CAPACITY) expect(state.inventoryManager.addItem(player, 'BARRIER').success).toBe(true);
    expect(state.inventoryManager.addItem(player, 'MOTOR')).toMatchObject({ success: false, reason: '道具栏已满' });
    player.items.length = 0;
    expect(engine.buyItem(player, 'MOTOR')).toMatchObject({ success: true, cost: 80 });
    expect(engine.sellInventory(player, 'ITEM', 'MOTOR')).toMatchObject({ success: true, revenue: 40 });
    player.cards = Array(CARD_CAPACITY).fill('REMOTE_DICE');
    expect(player.cards).toHaveLength(8);
  });

  it('builds a lab, persists its queue, and completes deterministic research', () => {
    const { state, engine, players: [player] } = setup();
    player.currentTile = 18;
    state.phase = 'LANDING_ACTION';
    expect(engine.execute({ type: 'PURCHASE_PROPERTY', playerId: player.id, payload: { tileId: 18, buildingType: 'LAB' } }))
      .toMatchObject({ success: true, buildingType: 'LAB' });
    expect(engine.execute({ type: 'START_RESEARCH', playerId: player.id, payload: { tileId: 18, itemId: 'ROBOT_WORKER' } }).success).toBe(true);
    expect(state.createSnapshot().researchTasks).toHaveLength(1);
    state.processResearch();
    expect(player.items).toContain('ROBOT_WORKER');
    expect(state.researchTasks).toHaveLength(0);
  });

  it('assigns chairmen and distributes company dividends without creating money', () => {
    const { state, players } = setup();
    players[0].stocks.BEVERAGE = { shares: 30, avgPrice: 100 };
    players[1].stocks.BEVERAGE = { shares: 10, avgPrice: 100 };
    const company = state.companyManager.get('AURORA_RETAIL');
    company.periodRevenue = 1000;
    const cashBefore = players.reduce((sum, player) => sum + player.cash, 0);
    const treasuryBefore = company.treasury;
    expect(state.companyManager.updateChairmen(players)[0]).toMatchObject({ chairmanId: players[0].id });
    const settlement = state.companyManager.settle(players, { int: () => 0 }).find(item => item.companyId === company.id);
    const cashAfter = players.reduce((sum, player) => sum + player.cash, 0);
    expect(settlement.dividendPool).toBe(600);
    expect(cashAfter - cashBefore).toBe(treasuryBefore - company.treasury);
  });

  it('settles auctions and public market offers through the shared engine', () => {
    const { state, engine, players: [seller, buyer] } = setup('city-loop');
    state.propertyManager.buyProperty(1, seller.id);
    const sellerCash = seller.cash;
    const buyerCash = buyer.cash;
    expect(engine.startAuction(seller, 1, 500).success).toBe(true);
    expect(engine.placeBid(buyer, 800)).toMatchObject({ success: true, completed: true });
    expect(state.propertyManager.getProperty(1).owner).toBe(buyer.id);
    expect([seller.cash, buyer.cash]).toEqual([sellerCash + 800, buyerCash - 800]);

    const offer = engine.createMarketOffer(buyer, { kind: 'PROPERTY', contentId: 1, price: 900 });
    expect(engine.acceptMarketOffer(seller, offer.offer.id)).toMatchObject({ success: true, buyerId: seller.id });
    expect(state.propertyManager.getProperty(1).owner).toBe(seller.id);
  });

  it('queues bankrupt property for auction and pays proceeds to the creditor', () => {
    const { state, engine, players: [debtor, creditor, bidder] } = setup('city-loop', [0, 1, 2]);
    state.propertyManager.buyProperty(1, debtor.id);
    state.propertyManager.upgradeProperty(1);
    state.pendingDebt = { debtorId: debtor.id, creditorId: creditor.id, amountDue: 50000, source: 'TEST' };
    state.phase = 'DEBT_SETTLEMENT';
    const declared = engine.execute({ type: 'DECLARE_BANKRUPTCY', playerId: debtor.id });
    expect(declared).toMatchObject({ success: true, type: 'PLAYER_BANKRUPT', auction: { bankruptcy: true, tileId: 1 } });
    const creditorCash = creditor.cash;
    const bidderCash = bidder.cash;
    expect(engine.execute({ type: 'PLACE_BID', playerId: creditor.id, payload: { amount: 0 } }).success).toBe(true);
    const minimum = state.auction.minimumBid;
    expect(engine.execute({ type: 'PLACE_BID', playerId: bidder.id, payload: { amount: minimum } })).toMatchObject({ success: true, completed: true });
    expect(state.propertyManager.getProperty(1)).toMatchObject({ owner: bidder.id, level: 1 });
    expect(creditor.cash).toBe(creditorCash + minimum);
    expect(bidder.cash).toBe(bidderCash - minimum);
  });

  it('places and consumes road entities only through owned inventory', () => {
    const { state, engine, players: [player] } = setup();
    const before = player.items.filter(item => item === 'BARRIER').length;
    const placed = engine.execute({ type: 'PLACE_ROAD_ENTITY', playerId: player.id, payload: { entityType: 'BARRIER', tileId: 1 } });
    expect(placed.success).toBe(true);
    expect(state.roadEntities).toContainEqual(expect.objectContaining({ type: 'BARRIER', tileId: 1, ownerId: player.id }));
    expect(player.items.filter(item => item === 'BARRIER')).toHaveLength(before - 1);
  });

  it('validates minigame scores in the engine and caps the reward', () => {
    const { state, engine, players: [player] } = setup();
    state.minigameState = { playerId: player.id, gameId: 'HARBOR_SORT', tileId: 24, status: 'OPEN' };
    const before = player.cardPoints;
    expect(engine.submitMinigameResult(player, 'HARBOR_SORT', 999)).toMatchObject({ success: true, score: 100, reward: 200 });
    expect(player.cardPoints).toBe(before + 200);
    expect(state.minigameState).toBeNull();
  });
});

describe('V7 persistence contract', () => {
  it('round-trips production systems and news history while migrating V4 defaults', () => {
    const { state, engine, players } = setup();
    state.roadEntities.push({ id: 'R1', type: 'DOG', tileId: 4, ownerId: null });
    state.marketOffers.push({ id: 'O1', sellerId: 0, kind: 'CARD', contentId: 'REMOTE_DICE', price: 20 });
    state.propertyManager.buyProperty(1, players[0].id);
    engine.startAuction(players[0], 1, 500);
    state.minigameState = { playerId: players[0].id, gameId: 'HARBOR_SORT', tileId: 24, status: 'OPEN' };
    state.newsHistory.push({ id: 'NEWS_2', title: '中央银行降息利好', desc: '补贴到账', category: '民生', icon: '🎁', tone: 'benefit', round: 3, impacts: [] });
    const snapshot = state.createSnapshot();
    const restored = new GameState({ seed: 1 });
    restored.restoreSnapshot(snapshot);
    expect(restored.createSnapshot()).toMatchObject({
      version: 7,
      roadEntities: [{ id: 'R1' }],
      marketOffers: [{ id: 'O1' }],
      auction: { tileId: 1, highestBid: 0 },
      minigameState: { gameId: 'HARBOR_SORT' },
      newsHistory: [{ id: 'NEWS_2', round: 3 }]
    });
    const resumedEngine = new GameEngine(restored);
    expect(resumedEngine.execute({ type: 'PLACE_BID', playerId: 1, payload: { amount: 700 } })).toMatchObject({ success: true, completed: true });
    expect(restored.propertyManager.getProperty(1).owner).toBe(1);

    const legacy = { ...snapshot, version: 4 };
    delete legacy.roadEntities;
    delete legacy.companies;
    delete legacy.auction;
    delete legacy.marketOffers;
    delete legacy.researchTasks;
    delete legacy.economicCycle;
    delete legacy.minigameState;
    delete legacy.newsHistory;
    restored.restoreSnapshot(legacy);
    expect(restored.createSnapshot()).toMatchObject({ version: 7, roadEntities: [], marketOffers: [], researchTasks: [], newsHistory: [] });
  });
});
