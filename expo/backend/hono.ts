import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { getDbConfig } from "./trpc/db";

// Backend v1.0.14 - Multiple cron route paths
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

app.get("/", (c) => c.json({ status: "ok", message: "API is running", version: "1.0.14" }));

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
    version: "1.0.13",
    timestamp: new Date().toISOString(),
  });
});

// Cron endpoint for weekly recap notifications
const weeklyRecapHandler = async (c: any) => {
  const authHeader = c.req.header("Authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log("[CRON] Unauthorized request to weekly-recap");
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  console.log("[CRON] Timezone-aware weekly recap triggered at", new Date().toISOString());
  
  try {
    const caller = appRouter.createCaller({ req: c.req.raw, db: getDbConfig() });
    const result = await caller.weeklyEmail.sendWeeklyRecapByTimezone({ targetHour: 22, forceSend: false });
    
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
};

app.get("/cron/weekly-recap", weeklyRecapHandler);
app.post("/cron/weekly-recap", weeklyRecapHandler);
app.get("/cron/weekly-recap-notifications", weeklyRecapHandler);
app.post("/cron/weekly-recap-notifications", weeklyRecapHandler);
app.get("/cron/weekly_recap_notifications", weeklyRecapHandler);
app.post("/cron/weekly_recap_notifications", weeklyRecapHandler);

const driveReminderHandler = async (c: any) => {
  const authHeader = c.req.header("Authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log("[CRON] Unauthorized request to drive-reminder");
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  console.log("[CRON] Friday drive reminder triggered at", new Date().toISOString());
  
  try {
    const caller = appRouter.createCaller({ req: c.req.raw, db: getDbConfig() });
    const result = await caller.notifications.sendDriveReminderNotifications({});
    
    console.log("[CRON] Drive reminder completed:", result);
    return c.json({ 
      ...result,
      triggeredAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Drive reminder failed:", error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
};

app.get("/cron/drive-reminder", driveReminderHandler);
app.post("/cron/drive-reminder", driveReminderHandler);
app.get("/cron/drive_reminder", driveReminderHandler);
app.post("/cron/drive_reminder", driveReminderHandler);

app.all("/cron/*", (c) => {
  console.log("[CRON] Unmatched cron route:", c.req.method, c.req.url, c.req.path);
  return c.json({ error: "Unknown cron route", method: c.req.method, path: c.req.path, url: c.req.url }, 404);
});

export default app;
