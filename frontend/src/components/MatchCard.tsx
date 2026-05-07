import { Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { deleteMatchResult, upsertMatchResult } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { playerName } from "../lib/tournament";
import type { MatchSide, Tournament, TournamentMatch } from "../lib/types";
import { Button } from "./Button";
import { Message } from "./Message";
import { SegmentedControl } from "./SegmentedControl";
import { Spinner } from "./Spinner";

type MatchCardProps = {
  tournament: Tournament;
  match: TournamentMatch;
  disabled?: boolean;
  onTournamentChange: (tournament: Tournament) => void;
};

export function MatchCard({ tournament, match, disabled = false, onTournamentChange }: MatchCardProps) {
  const initialWinningSide = match.result?.winningSide ?? "A";
  const initialLosingScore = useMemo(() => {
    if (!match.result) {
      return Math.max(0, tournament.state.targetScore - 1);
    }

    return match.result.winningSide === "A" ? match.result.sideBScore : match.result.sideAScore;
  }, [match.result, tournament.state.targetScore]);
  const [winningSide, setWinningSide] = useState<MatchSide>(initialWinningSide);
  const [losingScore, setLosingScore] = useState(initialLosingScore);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setWinningSide(match.result?.winningSide ?? "A");
    setLosingScore(initialLosingScore);
  }, [initialLosingScore, match.result?.winningSide]);

  const sideAPlayers = match.sideA.map((playerId) => playerName(tournament, playerId)).join(" / ");
  const sideBPlayers = match.sideB.map((playerId) => playerName(tournament, playerId)).join(" / ");

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const next = await upsertMatchResult(tournament.roomCode, match.id, {
        winningSide,
        losingScore,
        expectedStateVersion: tournament.stateVersion,
      });
      onTournamentChange(next);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const clear = async () => {
    setError(null);
    setIsDeleting(true);

    try {
      const next = await deleteMatchResult(tournament.roomCode, match.id, {
        expectedStateVersion: tournament.stateVersion,
      });
      onTournamentChange(next);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <article className="panel p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">Court {match.courtNumber}</div>
          <div className="mt-1 text-xs text-slate-500">Match {match.id.toUpperCase()}</div>
        </div>
        {match.result ? (
          <div className="rounded bg-court-50 px-2 py-1 text-sm font-semibold text-court-700">
            {match.result.sideAScore}-{match.result.sideBScore}
          </div>
        ) : (
          <div className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">Open</div>
        )}
      </div>

      <form className="space-y-4" onSubmit={save}>
        <div className="grid gap-2">
          <div className="rounded-md border border-line bg-white p-3">
            <div className="text-xs font-medium uppercase text-slate-500">Side A</div>
            <div className="mt-1 text-sm font-medium text-ink">{sideAPlayers}</div>
          </div>
          <div className="rounded-md border border-line bg-white p-3">
            <div className="text-xs font-medium uppercase text-slate-500">Side B</div>
            <div className="mt-1 text-sm font-medium text-ink">{sideBPlayers}</div>
          </div>
        </div>

        <SegmentedControl
          label="Winner"
          onChange={setWinningSide}
          options={[
            { value: "A", label: "Side A" },
            { value: "B", label: "Side B" },
          ]}
          value={winningSide}
        />

        <label className="space-y-2">
          <span className="field-label">Losing score</span>
          <input
            className="field-input"
            disabled={disabled}
            max={tournament.state.targetScore - 1}
            min={0}
            onChange={(event) => setLosingScore(Number(event.target.value))}
            type="number"
            value={losingScore}
          />
        </label>

        {error ? <Message tone="error">{error}</Message> : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="w-full" disabled={disabled || isSaving || isDeleting} icon={<Save size={16} />} type="submit">
            {isSaving ? <Spinner /> : null}
            {match.result ? "Update" : "Save"}
          </Button>
          {match.result ? (
            <Button
              className="w-full sm:w-auto"
              disabled={disabled || isSaving || isDeleting}
              icon={<Trash2 size={16} />}
              onClick={clear}
              variant="secondary"
            >
              {isDeleting ? <Spinner /> : null}
              Clear
            </Button>
          ) : null}
        </div>
      </form>
    </article>
  );
}

