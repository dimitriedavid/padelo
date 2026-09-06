import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewTournamentPage } from "./NewTournamentPage";
import { localDateString } from "../lib/tournament";
import type { CreateTournamentRequest, Tournament } from "../lib/types";

describe("NewTournamentPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
  });

  it("submits a create tournament request and navigates to the room", async () => {
    const user = userEvent.setup();
    const expectedDate = localDateString();
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
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

    expect(requestBody).toMatchObject({
      date: expectedDate,
    });
    expect(requestBody.name).toMatch(/Padel$/);
    expect(requestBody.name).not.toContain(" - ");
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

  it("explains why the room cannot be created when the form is incomplete", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(
      <MemoryRouter initialEntries={["/new"]}>
        <Routes>
          <Route element={<NewTournamentPage />} path="/new" />
        </Routes>
      </MemoryRouter>,
    );

    const createButton = screen.getByRole("button", { name: /create room/i });

    expect(createButton).toHaveAttribute("aria-disabled", "true");

    await user.click(createButton);

    expect(screen.getByText("Add at least 4 players.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("defaults target score to 24 and derives courts from player count", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/new"]}>
        <Routes>
          <Route element={<NewTournamentPage />} path="/new" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Target score")).toHaveValue(24);
    expect(screen.getByLabelText("Courts")).toHaveValue(1);

    for (let index = 0; index < 4; index += 1) {
      await user.click(screen.getByRole("button", { name: "Add" }));
    }

    const names = ["Alex", "Bianca", "Chris", "Dana", "Eli", "Fatima", "Gabi", "Hana"];

    for (const [index, name] of names.entries()) {
      await user.type(screen.getByPlaceholderText(`Player ${index + 1}`), name);
    }

    expect(screen.getByLabelText("Courts")).toHaveValue(2);
  });

  it("defaults the tournament name from the current day and time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 9, 9));

    render(
      <MemoryRouter initialEntries={["/new"]}>
        <Routes>
          <Route element={<NewTournamentPage />} path="/new" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Tournament name")).toHaveValue("Saturday Morning Padel");
  });

  it("uses more specific day parts for the default tournament name", () => {
    vi.useFakeTimers();

    const cases = [
      { hour: 2, expected: "Saturday Late Night Padel" },
      { hour: 13, expected: "Saturday Afternoon Padel" },
      { hour: 18, expected: "Saturday Evening Padel" },
      { hour: 22, expected: "Saturday Night Padel" },
    ];

    for (const { hour, expected } of cases) {
      vi.setSystemTime(new Date(2026, 4, 9, hour));

      const { unmount } = render(
        <MemoryRouter initialEntries={["/new"]}>
          <Routes>
            <Route element={<NewTournamentPage />} path="/new" />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByLabelText("Tournament name")).toHaveValue(expected);
      unmount();
    }
  });

  it("lets numeric fields be cleared before entering a new value", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/new"]}>
        <Routes>
          <Route element={<NewTournamentPage />} path="/new" />
        </Routes>
      </MemoryRouter>,
    );

    const courts = screen.getByLabelText("Courts");
    const targetScore = screen.getByLabelText("Target score");
    await user.click(screen.getByRole("button", { name: "Infinite rounds" }));
    const fixedRounds = screen.getByLabelText("Rounds");

    await user.clear(courts);
    expect(courts).toHaveValue(null);
    await user.type(courts, "2");
    expect(courts).toHaveValue(2);

    await user.clear(targetScore);
    expect(targetScore).toHaveValue(null);
    await user.type(targetScore, "24");
    expect(targetScore).toHaveValue(24);

    await user.clear(fixedRounds);
    expect(fixedRounds).toHaveValue(null);
    await user.type(fixedRounds, "5");
    expect(fixedRounds).toHaveValue(5);
  });

  it("uses numeric mobile keypad hints for numeric tournament settings", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/new"]}>
        <Routes>
          <Route element={<NewTournamentPage />} path="/new" />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Infinite rounds" }));

    for (const label of ["Courts", "Target score", "Rounds"]) {
      const input = screen.getByLabelText(label);

      expect(input).toHaveAttribute("inputmode", "numeric");
      expect(input).toHaveAttribute("pattern", "[0-9]*");
    }
  });

  it("blocks court counts above complete groups of four players", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(
      <MemoryRouter initialEntries={["/new"]}>
        <Routes>
          <Route element={<NewTournamentPage />} path="/new" />
        </Routes>
      </MemoryRouter>,
    );

    const names = ["Alex", "Bianca", "Chris", "Dana"];

    for (const [index, name] of names.entries()) {
      await user.type(screen.getByPlaceholderText(`Player ${index + 1}`), name);
    }

    const courts = screen.getByLabelText("Courts");
    await user.clear(courts);
    await user.type(courts, "2");
    await user.click(screen.getByRole("button", { name: /create room/i }));

    expect(screen.getByText("With 4 players, at most 1 court is available.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows Americano round guidance for a complete player rotation", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/new"]}>
        <Routes>
          <Route element={<NewTournamentPage />} path="/new" />
        </Routes>
      </MemoryRouter>,
    );

    const names = ["Alex", "Bianca", "Chris", "Dana"];

    for (const [index, name] of names.entries()) {
      await user.type(screen.getByPlaceholderText(`Player ${index + 1}`), name);
    }

    await user.click(screen.getByRole("button", { name: "Infinite rounds" }));

    expect(screen.getByText("Minimum 3 rounds needed for everyone to play with everyone.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.type(screen.getByPlaceholderText("Player 5"), "Eli");

    expect(screen.getByText("Minimum 5 rounds needed for everyone to play with everyone.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Infinite rounds" }));

    expect(screen.queryByText(/rounds needed for everyone to play with everyone/i)).not.toBeInTheDocument();
    expect(screen.getByText("You can finish the tournament after any number of rounds.")).toBeInTheDocument();
  });

  it("can switch between tournament modes", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/new"]}>
        <Routes>
          <Route element={<NewTournamentPage />} path="/new" />
        </Routes>
      </MemoryRouter>,
    );

    const americano = screen.getByRole("radio", { name: /Americano/ });
    const mexicano = screen.getByRole("radio", { name: /Mexicano/ });

    expect(americano).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByText("Mexicano"));
    expect(mexicano).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByText("Americano"));
    expect(americano).toHaveAttribute("aria-checked", "true");
  });

  it("defaults round count to infinite and toggles back to fixed rounds", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/new"]}>
        <Routes>
          <Route element={<NewTournamentPage />} path="/new" />
        </Routes>
      </MemoryRouter>,
    );

    const rounds = screen.getByLabelText("Rounds");
    const infiniteButton = screen.getByRole("button", { name: "Infinite rounds" });

    expect(rounds).toHaveValue("∞");
    expect(infiniteButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("You can finish the tournament after any number of rounds.")).toBeInTheDocument();

    await user.click(infiniteButton);
    expect(rounds).toHaveValue(3);
    expect(infiniteButton).toHaveAttribute("aria-pressed", "false");
  });

  it.each(["americano", "mexicano"] as const)("creates fixed-pair %s with explicit teams", async (mode) => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tournament: tournament() }), { status: 201 }),
    );
    render(<MemoryRouter><NewTournamentPage /></MemoryRouter>);
    await user.click(screen.getByRole("radio", { name: /Fixed pairs/ }));
    await user.click(screen.getByRole("radio", { name: mode === "americano" ? /Americano/ : /Mexicano/ }));
    for (const [index, name] of [" Alex ", "Bianca", "Chris", "Dana"].entries()) {
      await user.type(screen.getByLabelText(`Pair ${Math.floor(index / 2) + 1}, player ${index % 2 + 1}`), name);
    }
    await user.click(screen.getByRole("button", { name: /create room/i }));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      mode, format: "fixed-pairs", players: ["Alex", "Bianca", "Chris", "Dana"], teams: [[0, 1], [2, 3]],
    });
  });

  it("rejects incomplete pairs instead of shifting player indices", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<MemoryRouter><NewTournamentPage /></MemoryRouter>);
    await user.click(screen.getByRole("radio", { name: /Fixed pairs/ }));
    await user.click(screen.getByRole("button", { name: "Add pair" }));
    for (const [pair, slot, name] of [[1, 1, "Alex"], [2, 1, "Chris"], [2, 2, "Dana"], [3, 1, "Eli"], [3, 2, "Fatima"]] as const) {
      await user.type(screen.getByLabelText(`Pair ${pair}, player ${slot}`), name);
    }
    await user.type(screen.getByLabelText("Pair 1, player 2"), "   ");
    await user.click(screen.getByRole("button", { name: /create room/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter both player names in every pair");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("adds and removes whole pairs and supports Enter navigation", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><NewTournamentPage /></MemoryRouter>);
    await user.click(screen.getByRole("radio", { name: /Fixed pairs/ }));
    expect(screen.getByRole("button", { name: "Remove pair 1" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Add pair" }));
    await user.type(screen.getByLabelText("Pair 3, player 1"), "Eli{Enter}");
    expect(screen.getByLabelText("Pair 3, player 2")).toHaveFocus();
    await user.keyboard("Fatima{Enter}");
    expect(screen.getByLabelText("Pair 4, player 1")).toHaveFocus();
    expect(screen.getByLabelText("Pair 4, player 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove pair 2" }));
    expect(screen.getByLabelText("Pair 2, player 1")).toHaveValue("Eli");
    expect(screen.getByLabelText("Pair 2, player 2")).toHaveValue("Fatima");
    expect(screen.queryByLabelText("Pair 4, player 1")).not.toBeInTheDocument();
  });

  it("restores nonadjacent prefilled team membership and uses fixed-team guidance", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tournament: tournament() }), { status: 201 }),
    );
    const prefill: Omit<CreateTournamentRequest, "date"> = {
      name: "Pairs night", mode: "americano", format: "fixed-pairs",
      players: ["Alex", "Bianca", "Chris", "Dana", "Eli", "Fatima", "Gabi", "Hana"],
      teams: [[0, 3], [2, 1], [4, 7], [6, 5]], courtCount: 1,
      roundCount: { type: "fixed", value: 3 }, targetScore: 24,
    };
    render(<MemoryRouter initialEntries={[{ pathname: "/new", state: { prefill } }]}><NewTournamentPage /></MemoryRouter>);
    expect(screen.getByLabelText("Pair 1, player 2")).toHaveValue("Dana");
    expect(screen.getByLabelText("Pair 2, player 2")).toHaveValue("Bianca");
    expect(screen.queryByText(/rounds needed for everyone/)).not.toBeInTheDocument();
    expect(screen.getByText(/With limited courts, some pairs sit out/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Americano rules" }));
    expect(screen.getByText("Partners stay together and collect points as a team.")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /create room/i }));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      format: "fixed-pairs", players: ["Alex", "Dana", "Chris", "Bianca", "Eli", "Hana", "Gabi", "Fatima"],
      teams: [[0, 1], [2, 3], [4, 5], [6, 7]],
    });
  });

  it("pads an odd rotating roster with an empty partner when switching format", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><NewTournamentPage /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.type(screen.getByPlaceholderText("Player 5"), "Eli");
    await user.click(screen.getByRole("radio", { name: /Fixed pairs/ }));
    expect(screen.getByLabelText("Pair 3, player 1")).toHaveValue("Eli");
    expect(screen.getByLabelText("Pair 3, player 2")).toHaveValue("");
  });

  it("prefills copied tournament settings while clamping impossible courts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 9, 18));

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/new",
            state: {
              prefill: {
                mode: "mexicano",
                players: ["Alex", "Bianca", "Chris", "Dana", "Eli"],
                courtCount: 2,
                roundCount: { type: "infinite" },
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

    expect(screen.getByLabelText("Tournament name")).toHaveValue("Saturday Evening Padel");
    expect(screen.getByPlaceholderText("Player 1")).toHaveValue("Alex");
    expect(screen.getByPlaceholderText("Player 5")).toHaveValue("Eli");
    expect(screen.getByLabelText("Courts")).toHaveValue(1);
    expect(screen.getByLabelText("Target score")).toHaveValue(15);
    expect(screen.getByRole("radio", { name: /Mexicano/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Rounds")).toHaveValue("∞");
    expect(screen.getByRole("button", { name: "Infinite rounds" })).toHaveAttribute("aria-pressed", "true");
  });
});

function tournament(): Tournament {
  return {
    id: "id",
    roomCode: "ROOM42",
    name: "Thursday Padel",
    config: {
      name: "Thursday Padel",
      date: "2026-05-09",
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
