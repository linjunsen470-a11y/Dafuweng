export type PlayerId = number;
export type TileId = number;

export type GamePhase =
  | 'SETUP'
  | 'TURN_START'
  | 'PRE_ROLL_ACTION'
  | 'ROLLING'
  | 'MOVING'
  | 'ROUTE_CHOICE'
  | 'DEBT_SETTLEMENT'
  | 'AUCTION'
  | 'MINIGAME'
  | 'PAUSED'
  | 'LANDING_ACTION'
  | 'TURN_END'
  | 'GAME_OVER';

export type GameCommandType =
  | 'SELECT_DICE_COUNT' | 'BUY_ITEM' | 'SELL_INVENTORY' | 'USE_ITEM' | 'PLACE_ROAD_ENTITY'
  | 'CHOOSE_BUILDING_TYPE' | 'START_RESEARCH' | 'START_AUCTION' | 'PLACE_BID'
  | 'CREATE_MARKET_OFFER' | 'ACCEPT_MARKET_OFFER' | 'RESOLVE_MAGIC' | 'SUBMIT_MINIGAME_RESULT'
  | 'PURCHASE_PROPERTY' | 'UPGRADE_PROPERTY' | 'SETTLE_RENT' | 'RESOLVE_LANDING'
  | 'BUY_STOCK' | 'SELL_STOCK' | 'BUY_CARD' | 'USE_CARD' | 'ROLL_DICE' | 'BEGIN_MOVE'
  | 'ADVANCE_MOVE' | 'TELEPORT_PLAYER' | 'END_TURN' | 'BANK_TRANSFER' | 'BUY_LOTTERY'
  | 'CAST_MAGIC' | 'SELL_BUILDING' | 'MORTGAGE_PROPERTY' | 'REDEEM_PROPERTY'
  | 'PAY_DEBT' | 'LIQUIDATE_DEPOSIT' | 'AUTO_SETTLE_DEBT' | 'DECLARE_BANKRUPTCY'
  | 'SET_COMPANY_POLICY' | 'PAUSE_GAME' | 'RESUME_GAME';

export interface GameCommand {
  type: GameCommandType;
  playerId: PlayerId;
  payload?: Record<string, unknown>;
}

export type GameEventType =
  | 'INVENTORY_CHANGED' | 'ROAD_ENTITY_CHANGED' | 'CHAIRMAN_CHANGED' | 'COMPANY_SETTLED'
  | 'AUCTION_UPDATED' | 'RESEARCH_COMPLETED' | 'ECONOMIC_CYCLE_ENDED' | string;

export interface GameEvent {
  type: GameEventType;
  message?: string;
  payload?: Record<string, unknown>;
}

export interface LegalTarget {
  id: string | number;
  label: string;
  description?: string;
}

export interface LegalAction {
  type: string;
  enabled: boolean;
  reason?: string;
  targets?: LegalTarget[];
}

export interface CardDefinition {
  id: string;
  name: string;
  icon: string;
  cost: number;
  desc: string;
  targetType?: 'NONE' | 'PLAYER' | 'TILE' | 'PROPERTY' | 'STOCK';
  cardImg?: string;
}

export interface TileDefinition {
  id: TileId;
  type: string;
  name: string;
  next?: TileId[];
  position?: { x: number; z: number };
  lot?: {
    position: { x: number; z: number };
    rotation: number;
    size: { x: number; z: number };
  };
  [key: string]: unknown;
}

export interface MapDefinition {
  id: string;
  name: string;
  spawnTile: TileId;
  tiles: TileDefinition[];
  theme: string;
  musicId: string;
  defaultDiceCount?: number;
  passBonus?: number;
  roadWidth?: number;
  tileSize?: number;
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  camera?: {
    center: { x: number; z: number };
    overviewDistance: number;
    followHeight: number;
    followDistance: number;
  };
  districts?: Array<{ id: string; name: string; color: string }>;
}

export interface CharacterDefinition {
  id: number;
  name: string;
  skillName: string;
  skillDesc: string;
  color: string;
}

export interface GameModeDefinition {
  id: 'STANDARD' | 'QUICK' | 'TEAM' | 'CHALLENGE' | 'HEAT';
  name: string;
  maxRounds: number;
  teams?: boolean;
  description: string;
}

export interface ItemDefinition {
  id: string;
  name: string;
  icon: string;
  cost: number | null;
  sellPrice: number;
  targetType: 'NONE' | 'PLAYER' | 'TILE' | 'PROPERTY' | 'VALUE';
  researchLevel?: number;
  researchRounds?: number;
  description: string;
}

export type BuildingType = 'RESIDENTIAL' | 'CHAIN_STORE' | 'PARK' | 'MALL' | 'HOTEL' | 'GAS_STATION' | 'LAB';

export interface BuildingDefinition {
  id: Exclude<BuildingType, 'RESIDENTIAL' | 'CHAIN_STORE'>;
  name: string;
  icon: string;
  maxLevel: number;
  rentMultiplier: number;
  buildMultiplier: number;
  description: string;
}

