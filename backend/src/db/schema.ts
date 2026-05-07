import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { TournamentConfig, TournamentState } from "../types/tournament.js";

export const tournamentStatus = pgEnum("tournament_status", ["active", "finished"]);

export const tournaments = pgTable(
  "tournaments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomCode: text("room_code").notNull().unique(),
    name: text("name").notNull(),
    configJson: jsonb("config_json").$type<TournamentConfig>().notNull(),
    stateJson: jsonb("state_json").$type<TournamentState>().notNull(),
    stateVersion: integer("state_version").notNull().default(1),
    status: tournamentStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => ({
    roomCodeIdx: index("tournaments_room_code_idx").on(table.roomCode),
    statusIdx: index("tournaments_status_idx").on(table.status),
  }),
);

export const tournamentLogs = pgTable(
  "tournament_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tournamentCreatedAtIdx: index("tournament_logs_tournament_created_at_idx").on(
      table.tournamentId,
      table.createdAt,
    ),
  }),
);

export type TournamentRow = typeof tournaments.$inferSelect;
export type NewTournamentRow = typeof tournaments.$inferInsert;
export type TournamentLogRow = typeof tournamentLogs.$inferSelect;
export type NewTournamentLogRow = typeof tournamentLogs.$inferInsert;

