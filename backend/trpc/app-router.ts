import { createTRPCRouter } from "./create-context";
import { exampleRouter } from "./routes/example";
import { userRouter } from "./routes/user";
import { weeklyEmailRouter } from "./routes/weekly-email";
import { notificationsRouter } from "./routes/notifications";

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  user: userRouter,
  weeklyEmail: weeklyEmailRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
