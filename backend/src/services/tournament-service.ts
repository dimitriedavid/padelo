import { randomUUID } from "node:crypto";

import { conflict, notFound } from "../domain/errors.js";
import type {
  CreateTournamentInput,
  TournamentEntity,
  TournamentRepository,
} from "../repositories/tournament-repository.js";
import { generateRoomCode, normalizeRoomCode } from "./room-code.js";
import {
  createInitialTournamentState,
  maybeAppendNextMexicanoRound,
  normalizeTournamentState,
} from "./scheduler.js";
import type {
  CreateTournamentRequest,
  DeleteMatchResultRequest,
  MatchResult,
  TournamentConfig,
  TournamentMatch,
  TournamentPlayer,
  TournamentRound,
  TournamentState,
  UpsertMatchResultRequest,
} from "../types/tournament.js";
import { badRequest } from "../domain/errors.js";

const ROOM_CODE_ATTEMPTS = 10;

export type TournamentServiceDependencies = {
  repository: TournamentRepository;
  now?: () => Date;
  id?: () => string;
  roomCode?: () => string;
};

export class TournamentService {
  private readonly repository: TournamentRepository;
  private readonly now: () => Date;
  private readonly id: () => string;
  private readonly roomCode: () => string;

  constructor(dependencies: TournamentServiceDependencies) {
    this.repository = dependencies.repository;
    this.now = dependencies.now ?? (() => new Date());
    this.id = dependencies.id ?? randomUUID;
    this.roomCode = dependencies.roomCode ?? generateRoomCode;
  }

  async createTournament(request: CreateTournamentRequest): Promise<TournamentEntity> {
    const players = createPlayers(request.players);
    const config: TournamentConfig = {
      name: request.name,
      mode: request.mode,
      targetScore: request.targetScore,
      courtCount: request.courtCount,
      roundCount: request.roundCount,
      players,
    };
    const state = createInitialTournamentState(config);

    for (let attempt = 0; attempt < ROOM_CODE_ATTEMPTS; attempt += 1) {
      const roomCode = normalizeRoomCode(this.roomCode());
      const existing = await this.repository.getTournamentByRoomCode(roomCode);

      if (existing) {
        continue;
      }

      const createdAt = this.now();
      const tournamentInput: CreateTournamentInput = {
        id: this.id(),
        roomCode,
        name: config.name,
        config,
        state,
        stateVersion: 1,
        status: "active",
        createdAt,
        updatedAt: createdAt,
        finishedAt: null,
        log: {
          id: this.id(),
          type: "tournament_created",
          payload: {
            roomCode,
            name: config.name,
            mode: config.mode,
            playerCount: config.players.length,
            courtCount: config.courtCount,
            roundCount: config.roundCount,
            targetScore: config.targetScore,
          },
          createdAt,
        },
      };

      return this.repository.createTournament(tournamentInput);
    }

    throw conflict("room_code_collision", "Could not generate a unique room code. Try again.");
  }

  async getTournament(roomCode: string): Promise<TournamentEntity> {
    const tournament = await this.repository.getTournamentByRoomCode(normalizeRoomCode(roomCode));

    if (!tournament) {
      throw notFound("tournament_not_found", "Tournament not found.");
    }

    return tournament;
  }

  async upsertMatchResult(
    roomCode: string,
    matchId: string,
    request: UpsertMatchResultRequest,
  ): Promise<TournamentEntity> {
    const tournament = await this.requireEditableTournament(roomCode, request.expectedStateVersion);

    if (request.losingScore >= tournament.config.targetScore) {
      throw badRequest("validation_error", "Losing score must be lower than the target score.", {
        field: "losingScore",
        targetScore: tournament.config.targetScore,
      });
    }

    const state = cloneState(tournament.state);
    const matchRef = findMatch(state, matchId);

    if (!matchRef) {
      throw notFound("match_not_found", "Match not found.");
    }

    if (matchRef.round.index < state.currentRoundIndex) {
      throw conflict(
        "cannot_edit_result_from_previous_round",
        "Cannot edit a result from a previous round after the tournament has advanced.",
      );
    }

    const now = this.now();
    const previousResult = matchRef.match.result;
    const result: MatchResult = {
      winningSide: request.winningSide,
      sideAScore: request.winningSide === "A" ? tournament.config.targetScore : request.losingScore,
      sideBScore: request.winningSide === "B" ? tournament.config.targetScore : request.losingScore,
      enteredAt: previousResult?.enteredAt ?? now.toISOString(),
    };

    if (previousResult) {
      result.updatedAt = now.toISOString();
    }

    matchRef.match.result = result;

    const updatedState = maybeAppendNextMexicanoRound(
      tournament.config,
      normalizeTournamentState(state),
    );

    return this.persistStateChange(tournament, {
      state: updatedState,
      status: "active",
      finishedAt: null,
      now,
      logType: "match_result_upserted",
      logPayload: {
        roomCode: tournament.roomCode,
        matchId,
        roundIndex: matchRef.round.index,
        result,
        previousResult,
      },
    });
  }

