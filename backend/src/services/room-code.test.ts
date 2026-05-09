import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateRoomCode, ROOM_CODE_LENGTH } from "./room-code.js";

describe("room codes", () => {
  it("generates 12-character room codes from the allowed alphabet", () => {
    const roomCode = generateRoomCode();

    assert.equal(roomCode.length, ROOM_CODE_LENGTH);
    assert.match(roomCode, /^[A-HJ-NP-Z2-9]{12}$/);
  });
});
