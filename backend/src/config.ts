import { loadEnvFile } from "./env.js";

loadEnvFile();

type EnvSource = Record<string, string | undefined>;

const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 8123;
const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

export type AppConfig = {
  databaseUrl: string;
  host: string;
  port: number;
};

export function getConfig(): AppConfig {
  return parseConfig(process.env);
}

export function parseConfig(env: EnvSource): AppConfig {
  return {
    databaseUrl: parseDatabaseUrl(getRequiredEnv(env, "DATABASE_URL")),
    host: parseHost(env.HOST ?? DEFAULT_HOST),
    port: parsePort(env.PORT ?? String(DEFAULT_PORT)),
  };
}

function getRequiredEnv(env: EnvSource, name: string): string {
  const value = env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseDatabaseUrl(value: string): string {
  try {
    const url = new URL(value);

    if (!POSTGRES_PROTOCOLS.has(url.protocol)) {
      throw new Error("Unsupported protocol.");
    }
  } catch {
    throw new Error("Invalid DATABASE_URL: expected a postgres:// or postgresql:// URL.");
  }

  return value;
}

function parseHost(value: string): string {
  const host = value.trim();

  if (!host) {
    throw new Error("Invalid HOST: expected a non-empty host.");
  }

  return host;
}

function parsePort(value: string): number {
  const portText = value.trim();

  if (!/^[0-9]+$/.test(portText)) {
    throw new Error("Invalid PORT: expected an integer from 1 to 65535.");
  }

  const port = Number(portText);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid PORT: expected an integer from 1 to 65535.");
  }

  return port;
}
