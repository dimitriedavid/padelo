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

  it("returns unavailable when the health check fails", async () => {
    const originalError = console.error;
    console.error = () => {};

    try {
      const { app } = createTestApp({
        healthCheck: async () => {
          throw new Error("database unavailable");
        },
      });
      const response = await app.request("/health");

      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { ok: false, error: "service_unavailable" });
    } finally {
      console.error = originalError;
    }
  });

  it("returns not_found for unknown routes", async () => {
    const { app } = createTestApp();
    const response = await app.request("/missing");

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "not_found" });
  });
});
