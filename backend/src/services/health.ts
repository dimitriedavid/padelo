import type pg from "pg";

export type HealthCheck = () => Promise<void>;

export function createPostgresHealthCheck(pool: pg.Pool): HealthCheck {
  return async () => {
    await pool.query("select 1");
    await pool.query(`
      select
        id,
        room_code,
        name,
        config_json,
        state_json,
        state_version,
        status,
        created_at,
        updated_at,
        finished_at
      from tournaments
      limit 0
    `);
    await pool.query(`
      select
        id,
        tournament_id,
        type,
        payload_json,
        created_at
      from tournament_logs
      limit 0
    `);
  };
}
