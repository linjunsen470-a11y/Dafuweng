export type PlayerId = number;
export type TileId = number;

export type GamePhase =
  | 'SETUP'
  | 'TURN_START'
  | 'PRE_ROLL_ACTION'
  | 'ROLLING'
  | 'MOVING'
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
  [key: string]: unknown;
}

export interface MapDefinition {
  id: string;
  name: string;
  spawnTile: TileId;
  tiles: TileDefinition[];
  theme: string;
  musicId: string;
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
  currentPlayerIndex: number;
  players: unknown[];
  properties: Array<[number, unknown]>;
  stocks: unknown[];
  newsEffect: null | { id: string; remainingRounds: number };
  logHistory: unknown[];
}

