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

  if (roundCount.type === "auto") {
    return `${tournament.state.rounds.length} auto`;
  }

  return `${roundCount.value} rounds`;
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

