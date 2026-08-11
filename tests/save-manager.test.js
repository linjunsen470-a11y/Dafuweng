import { describe, expect, it } from 'vitest';
import { SaveManager } from '../src/game/SaveManager.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }
  setItem(key, value) { this.values.set(key, value); }
  getItem(key) { return this.values.get(key) ?? null; }
  removeItem(key) { this.values.delete(key); }
}

describe('SaveManager', () => {
  it('writes and validates a versioned auto save', () => {
    const saves = new SaveManager(new MemoryStorage());
    const snapshot = { version: 1, round: 8 };
    expect(saves.saveAuto(snapshot).success).toBe(true);
    expect(saves.loadAuto()).toEqual({ success: true, snapshot });
  });

  it('rejects an incompatible save', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    storage.setItem('fortune-empire:auto-save:v1', JSON.stringify({ version: 99 }));
    expect(saves.loadAuto().success).toBe(false);
  });

  it('manages three named V4 manual slots', () => {
    const saves = new SaveManager(new MemoryStorage());
    expect(saves.saveSlot(2, { version: 4, round: 9 }, '宝藏岛')).toEqual({ success: true });
    expect(saves.listSlots()[1]).toMatchObject({
      slotId: 2,
      occupied: true,
      snapshot: { version: 4, round: 9, saveName: '宝藏岛' }
    });
    expect(saves.deleteSlot(2).success).toBe(true);
    expect(saves.loadSlot(2).success).toBe(false);
  });
});
