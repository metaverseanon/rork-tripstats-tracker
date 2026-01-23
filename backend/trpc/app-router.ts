import { createTRPCRouter } from "./create-context";
import { exampleRouter } from "./routes/example";
import { userRouter } from "./routes/user";
import { weeklyEmailRouter } from "./routes/weekly-email";

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  user: userRouter,
  weeklyEmail: weeklyEmailRouter,
});

export type AppRouter = typeof appRouter;
