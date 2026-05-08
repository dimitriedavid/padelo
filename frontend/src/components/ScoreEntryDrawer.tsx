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

const QUICK_PICKS = [0, 6, 12, 15, 18, 19, 20];

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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!match) {
      return;
    }

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
  const winningSide = sideAScore === sideBScore ? null : sideAScore > sideBScore ? "A" : "B";
  const sides = [
    { id: "A" as const, players: match.sideA, score: sideAScore },
    { id: "B" as const, players: match.sideB, score: sideBScore },
  ];
  const summary = `${sideAScore}-${sideBScore}`;

  const makeWinner = (side: "A" | "B") => {
    if (sideAScore === sideBScore) {
      const winnerScore = defaultSideAScore(targetScore);
      setSideAScore(side === "A" ? winnerScore : targetScore - winnerScore);
      return;
    }

    const winnerScore = Math.max(sideAScore, sideBScore);
    const loserScore = Math.min(sideAScore, sideBScore);
    setSideAScore(side === "A" ? winnerScore : loserScore);
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
              Target {targetScore} total. Enter Side A score; Side B is calculated.
            </DrawerDescription>
          </DrawerHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-2">
            {sides.map((side) => {
              const active = winningSide === side.id;

              return (
                <button
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors",
                    active
                      ? "border-accent-foreground bg-accent-foreground text-accent"
                      : "bg-card hover:bg-secondary/60",
                  )}
                  key={side.id}
                  onClick={() => makeWinner(side.id)}
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
            <div className="text-[11px] tracking-widest text-muted-foreground uppercase">Side A score</div>
            <div className="flex items-center justify-between rounded-2xl border bg-card p-2 pl-4">
              <Button
                className="size-10 rounded-lg"
                onClick={() => setSideAScore((score) => Math.max(0, score - 1))}
                size="icon"
                type="button"
                variant="secondary"
              >
                <Minus className="size-4" />
              </Button>
              <span className="font-display text-[56px] leading-none font-bold -tracking-[0.04em] text-primary tabular-nums">
                {sideAScore}
              </span>
              <Button
                className="size-10 rounded-lg"
                onClick={() => setSideAScore((score) => Math.min(targetScore, score + 1))}
                size="icon"
                type="button"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PICKS.filter((score) => score <= targetScore).map((score) => {
                const active = sideAScore === score;

                return (
                  <button
                    className={cn(
                      "rounded-full border px-3 py-1 font-display text-[13px] font-semibold -tracking-[0.02em] tabular-nums transition-colors",
                      active
                        ? "border-accent-foreground bg-accent-foreground text-accent"
                        : "bg-card text-foreground/80 hover:bg-secondary/60",
                    )}
                    key={score}
                    onClick={() => setSideAScore(score)}
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
