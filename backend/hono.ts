import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

const app = new Hono();

app.use("*", cors());

// Log all incoming requests
app.use("*", async (c, next) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[HONO:${requestId}] ===== INCOMING REQUEST =====`);
  console.log(`[HONO:${requestId}] Method: ${c.req.method}`);
  console.log(`[HONO:${requestId}] Path: ${c.req.path}`);
  console.log(`[HONO:${requestId}] URL: ${c.req.url}`);
  
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  
  console.log(`[HONO:${requestId}] Response status: ${c.res.status}`);
  console.log(`[HONO:${requestId}] Duration: ${duration}ms`);
  console.log(`[HONO:${requestId}] ===== REQUEST COMPLETE =====`);
});

app.use(
  "/api/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
    onError: ({ error, path }) => {
      console.error(`[TRPC Error] ${path}:`, error.message);
    },
  }),
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

app.notFound((c) => {
  console.error(`[HONO] 404 NOT FOUND - Path: ${c.req.path}`);
  console.error(`[HONO] 404 NOT FOUND - Full URL: ${c.req.url}`);
  console.error(`[HONO] 404 NOT FOUND - Method: ${c.req.method}`);
  return c.json({ error: "Not Found", path: c.req.path, method: c.req.method }, 404);
});

app.onError((err, c) => {
  console.error("[Hono Error]", err);
  return c.json({ error: err.message || "Internal Server Error" }, 500);
});

export default app;
