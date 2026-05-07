import type {
  TournamentConfig,
  TournamentLogType,
  TournamentState,
  TournamentStatus,
} from "../types/tournament.js";

export type TournamentEntity = {
  id: string;
  roomCode: string;
  name: string;
  config: TournamentConfig;
  state: TournamentState;
  stateVersion: number;
  status: TournamentStatus;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
};

export type TournamentLogEntity = {
  id: string;
  tournamentId: string;
  type: TournamentLogType;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export type CreateTournamentInput = {
  id: string;
  roomCode: string;
  name: string;
  config: TournamentConfig;
  state: TournamentState;
  stateVersion: number;
  status: TournamentStatus;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
  log: CreateTournamentLogInput;
};

export type CreateTournamentLogInput = {
  id: string;
  type: TournamentLogType;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export type UpdateTournamentInput = {
  roomCode: string;
  expectedStateVersion: number;
  state: TournamentState;
  status: TournamentStatus;
  updatedAt: Date;
  finishedAt: Date | null;
  log: CreateTournamentLogInput;
};

export interface TournamentRepository {
  createTournament(input: CreateTournamentInput): Promise<TournamentEntity>;
  getTournamentByRoomCode(roomCode: string): Promise<TournamentEntity | null>;
  updateTournamentByVersion(input: UpdateTournamentInput): Promise<TournamentEntity | null>;
  appendLog(tournamentId: string, log: CreateTournamentLogInput): Promise<TournamentLogEntity>;
  listLogs(roomCode: string): Promise<TournamentLogEntity[] | null>;
}

