// Padelo score entry drawer. Scores are fixed-total: sideAScore + sideBScore
// must equal the tournament target score.

import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { AvatarStack } from "./PadeloBrand";
import type { ResultSubmission, ScoreboardMatch } from "./scoreboard-types";

type ScoreEntryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: ScoreboardMatch | null;
  targetScore: number;
  roundIndex: number;
  expectedStateVersion: number;
  error?: string | null;
  onSubmit: (payload: ResultSubmission) => Promise<void> | void;
};

export function ScoreEntryDrawer({
  open,
  onOpenChange,
  match,
  targetScore,
  roundIndex,
  expectedStateVersion,
  error,
  onSubmit,
}: ScoreEntryDrawerProps) {
  const [sideAScore, setSideAScore] = useState(defaultSideAScore(targetScore));
  const [scoreSide, setScoreSide] = useState<"A" | "B">("A");
  const [scoreInputValue, setScoreInputValue] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!match) {
      return;
    }

    setScoreSide("A");
    setScoreInputValue(null);

    if (match.result) {
      setSideAScore(match.result.sideAScore);
      return;
    }

    setSideAScore(defaultSideAScore(targetScore));
  }, [match, targetScore]);

  if (!match) {
    return null;
  }

  const sideBScore = targetScore - sideAScore;
  const selectedScore = scoreSide === "A" ? sideAScore : sideBScore;
  const displayedScore = scoreInputValue ?? String(selectedScore);
  const quickPicks = quickPickScores(targetScore);
  const sides = [
    { id: "A" as const, players: match.sideA, score: sideAScore },
    { id: "B" as const, players: match.sideB, score: sideBScore },
  ];
  const summary = `${sideAScore}-${sideBScore}`;

  const setScoreForSide = (side: "A" | "B", score: number) => {
    const safeScore = clampScore(score, targetScore);
    setSideAScore(side === "A" ? safeScore : targetScore - safeScore);
  };

  const selectScoreSide = (side: "A" | "B") => {
    setScoreInputValue(null);
    setScoreSide(side);
  };

  const incrementSelectedScore = (step: number) => {
    const nextScore = Math.min(targetScore, Math.max(0, selectedScore + step));
    setScoreInputValue(null);
    setScoreForSide(scoreSide, nextScore);
  };

  const handleScoreInputChange = (value: string) => {
    if (!/^\d*$/.test(value)) {
      return;
    }

    if (value.length === 0) {
      setScoreInputValue("");
      setScoreForSide(scoreSide, 0);
      return;
    }

    const parsed = Number(value);
    const safeScore = clampScore(parsed, targetScore);
    setScoreInputValue(String(safeScore));
    setScoreForSide(scoreSide, safeScore);
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    try {
      await onSubmit({
        matchId: match.id,
        sideAScore,
        sideBScore,
        expectedStateVersion,
      });
      onOpenChange(false);
    } catch {
      // Parent owns the displayed error and may refresh stale tournament state.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerContent className="max-h-[92dvh] border-0 p-0 sm:max-w-md">
        <div className="flex flex-col gap-4 px-5 pt-1 pb-5">
          <DrawerHeader className="space-y-1 p-0 text-left">
            <p className="text-[11px] tracking-widest text-muted-foreground uppercase">
              Court {match.courtNumber} · Round {roundIndex + 1}
            </p>
            <DrawerTitle className="font-display text-2xl font-semibold -tracking-[0.025em]">
              Enter score
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              Target {targetScore} total. Choose a side, then enter that side's score.
            </DrawerDescription>
          </DrawerHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-2">
            {sides.map((side) => {
              const active = scoreSide === side.id;

              return (
                <button
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors",
                    active
                      ? "border-accent-foreground bg-accent-foreground text-accent"
                      : "bg-card hover:bg-secondary/60",
                  )}
                  key={side.id}
                  onClick={() => selectScoreSide(side.id)}
                  type="button"
                >
                  <span
                    className={cn(
                      "grid size-[22px] shrink-0 place-items-center rounded-full border-2",
                      active ? "border-accent bg-accent" : "border-muted-foreground",
                    )}
                  >
                    {active ? <span className="size-2.5 rounded-full bg-accent-foreground" /> : null}
                  </span>

                  <AvatarStack players={side.players} />

                  <div className="min-w-0 flex-1 leading-tight">
                    <div
                      className={cn(
                        "text-[10px] tracking-widest uppercase",
                        active ? "opacity-70" : "text-muted-foreground",
                      )}
                    >
                      Side {side.id}
                    </div>
                    <div className="truncate text-base font-semibold">
                      {side.players[0].name} + {side.players[1].name}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "font-display text-[28px] leading-none font-bold -tracking-[0.04em] tabular-nums",
                      active ? "" : "text-muted-foreground/60",
                    )}
                  >
                    {side.score}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[11px] tracking-widest text-muted-foreground uppercase">
              Side {scoreSide} score
            </div>
            <div className="flex items-center justify-between rounded-2xl border bg-card p-2 pl-4">
              <Button
                className="size-10 rounded-lg"
                onClick={() => incrementSelectedScore(-1)}
                size="icon"
                type="button"
                variant="secondary"
              >
                <Minus className="size-4" />
              </Button>
              <input
                aria-label={`Side ${scoreSide} score value`}
                className="w-24 min-w-0 bg-transparent text-center font-display text-[56px] leading-none font-bold -tracking-[0.04em] text-primary tabular-nums outline-none focus-visible:ring-0"
                enterKeyHint="done"
                inputMode="numeric"
                onBlur={() => setScoreInputValue(null)}
                onChange={(event) => handleScoreInputChange(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                pattern="[0-9]*"
                type="text"
                value={displayedScore}
              />
              <Button
                className="size-10 rounded-lg"
                onClick={() => incrementSelectedScore(1)}
                size="icon"
                type="button"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <div
              className="grid w-full gap-1.5"
              style={{ gridTemplateColumns: `repeat(${quickPicks.length}, minmax(0, 1fr))` }}
            >
              {quickPicks.map((score) => {
                const active = selectedScore === score;

                return (
                  <button
                    className={cn(
                      "min-w-0 rounded-full border px-1 py-1.5 font-display text-[13px] font-semibold -tracking-[0.02em] tabular-nums transition-colors",
                      active
                        ? "border-accent-foreground bg-accent-foreground text-accent"
                        : "bg-card text-foreground/80 hover:bg-secondary/60",
                    )}
                    key={score}
                    onClick={() => {
                      setScoreInputValue(null);
                      setScoreForSide(scoreSide, score);
                    }}
                    type="button"
                  >
                    {score}
                  </button>
                );
              })}
            </div>
          </div>

          <DrawerFooter className="p-0 pt-1">
            <Button
              className="h-14 w-full rounded-2xl text-base font-semibold"
              disabled={submitting}
              onClick={handleSubmit}
              size="lg"
            >
              {submitting ? "Saving..." : `Save · ${summary}`}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function defaultSideAScore(targetScore: number) {
  return Math.min(targetScore, Math.floor(targetScore / 2) + 1);
}

function clampScore(score: number, targetScore: number) {
  return Math.min(targetScore, Math.max(0, score));
}

function quickPickScores(targetScore: number) {
  const middle = Math.floor(targetScore / 2);
  const start = Math.max(0, middle - 3);
  const end = Math.min(targetScore, start + 6);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
