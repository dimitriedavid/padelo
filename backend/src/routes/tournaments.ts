import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { badRequest, tooManyRequests } from "../domain/errors.js";
import type {
  RateLimiter,
  RateLimitLease,
  RateLimitPolicies,
  RateLimitPolicy,
  RateLimitResult,
} from "../services/rate-limiter.js";
import { serializeTournament, serializeTournamentLog } from "../services/serializers.js";
import type { EventHub } from "../services/event-hub.js";
import type { TournamentService } from "../services/tournament-service.js";
import { parseMatchIdParam, parseRoomCodeParam } from "../validation/path-params.js";
import {
  parseCreateTournamentRequest,
  parseDeleteMatchResultRequest,
  parseFinishTournamentRequest,
  parseUpsertMatchResultRequest,
} from "../validation/tournaments.js";

export const TOURNAMENT_REQUEST_BODY_LIMIT_BYTES = 64 * 1024;

export type TournamentRouteDependencies = {
  service: TournamentService;
  eventHub: EventHub;
  rateLimiter: RateLimiter;
  rateLimitPolicies: RateLimitPolicies;
};

export function createTournamentRoutes({
  service,
  eventHub,
  rateLimiter,
  rateLimitPolicies,
}: TournamentRouteDependencies): Hono {
  const routes = new Hono();

  routes.use(
    "*",
    bodyLimit({
      maxSize: TOURNAMENT_REQUEST_BODY_LIMIT_BYTES,
      onError: (c) =>
        c.json(
          {
            error: "payload_too_large",
            message: "Request body is too large.",
            details: {
              maxBytes: TOURNAMENT_REQUEST_BODY_LIMIT_BYTES,
            },
          },
          413,
        ),
    }),
  );

  routes.post("/", async (c) => {
    enforceRateLimit(c, rateLimiter, "createTournament", rateLimitPolicies.createTournament);

    const request = parseCreateTournamentRequest(await readJson(c));
    const tournament = await service.createTournament(request);

    return c.json({ tournament: serializeTournament(tournament) }, 201);
  });

  routes.get("/:roomCode", async (c) => {
    enforceRateLimit(c, rateLimiter, "lookupTournament", rateLimitPolicies.lookupTournament);

    const roomCode = parseRoomCodeParam(c.req.param("roomCode"));
    const tournament = await service.getTournament(roomCode);

    return c.json({ tournament: serializeTournament(tournament) });
  });

  routes.post("/:roomCode/matches/:matchId/result", async (c) => {
    enforceRateLimit(c, rateLimiter, "writeTournament", rateLimitPolicies.writeTournament);

    const roomCode = parseRoomCodeParam(c.req.param("roomCode"));
    const matchId = parseMatchIdParam(c.req.param("matchId"));
    const request = parseUpsertMatchResultRequest(await readJson(c));
    const tournament = await service.upsertMatchResult(roomCode, matchId, request);
    const serializedTournament = serializeTournament(tournament);

    eventHub.publish(tournament.roomCode, {
      type: "tournament_updated",
      data: { tournament: serializedTournament },
    });

    return c.json({ tournament: serializedTournament });
  });

  routes.delete("/:roomCode/matches/:matchId/result", async (c) => {
    enforceRateLimit(c, rateLimiter, "writeTournament", rateLimitPolicies.writeTournament);

    const roomCode = parseRoomCodeParam(c.req.param("roomCode"));
    const matchId = parseMatchIdParam(c.req.param("matchId"));
    const request = parseDeleteMatchResultRequest(await readJson(c));
    const tournament = await service.deleteMatchResult(roomCode, matchId, request);
    const serializedTournament = serializeTournament(tournament);

    eventHub.publish(tournament.roomCode, {
      type: "tournament_updated",
      data: { tournament: serializedTournament },
    });

    return c.json({ tournament: serializedTournament });
  });

  routes.post("/:roomCode/finish", async (c) => {
    enforceRateLimit(c, rateLimiter, "writeTournament", rateLimitPolicies.writeTournament);

    const roomCode = parseRoomCodeParam(c.req.param("roomCode"));
    const request = parseFinishTournamentRequest(await readJson(c));
    const tournament = await service.finishTournament(roomCode, request);
    const serializedTournament = serializeTournament(tournament);

    eventHub.publish(tournament.roomCode, {
      type: "tournament_updated",
      data: { tournament: serializedTournament },
    });

    return c.json({ tournament: serializedTournament });
  });

  routes.post("/:roomCode/play-again", async (c) => {
    enforceRateLimit(c, rateLimiter, "createTournament", rateLimitPolicies.createTournament);

    const roomCode = parseRoomCodeParam(c.req.param("roomCode"));
    const tournament = await service.playAgain(roomCode);

    return c.json({ tournament: serializeTournament(tournament) }, 201);
  });

  routes.get("/:roomCode/events", async (c) => {
    enforceRateLimit(c, rateLimiter, "lookupTournament", rateLimitPolicies.lookupTournament);

    const roomCode = parseRoomCodeParam(c.req.param("roomCode"));
    const events = await service.listEvents(roomCode);

    return c.json({ events: events.map(serializeTournamentLog) });
  });

  routes.get("/:roomCode/stream", async (c) => {
    enforceRateLimit(c, rateLimiter, "openTournamentStream", rateLimitPolicies.openTournamentStream);
    const roomCode = parseRoomCodeParam(c.req.param("roomCode"));
    const streamLease = acquireActiveStream(c, rateLimiter, rateLimitPolicies);
    let tournament;

    try {
      tournament = await service.getTournament(roomCode);
    } catch (error) {
      streamLease.release();
      throw error;
    }

    const encoder = new TextEncoder();
    let cleanup = () => {};

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: string, data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`event: ${event}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };
        const keepAlive = setInterval(() => {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        }, 30000);
        const unsubscribe = eventHub.subscribe(roomCode, (event) => {
          send(event.type, event.data);
        });
        cleanup = () => {
          clearInterval(keepAlive);
          unsubscribe();
          streamLease.release();
        };

        c.req.raw.signal.addEventListener("abort", cleanup, { once: true });
        send("connected", { tournament: serializeTournament(tournament) });
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  });

  return routes;
}

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw badRequest("invalid_json", "Request body must be valid JSON.");
  }
}

function enforceRateLimit(
  c: Context,
  rateLimiter: RateLimiter,
  scope: keyof Omit<RateLimitPolicies, "activeTournamentStreams">,
  policy: RateLimitPolicy,
): void {
  const result = rateLimiter.check(scope, clientKey(c), policy);

  if (result.allowed) {
    return;
  }

  throw rateLimitError(scope, result);
}

function acquireActiveStream(
  c: Context,
  rateLimiter: RateLimiter,
  policies: RateLimitPolicies,
): RateLimitLease {
  const lease = rateLimiter.acquire(
    "activeTournamentStreams",
    clientKey(c),
    policies.activeTournamentStreams,
  );

  if (lease) {
    return lease;
  }

  throw tooManyRequests(
    "rate_limited",
    "Too many open tournament streams. Close an existing stream and try again.",
    {
      limit: policies.activeTournamentStreams.max,
    },
  );
}

function rateLimitError(
  scope: keyof Omit<RateLimitPolicies, "activeTournamentStreams">,
  result: RateLimitResult,
) {
  return tooManyRequests(
    "rate_limited",
    rateLimitMessage(scope),
    {
      limit: result.limit,
      remaining: result.remaining,
      retryAfterSeconds: result.retryAfterSeconds,
      resetAt: new Date(result.resetAt).toISOString(),
      windowSeconds: Math.ceil(result.windowMs / 1000),
    },
    {
      "retry-after": String(result.retryAfterSeconds),
    },
  );
}

function rateLimitMessage(scope: keyof Omit<RateLimitPolicies, "activeTournamentStreams">): string {
  switch (scope) {
    case "createTournament":
      return "Too many tournament creation requests. Try again later.";
    case "lookupTournament":
      return "Too many room lookup requests. Try again later.";
    case "writeTournament":
      return "Too many tournament update requests. Try again later.";
    case "openTournamentStream":
      return "Too many tournament stream connection attempts. Try again later.";
  }
}

function clientKey(c: Context): string {
  const candidate =
    firstHeaderValue(c.req.header("cf-connecting-ip")) ??
    firstHeaderValue(c.req.header("x-real-ip")) ??
    firstHeaderValue(c.req.header("x-forwarded-for")) ??
    firstHeaderValue(remoteAddress(c));

  return candidate ?? "unknown";
}

function remoteAddress(c: Context): string | undefined {
  try {
    return getConnInfo(c).remote.address;
  } catch {
    return undefined;
  }
}

function firstHeaderValue(value: string | undefined): string | undefined {
  const first = value?.split(",")[0]?.trim();

  if (!first) {
    return undefined;
  }

  return first.slice(0, 128);
}
