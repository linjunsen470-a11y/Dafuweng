import { cardManager } from '../game/CardManager.js';
import { ITEMS } from '../game/ContentRegistry.js';
import { createCardPresentation, createItemPresentation } from '../game/CardPresentation.js';

export function inventoryEntries(player, engine) {
  const group = (ids = []) => [...new Set(ids)].map(id => ({ id, count: ids.filter(value => value === id).length, index: ids.indexOf(id) }));
  const cards = group(player.cards).map(({ id, count, index }) => {
    const card = cardManager.getCardById(id);
    if (!card) return null;
    const action = engine?.getCardAction(player, id);
    return { key: `CARD:${id}`, kind: 'CARD', definition: card, index, presentation: createCardPresentation(card, { action, ownedCount: count }) };
  }).filter(Boolean);
  const tools = group(player.items).map(({ id, count, index }) => {
    const tool = ITEMS.find(item => item.id === id);
    if (!tool) return null;
    const action = engine?.getItemAction(player, id);
    return { key: `ITEM:${id}`, kind: 'ITEM', definition: tool, index, presentation: createItemPresentation(tool, { action, ownedCount: count }) };
  }).filter(Boolean);
  return [...cards, ...tools];
}
