import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "../db/client.js";
import { tournamentLogs, tournaments } from "../db/schema.js";
import type {
  CreateTournamentInput,
  CreateTournamentLogInput,
  TournamentEntity,
  TournamentLogEntity,
  TournamentRepository,
  UpdateTournamentInput,
} from "./tournament-repository.js";
import type { TournamentLogType } from "../types/tournament.js";
import { normalizeRoomCode } from "../services/room-code.js";

export class PostgresTournamentRepository implements TournamentRepository {
  async createTournament(input: CreateTournamentInput): Promise<TournamentEntity> {
    return db.transaction(async (tx) => {
      const [created] = await tx
        .insert(tournaments)
        .values({
          id: input.id,
          roomCode: normalizeRoomCode(input.roomCode),
          name: input.name,
          configJson: input.config,
          stateJson: input.state,
          stateVersion: input.stateVersion,
          status: input.status,
          createdAt: input.createdAt,
          updatedAt: input.updatedAt,
          finishedAt: input.finishedAt,
        })
        .returning();

      if (!created) {
        throw new Error("Failed to create tournament.");
      }

      await tx.insert(tournamentLogs).values({
        id: input.log.id,
        tournamentId: created.id,
        type: input.log.type,
        payloadJson: input.log.payload,
        createdAt: input.log.createdAt,
      });

      return mapTournament(created);
    });
  }

  async getTournamentByRoomCode(roomCode: string): Promise<TournamentEntity | null> {
    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.roomCode, normalizeRoomCode(roomCode)))
      .limit(1);

    return tournament ? mapTournament(tournament) : null;
  }

  async updateTournamentByVersion(input: UpdateTournamentInput): Promise<TournamentEntity | null> {
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(tournaments)
        .set({
          stateJson: input.state,
          stateVersion: sql<number>`${tournaments.stateVersion} + 1`,
          status: input.status,
          updatedAt: input.updatedAt,
          finishedAt: input.finishedAt,
        })
        .where(
          and(
            eq(tournaments.roomCode, normalizeRoomCode(input.roomCode)),
            eq(tournaments.stateVersion, input.expectedStateVersion),
          ),
        )
        .returning();

      if (!updated) {
        return null;
      }

      await tx.insert(tournamentLogs).values({
        id: input.log.id,
        tournamentId: updated.id,
        type: input.log.type,
        payloadJson: input.log.payload,
        createdAt: input.log.createdAt,
      });

      return mapTournament(updated);
    });
  }

  async appendLog(
    tournamentId: string,
    log: CreateTournamentLogInput,
  ): Promise<TournamentLogEntity> {
    const [created] = await db
      .insert(tournamentLogs)
      .values({
        id: log.id,
        tournamentId,
        type: log.type,
        payloadJson: log.payload,
        createdAt: log.createdAt,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to append tournament log.");
    }

    return mapLog(created);
  }

  async listLogs(roomCode: string): Promise<TournamentLogEntity[] | null> {
    const tournament = await this.getTournamentByRoomCode(roomCode);

    if (!tournament) {
      return null;
    }

    const logs = await db
      .select()
      .from(tournamentLogs)
      .where(eq(tournamentLogs.tournamentId, tournament.id))
      .orderBy(asc(tournamentLogs.createdAt));

    return logs.map(mapLog);
  }
}

function mapTournament(row: typeof tournaments.$inferSelect): TournamentEntity {
  return {
    id: row.id,
    roomCode: row.roomCode,
    name: row.name,
    config: row.configJson,
    state: row.stateJson,
    stateVersion: row.stateVersion,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    finishedAt: row.finishedAt,
  };
}

function mapLog(row: typeof tournamentLogs.$inferSelect): TournamentLogEntity {
  return {
    id: row.id,
    tournamentId: row.tournamentId,
    type: row.type as TournamentLogType,
    payload: row.payloadJson,
    createdAt: row.createdAt,
  };
}

