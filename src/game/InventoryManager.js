// @ts-check

import { ITEMS } from './ContentRegistry.js';

/** @typedef {{ cards: string[], items?: string[], cardPoints: number }} InventoryPlayer */

export const CARD_CAPACITY = 8;
export const ITEM_CAPACITY = 8;

export class InventoryManager {
  /** @param {string} itemId */
  getDefinition(itemId) {
    return ITEMS.find(item => item.id === itemId) || null;
  }

  /** @param {InventoryPlayer} player @param {string} itemId */
  addItem(player, itemId) {
    if (!this.getDefinition(itemId)) return { success: false, reason: '未知道具' };
    player.items ||= [];
    if (player.items.length >= ITEM_CAPACITY) return { success: false, reason: '道具栏已满' };
    player.items.push(itemId);
    return { success: true, itemId };
  }

  /** @param {InventoryPlayer} player @param {string} itemId */
  removeItem(player, itemId) {
    const items = player.items || [];
    const index = items.indexOf(itemId);
    if (index < 0) return false;
    items.splice(index, 1);
    player.items = items;
    return true;
  }

  /** @param {InventoryPlayer} player @param {string} itemId */
  buy(player, itemId) {
    const item = this.getDefinition(itemId);
    if (!item || item.cost === null) return { success: false, reason: '该道具只能通过研究获得' };
    if (player.cardPoints < item.cost) return { success: false, reason: '点券不足' };
    const added = this.addItem(player, itemId);
    if (!added.success) return added;
    player.cardPoints -= item.cost;
    return { success: true, type: 'INVENTORY_CHANGED', itemId, cost: item.cost };
  }

  /** @param {InventoryPlayer} player @param {string} itemId */
  sell(player, itemId) {
    const item = this.getDefinition(itemId);
    if (!item || !this.removeItem(player, itemId)) return { success: false, reason: '没有该道具' };
    player.cardPoints += item.sellPrice;
    return { success: true, type: 'INVENTORY_CHANGED', itemId, revenue: item.sellPrice };
  }
}
