import { serve } from "@hono/node-server";

import { createApp } from "./app.js";
import { getConfig } from "./config.js";
import { createProductionDependencies } from "./dependencies.js";

const config = getConfig();
const app = createApp(createProductionDependencies());

serve(
  {
    fetch: app.fetch,
    hostname: config.host,
    port: config.port,
  },
  (info) => {
    console.log(`Backend listening on http://${info.address}:${info.port}`);
  },
);
