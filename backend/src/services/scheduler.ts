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
  if (config.format === "fixed-pairs") {
    if (!config.teams || config.teams.length < 2) {
      throw new Error("Fixed-pair scheduling requires at least two teams.");
    }
    const state: TournamentState = {
      targetScore: config.targetScore,
      currentRoundIndex: 0,
      players: config.players,
      teams: config.teams,
      rounds: [],
      leaderboard: [],
    };
    const count = config.mode === "americano" ? roundLimit ?? 1 : 1;
    for (let index = 0; index < count; index += 1) {
      state.rounds.push(generateFixedPairsRound(config, state, index));
    }
    return normalizeTournamentState(state);
  }
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
    config.format === "fixed-pairs"
      ? generateFixedPairsRound(config, normalizedState, nextRoundIndex)
      : config.mode === "mexicano"
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
    // A representative gets exactly one side's stats, not the sum of both members.
    leaderboard: state.teams
      ? calculateLeaderboard(
          state.teams.map((team) => ({ id: team.playerIds[0], name: team.id })),
          rounds,
        ).map((entry) => {
          const team = state.teams!.find((candidate) => candidate.playerIds[0] === entry.playerId)!;
          return { ...entry, playerId: team.id, playerIds: team.playerIds };
        })
      : calculateLeaderboard(state.players, rounds),
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

function generateFixedPairsRound(
  config: TournamentConfig,
  state: TournamentState,
  roundIndex: number,
): TournamentRound {
  const teams = config.teams;
  if (!teams || teams.length < 2) {
    throw new Error("Fixed-pair scheduling requires at least two teams.");
  }
  const orderedIds = orderAmericanoPlayerIds(teams.map((team) => team.id), config.scheduleSeed);
  const byId = new Map(teams.map((team) => [team.id, team]));
  const byPlayer = new Map(teams.flatMap((team) => team.playerIds.map((id) => [id, team.id] as const)));
  const appearances = new Map(teams.map((team) => [team.id, 0]));
  const lastPlayed = new Map(teams.map((team) => [team.id, -1]));
  for (const round of state.rounds) {
    for (const match of round.matches) {
      for (const side of [match.sideA, match.sideB]) {
        const id = byPlayer.get(side[0])!;
        appearances.set(id, appearances.get(id)! + 1);
        lastPlayed.set(id, round.index);
      }
    }
  }

  let fixtures: [string, string][];
  if (config.mode === "americano") {
    const batchesPerRound = Math.ceil(Math.floor(teams.length / 2) / config.courtCount);
    const fixtureRound = Math.floor(roundIndex / batchesPerRound);
    const batchIndex = roundIndex % batchesPerRound;
    const alreadyPlayed = new Set(
      state.rounds.slice(roundIndex - batchIndex).flatMap((round) =>
        round.matches.flatMap((match) => [byPlayer.get(match.sideA[0]), byPlayer.get(match.sideB[0])]),
      ),
    );
    // Finish every fixture in this circle round before advancing, including the short batch.
    fixtures = generateAmericanoPairs(orderedIds, fixtureRound)
      .filter(([first, second]) => !alreadyPlayed.has(first) && !alreadyPlayed.has(second))
      .sort((a, b) =>
        (appearances.get(a[0])! + appearances.get(a[1])!) -
          (appearances.get(b[0])! + appearances.get(b[1])!) ||
        (lastPlayed.get(a[0])! + lastPlayed.get(a[1])!) -
          (lastPlayed.get(b[0])! + lastPlayed.get(b[1])!),
      )
      .slice(0, config.courtCount);
  } else {
    // Appearances prevent starvation; rank breaks ties without locking in rest groups.
    const rank = new Map(state.leaderboard.map((entry, index) => [entry.playerId, index]));
    const eligible = [...orderedIds].sort((a, b) =>
      appearances.get(a)! - appearances.get(b)! || (rank.get(a) ?? 0) - (rank.get(b) ?? 0),
    ).slice(0, Math.min(config.courtCount, Math.floor(teams.length / 2)) * 2);
    if (roundIndex > 0) {
      eligible.sort((a, b) => rank.get(a)! - rank.get(b)!);
    }
    fixtures = [];
    for (let index = 0; index < eligible.length; index += 2) {
      fixtures.push([eligible[index]!, eligible[index + 1]!]);
    }
  }

  const matches: TournamentMatch[] = fixtures.map(([first, second], index) => ({
    id: `r${roundIndex + 1}m${index + 1}`,
    courtNumber: index + 1,
    sideA: [...byId.get(first)!.playerIds],
    sideB: [...byId.get(second)!.playerIds],
    result: null,
  }));
  const playing = new Set(matches.flatMap((match) => [...match.sideA, ...match.sideB]));
  return {
    index: roundIndex,
    status: roundIndex === 0 ? "active" : "pending",
    sittingOut: config.players.map((player) => player.id).filter((id) => !playing.has(id)),
    matches,
  };
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
  const opponentStreaks = collectOpponentStreaks(previousRounds);
  const previousCourtGroups = collectCourtGroups(previousRounds);
  const preferredGroups = rotateItems(createRoundRobinMatchPairGroups(roundPairs, matchingIndex), roundIndex + matchingIndex);
  const preferredOrder = new Map(
    preferredGroups.map(([sideA, sideB], index) => [matchPairGroupKey(sideA, sideB), index]),
  );
  const candidates = createMatchPairGroupCandidates(
    roundPairs,
    opponentCounts,
    opponentStreaks,
    previousCourtGroups,
    preferredOrder,
  );
  const beamWidth = 128;
  let states: MatchPairGroupSearchState[] = [
    { groups: [], usedPairIndexes: new Set(), score: 0, streakScore: 0, orderKey: "" },
  ];

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
          streakScore: state.streakScore + candidate.streakScore,
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
  streakScore: number;
  order: number;
};

