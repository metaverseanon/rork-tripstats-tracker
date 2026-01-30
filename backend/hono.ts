import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

const app = new Hono();

app.use("*", cors());

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
  return c.json({ error: "Not Found", path: c.req.path }, 404);
});

app.onError((err, c) => {
  console.error("[Hono Error]", err);
  return c.json({ error: err.message || "Internal Server Error" }, 500);
});

export default app;
