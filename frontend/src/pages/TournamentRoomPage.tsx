import { Check, Copy, Flag, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { EventLog } from "../components/EventLog";
import { Leaderboard } from "../components/Leaderboard";
import { MatchCard } from "../components/MatchCard";
import { PageShell } from "../components/PageShell";
import { RoundsList } from "../components/RoundsList";
import { Seo } from "../components/Seo";
import { finishTournament } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { displayMode, displayRoundCount, normalizeRoomInput } from "../lib/tournament";
import { useTournament } from "../lib/useTournament";

export function TournamentRoomPage() {
  const params = useParams();
  const roomCode = params.roomCode ? normalizeRoomInput(params.roomCode) : undefined;
  const navigate = useNavigate();
  const { tournament, isLoading, error, setTournament, refresh } = useTournament(roomCode);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!roomCode) {
    return <Navigate replace to="/" />;
  }

  const currentRound = tournament?.state.rounds[tournament.state.currentRoundIndex];
  const pageTitle = tournament ? `${tournament.name} Scoreboard | Padelo` : "Padel Tournament Scoreboard | Padelo";
  const pageDescription = tournament
    ? `Live scoreboard for ${tournament.name}, with current round, match results, leaderboard, and tournament history.`
    : "View a Padelo tournament room with live scores, match results, rounds, and leaderboard updates.";

  const copyLink = async () => {
    setCopied(false);
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const finish = async () => {
    if (!tournament) {
      return;
    }

    const confirmed = window.confirm("Finish this tournament?");

    if (!confirmed) {
      return;
    }

    setIsFinishing(true);
    setActionError(null);

    try {
      const next = await finishTournament(tournament.roomCode);
      setTournament(next);
      navigate(`/t/${next.roomCode}/done`);
    } catch (caught) {
      setActionError(errorMessage(caught));
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <PageShell
      actions={
        <Button onClick={copyLink} size="sm" variant="secondary">
          {copied ? <Check size={17} /> : <Copy size={17} />}
          <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
        </Button>
      }
    >
      <Seo
        description={pageDescription}
        path={`/t/${roomCode}`}
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
        <div className="mx-auto max-w-xl">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex gap-2">
            <Button onClick={refresh} variant="secondary">
              <RefreshCw size={16} />
              Retry
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Home</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {tournament ? (
        <div className="space-y-5">
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="uppercase">
                  {tournament.roomCode}
                </Badge>
                <Badge variant="outline">
                  {displayMode(tournament.config.mode)}
                </Badge>
                <Badge variant="outline">
                  {displayRoundCount(tournament)}
                </Badge>
              </div>
              <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{tournament.name}</h1>
              <div className="grid grid-cols-3 gap-2 sm:max-w-lg">
                <Stat label="Players" value={String(tournament.state.players.length)} />
                <Stat label="Courts" value={String(tournament.config.courtCount)} />
                <Stat label="Target" value={String(tournament.state.targetScore)} />
              </div>
            </div>

            <div className="flex items-start gap-2 lg:justify-end">
              {tournament.status === "finished" ? (
                <Button asChild className="h-11">
                  <Link to={`/t/${tournament.roomCode}/done`}>Results</Link>
                </Button>
              ) : (
                <Button disabled={isFinishing} onClick={finish} variant="destructive">
                  {isFinishing ? <Spinner /> : <Flag size={17} />}
                  Finish
                </Button>
              )}
            </div>
          </section>

          {actionError ? (
            <Alert variant="destructive">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-foreground">
                    Round {(currentRound?.index ?? 0) + 1}
                  </h2>
                  <Badge className="capitalize" variant="secondary">
                    {currentRound?.status ?? "pending"}
                  </Badge>
                </div>

                {currentRound ? (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {currentRound.matches.map((match) => (
                      <MatchCard
                        disabled={tournament.status === "finished"}
                        key={match.id}
                        match={match}
                        onTournamentChange={setTournament}
                        tournament={tournament}
                      />
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>No current round.</AlertDescription>
                  </Alert>
                )}
              </section>

              <RoundsList tournament={tournament} />
            </div>

            <aside className="space-y-5">
              <Leaderboard tournament={tournament} />
              <EventLog roomCode={tournament.roomCode} />
            </aside>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}
