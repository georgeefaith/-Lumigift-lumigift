import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  deleteOccasion,
  setOccasionReminders,
  type Occasion,
} from "@/server/services/occasion.service";
import { updateOccasionSchema } from "@/types/schemas";
import { withErrorHandler, withCsrf, validateBody } from "@/server/middleware";
import type { ApiResponse } from "@/types";

const notFound = () =>
  NextResponse.json<ApiResponse<never>>(
    { success: false, error: "Occasion not found" },
    { status: 404 }
  );

/** PATCH /api/v1/occasions/:id — opt in/out of reminders for one occasion. */
export const PATCH = withErrorHandler(
  withCsrf(async (req: NextRequest, context: unknown) => {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    const { params } = context as { params: { id: string } };
    const validation = await validateBody(req, updateOccasionSchema);
    if (!validation.success) return validation.response;

    const occasion = await setOccasionReminders(
      userId,
      params.id,
      validation.data.remindersEnabled
    );
    if (!occasion) return notFound();
    return NextResponse.json<ApiResponse<Occasion>>({ success: true, data: occasion });
  })
);

/** DELETE /api/v1/occasions/:id — remove a saved occasion. */
export const DELETE = withErrorHandler(
  withCsrf(async (_req: NextRequest, context: unknown) => {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    const { params } = context as { params: { id: string } };
    if (!(await deleteOccasion(userId, params.id))) return notFound();
    return NextResponse.json<ApiResponse<{ id: string }>>({
      success: true,
      data: { id: params.id },
    });
  })
);
