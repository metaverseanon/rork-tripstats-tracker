import { createTRPCRouter } from "./create-context";
import { exampleRouter } from "./routes/example";
import { userRouter } from "./routes/user";
import { weeklyEmailRouter } from "./routes/weekly-email";
import { notificationsRouter } from "./routes/notifications";
import { tripsRouter } from "./routes/trips";
import { socialRouter } from "./routes/social";

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  user: userRouter,
  weeklyEmail: weeklyEmailRouter,
  notifications: notificationsRouter,
  trips: tripsRouter,
  social: socialRouter,
});

export type AppRouter = typeof appRouter;