  async deleteMatchResult(
    roomCode: string,
    matchId: string,
    request: DeleteMatchResultRequest,
  ): Promise<TournamentEntity> {
    const tournament = await this.requireEditableTournament(roomCode, request.expectedStateVersion);
    const state = cloneState(tournament.state);
    const matchRef = findMatch(state, matchId);

    if (!matchRef) {
      throw notFound("match_not_found", "Match not found.");
    }

    if (!matchRef.match.result) {
      return tournament;
    }

    if (matchRef.round.index < state.currentRoundIndex) {
      throw conflict(
        "cannot_delete_result_from_previous_round",
        "Cannot clear a result from a previous round after the tournament has advanced.",
      );
    }

    const now = this.now();
    const previousResult = matchRef.match.result;
    matchRef.match.result = null;

    const updatedState = normalizeTournamentState(state);

    return this.persistStateChange(tournament, {
      state: updatedState,
      status: "active",
      finishedAt: null,
      now,
      logType: "match_result_deleted",
      logPayload: {
        roomCode: tournament.roomCode,
        matchId,
        roundIndex: matchRef.round.index,
        previousResult,
      },
    });
  }

  async finishTournament(roomCode: string): Promise<TournamentEntity> {
    const tournament = await this.getTournament(roomCode);

    if (tournament.status === "finished") {
      return tournament;
    }

    const now = this.now();

    return this.persistStateChange(tournament, {
      state: normalizeTournamentState(tournament.state),
      status: "finished",
      finishedAt: now,
      now,
      logType: "tournament_finished",
      logPayload: {
        roomCode: tournament.roomCode,
      },
    });
  }

  async playAgain(roomCode: string): Promise<TournamentEntity> {
    const sourceTournament = await this.getTournament(roomCode);

    if (sourceTournament.status !== "finished") {
      throw conflict("tournament_not_finished", "Only finished tournaments can be played again.");
    }

    const createdTournament = await this.createTournament({
      name: sourceTournament.config.name,
      mode: sourceTournament.config.mode,
      players: sourceTournament.config.players.map((player) => player.name),
      courtCount: sourceTournament.config.courtCount,
      roundCount: sourceTournament.config.roundCount,
      targetScore: sourceTournament.config.targetScore,
    });

    await this.repository.appendLog(sourceTournament.id, {
      id: this.id(),
      type: "play_again_created",
      payload: {
        sourceRoomCode: sourceTournament.roomCode,
        newRoomCode: createdTournament.roomCode,
      },
      createdAt: this.now(),
    });

    return createdTournament;
  }

  async listEvents(roomCode: string) {
    const logs = await this.repository.listLogs(normalizeRoomCode(roomCode));

    if (!logs) {
      throw notFound("tournament_not_found", "Tournament not found.");
    }

    return logs;
  }

  private async requireEditableTournament(
    roomCode: string,
    expectedStateVersion: number,
  ): Promise<TournamentEntity> {
    const tournament = await this.getTournament(roomCode);

    if (tournament.status !== "active") {
      throw conflict("tournament_finished", "Finished tournaments cannot be edited.");
    }

    if (tournament.stateVersion !== expectedStateVersion) {
      throw conflict("state_version_conflict", "Tournament state is stale. Refresh and try again.", {
        expectedStateVersion,
        currentStateVersion: tournament.stateVersion,
      });
    }

    return tournament;
  }

  private async persistStateChange(
    tournament: TournamentEntity,
    input: {
      state: TournamentState;
      status: "active" | "finished";
      finishedAt: Date | null;
      now: Date;
      logType: "match_result_upserted" | "match_result_deleted" | "tournament_finished";
      logPayload: Record<string, unknown>;
    },
  ): Promise<TournamentEntity> {
    const updated = await this.repository.updateTournamentByVersion({
      roomCode: tournament.roomCode,
      expectedStateVersion: tournament.stateVersion,
      state: input.state,
      status: input.status,
      updatedAt: input.now,
      finishedAt: input.finishedAt,
      log: {
        id: this.id(),
        type: input.logType,
        payload: input.logPayload,
        createdAt: input.now,
      },
    });

    if (!updated) {
      throw conflict("state_version_conflict", "Tournament state changed. Refresh and try again.");
    }

    return updated;
  }
}

function createPlayers(playerNames: string[]): TournamentPlayer[] {
  return playerNames.map((name, index) => ({
    id: `p${index + 1}`,
    name,
  }));
}

function findMatch(
  state: TournamentState,
  matchId: string,
): { round: TournamentRound; match: TournamentMatch } | null {
  for (const round of state.rounds) {
    const match = round.matches.find((candidate) => candidate.id === matchId);

    if (match) {
      return { round, match };
    }
  }

  return null;
}

function cloneState(state: TournamentState): TournamentState {
  return structuredClone(state);
}
