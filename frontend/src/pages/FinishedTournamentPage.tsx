import { Check, House, ListChecks, Play, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Leaderboard } from "../components/Leaderboard";
import { MetadataLine } from "../components/MetadataLine";
import { PageShell } from "../components/PageShell";
import { RoundsList } from "../components/RoundsList";
import { Seo } from "../components/Seo";
import { TOURNAMENT_NOT_FOUND_MESSAGE } from "../lib/errors";
import { displayMode, displayRoundCount, formatShortTournamentDate, normalizeRoomInput } from "../lib/tournament";
import { useTournament } from "../lib/useTournament";

export function FinishedTournamentPage() {
  const params = useParams();
  const roomCode = params.roomCode ? normalizeRoomInput(params.roomCode) : undefined;
  const navigate = useNavigate();
  const { tournament, isLoading, error } = useTournament(roomCode);
  const [shareState, setShareState] = useState<"idle" | "shared">("idle");
  const [isRoundsOpen, setIsRoundsOpen] = useState(false);
  const shouldRedirectHome = !isLoading && !tournament && error === TOURNAMENT_NOT_FOUND_MESSAGE;

  useEffect(() => {
    if (!shouldRedirectHome) {
      return;
    }

    const redirectTimeout = window.setTimeout(() => {
      navigate("/", { replace: true });
    }, 5000);

    return () => {
      window.clearTimeout(redirectTimeout);
    };
  }, [navigate, shouldRedirectHome]);

  if (!roomCode) {
    return <Navigate replace to="/" />;
  }

  const pageTitle = tournament ? `${tournament.name} Results | Padelo` : "Padel Tournament Results | Padelo";
  const pageDescription = tournament
    ? `Final leaderboard and round results for ${tournament.name}.`
    : "View final Padelo tournament results, leaderboard standings, and completed rounds.";
  const tournamentMetadata = tournament
    ? [
        formatShortTournamentDate(tournament.config.date),
        displayMode(tournament.config.mode),
        `${tournament.state.players.length} players`,
        `${tournament.config.courtCount} courts`,
        `target ${tournament.config.targetScore}`,
        displayRoundCount(tournament),
      ].filter((item): item is string => Boolean(item))
    : [];

  const shareResults = async () => {
    if (!tournament) {
      return;
    }

    const url = window.location.href;

    if (!navigator.share) {
      return;
    }

    try {
      await navigator.share({ title: pageTitle, url });
      setShareState("shared");
      window.setTimeout(() => setShareState("idle"), 1500);
    } catch (caught) {
      if (isAbortError(caught)) {
        return;
      }
    }
  };

  const onPlayAgain = () => {
    if (!tournament) {
      return;
    }

    navigate("/new", {
      state: {
        prefill: {
          mode: tournament.config.mode,
          players: tournament.config.players.map((player) => player.name),
          courtCount: tournament.config.courtCount,
          roundCount: tournament.config.roundCount,
          targetScore: tournament.config.targetScore,
        },
        sourceRoomCode: tournament.roomCode,
      },
    });
  };

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
        description={pageDescription}
        path={`/t/${roomCode}/done`}
        robots="noindex,nofollow,noarchive"
        structuredData={null}
        title={pageTitle}
      />
      {isLoading ? (
        <div className="grid min-h-[50vh] place-items-center text-primary">
          <Spinner />
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="mx-auto max-w-xl space-y-3">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          {shouldRedirectHome ? (
            <div className="rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
              Redirecting home in 5 seconds.
            </div>
          ) : null}
          <Button asChild className="h-11 w-full" variant="outline">
            <Link to="/">
              <House className="size-4" />
              Home
            </Link>
          </Button>
        </div>
      ) : null}

      {tournament ? (
        <div className="mx-auto max-w-3xl space-y-5">
          <section>
            <h1 className="font-display text-[28px] leading-tight font-semibold -tracking-[0.02em] text-foreground">
              {tournament.name}
            </h1>
            <MetadataLine className="mt-1 text-base" items={tournamentMetadata} />
          </section>

          <Leaderboard tournament={tournament} />

          <div className="grid gap-2 sm:grid-cols-3">
            <Button className="h-12 text-base font-semibold" onClick={shareResults}>
              {shareState === "idle" ? <Share2 className="size-5" /> : <Check className="size-5" />}
              {shareState === "shared" ? "Shared" : "Share results"}
            </Button>
            <Button className="h-12 text-base font-semibold" onClick={onPlayAgain} variant="secondary">
              <Play className="size-5" />
              Play again
            </Button>
            <Button
              className="h-12 text-base font-semibold"
              onClick={() => setIsRoundsOpen(true)}
              variant="outline"
            >
              <ListChecks className="size-5" />
              View rounds
            </Button>
          </div>

          <Dialog onOpenChange={setIsRoundsOpen} open={isRoundsOpen}>
            <DialogContent className="max-h-[86dvh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Round history</DialogTitle>
                <DialogDescription>Every court and score from {tournament.name}.</DialogDescription>
              </DialogHeader>
              <RoundsList title={null} tournament={tournament} />
            </DialogContent>
          </Dialog>
        </div>
      ) : null}
    </PageShell>
  );
}

function isAbortError(value: unknown) {
  return value instanceof DOMException && value.name === "AbortError";
}
