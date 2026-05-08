import type { MatchResult, TournamentMode, TournamentRoundStatus } from "@/lib/types";

export type ScoreboardPlayerId = string;

export type ScoreboardPlayer = {
  id: ScoreboardPlayerId;
  name: string;
  initials: string;
  hue?: string;
};

export type ScoreboardStanding = ScoreboardPlayer & {
  played: number;
  points: number;
  wins: number;
  ties: number;
  losses: number;
  pointDiff: number;
};

export type ScoreboardMatch = {
  id: string;
  courtNumber: number;
  sideA: [ScoreboardPlayer, ScoreboardPlayer];
  sideB: [ScoreboardPlayer, ScoreboardPlayer];
  result?: MatchResult | undefined;
};

export type ScoreboardRound = {
  index: number;
  status: TournamentRoundStatus;
  matches: ScoreboardMatch[];
};

export type ScoreboardTournament = {
  roomCode: string;
  name: string;
  mode: TournamentMode;
  targetScore: number;
  totalRounds: number;
  currentRoundIndex: number;
  activeRoundIndex: number;
  courts: number;
  players: ScoreboardPlayer[];
  rounds: ScoreboardRound[];
  standings: ScoreboardStanding[];
};

export type ScoreboardLogEntry = {
  ago: string;
  text: string;
  score?: string | undefined;
};

export type ResultSubmission = {
  matchId: string;
  sideAScore: number;
  sideBScore: number;
  expectedStateVersion: number;
};
