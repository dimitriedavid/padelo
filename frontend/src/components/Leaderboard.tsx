import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Tournament } from "../lib/types";
import { playerName, sortLeaderboard } from "../lib/tournament";

type LeaderboardProps = {
  tournament: Tournament;
};

export function Leaderboard({ tournament }: LeaderboardProps) {
  const entries = sortLeaderboard(tournament);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {entries.map((entry, index) => (
          <div key={entry.playerId}>
            {index > 0 ? <Separator /> : null}
            <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
              <div className="grid h-7 w-7 place-items-center rounded bg-secondary text-sm font-semibold text-primary">
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">{playerName(tournament, entry.playerId)}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {entry.wins}W {(entry.ties ?? 0)}T {Math.max(0, entry.played - entry.wins - (entry.ties ?? 0))}L
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl leading-none font-bold text-primary">{entry.pointsFor}</div>
                <div className="text-xs text-muted-foreground">points</div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
