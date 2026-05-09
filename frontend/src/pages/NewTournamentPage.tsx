import { House, Info, Plus, Trash2 } from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { PageShell } from "../components/PageShell";
import { Seo } from "../components/Seo";
import { createTournament } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { saveRecentTournament } from "../lib/recentRooms";
import type { CreateTournamentRequest, RoundCount, TournamentMode } from "../lib/types";

type RoundMode = "fixed" | "infinite";

type NewTournamentLocationState = {
  prefill?: CreateTournamentRequest;
  sourceRoomCode?: string;
};

const DEFAULT_TARGET_SCORE = 24;
const MODE_OPTIONS = [
  {
    id: "americano" as const,
    title: "Americano",
    description: "Rotating partners",
  },
  {
    id: "mexicano" as const,
    title: "Mexicano",
    description: "Performance-based rounds",
  },
];

export function NewTournamentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = prefillFromLocationState(location.state);
  const initialPlayerValues = initialPlayers(prefill?.players);
  const initialCourtCount =
    prefill?.courtCount ?? courtCountForPlayerCount(playerNamesFromPlayers(initialPlayerValues).length);
  const [name, setName] = useState(() => prefill?.name ?? defaultTournamentName());
  const [mode, setMode] = useState<TournamentMode>(prefill?.mode ?? "americano");
  const [players, setPlayers] = useState(() => initialPlayerValues);
  const [courtCountInput, setCourtCountInput] = useState(() => String(initialCourtCount));
  const [hasEditedCourtCount, setHasEditedCourtCount] = useState(Boolean(prefill?.courtCount));
  const [targetScoreInput, setTargetScoreInput] = useState(() =>
    String(prefill?.targetScore ?? DEFAULT_TARGET_SCORE),
  );
  const [roundMode, setRoundMode] = useState<RoundMode>(prefill?.roundCount.type ?? "infinite");
  const [roundValueInput, setRoundValueInput] = useState(() =>
    String(prefill?.roundCount.type === "fixed" ? prefill.roundCount.value : 3),
  );
  const [modeInfo, setModeInfo] = useState<TournamentMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const playerInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const pendingPlayerFocusIndex = useRef<number | null>(null);
  const pendingPlayerFocusRequest = useRef<{
    index: number;
    selectExistingText: boolean;
  } | null>(null);
  const pendingPlayerFocusFallback = useRef<number | null>(null);

  const playerNames = useMemo(() => playerNamesFromPlayers(players), [players]);
  const courtCount = positiveIntegerFromInput(courtCountInput);
  const targetScore = positiveIntegerFromInput(targetScoreInput);
  const roundValue = positiveIntegerFromInput(roundValueInput);
  const americanoCompleteRotationRounds =
    playerNames.length >= 4 ? roundsForCompleteAmericanoRotation(playerNames.length) : null;
  const hasValidNumbers =
    courtCount !== null && targetScore !== null && (roundMode === "infinite" || roundValue !== null);
  const isFormValid = name.trim().length > 0 && playerNames.length >= 4 && hasValidNumbers;
  const canSubmit = isFormValid && !isSubmitting;

  const showValidationError = (message: string) => {
    setError(message);
    setValidationAttempt((current) => current + 1);
    window.requestAnimationFrame(() => {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  useEffect(() => {
    if (hasEditedCourtCount) {
      return;
    }

    setCourtCountInput(String(courtCountForPlayerCount(playerNames.length)));
  }, [hasEditedCourtCount, playerNames.length]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (name.trim().length === 0) {
      showValidationError("Enter a tournament name.");
      return;
    }

    if (playerNames.length < 4) {
      showValidationError("Add at least 4 players.");
      return;
    }

    if (courtCount === null || targetScore === null) {
      showValidationError("Enter valid numbers for courts and target score.");
      return;
    }

    let roundCount: RoundCount;

    if (roundMode === "infinite") {
      roundCount = { type: "infinite" };
    } else {
      if (roundValue === null) {
        showValidationError("Enter a valid number of rounds.");
        return;
      }

      roundCount = { type: "fixed", value: roundValue };
    }

    setIsSubmitting(true);

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

  const focusPlayerInput = (index: number, selectExistingText = false) => {
    const input = playerInputRefs.current[index];

    if (!input) {
      return false;
    }

    input.focus();

    if (selectExistingText && input.value.length > 0) {
      input.select();
    } else {
      input.setSelectionRange(input.value.length, input.value.length);
    }

    return true;
  };

  const focusPendingPlayerInput = () => {
    const request = pendingPlayerFocusRequest.current;

    if (!request || !focusPlayerInput(request.index, request.selectExistingText)) {
      return;
    }

    pendingPlayerFocusRequest.current = null;

    if (pendingPlayerFocusFallback.current !== null) {
      window.clearTimeout(pendingPlayerFocusFallback.current);
      pendingPlayerFocusFallback.current = null;
    }
  };

  const queuePlayerFocus = (index: number, selectExistingText = false) => {
    pendingPlayerFocusRequest.current = { index, selectExistingText };

    if (pendingPlayerFocusFallback.current !== null) {
      window.clearTimeout(pendingPlayerFocusFallback.current);
    }

    pendingPlayerFocusFallback.current = window.setTimeout(focusPendingPlayerInput, 80);
  };

  const onPlayerKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (playerInputRefs.current[index + 1]) {
      queuePlayerFocus(index + 1, true);
      return;
    }

    addPlayer();
  };

  const onPlayerKeyUp = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    focusPendingPlayerInput();
  };

  useEffect(() => {
    playerInputRefs.current.length = players.length;

    const index = pendingPlayerFocusIndex.current;

    if (index === null) {
      return;
    }

    pendingPlayerFocusIndex.current = null;
    queuePlayerFocus(index);
  }, [players.length]);

  useEffect(
    () => () => {
      if (pendingPlayerFocusFallback.current !== null) {
        window.clearTimeout(pendingPlayerFocusFallback.current);
      }
    },
    [],
  );

  return (
    <PageShell
      actions={
        <Button asChild className="size-11" size="icon" variant="outline">
          <Link aria-label="Home" title="Home" to="/">
            <House className="size-5" />
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
          <Alert
            className="animate-validation-attention scroll-mt-24"
            key={`${error}-${validationAttempt}`}
            ref={errorRef}
            variant="destructive"
          >
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
              <RadioGroup
                className="grid gap-2 sm:grid-cols-2"
                onValueChange={(value) => setMode(value as TournamentMode)}
                value={mode}
              >
                {MODE_OPTIONS.map((option) => {
                  const active = mode === option.id;
                  const inputId = `mode-${option.id}`;

                  return (
                    <div className="relative" key={option.id}>
                      <Label
                        className={cn(
                          "flex min-h-16 cursor-pointer items-start gap-3 rounded-lg border bg-card px-3 pt-3 pr-14 pb-2.5 transition-colors",
                          "hover:bg-secondary/50 focus-within:ring-3 focus-within:ring-ring/50",
                          active && "border-primary bg-accent text-accent-foreground",
                        )}
                        htmlFor={inputId}
                      >
                        <RadioGroupItem className="mt-1" id={inputId} value={option.id} />
                        <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                          <span className="font-display text-base font-semibold leading-none">
                            {option.title}
                          </span>
                          <span className="text-sm text-muted-foreground">{option.description}</span>
                        </span>
                      </Label>
                      <Button
                        aria-label={`${option.title} rules`}
                        className="absolute top-2 right-2 size-9 shrink-0 rounded-md"
                        onClick={(event) => {
                          event.stopPropagation();
                          setModeInfo(option.id);
                        }}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Info className="size-4" />
                      </Button>
                    </div>
                  );
                })}
              </RadioGroup>
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
                    autoCapitalize="words"
                    className="h-11"
                    enterKeyHint="next"
                    maxLength={60}
                    onChange={(event) => updatePlayer(index, event.target.value)}
                    onKeyDown={(event) => onPlayerKeyDown(event, index)}
                    onKeyUp={onPlayerKeyUp}
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
                inputMode="numeric"
                min={1}
                onChange={(event) => {
                  setHasEditedCourtCount(true);
                  setCourtCountInput(event.target.value);
                }}
                pattern="[0-9]*"
                type="number"
                value={courtCountInput}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-score">Target score</Label>
              <Input
                className="h-11"
                id="target-score"
                inputMode="numeric"
                min={1}
                onChange={(event) => setTargetScoreInput(event.target.value)}
                pattern="[0-9]*"
                type="number"
                value={targetScoreInput}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="round-count">Rounds</Label>
              <ButtonGroup className="h-11 w-full">
                <Input
                  className="h-11 text-base"
                  id="round-count"
                  inputMode={roundMode === "fixed" ? "numeric" : undefined}
                  min={roundMode === "fixed" ? 1 : undefined}
                  onChange={(event) => {
                    if (roundMode === "fixed") {
                      setRoundValueInput(event.target.value);
                    }
                  }}
                  pattern={roundMode === "fixed" ? "[0-9]*" : undefined}
                  readOnly={roundMode === "infinite"}
                  type={roundMode === "infinite" ? "text" : "number"}
                  value={roundMode === "infinite" ? "∞" : roundValueInput}
                />
                <Button
                  aria-label="Infinite rounds"
                  aria-pressed={roundMode === "infinite"}
                  className={cn(
                    "h-11 min-w-14 px-4 font-display text-2xl leading-none font-semibold",
                    roundMode === "infinite" &&
                      "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                  onClick={() => setRoundMode((current) => (current === "infinite" ? "fixed" : "infinite"))}
                  type="button"
                  variant="outline"
                >
                  ∞
                </Button>
              </ButtonGroup>
              {roundMode === "infinite" ? (
                <p className="text-sm text-muted-foreground">
                  You can finish the tournament after any number of rounds.
                </p>
              ) : mode === "americano" && americanoCompleteRotationRounds !== null ? (
                <p className="text-sm text-muted-foreground">
                  Minimum {americanoCompleteRotationRounds} rounds needed for everyone to play with everyone.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
          <Button
            aria-disabled={!isFormValid || isSubmitting}
            className={cn("h-11 w-full sm:w-auto", !canSubmit && "opacity-55")}
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? <Spinner /> : null}
            Create room
          </Button>
        </div>
      </form>
      <Dialog onOpenChange={(open) => !open && setModeInfo(null)} open={modeInfo !== null}>
        {modeInfo ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{modeInfo === "americano" ? "Americano rules" : "Mexicano rules"}</DialogTitle>
              <DialogDescription>
                {modeInfo === "americano"
                  ? "Balanced rounds with rotating partners."
                  : "Performance-based rounds that regroup players as scores come in."}
              </DialogDescription>
            </DialogHeader>
            <ModeRules mode={modeInfo} />
          </DialogContent>
        ) : null}
      </Dialog>
    </PageShell>
  );
}

function ModeRules({ mode }: { mode: TournamentMode }) {
  if (mode === "americano") {
    return (
      <div className="space-y-3 text-sm leading-6 text-foreground">
        <p>Americano creates a rotating schedule where players change partners across rounds.</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Rounds are generated up front from the player list.</li>
          <li>Players collect the points their side scores in each match.</li>
          <li>The standings rank players by total points first, then wins, ties, and point difference.</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm leading-6 text-foreground">
      <p>Mexicano creates each next round from the current standings.</p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        <li>After a round is complete, players are ordered by performance.</li>
        <li>Each court uses a group of four ranked players.</li>
        <li>Within that group, player #1 partners with #4, and #2 partners with #3.</li>
        <li>The next round is generated only after the current round has scores.</li>
      </ul>
    </div>
  );
}

function initialPlayers(players: string[] | undefined) {
  const source = players && players.length > 0 ? players : [];

  return [...source, ...Array.from({ length: Math.max(0, 4 - source.length) }, () => "")];
}

function playerNamesFromPlayers(players: string[]) {
  return players.map((player) => player.trim()).filter((player) => player.length > 0);
}

function courtCountForPlayerCount(playerCount: number) {
  return Math.max(1, Math.floor(playerCount / 4));
}

function roundsForCompleteAmericanoRotation(playerCount: number) {
  return playerCount % 2 === 0 ? playerCount - 1 : playerCount;
}

function positiveIntegerFromInput(value: string) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  return parsed >= 1 ? parsed : null;
}

function defaultTournamentName(now = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(now);
  const date = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long" }).format(now);
  const dayPart = dayPartForHour(now.getHours());

  return `${weekday} ${dayPart} Padel - ${date}`;
}

function dayPartForHour(hour: number) {
  if (hour < 6) {
    return "Late Night";
  }

  if (hour < 12) {
    return "Morning";
  }

  if (hour < 17) {
    return "Afternoon";
  }

  if (hour < 21) {
    return "Evening";
  }

  return "Night";
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

  if (value.type === "infinite") {
    return true;
  }

  return value.type === "fixed" && typeof value.value === "number";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
