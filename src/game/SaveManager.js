const AUTO_SAVE_KEY = 'fortune-empire:auto-save:v1';
const MANUAL_SAVE_KEY = 'fortune-empire:manual-save:v1';

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
      if (snapshot.version !== 1) return { success: false, msg: '存档版本不兼容' };
      return { success: true, snapshot };
    } catch (error) {
      return { success: false, msg: `存档损坏：${error.message}` };
    }
  }
}

