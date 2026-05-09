import { useCallback, useEffect, useState } from "react";

import { getTournament } from "./api";
import { errorMessage } from "./errors";
import { saveRecentTournament } from "./recentRooms";
import type { Tournament } from "./types";

type UseTournamentResult = {
  tournament: Tournament | null;
  isLoading: boolean;
  error: string | null;
  setTournament: (tournament: Tournament) => void;
  refresh: () => Promise<void>;
};

export function useTournament(roomCode: string | undefined): UseTournamentResult {
  const [tournament, setTournamentState] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setTournament = useCallback((next: Tournament) => {
    setTournamentState(next);
    setError(null);
    saveRecentTournament(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!roomCode) {
      setIsLoading(false);
      setError("Missing room link.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const next = await getTournament(roomCode);
      setTournament(next);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, [roomCode, setTournament]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!roomCode) {
      return;
    }

    let events: EventSource | null = null;
    let reconnectTimeout: number | null = null;
    let cancelled = false;

    const handleEvent = (event: MessageEvent<string>) => {
      const parsed = parseTournamentEvent(event.data);

      if (parsed) {
        setTournament(parsed);
      }
    };

    const backgroundRefresh = async () => {
      try {
        const next = await getTournament(roomCode);

        if (!cancelled) {
          setTournament(next);
        }
      } catch {
        // Keep showing the latest loaded state; the stream/browser lifecycle handlers will retry.
      }
    };

    const closeStream = () => {
      if (!events) {
        return;
      }

      events.removeEventListener("connected", handleEvent);
      events.removeEventListener("tournament_updated", handleEvent);
      events.close();
      events = null;
    };

    const openStream = () => {
      closeStream();

      events = new EventSource(`/api/tournaments/${encodeURIComponent(roomCode)}/stream`);
      events.addEventListener("connected", handleEvent);
      events.addEventListener("tournament_updated", handleEvent);
      events.onerror = () => {
        if (reconnectTimeout !== null) {
          return;
        }

        reconnectTimeout = window.setTimeout(() => {
          reconnectTimeout = null;
          void backgroundRefresh();

          if (!cancelled && events?.readyState === EventSource.CLOSED) {
            openStream();
          }
        }, 1500);
      };
    };

    const refreshAndReconnect = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void backgroundRefresh();
      openStream();
    };

    openStream();

    document.addEventListener("visibilitychange", refreshAndReconnect);
    window.addEventListener("focus", refreshAndReconnect);
    window.addEventListener("online", refreshAndReconnect);

    return () => {
      cancelled = true;

      if (reconnectTimeout !== null) {
        window.clearTimeout(reconnectTimeout);
      }

      document.removeEventListener("visibilitychange", refreshAndReconnect);
      window.removeEventListener("focus", refreshAndReconnect);
      window.removeEventListener("online", refreshAndReconnect);
      closeStream();
    };
  }, [roomCode, setTournament]);

  return {
    tournament,
    isLoading,
    error,
    setTournament,
    refresh,
  };
}

function parseTournamentEvent(raw: string): Tournament | null {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null || !("tournament" in parsed)) {
      return null;
    }

    return (parsed as { tournament: Tournament }).tournament;
  } catch {
    return null;
  }
}
