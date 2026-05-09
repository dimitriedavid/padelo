import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScoreEntryDrawer } from "./ScoreEntryDrawer";
import type { ScoreboardMatch } from "./scoreboard-types";

describe("ScoreEntryDrawer", () => {
  it("marks and edits the selected score side instead of the winning side", async () => {
    const onSubmit = vi.fn();

    render(
      <ScoreEntryDrawer
        error={null}
        expectedStateVersion={3}
        match={match()}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        open
        roundIndex={0}
        targetScore={24}
      />,
    );

    for (const score of ["9", "10", "11", "12", "13", "14", "15"]) {
      expect(screen.getByRole("button", { name: score })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: /Side B/i }));
    expect(screen.getByText("Side B score")).toBeInTheDocument();

    const scoreInput = screen.getByLabelText("Side B score value");
    expect(scoreInput).toHaveValue("11");

    fireEvent.change(scoreInput, { target: { value: "" } });
    expect(scoreInput).toHaveValue("");

    fireEvent.change(scoreInput, { target: { value: "14" } });
    expect(scoreInput).toHaveValue("14");
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        matchId: "match-1",
        sideAScore: 10,
        sideBScore: 14,
        expectedStateVersion: 3,
      }),
    );
  });
});

function match(): ScoreboardMatch {
  return {
    id: "match-1",
    courtNumber: 1,
    sideA: [
      { id: "alex", initials: "AL", name: "Alex" },
      { id: "bianca", initials: "BI", name: "Bianca" },
    ],
    sideB: [
      { id: "chris", initials: "CH", name: "Chris" },
      { id: "dana", initials: "DA", name: "Dana" },
    ],
  };
}
