import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Tournament } from "../lib/types";
import { playerName } from "../lib/tournament";

type RoundsListProps = {
  tournament: Tournament;
};

export function RoundsList({ tournament }: RoundsListProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">Rounds</h2>
      <div className="grid gap-3">
        {tournament.state.rounds.map((round) => (
          <Card key={round.index}>
            <CardHeader className="grid grid-cols-[1fr_auto] items-center">
              <CardTitle>Round {round.index + 1}</CardTitle>
              <Badge className="capitalize" variant="secondary">
                {round.status}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-2">
              {round.matches.map((match) => (
                <div className="rounded-md border bg-background p-3" key={match.id}>
                  <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Court {match.courtNumber}</div>
                  <div className="grid gap-1 text-sm text-foreground">
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

            {round.sittingOut.length > 0 ? (
              <div className="pt-1 text-xs text-muted-foreground">
                Sitting out: {round.sittingOut.map((id) => playerName(tournament, id)).join(", ")}
              </div>
            ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
