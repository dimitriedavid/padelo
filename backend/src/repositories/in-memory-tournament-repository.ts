import type {
  CreateTournamentInput,
  CreateTournamentLogInput,
  TournamentEntity,
  TournamentLogEntity,
  TournamentRepository,
  UpdateTournamentInput,
} from "./tournament-repository.js";
import { normalizeRoomCode } from "../services/room-code.js";

export class InMemoryTournamentRepository implements TournamentRepository {
  private readonly tournaments = new Map<string, TournamentEntity>();
  private readonly logs = new Map<string, TournamentLogEntity[]>();

  async createTournament(input: CreateTournamentInput): Promise<TournamentEntity> {
    const roomCode = normalizeRoomCode(input.roomCode);

    if (this.tournaments.has(roomCode)) {
      throw new Error(`Tournament room code already exists: ${roomCode}`);
    }

    const tournament: TournamentEntity = {
      id: input.id,
      roomCode,
      name: input.name,
      config: structuredClone(input.config),
      state: structuredClone(input.state),
      stateVersion: input.stateVersion,
      status: input.status,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
      finishedAt: input.finishedAt ? new Date(input.finishedAt) : null,
    };

    this.tournaments.set(roomCode, tournament);
    await this.appendLog(tournament.id, input.log);

    return cloneTournament(tournament);
  }

  async getTournamentByRoomCode(roomCode: string): Promise<TournamentEntity | null> {
    const tournament = this.tournaments.get(normalizeRoomCode(roomCode));

    return tournament ? cloneTournament(tournament) : null;
  }

  async updateTournamentByVersion(input: UpdateTournamentInput): Promise<TournamentEntity | null> {
    const roomCode = normalizeRoomCode(input.roomCode);
    const tournament = this.tournaments.get(roomCode);

    if (!tournament || tournament.stateVersion !== input.expectedStateVersion) {
      return null;
    }

    const updated: TournamentEntity = {
      ...tournament,
      state: structuredClone(input.state),
      stateVersion: tournament.stateVersion + 1,
      status: input.status,
      updatedAt: new Date(input.updatedAt),
      finishedAt: input.finishedAt ? new Date(input.finishedAt) : null,
    };

    this.tournaments.set(roomCode, updated);
    await this.appendLog(updated.id, input.log);

    return cloneTournament(updated);
  }

  async appendLog(
    tournamentId: string,
    logInput: CreateTournamentLogInput,
  ): Promise<TournamentLogEntity> {
    const log: TournamentLogEntity = {
      id: logInput.id,
      tournamentId,
      type: logInput.type,
      payload: structuredClone(logInput.payload),
      createdAt: new Date(logInput.createdAt),
    };
    const logs = this.logs.get(tournamentId) ?? [];
    logs.push(log);
    this.logs.set(tournamentId, logs);

    return cloneLog(log);
  }

  async listLogs(roomCode: string): Promise<TournamentLogEntity[] | null> {
    const tournament = this.tournaments.get(normalizeRoomCode(roomCode));

    if (!tournament) {
      return null;
    }

    return (this.logs.get(tournament.id) ?? []).map(cloneLog);
  }
}

function cloneTournament(tournament: TournamentEntity): TournamentEntity {
  return {
    ...tournament,
    config: structuredClone(tournament.config),
    state: structuredClone(tournament.state),
    createdAt: new Date(tournament.createdAt),
    updatedAt: new Date(tournament.updatedAt),
    finishedAt: tournament.finishedAt ? new Date(tournament.finishedAt) : null,
  };
}

function cloneLog(log: TournamentLogEntity): TournamentLogEntity {
  return {
    ...log,
    payload: structuredClone(log.payload),
    createdAt: new Date(log.createdAt),
  };
}

