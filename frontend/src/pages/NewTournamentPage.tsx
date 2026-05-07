import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../components/Button";
import { Message } from "../components/Message";
import { PageShell } from "../components/PageShell";
import { SegmentedControl } from "../components/SegmentedControl";
import { Spinner } from "../components/Spinner";
import { createTournament } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { saveRecentTournament } from "../lib/recentRooms";
import type { RoundCount, TournamentMode } from "../lib/types";

type RoundMode = "fixed" | "auto";

export function NewTournamentPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("Thursday Padel");
  const [mode, setMode] = useState<TournamentMode>("americano");
  const [players, setPlayers] = useState(["", "", "", ""]);
  const [courtCount, setCourtCount] = useState(1);
  const [targetScore, setTargetScore] = useState(21);
  const [roundMode, setRoundMode] = useState<RoundMode>("fixed");
  const [roundValue, setRoundValue] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const playerNames = useMemo(
    () => players.map((player) => player.trim()).filter((player) => player.length > 0),
    [players],
  );
  const canSubmit = name.trim().length > 0 && playerNames.length >= 4 && !isSubmitting;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const roundCount: RoundCount =
      roundMode === "auto" ? { type: "auto" } : { type: "fixed", value: roundValue };

    try {
      const tournament = await createTournament({
        name: name.trim(),
        mode,
        players: playerNames,
        courtCount,
        roundCount,
        targetScore,
      });
      saveRecentTournament(tournament);
      navigate(`/t/${tournament.roomCode}`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePlayer = (index: number, value: string) => {
    setPlayers((current) => current.map((player, playerIndex) => (playerIndex === index ? value : player)));
  };

  const removePlayer = (index: number) => {
    setPlayers((current) => current.filter((_, playerIndex) => playerIndex !== index));
  };

  return (
    <PageShell
      actions={
        <Link
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ink transition hover:bg-court-50"
          title="Back"
          to="/"
        >
          <ArrowLeft size={19} />
        </Link>
      }
    >
      <form className="mx-auto max-w-3xl space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">New tournament</h1>
          <p className="text-sm leading-6 text-slate-600">
            Room access is controlled by the generated room code.
          </p>
        </div>

        {error ? <Message tone="error">{error}</Message> : null}

        <section className="panel space-y-4 p-4 sm:p-5">
          <label className="space-y-2">
            <span className="field-label">Tournament name</span>
            <input
              className="field-input"
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>

          <SegmentedControl
            label="Mode"
            onChange={setMode}
            options={[
              { value: "americano", label: "Americano" },
              { value: "mexicano", label: "Mexicano" },
            ]}
            value={mode}
          />
        </section>

        <section className="panel space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">Players</h2>
            <Button
              icon={<Plus size={16} />}
              onClick={() => setPlayers((current) => [...current, ""])}
              size="sm"
              variant="secondary"
            >
              Add
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {players.map((player, index) => (
              <div className="flex gap-2" key={index}>
                <input
                  className="field-input"
                  maxLength={60}
                  onChange={(event) => updatePlayer(index, event.target.value)}
                  placeholder={`Player ${index + 1}`}
                  value={player}
                />
                <Button
                  aria-label={`Remove player ${index + 1}`}
                  disabled={players.length <= 4}
                  icon={<Trash2 size={16} />}
                  onClick={() => removePlayer(index)}
                  size="icon"
                  variant="ghost"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="panel grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
          <label className="space-y-2">
            <span className="field-label">Courts</span>
            <input
              className="field-input"
              min={1}
              onChange={(event) => setCourtCount(Number(event.target.value))}
              type="number"
              value={courtCount}
            />
          </label>

          <label className="space-y-2">
            <span className="field-label">Target score</span>
            <input
              className="field-input"
              min={1}
              onChange={(event) => setTargetScore(Number(event.target.value))}
              type="number"
              value={targetScore}
            />
          </label>

          <div className="space-y-2">
            <SegmentedControl
              label="Rounds"
              onChange={setRoundMode}
              options={[
                { value: "fixed", label: "Fixed" },
                { value: "auto", label: "Auto" },
              ]}
              value={roundMode}
            />
            {roundMode === "fixed" ? (
              <input
                className="field-input"
                min={1}
                onChange={(event) => setRoundValue(Number(event.target.value))}
                type="number"
                value={roundValue}
              />
            ) : null}
          </div>
        </section>

        <div className="sticky bottom-0 -mx-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
          <Button className="w-full sm:w-auto" disabled={!canSubmit} type="submit">
            {isSubmitting ? <Spinner /> : null}
            Create room
          </Button>
        </div>
      </form>
    </PageShell>
  );
}

