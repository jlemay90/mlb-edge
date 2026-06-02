import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { mlbRouter } from "./mlbRouter";
import { stripeRouter } from "./stripe/stripeRouter";
import { getSubscriptionByOpenId } from "./db";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    // Returns the current user merged with their subscription tier.
    // Tier resolves to "free" for anonymous or unpersisted users.
    myAccount: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) {
        return { authenticated: false as const, user: null, tier: "free" as const, status: null, periodEnd: null };
      }
      const sub = await getSubscriptionByOpenId(ctx.user.openId, {
        name: ctx.user.name,
        email: (ctx.user as any).email ?? null,
        loginMethod: (ctx.user as any).loginMethod ?? null,
      });
      // Owner / admin always gets full Sharp access with no paywall or trial.
      const isOwner =
        ctx.user.openId === process.env.OWNER_OPEN_ID ||
        (ctx.user as any).role === "admin";
      return {
        authenticated: true as const,
        user: ctx.user,
        tier: isOwner ? ("sharp" as const) : sub.tier,
        status: isOwner ? "active" : sub.status,
        periodEnd: sub.periodEnd,
        isOwner,
      };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  mlb: mlbRouter,
  stripe: stripeRouter,

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
