import { CardRules } from './CardRules.js';
import { SaveManager } from './SaveManager.js';

/**
 * Rules-facing facade. Presentation code asks this object for legal actions and
 * persistence; UI modules never need to understand serialized state.
 */
export class GameEngine {
  constructor(gameState, { saveManager = new SaveManager() } = {}) {
    this.state = gameState;
    this.cards = new CardRules(gameState);
    this.saves = saveManager;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event) {
    this.listeners.forEach(listener => listener(event, this.state));
  }

  getCardAction(player, cardId) {
    return this.cards.getLegalAction(player, cardId);
  }

  autoSave() {
    return this.saves.saveAuto(this.state.createSnapshot());
  }

  saveManual(name) {
    return this.saves.saveManual(this.state.createSnapshot(), name);
  }

  restore(snapshot) {
    this.state.restoreSnapshot(snapshot);
    this.emit({ type: 'GAME_RESTORED' });
  }
}

