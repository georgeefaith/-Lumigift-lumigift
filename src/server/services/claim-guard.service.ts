import { serviceLogger } from "@/lib/logger";

/**
 * Brute-force protection for the gift claim endpoint (Issue #378).
 *
 * - At most {@link MAX_ATTEMPTS_PER_HOUR} claim attempts per IP per hour.
 * - After {@link FREE_FAILURES} failed attempts, each further attempt must wait
 *   an exponentially growing delay (1s, 2s, 4s, ...) since the last failure.
 */

const log = serviceLogger("claim-guard");

export const MAX_ATTEMPTS_PER_HOUR = 5;
export const FREE_FAILURES = 3;
const WINDOW_MS = 60 * 60 * 1000;
const BASE_DELAY_MS = 1000;

interface Entry {
  attempts: number;
  failures: number;
  lastFailureAt: number;
  resetAt: number;
}

const entries = new Map<string, Entry>();

function getEntry(ip: string, now: number): Entry {
  const existing = entries.get(ip);
  if (existing && now <= existing.resetAt) return existing;
  const fresh: Entry = { attempts: 0, failures: 0, lastFailureAt: 0, resetAt: now + WINDOW_MS };
  entries.set(ip, fresh);
  return fresh;
}

/** Required delay (ms) after `failures` failed attempts; 0 below the threshold. */
export function delayForFailures(failures: number): number {
  if (failures < FREE_FAILURES) return 0;
  return BASE_DELAY_MS * 2 ** (failures - FREE_FAILURES);
}

export type ClaimAttemptCheck = { allowed: true } | { allowed: false; retryAfterMs: number };

/** Registers a claim attempt from `ip` and reports whether it may proceed. */
export function checkClaimAttempt(ip: string, now = Date.now()): ClaimAttemptCheck {
  const entry = getEntry(ip, now);

  if (entry.attempts >= MAX_ATTEMPTS_PER_HOUR) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  const waitUntil = entry.lastFailureAt + delayForFailures(entry.failures);
  if (now < waitUntil) {
    return { allowed: false, retryAfterMs: waitUntil - now };
  }

  entry.attempts++;
  return { allowed: true };
}

/** Records and logs a failed claim attempt. */
export function recordClaimFailure(
  ip: string,
  userId: string | undefined,
  giftId: string,
  now = Date.now()
): void {
  const entry = getEntry(ip, now);
  entry.failures++;
  entry.lastFailureAt = now;
  log.warn({ ip, userId, giftId, failures: entry.failures }, "Failed gift claim attempt");
}

/** Test helper — clears all tracked state. */
export function resetClaimGuard(): void {
  entries.clear();
}
