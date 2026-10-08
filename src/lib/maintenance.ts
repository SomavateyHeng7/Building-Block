/**
 * Maintenance mode, switched by environment variables so it can be turned on for a release
 * without changing code:
 *
 *   MAINTENANCE_MODE=on                  Every page shows /maintenance (HTTP 503).
 *   MAINTENANCE_UNTIL=2026-10-08T18:00Z  Optional. When we expect to be back; shown in the visitor's time zone.
 *   MAINTENANCE_MESSAGE="…"              Optional. Replaces the default explanation.
 *   MAINTENANCE_BYPASS_TOKEN=…           Optional. Visiting any page with ?preview=<token> lets that browser
 *                                        use the real site, to check a release before reopening.
 */

export interface MaintenanceConfig {
  enabled: boolean;
  /** ISO time we expect to be back, if it's a valid date. */
  until: string | null;
  message: string | null;
  bypassToken: string | null;
}

type Env = Record<string, string | undefined>;

const ON_VALUES = new Set(["on", "true", "1", "yes"]);

export const BYPASS_COOKIE = "bb_maintenance_bypass";
export const BYPASS_PARAM = "preview";
/** How long to tell clients to wait before retrying when no end time is set. */
export const DEFAULT_RETRY_AFTER_SECONDS = 300;

export function readMaintenanceConfig(env: Env = process.env): MaintenanceConfig {
  const until = env.MAINTENANCE_UNTIL?.trim();
  return {
    enabled: ON_VALUES.has(env.MAINTENANCE_MODE?.trim().toLowerCase() ?? ""),
    until: until && !Number.isNaN(Date.parse(until)) ? new Date(until).toISOString() : null,
    message: env.MAINTENANCE_MESSAGE?.trim() || null,
    bypassToken: env.MAINTENANCE_BYPASS_TOKEN?.trim() || null,
  };
}

/** Seconds for the Retry-After header: until the expected end, or a default if that's unset or past. */
export function retryAfterSeconds(config: MaintenanceConfig, now = Date.now()): number {
  if (!config.until) return DEFAULT_RETRY_AFTER_SECONDS;
  const seconds = Math.ceil((Date.parse(config.until) - now) / 1000);
  return seconds > 0 ? seconds : DEFAULT_RETRY_AFTER_SECONDS;
}

/** The expected end time if it's still ahead; a passed one would only worry people. */
export function upcomingEnd(config: MaintenanceConfig, now = Date.now()): string | null {
  return config.until && Date.parse(config.until) > now ? config.until : null;
}
