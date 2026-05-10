import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createTestApp } from "../test/create-test-app.js";
import { TOURNAMENT_REQUEST_BODY_LIMIT_BYTES } from "./tournaments.js";

describe("tournament routes", () => {
  it("creates and reads an Americano tournament", async () => {
    const { app } = createTestApp({ roomCodes: ["abc123"] });

    const createResponse = await app.request("/api/tournaments", {
      method: "POST",
      body: JSON.stringify(createRequest()),
      headers: { "content-type": "application/json" },
    });
    const created = await readJsonObject(createResponse);
    const tournament = requireObject(created.tournament);
    const config = requireObject(tournament.config);
    const state = requireObject(tournament.state);
    const rounds = requireArray(state.rounds);

    assert.equal(createResponse.status, 201);
    assert.equal(tournament.roomCode, "ABC123");
    assert.equal(config.date, "2026-05-09");
    assert.equal(tournament.stateVersion, 1);
    assert.equal(tournament.status, "active");
    assert.equal(rounds.length, 2);

    const getResponse = await app.request("/api/tournaments/abc123");
    const found = await readJsonObject(getResponse);
    const foundTournament = requireObject(found.tournament);

    assert.equal(getResponse.status, 200);
    assert.equal(foundTournament.roomCode, "ABC123");
  });

  it("validates create tournament payloads", async () => {
    const { app } = createTestApp();
    const response = await app.request("/api/tournaments", {
      method: "POST",
      body: JSON.stringify({ ...createRequest(), players: ["Alex", "Bianca", "Chris"] }),
      headers: { "content-type": "application/json" },
    });
    const body = await readJsonObject(response);

    assert.equal(response.status, 400);
    assert.equal(body.error, "validation_error");
  });

  it("rejects more courts than complete groups of four players", async () => {
    const { app } = createTestApp();
    const response = await app.request("/api/tournaments", {
      method: "POST",
      body: JSON.stringify(createRequest({ courtCount: 2 })),
      headers: { "content-type": "application/json" },
    });
    const body = await readJsonObject(response);
    const details = requireObject(body.details);

    assert.equal(response.status, 400);
    assert.equal(body.error, "validation_error");
    assert.equal(body.message, "With 4 players, at most 1 court is available.");
    assert.equal(details.field, "courtCount");
    assert.equal(details.max, 1);
    assert.equal(details.playerCount, 4);
  });

  it("validates create tournament dates", async () => {
    const { app } = createTestApp();
    const response = await app.request("/api/tournaments", {
      method: "POST",
      body: JSON.stringify({ ...createRequest(), date: "2026-02-31" }),
      headers: { "content-type": "application/json" },
    });
    const body = await readJsonObject(response);

    assert.equal(response.status, 400);
    assert.equal(body.error, "validation_error");
  });

  it("rejects invalid room codes before lookup", async () => {
    const { app } = createTestApp();
    const response = await app.request("/api/tournaments/ABC_123");
    const body = await readJsonObject(response);

    assert.equal(response.status, 400);
    assert.equal(body.error, "invalid_room_code");
  });

  it("rejects invalid match IDs before score writes", async () => {
    const { app } = createTestApp({ roomCodes: ["ROOM42"] });
    await createTournament(app);

    const response = await app.request("/api/tournaments/ROOM42/matches/match-1/result", {
      method: "POST",
      body: JSON.stringify({
        sideAScore: 13,
        sideBScore: 8,
        expectedStateVersion: 1,
      }),
      headers: { "content-type": "application/json" },
    });
    const body = await readJsonObject(response);

    assert.equal(response.status, 400);
    assert.equal(body.error, "invalid_match_id");
  });

  it("rejects oversized JSON bodies before validation", async () => {
    const { app } = createTestApp();
    const response = await app.request("/api/tournaments", {
      method: "POST",
      body: JSON.stringify({ padding: "x".repeat(TOURNAMENT_REQUEST_BODY_LIMIT_BYTES) }),
      headers: { "content-type": "application/json" },
    });
    const body = await readJsonObject(response);
    const details = requireObject(body.details);

    assert.equal(response.status, 413);
    assert.equal(body.error, "payload_too_large");
    assert.equal(details.maxBytes, TOURNAMENT_REQUEST_BODY_LIMIT_BYTES);
  });

  it("rate limits tournament creation by client", async () => {
    const { app } = createTestApp({
      roomCodes: ["CREATE234567", "CREATE345678"],
      rateLimitPolicies: {
        createTournament: { max: 1, windowMs: 60_000 },
      },
    });
    const headers = {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    };

    const firstResponse = await app.request("/api/tournaments", {
      method: "POST",
      body: JSON.stringify(createRequest()),
      headers,
    });
    const secondResponse = await app.request("/api/tournaments", {
      method: "POST",
      body: JSON.stringify(createRequest()),
      headers,
    });
    const body = await readJsonObject(secondResponse);

    assert.equal(firstResponse.status, 201);
    assert.equal(secondResponse.status, 429);
    assert.equal(body.error, "rate_limited");
    assert.equal(secondResponse.headers.get("retry-after"), "60");
  });

  it("rate limits room lookups by client", async () => {
    const { app } = createTestApp({
      roomCodes: ["LOOKUP234567"],
      rateLimitPolicies: {
        lookupTournament: { max: 1, windowMs: 60_000 },
      },
    });
    await createTournament(app);

    const headers = { "x-forwarded-for": "203.0.113.11" };
    const firstResponse = await app.request("/api/tournaments/lookup234567", { headers });
    const secondResponse = await app.request("/api/tournaments/lookup234567", { headers });
    const body = await readJsonObject(secondResponse);

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 429);
    assert.equal(body.error, "rate_limited");
  });

  it("rate limits score writes by client", async () => {
    const { app } = createTestApp({
      roomCodes: ["WRITE234567"],
      rateLimitPolicies: {
        writeTournament: { max: 1, windowMs: 60_000 },
      },
    });
    await createTournament(app);

    const headers = {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.12",
    };
    const firstResponse = await app.request("/api/tournaments/WRITE234567/matches/r1m1/result", {
      method: "POST",
      body: JSON.stringify({
        sideAScore: 13,
        sideBScore: 8,
        expectedStateVersion: 1,
      }),
      headers,
    });
    const secondResponse = await app.request("/api/tournaments/WRITE234567/matches/r1m1/result", {
      method: "POST",
      body: JSON.stringify({
        sideAScore: 8,
        sideBScore: 13,
        expectedStateVersion: 2,
      }),
      headers,
    });
    const body = await readJsonObject(secondResponse);

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 429);
    assert.equal(body.error, "rate_limited");
  });

  it("upserts a match result, derives the winner, and writes events", async () => {
    const { app } = createTestApp({ roomCodes: ["ROOM42"] });
    await createTournament(app);

    const response = await app.request("/api/tournaments/room42/matches/r1m1/result", {
      method: "POST",
      body: JSON.stringify({
        sideAScore: 13,
        sideBScore: 8,
        expectedStateVersion: 1,
      }),
      headers: { "content-type": "application/json" },
    });
    const body = await readJsonObject(response);
    const tournament = requireObject(body.tournament);
    const state = requireObject(tournament.state);
    const rounds = requireArray(state.rounds);
    const firstRound = requireObject(rounds[0]);
    const matches = requireArray(firstRound.matches);
    const firstMatch = requireObject(matches[0]);
    const result = requireObject(firstMatch.result);
    const leaderboard = requireArray(state.leaderboard);
    const firstEntry = requireObject(leaderboard[0]);

    assert.equal(response.status, 200);
    assert.equal(tournament.stateVersion, 2);
    assert.equal(result.winningSide, "A");
    assert.equal(result.sideAScore, 13);
    assert.equal(result.sideBScore, 8);
    assert.equal(firstEntry.wins, 1);
    assert.equal(firstEntry.pointsFor, 13);

    const eventsResponse = await app.request("/api/tournaments/ROOM42/events");
    const eventsBody = await readJsonObject(eventsResponse);
    const events = requireArray(eventsBody.events);

    assert.equal(eventsResponse.status, 200);
    assert.equal(events.length, 2);
    assert.equal(requireObject(events[0]).type, "tournament_created");
    assert.equal(requireObject(events[1]).type, "match_result_upserted");
  });

  it("rejects match scores that do not add up to the target score", async () => {
    const { app } = createTestApp({ roomCodes: ["ROOM42"] });
    await createTournament(app, { targetScore: 24 });

    const response = await app.request("/api/tournaments/room42/matches/r1m1/result", {
      method: "POST",
      body: JSON.stringify({
        sideAScore: 24,
        sideBScore: 15,
        expectedStateVersion: 1,
      }),
      headers: { "content-type": "application/json" },
    });
    const body = await readJsonObject(response);

    assert.equal(response.status, 400);
    assert.equal(body.error, "validation_error");
  });

  it("allows tied match scores", async () => {
    const { app } = createTestApp({ roomCodes: ["ROOM42"] });
    await createTournament(app, { targetScore: 24 });

    const response = await app.request("/api/tournaments/room42/matches/r1m1/result", {
      method: "POST",
      body: JSON.stringify({
        sideAScore: 12,
        sideBScore: 12,
        expectedStateVersion: 1,
      }),
      headers: { "content-type": "application/json" },
    });
    const tournament = requireObject((await readJsonObject(response)).tournament);
    const state = requireObject(tournament.state);
    const firstRound = requireObject(requireArray(state.rounds)[0]);
    const firstMatch = requireObject(requireArray(firstRound.matches)[0]);
    const result = requireObject(firstMatch.result);
    const firstEntry = requireObject(requireArray(state.leaderboard)[0]);

    assert.equal(response.status, 200);
    assert.equal(result.winningSide, null);
    assert.equal(result.sideAScore, 12);
    assert.equal(result.sideBScore, 12);
    assert.equal(firstEntry.wins, 0);
    assert.equal(firstEntry.ties, 1);
  });

  it("rejects result updates for future rounds", async () => {
    const { app } = createTestApp({ roomCodes: ["ROOM42"] });
    await createTournament(app);

    const response = await app.request("/api/tournaments/ROOM42/matches/r2m1/result", {
      method: "POST",
      body: JSON.stringify({
        sideAScore: 13,
        sideBScore: 8,
        expectedStateVersion: 1,
      }),
      headers: { "content-type": "application/json" },
    });
    const body = await readJsonObject(response);

    assert.equal(response.status, 409);
    assert.equal(body.error, "cannot_edit_result_outside_current_round");
  });

  it("rejects stale result updates", async () => {
    const { app } = createTestApp({ roomCodes: ["ROOM42"] });
    await createTournament(app);
    await upsertFirstResult(app, 1);

    const response = await app.request("/api/tournaments/ROOM42/matches/r1m1/result", {
      method: "POST",
      body: JSON.stringify({
        sideAScore: 8,
        sideBScore: 13,
        expectedStateVersion: 1,
      }),
      headers: { "content-type": "application/json" },
    });
    const body = await readJsonObject(response);

    assert.equal(response.status, 409);
    assert.equal(body.error, "state_version_conflict");
  });

  it("clears a current-round result", async () => {
    const { app } = createTestApp({ roomCodes: ["ROOM42"] });
    await createTournament(app, {
      players: ["Alex", "Bianca", "Chris", "Dana", "Eli", "Fatima", "Gabi", "Hana"],
      courtCount: 2,
    });
    await upsertFirstResult(app, 1);

    const response = await app.request("/api/tournaments/ROOM42/matches/r1m1/result", {
      method: "DELETE",
      body: JSON.stringify({ expectedStateVersion: 2 }),
      headers: { "content-type": "application/json" },
    });
    const body = await readJsonObject(response);
    const tournament = requireObject(body.tournament);
    const state = requireObject(tournament.state);
    const firstRound = requireObject(requireArray(state.rounds)[0]);
    const firstMatch = requireObject(requireArray(firstRound.matches)[0]);

    assert.equal(response.status, 200);
    assert.equal(tournament.stateVersion, 3);
    assert.equal(firstMatch.result, null);
  });

  it("finishes a tournament and blocks later edits", async () => {
    const { app } = createTestApp({ roomCodes: ["ROOM42"] });
    await createTournament(app);

    const finishResponse = await app.request("/api/tournaments/ROOM42/finish", {
      method: "POST",
      body: JSON.stringify({ expectedStateVersion: 1 }),
      headers: { "content-type": "application/json" },
    });
    const finished = requireObject((await readJsonObject(finishResponse)).tournament);

    assert.equal(finishResponse.status, 200);
    assert.equal(finished.status, "finished");

    const editResponse = await app.request("/api/tournaments/ROOM42/matches/r1m1/result", {
      method: "POST",
      body: JSON.stringify({
        sideAScore: 13,
        sideBScore: 8,
        expectedStateVersion: 2,
      }),
      headers: { "content-type": "application/json" },
    });

    assert.equal(editResponse.status, 409);
  });

  it("rejects stale finish requests", async () => {
    const { app } = createTestApp({ roomCodes: ["ROOM42"] });
    await createTournament(app);
    await upsertFirstResult(app, 1);

    const response = await app.request("/api/tournaments/ROOM42/finish", {
      method: "POST",
      body: JSON.stringify({ expectedStateVersion: 1 }),
      headers: { "content-type": "application/json" },
    });
    const body = await readJsonObject(response);

    assert.equal(response.status, 409);
    assert.equal(body.error, "state_version_conflict");
  });

  it("creates a play-again tournament from a finished tournament", async () => {
    const { app } = createTestApp({ roomCodes: ["OLD123", "NEW123"] });
    await createTournament(app);
    await app.request("/api/tournaments/OLD123/finish", {
      method: "POST",
      body: JSON.stringify({ expectedStateVersion: 1 }),
      headers: { "content-type": "application/json" },
    });

    const response = await app.request("/api/tournaments/OLD123/play-again", {
      method: "POST",
    });
    const tournament = requireObject((await readJsonObject(response)).tournament);

    assert.equal(response.status, 201);
    assert.equal(tournament.roomCode, "NEW123");
    assert.equal(tournament.status, "active");
  });

  it("generates the next Mexicano round after the current round is complete", async () => {
    const { app } = createTestApp({ roomCodes: ["MEX123"] });
    await createTournament(app, {
      mode: "mexicano",
      players: ["A", "B", "C", "D"],
      roundCount: { type: "fixed", value: 2 },
    });

    const response = await app.request("/api/tournaments/MEX123/matches/r1m1/result", {
      method: "POST",
      body: JSON.stringify({
        sideAScore: 13,
        sideBScore: 8,
        expectedStateVersion: 1,
      }),
      headers: { "content-type": "application/json" },
    });
    const tournament = requireObject((await readJsonObject(response)).tournament);
    const state = requireObject(tournament.state);
    const rounds = requireArray(state.rounds);

    assert.equal(response.status, 200);
    assert.equal(rounds.length, 2);
    assert.equal(state.currentRoundIndex, 1);
    assert.equal(requireObject(rounds[1]).status, "active");
  });

  it("generates the next Americano round for infinite tournaments", async () => {
    const { app } = createTestApp({ roomCodes: ["INF123"] });
    await createTournament(app, {
      mode: "americano",
      players: ["A", "B", "C", "D"],
      roundCount: { type: "infinite" },
    });

    const response = await app.request("/api/tournaments/INF123/matches/r1m1/result", {
      method: "POST",
      body: JSON.stringify({
        sideAScore: 13,
        sideBScore: 8,
        expectedStateVersion: 1,
      }),
      headers: { "content-type": "application/json" },
    });
    const tournament = requireObject((await readJsonObject(response)).tournament);
    const state = requireObject(tournament.state);
    const rounds = requireArray(state.rounds);

    assert.equal(response.status, 200);
    assert.equal(rounds.length, 2);
    assert.equal(state.currentRoundIndex, 1);
    assert.equal(requireObject(rounds[1]).status, "active");
  });

  it("allows editing the last completed Mexicano round after advancement", async () => {
    const { app } = createTestApp({ roomCodes: ["MEX123"] });
    await createTournament(app, {
      mode: "mexicano",
      players: ["A", "B", "C", "D"],
      roundCount: { type: "fixed", value: 2 },
    });

    const firstResultResponse = await app.request("/api/tournaments/MEX123/matches/r1m1/result", {
      method: "POST",
      body: JSON.stringify({
        sideAScore: 13,
        sideBScore: 8,
        expectedStateVersion: 1,
      }),
      headers: { "content-type": "application/json" },
    });
    assert.equal(firstResultResponse.status, 200);

    const editResponse = await app.request("/api/tournaments/MEX123/matches/r1m1/result", {
      method: "POST",
      body: JSON.stringify({
        sideAScore: 8,
        sideBScore: 13,
        expectedStateVersion: 2,
      }),
      headers: { "content-type": "application/json" },
    });
    const tournament = requireObject((await readJsonObject(editResponse)).tournament);
    const state = requireObject(tournament.state);
    const firstRound = requireObject(requireArray(state.rounds)[0]);
    const firstMatch = requireObject(requireArray(firstRound.matches)[0]);
    const result = requireObject(firstMatch.result);

    assert.equal(editResponse.status, 200);
    assert.equal(tournament.stateVersion, 3);
    assert.equal(state.currentRoundIndex, 1);
    assert.equal(result.winningSide, "B");
    assert.equal(result.sideAScore, 8);
    assert.equal(result.sideBScore, 13);
  });

  it("blocks editing rounds older than the last completed round", async () => {
    const { app } = createTestApp({ roomCodes: ["MEX123"] });
    await createTournament(app, {
      mode: "mexicano",
      players: ["A", "B", "C", "D"],
      roundCount: { type: "fixed", value: 3 },
    });

    const firstResultResponse = await app.request("/api/tournaments/MEX123/matches/r1m1/result", {
      method: "POST",
      body: JSON.stringify({
        sideAScore: 13,
        sideBScore: 8,
        expectedStateVersion: 1,
      }),
      headers: { "content-type": "application/json" },
    });
    assert.equal(firstResultResponse.status, 200);

    const secondResultResponse = await app.request("/api/tournaments/MEX123/matches/r2m1/result", {
      method: "POST",
      body: JSON.stringify({
        sideAScore: 13,
        sideBScore: 8,
        expectedStateVersion: 2,
      }),
      headers: { "content-type": "application/json" },
    });
    assert.equal(secondResultResponse.status, 200);

    const editResponse = await app.request("/api/tournaments/MEX123/matches/r1m1/result", {
      method: "POST",
      body: JSON.stringify({
        sideAScore: 8,
        sideBScore: 13,
        expectedStateVersion: 3,
      }),
      headers: { "content-type": "application/json" },
    });
    const body = await readJsonObject(editResponse);

    assert.equal(editResponse.status, 409);
    assert.equal(body.error, "cannot_edit_result_outside_current_round");
  });

  it("opens an SSE stream with the current tournament snapshot", async () => {
    const { app } = createTestApp({ roomCodes: ["ROOM42"] });
    await createTournament(app);

    const response = await app.request("/api/tournaments/ROOM42/stream");
    const reader = response.body?.getReader();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
    assert.ok(reader);

    const chunk = await reader.read();
    const text = new TextDecoder().decode(chunk.value);
    await reader.cancel();

    assert.match(text, /event: connected/);
  });

  it("emits an SSE tournament_updated event after a score change", async () => {
    const { app } = createTestApp({ roomCodes: ["ROOM42"] });
    await createTournament(app);

    const response = await app.request("/api/tournaments/ROOM42/stream");
    const reader = response.body?.getReader();

    assert.equal(response.status, 200);
    assert.ok(reader);

    const connected = await readStreamText(reader);
    assert.match(connected, /event: connected/);

    const updatePromise = readStreamText(reader);
    const resultResponse = await app.request("/api/tournaments/ROOM42/matches/r1m1/result", {
      method: "POST",
      body: JSON.stringify({
        sideAScore: 13,
        sideBScore: 8,
        expectedStateVersion: 1,
      }),
      headers: { "content-type": "application/json" },
    });
    const update = await updatePromise;
    await reader.cancel();

    assert.equal(resultResponse.status, 200);
    assert.match(update, /event: tournament_updated/);
    assert.match(update, /"stateVersion":2/);
  });

  it("rate limits active SSE streams by client", async () => {
    const { app } = createTestApp({
      roomCodes: ["STREAM234567"],
      rateLimitPolicies: {
        activeTournamentStreams: { max: 1 },
      },
    });
    await createTournament(app);

    const headers = { "x-forwarded-for": "203.0.113.13" };
    const firstResponse = await app.request("/api/tournaments/STREAM234567/stream", { headers });
    const firstReader = firstResponse.body?.getReader();

    assert.equal(firstResponse.status, 200);
    assert.ok(firstReader);

    const secondResponse = await app.request("/api/tournaments/STREAM234567/stream", { headers });
    const body = await readJsonObject(secondResponse);

    assert.equal(secondResponse.status, 429);
    assert.equal(body.error, "rate_limited");

    await firstReader.cancel();

    const thirdResponse = await app.request("/api/tournaments/STREAM234567/stream", { headers });
    const thirdReader = thirdResponse.body?.getReader();

    assert.equal(thirdResponse.status, 200);
    assert.ok(thirdReader);

    await thirdReader.cancel();
  });

  it("rate limits SSE connection attempts by client", async () => {
    const { app } = createTestApp({
      roomCodes: ["STREAM345678"],
      rateLimitPolicies: {
        openTournamentStream: { max: 1, windowMs: 60_000 },
      },
    });
    await createTournament(app);

    const headers = { "x-forwarded-for": "203.0.113.14" };
    const firstResponse = await app.request("/api/tournaments/STREAM345678/stream", { headers });
    const firstReader = firstResponse.body?.getReader();

    assert.equal(firstResponse.status, 200);
    assert.ok(firstReader);
    await firstReader.cancel();

    const secondResponse = await app.request("/api/tournaments/STREAM345678/stream", { headers });
    const body = await readJsonObject(secondResponse);

    assert.equal(secondResponse.status, 429);
    assert.equal(body.error, "rate_limited");
  });
});

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    name: "Thursday Padel",
    date: "2026-05-09",
    mode: "americano",
    players: ["Alex", "Bianca", "Chris", "Dana"],
    courtCount: 1,
    roundCount: { type: "fixed", value: 2 },
    targetScore: 21,
    ...overrides,
  };
}

