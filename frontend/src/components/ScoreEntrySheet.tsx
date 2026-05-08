// Padelo score entry sheet. Submits the narrow API payload:
// { winningSide, losingScore, expectedStateVersion }.

import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AvatarStack } from "./PadeloBrand";
import type { ResultSubmission, ScoreboardMatch } from "./scoreboard-types";
import type { MatchSide } from "@/lib/types";

type ScoreEntrySheetProps = {
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

export function ScoreEntrySheet({
  open,
  onOpenChange,
  match,
  targetScore,
  roundIndex,
  expectedStateVersion,
  error,
  onSubmit,
}: ScoreEntrySheetProps) {
  const [winner, setWinner] = useState<MatchSide>("A");
  const [losing, setLosing] = useState(targetScore - 3);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!match) {
      return;
    }

    if (match.result) {
      setWinner(match.result.winningSide);
      setLosing(match.result.winningSide === "A" ? match.result.sideBScore : match.result.sideAScore);
      return;
    }

    setWinner("A");
    setLosing(Math.max(0, targetScore - 3));
  }, [match, targetScore]);

  if (!match) {
    return null;
  }

  const sides = [
    { id: "A" as const, players: match.sideA },
    { id: "B" as const, players: match.sideB },
  ];
  const summary = winner === "A" ? `${targetScore}-${losing} for A` : `${losing}-${targetScore} for B`;

  const handleSubmit = async () => {
    setSubmitting(true);

    try {
      await onSubmit({
        matchId: match.id,
        winningSide: winner,
        losingScore: losing,
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
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="max-h-[92dvh] rounded-t-3xl border-0 p-0"
        showCloseButton={false}
        side="bottom"
      >
        <div className="mx-auto mt-2 mb-1 h-1 w-9 rounded-full bg-border" />

        <div className="flex flex-col gap-4 px-5 pt-1 pb-5">
          <SheetHeader className="space-y-1 p-0 text-left">
            <p className="text-[11px] tracking-widest text-muted-foreground uppercase">
              Court {match.courtNumber} · Round {roundIndex + 1}
            </p>
            <SheetTitle className="font-display text-2xl font-semibold -tracking-[0.025em]">
              Who won?
            </SheetTitle>
            <SheetDescription className="text-xs">
              Target {targetScore}. Tap the winning side, then enter the losing score.
            </SheetDescription>
          </SheetHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-2">
            {sides.map((side) => {
              const active = winner === side.id;

              return (
                <button
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors",
                    active
                      ? "border-accent-foreground bg-accent-foreground text-accent"
                      : "bg-card hover:bg-secondary/60",
                  )}
                  key={side.id}
                  onClick={() => setWinner(side.id)}
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
                    <div className="truncate text-[14px] font-semibold">
                      {side.players[0].name} + {side.players[1].name}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "font-display text-[28px] leading-none font-bold -tracking-[0.04em] tabular-nums",
                      active ? "" : "text-muted-foreground/60",
                    )}
                  >
                    {active ? targetScore : losing}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[11px] tracking-widest text-muted-foreground uppercase">Loser score</div>
            <div className="flex items-center justify-between rounded-2xl border bg-card p-2 pl-4">
              <Button
                className="size-10 rounded-lg"
                onClick={() => setLosing((score) => Math.max(0, score - 1))}
                size="icon"
                type="button"
                variant="secondary"
              >
                <Minus className="size-4" />
              </Button>
              <span className="font-display text-[56px] leading-none font-bold -tracking-[0.04em] text-primary tabular-nums">
                {losing}
              </span>
              <Button
                className="size-10 rounded-lg"
                onClick={() => setLosing((score) => Math.min(targetScore - 1, score + 1))}
                size="icon"
                type="button"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PICKS.filter((score) => score < targetScore).map((score) => {
                const active = losing === score;

                return (
                  <button
                    className={cn(
                      "rounded-full border px-3 py-1 font-display text-[13px] font-semibold -tracking-[0.02em] tabular-nums transition-colors",
                      active
                        ? "border-accent-foreground bg-accent-foreground text-accent"
                        : "bg-card text-foreground/80 hover:bg-secondary/60",
                    )}
                    key={score}
                    onClick={() => setLosing(score)}
                    type="button"
                  >
                    {score}
                  </button>
                );
              })}
            </div>
          </div>

          <SheetFooter className="p-0 pt-1">
            <Button
              className="h-14 w-full rounded-2xl text-base font-semibold"
              disabled={submitting}
              onClick={handleSubmit}
              size="lg"
            >
              {submitting ? "Saving..." : `Save · ${summary}`}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
