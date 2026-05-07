export type AppConfig = {
  databaseUrl: string;
  host: string;
  port: number;
};

export function getConfig(): AppConfig {
  return {
    databaseUrl: getRequiredEnv("DATABASE_URL"),
    host: process.env.HOST ?? "0.0.0.0",
    port: Number(process.env.PORT ?? 8123),
  };
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
