import { cardManager } from './CardManager.js';
import { ITEMS } from './ContentRegistry.js';
import { CARD_CAPACITY, ITEM_CAPACITY } from './InventoryManager.js';

export const MARKET_OFFER_LIMIT = 12;
export const MARKET_OFFER_DURATION = 5;
export const MARKET_HISTORY_LIMIT = 30;
export const MARKET_MIN_RATE = 0.4;
export const MARKET_MAX_RATE = 2;

export function getMarketAsset(state, kind, contentId) {
  if (kind === 'PROPERTY') {
    const tileId = Number(contentId);
    const tile = state.getTile(tileId);
    const property = state.propertyManager.getProperty(tileId);
    if (!tile || !property) return null;
    return {
      kind, contentId: tileId, name: tile.name, icon: property.isMortgaged ? '🔒' : '🏠',
      description: `${property.level || 0} 级地产${property.isMortgaged ? ' · 已抵押' : ''}`,
      referenceValue: Math.max(1, Math.round((tile.price || 0) + (tile.buildCost || 0) * (property.level || 0))),
      ownerId: property.owner, transferable: !property.isMortgaged
    };
  }
  if (kind === 'ITEM') {
    const item = ITEMS.find(entry => entry.id === contentId);
    if (!item) return null;
    return { kind, contentId, name: item.name, icon: item.icon || '🧰', description: item.description,
      referenceValue: Math.max(100, Math.round((item.sellPrice || item.cost || 10) * 20)), transferable: true };
  }
  if (kind === 'CARD') {
    const card = cardManager.getCardById(contentId);
    if (!card) return null;
    return { kind, contentId, name: card.name, icon: card.icon || '🃏', description: card.desc,
      referenceValue: Math.max(100, Math.round((card.cost || 25) * 20)), transferable: true };
  }
  return null;
}

export function normalizeMarketOffer(state, offer) {
  const asset = getMarketAsset(state, offer.kind, offer.contentId);
  const createdRound = Number.isFinite(offer.createdRound) ? offer.createdRound : state.round;
  return { ...offer, contentId: offer.kind === 'PROPERTY' ? Number(offer.contentId) : offer.contentId,
    price: Math.max(1, Math.floor(Number(offer.price) || 1)), createdRound,
    expiresRound: Number.isFinite(offer.expiresRound) ? offer.expiresRound : createdRound + MARKET_OFFER_DURATION,
    referenceValue: Math.max(1, Math.floor(Number(offer.referenceValue) || asset?.referenceValue || offer.price || 1)) };
}

export function getMarketOfferView(state, offer) {
  const normalized = normalizeMarketOffer(state, offer);
  return { ...normalized, asset: getMarketAsset(state, normalized.kind, normalized.contentId),
    seller: state.players[normalized.sellerId], rate: normalized.price / Math.max(1, normalized.referenceValue),
    roundsLeft: Math.max(0, normalized.expiresRound - state.round + 1) };
}

export function validateMarketOffer(state, offer) {
  const seller = state.players[offer.sellerId];
  const asset = getMarketAsset(state, offer.kind, offer.contentId);
  if (!seller || seller.isBankrupt || !asset || !asset.transferable || offer.expiresRound < state.round) return false;
  if (offer.kind === 'PROPERTY') return asset.ownerId === seller.id;
  return Boolean((offer.kind === 'ITEM' ? seller.items : seller.cards)?.includes(offer.contentId));
}

export function recordMarketHistory(state, entry) {
  state.marketHistory ||= [];
  state.marketHistory = [...state.marketHistory, entry].slice(-MARKET_HISTORY_LIMIT);
}

export function expireMarketOffers(state) {
  const expired = [];
  state.marketOffers = (state.marketOffers || []).map(offer => normalizeMarketOffer(state, offer)).filter(offer => {
    const valid = validateMarketOffer(state, offer);
    if (!valid) expired.push(offer);
    return valid;
  });
  expired.forEach(offer => recordMarketHistory(state, { type: 'EXPIRED', offerId: offer.id, sellerId: offer.sellerId,
    kind: offer.kind, contentId: offer.contentId, price: offer.price, round: state.round }));
  return expired;
}

export function canReceiveMarketAsset(player, kind) {
  if (kind === 'CARD') return (player.cards?.length || 0) < CARD_CAPACITY;
  if (kind === 'ITEM') return (player.items?.length || 0) < ITEM_CAPACITY;
  return true;
}

export function chooseAIMarketAction(player, state) {
  const reserve = { EASY: 4500, NORMAL: 3000, HARD: 1800 }[player.aiDifficulty] || 3000;
  const purchase = (state.marketOffers || []).map(offer => getMarketOfferView(state, offer))
    .filter(view => view.sellerId !== player.id && validateMarketOffer(state, view)
      && canReceiveMarketAsset(player, view.kind) && player.cash - view.price >= reserve)
    .map(view => ({ view, appeal: 1 - view.rate
      + (view.kind === 'PROPERTY' && player.aiStrategy === 'PROPERTY' ? 0.18 : 0)
      + (view.kind === 'CARD' && ['CARD', 'ATTACK'].includes(player.aiStrategy) ? 0.14 : 0)
      + (view.kind === 'ITEM' && player.aiStrategy === 'ATTACK' ? 0.1 : 0) }))
    .filter(entry => entry.appeal >= 0.08).sort((a, b) => b.appeal - a.appeal || a.view.price - b.view.price)[0];
  if (purchase) return { type: 'BUY', offerId: purchase.view.id };
  if ((state.marketOffers || []).some(offer => offer.sellerId === player.id)) return null;
  const multiplier = player.aiDifficulty === 'HARD' ? 0.92 : player.aiDifficulty === 'EASY' ? 1.12 : 1;
  for (const [kind, inventory] of [['CARD', player.cards], ['ITEM', player.items]]) {
    const duplicate = inventory?.find((id, index, entries) => entries.indexOf(id) !== index);
    if (duplicate) {
      const asset = getMarketAsset(state, kind, duplicate);
      return { type: 'LIST', payload: { kind, contentId: duplicate, price: Math.round(asset.referenceValue * multiplier) } };
    }
  }
  return null;
}
