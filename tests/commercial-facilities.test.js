import { beforeEach, describe, expect, it } from 'vitest';
import { GameEngine } from '../src/game/GameEngine.js';
import { GameState } from '../src/game/GameState.js';
import { COMMERCIAL_FACILITY_SERVICES } from '../src/game/CommercialFacilityRules.js';

describe('commercial facility visits', () => {
  let state;
  let engine;
  let visitor;
  let owner;

  beforeEach(() => {
    state = new GameState({ seed: 8127 });
    state.setupGame([
      { profileIndex: 0, name: '访客', isAI: false },
      { profileIndex: 1, name: '业主', isAI: true }
    ], 30000, { mapId: 'fortune-crossroads' });
    engine = new GameEngine(state);
    [visitor, owner] = state.players;
  });

  function build(type, level = 0) {
    state.propertyManager.buyProperty(18, owner.id, type);
    for (let index = 0; index < level; index++) state.propertyManager.upgradeProperty(18);
  }

  function facilityEvent(result) {
    return result.events?.find(event => event.type === 'COMMERCIAL_FACILITY_VISITED');
  }

  it('defines a distinct service for every large commercial building', () => {
    expect(Object.keys(COMMERCIAL_FACILITY_SERVICES).sort()).toEqual(['GAS_STATION', 'HOTEL', 'LAB', 'MALL', 'PARK']);
  });

  it('makes parks free while granting rest points and one negative immunity', () => {
    build('PARK', 1);
    const points = visitor.cardPoints;
    const result = engine.settleRent(visitor, 18);
    expect(result).toMatchObject({ success: true, type: 'RENT_WAIVED', amount: 0 });
    expect(facilityEvent(result)).toMatchObject({ buildingType: 'PARK', benefitKind: 'PARK_REST', amount: 30, duration: 1 });
    expect(visitor).toMatchObject({ cardPoints: points + 30, negativeImmuneTurns: 1 });
  });

  it('returns level-scaled membership points after a mall payment', () => {
    build('MALL', 2);
    const points = visitor.cardPoints;
    const result = engine.settleRent(visitor, 18);
    expect(result.type).toBe('RENT_PAID');
    expect(facilityEvent(result)).toMatchObject({ buildingType: 'MALL', benefitKind: 'MALL_REBATE', amount: 35 });
    expect(visitor.cardPoints).toBe(points + 35);
  });

  it('uses an independent hotel stay instead of hospital confinement', () => {
    build('HOTEL', 4);
    const result = engine.settleRent(visitor, 18);
    expect(facilityEvent(result)).toMatchObject({ buildingType: 'HOTEL', benefitKind: 'HOTEL_STAY', duration: 3 });
    expect(visitor.hotelTurns).toBe(3);
    expect(visitor.hospitalTurns).toBe(0);
  });

  it('boosts the next two vehicle rolls at an energy station', () => {
    build('GAS_STATION', 1);
    visitor.vehicle = 'CAR';
    visitor.selectedDiceCount = 1;
    const result = engine.settleRent(visitor, 18);
    expect(facilityEvent(result)).toMatchObject({ buildingType: 'GAS_STATION', benefitKind: 'FUEL_BOOST', duration: 2 });
    expect(visitor.fuelBoostTurns).toBe(2);
    state.rng.int = () => 2;
    state.phase = 'PRE_ROLL_ACTION';
    expect(engine.rollDice(visitor)).toMatchObject({ dice: [2], steps: 3, bonusSteps: 1 });
    expect(visitor.fuelBoostTurns).toBe(1);

    visitor.vehicle = 'ENGINEER';
    visitor.engineeringTurns = 1;
    state.tickPlayerStatuses(visitor);
    expect(visitor).toMatchObject({ vehicle: 'WALK', fuelBoostTurns: 0 });

    visitor.vehicle = 'CAR';
    visitor.fuelBoostTurns = 2;
    engine.resolveChanceEffect(visitor, { kind: 'VEHICLE', vehicle: 'WALK', title: '载具检修' });
    expect(visitor).toMatchObject({ vehicle: 'WALK', fuelBoostTurns: 0 });
  });

  it('shares research open-day points with both visitor and owner', () => {
    build('LAB', 3);
    const visitorPoints = visitor.cardPoints;
    const ownerPoints = owner.cardPoints;
    const result = engine.settleRent(visitor, 18);
    expect(result.type).toBe('RENT_WAIVED');
    expect(facilityEvent(result)).toMatchObject({ buildingType: 'LAB', benefitKind: 'LAB_OPEN_DAY', amount: 55, ownerAmount: 25 });
    expect(visitor.cardPoints).toBe(visitorPoints + 55);
    expect(owner.cardPoints).toBe(ownerPoints + 25);
  });

  it('does not grant paid services while the visitor is insolvent', () => {
    build('MALL', 4);
    visitor.cash = 1;
    const points = visitor.cardPoints;
    const result = engine.settleRent(visitor, 18);
    expect(result.type).toBe('DEBT_REQUIRED');
    expect(result.events?.some(event => event.type === 'COMMERCIAL_FACILITY_VISITED')).not.toBe(true);
    expect(visitor.cardPoints).toBe(points);

    visitor.cash = result.amountDue;
    const paid = engine.execute({ type: 'PAY_DEBT', playerId: visitor.id });
    expect(paid.events).toContainEqual(expect.objectContaining({
      type: 'COMMERCIAL_FACILITY_VISITED', buildingType: 'MALL', benefitKind: 'MALL_REBATE'
    }));
    expect(visitor.cardPoints).toBe(points + 55);
  });

  it('persists hotel and fuel statuses and skips hotel turns synchronously', () => {
    visitor.hotelTurns = 2;
    visitor.fuelBoostTurns = 1;
    const restored = new GameState({ seed: 1 });
    restored.restoreSnapshot(state.createSnapshot());
    expect(restored.players[0]).toMatchObject({ hotelTurns: 2, fuelBoostTurns: 1 });

    visitor.hotelTurns = 0;
    owner.hotelTurns = 1;
    const transition = state.nextTurn();
    expect(transition.gameOver).toBe(false);
    expect(state.currentPlayerIndex).toBe(visitor.id);
    expect(owner.hotelTurns).toBe(0);
    expect(state.logHistory.some(entry => entry.msg.includes('旅馆入住'))).toBe(true);
  });
});
