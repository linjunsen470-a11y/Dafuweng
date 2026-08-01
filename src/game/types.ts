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
  | 'PAUSED'
  | 'LANDING_ACTION'
  | 'TURN_END'
  | 'GAME_OVER';

export interface GameCommand {
  type: string;
  playerId: PlayerId;
  payload?: Record<string, unknown>;
}

export interface GameEvent {
  type: string;
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

export type GameSnapshot = GameSnapshotV1 | GameSnapshotV2 | GameSnapshotV3 | GameSnapshotV4;
