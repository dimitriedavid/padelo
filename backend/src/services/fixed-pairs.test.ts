import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createTestApp } from "../test/create-test-app.js";
import type { CreateTournamentRequest, TournamentConfig, TournamentMode, TournamentRound, TournamentState } from "../types/tournament.js";
import { parseCreateTournamentRequest } from "../validation/tournaments.js";
import { createInitialTournamentState, maybeAppendNextRound, normalizeTournamentState } from "./scheduler.js";

function request(teamCount = 4, mode: TournamentMode = "americano"): CreateTournamentRequest {
  return {
    name: "Fixed pairs",
    date: "2026-09-06",
    mode,
    format: "fixed-pairs",
    players: Array.from({ length: teamCount * 2 }, (_, index) => `Player ${index + 1}`),
    teams: Array.from({ length: teamCount }, (_, index) => [index * 2, index * 2 + 1]),
    courtCount: Math.floor(teamCount / 2),
    roundCount: { type: "fixed", value: 12 },
    targetScore: 21,
  };
}

function config(teamCount: number, mode: TournamentMode, courtCount: number): TournamentConfig {
  const input = request(teamCount, mode);
  return {
    ...input,
    scheduleSeed: "fixed-pair-seed",
    courtCount,
    players: input.players.map((name, index) => ({ id: `p${index + 1}`, name })),
    teams: input.teams!.map(([a, b], index) => ({
      id: `team${index + 1}`,
      playerIds: [`p${a + 1}`, `p${b + 1}`],
    })),
  };
}

function complete(round: TournamentRound): void {
  for (const match of round.matches) {
    match.result = {
      sideAScore: 15,
      sideBScore: 6,
      winningSide: "A",
      enteredAt: "2026-09-06T12:00:00.000Z",
    };
  }
}

function assertPairs(state: TournamentState): void {
  const pairs = new Set(state.teams!.map((team) => team.playerIds.join("|")));
  for (const round of state.rounds) {
    const playing = round.matches.flatMap((match) => {
      assert.ok(pairs.has(match.sideA.join("|")));
      assert.ok(pairs.has(match.sideB.join("|")));
      return [...match.sideA, ...match.sideB];
    });
    assert.equal(new Set(playing).size, playing.length);
    assert.deepEqual([...playing, ...round.sittingOut].sort(), state.players.map((p) => p.id).sort());
    for (const team of state.teams!) {
      assert.equal(round.sittingOut.includes(team.playerIds[0]), round.sittingOut.includes(team.playerIds[1]));
    }
  }
}

describe("fixed-pair validation", () => {
  it("defaults old requests to rotating, with no teams", () => {
    const { format: _format, teams: _teams, ...old } = request();
    const parsed = parseCreateTournamentRequest(old);
    assert.equal(parsed.format, "rotating");
    assert.ok(!("teams" in parsed));
  });

  it("accepts non-adjacent explicit memberships and duplicate-free complete coverage", () => {
    const input = { ...request(2), teams: [[3, 0], [1, 2]] };
    assert.deepEqual(parseCreateTournamentRequest(input).teams, input.teams);
  });

  for (const [label, changes] of Object.entries({
    "unknown format": { format: "doubles" },
    "null format": { format: null },
    "missing teams": { teams: undefined },
    "null teams": { teams: null },
    "empty teams": { teams: [] },
    "incomplete coverage": { teams: [[0, 1]] },
    "duplicate member": { teams: [[0, 1], [1, 2]] },
    "same member twice": { teams: [[0, 0], [2, 3]] },
    "negative index": { teams: [[-1, 1], [2, 3]] },
    "out of range": { teams: [[0, 4], [2, 3]] },
    "fractional index": { teams: [[0, 1.5], [2, 3]] },
    "string index": { teams: [[0, "1"], [2, 3]] },
    "short tuple": { teams: [[0], [2, 3]] },
    "long tuple": { teams: [[0, 1, 2], [2, 3]] },
    "object team": { teams: [{ playerIds: [0, 1] }, [2, 3]] },
    "odd players": { players: ["A", "B", "C", "D", "E"] },
    "too few players": { players: ["A", "B"] },
    "rotating with teams": { format: "rotating" },
    "legacy with teams": { format: undefined },
    "rotating empty teams": { format: "rotating", teams: [] },
  })) {
    it(`rejects ${label} via the API`, async () => {
      const { app } = createTestApp();
      const response = await app.request("/api/tournaments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...request(2), ...changes }),
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json() as { error: string }).error, "validation_error");
    });
  }

  it("also rejects invalid direct-service memberships", async () => {
    const { service } = createTestApp();
    await assert.rejects(service.createTournament({ ...request(2), teams: [[0, 1], [1, 2]] }));
    await assert.rejects(service.createTournament({ ...request(2), format: "rotating" }));
  });
});

