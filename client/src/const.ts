export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * The canonical callback URL is always the manus.space domain.
 * This URL is registered with the Manus OAuth server as an allowed redirect URI.
 * Custom domains (e.g. intelligentbettingmlbedgepicks.com) may not be registered,
 * so we always use the canonical URL for the OAuth redirect.
 *
 * After the callback succeeds on manus.space, the server checks if the user
 * originally came from a different domain (returnTo) and issues a cross-domain
 * handoff to set the session cookie on their original domain too.
 */
const CANONICAL_CALLBACK_URL = "https://mlbedge-fnjyc4zg.manus.space/api/oauth/callback";

// Generate login URL at runtime so redirect URI reflects the canonical callback URL.
// The current origin is encoded as returnTo so we can redirect back after auth.
export const getLoginUrl = (returnPath?: string) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;

  // Always use the canonical manus.space callback URL — it's registered with the OAuth server
  const redirectUri = CANONICAL_CALLBACK_URL;

  // Encode both the redirectUri and the current origin (for cross-domain handoff)
  const currentOrigin = window.location.origin;
  const returnTo = currentOrigin !== new URL(CANONICAL_CALLBACK_URL).origin
    ? currentOrigin
    : undefined;

  const state = btoa(JSON.stringify({
    redirectUri,
    ...(returnTo ? { returnTo } : {}),
    ...(returnPath ? { returnPath } : {}),
  }));

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
