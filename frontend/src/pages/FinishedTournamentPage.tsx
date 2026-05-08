import { ArrowLeft, Check, Copy, Play } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { Button } from "../components/Button";
import { Leaderboard } from "../components/Leaderboard";
import { Message } from "../components/Message";
import { PageShell } from "../components/PageShell";
import { RoundsList } from "../components/RoundsList";
import { Seo } from "../components/Seo";
import { Spinner } from "../components/Spinner";
import { playAgain } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { saveRecentTournament } from "../lib/recentRooms";
import { displayMode, normalizeRoomInput } from "../lib/tournament";
import { useTournament } from "../lib/useTournament";

export function FinishedTournamentPage() {
  const params = useParams();
  const roomCode = params.roomCode ? normalizeRoomInput(params.roomCode) : undefined;
  const navigate = useNavigate();
  const { tournament, isLoading, error } = useTournament(roomCode);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPlayingAgain, setIsPlayingAgain] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!roomCode) {
    return <Navigate replace to="/" />;
  }

  const pageTitle = tournament ? `${tournament.name} Results | Padelo` : "Padel Tournament Results | Padelo";
  const pageDescription = tournament
    ? `Final leaderboard and round results for ${tournament.name}.`
    : "View final Padelo tournament results, leaderboard standings, and completed rounds.";

  const copyResults = async () => {
    if (!tournament) {
      return;
    }

    const lines = [
      `${tournament.name} results`,
      ...tournament.state.leaderboard.map((entry, index) => {
        const player = tournament.state.players.find((candidate) => candidate.id === entry.playerId);
        return `${index + 1}. ${player?.name ?? entry.playerId} ${entry.pointsFor}-${entry.pointsAgainst} (${entry.pointDiff >= 0 ? "+" : ""}${entry.pointDiff})`;
      }),
    ];

    await navigator.clipboard?.writeText(lines.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const onPlayAgain = async () => {
    if (!tournament) {
      return;
    }

    setActionError(null);
    setIsPlayingAgain(true);

    try {
      const next = await playAgain(tournament.roomCode);
      saveRecentTournament(next);
      navigate(`/t/${next.roomCode}`);
    } catch (caught) {
      setActionError(errorMessage(caught));
    } finally {
      setIsPlayingAgain(false);
    }
  };

  return (
    <PageShell
      actions={
        <Link
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ink transition hover:bg-court-50"
          title="Back to room"
          to={`/t/${roomCode}`}
        >
          <ArrowLeft size={19} />
        </Link>
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
        <div className="grid min-h-[50vh] place-items-center text-court-700">
          <Spinner />
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="mx-auto max-w-xl">
          <Message tone="error">{error}</Message>
        </div>
      ) : null}

      {tournament ? (
        <div className="space-y-5">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-court-600 px-2 py-1 text-xs font-semibold uppercase text-white">
                {tournament.roomCode}
              </span>
              <span className="rounded bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-line">
                {displayMode(tournament.config.mode)}
              </span>
              <span className="rounded bg-white px-2 py-1 text-xs font-medium capitalize text-slate-600 ring-1 ring-line">
                {tournament.status}
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">{tournament.name}</h1>
          </section>

          {actionError ? <Message tone="error">{actionError}</Message> : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button icon={copied ? <Check size={17} /> : <Copy size={17} />} onClick={copyResults} variant="secondary">
              {copied ? "Copied" : "Copy results"}
            </Button>
            <Button disabled={isPlayingAgain} icon={<Play size={17} />} onClick={onPlayAgain}>
              {isPlayingAgain ? <Spinner /> : null}
              Play again
            </Button>
          </div>

          <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <Leaderboard tournament={tournament} />
            <RoundsList tournament={tournament} />
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