type TestApp = {
  request: (path: string, init?: RequestInit) => Response | Promise<Response>;
};

async function createTournament(app: TestApp, overrides: Record<string, unknown> = {}) {
  const response = await app.request("/api/tournaments", {
    method: "POST",
    body: JSON.stringify(createRequest(overrides)),
    headers: { "content-type": "application/json" },
  });

  assert.equal(response.status, 201);
}

async function upsertFirstResult(app: TestApp, expectedStateVersion: number) {
  const response = await app.request("/api/tournaments/ROOM42/matches/r1m1/result", {
    method: "POST",
    body: JSON.stringify({
      sideAScore: 13,
      sideBScore: 8,
      expectedStateVersion,
    }),
    headers: { "content-type": "application/json" },
  });

  assert.equal(response.status, 200);
}

async function readJsonObject(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json();

  return requireObject(body);
}

function requireObject(value: unknown): Record<string, unknown> {
  assert.ok(value !== null);
  assert.equal(typeof value, "object");
  assert.ok(!Array.isArray(value));

  return value as Record<string, unknown>;
}

function requireArray(value: unknown): unknown[] {
  assert.ok(Array.isArray(value));

  return value;
}

async function readStreamText(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let text = "";

  while (!text.includes("\n\n")) {
    const chunk = await reader.read();

    assert.equal(chunk.done, false);
    assert.ok(chunk.value);

    text += decoder.decode(chunk.value, { stream: true });
  }

  return text;
}
