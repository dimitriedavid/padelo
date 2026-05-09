import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { maskRoomCodesInAccessLog } from "./access-log.js";

describe("access log masking", () => {
  it("masks tournament room code path segments", () => {
    assert.equal(
      maskRoomCodesInAccessLog("<-- GET /api/tournaments/ABCD2345WXYZ/matches/r1m1/result"),
      "<-- GET /api/tournaments/:roomCode/matches/r1m1/result",
    );
  });

  it("masks direct room lookups with query strings", () => {
    assert.equal(
      maskRoomCodesInAccessLog("--> GET /api/tournaments/ABCD2345WXYZ?include=events 200 1ms"),
      "--> GET /api/tournaments/:roomCode?include=events 200 1ms",
    );
  });

  it("does not change tournament collection routes", () => {
    assert.equal(
      maskRoomCodesInAccessLog("<-- POST /api/tournaments"),
      "<-- POST /api/tournaments",
    );
  });
});
