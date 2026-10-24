/**
 * e2e: Notifications page
 *
 * Covers:
 *  1. Notifications list renders
 *  2. Marking a notification as read updates the UI
 *  3. Notification bell badge count decrements after marking as read
 *  4. Empty state renders when there are no notifications
 */

import { test, expect, type Page } from "@playwright/test";

const NOTIFICATIONS_URL = "/notifications";

interface MockNotification {
  id: string;
  user_id: string;
  type: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

function makeNotifications(): MockNotification[] {
  return [
    {
      id: "notif-001",
      user_id: "test-user-id",
      type: "gift_unlocked",
      message: "Your gift to Alice has unlocked.",
      read_at: null,
      created_at: new Date().toISOString(),
    },
    {
      id: "notif-002",
      user_id: "test-user-id",
      type: "gift_claimed",
      message: "Bob claimed your gift.",
      read_at: null,
      created_at: new Date().toISOString(),
    },
  ];
}

async function mockAuthSession(page: Page) {
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "test-user-id", phone: "+2348012345678" },
        expires: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    })
  );
}

/** Stateful mock of GET/PATCH /api/v1/notifications. */
async function mockNotificationsApi(page: Page, notifications: MockNotification[]) {
  const unread = () => notifications.filter((n) => !n.read_at).length;

  await page.route("**/api/v1/notifications*", async (route) => {
    const request = route.request();

    if (request.method() === "PATCH") {
      const body = request.postDataJSON() as { ids?: string[]; all?: boolean };
      const now = new Date().toISOString();
      for (const n of notifications) {
        if (body.all || body.ids?.includes(n.id)) n.read_at = n.read_at ?? now;
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { unreadCount: unread() } }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { notifications, unreadCount: unread(), total: notifications.length },
      }),
    });
  });
}

test.describe("Notifications page", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page);
  });

  test("renders the notifications list", async ({ page }) => {
    await mockNotificationsApi(page, makeNotifications());
    await page.goto(NOTIFICATIONS_URL);

    const list = page.getByRole("list", { name: "2 notifications" });
    await expect(list).toBeVisible();
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await expect(page.getByText("Your gift to Alice has unlocked.")).toBeVisible();
    await expect(page.getByLabel("2 unread")).toBeVisible();
  });

  test("marks a notification as read and updates the UI", async ({ page }) => {
    await mockNotificationsApi(page, makeNotifications());
    await page.goto(NOTIFICATIONS_URL);

    const markButtons = page.getByRole("button", { name: "Mark this notification as read" });
    await expect(markButtons).toHaveCount(2);

    await markButtons.first().click();

    await expect(markButtons).toHaveCount(1);
    await expect(page.getByLabel("1 unread")).toBeVisible();
  });

  test("bell badge count decrements after marking as read", async ({ page }) => {
    await mockNotificationsApi(page, makeNotifications());
    await page.goto(NOTIFICATIONS_URL);

    await expect(page.getByRole("link", { name: "Notifications, 2 unread" })).toBeVisible();

    await page.getByRole("button", { name: "Mark this notification as read" }).first().click();
    await expect(page.getByLabel("1 unread")).toBeVisible();

    // The bell polls for its count; reload to pick up the server-side change.
    await page.reload();
    await expect(page.getByRole("link", { name: "Notifications, 1 unread" })).toBeVisible();
  });

  test("shows the empty state when there are no notifications", async ({ page }) => {
    await mockNotificationsApi(page, []);
    await page.goto(NOTIFICATIONS_URL);

    await expect(
      page.getByRole("status").filter({ hasText: "You have no notifications yet." })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark all as read" })).toHaveCount(0);
  });
});
