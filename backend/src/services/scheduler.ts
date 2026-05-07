import { calculateLeaderboard } from "./leaderboard.js";
import type {
  RoundCount,
  TournamentConfig,
  TournamentMatch,
  TournamentPlayer,
  TournamentRound,
  TournamentState,
} from "../types/tournament.js";

export function createInitialTournamentState(config: TournamentConfig): TournamentState {
  const totalRounds = resolveRoundCount(config.roundCount, config.players.length);
  const rounds =
    config.mode === "americano"
      ? Array.from({ length: totalRounds }, (_, index) =>
          generateAmericanoRound(config.players, config.courtCount, index),
        )
      : [generateAmericanoRound(config.players, config.courtCount, 0)];

  return normalizeTournamentState({
    targetScore: config.targetScore,
    currentRoundIndex: 0,
    players: config.players,
    rounds,
    leaderboard: [],
  });
}

export function maybeAppendNextMexicanoRound(
  config: TournamentConfig,
  state: TournamentState,
): TournamentState {
  const normalizedState = normalizeTournamentState(state);

  if (config.mode !== "mexicano") {
    return normalizedState;
  }

  const totalRounds = resolveRoundCount(config.roundCount, config.players.length);
  const latestRound = normalizedState.rounds[normalizedState.rounds.length - 1];

  if (!latestRound || normalizedState.rounds.length >= totalRounds || !isRoundComplete(latestRound)) {
    return normalizedState;
  }

  return normalizeTournamentState({
    ...normalizedState,
    rounds: [
      ...normalizedState.rounds,
      generateMexicanoRound(config, normalizedState, normalizedState.rounds.length),
    ],
  });
}

export function normalizeTournamentState(state: TournamentState): TournamentState {
  const firstIncompleteRoundIndex = state.rounds.findIndex((round) => !isRoundComplete(round));
  const currentRoundIndex =
    firstIncompleteRoundIndex === -1 ? Math.max(0, state.rounds.length - 1) : firstIncompleteRoundIndex;

  const rounds = state.rounds.map((round, index) => {
    if (isRoundComplete(round)) {
      return { ...round, status: "complete" as const };
    }

    return {
      ...round,
      status: index === currentRoundIndex ? ("active" as const) : ("pending" as const),
    };
  });

  return {
    ...state,
    currentRoundIndex,
    rounds,
    leaderboard: calculateLeaderboard(state.players, rounds),
  };
}

export function resolveRoundCount(roundCount: RoundCount, playerCount: number): number {
  if (roundCount.type === "fixed") {
    return roundCount.value;
  }

  return Math.max(1, playerCount % 2 === 0 ? playerCount - 1 : playerCount);
}

export function isRoundComplete(round: TournamentRound): boolean {
  return round.matches.length > 0 && round.matches.every((match) => match.result !== null);
}

function generateAmericanoRound(
  players: TournamentPlayer[],
  courtCount: number,
  roundIndex: number,
): TournamentRound {
  const roundPairs = generateAmericanoPairs(
    players.map((player) => player.id),
    roundIndex,
  );
  const matches = createMatchesFromPairs(roundPairs, courtCount, roundIndex);
  const playingPlayerIds = new Set(
    matches.flatMap((match) => [...match.sideA, ...match.sideB]),
  );

  return {
    index: roundIndex,
    status: roundIndex === 0 ? "active" : "pending",
    sittingOut: players
      .map((player) => player.id)
      .filter((playerId) => !playingPlayerIds.has(playerId)),
    matches,
  };
}

function generateMexicanoRound(
  config: TournamentConfig,
  state: TournamentState,
  roundIndex: number,
): TournamentRound {
  const rankedPlayerIds = state.leaderboard.map((entry) => entry.playerId);
  const matches = createMexicanoMatchesFromOrderedPlayers(rankedPlayerIds, config.courtCount, roundIndex);
  const matchPlayerCount = matches.length * 4;

  return {
    index: roundIndex,
    status: "pending",
    sittingOut: rankedPlayerIds.slice(matchPlayerCount),
    matches,
  };
}

function generateAmericanoPairs(playerIds: string[], roundIndex: number): [string, string][] {
  const playerCount = playerIds.length % 2 === 0 ? playerIds.length : playerIds.length + 1;
  const roundCount = playerCount - 1;
  const normalizedRoundIndex = roundIndex % roundCount;
  const slots: Array<string | null> = [...playerIds];

  if (slots.length < playerCount) {
    slots.push(null);
  }

  const rotated = rotateRoundRobinSlots(slots, normalizedRoundIndex);
  const pairs: [string, string][] = [];

  for (let index = 0; index < playerCount / 2; index += 1) {
    const left = rotated[index];
    const right = rotated[playerCount - 1 - index];

    if (left && right) {
      pairs.push([left, right]);
    }
  }

  return pairs;
}

function createMatchesFromPairs(
  roundPairs: [string, string][],
  courtCount: number,
  roundIndex: number,
): TournamentMatch[] {
  const playablePairCount = Math.min(courtCount * 2, Math.floor(roundPairs.length / 2) * 2);
  const playablePairs = roundPairs.slice(0, playablePairCount);

  return Array.from({ length: playablePairs.length / 2 }, (_, matchIndex) => {
    const sideA = playablePairs[matchIndex * 2];
    const sideB = playablePairs[matchIndex * 2 + 1];

    if (!sideA || !sideB) {
      throw new Error("Cannot create a match without two complete sides.");
    }

    return {
      id: `r${roundIndex + 1}m${matchIndex + 1}`,
      courtNumber: matchIndex + 1,
      sideA,
      sideB,
      result: null,
    };
  });
}

function createMexicanoMatchesFromOrderedPlayers(
  orderedPlayerIds: string[],
  courtCount: number,
  roundIndex: number,
): TournamentMatch[] {
  const matchCount = Math.min(courtCount, Math.floor(orderedPlayerIds.length / 4));

  return Array.from({ length: matchCount }, (_, matchIndex) => {
    const group = asFour(orderedPlayerIds.slice(matchIndex * 4, matchIndex * 4 + 4));
    const [sideA, sideB] = createMexicanoSides(group);

    return {
      id: `r${roundIndex + 1}m${matchIndex + 1}`,
      courtNumber: matchIndex + 1,
      sideA,
      sideB,
      result: null,
    };
  });
}

function createMexicanoSides([
  first,
  second,
  third,
  fourth,
]: [string, string, string, string]): [[string, string], [string, string]] {
  return [
    [first, fourth],
    [second, third],
  ];
}

function rotateRoundRobinSlots<T>(slots: T[], offset: number): T[] {
  if (slots.length < 2) {
    return [...slots];
  }

  const [fixed, ...rotating] = slots;

  if (!fixed) {
    throw new Error("Cannot generate rounds without players.");
  }

  return [
    fixed,
    ...Array.from({ length: rotating.length }, (_, index) => {
      const item = rotating[(index - offset + rotating.length) % rotating.length];

      if (item === undefined) {
        throw new Error("Cannot rotate round-robin slots.");
      }

      return item;
    }),
  ];
}

function rotatePlayers(playerIds: string[], offset: number): string[] {
  return Array.from({ length: playerIds.length }, (_, index) => {
    const playerId = playerIds[(index + offset) % playerIds.length];

    if (!playerId) {
      throw new Error("Cannot generate rounds without players.");
    }

    return playerId;
  });
}

function asFour<T>(items: T[]): [T, T, T, T] {
  if (items.length !== 4) {
    throw new Error("Expected a complete group of four players.");
  }

  return items as [T, T, T, T];
}
