import { Clock } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { getTournamentEvents } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { formatDateTime } from "../lib/tournament";
import type { TournamentEvent } from "../lib/types";

type EventLogProps = {
  roomCode: string;
};

export function EventLog({ roomCode }: EventLogProps) {
  const [events, setEvents] = useState<TournamentEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError(null);

    try {
      setEvents(await getTournamentEvents(roomCode));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="grid grid-cols-[1fr_auto] items-center">
        <CardTitle>Logs</CardTitle>
        <Button onClick={load} size="sm" variant="secondary">
          {isLoading ? <Spinner /> : <Clock size={16} />}
          Load
        </Button>
      </CardHeader>

      {error ? (
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      ) : null}

      {events ? (
        <CardContent className="pt-0">
          <div>
            {events.map((event) => (
              <div key={event.id}>
                <Separator />
                <div className="py-3 text-sm">
                  <div className="font-medium text-foreground">{event.type.replaceAll("_", " ")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
