import { Check, Copy, Flag, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { Button } from "../components/Button";
import { EventLog } from "../components/EventLog";
import { Leaderboard } from "../components/Leaderboard";
import { MatchCard } from "../components/MatchCard";
import { Message } from "../components/Message";
import { PageShell } from "../components/PageShell";
import { RoundsList } from "../components/RoundsList";
import { Seo } from "../components/Seo";
import { Spinner } from "../components/Spinner";
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
        <Button icon={copied ? <Check size={17} /> : <Copy size={17} />} onClick={copyLink} size="sm" variant="secondary">
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
        <div className="grid min-h-[50vh] place-items-center text-court-700">
          <Spinner />
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="mx-auto max-w-xl">
          <Message tone="error">{error}</Message>
          <div className="mt-4 flex gap-2">
            <Button icon={<RefreshCw size={16} />} onClick={refresh} variant="secondary">
              Retry
            </Button>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-medium text-ink"
              to="/"
            >
              Home
            </Link>
          </div>
        </div>
      ) : null}

      {tournament ? (
        <div className="space-y-5">
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-court-600 px-2 py-1 text-xs font-semibold uppercase text-white">
                  {tournament.roomCode}
                </span>
                <span className="rounded bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-line">
                  {displayMode(tournament.config.mode)}
                </span>
                <span className="rounded bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-line">
                  {displayRoundCount(tournament)}
                </span>
              </div>
              <h1 className="text-2xl font-semibold text-ink sm:text-3xl">{tournament.name}</h1>
              <div className="grid grid-cols-3 gap-2 sm:max-w-lg">
                <Stat label="Players" value={String(tournament.state.players.length)} />
                <Stat label="Courts" value={String(tournament.config.courtCount)} />
                <Stat label="Target" value={String(tournament.state.targetScore)} />
              </div>
            </div>

            <div className="flex items-start gap-2 lg:justify-end">
              {tournament.status === "finished" ? (
                <Link
                  className="inline-flex h-11 items-center justify-center rounded-md bg-court-600 px-4 text-sm font-medium text-white"
                  to={`/t/${tournament.roomCode}/done`}
                >
                  Results
                </Link>
              ) : (
                <Button disabled={isFinishing} icon={<Flag size={17} />} onClick={finish} variant="danger">
                  {isFinishing ? <Spinner /> : null}
                  Finish
                </Button>
              )}
            </div>
          </section>

          {actionError ? <Message tone="error">{actionError}</Message> : null}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-ink">
                    Round {(currentRound?.index ?? 0) + 1}
                  </h2>
                  <span className="rounded bg-white px-2 py-1 text-xs font-medium capitalize text-slate-600 ring-1 ring-line">
                    {currentRound?.status ?? "pending"}
                  </span>
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
                  <Message>No current round.</Message>
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
    <div className="rounded-md border border-line bg-white p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}
