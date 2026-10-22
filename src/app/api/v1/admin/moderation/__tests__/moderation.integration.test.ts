/**
 * @jest-environment node
 *
 * Moderation integration tests — exercises GET/POST /api/v1/admin/moderation
 * against the real moderation service store. Only the session and the users
 * role lookup are stubbed so admin vs non-admin callers can be simulated.
 *
 * Closes #368
 */

import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { reportMessage } from "@/server/services/moderation.service";
import type { MessageReport } from "@/types";

const mockGetServerSession = jest.fn();
const mockQuery = jest.fn();

jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { query: (...args: unknown[]) => mockQuery(...args) },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function asUser(id: string, role: "admin" | "user") {
  mockGetServerSession.mockResolvedValue({ user: { id } });
  mockQuery.mockResolvedValue({ rows: [{ role }] });
}

function getQueue() {
  return GET(new NextRequest("http://localhost/api/v1/admin/moderation"));
}

function resolve(reportId: string, action: string) {
  return POST(
    new NextRequest("http://localhost/api/v1/admin/moderation", {
      method: "POST",
      body: JSON.stringify({ reportId, action }),
      headers: { "content-type": "application/json" },
    })
  );
}

async function findReport(id: string): Promise<MessageReport | undefined> {
  const res = await getQueue();
  const json = await res.json();
  return (json.data as MessageReport[]).find((r) => r.id === id);
}

beforeEach(() => jest.clearAllMocks());

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("/api/v1/admin/moderation", () => {
  it("flagging a gift puts it in the queue as pending", async () => {
    const report = reportMessage("gift-flag", "reporter-1", "spam");
    asUser("admin-1", "admin");

    const found = await findReport(report.id);
    expect(found?.status).toBe("pending");
    expect(found?.giftId).toBe("gift-flag");
  });

  it("approving a flagged gift resolves it as approved (visible)", async () => {
    const report = reportMessage("gift-approve", "reporter-1", "looks off");
    asUser("admin-1", "admin");

    const res = await resolve(report.id, "approved");
    expect(res.status).toBe(200);

    const found = await findReport(report.id);
    expect(found).toMatchObject({ status: "resolved", action: "approved" });
  });

  it("rejecting a flagged gift resolves it as removed (hidden)", async () => {
    const report = reportMessage("gift-reject", "reporter-1", "abusive");
    asUser("admin-1", "admin");

    const res = await resolve(report.id, "removed");
    expect(res.status).toBe(200);

    const found = await findReport(report.id);
    expect(found).toMatchObject({ status: "resolved", action: "removed" });
    expect(found?.resolvedAt).toBeDefined();
  });

  it("rejects non-admin callers on GET and POST", async () => {
    const report = reportMessage("gift-forbidden", "reporter-1", "spam");
    asUser("user-1", "user");

    expect((await getQueue()).status).toBe(403);
    expect((await resolve(report.id, "removed")).status).toBe(403);
  });

  it("rejects unauthenticated callers", async () => {
    mockGetServerSession.mockResolvedValue(null);
    expect((await getQueue()).status).toBe(401);
  });

  it("returns 404 for an unknown report", async () => {
    asUser("admin-1", "admin");
    expect((await resolve("rpt-missing", "approved")).status).toBe(404);
  });
});
