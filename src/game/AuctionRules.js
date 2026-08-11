export const AUCTION_BID_STEP = 100;

export function getMinimumAuctionBid(auction) {
  return Math.max(Number(auction?.minimumBid || AUCTION_BID_STEP), Number(auction?.highestBid || 0) + AUCTION_BID_STEP);
}

export function createAuctionState(config) {
  const bidderOrder = [...(config.bidderOrder || [])];
  return {
    ...config,
    bidderOrder,
    bidderIndex: 0,
    highestBid: 0,
    highestBidderId: null,
    activeBidderIds: [...bidderOrder],
    passedBidderIds: [],
    bidHistory: [],
    biddingRound: 1,
    status: 'OPEN'
  };
}

export function normalizeAuctionState(auction) {
  if (!auction) return null;
  const bidderOrder = [...(auction.bidderOrder || [])];
  return {
    ...auction,
    bidderOrder,
    bidderIndex: Math.max(0, Math.min(Number(auction.bidderIndex || 0), Math.max(0, bidderOrder.length - 1))),
    activeBidderIds: [...(auction.activeBidderIds || bidderOrder)],
    passedBidderIds: [...(auction.passedBidderIds || [])],
    bidHistory: [...(auction.bidHistory || [])],
    biddingRound: Math.max(1, Number(auction.biddingRound || 1))
  };
}

export function getAuctionValuation(player, tile, property, state) {
  if (!player || !tile) return 0;
  const level = Number(property?.level || 0);
  const baseValue = Number(tile.price || 1000) + Number(tile.buildCost || 0) * level * 0.78;
  const groupTiles = tile.group
    ? state.mapDefinition.tiles.filter(candidate => candidate.group === tile.group)
    : [];
  const groupOwned = groupTiles.filter(candidate => state.propertyManager.getProperty(candidate.id)?.owner === player.id).length;
  const groupBonus = groupTiles.length ? 1 + Math.min(0.35, groupOwned * 0.12) : 1;
  const strategyBonus = player.aiStrategy === 'PROPERTY' ? 1.16 : player.aiStrategy === 'ECONOMY' ? 1.06 : 1;
  const difficultyBonus = player.aiDifficulty === 'HARD' ? 1.12 : player.aiDifficulty === 'EASY' ? 0.88 : 1;
  return Math.round(baseValue * groupBonus * strategyBonus * difficultyBonus);
}

export function getAIAuctionBid(player, auction, state) {
  const tile = state.getTile(auction.tileId);
  const property = state.propertyManager.getProperty(auction.tileId);
  const minimum = getMinimumAuctionBid(auction);
  const reserve = player.aiDifficulty === 'HARD' ? 700 : player.aiDifficulty === 'EASY' ? 2600 : 1500;
  const ceiling = Math.min(Math.max(0, player.cash - reserve), getAuctionValuation(player, tile, property, state));
  if (ceiling < minimum) return 0;
  const room = Math.min(ceiling - minimum, player.aiDifficulty === 'HARD' ? 600 : player.aiDifficulty === 'EASY' ? 200 : 400);
  const extra = room >= AUCTION_BID_STEP ? state.rng.int(0, Math.floor(room / AUCTION_BID_STEP)) * AUCTION_BID_STEP : 0;
  return Math.min(ceiling, minimum + extra);
}
