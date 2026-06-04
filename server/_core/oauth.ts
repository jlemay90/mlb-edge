import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { decodeOAuthState, sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

// Short-lived cross-domain handoff tokens (in-memory, 60s TTL)
// Maps token → { sessionToken, expiresAt }
const handoffTokens = new Map<string, { sessionToken: string; expiresAt: number }>();

function createHandoffToken(sessionToken: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  handoffTokens.set(token, {
    sessionToken,
    expiresAt: Date.now() + 60_000, // 60 second TTL
  });
  // Clean up expired tokens
  Array.from(handoffTokens.entries()).forEach(([k, v]) => {
    if (v.expiresAt < Date.now()) handoffTokens.delete(k);
  });
  return token;
}

function consumeHandoffToken(token: string): string | null {
  const entry = handoffTokens.get(token);
  if (!entry) return null;
  handoffTokens.delete(token); // one-time use
  if (entry.expiresAt < Date.now()) return null;
  return entry.sessionToken;
}

export function registerOAuthRoutes(app: Express) {
  /**
   * Main OAuth callback — handles the redirect from the Manus OAuth server.
   *
   * The state parameter encodes:
   *   - redirectUri: the canonical callback URL sent to the OAuth server
   *   - returnTo (optional): the original origin the user came from (for cross-domain flows)
   *
   * If returnTo differs from the current origin, we issue a short-lived handoff token
   * and redirect the user back to their original domain to complete the session setup.
   */
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // Decode state to get redirectUri and optional returnTo
    const oauthState = decodeOAuthState(state);
    const { redirectUri, returnTo } = oauthState;

    console.log(`[OAuth] Callback received — redirectUri=${redirectUri} returnTo=${returnTo ?? "none"}`);

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      // Set session cookie on the current domain (manus.space canonical)
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Cross-domain handoff: if the user originally came from a different domain,
      // redirect them back there with a short-lived token so they get a session cookie
      // on their original domain too.
      if (returnTo && returnTo !== req.protocol + "://" + req.get("host")) {
        const handoffToken = createHandoffToken(sessionToken);
        const handoffUrl = `${returnTo}/api/oauth/handoff?token=${handoffToken}`;
        console.log(`[OAuth] Cross-domain handoff → ${returnTo}`);
        res.redirect(302, handoffUrl);
        return;
      }

      res.redirect(302, "/");
    } catch (error: any) {
      const errMsg = error?.response?.data
        ? JSON.stringify(error.response.data)
        : error?.message ?? String(error);
      const errStatus = error?.response?.status ?? "unknown";
      console.error(
        `[OAuth] Callback failed — status=${errStatus} redirectUri=${redirectUri} returnTo=${returnTo ?? "none"} error=${errMsg}`
      );
      res.status(500).json({ error: "OAuth callback failed", detail: errMsg });
    }
  });

  /**
   * Cross-domain handoff endpoint.
   * Called by the custom domain after being redirected from the manus.space callback.
   * Validates the short-lived handoff token and sets a session cookie on this domain.
   */
  app.get("/api/oauth/handoff", async (req: Request, res: Response) => {
    const token = getQueryParam(req, "token");

    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }

    const sessionToken = consumeHandoffToken(token);
    if (!sessionToken) {
      console.warn("[OAuth] Handoff token invalid or expired");
      // Redirect to login page so user can try again
      res.redirect(302, "/?auth_error=session_expired");
      return;
    }

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    console.log("[OAuth] Cross-domain handoff complete — session cookie set");
    res.redirect(302, "/");
  });
}
