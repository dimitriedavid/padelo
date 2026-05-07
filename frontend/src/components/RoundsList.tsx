import type { Tournament } from "../lib/types";
import { playerName } from "../lib/tournament";

type RoundsListProps = {
  tournament: Tournament;
};

export function RoundsList({ tournament }: RoundsListProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-ink">Rounds</h2>
      <div className="grid gap-3">
        {tournament.state.rounds.map((round) => (
          <article className="panel p-4" key={round.index}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="font-semibold text-ink">Round {round.index + 1}</div>
              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium capitalize text-slate-600">
                {round.status}
              </span>
            </div>

            <div className="space-y-2">
              {round.matches.map((match) => (
                <div className="rounded-md border border-line bg-white p-3" key={match.id}>
                  <div className="mb-2 text-xs font-medium uppercase text-slate-500">Court {match.courtNumber}</div>
                  <div className="grid gap-1 text-sm text-ink">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">{match.sideA.map((id) => playerName(tournament, id)).join(" / ")}</span>
                      <span className="font-semibold">{match.result?.sideAScore ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">{match.sideB.map((id) => playerName(tournament, id)).join(" / ")}</span>
                      <span className="font-semibold">{match.result?.sideBScore ?? "-"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {round.sittingOut.length > 0 ? (
              <div className="mt-3 text-xs text-slate-500">
                Sitting out: {round.sittingOut.map((id) => playerName(tournament, id)).join(", ")}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

