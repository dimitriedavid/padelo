import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinishedTournamentPage } from "./FinishedTournamentPage";
import type { Tournament } from "../lib/types";

describe("FinishedTournamentPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("reopens a recently finished tournament and returns to the live room", async () => {
    vi.stubGlobal("EventSource", EventSourceMock);
    const user = userEvent.setup();
    const finishedAt = new Date(Date.now() - 60_000).toISOString();
    const finished = tournament({
      status: "finished",
      stateVersion: 2,
      finishedAt,
      updatedAt: finishedAt,
    });
    const reopened = tournament({
      status: "active",
      stateVersion: 3,
      finishedAt: null,
      updatedAt: "2026-05-07T12:01:05.000Z",
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const path = String(input);

      if (path.endsWith("/reopen")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({ expectedStateVersion: 2 });

        return jsonResponse({ tournament: reopened });
      }

      return jsonResponse({ tournament: finished });
    });

    render(
      <MemoryRouter initialEntries={["/t/ROOM42/done"]}>
        <Routes>
          <Route element={<FinishedTournamentPage />} path="/t/:roomCode/done" />
          <Route element={<div>Live room opened</div>} path="/t/:roomCode" />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: /reopen/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tournaments/ROOM42/reopen",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(await screen.findByText("Live room opened")).toBeInTheDocument();
  });
});

class EventSourceMock {
  static readonly CLOSED = 2;
  readonly url: string;
  readyState = 0;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  addEventListener() {}

  removeEventListener() {}

  close() {
    this.readyState = EventSourceMock.CLOSED;
  }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function tournament(overrides: Partial<Tournament>): Tournament {
  const players = [
    { id: "p1", name: "Alex" },
    { id: "p2", name: "Bianca" },
    { id: "p3", name: "Chris" },
    { id: "p4", name: "Dana" },
  ];

  return {
    id: "id-1",
    roomCode: "ROOM42",
    name: "Thursday Padel",
    config: {
      name: "Thursday Padel",
      date: "2026-05-07",
      mode: "americano",
      targetScore: 21,
      courtCount: 1,
      roundCount: { type: "fixed", value: 2 },
      players,
    },
    state: {
      targetScore: 21,
      currentRoundIndex: 0,
      players,
      rounds: [
        {
          index: 0,
          status: "active",
          sittingOut: [],
          matches: [
            {
              id: "r1m1",
              courtNumber: 1,
              sideA: ["p1", "p2"],
              sideB: ["p3", "p4"],
              result: {
                winningSide: "A",
                sideAScore: 13,
                sideBScore: 8,
                enteredAt: "2026-05-07T11:59:00.000Z",
              },
            },
          ],
        },
      ],
      leaderboard: players.map((player, index) => ({
        playerId: player.id,
        played: 1,
        wins: index < 2 ? 1 : 0,
        ties: 0,
        pointsFor: index < 2 ? 13 : 8,
        pointsAgainst: index < 2 ? 8 : 13,
        pointDiff: index < 2 ? 5 : -5,
      })),
    },
    stateVersion: 1,
    status: "active",
    createdAt: "2026-05-07T11:50:00.000Z",
    updatedAt: "2026-05-07T11:50:00.000Z",
    finishedAt: null,
    ...overrides,
  };
}
