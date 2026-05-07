import type { TournamentEntity, TournamentLogEntity } from "../repositories/tournament-repository.js";

export function serializeTournament(tournament: TournamentEntity): Record<string, unknown> {
  return {
    id: tournament.id,
    roomCode: tournament.roomCode,
    name: tournament.name,
    config: tournament.config,
    state: tournament.state,
    stateVersion: tournament.stateVersion,
    status: tournament.status,
    createdAt: tournament.createdAt.toISOString(),
    updatedAt: tournament.updatedAt.toISOString(),
    finishedAt: tournament.finishedAt?.toISOString() ?? null,
  };
}

export function serializeTournamentLog(log: TournamentLogEntity): Record<string, unknown> {
  return {
    id: log.id,
    tournamentId: log.tournamentId,
    type: log.type,
    payload: log.payload,
    createdAt: log.createdAt.toISOString(),
  };
}

