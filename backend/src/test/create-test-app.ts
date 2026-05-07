import { createApp, createAppDependencies } from "../app.js";
import { InMemoryTournamentRepository } from "../repositories/in-memory-tournament-repository.js";
import { EventHub } from "../services/event-hub.js";
import { TournamentService } from "../services/tournament-service.js";

export function createTestApp(options: { roomCodes?: string[] } = {}) {
  let idCounter = 0;
  let roomCodeCounter = 0;
  let timestampCounter = 0;
  const repository = new InMemoryTournamentRepository();
  const eventHub = new EventHub();
  const service = new TournamentService({
    repository,
    id: () => {
      idCounter += 1;
      return `id-${idCounter}`;
    },
    roomCode: () => {
      const roomCode = options.roomCodes?.[roomCodeCounter] ?? `ROOM${roomCodeCounter + 1}`;
      roomCodeCounter += 1;
      return roomCode;
    },
    now: () => {
      const date = new Date(Date.UTC(2026, 4, 7, 12, 0, timestampCounter));
      timestampCounter += 1;
      return date;
    },
  });
  const app = createApp(
    createAppDependencies({
      tournamentService: service,
      eventHub,
    }),
  );

  return {
    app,
    eventHub,
    repository,
    service,
  };
}

