import type { LeaderboardEntry, Tournament, TournamentPlayer } from "./types";

export function playerName(tournament: Tournament, playerId: string): string {
  return playerMap(tournament).get(playerId)?.name ?? playerId;
}

export function playerMap(tournament: Tournament): Map<string, TournamentPlayer> {
  return new Map(tournament.state.players.map((player) => [player.id, player]));
}

export function sortLeaderboard(tournament: Tournament): LeaderboardEntry[] {
  return [...tournament.state.leaderboard];
}

export function displayMode(mode: string): string {
  return mode === "mexicano" ? "Mexicano" : "Americano";
}

export function displayRoundCount(tournament: Tournament): string {
  const { roundCount } = tournament.config;

  if (roundCount.type === "infinite") {
    return "∞ rounds";
  }

  return `${roundCount.value} rounds`;
}

export function formatShortTournamentDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = dateOnlyToLocalDate(value) ?? (isDateOnly ? null : new Date(value));

  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
  }).format(date);
}

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function normalizeRoomInput(value: string): string {
  return value.trim().toUpperCase();
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function dateOnlyToLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}
