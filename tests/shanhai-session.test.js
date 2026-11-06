import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SliceSession, SHANHAI_COAST_MAP, SLICE_CHARACTERS, SLICE_SAVE_KEY } from '../src/shanhai/SliceSession.js';
import { MAP_DEFINITIONS, getMapDefinition } from '../src/game/MapData.js';
import { GameState } from '../src/game/GameState.js';

const make = (options = {}) => { const s = new SliceSession(options); s.start(options); return s; };
// Fixtures are restored through the production save path; gameplay never sets positions or money.
function land(session, tileId, playerId = 0) {
  const snap = session.snapshot();
  snap.currentPlayerIndex = playerId;
  snap.players[playerId].currentTile = tileId;
  snap.phase = 'LANDING_ACTION';
  snap.pendingMove = null;
  snap.slice = { version: 1, focus: null, lastRoll: null, landingResolved: false, decisionMade: false, cardUsed: false };
  expect(session.restore(snap).success).toBe(true);
  return session.resolveLanding();
}
const stable = snapshot => JSON.parse(JSON.stringify(snapshot, (key, value) => ['savedAt', 'generatedAt'].includes(key) ? undefined : value));

beforeEach(() => { vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-05T12:00:00Z')); });
afterEach(() => vi.useRealTimers());

describe('Shanhai coastal slice', () => {
  it('continues real turns with no storage and reports quota errors without losing state', () => {
    const unavailable=make({storage:null});
    expect(unavailable.useRemoteDice(1).success).toBe(true);
    unavailable.resolveMovement();unavailable.resolveLanding();
    expect(unavailable.purchase().success).toBe(true);
    expect(unavailable.save().success).toBe(false);
    expect(unavailable.endTurn().success).toBe(true);
    const full=make({storage:{getItem:()=>null,setItem:()=>{throw new Error('QuotaExceededError');}}});
    const before=stable(full.snapshot());
    expect(full.save().success).toBe(false);
    expect(stable(full.snapshot())).toEqual(before);
  });

  it('previews all six destinations without touching RNG, cash or landing state', () => {
    const s=make();const before=stable(s.snapshot());
    expect(s.getTravelOptions().map(o=>o.tileId)).toEqual([1,2,3,4,5,6]);
    expect(s.getTravelOptions()[0]).toMatchObject({kind:'PURCHASE',cost:1200});
    expect(s.getTravelOptions()[3].kind).toBe('SPECIAL');
    expect(stable(s.snapshot())).toEqual(before);
    const reverse=s.snapshot();reverse.players[0].currentTile=1;reverse.players[0].direction=-1;
    expect(s.restore(reverse).success).toBe(true);
    expect(s.getTravelOptions()[1]).toMatchObject({tileId:23,passesStart:true});
  });

  it('marks both route planning and landing decisions as blocked by bad luck', () => {
    const s=make();const snap=s.snapshot();snap.players[0].godType='BAD';snap.players[0].godTurns=3;s.restore(snap);
    expect(s.getTravelOptions()[0].blockedReason).toContain('衰运');
    land(s,1);const cash=s.currentPlayer.cash;
    expect(s.getPropertyBlockReason()).toContain('衰运');
    expect(s.purchase().success).toBe(false);
    expect(s.currentPlayer.cash).toBe(cash);
    expect(s.endTurn().success).toBe(true);
  });

  it('exchanges points once, persists the new card, and rejects wrong-phase or duplicate supply', async () => {
    const s=make();expect(s.buyRemoteDice().success).toBe(false);
    s.useRemoteDice(1);s.resolveMovement();s.resolveLanding();
    expect(s.buyRemoteDice().success).toBe(false);
    s.endTurn();await s.playAITurn();
    const points=s.currentPlayer.cardPoints,cash=s.currentPlayer.cash;
    const cost=s.getRemoteSupply().cost;
    expect(s.buyRemoteDice()).toMatchObject({success:true,cost});
    expect(s.currentPlayer.cardPoints).toBe(points-cost);
    expect(s.currentPlayer.cash).toBe(cash);
    expect(s.buyRemoteDice().success).toBe(false);
    const restored=new SliceSession();expect(restored.restore(s.snapshot()).success).toBe(true);
    expect(restored.currentPlayer.cards.filter(c=>c==='REMOTE_DICE')).toHaveLength(1);
    expect(restored.useRemoteDice(2).success).toBe(true);
    expect(restored.buyRemoteDice().success).toBe(false);
  });

  it('lets AI spend the same points and consume a remote card to avoid enemy rent', async () => {
    const s=make();land(s,1,0);s.purchase();
    const snap=s.snapshot();snap.currentPlayerIndex=1;snap.phase='PRE_ROLL_ACTION';
    snap.players[1].currentTile=0;snap.players[1].cards=[];
    snap.slice={version:1,focus:null,lastRoll:null,landingResolved:false,decisionMade:false,cardUsed:false};
    s.restore(snap);const before=s.currentPlayer.cardPoints;let usedRemote=false;
    expect((await s.playAITurn({onRoll:async roll=>{usedRemote=Boolean(roll.remote);}})).success).toBe(true);
    expect(usedRemote).toBe(true);
    expect(s.state.players[1].cardPoints).toBe(before-45+35);
    expect(s.careers[1]).toMatchObject({completed:1,earned:700});
    expect(s.state.players[1].cards).not.toContain('REMOTE_DICE');
    expect(s.state.propertyManager.getProperty(2).owner).toBe(1);
  });

  it('adds an isolated 24-node map without changing legacy picker/maps/snapshots', () => {
    expect(MAP_DEFINITIONS.map(m => m.id)).toEqual(['grand-bay', 'fortune-crossroads', 'city-loop', 'island-fork', 'taiwan-loop']);
    expect(SHANHAI_COAST_MAP.tiles).toHaveLength(24);
    expect(getMapDefinition('shanhai-coast')).toBe(SHANHAI_COAST_MAP);
    expect(SHANHAI_COAST_MAP.tiles.filter(t => t.type === 'BIG_PROPERTY')).toHaveLength(1);
    const old = new GameState({ seed: 41 });
    old.setupGame([{ profileIndex: 0 }, { profileIndex: 1 }], 20000, { mapId: 'grand-bay' });
    const before = old.createSnapshot();
    make();
    const restored = new GameState(); restored.restoreSnapshot(before);
    expect(stable(restored.createSnapshot())).toEqual(stable(before));
    expect(restored.mapDefinition.tiles).toHaveLength(120);
  });

  it('gives original selectable identities the same starting economy', () => {
    const s = make({ characterId: 'qinghe' });
    expect(s.currentPlayer.name).toBe('青禾');
    expect(s.state.players[1].name).toBe('阿屿');
    expect(s.state.players.map(p => p.cash)).toEqual([16000, 16000]);
    expect(s.state.players.map(p => p.skillName)).toEqual(['街区园艺师', '顺风速递']);
    expect(SLICE_CHARACTERS).toHaveLength(4);
  });

  it('runs deterministic complete human/AI games with visible AI steps', async () => {
    async function run() {
      const s = make({ seed: 816, maxRounds: 8 });
      let aiSteps = 0;
      let safety = 0;
      while (s.state.phase !== 'GAME_OVER' && safety++ < 100) {
        if (s.currentPlayer.isAI) {
          expect((await s.playAITurn({ onStep: async r => { expect(r.success).toBe(true); aiSteps++; } })).success).toBe(true);
        } else {
          expect(s.roll().success).toBe(true);
          expect(s.roll().success).toBe(false);
          expect(s.resolveMovement().success).toBe(true);
          expect(s.resolveLanding().success).toBe(true);
          if (s.pendingEvent) expect(s.chooseIslandEvent(s.getIslandChoices()[0].id).success).toBe(true);
          if (s.focus.kind === 'PURCHASE') s.purchase();
          if (s.focus.kind === 'UPGRADE') s.upgrade();
          if (s.state.phase !== 'GAME_OVER') expect(s.endTurn().success).toBe(true);
        }
      }
      expect(safety).toBeLessThan(100);
      expect(aiSteps).toBeGreaterThan(0);
      expect(s.state.phase).toBe('GAME_OVER');
      return s;
    }
    const a = await run(), b = await run();
    expect(stable(a.snapshot())).toEqual(stable(b.snapshot()));
  });

  it('charges one purchase and one upgrade per landing and caps buildings at level 4', () => {
    const s = make({ initialCash: 50000 });
    land(s, 1);
    const cash = s.currentPlayer.cash;
    expect(s.purchase()).toMatchObject({ success: true, cost: 1200, level: 0 });
    expect(s.purchase().success).toBe(false);
    expect(s.upgrade().success).toBe(false);
    expect(s.currentPlayer.cash).toBe(cash - 1200);
    expect(s.state.propertyManager.getProperty(1).buildingType).toBe('RESIDENTIAL');
    for (let level = 1; level <= 4; level++) {
      land(s, 1);
      expect(s.focus.kind).toBe('UPGRADE');
      expect(s.upgrade()).toMatchObject({ success: true, level });
      expect(s.upgrade().success).toBe(false);
    }
    land(s, 1);
    expect(s.focus.kind).toBe('OWN_MAX');
    expect(s.upgrade().success).toBe(false);
    expect(s.state.propertyManager.getProperty(1).level).toBe(4);
  });

  it('transfers real rent and grants the commercial market rebate exactly once', () => {
    const s = make();
    land(s, 12, 0);
    expect(s.purchase().success).toBe(true);
    expect(s.state.propertyManager.getProperty(12).buildingType).toBe('MALL');
    const ownerCash = s.state.players[0].cash;
    const visitorCash = s.state.players[1].cash;
    const points = s.state.players[1].cardPoints;
    const result = land(s, 12, 1);
    expect(result.success).toBe(true);
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'COMMERCIAL_FACILITY_VISITED', benefitKind: 'MALL_REBATE', amount: 15 }));
    expect(s.state.players[0].cash - ownerCash).toBe(visitorCash - s.state.players[1].cash);
    expect(s.state.players[1].cash).toBeLessThan(visitorCash);
    expect(s.state.players[1].cardPoints).toBe(points + 15);
    const saved = stable(s.snapshot());
    expect(s.resolveLanding().success).toBe(false);
    expect(stable(s.snapshot())).toEqual(saved);
  });

  it('uses a real consumable remote dice card and rejects duplicate movement/card commands', () => {
    const s = make();
    expect(s.useRemoteDice(7).success).toBe(false);
    expect(s.useRemoteDice(3).success).toBe(true);
    expect(s.currentPlayer.cards).not.toContain('REMOTE_DICE');
    expect(s.useRemoteDice(3).success).toBe(false);
    expect(s.endTurn().success).toBe(false);
    s.resolveMovement();
    expect(s.currentPlayer.currentTile).toBe(3);
    expect(s.advanceMove().success).toBe(false);
    s.resolveLanding();
    expect(s.endTurn().success).toBe(true);
    expect(s.endTurn().success).toBe(false);
  });

  it('retains seeded RNG, pending movement, landing ledger and save isolation', () => {
    const data = new Map([['fortune-empire:auto-save:v1', 'legacy-untouched']]);
    const storage = { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v) };
    const s = make({ seed: 31, storage });
    s.roll(); s.advanceMove();
    expect(s.save().success).toBe(true);
    expect(data.has(SLICE_SAVE_KEY)).toBe(true);
    expect(data.get('fortune-empire:auto-save:v1')).toBe('legacy-untouched');
    const restored = new SliceSession({ storage });
    expect(restored.load().success).toBe(true);
    expect(stable(restored.snapshot())).toEqual(stable(s.snapshot()));
    s.resolveMovement(); restored.resolveMovement();
    s.resolveLanding(); restored.resolveLanding();
    expect(stable(restored.snapshot())).toEqual(stable(s.snapshot()));
    expect(restored.restore(s.snapshot()).success).toBe(true);
    expect(restored.resolveLanding().success).toBe(false);
    expect(restored.restore({ ...s.snapshot(), mapId: 'city-loop' }).success).toBe(false);
  });

  it('resumes an AI turn from a mid-move snapshot with awaited presentation hooks', async () => {
    const s = make();
    s.useRemoteDice(2); s.resolveMovement(); s.resolveLanding(); s.endTurn();
    s.roll();
    const restored = new SliceSession(); restored.restore(s.snapshot());
    const order = [];
    await restored.playAITurn({ onStep: async () => { order.push('step'); }, onLanding: async () => { order.push('landing'); } });
    expect(order.at(-1)).toBe('landing');
    expect(order.filter(x => x === 'step').length).toBeGreaterThan(0);
    expect(restored.currentPlayer.isAI).toBe(false);
  });
});
