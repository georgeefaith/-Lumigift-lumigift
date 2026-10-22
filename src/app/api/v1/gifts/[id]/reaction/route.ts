import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGiftById, hashPhone } from "@/server/services/gift.service";
import { createReaction } from "@/server/services/reaction.service";
import { giftReactionSchema } from "@/types/schemas";
import { withErrorHandler, withCsrf, validateBody } from "@/server/middleware";
import type { ApiResponse } from "@/types";
import type { GiftReaction } from "@/server/services/reaction.service";

/**
 * POST /api/v1/gifts/:id/reaction — recipient sends a one-time emoji reaction
 * and optional thank-you note after claiming (issue #343).
 */
export const POST = withErrorHandler(
  withCsrf(async (req: NextRequest, context: unknown) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { params } = context as { params: { id: string } };
    const validation = await validateBody(req, giftReactionSchema);
    if (!validation.success) return validation.response;

    const gift = await getGiftById(params.id);
    const phone = (session.user as { phone?: string }).phone;
    // Only the recipient may react; 404 avoids leaking gift existence.
    if (!gift || !phone || gift.recipientPhoneHash !== hashPhone(phone)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Gift not found" },
        { status: 404 }
      );
    }

    if (gift.status !== "claimed") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "You can react once the gift is claimed" },
        { status: 409 }
      );
    }

    const reaction = await createReaction(gift, validation.data.emoji, validation.data.message);
    if (!reaction) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "You have already reacted to this gift" },
        { status: 409 }
      );
    }

    return NextResponse.json<ApiResponse<GiftReaction>>(
      { success: true, data: reaction },
      { status: 201 }
    );
  })
);
