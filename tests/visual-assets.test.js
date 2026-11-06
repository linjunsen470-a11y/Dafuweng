import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYER_PROFILES } from '../src/game/BoardData.js';

const restoredAssessmentAssets = [
  'buildings-v2-atlas.webp',
  'card_obstacle.jpg',
  'card_remote_dice.jpg',
  'char_baby_jin.svg',
  'char_danny.svg',
  'char_john_joe.svg',
  'char_madam_cash.jpg',
  'char_miyamoto.svg',
  'char_nintaro.jpg',
  'char_salonbus.jpg',
  'char_sarah.svg',
  'char_sun_xiaomei.jpg',
  'char_tang_tang.svg',
  'char_uncle_tu.jpg',
  'char_wumi.jpg',
  'characters-original-atlas.webp',
  'characters-v2-atlas.webp',
  'fortune-empire-title-hero-v2.png',
  'grass_ground.jpg',
  'map_bg_texture.jpg',
  'park_ground_v2.webp',
  'tile_bank.jpg',
  'tile_bank_rich.jpg',
  'tile_shop.jpg',
  'tile_shop_rich.jpg',
  'tile_start.jpg',
  'tile_start_rich.jpg',
  'tile_stock.jpg',
  'tile_stock_rich.jpg',
  'strategy-card-category-atlas-v2.png',
  'world-ground-v2.webp'
];

describe('production visual asset contract', () => {
  it('keeps all production assessment assets present and available offline', () => {
    const offlineManifest = JSON.parse(readFileSync(resolve('public/offline-assets.json'), 'utf8')).assets;
    expect(restoredAssessmentAssets).toHaveLength(31);
    restoredAssessmentAssets.forEach((filename) => {
      expect(existsSync(resolve('public/assets', filename)), filename).toBe(true);
      expect(offlineManifest, filename).toContain(`/assets/${filename}`);
    });
  });

  it('uses the original island key art in the responsive title scene', () => {
    const html = readFileSync(resolve('index.html'), 'utf8');
    const css = readFileSync(resolve('src/css/style.css'), 'utf8');
    expect(css).toContain("url('/assets/fortune-empire-title-hero-v2.png')");
    expect(html).toContain('class="setup-title-stage"');
    expect(html).toContain('class="setup-map-showcase"');
  });

  it('uses the original category atlas throughout the strategy card center', () => {
    const css = readFileSync(resolve('src/css/style.css'), 'utf8');
    const shopUI = readFileSync(resolve('src/ui/ShopUI.js'), 'utf8');
    expect(css).toContain("url('/assets/strategy-card-category-atlas-v2.png')");
    expect(shopUI).toContain('strategy-card-illustration');
    expect(shopUI).toContain('card-detail-illustration');
    expect(shopUI).toContain('card-acquisition');
  });

  it('gives every playable profile a unique production atlas portrait', () => {
    expect(PLAYER_PROFILES).toHaveLength(16);
    expect(new Set(PLAYER_PROFILES.map(profile => profile.avatarAtlas ? `${profile.avatarAtlas}:${profile.avatarPosition}` : profile.avatarImg)).size).toBe(16);
    PLAYER_PROFILES.forEach((profile) => {
      expect(profile.avatarAtlas || profile.avatarImg).toMatch(/^\/assets\/char/);
    });
  });
});
