import { Hono } from "hono";
import { logger } from "hono/logger";

import { ApiError } from "./domain/errors.js";
import { createTournamentRoutes } from "./routes/tournaments.js";
import { EventHub } from "./services/event-hub.js";
import { TournamentService } from "./services/tournament-service.js";

export type AppDependencies = {
  tournamentService: TournamentService;
  eventHub: EventHub;
};

export function createAppDependencies(
  dependencies: Partial<AppDependencies> & { tournamentService: TournamentService },
): AppDependencies {
  return {
    tournamentService: dependencies.tournamentService,
    eventHub: dependencies.eventHub ?? new EventHub(),
  };
}

export function createApp(dependencies: AppDependencies): Hono {
  const app = new Hono();

  app.use("*", logger());

  app.get("/health", (c) => {
    return c.json({ ok: true });
  });

  app.route(
    "/api/tournaments",
    createTournamentRoutes({
      service: dependencies.tournamentService,
      eventHub: dependencies.eventHub,
    }),
  );

  app.notFound((c) => {
    return c.json({ error: "not_found" }, 404);
  });

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return new Response(
        JSON.stringify({
          error: err.code,
          message: err.message,
          details: err.details,
        }),
        {
          status: err.status,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    }

    console.error(err);

    return c.json({ error: "internal_server_error" }, 500);
  });

  return app;
}
