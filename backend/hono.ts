import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

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

app.get("/", (c) => c.json({ status: "ok", message: "API is running" }));

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
    const caller = appRouter.createCaller({ req: c.req.raw });
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
