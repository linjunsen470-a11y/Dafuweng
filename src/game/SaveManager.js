const AUTO_SAVE_KEY = 'fortune-empire:auto-save:v1';
const MANUAL_SAVE_KEY = 'fortune-empire:manual-save:v1';
const SLOT_PREFIX = 'fortune-empire:slot:v9:';
const V8_SLOT_PREFIX = 'fortune-empire:slot:v8:';
const V7_SLOT_PREFIX = 'fortune-empire:slot:v7:';
const V6_SLOT_PREFIX = 'fortune-empire:slot:v6:';
const V5_SLOT_PREFIX = 'fortune-empire:slot:v5:';
const V4_SLOT_PREFIX = 'fortune-empire:slot:v4:';
const LEGACY_SLOT_PREFIX = 'fortune-empire:slot:v3:';
const SUPPORTED_VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

class IndexedSaveMirror {
  constructor() {
    this.databaseName = 'fortune-empire-saves';
    this.storeName = 'snapshots';
  }

  open() {
    if (!globalThis.indexedDB) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(this.storeName)) request.result.createObjectStore(this.storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async set(key, value) {
    const database = await this.open();
    if (!database) return;
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(this.storeName, 'readwrite');
      transaction.objectStore(this.storeName).put(value, key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }

  async remove(key) {
    const database = await this.open();
    if (!database) return;
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(this.storeName, 'readwrite');
      transaction.objectStore(this.storeName).delete(key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }

  async get(key) {
    const database = await this.open();
    if (!database) return null;
    const value = await new Promise((resolve, reject) => {
      const transaction = database.transaction(this.storeName, 'readonly');
      const request = transaction.objectStore(this.storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return value;
  }
}

export class SaveManager {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.indexedMirror = new IndexedSaveMirror();
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
    if (current.success) return current;
    const v8 = this.read(`${V8_SLOT_PREFIX}${slotId}`);
    if (v8.success) return v8;
    const v7 = this.read(`${V7_SLOT_PREFIX}${slotId}`);
    if (v7.success) return v7;
    const v6 = this.read(`${V6_SLOT_PREFIX}${slotId}`);
    if (v6.success) return v6;
    const v5 = this.read(`${V5_SLOT_PREFIX}${slotId}`);
    if (v5.success) return v5;
    const v4 = this.read(`${V4_SLOT_PREFIX}${slotId}`);
    return v4.success ? v4 : this.read(`${LEGACY_SLOT_PREFIX}${slotId}`);
  }

  async loadSlotAsync(slotId) {
    const local = this.loadSlot(slotId);
    if (local.success) return local;
    for (const prefix of [SLOT_PREFIX, V8_SLOT_PREFIX, V7_SLOT_PREFIX, V6_SLOT_PREFIX, V5_SLOT_PREFIX, V4_SLOT_PREFIX, LEGACY_SLOT_PREFIX]) {
      try {
        const snapshot = await this.indexedMirror.get(`${prefix}${slotId}`);
        if (snapshot && SUPPORTED_VERSIONS.includes(snapshot.version)) {
          this.write(`${SLOT_PREFIX}${slotId}`, snapshot);
          return { success: true, snapshot };
        }
      } catch {}
    }
    return local;
  }

  deleteSlot(slotId) {
    try {
      this.storage?.removeItem(`${SLOT_PREFIX}${slotId}`);
      this.storage?.removeItem(`${V8_SLOT_PREFIX}${slotId}`);
      this.storage?.removeItem(`${V7_SLOT_PREFIX}${slotId}`);
      this.storage?.removeItem(`${V6_SLOT_PREFIX}${slotId}`);
      this.storage?.removeItem(`${V5_SLOT_PREFIX}${slotId}`);
      this.storage?.removeItem(`${V4_SLOT_PREFIX}${slotId}`);
      this.storage?.removeItem(`${LEGACY_SLOT_PREFIX}${slotId}`);
      void this.indexedMirror.remove(`${SLOT_PREFIX}${slotId}`);
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
      void this.indexedMirror.set(key, snapshot).catch(() => {});
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
      if (!SUPPORTED_VERSIONS.includes(snapshot.version)) return { success: false, msg: '存档版本不兼容' };
      return { success: true, snapshot };
    } catch (error) {
      return { success: false, msg: `存档损坏：${error.message}` };
    }
  }

  exportSnapshot(snapshot) {
    try {
      return { success: true, data: JSON.stringify(snapshot, null, 2) };
    } catch (error) {
      return { success: false, msg: `导出失败：${error.message}` };
    }
  }

  importSnapshot(data) {
    try {
      const snapshot = typeof data === 'string' ? JSON.parse(data) : data;
      if (!snapshot || !SUPPORTED_VERSIONS.includes(snapshot.version)) {
        return { success: false, msg: '存档版本不兼容' };
      }
      if (!Array.isArray(snapshot.players) || !Array.isArray(snapshot.properties)) {
        return { success: false, msg: '存档结构不完整' };
      }
      return { success: true, snapshot };
    } catch (error) {
      return { success: false, msg: `导入失败：${error.message}` };
    }
  }
}