type MatchPairGroupSearchState = {
  groups: Array<[[string, string], [string, string]]>;
  usedPairIndexes: Set<number>;
  score: number;
  streakScore: number;
  orderKey: string;
};

function createMatchPairGroupCandidates(
  roundPairs: [string, string][],
  opponentCounts: Map<string, number>,
  opponentStreaks: Map<string, number>,
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
        streakScore: opponentStreakCost(sideA, sideB, opponentStreaks),
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

  if (first.streakScore !== second.streakScore) {
    return first.streakScore - second.streakScore;
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

function collectOpponentStreaks(rounds: TournamentRound[]): Map<string, number> {
  const streaks = new Map<string, number>();
  let activeStreakPairs: Set<string> | null = null;

  for (let roundIndex = rounds.length - 1; roundIndex >= 0; roundIndex -= 1) {
    const round = rounds[roundIndex];

    if (!round) {
      continue;
    }

    const roundOpponentPairs = collectRoundOpponentPairs(round);

    if (activeStreakPairs === null) {
      activeStreakPairs = roundOpponentPairs;

      for (const pairKey of activeStreakPairs) {
        streaks.set(pairKey, 1);
      }

      continue;
    }

    activeStreakPairs = new Set(
      [...activeStreakPairs].filter((pairKey: string) => roundOpponentPairs.has(pairKey)),
    );

    if (activeStreakPairs.size === 0) {
      break;
    }

    for (const pairKey of activeStreakPairs) {
      streaks.set(pairKey, (streaks.get(pairKey) ?? 0) + 1);
    }
  }

  return streaks;
}

function collectRoundOpponentPairs(round: TournamentRound): Set<string> {
  const pairs = new Set<string>();

  for (const match of round.matches) {
    for (const playerId of match.sideA) {
      for (const opponentId of match.sideB) {
        pairs.add(playerPairKey(playerId, opponentId));
      }
    }
  }

  return pairs;
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
      const opponentPairKey = playerPairKey(playerId, opponentId);
      const previousCount = opponentCounts.get(opponentPairKey) ?? 0;
      cost += previousCount * 2 + 1;
    }
  }

  return cost;
}

function opponentStreakCost(
  sideA: [string, string],
  sideB: [string, string],
  opponentStreaks: Map<string, number>,
): number {
  let cost = 0;

  for (const playerId of sideA) {
    for (const opponentId of sideB) {
      const opponentStreak = opponentStreaks.get(playerPairKey(playerId, opponentId)) ?? 0;
      cost += opponentStreak * opponentStreak;
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
