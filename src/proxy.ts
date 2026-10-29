import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy, NONCE_HEADER } from "@/lib/csp";
import { BYPASS_COOKIE, BYPASS_PARAM, readMaintenanceConfig, retryAfterSeconds, safeEqual } from "@/lib/maintenance";

const MAINTENANCE_PATH = "/maintenance";

/**
 * A fresh nonce and the policy that names it, on the request (Next.js reads the nonce from there and adds it to
 * its scripts) and on the response (the browser enforces it).
 */
function withCsp(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const policy = contentSecurityPolicy({
    nonce,
    dev: process.env.NODE_ENV === "development",
    https: request.nextUrl.protocol === "https:",
    waitlistUrl: process.env.NEXT_PUBLIC_WAITLIST_URL,
    analytics: !!process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN,
  });
  const headers = new Headers(request.headers);
  headers.set(NONCE_HEADER, nonce);
  headers.set("Content-Security-Policy", policy);
  return {
    request: { headers },
    secure: <T extends NextResponse>(response: T) => {
      response.headers.set("Content-Security-Policy", policy);
      return response;
    },
  };
}

export function proxy(request: NextRequest) {
  const config = readMaintenanceConfig();
  const { pathname, searchParams } = request.nextUrl;
  const csp = withCsp(request);

  if (!config.enabled) {
    // Nothing to wait for, so don't leave anyone on the maintenance page.
    return pathname === MAINTENANCE_PATH
      ? NextResponse.redirect(new URL("/", request.url))
      : csp.secure(NextResponse.next({ request: csp.request }));
  }

  if (config.bypassToken) {
    // ?preview=<token> remembers this browser, then drops the token from the address bar.
    if (safeEqual(searchParams.get(BYPASS_PARAM) ?? "", config.bypassToken)) {
      const clean = request.nextUrl.clone();
      clean.searchParams.delete(BYPASS_PARAM);
      const response = NextResponse.redirect(clean);
      response.cookies.set(BYPASS_COOKIE, config.bypassToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        path: "/",
        maxAge: 60 * 60 * 12,
      });
      return response;
    }
    if (safeEqual(request.cookies.get(BYPASS_COOKIE)?.value ?? "", config.bypassToken)) return csp.secure(NextResponse.next({ request: csp.request }));
  }

  // Keep the visitor's URL, so the page can send them back to it once we're done. /maintenance itself
  // answers 503 as well: the page checks for a non-503 answer to know the site is back.
  const response = csp.secure(NextResponse.rewrite(new URL(MAINTENANCE_PATH, request.url), { status: 503, request: csp.request }));
  response.headers.set("Retry-After", String(retryAfterSeconds(config)));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  // Pages only: framework assets, icons and other files with an extension still load.
  matcher: ["/((?!_next/static|_next/image|.*\\.[\\w]+$).*)"],
};
