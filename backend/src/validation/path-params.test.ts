import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError } from "../domain/errors.js";
import { parseMatchIdParam, parseRoomCodeParam } from "./path-params.js";

describe("path param validation", () => {
  it("normalizes valid room codes", () => {
    assert.equal(parseRoomCodeParam(" abc123 "), "ABC123");
  });

  it("rejects invalid room codes", () => {
    for (const roomCode of ["", "ABC", "ABC_123", "A".repeat(33)]) {
      assertApiError(() => parseRoomCodeParam(roomCode), "invalid_room_code");
    }
  });

  it("normalizes valid match IDs", () => {
    assert.equal(parseMatchIdParam(" R12M3 "), "r12m3");
  });

  it("rejects invalid match IDs", () => {
    for (const matchId of ["", "match-1", "r0m1", "r1m0", "r1m1extra", "r1234567890m1"]) {
      assertApiError(() => parseMatchIdParam(matchId), "invalid_match_id");
    }
  });
});

function assertApiError(action: () => void, code: string): void {
  assert.throws(
    action,
    (error) => error instanceof ApiError && error.status === 400 && error.code === code,
  );
}
