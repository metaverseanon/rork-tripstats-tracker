import { initTRPC } from "@trpc/server";
import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";

import { getDbConfig } from "./db";

export type DbConfig = {
  endpoint?: string;
  namespace?: string;
  token?: string;
};

export const createContext = async (opts: FetchCreateContextFnOptions) => {
  const db = getDbConfig();

  console.log("[tRPC] createContext", {
    hasDbEndpoint: !!db.endpoint,
    hasDbNamespace: !!db.namespace,
    hasDbToken: !!db.token,
    requestUrl: opts.req.url,
  });

  return {
    req: opts.req,
    db,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
