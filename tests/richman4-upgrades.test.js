import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { BANK_LOAN_CAP, getBankTransferPreview } from '../src/game/BankRules.js';
import { CHARACTER_VOICES } from '../src/game/CharacterReactions.js';
import { CARDS } from '../src/game/CardManager.js';
import { ITEMS } from '../src/game/ContentRegistry.js';

describe('Richman 4 visual, audio & playability upgrades', () => {
  it('supports emergency bank loans and repayment while keeping net worth fair', () => {
    const state = new GameState({ seed: 4040 });
    state.setupGame([
      { name: '林小满', profileIndex: 0, isAI: false },
      { name: '顾田野', profileIndex: 1, isAI: true }
    ], 10000);
    const engine = new GameEngine(state);
    const player = state.players[0];
    const startWorth = state.calculateNetWorth(player);

    const preview = getBankTransferPreview(state, player, 'LOAN', 4000);
    expect(preview).toMatchObject({ enabled: true, cashAfter: 14000, loanAfter: 4000, loanCap: BANK_LOAN_CAP });

    const loaned = engine.execute({ type: 'BANK_TRANSFER', playerId: player.id, payload: { direction: 'LOAN', amount: 4000 } });
    expect(loaned).toMatchObject({ success: true, cash: 14000, loan: 4000 });
    expect(state.calculateNetWorth(player)).toBe(startWorth);

    const overCap = engine.execute({ type: 'BANK_TRANSFER', playerId: player.id, payload: { direction: 'LOAN', amount: BANK_LOAN_CAP } });
    expect(overCap.success).toBe(false);

    const repaid = engine.execute({ type: 'BANK_TRANSFER', playerId: player.id, payload: { direction: 'REPAY_LOAN', amount: 2500 } });
    expect(repaid).toMatchObject({ success: true, cash: 11500, loan: 1500 });
    expect(state.calculateNetWorth(player)).toBe(startWorth);
  });

  it('gives all 16 characters rich multi-line comedy dialogue across all 5 emotions', () => {
    expect(Object.keys(CHARACTER_VOICES)).toHaveLength(16);
    for (const voice of Object.values(CHARACTER_VOICES)) {
      for (const mood of ['gain', 'win', 'loss', 'crisis', 'bankrupt']) {
        expect(voice[mood].length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('bundles studio sampled BGM & cartoon SFX audio pack and transparent VFX sprites offline', () => {
    const manifest = JSON.parse(readFileSync(resolve('public/offline-assets.json'), 'utf8')).assets;
    const expectedAudio = [
      'bgm_city.mp3', 'bgm_island.mp3', 'bgm_festival.mp3',
      'sfx_dice.mp3', 'sfx_coin.mp3', 'sfx_big_cash.mp3', 'sfx_missile.mp3',
      'sfx_ambulance.mp3', 'sfx_good_god.mp3', 'sfx_bad_god.mp3', 'sfx_brake.mp3', 'sfx_news.mp3'
    ];
    for (const file of expectedAudio) {
      expect(existsSync(resolve('public/assets/audio', file)), file).toBe(true);
      expect(manifest, file).toContain(`/assets/audio/${file}`);
    }
    const expectedVfx = ['explosion.png', 'smoke.png', 'star.png', 'coin.png', 'aura.png', 'shockwave.png', 'confetti.png', 'siren.png', 'angel_wings.png', 'storm_cloud.png'];
    for (const file of expectedVfx) {
      expect(existsSync(resolve('public/assets/vfx', file)), file).toBe(true);
      expect(manifest, file).toContain(`/assets/vfx/${file}`);
    }
  });

  it('embeds illustrated full-color artwork inside all 45 card and item SVGs', () => {
    const files = [
      ...CARDS.map(card => card.cardImg),
      ...ITEMS.map(item => `/assets/item_${item.id.toLowerCase()}.svg`)
    ];
    expect(files).toHaveLength(45);
    for (const rel of files) {
      const text = readFileSync(resolve('public', rel.slice(1)), 'utf8');
      expect(text, rel).toContain('<svg');
      expect(text, rel).toContain('data:image/webp;base64,');
    }
  });
});
