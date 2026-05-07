import type { Context } from "hono";
import { Hono } from "hono";

import { badRequest } from "../domain/errors.js";
import { normalizeRoomCode } from "../services/room-code.js";
import { serializeTournament, serializeTournamentLog } from "../services/serializers.js";
import type { EventHub } from "../services/event-hub.js";
import type { TournamentService } from "../services/tournament-service.js";
import {
  parseCreateTournamentRequest,
  parseDeleteMatchResultRequest,
  parseUpsertMatchResultRequest,
} from "../validation/tournaments.js";

export type TournamentRouteDependencies = {
  service: TournamentService;
  eventHub: EventHub;
};

export function createTournamentRoutes({ service, eventHub }: TournamentRouteDependencies): Hono {
  const routes = new Hono();

  routes.post("/", async (c) => {
    const request = parseCreateTournamentRequest(await readJson(c));
    const tournament = await service.createTournament(request);

    return c.json({ tournament: serializeTournament(tournament) }, 201);
  });

  routes.get("/:roomCode", async (c) => {
    const tournament = await service.getTournament(c.req.param("roomCode"));

    return c.json({ tournament: serializeTournament(tournament) });
  });

  routes.post("/:roomCode/matches/:matchId/result", async (c) => {
    const roomCode = c.req.param("roomCode");
    const request = parseUpsertMatchResultRequest(await readJson(c));
    const tournament = await service.upsertMatchResult(roomCode, c.req.param("matchId"), request);
    const serializedTournament = serializeTournament(tournament);

    eventHub.publish(tournament.roomCode, {
      type: "tournament_updated",
      data: { tournament: serializedTournament },
    });

    return c.json({ tournament: serializedTournament });
  });

  routes.delete("/:roomCode/matches/:matchId/result", async (c) => {
    const roomCode = c.req.param("roomCode");
    const request = parseDeleteMatchResultRequest(await readJson(c));
    const tournament = await service.deleteMatchResult(roomCode, c.req.param("matchId"), request);
    const serializedTournament = serializeTournament(tournament);

    eventHub.publish(tournament.roomCode, {
      type: "tournament_updated",
      data: { tournament: serializedTournament },
    });

    return c.json({ tournament: serializedTournament });
  });

  routes.post("/:roomCode/finish", async (c) => {
    const tournament = await service.finishTournament(c.req.param("roomCode"));
    const serializedTournament = serializeTournament(tournament);

    eventHub.publish(tournament.roomCode, {
      type: "tournament_updated",
      data: { tournament: serializedTournament },
    });

    return c.json({ tournament: serializedTournament });
  });

  routes.post("/:roomCode/play-again", async (c) => {
    const tournament = await service.playAgain(c.req.param("roomCode"));

    return c.json({ tournament: serializeTournament(tournament) }, 201);
  });

  routes.get("/:roomCode/events", async (c) => {
    const events = await service.listEvents(c.req.param("roomCode"));

    return c.json({ events: events.map(serializeTournamentLog) });
  });

  routes.get("/:roomCode/stream", async (c) => {
    const roomCode = normalizeRoomCode(c.req.param("roomCode"));
    const tournament = await service.getTournament(roomCode);
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
