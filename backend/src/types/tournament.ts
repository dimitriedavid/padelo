export type TournamentMode = "americano" | "mexicano";

export type TournamentFormat = "rotating" | "fixed-pairs";

export type TournamentTeam = {
  id: string;
  playerIds: [string, string];
};

export type TournamentStatus = "active" | "finished";

export type RoundCount =
  | { type: "fixed"; value: number }
  | { type: "infinite" };

export type TournamentConfig = {
  name: string;
  date?: string;
  mode: TournamentMode;
  format?: TournamentFormat;
  teams?: TournamentTeam[];
  scheduleSeed?: string;
  targetScore: number;
  courtCount: number;
  roundCount: RoundCount;
  players: TournamentPlayer[];
};

export type TournamentState = {
  teams?: TournamentTeam[];
  targetScore: number;
  currentRoundIndex: number;
  players: TournamentPlayer[];
  rounds: TournamentRound[];
  leaderboard: LeaderboardEntry[];
};

export type TournamentPlayer = {
  id: string;
  name: string;
};

export type TournamentRoundStatus = "pending" | "active" | "complete";

export type TournamentRound = {
  index: number;
  status: TournamentRoundStatus;
  sittingOut: string[];
  matches: TournamentMatch[];
};

export type TournamentMatch = {
  id: string;
  courtNumber: number;
  sideA: [string, string];
  sideB: [string, string];
  result: MatchResult | null;
};

export type MatchSide = "A" | "B";

export type MatchResult = {
  winningSide: MatchSide | null;
  sideAScore: number;
  sideBScore: number;
  enteredAt: string;
  updatedAt?: string;
};

export type LeaderboardEntry = {
  // Entity key: a player ID for rotating, a team ID for fixed-pairs.
  playerId: string;
  playerIds?: [string, string];
  played: number;
  wins: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
};

export type CreateTournamentRequest = {
  name: string;
  date: string;
  mode: TournamentMode;
  format?: TournamentFormat;
  // Zero-based indices into the flat players array; required for fixed-pairs.
  teams?: [number, number][];
  players: string[];
  courtCount: number;
  roundCount: RoundCount;
  targetScore: number;
};

export type UpsertMatchResultRequest = {
  sideAScore: number;
  sideBScore: number;
  expectedStateVersion: number;
};

export type DeleteMatchResultRequest = {
  expectedStateVersion: number;
};

export type FinishTournamentRequest = {
  expectedStateVersion: number;
};

export type ReopenTournamentRequest = {
  expectedStateVersion: number;
};

export type TournamentLogType =
  | "tournament_created"
  | "match_result_upserted"
  | "match_result_deleted"
  | "tournament_finished"
  | "tournament_reopened"
  | "play_again_created";