describe("fixed-pair scheduling", () => {
  for (const mode of ["americano", "mexicano"] as const) {
    for (const infinite of [false, true]) {
      it(`${mode} ${infinite ? "infinite" : "finite"} never splits pairs and respects round limits`, () => {
        const input = config(5, mode, 2);
        input.roundCount = infinite ? { type: "infinite" } : { type: "fixed", value: 12 };
        let state = createInitialTournamentState(input);
        assert.equal(state.rounds.length, mode === "americano" && !infinite ? 12 : 1);
        for (let index = 0; index < 12; index += 1) {
          assert.equal(state.currentRoundIndex, index);
          assert.deepEqual(maybeAppendNextRound(input, state), state);
          complete(state.rounds[index]!);
          state = maybeAppendNextRound(input, state);
        }
        assert.equal(state.rounds.length, infinite ? 13 : 12);
        assertPairs(state);
      });
    }

    it(`${mode} creates, reads, scores, and replays explicit teams`, async () => {
      const { app, service } = createTestApp();
      const input = { ...request(3, mode), teams: [[5, 0], [3, 1], [2, 4]] };
      const response = await app.request("/api/tournaments", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      assert.equal(response.status, 201);
      const created = await response.json() as { tournament: { roomCode: string; config: TournamentConfig; state: TournamentState } };
      const { roomCode } = created.tournament;
      assert.equal(created.tournament.config.format, "fixed-pairs");
      assert.deepEqual(created.tournament.config.teams, [
        { id: "team1", playerIds: ["p6", "p1"] },
        { id: "team2", playerIds: ["p4", "p2"] },
        { id: "team3", playerIds: ["p3", "p5"] },
      ]);
      assert.deepEqual(created.tournament.state.teams, created.tournament.config.teams);
      const read = await app.request(`/api/tournaments/${roomCode}`);
      assert.deepEqual(await read.json(), created);
      let tournament = await service.upsertMatchResult(roomCode, "r1m1", {
        expectedStateVersion: 1, sideAScore: 15, sideBScore: 6,
      });
      assert.equal(tournament.state.leaderboard.reduce((sum, row) => sum + row.pointsFor, 0), 21);
      assert.equal(tournament.state.leaderboard.reduce((sum, row) => sum + row.played, 0), 2);
      tournament = await service.finishTournament(roomCode, { expectedStateVersion: tournament.stateVersion });
      const replay = await service.playAgain(roomCode);
      assert.notEqual(replay.roomCode, roomCode);
      assert.equal(replay.config.format, "fixed-pairs");
      assert.deepEqual(replay.config.teams, tournament.config.teams);
      assert.deepEqual(replay.state.teams, tournament.state.teams);
      assert.ok(replay.state.leaderboard.every((entry) => entry.played === 0));
      assertPairs(replay.state);
    });
  }

  for (const teamCount of [2, 3, 4, 5, 6, 7, 8, 9]) {
    for (const courtCount of new Set([1, 2, Math.floor(teamCount / 2)])) {
      if (courtCount > Math.floor(teamCount / 2)) continue;
      it(`Americano covers every fixture before rematches: ${teamCount} teams, ${courtCount} courts`, () => {
        const input = config(teamCount, "americano", courtCount);
        const batches = Math.ceil(Math.floor(teamCount / 2) / courtCount);
        const cycleLength = (teamCount % 2 === 0 ? teamCount - 1 : teamCount) * batches;
        input.roundCount = { type: "fixed", value: cycleLength * 2 };
        const state = createInitialTournamentState(input);
        assertPairs(state);
        for (let cycle = 0; cycle < 2; cycle += 1) {
          const counts = new Map(input.teams!.map((team) => [team.playerIds[0], 0]));
          const fixtures = new Set<string>();
          const lastPlayed = new Map(input.teams!.map((team) => [team.playerIds[0], -1]));
          const rounds = state.rounds.slice(cycle * cycleLength, (cycle + 1) * cycleLength);
          for (const [index, round] of rounds.entries()) {
            assert.ok(round.matches.length > 0 && round.matches.length <= courtCount);
            for (const match of round.matches) {
              const ids = [match.sideA[0], match.sideB[0]];
              const key = ids.sort().join("|");
              assert.ok(!fixtures.has(key), `Repeated fixture ${key}`);
              fixtures.add(key);
              for (const id of ids) {
                counts.set(id, counts.get(id)! + 1);
                lastPlayed.set(id, index);
              }
            }
            // Whole circle rounds keep appearances within two, even with odd-team byes.
            assert.ok(Math.max(...counts.values()) - Math.min(...counts.values()) <= 2);
            assert.ok([...lastPlayed.values()].every((last) => index - last < 3 * batches));
          }
          assert.equal(fixtures.size, teamCount * (teamCount - 1) / 2);
          assert.ok([...counts.values()].every((count) => count === teamCount - 1));
        }
        const infinite = { ...input, roundCount: { type: "infinite" } as const };
        let appended = createInitialTournamentState(infinite);
        for (let index = 0; index < cycleLength * 2 - 1; index += 1) {
          complete(appended.rounds[index]!);
          appended = maybeAppendNextRound(infinite, appended);
        }
        assert.deepEqual(
          appended.rounds.map((round) => round.matches.map(({ sideA, sideB }) => [sideA, sideB])),
          state.rounds.map((round) => round.matches.map(({ sideA, sideB }) => [sideA, sideB])),
        );
      });
    }
  }

  it("matches winners from separate initial Mexicano matches when appearances are equal", () => {
    const input = config(4, "mexicano", 1);
    let state = createInitialTournamentState(input);
    const winners: [string, string][] = [];
    const initialPlayers = new Set<string>();
    for (let index = 0; index < 2; index += 1) {
      const round = state.rounds[index]!;
      const match = round.matches[0]!;
      winners.push(match.sideA);
      for (const id of [...match.sideA, ...match.sideB]) {
        assert.ok(!initialPlayers.has(id));
        initialPlayers.add(id);
      }
      complete(round);
      state = maybeAppendNextRound(input, state);
    }
    assert.equal(initialPlayers.size, 8);
    assert.ok(state.leaderboard.every((entry) => entry.played === 1));
    const next = state.rounds[2]!.matches[0]!;
    assert.deepEqual([next.sideA, next.sideB].sort(), winners.sort());
    assertPairs(state);
  });

  for (const [teamCount, courtCount] of [[3, 1], [4, 1], [5, 1], [5, 2], [8, 1], [9, 2]]) {
    it(`Mexicano selects fair rests before ranking: ${teamCount} teams, ${courtCount} courts`, () => {
      const input = config(teamCount!, "mexicano", courtCount!);
      input.roundCount = { type: "infinite" };
      let state = createInitialTournamentState(input);
      const counts = new Map(input.teams!.map((team) => [team.id, 0]));
      const teamId = (side: [string, string]) => input.teams!.find((team) => team.playerIds[0] === side[0])!.id;
      for (let index = 0; index < 40; index += 1) {
        const round = state.rounds[index]!;
        const ids = round.matches.flatMap((match) => [teamId(match.sideA), teamId(match.sideB)]);
        if (index > 0) {
          const ranked = state.leaderboard.map((entry) => entry.playerId);
          const eligible = [...ranked].sort((a, b) => counts.get(a)! - counts.get(b)!).slice(0, ids.length);
          assert.deepEqual(ids, ranked.filter((id) => eligible.includes(id)));
        }
        for (const id of ids) {
          counts.set(id, counts.get(id)! + 1);
        }
        assert.ok(Math.max(...counts.values()) - Math.min(...counts.values()) <= 1);
        complete(round);
        state = maybeAppendNextRound(input, state);
      }
      assertPairs(state);
    });
  }

  it("seeds the first Mexicano round by shuffling whole teams, reproducibly", () => {
    const input = config(8, "mexicano", 4);
    const first = createInitialTournamentState(input);
    assert.deepEqual(first, createInitialTournamentState(input));
    assert.notDeepEqual(first.rounds, createInitialTournamentState({ ...input, scheduleSeed: "another-seed" }).rounds);
    const unseeded = { ...input };
    delete unseeded.scheduleSeed;
    assert.deepEqual(createInitialTournamentState(unseeded).rounds[0]!.matches[0]!.sideA, input.teams![0]!.playerIds);
    assert.deepEqual(createInitialTournamentState(unseeded).rounds[0]!.matches[0]!.sideB, input.teams![1]!.playerIds);
    assertPairs(first);
  });

  it("rebuilds fixed Mexicano pairings after score corrections and deletion", async () => {
    const { service } = createTestApp();
    let tournament = await service.createTournament(request(5, "mexicano"));
    for (const match of tournament.state.rounds[0]!.matches) {
      tournament = await service.upsertMatchResult(tournament.roomCode, match.id, {
        expectedStateVersion: tournament.stateVersion, sideAScore: 15, sideBScore: 6,
      });
    }
    assert.equal(tournament.state.rounds.length, 2);
    tournament = await service.upsertMatchResult(tournament.roomCode, "r1m1", {
      expectedStateVersion: tournament.stateVersion, sideAScore: 1, sideBScore: 20,
    });
    const rebuilt = maybeAppendNextRound(tournament.config, {
      ...tournament.state, rounds: tournament.state.rounds.slice(0, 1),
    });
    assert.deepEqual(tournament.state, rebuilt);
    assertPairs(tournament.state);
    tournament = await service.deleteMatchResult(tournament.roomCode, "r1m1", {
      expectedStateVersion: tournament.stateVersion,
    });
    assert.equal(tournament.state.rounds.length, 1);
    assert.equal(tournament.state.leaderboard.reduce((sum, row) => sum + row.played, 0), 2);
    assertPairs(tournament.state);
  });

  it("replay remaps persisted memberships by player ID, not assumed player positions", async () => {
    const { service, repository } = createTestApp();
    const created = await service.createTournament(request(3));
    const finished = await service.finishTournament(created.roomCode, { expectedStateVersion: 1 });
    const reordered = { ...finished.config, players: [...finished.config.players].reverse() };
    await repository.createTournament({
      ...finished,
      id: "reordered-source",
      roomCode: "REORDER1",
      config: reordered,
      log: { id: "reordered-log", type: "tournament_created", payload: {}, createdAt: finished.createdAt },
    });
    const replay = await service.playAgain("REORDER1");
    assert.deepEqual(replay.config.teams, [
      { id: "team1", playerIds: ["p6", "p5"] },
      { id: "team2", playerIds: ["p4", "p3"] },
      { id: "team3", playerIds: ["p2", "p1"] },
    ]);
    const memberNames = (input: TournamentConfig) => input.teams!.map((team) =>
      team.playerIds.map((id) => input.players.find((player) => player.id === id)!.name));
    assert.deepEqual(memberNames(replay.config), memberNames(finished.config));
    assertPairs(replay.state);
  });

  it("reads and replays persisted rotating tournaments without a format field", async () => {
    const { service, repository } = createTestApp();
    const { format: _format, teams: _teams, ...oldRequest } = request(2);
    const created = await service.createTournament(oldRequest);
    const finished = await service.finishTournament(created.roomCode, { expectedStateVersion: 1 });
    delete finished.config.format;
    await repository.createTournament({
      ...finished,
      id: "legacy-source",
      roomCode: "LEGACY1",
      log: { id: "legacy-log", type: "tournament_created", payload: {}, createdAt: finished.createdAt },
    });
    const read = await service.getTournament("LEGACY1");
    assert.ok(!("format" in read.config));
    const replay = await service.playAgain("LEGACY1");
    assert.equal(replay.config.format, "rotating");
    assert.ok(!("teams" in replay.config));
    assert.ok(!("teams" in replay.state));
    assert.equal(replay.state.leaderboard.length, 4);
  });

  it("counts team wins, ties, points and corrections once, with stable team-order ties", () => {
    const input = config(3, "mexicano", 1);
    input.teams = [input.teams![2]!, input.teams![0]!, input.teams![1]!];
    let state = createInitialTournamentState(input);
    assert.deepEqual(state.leaderboard.map((row) => row.playerId), input.teams.map((team) => team.id));
    complete(state.rounds[0]!);
    state = normalizeTournamentState(state);
    assert.deepEqual(state.leaderboard[0], {
      playerId: input.teams.find((team) => team.playerIds[0] === state.rounds[0]!.matches[0]!.sideA[0])!.id,
      playerIds: state.rounds[0]!.matches[0]!.sideA,
      played: 1, wins: 1, ties: 0, pointsFor: 15, pointsAgainst: 6, pointDiff: 9,
    });
    state.rounds[0]!.matches[0]!.result = {
      sideAScore: 10, sideBScore: 10, winningSide: null, enteredAt: "2026-09-06T12:00:00.000Z",
    };
    state = normalizeTournamentState(state);
    assert.equal(state.leaderboard.reduce((sum, row) => sum + row.ties, 0), 2);
    assert.equal(state.leaderboard.reduce((sum, row) => sum + row.wins, 0), 0);
    assert.deepEqual(state.leaderboard.filter((row) => row.played).map((row) => row.playerId),
      input.teams.filter((team) => !state.rounds[0]!.sittingOut.includes(team.playerIds[0])).map((team) => team.id));
    state.rounds[0]!.matches[0]!.result = null;
    state = normalizeTournamentState(state);
    assert.ok(state.leaderboard.every((row) => row.played === 0 && row.pointsFor === 0));
  });

  it("leaves old persisted rotating configs and player standings unchanged", () => {
    const input = config(2, "mexicano", 1);
    delete input.format;
    delete input.teams;
    const state = createInitialTournamentState(input);
    assert.ok(!("teams" in state));
    assert.deepEqual(state, createInitialTournamentState({ ...input, format: "rotating" }));
    complete(state.rounds[0]!);
    const normalized = normalizeTournamentState(state);
    assert.equal(normalized.leaderboard.length, 4);
    assert.equal(normalized.leaderboard.reduce((sum, entry) => sum + entry.pointsFor, 0), 42);
    assert.ok(normalized.leaderboard.every((entry) => !("playerIds" in entry)));
  });
});
