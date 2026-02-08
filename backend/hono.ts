import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { getDbConfig } from "./trpc/db";

// Backend v1.0.7 - Force redeploy
const app = new Hono();

app.use("*", cors());

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

app.get("/", (c) => c.json({ status: "ok", message: "API is running", version: "1.0.6" }));

// Debug endpoint to check database config
app.get("/health", (c) => {
  const dbEndpoint =
    process.env.RORK_DB_ENDPOINT ??
    process.env.DB_ENDPOINT ??
    process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
  const dbNamespace =
    process.env.RORK_DB_NAMESPACE ??
    process.env.DB_NAMESPACE ??
    process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
  const dbToken =
    process.env.RORK_DB_TOKEN ??
    process.env.DB_TOKEN ??
    process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

  const dbConfigured = !!(dbEndpoint && dbNamespace && dbToken);

  console.log("[HEALTH] DB Config check:", {
    hasEndpoint: !!dbEndpoint,
    hasNamespace: !!dbNamespace,
    hasToken: !!dbToken,
    configured: dbConfigured,
  });

  return c.json({
    status: dbConfigured ? "ok" : "error",
    database: {
      configured: dbConfigured,
      hasEndpoint: !!dbEndpoint,
      hasNamespace: !!dbNamespace,
      hasToken: !!dbToken,
    },
    version: "1.0.6",
    timestamp: new Date().toISOString(),
  });
});

// Cron endpoint for weekly recap (Sunday 9pm)
// Use with cron-job.org or similar: GET https://your-app.rork.app/api/cron/weekly-recap
app.get("/cron/weekly-recap", async (c) => {
  const authHeader = c.req.header("Authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  // Optional: protect with secret
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log("[CRON] Unauthorized request to weekly-recap");
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  console.log("[CRON] Weekly recap triggered at", new Date().toISOString());
  
  try {
    const caller = appRouter.createCaller({ req: c.req.raw, db: getDbConfig() });
    const result = await caller.weeklyEmail.sendWeeklyRecapWithPush({});
    
    console.log("[CRON] Weekly recap completed:", result);
    return c.json({ 
      ...result,
      triggeredAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Weekly recap failed:", error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});

export default app;
