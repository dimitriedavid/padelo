import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createTestApp } from "./test/create-test-app.js";

describe("app", () => {
  it("returns health status", async () => {
    const { app } = createTestApp();
    const response = await app.request("/health");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });

  it("returns not_found for unknown routes", async () => {
    const { app } = createTestApp();
    const response = await app.request("/missing");

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "not_found" });
  });
});
