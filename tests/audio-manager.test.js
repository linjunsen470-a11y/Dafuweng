import { describe, expect, it, vi } from 'vitest';
import { AudioManager, THEME_LIBRARY, clampVolume, getThemeConfig, midiToFrequency } from '../src/engine/AudioManager.js';

describe('procedural audio system', () => {
  it('defines a distinct commercial arrangement for every map theme', () => {
    expect(Object.keys(THEME_LIBRARY)).toEqual(['city-day', 'island-breeze', 'taiwan-folk', 'grand-bay', 'fortune-crossroads']);
    Object.values(THEME_LIBRARY).forEach(theme => {
      expect(theme).toMatchObject({ title: expect.any(String), bpm: expect.any(Number), lead: expect.any(String), pad: expect.any(String) });
      expect(theme.chords).toHaveLength(4);
      expect(theme.bass).toHaveLength(4);
      expect(theme.melody.length).toBeGreaterThanOrEqual(16);
    });
    expect(new Set(Object.values(THEME_LIBRARY).map(theme => JSON.stringify(theme.melody))).size).toBe(5);
    expect(getThemeConfig('missing')).toBe(THEME_LIBRARY['city-day']);
  });

  it('clamps persisted volume and converts concert pitch accurately', () => {
    expect(clampVolume(-2)).toBe(0);
    expect(clampVolume('0.45')).toBe(0.45);
    expect(clampVolume(4)).toBe(1);
    expect(clampVolume('invalid')).toBe(0);
    expect(midiToFrequency(69)).toBeCloseTo(440, 6);
    expect(midiToFrequency(81)).toBeCloseTo(880, 6);
  });

  it('exposes a unified effect router for UI modules', () => {
    const manager = new AudioManager();
    manager.playCoinSound = vi.fn(() => true);
    manager.playClick = vi.fn(() => true);
    manager.playDanger = vi.fn(() => true);
    expect(manager.playSFX('coin')).toBe(true);
    expect(manager.playSFX('danger')).toBe(true);
    expect(manager.playSFX('unknown')).toBe(true);
    expect(manager.playCoinSound).toHaveBeenCalledOnce();
    expect(manager.playDanger).toHaveBeenCalledOnce();
    expect(manager.playClick).toHaveBeenCalledOnce();
  });

  it('tracks weather and time without requiring an audio device', () => {
    const manager = new AudioManager();
    expect(manager.setAtmosphere({ weather: 'RAIN', timeOfDay: 'NIGHT' })).toEqual({ weather: 'RAIN', timeOfDay: 'NIGHT' });
    expect(manager.atmosphere).toEqual({ weather: 'RAIN', timeOfDay: 'NIGHT' });
  });
});
