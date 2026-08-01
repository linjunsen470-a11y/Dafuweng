const AUTO_SAVE_KEY = 'fortune-empire:auto-save:v1';
const MANUAL_SAVE_KEY = 'fortune-empire:manual-save:v1';
const SLOT_PREFIX = 'fortune-empire:slot:v4:';
const LEGACY_SLOT_PREFIX = 'fortune-empire:slot:v3:';

export class SaveManager {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }

  saveAuto(snapshot) {
    return this.write(AUTO_SAVE_KEY, snapshot);
  }

  saveManual(snapshot, name = '我的存档') {
    return this.write(MANUAL_SAVE_KEY, { ...snapshot, saveName: name });
  }

  loadAuto() {
    return this.read(AUTO_SAVE_KEY);
  }

  loadManual() {
    return this.read(MANUAL_SAVE_KEY);
  }

  saveSlot(slotId, snapshot, name = `存档 ${slotId}`) {
    if (![1, 2, 3].includes(Number(slotId))) return { success: false, msg: '存档槽无效' };
    return this.write(`${SLOT_PREFIX}${slotId}`, { ...snapshot, saveName: name });
  }

  loadSlot(slotId) {
    const current = this.read(`${SLOT_PREFIX}${slotId}`);
    return current.success ? current : this.read(`${LEGACY_SLOT_PREFIX}${slotId}`);
  }

  deleteSlot(slotId) {
    try {
      this.storage?.removeItem(`${SLOT_PREFIX}${slotId}`);
      this.storage?.removeItem(`${LEGACY_SLOT_PREFIX}${slotId}`);
      return { success: true };
    } catch (error) {
      return { success: false, msg: `删除失败：${error.message}` };
    }
  }

  listSlots() {
    return [1, 2, 3].map(slotId => {
      const loaded = this.loadSlot(slotId);
      return loaded.success
        ? { slotId, occupied: true, snapshot: loaded.snapshot }
        : { slotId, occupied: false };
    });
  }

  write(key, snapshot) {
    try {
      this.storage?.setItem(key, JSON.stringify(snapshot));
      return { success: true };
    } catch (error) {
      return { success: false, msg: `存档失败：${error.message}` };
    }
  }

  read(key) {
    try {
      const raw = this.storage?.getItem(key);
      if (!raw) return { success: false, msg: '未找到存档' };
      const snapshot = JSON.parse(raw);
      if (![1, 2, 3, 4].includes(snapshot.version)) return { success: false, msg: '存档版本不兼容' };
      return { success: true, snapshot };
    } catch (error) {
      return { success: false, msg: `存档损坏：${error.message}` };
    }
  }
}
