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
    saveRecentTournament(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!roomCode) {
      setIsLoading(false);
      setError("Missing room code.");
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

    const events = new EventSource(`/api/tournaments/${encodeURIComponent(roomCode)}/stream`);

    const handleEvent = (event: MessageEvent<string>) => {
      const parsed = parseTournamentEvent(event.data);

      if (parsed) {
        setTournament(parsed);
      }
    };

    events.addEventListener("connected", handleEvent);
    events.addEventListener("tournament_updated", handleEvent);
    events.onerror = () => {
      setError("Live updates disconnected. The page will keep showing the latest loaded state.");
    };

    return () => {
      events.removeEventListener("connected", handleEvent);
      events.removeEventListener("tournament_updated", handleEvent);
      events.close();
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
