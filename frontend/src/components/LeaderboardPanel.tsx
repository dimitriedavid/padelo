import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PlayerAvatar } from "./PadeloBrand";
import type { ScoreboardPlayer } from "./scoreboard-types";

export type LeaderboardPanelRow = {
  id: string;
  rank: number;
  player: ScoreboardPlayer;
  name: string;
  points: number;
  record: string;
};

type LeaderboardPanelProps = {
  rows: LeaderboardPanelRow[];
  showHeader?: boolean;
  title?: string;
};

export function LeaderboardPanel({ rows, showHeader = true, title = "Leaderboard" }: LeaderboardPanelProps) {
  return (
    <Card className="overflow-hidden">
      {showHeader ? (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{title}</CardTitle>
            <div className="text-sm font-medium text-muted-foreground">{rows.length} players</div>
          </div>
        </CardHeader>
      ) : null}
      <CardContent className="px-0">
        {rows.map((row, index) => (
          <div key={row.id}>
            {index > 0 ? <Separator /> : null}
            <div className="grid grid-cols-[34px_40px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5">
              <div className="grid size-8 place-items-center rounded-md bg-secondary text-sm font-semibold text-primary">
                {row.rank}
              </div>
              <PlayerAvatar className="size-10 text-xs" player={row.player} />
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-foreground">{row.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{row.record}</div>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl leading-none font-bold text-primary">{row.points}</div>
                <div className="text-xs text-muted-foreground">points</div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
