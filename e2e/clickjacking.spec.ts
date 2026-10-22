/**
 * e2e: Click-jacking protection (issue #369)
 *
 * Covers:
 *  1. Responses send X-Frame-Options: DENY and CSP frame-ancestors 'none'
 *  2. Embedding the app in a cross-origin iframe is blocked by the browser
 */

import { test, expect } from "@playwright/test";

test.describe("Click-jacking protection", () => {
  test("sets anti-framing headers", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  test("app cannot be embedded in an iframe", async ({ page, baseURL }) => {
    const target = new URL("/", baseURL).toString();
    await page.setContent(`<iframe id="victim" src="${target}"></iframe>`);

    const frame = page.frame({ url: (u) => u.toString().startsWith(target) });
    // The browser refuses to render framed content, so the app body never loads.
    await expect
      .poll(async () => (frame ? frame.locator("body *").count() : 0), { timeout: 5000 })
      .toBe(0);
  });
});
