import { createApp, createAppDependencies } from "../app.js";
import { InMemoryTournamentRepository } from "../repositories/in-memory-tournament-repository.js";
import { EventHub } from "../services/event-hub.js";
import type { HealthCheck } from "../services/health.js";
import type { RateLimitPolicies } from "../services/rate-limiter.js";
import { TournamentService } from "../services/tournament-service.js";

export function createTestApp(
  options: {
    roomCodes?: string[];
    rateLimitPolicies?: Partial<RateLimitPolicies>;
    healthCheck?: HealthCheck;
  } = {},
) {
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
      ...(options.rateLimitPolicies ? { rateLimitPolicies: options.rateLimitPolicies } : {}),
      ...(options.healthCheck ? { healthCheck: options.healthCheck } : {}),
    }),
  );

  return {
    app,
    eventHub,
    repository,
    service,
  };
}
