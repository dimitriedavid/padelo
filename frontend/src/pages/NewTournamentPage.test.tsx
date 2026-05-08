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

  it("moves through player inputs with enter and adds a new player from the last input", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/new"]}>
        <Routes>
          <Route element={<NewTournamentPage />} path="/new" />
        </Routes>
      </MemoryRouter>,
    );

    const playerOne = screen.getByPlaceholderText("Player 1");

    await user.click(playerOne);
    await user.keyboard("{Enter}");
    expect(screen.getByPlaceholderText("Player 2")).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByPlaceholderText("Player 3")).toHaveFocus();

    await user.click(screen.getByPlaceholderText("Player 4"));
    await user.keyboard("{Enter}");
    expect(await screen.findByPlaceholderText("Player 5")).toHaveFocus();
  });

  it("prefills the form from play-again navigation state", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/new",
            state: {
              prefill: {
                name: "Friday Rematch",
                mode: "mexicano",
                players: ["Alex", "Bianca", "Chris", "Dana", "Eli"],
                courtCount: 2,
                roundCount: { type: "auto" },
                targetScore: 15,
              },
            },
          },
        ]}
      >
        <Routes>
          <Route element={<NewTournamentPage />} path="/new" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByDisplayValue("Friday Rematch")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Player 1")).toHaveValue("Alex");
    expect(screen.getByPlaceholderText("Player 5")).toHaveValue("Eli");
    expect(screen.getByLabelText("Courts")).toHaveValue(2);
    expect(screen.getByLabelText("Target score")).toHaveValue(15);
    expect(screen.getByRole("tab", { name: "Mexicano" })).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("tab", { name: "Auto" })).toHaveAttribute("data-state", "active");
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
