import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageShell } from "../components/PageShell";
import { Seo } from "../components/Seo";
import { createTournament } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { saveRecentTournament } from "../lib/recentRooms";
import type { CreateTournamentRequest, RoundCount, TournamentMode } from "../lib/types";

type RoundMode = "fixed" | "auto";

type NewTournamentLocationState = {
  prefill?: CreateTournamentRequest;
  sourceRoomCode?: string;
};

export function NewTournamentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = prefillFromLocationState(location.state);
  const [name, setName] = useState(prefill?.name ?? "Thursday Padel");
  const [mode, setMode] = useState<TournamentMode>(prefill?.mode ?? "americano");
  const [players, setPlayers] = useState(() => initialPlayers(prefill?.players));
  const [courtCount, setCourtCount] = useState(prefill?.courtCount ?? 1);
  const [targetScore, setTargetScore] = useState(prefill?.targetScore ?? 21);
  const [roundMode, setRoundMode] = useState<RoundMode>(prefill?.roundCount.type ?? "fixed");
  const [roundValue, setRoundValue] = useState(
    prefill?.roundCount.type === "fixed" ? prefill.roundCount.value : 3,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const playerInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const pendingPlayerFocusIndex = useRef<number | null>(null);

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

  const addPlayer = () => {
    setPlayers((current) => {
      pendingPlayerFocusIndex.current = current.length;
      return [...current, ""];
    });
  };

  const removePlayer = (index: number) => {
    setPlayers((current) => current.filter((_, playerIndex) => playerIndex !== index));
  };

  const onPlayerKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    const nextInput = playerInputRefs.current[index + 1];

    if (nextInput) {
      nextInput.focus();
      nextInput.select();
      return;
    }

    addPlayer();
  };

  useEffect(() => {
    playerInputRefs.current.length = players.length;

    const index = pendingPlayerFocusIndex.current;

    if (index === null) {
      return;
    }

    pendingPlayerFocusIndex.current = null;
    playerInputRefs.current[index]?.focus();
  }, [players.length]);

  return (
    <PageShell
      actions={
        <Button asChild size="icon" variant="ghost">
          <Link title="Back" to="/">
            <ArrowLeft size={19} />
          </Link>
        </Button>
      }
    >
      <Seo
        description="Set up an Americano or Mexicano padel tournament with player names, courts, rounds, target score, and a shareable room code."
        path="/new"
        title="Create a Padel Tournament | Padelo"
      />
      <form className="mx-auto max-w-3xl space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">New tournament</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Room access is controlled by the generated room code.
          </p>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tournament-name">Tournament name</Label>
              <Input
                className="h-11"
                id="tournament-name"
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </div>

            <div className="space-y-2">
              <Label>Mode</Label>
              <Tabs onValueChange={(value) => setMode(value as TournamentMode)} value={mode}>
                <TabsList className="grid h-11 w-full grid-cols-2">
                  <TabsTrigger value="americano">Americano</TabsTrigger>
                  <TabsTrigger value="mexicano">Mexicano</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">Players</h2>
              <Button
                onClick={addPlayer}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Plus size={16} />
                Add
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {players.map((player, index) => (
                <div className="flex gap-2" key={index}>
                  <Input
                    className="h-11"
                    maxLength={60}
                    onChange={(event) => updatePlayer(index, event.target.value)}
                    onKeyDown={(event) => onPlayerKeyDown(event, index)}
                    placeholder={`Player ${index + 1}`}
                    ref={(element) => {
                      playerInputRefs.current[index] = element;
                    }}
                    value={player}
                  />
                  <Button
                    aria-label={`Remove player ${index + 1}`}
                    disabled={players.length <= 4}
                    onClick={() => removePlayer(index)}
                    size="icon-lg"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="court-count">Courts</Label>
              <Input
                className="h-11"
                id="court-count"
                min={1}
                onChange={(event) => setCourtCount(Number(event.target.value))}
                type="number"
                value={courtCount}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-score">Target score</Label>
              <Input
                className="h-11"
                id="target-score"
                min={1}
                onChange={(event) => setTargetScore(Number(event.target.value))}
                type="number"
                value={targetScore}
              />
            </div>

            <div className="space-y-2">
              <Label>Rounds</Label>
              <Tabs onValueChange={(value) => setRoundMode(value as RoundMode)} value={roundMode}>
                <TabsList className="grid h-11 w-full grid-cols-2">
                  <TabsTrigger value="fixed">Fixed</TabsTrigger>
                  <TabsTrigger value="auto">Auto</TabsTrigger>
                </TabsList>
              </Tabs>
              {roundMode === "fixed" ? (
                <Input
                  className="h-11"
                  min={1}
                  onChange={(event) => setRoundValue(Number(event.target.value))}
                  type="number"
                  value={roundValue}
                />
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
          <Button className="h-11 w-full sm:w-auto" disabled={!canSubmit} type="submit">
            {isSubmitting ? <Spinner /> : null}
            Create room
          </Button>
        </div>
      </form>
    </PageShell>
  );
}

function initialPlayers(players: string[] | undefined) {
  const source = players && players.length > 0 ? players : [];

  return [...source, ...Array.from({ length: Math.max(0, 4 - source.length) }, () => "")];
}

function prefillFromLocationState(state: unknown): CreateTournamentRequest | null {
  if (!isObject(state)) {
    return null;
  }

  const locationState = state as NewTournamentLocationState;

  if (!isCreateTournamentRequest(locationState.prefill)) {
    return null;
  }

  return locationState.prefill;
}

function isCreateTournamentRequest(value: unknown): value is CreateTournamentRequest {
  if (!isObject(value)) {
    return false;
  }

  const candidate = value as Partial<CreateTournamentRequest>;

  return (
    typeof candidate.name === "string" &&
    (candidate.mode === "americano" || candidate.mode === "mexicano") &&
    Array.isArray(candidate.players) &&
    candidate.players.every((player) => typeof player === "string") &&
    typeof candidate.courtCount === "number" &&
    typeof candidate.targetScore === "number" &&
    isRoundCount(candidate.roundCount)
  );
}

function isRoundCount(value: unknown): value is RoundCount {
  if (!isObject(value)) {
    return false;
  }

  if (value.type === "auto") {
    return true;
  }

  return value.type === "fixed" && typeof value.value === "number";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
