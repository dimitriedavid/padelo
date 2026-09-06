import { badRequest } from "../domain/errors.js";
import type {
  CreateTournamentRequest,
  DeleteMatchResultRequest,
  FinishTournamentRequest,
  ReopenTournamentRequest,
  RoundCount,
  TournamentMode,
  TournamentFormat,
  UpsertMatchResultRequest,
} from "../types/tournament.js";

const MAX_PLAYERS = 64;
const MAX_COURTS = 16;
const MAX_FIXED_ROUNDS = 100;
const MAX_TARGET_SCORE = 99;
const TOURNAMENT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseCreateTournamentRequest(input: unknown): CreateTournamentRequest {
  const value = requireObject(input);
  const name = requireString(value.name, "name").trim();
  const date = parseTournamentDate(value.date);
  const mode = parseMode(value.mode);
  const players = parsePlayers(value.players);
  const { format, teams } = parseTournamentTeams(value.format, value.teams, players.length);
  const courtCount = requireInteger(value.courtCount, "courtCount", 1, MAX_COURTS);
  const roundCount = parseRoundCount(value.roundCount);
  const targetScore = requireInteger(value.targetScore, "targetScore", 1, MAX_TARGET_SCORE);
  const maxPlayableCourtCount = playableCourtCount(players.length);

  if (courtCount > maxPlayableCourtCount) {
    throw badRequest(
      "validation_error",
      courtCountMessage(players.length, maxPlayableCourtCount),
      {
        field: "courtCount",
        max: maxPlayableCourtCount,
        playerCount: players.length,
      },
    );
  }

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
    date,
    mode,
    format,
    ...(teams ? { teams } : {}),
    players,
    courtCount,
    roundCount,
    targetScore,
  };
}

export function parseTournamentTeams(
  inputFormat: unknown,
  inputTeams: unknown,
  playerCount: number,
): { format: TournamentFormat; teams?: [number, number][] } {
  const format = inputFormat === undefined ? "rotating" : inputFormat;

  if (format !== "rotating" && format !== "fixed-pairs") {
    throw badRequest("validation_error", "Format must be rotating or fixed-pairs.", { field: "format" });
  }

  if (format === "rotating") {
    if (inputTeams !== undefined) {
      throw badRequest("validation_error", "Teams are only allowed for fixed-pairs.", { field: "teams" });
    }
    return { format };
  }

  if (playerCount < 4 || playerCount % 2 !== 0) {
    throw badRequest("validation_error", "Fixed pairs require an even number of at least 4 players.", {
      field: "players",
    });
  }
  if (!Array.isArray(inputTeams) || inputTeams.length !== playerCount / 2) {
    throw badRequest("validation_error", "Provide teams covering every player exactly once.", { field: "teams" });
  }

  const seen = new Set<number>();
  const teams = inputTeams.map((team, index): [number, number] => {
    const field = `teams.${index}`;
    if (!Array.isArray(team) || team.length !== 2) {
      throw badRequest("validation_error", "Each team must contain two player indices.", { field });
    }
    const first = requireInteger(team[0], field, 0, playerCount - 1);
    const second = requireInteger(team[1], field, 0, playerCount - 1);
    if (first === second || seen.has(first) || seen.has(second)) {
      throw badRequest("validation_error", "Each player must belong to exactly one team.", { field });
    }
    seen.add(first);
    seen.add(second);
    return [first, second];
  });

  if (seen.size !== playerCount) {
    throw badRequest("validation_error", "Provide teams covering every player exactly once.", { field: "teams" });
  }

  return { format, teams };
}

function parseTournamentDate(input: unknown): string {
  if (typeof input !== "string") {
    throw badRequest("validation_error", "Tournament date is required.", { field: "date" });
  }

  const date = input.trim();
  const match = TOURNAMENT_DATE_PATTERN.exec(date);

  if (!match) {
    throw badRequest("validation_error", "Tournament date must use YYYY-MM-DD format.", {
      field: "date",
    });
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw badRequest("validation_error", "Tournament date must be a valid calendar date.", {
      field: "date",
    });
  }

  return date;
}

export function parseUpsertMatchResultRequest(input: unknown): UpsertMatchResultRequest {
  const value = requireObject(input);
  const sideAScore = requireInteger(value.sideAScore, "sideAScore", 0, MAX_TARGET_SCORE);
  const sideBScore = requireInteger(value.sideBScore, "sideBScore", 0, MAX_TARGET_SCORE);
  const expectedStateVersion = parseExpectedStateVersion(value);

  return {
    sideAScore,
    sideBScore,
    expectedStateVersion,
  };
}

export function parseDeleteMatchResultRequest(input: unknown): DeleteMatchResultRequest {
  const value = requireObject(input);

  return {
    expectedStateVersion: parseExpectedStateVersion(value),
  };
}

export function parseFinishTournamentRequest(input: unknown): FinishTournamentRequest {
  const value = requireObject(input);

  return {
    expectedStateVersion: parseExpectedStateVersion(value),
  };
}

export function parseReopenTournamentRequest(input: unknown): ReopenTournamentRequest {
  const value = requireObject(input);

  return {
    expectedStateVersion: parseExpectedStateVersion(value),
  };
}

function parseExpectedStateVersion(value: Record<string, unknown>): number {
  return requireInteger(
    value.expectedStateVersion,
    "expectedStateVersion",
    1,
    Number.MAX_SAFE_INTEGER,
  );
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

function playableCourtCount(playerCount: number): number {
  return Math.max(1, Math.floor(playerCount / 4));
}

function courtCountMessage(playerCount: number, maxCourtCount: number): string {
  const courtNoun = maxCourtCount === 1 ? "court" : "courts";
  const verb = maxCourtCount === 1 ? "is" : "are";

  return `With ${playerCount} players, at most ${maxCourtCount} ${courtNoun} ${verb} available.`;
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
