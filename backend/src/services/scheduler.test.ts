import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createInitialTournamentState,
  maybeAppendNextRound,
  resolveRoundLimit,
} from "./scheduler.js";
import type { TournamentConfig, TournamentPlayer, TournamentRound, TournamentState } from "../types/tournament.js";

describe("scheduler", () => {
  it("resolves infinite round count without a round limit", () => {
    assert.equal(resolveRoundLimit({ type: "infinite" }), null);
    assert.equal(resolveRoundLimit({ type: "fixed", value: 8 }), 8);
  });

  it("generates all Americano fixed rounds at creation", () => {
    const state = createInitialTournamentState(config({ mode: "americano", roundCount: 3 }));

    assert.equal(state.rounds.length, 3);
    assert.equal(state.rounds[0]?.status, "active");
    assert.equal(state.rounds[1]?.status, "pending");
    assert.equal(state.rounds[0]?.matches.length, 1);
  });

  it("does not repeat Americano partners in the first n - 1 rounds when all players fit", () => {
    for (const playerCount of [4, 8, 12]) {
      const state = createInitialTournamentState(
        config({
          mode: "americano",
          players: names(playerCount),
          courtCount: playerCount / 4,
          roundCount: playerCount - 1,
        }),
      );

      assertNoRepeatedPartnerships(state.rounds);
      assert.equal(collectPartnerships(state.rounds).size, (playerCount * (playerCount - 1)) / 2);
    }
  });

  it("does not restart Americano with the same court matchups after a complete rotation", () => {
    const state = createInitialTournamentState(
      config({
        mode: "americano",
        players: names(8),
        courtCount: 2,
        roundCount: 8,
      }),
    );
    const firstRound = state.rounds[0];
    const eighthRound = state.rounds[7];

    assert.ok(firstRound);
    assert.ok(eighthRound);

    const firstRoundCourtGroups = new Set(firstRound.matches.map(courtGroupKey));

    for (const courtGroup of eighthRound.matches.map(courtGroupKey)) {
      assert.equal(firstRoundCourtGroups.has(courtGroup), false, `Repeated court matchup ${courtGroup}`);
    }
  });

  it("does not repeat the previous Americano round after a complete rotation", () => {
    const state = createInitialTournamentState(
      config({
        mode: "americano",
        players: names(8),
        courtCount: 2,
        roundCount: 8,
      }),
    );
    const seventhRound = state.rounds[6];
    const eighthRound = state.rounds[7];

    assert.ok(seventhRound);
    assert.ok(eighthRound);

    const seventhRoundCourtGroups = new Set(seventhRound.matches.map(courtGroupKey));

    for (const courtGroup of eighthRound.matches.map(courtGroupKey)) {
      assert.equal(seventhRoundCourtGroups.has(courtGroup), false, `Repeated court matchup ${courtGroup}`);
    }
  });

  it("changes opponents for repeated Americano partnerships after a complete rotation", () => {
    const state = createInitialTournamentState(
      config({
        mode: "americano",
        players: names(8),
        courtCount: 2,
        roundCount: 8,
      }),
    );
    const eighthRound = state.rounds[7];

    assert.ok(eighthRound);
    assertRepeatedPartnershipsChangeOpponents(state.rounds.slice(0, 7), eighthRound);
  });

  it("does not give players the same opponent pair in consecutive Americano rounds after rotation", () => {
    const state = createInitialTournamentState(
      config({
        mode: "americano",
        players: names(8),
        courtCount: 2,
        roundCount: 8,
      }),
    );
    const seventhRound = state.rounds[6];
    const eighthRound = state.rounds[7];

    assert.ok(seventhRound);
    assert.ok(eighthRound);
    assertNoRepeatedPlayerOpponents(seventhRound, eighthRound);
  });

  it("balances Americano opponents before repeating the same players heavily", () => {
    const state = createInitialTournamentState(
      config({
        mode: "americano",
        players: names(12),
        courtCount: 3,
        roundCount: 10,
        scheduleSeed: "2026-05-31T17:03:18.685Z",
      }),
    );
    const opponentCounts = collectOpponentCounts(state.rounds, state.players.map((player) => player.id));

    assert.equal(opponentCounts.filter((count) => count === 0).length, 0);
    assert.equal(Math.max(...opponentCounts), 3);
  });

  it("avoids long Americano opponent streaks when alternatives are available", () => {
    const state = createInitialTournamentState(
      config({
        mode: "americano",
        players: [
          "Victor",
          "Dimi",
          "Anton",
          "Cosmin S",
          "Radu",
          "Matei",
          "Cosmin G",
          "Traian",
        ],
        courtCount: 2,
        roundCount: 10,
        scheduleSeed: "2026-07-08T18:05:18.999Z",
      }),
    );

    assertMaxConsecutiveOpponentStreak(state.rounds, 2);
  });

  it("uses the Americano schedule seed to vary matchups for the same player order", () => {
    const first = createInitialTournamentState(
      config({
        mode: "americano",
        players: names(8),
        courtCount: 2,
        roundCount: 7,
        scheduleSeed: "2026-05-24T17:00:00.000Z",
      }),
    );
    const second = createInitialTournamentState(
      config({
        mode: "americano",
        players: names(8),
        courtCount: 2,
        roundCount: 7,
        scheduleSeed: "2026-06-01T17:00:00.000Z",
      }),
    );

    assert.notDeepEqual(roundSignature(first.rounds), roundSignature(second.rounds));
  });

  it("rotates Americano court assignment for the fixed round-robin player", () => {
    const state = createInitialTournamentState(
      config({
        mode: "americano",
        players: names(8),
        courtCount: 2,
        roundCount: 7,
      }),
    );
    const firstPlayerCourts = state.rounds.map((round) => {
      const match = round.matches.find((candidate) =>
        [...candidate.sideA, ...candidate.sideB].includes("p1"),
      );

      assert.ok(match);

      return match.courtNumber;
    });

    assert.deepEqual([...new Set(firstPlayerCourts)].sort(), [1, 2]);
  });

  it("keeps each Americano player in at most one match per round", () => {
    const state = createInitialTournamentState(
      config({
        mode: "americano",
        players: names(12),
        courtCount: 3,
        roundCount: 11,
      }),
    );

    for (const round of state.rounds) {
      assertRoundHasNoDuplicatePlayers(round);
      assert.equal(round.sittingOut.length, 0);
    }
  });

  it("never generates more Americano matches than available courts", () => {
    const state = createInitialTournamentState(
      config({
        mode: "americano",
        players: names(12),
        courtCount: 2,
        roundCount: 11,
      }),
    );

    for (const round of state.rounds) {
      assert.ok(round.matches.length <= 2);
    }
  });

  it("keeps Americano sitting-out players out of matches", () => {
    const state = createInitialTournamentState(
      config({
        mode: "americano",
        players: names(10),
        courtCount: 2,
        roundCount: 9,
      }),
    );

    for (const round of state.rounds) {
      const playing = new Set(round.matches.flatMap((match) => [...match.sideA, ...match.sideB]));

      for (const sittingOut of round.sittingOut) {
        assert.equal(playing.has(sittingOut), false);
      }
    }
  });

  it("rotates Americano byes for odd player counts without repeating partners", () => {
    const state = createInitialTournamentState(
      config({
        mode: "americano",
        players: names(5),
        courtCount: 1,
        roundCount: 5,
      }),
    );
    const sittingOut = state.rounds.flatMap((round) => round.sittingOut);

    assert.deepEqual(new Set(sittingOut), new Set(["p1", "p2", "p3", "p4", "p5"]));
    assertNoRepeatedPartnerships(state.rounds);
    assert.equal(collectPartnerships(state.rounds).size, 10);
  });

  it("tracks sitting-out players when there are not enough courts", () => {
    const state = createInitialTournamentState(
      config({
        mode: "americano",
        players: ["A", "B", "C", "D", "E", "F"],
        roundCount: 1,
      }),
    );

    assert.equal(state.rounds[0]?.matches.length, 1);
    assert.deepEqual(state.rounds[0]?.sittingOut, ["p3", "p4"]);
  });

  it("generates only the first Mexicano round at creation", () => {
    const state = createInitialTournamentState(config({ mode: "mexicano", roundCount: 3 }));

    assert.equal(state.rounds.length, 1);
    assert.equal(state.rounds[0]?.status, "active");
  });

  it("generates only the first Americano round for infinite tournaments", () => {
    const state = createInitialTournamentState(config({ mode: "americano", roundCount: "infinite" }));

    assert.equal(state.rounds.length, 1);
    assert.equal(state.rounds[0]?.status, "active");
  });

  it("appends the next Americano round after an infinite round completes", () => {
    const tournamentConfig = config({ mode: "americano", roundCount: "infinite" });
    const state = completeFirstMatch(createInitialTournamentState(tournamentConfig));
    const updatedState = maybeAppendNextRound(tournamentConfig, state);

    assert.equal(updatedState.rounds.length, 2);
    assert.equal(updatedState.currentRoundIndex, 1);
    assert.equal(updatedState.rounds[0]?.status, "complete");
    assert.equal(updatedState.rounds[1]?.status, "active");
  });

  it("appends the next Mexicano round after the latest round completes", () => {
    const tournamentConfig = config({ mode: "mexicano", roundCount: 2 });
    const state = completeFirstMatch(createInitialTournamentState(tournamentConfig));
    const updatedState = maybeAppendNextRound(tournamentConfig, state);

    assert.equal(updatedState.rounds.length, 2);
    assert.equal(updatedState.currentRoundIndex, 1);
    assert.equal(updatedState.rounds[0]?.status, "complete");
    assert.equal(updatedState.rounds[1]?.status, "active");
  });

  it("does not append Mexicano rounds beyond the configured round count", () => {
    const tournamentConfig = config({ mode: "mexicano", roundCount: 1 });
    const state = completeFirstMatch(createInitialTournamentState(tournamentConfig));
    const updatedState = maybeAppendNextRound(tournamentConfig, state);

    assert.equal(updatedState.rounds.length, 1);
    assert.equal(updatedState.rounds[0]?.status, "complete");
  });

  it("groups the next Mexicano round by leaderboard order", () => {
    const tournamentConfig = config({
      mode: "mexicano",
      players: names(8),
      courtCount: 2,
      roundCount: 2,
    });
    const state = createInitialTournamentState(tournamentConfig);
    const firstMatch = state.rounds[0]?.matches[0];
    const secondMatch = state.rounds[0]?.matches[1];

    assert.ok(firstMatch);
    assert.ok(secondMatch);

    firstMatch.result = {
      winningSide: "A",
      sideAScore: 21,
      sideBScore: 1,
      enteredAt: "2026-05-07T12:00:00.000Z",
    };
    secondMatch.result = {
      winningSide: "B",
      sideAScore: 10,
      sideBScore: 21,
      enteredAt: "2026-05-07T12:01:00.000Z",
    };

    const updatedState = maybeAppendNextRound(tournamentConfig, state);
    const nextRound = updatedState.rounds[1];
    const leaderboardOrder = updatedState.leaderboard.map((entry) => entry.playerId);

    assert.ok(nextRound);
    assert.notDeepEqual(leaderboardOrder, tournamentConfig.players.map((player) => player.id));
    assert.deepEqual(nextRound.matches[0]?.sideA, [leaderboardOrder[0], leaderboardOrder[3]]);
    assert.deepEqual(nextRound.matches[0]?.sideB, [leaderboardOrder[1], leaderboardOrder[2]]);
    assert.deepEqual(nextRound.matches[1]?.sideA, [leaderboardOrder[4], leaderboardOrder[7]]);
    assert.deepEqual(nextRound.matches[1]?.sideB, [leaderboardOrder[5], leaderboardOrder[6]]);
  });
});