export interface CompanyState {
  id: string;
  name: string;
  stockId: string;
  treasury: number;
  periodRevenue: number;
  chairmanId: PlayerId | null;
  lastDividend: number;
  policyId: string | null;
  policyStartedRound: number | null;
  policyHistory: Array<{ policyId: string; round: number | null; dividendPool: number; operation: number }>;
}

export interface RoadEntity {
  id: string;
  type: 'BARRIER' | 'MINE' | 'TIME_BOMB' | 'GIFT_BOX' | 'COUPON_CHEST' | 'DOG' | 'GOD' | 'NPC';
  tileId: TileId;
  ownerId?: PlayerId | null;
  data?: Record<string, unknown>;
  expiresRound?: number | null;
}

export interface AuctionState {
  id: string;
  sellerId: PlayerId | null;
  beneficiaryId?: PlayerId | null;
  bankruptcy?: boolean;
  tileId: TileId;
  minimumBid: number;
  highestBid: number;
  highestBidderId: PlayerId | null;
  bidderOrder: PlayerId[];
  bidderIndex: number;
  activeBidderIds?: PlayerId[];
  passedBidderIds?: PlayerId[];
  bidHistory?: Array<{ playerId: PlayerId; amount: number; action: 'BID' | 'PASS' | 'AUTO_PASS'; round: number }>;
  biddingRound?: number;
  status: 'OPEN' | 'RESOLVED' | 'CANCELLED';
}

export interface ResearchTask {
  id: string;
  playerId: PlayerId;
  tileId: TileId;
  itemId: string;
  roundsRemaining: number;
}

export interface EconomicCycleState {
  period: number;
  roundsPerPeriod: number;
  lastSettlementRound: number;
}

export interface GameSnapshotV1 {
  version: 1;
  contentVersion: string;
  savedAt: string;
  seed: number;
  rngState: number;
  phase: GamePhase;
  round: number;
  maxRounds: number;
  mapId: string;
  currentPlayerIndex: number;
  players: unknown[];
  properties: Array<[number, unknown]>;
  stocks: unknown[];
  newsEffect: null | { id: string; remainingRounds: number };
  logHistory: unknown[];
}

export interface GameSnapshotV2 extends Omit<GameSnapshotV1, 'version'> {
  version: 2;
  winnerId: PlayerId | null;
  winReason: 'LAST_PLAYER' | 'NET_WORTH' | 'LAST_TEAM' | 'TEAM_NET_WORTH' | 'LORD_DEFEATED' | 'LORD_VICTORY' | null;
}

export interface GameSnapshotV3 extends Omit<GameSnapshotV2, 'version'> {
  version: 3;
  pendingMove: null | { playerId: PlayerId; remainingSteps: number; source: string; path: TileId[] };
  pendingDebt: null | { debtorId: PlayerId; creditorId: PlayerId | null; amountDue: number; source: string };
  phaseBeforePause: GamePhase | null;
}

export interface GameSnapshotV4 extends Omit<GameSnapshotV3, 'version'> {
  version: 4;
  gameMode: 'STANDARD' | 'QUICK' | 'TEAM' | 'CHALLENGE' | 'HEAT';
  lottery: { pot: number; tickets: Array<{ playerId: PlayerId; number: number }>; lastNumber: number | null };
  boardGods: Array<{ id: string; type: string; tileId: TileId; direction: number }>;
  mechanismState: { activeRoute: number };
  winningTeamId: string | number | null;
}

export interface GameSnapshotV5 extends Omit<GameSnapshotV4, 'version'> {
  version: 5;
  roadEntities: RoadEntity[];
  companies: CompanyState[];
  auction: AuctionState | null;
  bankruptcyAuctionQueue: Array<{ tileId: TileId; level: number; buildingType: BuildingType | null; creditorId: PlayerId | null }>;
  marketOffers: Array<Record<string, unknown>>;
  researchTasks: ResearchTask[];
  economicCycle: EconomicCycleState;
  minigameState: null | Record<string, unknown>;
}

export interface GameSnapshotV6 extends Omit<GameSnapshotV5, 'version'> {
  version: 6;
  newsHistory: Array<{
    id: string;
    title: string;
    desc: string;
    category: string;
    icon: string;
    tone: string;
    round: number;
    impacts: Array<{ icon: string; label: string; detail: string; tone: string }>;
  }>;
}

export interface GameSnapshotV7 extends Omit<GameSnapshotV6, 'version'> {
  version: 7;
  phaseBeforeAuction: GamePhase | null;
}

export interface GameSnapshotV8 extends Omit<GameSnapshotV7, 'version'> {
  version: 8;
  marketHistory: Array<Record<string, unknown>>;
}

export interface GameSnapshotV9 extends Omit<GameSnapshotV8, 'version'> {
  version: 9;
}

export interface GameSnapshotV10 extends Omit<GameSnapshotV9, 'version'> {
  version: 10;
}

export type GameSnapshot = GameSnapshotV1 | GameSnapshotV2 | GameSnapshotV3 | GameSnapshotV4 | GameSnapshotV5 | GameSnapshotV6 | GameSnapshotV7 | GameSnapshotV8 | GameSnapshotV9 | GameSnapshotV10;
