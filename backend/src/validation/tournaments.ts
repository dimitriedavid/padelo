import { badRequest } from "../domain/errors.js";
import type {
  CreateTournamentRequest,
  DeleteMatchResultRequest,
  RoundCount,
  TournamentMode,
  UpsertMatchResultRequest,
} from "../types/tournament.js";

const MAX_PLAYERS = 64;
const MAX_COURTS = 16;
const MAX_FIXED_ROUNDS = 100;
const MAX_TARGET_SCORE = 99;

export function parseCreateTournamentRequest(input: unknown): CreateTournamentRequest {
  const value = requireObject(input);
  const name = requireString(value.name, "name").trim();
  const mode = parseMode(value.mode);
  const players = parsePlayers(value.players);
  const courtCount = requireInteger(value.courtCount, "courtCount", 1, MAX_COURTS);
  const roundCount = parseRoundCount(value.roundCount);
  const targetScore = requireInteger(value.targetScore, "targetScore", 1, MAX_TARGET_SCORE);

  if (name.length === 0) {
    throw badRequest("validation_error", "Tournament name is required.", { field: "name" });
  }

  if (name.length > 80) {
    throw badRequest("validation_error", "Tournament name must be 80 characters or fewer.", {
      field: "name",
    });
  }

  return {
    name,
    mode,
    players,
    courtCount,
    roundCount,
    targetScore,
  };
}

export function parseUpsertMatchResultRequest(input: unknown): UpsertMatchResultRequest {
  const value = requireObject(input);
  const sideAScore = requireInteger(value.sideAScore, "sideAScore", 0, MAX_TARGET_SCORE);
  const sideBScore = requireInteger(value.sideBScore, "sideBScore", 0, MAX_TARGET_SCORE);
  const expectedStateVersion = requireInteger(
    value.expectedStateVersion,
    "expectedStateVersion",
    1,
    Number.MAX_SAFE_INTEGER,
  );

  return {
    sideAScore,
    sideBScore,
    expectedStateVersion,
  };
}

export function parseDeleteMatchResultRequest(input: unknown): DeleteMatchResultRequest {
  const value = requireObject(input);

  return {
    expectedStateVersion: requireInteger(
      value.expectedStateVersion,
      "expectedStateVersion",
      1,
      Number.MAX_SAFE_INTEGER,
    ),
  };
}

function parseMode(input: unknown): TournamentMode {
  if (typeof input !== "string") {
    throw badRequest("validation_error", "Tournament mode is required.", { field: "mode" });
  }

  const mode = input.trim().toLowerCase();

  if (mode !== "americano" && mode !== "mexicano") {
    throw badRequest("validation_error", "Tournament mode must be Americano or Mexicano.", {
      field: "mode",
    });
  }

  return mode;
}

function parsePlayers(input: unknown): string[] {
  if (!Array.isArray(input)) {
    throw badRequest("validation_error", "Players must be an array.", { field: "players" });
  }

  const players = input.map((player, index) => {
    if (typeof player !== "string") {
      throw badRequest("validation_error", "Player names must be strings.", {
        field: `players.${index}`,
      });
    }

    const name = player.trim();

    if (name.length === 0) {
      throw badRequest("validation_error", "Player names cannot be empty.", {
        field: `players.${index}`,
      });
    }

    if (name.length > 60) {
      throw badRequest("validation_error", "Player names must be 60 characters or fewer.", {
        field: `players.${index}`,
      });
    }

    return name;
  });

  if (players.length < 4) {
    throw badRequest("validation_error", "At least 4 players are required.", { field: "players" });
  }

  if (players.length > MAX_PLAYERS) {
    throw badRequest("validation_error", `At most ${MAX_PLAYERS} players are supported.`, {
      field: "players",
    });
  }

  const seen = new Set<string>();

  for (const player of players) {
    const key = player.toLowerCase();

    if (seen.has(key)) {
      throw badRequest("validation_error", "Player names must be unique.", { field: "players" });
    }

    seen.add(key);
  }

  return players;
}

function parseRoundCount(input: unknown): RoundCount {
  const value = requireObject(input);

  if (value.type === "infinite") {
    return { type: "infinite" };
  }

  if (value.type === "fixed") {
    return {
      type: "fixed",
      value: requireInteger(value.value, "roundCount.value", 1, MAX_FIXED_ROUNDS),
    };
  }

  throw badRequest("validation_error", "Round count must be fixed or infinite.", {
    field: "roundCount.type",
  });
}

function requireObject(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw badRequest("validation_error", "Request body must be a JSON object.");
  }

  return input as Record<string, unknown>;
}

function requireString(input: unknown, field: string): string {
  if (typeof input !== "string") {
    throw badRequest("validation_error", `${field} must be a string.`, { field });
  }

  return input;
}

function requireInteger(input: unknown, field: string, min: number, max: number): number {
  if (typeof input !== "number" || !Number.isInteger(input)) {
    throw badRequest("validation_error", `${field} must be an integer.`, { field });
  }

  if (input < min || input > max) {
    throw badRequest("validation_error", `${field} must be between ${min} and ${max}.`, {
      field,
      min,
      max,
    });
  }

  return input;
}
