export type TournamentMode = "americano" | "mexicano";

export type TournamentStatus = "active" | "finished";

export type RoundCount = { type: "fixed"; value: number } | { type: "infinite" };

export type TournamentConfig = {
  name: string;
  mode: TournamentMode;
  targetScore: number;
  courtCount: number;
  roundCount: RoundCount;
  players: TournamentPlayer[];
};

export type Tournament = {
  id: string;
  roomCode: string;
  name: string;
  config: TournamentConfig;
  state: TournamentState;
  stateVersion: number;
  status: TournamentStatus;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

export type TournamentState = {
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
  playerId: string;
  played: number;
  wins: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
};

export type CreateTournamentRequest = {
  name: string;
  mode: TournamentMode;
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

export type TournamentEvent = {
  id: string;
  tournamentId: string;
  type:
    | "tournament_created"
    | "match_result_upserted"
    | "match_result_deleted"
    | "tournament_finished"
    | "play_again_created";
  payload: Record<string, unknown>;
  createdAt: string;
};

export type RecentRoom = {
  code: string;
  name: string;
  lastOpenedAt: string;
  mode?: TournamentMode;
  playerCount?: number;
  status: TournamentStatus;
};
