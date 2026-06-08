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
  const roundLimit = resolveRoundLimit(config.roundCount);
  const rounds =
    config.mode === "americano" && roundLimit !== null
      ? generateAmericanoRounds(config.players, config.courtCount, roundLimit, config.scheduleSeed)
      : [generateAmericanoRound(config.players, config.courtCount, 0, config.scheduleSeed)];

  return normalizeTournamentState({
    targetScore: config.targetScore,
    currentRoundIndex: 0,
    players: config.players,
    rounds,
    leaderboard: [],
  });
}

export function maybeAppendNextRound(
  config: TournamentConfig,
  state: TournamentState,
): TournamentState {
  const normalizedState = normalizeTournamentState(state);

  const roundLimit = resolveRoundLimit(config.roundCount);
  const latestRound = normalizedState.rounds[normalizedState.rounds.length - 1];

  if (
    !latestRound ||
    (roundLimit !== null && normalizedState.rounds.length >= roundLimit) ||
    !isRoundComplete(latestRound)
  ) {
    return normalizedState;
  }

  const nextRoundIndex = normalizedState.rounds.length;
  const nextRound =
    config.mode === "mexicano"
      ? generateMexicanoRound(config, normalizedState, nextRoundIndex)
      : generateAmericanoRound(
          config.players,
          config.courtCount,
          nextRoundIndex,
          config.scheduleSeed,
          normalizedState.rounds,
        );

  return normalizeTournamentState({
    ...normalizedState,
    rounds: [...normalizedState.rounds, nextRound],
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

export function resolveRoundLimit(roundCount: RoundCount): number | null {
  if (roundCount.type === "fixed") {
    return roundCount.value;
  }

  return null;
}

export function isRoundComplete(round: TournamentRound): boolean {
  return round.matches.length > 0 && round.matches.every((match) => match.result !== null);
}

function orderAmericanoPlayerIds(playerIds: string[], scheduleSeed: string | undefined): string[] {
  if (!scheduleSeed) {
    return [...playerIds];
  }

  return shuffleItems(playerIds, `${scheduleSeed}:${playerIds.join("|")}`);
}

function generateAmericanoRound(
  players: TournamentPlayer[],
  courtCount: number,
  roundIndex: number,
  scheduleSeed?: string,
  previousRounds: TournamentRound[] = [],
): TournamentRound {
  const playerIds = orderAmericanoPlayerIds(
    players.map((player) => player.id),
    scheduleSeed,
  );
  const roundCycle = americanoRoundCycle(playerIds.length, roundIndex);
  const roundPairs = generateAmericanoPairs(
    playerIds,
    roundCycle.partnershipRoundIndex,
  );
  const matches = createMatchesFromPairs(
    roundPairs,
    courtCount,
    roundIndex,
    roundCycle.matchingIndex,
    previousRounds,
  );
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

function generateAmericanoRounds(
  players: TournamentPlayer[],
  courtCount: number,
  roundCount: number,
  scheduleSeed?: string,
): TournamentRound[] {
  const rounds: TournamentRound[] = [];

  for (let index = 0; index < roundCount; index += 1) {
    rounds.push(generateAmericanoRound(players, courtCount, index, scheduleSeed, rounds));
  }

  return rounds;
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
  const normalizedRoundIndex = positiveModulo(roundIndex, roundCount);
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
  matchingIndex: number,
  previousRounds: TournamentRound[] = [],
): TournamentMatch[] {
  const playablePairGroups = createBalancedMatchPairGroups(
    roundPairs,
    courtCount,
    roundIndex,
    matchingIndex,
    previousRounds,
  );

  return playablePairGroups.map(([sideA, sideB], matchIndex) => {
    return {
      id: `r${roundIndex + 1}m${matchIndex + 1}`,
      courtNumber: matchIndex + 1,
      sideA,
      sideB,
      result: null,
    };
  });
}

function americanoRoundCycle(
  playerCount: number,
  roundIndex: number,
): { partnershipRoundIndex: number; matchingIndex: number } {
  const roundCount = (playerCount % 2 === 0 ? playerCount : playerCount + 1) - 1;
  const cycleIndex = Math.floor(roundIndex / roundCount);

  return {
    partnershipRoundIndex: positiveModulo(roundIndex + cycleIndex, roundCount),
    matchingIndex: cycleIndex,
  };
}

function createBalancedMatchPairGroups(
  roundPairs: [string, string][],
  courtCount: number,
  roundIndex: number,
  matchingIndex: number,
  previousRounds: TournamentRound[],
): Array<[[string, string], [string, string]]> {
  const groupCount = Math.min(courtCount, Math.floor(roundPairs.length / 2));

  if (groupCount === 0) {
    return [];
  }

  const opponentCounts = collectOpponentCounts(previousRounds);
  const previousCourtGroups = collectCourtGroups(previousRounds);
  const preferredGroups = rotateItems(createRoundRobinMatchPairGroups(roundPairs, matchingIndex), roundIndex + matchingIndex);
  const preferredOrder = new Map(
    preferredGroups.map(([sideA, sideB], index) => [matchPairGroupKey(sideA, sideB), index]),
  );
  const candidates = createMatchPairGroupCandidates(roundPairs, opponentCounts, previousCourtGroups, preferredOrder);
  const beamWidth = 128;
  let states: MatchPairGroupSearchState[] = [{ groups: [], usedPairIndexes: new Set(), score: 0, orderKey: "" }];

  for (let index = 0; index < groupCount; index += 1) {
    const nextStates: MatchPairGroupSearchState[] = [];

    for (const state of states) {
      for (const candidate of candidates) {
        if (
          state.usedPairIndexes.has(candidate.leftIndex) ||
          state.usedPairIndexes.has(candidate.rightIndex)
        ) {
          continue;
        }

        const usedPairIndexes = new Set(state.usedPairIndexes);
        usedPairIndexes.add(candidate.leftIndex);
        usedPairIndexes.add(candidate.rightIndex);
        nextStates.push({
          groups: [...state.groups, [candidate.sideA, candidate.sideB]],
          usedPairIndexes,
          score: state.score + candidate.score,
          orderKey: `${state.orderKey}:${candidate.order}`,
        });
      }
    }

    states = nextStates.sort(compareMatchPairGroupSearchStates).slice(0, beamWidth);
  }

  const [best] = states;

  if (!best) {
    return [];
  }

  return best.groups;
}

function createRoundRobinMatchPairGroups(
  roundPairs: [string, string][],
  matchingIndex: number,
): Array<[[string, string], [string, string]]> {
  const slotCount = roundPairs.length % 2 === 0 ? roundPairs.length : roundPairs.length + 1;
  const slots: Array<number | null> = roundPairs.map((_, index) => index);

  if (slots.length < slotCount) {
    slots.push(null);
  }

  const matchingRoundCount = Math.max(1, slotCount - 1);
  const matchingOffset = positiveModulo(slotCount - 2 + matchingIndex, matchingRoundCount);
  const matchedSlots = rotateRoundRobinSlots(slots, matchingOffset);
  const matchPairGroups: Array<[[string, string], [string, string]]> = [];

  for (let index = 0; index < slotCount / 2; index += 1) {
    const leftIndex = matchedSlots[index];
    const rightIndex = matchedSlots[slotCount - 1 - index];

    if (leftIndex === undefined || rightIndex === undefined) {
      throw new Error("Cannot create matches without pair slots.");
    }

    if (leftIndex === null || rightIndex === null) {
      continue;
    }

    const sideA = roundPairs[leftIndex];
    const sideB = roundPairs[rightIndex];

    if (!sideA || !sideB) {
      throw new Error("Cannot create a match without two complete sides.");
    }

    matchPairGroups.push([sideA, sideB]);
  }

  return matchPairGroups;
}

type MatchPairGroupCandidate = {
  leftIndex: number;
  rightIndex: number;
  sideA: [string, string];
  sideB: [string, string];
  score: number;
  order: number;
};

type MatchPairGroupSearchState = {
  groups: Array<[[string, string], [string, string]]>;
  usedPairIndexes: Set<number>;
  score: number;
  orderKey: string;
};

function createMatchPairGroupCandidates(
  roundPairs: [string, string][],
  opponentCounts: Map<string, number>,
  previousCourtGroups: Set<string>,
  preferredOrder: Map<string, number>,
): MatchPairGroupCandidate[] {
  const candidates: MatchPairGroupCandidate[] = [];

  for (let leftIndex = 0; leftIndex < roundPairs.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < roundPairs.length; rightIndex += 1) {
      const sideA = roundPairs[leftIndex];
      const sideB = roundPairs[rightIndex];

      if (!sideA || !sideB) {
        throw new Error("Cannot create a match without two complete sides.");
      }

      const key = matchPairGroupKey(sideA, sideB);
      const repeatedCourtGroupPenalty = previousCourtGroups.has(courtGroupKey(sideA, sideB)) ? 100 : 0;

      candidates.push({
        leftIndex,
        rightIndex,
        sideA,
        sideB,
        score: opponentRepeatCost(sideA, sideB, opponentCounts) + repeatedCourtGroupPenalty,
        order: preferredOrder.get(key) ?? roundPairs.length * roundPairs.length + candidates.length,
      });
    }
  }

  return candidates.sort((first, second) => {
    if (first.score !== second.score) {
      return first.score - second.score;
    }

    return first.order - second.order;
  });
}

function compareMatchPairGroupSearchStates(
  first: MatchPairGroupSearchState,
  second: MatchPairGroupSearchState,
): number {
  if (first.score !== second.score) {
    return first.score - second.score;
  }

  return first.orderKey.localeCompare(second.orderKey);
}

function collectOpponentCounts(rounds: TournamentRound[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const round of rounds) {
    for (const match of round.matches) {
      for (const playerId of match.sideA) {
        for (const opponentId of match.sideB) {
          const key = playerPairKey(playerId, opponentId);
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    }
  }

  return counts;
}

function collectCourtGroups(rounds: TournamentRound[]): Set<string> {
  const groups = new Set<string>();

  for (const round of rounds) {
    for (const match of round.matches) {
      groups.add(courtGroupKey(match.sideA, match.sideB));
    }
  }

  return groups;
}

function opponentRepeatCost(
  sideA: [string, string],
  sideB: [string, string],
  opponentCounts: Map<string, number>,
): number {
  let cost = 0;

  for (const playerId of sideA) {
    for (const opponentId of sideB) {
      const previousCount = opponentCounts.get(playerPairKey(playerId, opponentId)) ?? 0;
      cost += previousCount * 2 + 1;
    }
  }

  return cost;
}

function matchPairGroupKey(sideA: [string, string], sideB: [string, string]): string {
  return [partnershipKey(sideA), partnershipKey(sideB)].sort().join("|");
}

function courtGroupKey(sideA: [string, string], sideB: [string, string]): string {
  return [...sideA, ...sideB].sort().join(":");
}

function partnershipKey(side: [string, string]): string {
  return [...side].sort().join(":");
}

function playerPairKey(first: string, second: string): string {
  return [first, second].sort().join(":");
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

  if (fixed === undefined || fixed === null) {
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

function rotateItems<T>(items: T[], offset: number): T[] {
  if (items.length === 0) {
    return [];
  }

  const normalizedOffset = positiveModulo(offset, items.length);

  return Array.from({ length: items.length }, (_, index) => {
    const item = items[(index - normalizedOffset + items.length) % items.length];

    if (item === undefined) {
      throw new Error("Cannot rotate items.");
    }

    return item;
  });
}

function shuffleItems<T>(items: T[], seed: string): T[] {
  const shuffled = [...items];
  const random = seededRandom(hashString(seed));

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    const replacement = shuffled[swapIndex];

    if (current === undefined || replacement === undefined) {
      throw new Error("Cannot shuffle missing items.");
    }

    shuffled[index] = replacement;
    shuffled[swapIndex] = current;
  }

  return shuffled;
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function asFour<T>(items: T[]): [T, T, T, T] {
  if (items.length !== 4) {
    throw new Error("Expected a complete group of four players.");
  }

  return items as [T, T, T, T];
}
