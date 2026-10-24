import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createOccasion, listOccasions, type Occasion } from "@/server/services/occasion.service";
import { createOccasionSchema } from "@/types/schemas";
import { withErrorHandler, withCsrf, validateBody } from "@/server/middleware";
import type { ApiResponse } from "@/types";

async function requireUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

const unauthorized = () =>
  NextResponse.json<ApiResponse<never>>({ success: false, error: "Unauthorized" }, { status: 401 });

/** GET /api/v1/occasions — list the current user's saved occasions (issue #341). */
export const GET = withErrorHandler(async () => {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  return NextResponse.json<ApiResponse<Occasion[]>>({
    success: true,
    data: await listOccasions(userId),
  });
});

/** POST /api/v1/occasions — save a new occasion with reminders enabled. */
export const POST = withErrorHandler(
  withCsrf(async (req: NextRequest) => {
    const userId = await requireUserId();
    if (!userId) return unauthorized();
    const validation = await validateBody(req, createOccasionSchema);
    if (!validation.success) return validation.response;
    return NextResponse.json<ApiResponse<Occasion>>(
      { success: true, data: await createOccasion(userId, validation.data) },
      { status: 201 }
    );
  })
);
