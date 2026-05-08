import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculateLeaderboard } from "./leaderboard.js";
import type { TournamentPlayer, TournamentRound } from "../types/tournament.js";

describe("leaderboard", () => {
  it("adds each side score to every player on that side", () => {
    const leaderboard = calculateLeaderboard(players(4), [
      round([
        {
          id: "r1m1",
          courtNumber: 1,
          sideA: ["p1", "p2"],
          sideB: ["p3", "p4"],
          result: {
            winningSide: "A",
            sideAScore: 15,
            sideBScore: 9,
            enteredAt: "2026-05-08T12:00:00.000Z",
          },
        },
      ]),
    ]);

    assert.equal(leaderboard.find((entry) => entry.playerId === "p1")?.pointsFor, 15);
    assert.equal(leaderboard.find((entry) => entry.playerId === "p2")?.pointsFor, 15);
    assert.equal(leaderboard.find((entry) => entry.playerId === "p3")?.pointsFor, 9);
    assert.equal(leaderboard.find((entry) => entry.playerId === "p4")?.pointsFor, 9);
  });

  it("sorts by total points before match record", () => {
    const leaderboard = calculateLeaderboard(players(8), [
      round([
        {
          id: "r1m1",
          courtNumber: 1,
          sideA: ["p1", "p2"],
          sideB: ["p3", "p4"],
          result: {
            winningSide: "B",
            sideAScore: 20,
            sideBScore: 21,
            enteredAt: "2026-05-08T12:00:00.000Z",
          },
        },
      ]),
      round([
        {
          id: "r2m1",
          courtNumber: 1,
          sideA: ["p1", "p2"],
          sideB: ["p5", "p6"],
          result: {
            winningSide: "B",
            sideAScore: 20,
            sideBScore: 21,
            enteredAt: "2026-05-08T12:10:00.000Z",
          },
        },
      ]),
    ]);

    assert.equal(leaderboard[0]?.playerId, "p1");
    assert.equal(leaderboard[0]?.pointsFor, 40);
    assert.equal(leaderboard[0]?.wins, 0);
    assert.equal(leaderboard.find((entry) => entry.playerId === "p5")?.wins, 1);
    assert.equal(leaderboard.find((entry) => entry.playerId === "p5")?.pointsFor, 21);
  });
});

function players(count: number): TournamentPlayer[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
  }));
}

function round(matches: TournamentRound["matches"]): TournamentRound {
  return {
    index: 0,
    status: "complete",
    sittingOut: [],
    matches,
  };
}
