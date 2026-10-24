/**
 * @jest-environment node
 *
 * Unit tests for src/server/services/claim-guard.service.ts (Issue #378).
 */

jest.mock("@/lib/logger", () => {
  const warn = jest.fn();
  return { serviceLogger: () => ({ warn }), __warn: warn };
});

import {
  checkClaimAttempt,
  delayForFailures,
  recordClaimFailure,
  resetClaimGuard,
  MAX_ATTEMPTS_PER_HOUR,
} from "../claim-guard.service";

const { __warn: mockWarn } = require("@/lib/logger") as { __warn: jest.Mock };

const T0 = 1_700_000_000_000;

beforeEach(() => {
  resetClaimGuard();
  mockWarn.mockClear();
});

describe("checkClaimAttempt — rate limit", () => {
  it("allows 5 attempts per IP per hour and blocks the 6th", () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_HOUR; i++) {
      expect(checkClaimAttempt("1.1.1.1", T0 + i)).toEqual({ allowed: true });
    }
    const blocked = checkClaimAttempt("1.1.1.1", T0 + 10);
    expect(blocked.allowed).toBe(false);
  });

  it("tracks IPs independently", () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_HOUR; i++) checkClaimAttempt("1.1.1.1", T0);
    expect(checkClaimAttempt("2.2.2.2", T0)).toEqual({ allowed: true });
  });

  it("resets after the one-hour window", () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_HOUR; i++) checkClaimAttempt("1.1.1.1", T0);
    expect(checkClaimAttempt("1.1.1.1", T0 + 60 * 60 * 1000 + 1)).toEqual({ allowed: true });
  });
});

describe("exponential delay after failures", () => {
  it("computes 0, 0, 0, 1s, 2s, 4s for failures 0..5", () => {
    expect([0, 1, 2, 3, 4, 5].map(delayForFailures)).toEqual([0, 0, 0, 1000, 2000, 4000]);
  });

  it("imposes no delay before 3 failures", () => {
    checkClaimAttempt("ip", T0);
    recordClaimFailure("ip", "u1", "g1", T0);
    checkClaimAttempt("ip", T0);
    recordClaimFailure("ip", "u1", "g1", T0);
    expect(checkClaimAttempt("ip", T0)).toEqual({ allowed: true });
  });

  it("requires 1s then 2s waits after the 3rd and 4th failures", () => {
    for (let i = 0; i < 3; i++) recordClaimFailure("ip", "u1", "g1", T0);
    expect(checkClaimAttempt("ip", T0 + 500)).toEqual({ allowed: false, retryAfterMs: 500 });
    expect(checkClaimAttempt("ip", T0 + 1000)).toEqual({ allowed: true });

    recordClaimFailure("ip", "u1", "g1", T0 + 1000);
    expect(checkClaimAttempt("ip", T0 + 2500)).toEqual({ allowed: false, retryAfterMs: 500 });
    expect(checkClaimAttempt("ip", T0 + 3000)).toEqual({ allowed: true });
  });
});

describe("recordClaimFailure", () => {
  it("logs IP, user ID and gift ID", () => {
    recordClaimFailure("9.9.9.9", "user-1", "gift-1", T0);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ ip: "9.9.9.9", userId: "user-1", giftId: "gift-1" }),
      expect.any(String)
    );
  });
});
