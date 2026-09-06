import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Tournament, TournamentMode, TournamentTeam } from "../lib/types";
import { FinishedTournamentPage } from "./FinishedTournamentPage";
import { TournamentRoomPage } from "./TournamentRoomPage";

describe("fixed-pair standings and replay", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", EventSourceMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it.each(["active", "finished"] as const)("renders one undoubled score per pair in %s standings", async (status) => {
    const tournament = fixedPairTournament(status);
    mockFetch(tournament);
    const user = userEvent.setup();
    renderRoom(status);

    await screen.findByRole("heading", { name: tournament.name });
    if (status === "active") {
      await user.click(screen.getByRole("tab", { name: "Standings" }));
    }

    expect(screen.getAllByText("2 pairs").length).toBeGreaterThan(0);
    expectPairRows(13, 8);

    if (status === "active") {
      const updated: Tournament = {
        ...tournament,
        stateVersion: 2,
        state: {
          ...tournament.state,
          leaderboard: tournament.state.leaderboard.map((entry) => ({
            ...entry,
            pointsFor: entry.pointsFor + 21,
          })),
        },
      };
      await act(async () => {
        EventSourceMock.latest.dispatchEvent(new MessageEvent("tournament_updated", {
          data: JSON.stringify({ tournament: updated }),
        }));
      });
      expectPairRows(34, 29);
      expect(screen.queryByText("13", { exact: true })).not.toBeInTheDocument();
    }
  });

  it("shows resting partners together in the live round", async () => {
    const tournament = fixedPairTournament("active");
    tournament.config.players.push({ id: "p5", name: "Eli" }, { id: "p6", name: "Fran" });
    tournament.config.teams!.push({ id: "team-resting", playerIds: ["p5", "p6"] });
    tournament.state.rounds[0]!.sittingOut = ["p5", "p6"];
    mockFetch(tournament);
    renderRoom("active");

    expect(await screen.findByText("Sitting out this round")).toBeVisible();
    expect(screen.getByText("Eli + Fran", { exact: true })).toBeVisible();
  });

  it.each(["americano", "mexicano"] as const)("preserves explicit nonadjacent teams and %s format in Play again route state", async (mode) => {
    mockFetch(fixedPairTournament("finished", mode));
    const user = userEvent.setup();
    renderRoom("finished");

    await user.click(await screen.findByRole("button", { name: "Play again" }));

    expect(JSON.parse(screen.getByTestId("replay-state").textContent!)).toEqual({
      prefill: {
        mode,
        format: "fixed-pairs",
        teams: [[2, 0], [3, 1]],
        players: ["Alex", "Bianca", "Chris", "Dana"],
        courtCount: 1,
        roundCount: { type: "fixed", value: 2 },
        targetScore: 21,
      },
      sourceRoomCode: "PAIR42",
    });
  });
});

function expectPairRows(winnerPoints: number, loserPoints: number) {
  // The panel uses divs rather than semantic table rows; each points label anchors a row.
  const rows = screen.getAllByText("points", { exact: true }).map((label) => label.parentElement!.parentElement!);
  expect(rows).toHaveLength(2);
  for (const [index, names, points, record] of [
    [0, ["Chris", "Alex"], winnerPoints, "1W 0T 0L"],
    [1, ["Dana", "Bianca"], loserPoints, "0W 0T 1L"],
  ] as const) {
    const row = within(rows[index]!);
    for (const name of names) {
      expect(screen.getAllByText(name, { exact: true })).toHaveLength(1);
      expect(row.getByText(name, { exact: true })).toBeVisible();
    }
    expect(row.getByText(String(points), { exact: true })).toBeVisible();
    expect(row.queryByText(String(points * 2), { exact: true })).not.toBeInTheDocument();
    expect(row.getByText(record)).toBeVisible();
  }
  expect(screen.queryByText(/raw-team-/)).not.toBeInTheDocument();
}

function ReplayState() {
  const location = useLocation();
  return <pre data-testid="replay-state">{JSON.stringify(location.state)}</pre>;
}

function renderRoom(status: Tournament["status"]) {
  render(
    <MemoryRouter initialEntries={[status === "finished" ? "/t/PAIR42/done" : "/t/PAIR42"]}>
      <Routes>
        <Route element={<TournamentRoomPage />} path="/t/:roomCode" />
        <Route element={<FinishedTournamentPage />} path="/t/:roomCode/done" />
        <Route element={<ReplayState />} path="/new" />
      </Routes>
    </MemoryRouter>,
  );
}

class EventSourceMock extends EventTarget {
  static readonly CLOSED = 2;
  static latest: EventSourceMock;
  readyState = 1;
  onerror: (() => void) | null = null;

  constructor(public readonly url: string) {
    super();
    EventSourceMock.latest = this;
  }

  close() {
    this.readyState = EventSourceMock.CLOSED;
  }
}

function mockFetch(tournament: Tournament) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = String(input);
    if (path !== "/api/tournaments/PAIR42" && path !== "/api/tournaments/PAIR42/events") {
      throw new Error(`Unexpected fetch: ${path}`);
    }
    return new Response(JSON.stringify(path.endsWith("/events") ? { events: [] } : { tournament }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
}

function fixedPairTournament(status: Tournament["status"], mode: TournamentMode = "americano"): Tournament {
  const players = [
    { id: "p1", name: "Alex" },
    { id: "p2", name: "Bianca" },
    { id: "p3", name: "Chris" },
    { id: "p4", name: "Dana" },
  ];
  const teams: TournamentTeam[] = [
    { id: "raw-team-winners", playerIds: ["p3", "p1"] },
    { id: "raw-team-runners-up", playerIds: ["p4", "p2"] },
  ];
  return {
    id: "fixed-pair-id",
    roomCode: "PAIR42",
    name: "Fixed Pair Finals",
    config: {
      name: "Fixed Pair Finals",
      mode,
      format: "fixed-pairs",
      targetScore: 21,
      courtCount: 1,
      roundCount: { type: "fixed", value: 2 },
      players,
      teams,
    },
    state: {
      targetScore: 21,
      currentRoundIndex: 0,
      players,
      teams,
      rounds: [{
        index: 0,
        status: "complete",
        sittingOut: [],
        matches: [{
          id: "r1m1",
          courtNumber: 1,
          sideA: ["p3", "p1"],
          sideB: ["p4", "p2"],
          result: {
            winningSide: "A",
            sideAScore: 13,
            sideBScore: 8,
            enteredAt: "2026-05-07T12:00:00.000Z",
          },
        }],
      }],
      leaderboard: teams.map((team, index) => ({
        playerId: team.id,
        playerIds: team.playerIds,
        played: 1,
        wins: index === 0 ? 1 : 0,
        ties: 0,
        pointsFor: index === 0 ? 13 : 8,
        pointsAgainst: index === 0 ? 8 : 13,
        pointDiff: index === 0 ? 5 : -5,
      })),
    },
    stateVersion: 1,
    status,
    createdAt: "2026-05-07T11:00:00.000Z",
    updatedAt: "2026-05-07T12:00:00.000Z",
    finishedAt: status === "finished" ? "2026-05-07T12:00:00.000Z" : null,
  };
}
