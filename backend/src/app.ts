import { Hono } from "hono";
import { logger } from "hono/logger";

import { ApiError } from "./domain/errors.js";
import { createTournamentRoutes } from "./routes/tournaments.js";
import { writeAccessLog } from "./services/access-log.js";
import { EventHub } from "./services/event-hub.js";
import type { HealthCheck } from "./services/health.js";
import {
  DEFAULT_RATE_LIMIT_POLICIES,
  InMemoryRateLimiter,
  type RateLimiter,
  type RateLimitPolicies,
} from "./services/rate-limiter.js";
import { TournamentService } from "./services/tournament-service.js";

export type AppDependencies = {
  tournamentService: TournamentService;
  eventHub: EventHub;
  rateLimiter: RateLimiter;
  rateLimitPolicies: RateLimitPolicies;
  healthCheck: HealthCheck;
};

type AppDependencyInput = Partial<Omit<AppDependencies, "rateLimitPolicies">> & {
  tournamentService: TournamentService;
  rateLimitPolicies?: Partial<RateLimitPolicies>;
};

export function createAppDependencies(
  dependencies: AppDependencyInput,
): AppDependencies {
  return {
    tournamentService: dependencies.tournamentService,
    eventHub: dependencies.eventHub ?? new EventHub(),
    rateLimiter: dependencies.rateLimiter ?? new InMemoryRateLimiter(),
    rateLimitPolicies: {
      ...DEFAULT_RATE_LIMIT_POLICIES,
      ...dependencies.rateLimitPolicies,
    },
    healthCheck: dependencies.healthCheck ?? (async () => {}),
  };
}

export function createApp(dependencies: AppDependencies): Hono {
  const app = new Hono();

  app.use("*", logger(writeAccessLog));

  app.get("/health", async (c) => {
    try {
      await dependencies.healthCheck();
    } catch (error) {
      console.error("Health check failed", error);

      return c.json({ ok: false, error: "service_unavailable" }, 503);
    }

    return c.json({ ok: true });
  });

  app.route(
    "/api/tournaments",
    createTournamentRoutes({
      service: dependencies.tournamentService,
      eventHub: dependencies.eventHub,
      rateLimiter: dependencies.rateLimiter,
      rateLimitPolicies: dependencies.rateLimitPolicies,
    }),
  );

  app.notFound((c) => {
    return c.json({ error: "not_found" }, 404);
  });

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      const headers = new Headers(err.headers);
      headers.set("content-type", "application/json");

      return new Response(
        JSON.stringify({
          error: err.code,
          message: err.message,
          details: err.details,
        }),
        {
          status: err.status,
          headers,
        },
      );
    }

    console.error(err);

    return c.json({ error: "internal_server_error" }, 500);
  });

  return app;
}
