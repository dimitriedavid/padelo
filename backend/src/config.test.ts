import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseConfig } from "./config.js";

describe("config", () => {
  it("parses required config and applies defaults", () => {
    const config = parseConfig({
      DATABASE_URL: "postgres://padelo:secret@localhost:5432/padelo",
    });

    assert.deepEqual(config, {
      databaseUrl: "postgres://padelo:secret@localhost:5432/padelo",
      host: "0.0.0.0",
      port: 8123,
    });
  });

  it("parses explicit host and port", () => {
    const config = parseConfig({
      DATABASE_URL: "postgresql://padelo:secret@localhost:5432/padelo",
      HOST: "127.0.0.1",
      PORT: "3000",
    });

    assert.equal(config.host, "127.0.0.1");
    assert.equal(config.port, 3000);
  });

  it("fails clearly when required config is missing", () => {
    assert.throws(() => parseConfig({}), /Missing required environment variable: DATABASE_URL/);
  });

  it("fails clearly when database URL is not Postgres", () => {
    assert.throws(
      () => parseConfig({ DATABASE_URL: "mysql://padelo:secret@localhost/padelo" }),
      /Invalid DATABASE_URL/,
    );
  });

  it("fails clearly when PORT is invalid", () => {
    for (const port of ["", "abc", "0", "65536", "8123.5"]) {
      assert.throws(
        () =>
          parseConfig({
            DATABASE_URL: "postgres://padelo:secret@localhost:5432/padelo",
            PORT: port,
          }),
        /Invalid PORT/,
      );
    }
  });
});
