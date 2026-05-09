import { House, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { AppHeader } from "../components/AppHeader";
import { assignPlayerAvatarColors } from "../components/PadeloBrand";
import { Scoreboard } from "../components/Scoreboard";
import { ScoreEntryDrawer } from "../components/ScoreEntryDrawer";
import type {
  ResultSubmission,
  ScoreboardLogEntry,
  ScoreboardPlayer,
  ScoreboardTournament,
} from "../components/scoreboard-types";
import { Seo } from "../components/Seo";
import { finishTournament, getTournamentEvents, upsertMatchResult } from "../lib/api";
import { errorMessage, TOURNAMENT_NOT_FOUND_MESSAGE } from "../lib/errors";
import { normalizeRoomInput } from "../lib/tournament";
import type { MatchResult, Tournament, TournamentEvent } from "../lib/types";
import { useTournament } from "../lib/useTournament";

export function TournamentRoomPage() {
  const params = useParams();
  const roomCode = params.roomCode ? normalizeRoomInput(params.roomCode) : undefined;
  const navigate = useNavigate();
  const { tournament, isLoading, error, setTournament, refresh } = useTournament(roomCode);
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(0);
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ScoreboardLogEntry[]>([]);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isFinishDialogOpen, setIsFinishDialogOpen] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  useEffect(() => {
    if (!tournament) {
      return;
    }

    setSelectedRoundIndex(tournament.state.currentRoundIndex);
  }, [tournament?.roomCode, tournament?.state.currentRoundIndex]);

  useEffect(() => {
    if (!tournament) {
      return;
    }

    let cancelled = false;

    getTournamentEvents(tournament.roomCode)
      .then((events) => {
        if (!cancelled) {
          setLogs(events.map(toLogEntry));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLogs([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tournament?.roomCode, tournament?.stateVersion]);

  const scoreboardTournament = useMemo(() => {
    if (!tournament) {
      return null;
    }

    const safeRoundIndex = Math.min(
      selectedRoundIndex,
      Math.max(0, tournament.state.rounds.length - 1),
    );

    return toScoreboardTournament(tournament, safeRoundIndex);
  }, [selectedRoundIndex, tournament]);

  const openMatch = useMemo(() => {
    if (!scoreboardTournament || !openMatchId) {
      return null;
    }

    return (
      scoreboardTournament.rounds[scoreboardTournament.currentRoundIndex]?.matches.find(
        (match) => match.id === openMatchId,
      ) ?? null
    );
  }, [openMatchId, scoreboardTournament]);

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

  if (tournament?.status === "finished") {
    return <Navigate replace to={`/t/${tournament.roomCode}/done`} />;
  }

  const pageTitle = tournament ? `${tournament.name} Scoreboard | Padelo` : "Padel Tournament Scoreboard | Padelo";
  const pageDescription = tournament
    ? `Live scoreboard for ${tournament.name}, with current round, match results, leaderboard, and tournament history.`
    : "View a Padelo tournament room with live scores, match results, rounds, and leaderboard updates.";

  const shareRoom = async () => {
    const url = window.location.href;

    if (!navigator.share) {
      return;
    }

    await navigator.share({ title: pageTitle, url });
  };

  const submitResult = async (payload: ResultSubmission) => {
    if (!tournament) {
      return;
    }

    setActionError(null);

    try {
      const next = await upsertMatchResult(tournament.roomCode, payload.matchId, {
        sideAScore: payload.sideAScore,
        sideBScore: payload.sideBScore,
        expectedStateVersion: payload.expectedStateVersion,
      });
      setTournament(next);
      setLogs((await getTournamentEvents(next.roomCode)).map(toLogEntry));
    } catch (caught) {
      setActionError(errorMessage(caught));
      await refresh();
      throw caught;
    }
  };

  const requestFinish = () => {
    setFinishError(null);
    setIsFinishDialogOpen(true);
  };

  const finish = async () => {
    if (!tournament || isFinishing) {
      return;
    }

    setFinishError(null);
    setIsFinishing(true);

    try {
      const next = await finishTournament(tournament.roomCode);
      setTournament(next);
      setIsFinishDialogOpen(false);
      navigate(`/t/${next.roomCode}/done`);
    } catch (caught) {
      setFinishError(errorMessage(caught));
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <>
      <Seo
        description={pageDescription}
        path={`/t/${roomCode}`}
        robots="noindex,nofollow,noarchive"
        structuredData={null}
        title={pageTitle}
      />

      {isLoading && !scoreboardTournament ? (
        <TournamentRoomSkeleton />
      ) : null}

      {!isLoading && error ? (
        <div className="grid h-dvh place-items-center bg-background px-4">
          <div className="w-full max-w-sm space-y-3">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            {shouldRedirectHome ? (
              <div className="rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
                Redirecting home in 5 seconds.
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="h-11" onClick={() => navigate("/")} variant="outline">
                <House size={16} />
                Home
              </Button>
              <Button className="h-11" onClick={refresh} variant="secondary">
                <RefreshCw size={16} />
                Retry
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {scoreboardTournament ? (
        <>
          <Scoreboard
            log={logs}
            onBack={() => navigate("/")}
            onChangeRound={setSelectedRoundIndex}
            onEnterScore={setOpenMatchId}
            onMore={requestFinish}
            onShare={shareRoom}
            tournament={scoreboardTournament}
          />
          <ScoreEntryDrawer
            error={actionError}
            expectedStateVersion={tournament?.stateVersion ?? 0}
            match={openMatch}
            onOpenChange={(open) => {
              if (!open) {
                setOpenMatchId(null);
                setActionError(null);
              }
            }}
            onSubmit={submitResult}
            open={openMatch !== null}
            roundIndex={scoreboardTournament.currentRoundIndex}
            targetScore={scoreboardTournament.targetScore}
          />
          <Dialog
            onOpenChange={(open) => {
              if (isFinishing) {
                return;
              }

              setIsFinishDialogOpen(open);

              if (!open) {
                setFinishError(null);
              }
            }}
            open={isFinishDialogOpen}
          >
            <DialogContent showCloseButton={!isFinishing}>
              <DialogHeader>
                <DialogTitle>Finish tournament?</DialogTitle>
                <DialogDescription>
                  This locks the current results and opens the final standings page.
                </DialogDescription>
              </DialogHeader>

              {finishError ? (
                <Alert variant="destructive">
                  <AlertDescription>{finishError}</AlertDescription>
                </Alert>
              ) : null}

              <DialogFooter>
                <DialogClose asChild>
                  <Button className="h-12 text-base font-semibold" disabled={isFinishing} variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button className="h-12 text-base font-semibold" disabled={isFinishing} onClick={finish}>
                  {isFinishing ? <Spinner className="size-4" /> : null}
                  Finish tournament
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </>
  );
}

function TournamentRoomSkeleton() {
  return (
    <div className="fixed inset-x-0 top-0 flex h-dvh w-full flex-col overflow-hidden overscroll-none bg-background pt-[env(safe-area-inset-top)] text-foreground">
      <AppHeader
        actions={
          <>
            <Skeleton className="h-9 w-36 rounded-md" />
            <Skeleton className="size-11 rounded-lg" />
            <Skeleton className="size-11 rounded-lg" />
          </>
        }
        constrained={false}
        logoHref={null}
        sticky={false}
      />

      <div className="px-4 pt-3.5 pb-1.5">
        <Skeleton className="h-8 w-64 max-w-[75vw]" />
        <Skeleton className="mt-2 h-5 w-80 max-w-[85vw]" />
      </div>

      <div className="flex h-12 items-center gap-7 border-b px-4">
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-11" />
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-hidden px-4 py-3">
        {Array.from({ length: 2 }, (_, index) => (
          <div className="space-y-3 rounded-2xl border bg-card p-3 shadow-sm" key={index}>
            <div className="flex items-center gap-2 px-1">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="ml-auto h-6 w-14" />
            </div>
            <Skeleton className="h-[106px] rounded-2xl" />
            <Skeleton className="h-[106px] rounded-2xl" />
          </div>
        ))}
      </div>

      <footer className="flex items-center gap-2 border-t bg-background px-4 py-2 pb-3">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="size-10 rounded-lg" />
        </div>
        <Skeleton className="size-10 rounded-lg" />
      </footer>
    </div>
  );
}

function toScoreboardTournament(tournament: Tournament, currentRoundIndex: number): ScoreboardTournament {
  const players = assignPlayerAvatarColors(tournament.state.players.map(toScoreboardPlayer));
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const getPlayer = (playerId: string) =>
    playerMap.get(playerId) ?? {
      id: playerId,
      initials: initialsFor(playerId),
      name: playerId,
    };

  const rounds = tournament.state.rounds.map((round) => ({
    index: round.index,
    status: round.status,
    matches: round.matches.map((match) => ({
      id: match.id,
      courtNumber: match.courtNumber,
      sideA: [getPlayer(match.sideA[0]), getPlayer(match.sideA[1])] as [ScoreboardPlayer, ScoreboardPlayer],
      sideB: [getPlayer(match.sideB[0]), getPlayer(match.sideB[1])] as [ScoreboardPlayer, ScoreboardPlayer],
      result: match.result ?? undefined,
    })),
  }));

  return {
    roomCode: tournament.roomCode,
    name: tournament.name,
    mode: tournament.config.mode,
    roundCount: tournament.config.roundCount,
    targetScore: tournament.state.targetScore,
    totalRounds: rounds.length,
    currentRoundIndex,
    activeRoundIndex: tournament.state.currentRoundIndex,
    courts: tournament.config.courtCount,
    players,
    rounds,
    standings: tournament.state.leaderboard.map((entry) => {
      const player = getPlayer(entry.playerId);

      return {
        ...player,
        played: entry.played,
        points: entry.pointsFor,
        wins: entry.wins,
        ties: entry.ties ?? 0,
        losses: Math.max(0, entry.played - entry.wins - (entry.ties ?? 0)),
        pointDiff: entry.pointDiff,
      };
    }),
  };
}

function toScoreboardPlayer(player: Tournament["state"]["players"][number]): ScoreboardPlayer {
  return {
    id: player.id,
    name: player.name,
    initials: initialsFor(player.name),
  };
}

function initialsFor(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return value.trim().slice(0, 2).toUpperCase() || "??";
}

function toLogEntry(event: TournamentEvent): ScoreboardLogEntry {
  const score = scoreFromPayload(event.payload);

  return {
    ago: formatRelativeTime(event.createdAt),
    text: eventText(event),
    score,
  };
}

function formatRelativeTime(value: string) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));

  if (elapsedSeconds < 60) {
    return "now";
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  return `${elapsedDays}d ago`;
}

function eventText(event: TournamentEvent) {
  const matchId = typeof event.payload.matchId === "string" ? event.payload.matchId.toUpperCase() : null;

  switch (event.type) {
    case "tournament_created":
      return "Tournament created";
    case "match_result_upserted":
      return matchId ? `Score saved for ${matchId}` : "Score saved";
    case "match_result_deleted":
      return matchId ? `Score cleared for ${matchId}` : "Score cleared";
    case "tournament_finished":
      return "Tournament finished";
    case "play_again_created":
      return "Play-again room created";
  }
}

function scoreFromPayload(payload: Record<string, unknown>) {
  const result = payload.result as Partial<MatchResult> | undefined;

  if (typeof result?.sideAScore === "number" && typeof result.sideBScore === "number") {
    return `${result.sideAScore}-${result.sideBScore}`;
  }

  return undefined;
}
