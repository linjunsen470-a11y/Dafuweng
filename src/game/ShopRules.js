import { cardManager } from './CardManager.js';
import { ITEMS } from './ContentRegistry.js';
import { CARD_CAPACITY, ITEM_CAPACITY } from './InventoryManager.js';

export const SHOP_VISIT_DISCOUNT = 0.15;
export const PREMIUM_SHOP_VISIT_DISCOUNT = 0.2;

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rotatingSelection(values, seed, limit) {
  return values
    .map(value => ({ value, order: hashText(`${seed}:${value.id}`) }))
    .sort((left, right) => left.order - right.order || left.value.id.localeCompare(right.value.id))
    .slice(0, limit)
    .map(entry => entry.value.id);
}

export function getCardShopOffer(state, tileId) {
  const tile = state.getTile?.(Number(tileId));
  const premium = /高级|精品|皇家|未来|百货/.test(tile?.name || '');
  const seed = `${state.mapDefinition?.id || state.mapId || 'map'}:${state.round || 1}:${Number(tileId)}`;
  const buyableItems = ITEMS.filter(item => item.cost !== null);
  return {
    id: `SHOP_${seed}`,
    tileId: Number(tileId),
    tileName: tile?.name || '卡片屋',
    round: Number(state.round || 1),
    premium,
    discountRate: premium ? PREMIUM_SHOP_VISIT_DISCOUNT : SHOP_VISIT_DISCOUNT,
    cardIds: rotatingSelection(cardManager.getAllCards(), `${seed}:CARD`, premium ? 10 : 8),
    itemIds: rotatingSelection(buyableItems, `${seed}:ITEM`, premium ? 5 : 4)
  };
}

export function isOfferedAtShop(offer, kind, contentId) {
  const ids = kind === 'ITEM' ? offer?.itemIds : offer?.cardIds;
  return Array.isArray(ids) && ids.includes(String(contentId));
}

export function chooseAIShopPurchase(player, offer, getCardCost, getItemCost) {
  const reserve = player.aiStrategy === 'AGGRESSIVE' ? 10 : 25;
  const availablePoints = Math.max(0, Number(player.cardPoints || 0) - reserve);
  const attackCards = new Set(['MISSILE', 'NUKES', 'MINE', 'OBSTACLE', 'STEAL_LAND', 'DEMOLISH']);
  const candidates = [];

  if ((player.cards?.length || 0) < CARD_CAPACITY) {
    offer.cardIds.forEach(cardId => {
      const card = cardManager.getCardById(cardId);
      if (!card) return;
      const cost = getCardCost(card);
      if (cost <= availablePoints) candidates.push({
        kind: 'CARD', contentId: card.id, cost,
        score: cost + (attackCards.has(card.id) ? 45 : 0) + (card.targetType === 'NONE' ? 8 : 0)
      });
    });
  }
  if ((player.items?.length || 0) < ITEM_CAPACITY) {
    offer.itemIds.forEach(itemId => {
      const item = ITEMS.find(definition => definition.id === itemId);
      if (!item) return;
      const cost = getItemCost(item);
      if (cost <= availablePoints) candidates.push({
        kind: 'ITEM', contentId: item.id, cost,
        score: cost + (['CAR', 'MOTOR', 'MISSILE_ITEM'].includes(item.id) ? 35 : 0)
      });
    });
  }
  return candidates.sort((left, right) => right.score - left.score || left.cost - right.cost)[0] || null;
}
