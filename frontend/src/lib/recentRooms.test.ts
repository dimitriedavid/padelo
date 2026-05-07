import { afterEach, describe, expect, it } from "vitest";

import { clearRecentRooms, getRecentRooms, saveRecentTournament } from "./recentRooms";
import type { Tournament } from "./types";

describe("recent rooms", () => {
  afterEach(() => {
    clearRecentRooms();
  });

  it("saves newest room first and replaces existing rooms by code", () => {
    saveRecentTournament(tournament({ roomCode: "AAA111", name: "First" }));
    saveRecentTournament(tournament({ roomCode: "BBB222", name: "Second" }));
    saveRecentTournament(tournament({ roomCode: "AAA111", name: "First Updated" }));

    const rooms = getRecentRooms();

    expect(rooms).toHaveLength(2);
    expect(rooms[0]).toMatchObject({ code: "AAA111", name: "First Updated" });
    expect(rooms[1]).toMatchObject({ code: "BBB222", name: "Second" });
  });
});

function tournament(overrides: Partial<Tournament>): Tournament {
  return {
    id: "id",
    roomCode: "ROOM42",
    name: "Room",
    config: {
      name: "Room",
      mode: "americano",
      targetScore: 21,
      courtCount: 1,
      roundCount: { type: "fixed", value: 2 },
      players: [
        { id: "p1", name: "A" },
        { id: "p2", name: "B" },
        { id: "p3", name: "C" },
        { id: "p4", name: "D" },
      ],
    },
    state: {
      targetScore: 21,
      currentRoundIndex: 0,
      players: [
        { id: "p1", name: "A" },
        { id: "p2", name: "B" },
        { id: "p3", name: "C" },
        { id: "p4", name: "D" },
      ],
      rounds: [],
      leaderboard: [],
    },
    stateVersion: 1,
    status: "active",
    createdAt: "2026-05-07T12:00:00.000Z",
    updatedAt: "2026-05-07T12:00:00.000Z",
    finishedAt: null,
    ...overrides,
  };
}

