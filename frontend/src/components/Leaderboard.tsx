import type { Tournament } from "../lib/types";
import { playerName, sortLeaderboard } from "../lib/tournament";

type LeaderboardProps = {
  tournament: Tournament;
};

export function Leaderboard({ tournament }: LeaderboardProps) {
  const entries = sortLeaderboard(tournament);

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-base font-semibold text-ink">Leaderboard</h2>
      </div>
      <div className="divide-y divide-line">
        {entries.map((entry, index) => (
          <div
            className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
            key={entry.playerId}
          >
            <div className="grid h-7 w-7 place-items-center rounded bg-court-50 text-sm font-semibold text-court-700">
              {index + 1}
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium text-ink">{playerName(tournament, entry.playerId)}</div>
              <div className="mt-0.5 text-xs text-slate-500">
                {entry.played} played · {entry.wins} wins
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-ink">{entry.pointDiff >= 0 ? "+" : ""}{entry.pointDiff}</div>
              <div className="text-xs text-slate-500">
                {entry.pointsFor}-{entry.pointsAgainst}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

