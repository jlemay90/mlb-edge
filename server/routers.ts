import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import { mlbRouter } from "./mlb-router";
import { claudeRouter } from "./claude-router";

export const appRouter = router({
  mlb: mlbRouter,
  claude: claudeRouter,
});

export type AppRouter = typeof appRouter;
