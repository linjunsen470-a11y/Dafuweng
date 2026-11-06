import { describe, expect, it } from 'vitest';
import { GRAND_BAY_MAP, CITY_LOOP_MAP } from '../src/game/MapData.js';
import { BOARD_THEME_PROFILES, getBoardThemeProfile, getTileDistrict, getTileVisualSpec } from '../src/game/BoardVisualRules.js';

describe('board world art direction rules', () => {
  it('defines a complete material profile for every map theme', () => {
    expect(Object.keys(BOARD_THEME_PROFILES)).toEqual(['GRAND_BAY', 'CITY', 'ISLAND', 'TAIWAN', 'CROSSROADS']);
    Object.values(BOARD_THEME_PROFILES).forEach(profile => {
      expect(profile).toMatchObject({ road: expect.stringMatching(/^#/), shoulder: expect.stringMatching(/^#/), lane: expect.stringMatching(/^#/), asphalt: expect.stringMatching(/^#/), plinth: expect.stringMatching(/^#/) });
    });
    expect(getBoardThemeProfile('UNKNOWN')).toBe(BOARD_THEME_PROFILES.CITY);
  });

  it('maps all 120 flagship tiles into the four authored districts', () => {
    const districtIds = GRAND_BAY_MAP.tiles.map(tile => getTileDistrict(GRAND_BAY_MAP, tile)?.id);
    expect(new Set(districtIds)).toEqual(new Set(['HARBOR', 'OLD_TOWN', 'CBD', 'HILLS']));
    expect(districtIds.slice(0, 30).every(id => id === 'HARBOR')).toBe(true);
    expect(districtIds.slice(90).every(id => id === 'HILLS')).toBe(true);
  });

  it('uses group colors for properties and authored accents for facilities', () => {
    const property = GRAND_BAY_MAP.tiles.find(tile => tile.group === 'BAY_1');
    const bank = GRAND_BAY_MAP.tiles.find(tile => tile.type === 'BANK');
    expect(getTileVisualSpec(GRAND_BAY_MAP, property)).toMatchObject({ districtId: 'HARBOR', accent: '#18a0ae' });
    expect(getTileVisualSpec(GRAND_BAY_MAP, bank)).toMatchObject({ isFacility: true, accent: '#f6c453' });
    expect(getTileVisualSpec(CITY_LOOP_MAP, { id: 99, type: 'ROAD' })).toMatchObject({ isRoad: true, asphalt: '#293442' });
  });
});
