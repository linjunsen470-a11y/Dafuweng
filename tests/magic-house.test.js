import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { AIPlayer } from '../src/game/AIPlayer.js';
import { MAGIC_CONDITION_META, MAGIC_EFFECT_META, getMagicPreview, getMagicTargets } from '../src/game/MagicRules.js';

function setup() {
  const state = new GameState({ seed: 4455 });
  state.setupGame([
    { name: '小满', profileIndex: 0, isAI: false },
    { name: '阿土伯', profileIndex: 1, isAI: true },
    { name: '晶晶', profileIndex: 2, isAI: true }
  ], 20000, { initialDeposit: 5000 });
  return { state, engine: new GameEngine(state), caster: state.players[0] };
}

describe('magic house decision model', () => {
  it('provides authored metadata for all ten conditions and effects', () => {
    expect(Object.keys(MAGIC_CONDITION_META)).toHaveLength(10);
    expect(Object.keys(MAGIC_EFFECT_META)).toHaveLength(10);
    Object.values(MAGIC_CONDITION_META).forEach(meta => expect(meta.description.length).toBeGreaterThan(6));
    Object.values(MAGIC_EFFECT_META).forEach(meta => {
      expect(meta.power).toBeGreaterThan(0);
      expect(['BENEFIT', 'HARM', 'CONTROL', 'CHAOS']).toContain(meta.tone);
    });
  });

  it('previews actual target identities and aggregate outcomes', () => {
    const { state, caster } = setup();
    state.players[1].cash = 30000;
    const rich = getMagicTargets(state, caster, 'RICH_CASH');
    expect(rich.map(player => player.id)).toEqual([1]);
    const preview = getMagicPreview(state, caster, 'ALL_OPPONENTS', 'CASH_RAIN');
    expect(preview.enabled).toBe(true);
    expect(preview.targets.map(target => target.name)).toEqual(['阿土伯', '晶晶']);
    expect(preview.outcome).toBe('预计发放 $1,600');
  });

  it('warns about harmful self-targeting and blocks empty target groups', () => {
    const { state, caster } = setup();
    expect(getMagicPreview(state, caster, 'SELF', 'HOSPITAL')).toMatchObject({ enabled: true, selfRisk: true });
    expect(getMagicPreview(state, caster, 'HAS_VEHICLE', 'STOP_ONE')).toMatchObject({ enabled: false, reason: '当前没有符合条件的目标' });
  });

  it('blocks effect combinations that would silently do nothing', () => {
    const { state, caster } = setup();
    expect(getMagicPreview(state, caster, 'ALL_OPPONENTS', 'DEMOLISH_ONE')).toMatchObject({ enabled: false, reason: '目标没有可拆除的建筑' });
    expect(getMagicPreview(state, caster, 'SELF', 'GOD_SHUFFLE')).toMatchObject({ enabled: false });
  });

  it('uses the same preview validation in the authoritative engine', () => {
    const { state, engine, caster } = setup();
    expect(engine.resolveMagic(caster, 'ALL_OPPONENTS', 'DEMOLISH_ONE')).toMatchObject({ success: false, reason: '目标没有可拆除的建筑' });
    const before = state.players.slice(1).map(player => player.cash);
    const result = engine.resolveMagic(caster, 'ALL_OPPONENTS', 'CASH_RAIN');
    expect(result).toMatchObject({ success: true, conditionLabel: '所有对手', effectLabel: '每人获得现金', outcome: '预计发放 $1,600' });
    expect(result.targetNames).toEqual(['阿土伯', '晶晶']);
    expect(state.players.slice(1).map(player => player.cash)).toEqual(before.map(cash => cash + 800));
  });

  it('keeps AI magic choices actionable', () => {
    const { state } = setup();
    const ai = state.players[1];
    const choice = AIPlayer.chooseMagic(ai, state);
    expect(getMagicPreview(state, ai, choice.conditionId, choice.effectId).enabled).toBe(true);
  });
});
