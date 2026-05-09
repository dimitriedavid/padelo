import { Check, Copy, House, Play } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Leaderboard } from "../components/Leaderboard";
import { PageShell } from "../components/PageShell";
import { RoundsList } from "../components/RoundsList";
import { Seo } from "../components/Seo";
import { displayMode, normalizeRoomInput } from "../lib/tournament";
import { useTournament } from "../lib/useTournament";

export function FinishedTournamentPage() {
  const params = useParams();
  const roomCode = params.roomCode ? normalizeRoomInput(params.roomCode) : undefined;
  const navigate = useNavigate();
  const { tournament, isLoading, error } = useTournament(roomCode);
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
        const losses = Math.max(0, entry.played - entry.wins - (entry.ties ?? 0));
        return `${index + 1}. ${player?.name ?? entry.playerId} ${entry.pointsFor} pts (${entry.wins}W ${(entry.ties ?? 0)}T ${losses}L)`;
      }),
    ];

    await navigator.clipboard?.writeText(lines.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const onPlayAgain = () => {
    if (!tournament) {
      return;
    }

    navigate("/new", {
      state: {
        prefill: {
          name: tournament.config.name,
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
        <div className="mx-auto max-w-xl">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {tournament ? (
        <div className="space-y-5">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="uppercase">
                {tournament.roomCode}
              </Badge>
              <Badge variant="outline">
                {displayMode(tournament.config.mode)}
              </Badge>
              <Badge className="capitalize" variant="secondary">
                {tournament.status}
              </Badge>
            </div>
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{tournament.name}</h1>
          </section>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={copyResults} variant="secondary">
              {copied ? <Check size={17} /> : <Copy size={17} />}
              {copied ? "Copied" : "Copy results"}
            </Button>
            <Button onClick={onPlayAgain}>
              <Play size={17} />
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
