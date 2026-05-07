import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { getConfig } from "../config.js";
import * as schema from "./schema.js";

const { Pool } = pg;

const config = getConfig();

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

export const db = drizzle(pool, { schema });

