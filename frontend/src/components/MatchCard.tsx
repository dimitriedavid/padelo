import { Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteMatchResult, upsertMatchResult } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { playerName } from "../lib/tournament";
import type { MatchSide, Tournament, TournamentMatch } from "../lib/types";

type MatchCardProps = {
  tournament: Tournament;
  match: TournamentMatch;
  disabled?: boolean;
  onTournamentChange: (tournament: Tournament) => void;
};

export function MatchCard({ tournament, match, disabled = false, onTournamentChange }: MatchCardProps) {
  const initialWinningSide = match.result?.winningSide ?? "A";
  const initialLosingScore = useMemo(() => {
    if (!match.result) {
      return Math.max(0, tournament.state.targetScore - 1);
    }

    return match.result.winningSide === "A" ? match.result.sideBScore : match.result.sideAScore;
  }, [match.result, tournament.state.targetScore]);
  const [winningSide, setWinningSide] = useState<MatchSide>(initialWinningSide);
  const [losingScore, setLosingScore] = useState(initialLosingScore);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setWinningSide(match.result?.winningSide ?? "A");
    setLosingScore(initialLosingScore);
  }, [initialLosingScore, match.result?.winningSide]);

  const sideAPlayers = match.sideA.map((playerId) => playerName(tournament, playerId)).join(" / ");
  const sideBPlayers = match.sideB.map((playerId) => playerName(tournament, playerId)).join(" / ");

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const next = await upsertMatchResult(tournament.roomCode, match.id, {
        winningSide,
        losingScore,
        expectedStateVersion: tournament.stateVersion,
      });
      onTournamentChange(next);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const clear = async () => {
    setError(null);
    setIsDeleting(true);

    try {
      const next = await deleteMatchResult(tournament.roomCode, match.id, {
        expectedStateVersion: tournament.stateVersion,
      });
      onTournamentChange(next);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Court {match.courtNumber}</CardTitle>
        <CardDescription>Match {match.id.toUpperCase()}</CardDescription>
        <CardAction>
          {match.result ? (
            <Badge variant="secondary">
              {match.result.sideAScore}-{match.result.sideBScore}
            </Badge>
          ) : (
            <Badge variant="outline">Open</Badge>
          )}
        </CardAction>
      </CardHeader>

      <CardContent>
        <form className="space-y-4" onSubmit={save}>
          <div className="grid gap-2">
            <div className="rounded-md border bg-background p-3">
              <div className="text-xs font-medium uppercase text-muted-foreground">Side A</div>
              <div className="mt-1 text-sm font-medium text-foreground">{sideAPlayers}</div>
            </div>
            <div className="rounded-md border bg-background p-3">
              <div className="text-xs font-medium uppercase text-muted-foreground">Side B</div>
              <div className="mt-1 text-sm font-medium text-foreground">{sideBPlayers}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Winner</Label>
            <Tabs onValueChange={(value) => setWinningSide(value as MatchSide)} value={winningSide}>
              <TabsList className="grid h-11 w-full grid-cols-2">
                <TabsTrigger disabled={disabled} value="A">
                  Side A
                </TabsTrigger>
                <TabsTrigger disabled={disabled} value="B">
                  Side B
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${match.id}-losing-score`}>Losing score</Label>
            <Input
              className="h-11"
              disabled={disabled}
              id={`${match.id}-losing-score`}
              max={tournament.state.targetScore - 1}
              min={0}
              onChange={(event) => setLosingScore(Number(event.target.value))}
              type="number"
              value={losingScore}
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="h-11 w-full" disabled={disabled || isSaving || isDeleting} type="submit">
              {isSaving ? <Spinner /> : <Save size={16} />}
              {match.result ? "Update" : "Save"}
            </Button>
            {match.result ? (
              <Button
                className="h-11 w-full sm:w-auto"
                disabled={disabled || isSaving || isDeleting}
                onClick={clear}
                type="button"
                variant="secondary"
              >
                {isDeleting ? <Spinner /> : <Trash2 size={16} />}
                Clear
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