function config(overrides: {
  mode: "americano" | "mexicano";
  roundCount: number | "infinite";
  players?: string[];
  courtCount?: number;
  scheduleSeed?: string;
}): TournamentConfig {
  const players = (overrides.players ?? ["A", "B", "C", "D"]).map<TournamentPlayer>((name, index) => ({
    id: `p${index + 1}`,
    name,
  }));
  const config: TournamentConfig = {
    name: "Test Tournament",
    mode: overrides.mode,
    targetScore: 21,
    courtCount: overrides.courtCount ?? 1,
    roundCount:
      overrides.roundCount === "infinite"
        ? { type: "infinite" }
        : { type: "fixed", value: overrides.roundCount },
    players,
  };

  if (overrides.scheduleSeed !== undefined) {
    config.scheduleSeed = overrides.scheduleSeed;
  }

  return config;
}

function names(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Player ${index + 1}`);
}

function collectPartnerships(rounds: TournamentRound[]): Set<string> {
  const partnerships = new Set<string>();

  for (const round of rounds) {
    for (const match of round.matches) {
      for (const side of [match.sideA, match.sideB]) {
        partnerships.add(partnershipKey(side));
      }
    }
  }

  return partnerships;
}

function collectOpponentCounts(rounds: TournamentRound[], playerIds: string[]): number[] {
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

  const values: number[] = [];

  for (let leftIndex = 0; leftIndex < playerIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < playerIds.length; rightIndex += 1) {
      const left = playerIds[leftIndex];
      const right = playerIds[rightIndex];

      assert.ok(left);
      assert.ok(right);
      values.push(counts.get(playerPairKey(left, right)) ?? 0);
    }
  }

  return values;
}

function assertNoRepeatedPartnerships(rounds: TournamentRound[]): void {
  const partnerships = new Set<string>();

  for (const round of rounds) {
    for (const match of round.matches) {
      for (const side of [match.sideA, match.sideB]) {
        const key = partnershipKey(side);

        assert.equal(partnerships.has(key), false, `Repeated partnership ${key}`);
        partnerships.add(key);
      }
    }
  }
}

function assertRoundHasNoDuplicatePlayers(round: TournamentRound): void {
  const players = round.matches.flatMap((match) => [...match.sideA, ...match.sideB]);

  assert.equal(players.length, new Set(players).size);
}

function assertRepeatedPartnershipsChangeOpponents(
  previousRounds: TournamentRound[],
  nextRound: TournamentRound,
): void {
  const previousPartnerships = new Map<string, PartnershipMatchContext>();

  for (const round of previousRounds) {
    for (const [partnership, context] of partnershipMatchContexts(round)) {
      previousPartnerships.set(partnership, context);
    }
  }

  for (const [partnership, context] of partnershipMatchContexts(nextRound)) {
    const previousContext = previousPartnerships.get(partnership);

    if (!previousContext) {
      continue;
    }

    assert.notEqual(
      context.opponentPartnership,
      previousContext.opponentPartnership,
      `Partnership ${partnership} repeated opponents ${context.opponentPartnership}`,
    );
  }
}

function assertNoRepeatedPlayerOpponents(previousRound: TournamentRound, nextRound: TournamentRound): void {
  const previousContexts = playerMatchContexts(previousRound);

  for (const [playerId, context] of playerMatchContexts(nextRound)) {
    const previousContext = previousContexts.get(playerId);

    if (!previousContext) {
      continue;
    }

    assert.notDeepEqual(
      context.opponents,
      previousContext.opponents,
      `Player ${playerId} repeated opponents ${context.opponents.join(":")}`,
    );
  }
}

function assertMaxConsecutiveOpponentStreak(rounds: TournamentRound[], maxStreak: number): void {
  const activeStreaks = new Map<string, number>();

  for (const round of rounds) {
    const roundOpponentPairs = collectRoundOpponentPairKeys(round);

    for (const pairKey of [...activeStreaks.keys()]) {
      if (!roundOpponentPairs.has(pairKey)) {
        activeStreaks.delete(pairKey);
      }
    }

    for (const pairKey of roundOpponentPairs) {
      const streak = (activeStreaks.get(pairKey) ?? 0) + 1;
      activeStreaks.set(pairKey, streak);

      assert.ok(
        streak <= maxStreak,
        `Opponent pair ${pairKey} repeated for ${streak} consecutive rounds`,
      );
    }
  }
}

function collectRoundOpponentPairKeys(round: TournamentRound): Set<string> {
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

function partnershipKey(side: [string, string]): string {
  return [...side].sort().join(":");
}

function playerPairKey(first: string, second: string): string {
  return [first, second].sort().join(":");
}

function courtGroupKey(match: TournamentRound["matches"][number]): string {
  return [...match.sideA, ...match.sideB].sort().join(":");
}

type PartnershipMatchContext = {
  opponentPartnership: string;
};

function partnershipMatchContexts(round: TournamentRound): Map<string, PartnershipMatchContext> {
  const contexts = new Map<string, PartnershipMatchContext>();

  for (const match of round.matches) {
    const sideA = partnershipKey(match.sideA);
    const sideB = partnershipKey(match.sideB);

    contexts.set(sideA, { opponentPartnership: sideB });
    contexts.set(sideB, { opponentPartnership: sideA });
  }

  return contexts;
}

type PlayerMatchContext = {
  opponents: string[];
};

function playerMatchContexts(round: TournamentRound): Map<string, PlayerMatchContext> {
  const contexts = new Map<string, PlayerMatchContext>();

  for (const match of round.matches) {
    for (const playerId of match.sideA) {
      contexts.set(playerId, { opponents: [...match.sideB].sort() });
    }

    for (const playerId of match.sideB) {
      contexts.set(playerId, { opponents: [...match.sideA].sort() });
    }
  }

  return contexts;
}

function roundSignature(rounds: TournamentRound[]): string[] {
  return rounds.flatMap((round) =>
    round.matches.map(
      (match) =>
        `${round.index}:${match.courtNumber}:${partnershipKey(match.sideA)}:${partnershipKey(match.sideB)}`,
    ),
  );
}

function completeFirstMatch(state: TournamentState): TournamentState {
  const match = state.rounds[0]?.matches[0];

  assert.ok(match);
  match.result = {
    winningSide: "A",
    sideAScore: 21,
    sideBScore: 10,
    enteredAt: "2026-05-07T12:00:00.000Z",
  };

  return state;
}
