import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewTournamentPage } from "./NewTournamentPage";
import type { Tournament } from "../lib/types";

describe("NewTournamentPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("submits a create tournament request and navigates to the room", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tournament: tournament() }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

    render(
      <MemoryRouter initialEntries={["/new"]}>
        <Routes>
          <Route element={<NewTournamentPage />} path="/new" />
          <Route element={<div>Room opened</div>} path="/t/:roomCode" />
        </Routes>
      </MemoryRouter>,
    );

    await user.clear(screen.getByPlaceholderText("Player 1"));
    await user.type(screen.getByPlaceholderText("Player 1"), "Alex");
    await user.type(screen.getByPlaceholderText("Player 2"), "Bianca");
    await user.type(screen.getByPlaceholderText("Player 3"), "Chris");
    await user.type(screen.getByPlaceholderText("Player 4"), "Dana");
    await user.click(screen.getByRole("button", { name: /create room/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tournaments",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(await screen.findByText("Room opened")).toBeInTheDocument();
    expect(localStorage.getItem("padelo.recentRooms")).toContain("ROOM42");
  });
});

function tournament(): Tournament {
  return {
    id: "id",
    roomCode: "ROOM42",
    name: "Thursday Padel",
    config: {
      name: "Thursday Padel",
      mode: "americano",
      targetScore: 21,
      courtCount: 1,
      roundCount: { type: "fixed", value: 3 },
      players: [
        { id: "p1", name: "Alex" },
        { id: "p2", name: "Bianca" },
        { id: "p3", name: "Chris" },
        { id: "p4", name: "Dana" },
      ],
    },
    state: {
      targetScore: 21,
      currentRoundIndex: 0,
      players: [
        { id: "p1", name: "Alex" },
        { id: "p2", name: "Bianca" },
        { id: "p3", name: "Chris" },
        { id: "p4", name: "Dana" },
      ],
      rounds: [],
      leaderboard: [],
    },
    stateVersion: 1,
    status: "active",
    createdAt: "2026-05-07T12:00:00.000Z",
    updatedAt: "2026-05-07T12:00:00.000Z",
    finishedAt: null,
  };
}

