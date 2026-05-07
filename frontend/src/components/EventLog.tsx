import { Clock } from "lucide-react";
import { useState } from "react";

import { getTournamentEvents } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { formatDateTime } from "../lib/tournament";
import type { TournamentEvent } from "../lib/types";
import { Button } from "./Button";
import { Message } from "./Message";
import { Spinner } from "./Spinner";

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
    <section className="panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Logs</h2>
        <Button icon={isLoading ? <Spinner /> : <Clock size={16} />} onClick={load} size="sm" variant="secondary">
          Load
        </Button>
      </div>

      {error ? (
        <div className="mt-3">
          <Message tone="error">{error}</Message>
        </div>
      ) : null}

      {events ? (
        <div className="mt-3 divide-y divide-line">
          {events.map((event) => (
            <div className="py-3 text-sm" key={event.id}>
              <div className="font-medium text-ink">{event.type.replaceAll("_", " ")}</div>
              <div className="mt-1 text-xs text-slate-500">{formatDateTime(event.createdAt)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

