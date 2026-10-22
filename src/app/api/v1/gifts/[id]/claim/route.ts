import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGiftById, hashPhone } from "@/server/services/gift.service";
import { claimGift } from "@/server/services/claim.service";
import { claimGiftSchema } from "@/types/schemas";
import { withErrorHandler, withCsrf, validateBody } from "@/server/middleware";
import { checkClaimAttempt, recordClaimFailure } from "@/server/services/claim-guard.service";
import { getInvitationByPhoneAndGift, claimInvitation } from "@/server/services/invitation.service";
import type { ApiResponse } from "@/types";

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
    const userId = (session.user as { id?: string }).id;

    // Brute-force protection (Issue #378)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const attempt = checkClaimAttempt(ip);
    if (!attempt.allowed) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Too many claim attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(attempt.retryAfterMs / 1000)) } }
      );
    }

    const validation = await validateBody(req, claimGiftSchema, { giftId: params.id });
    if (!validation.success) return validation.response;

    // Always use the route param id — never trust body for giftId
    const giftId = params.id;
    const gift = await getGiftById(giftId);

    // Return 404 for non-existent or cross-user guesses (avoids enumeration)
    if (!gift) {
      recordClaimFailure(ip, userId, giftId);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Gift not found" },
        { status: 404 }
      );
    }

    // ── Ownership check ───────────────────────────────────────────────────────
    // Only the intended recipient may claim. Compare the hashed phone from the
    // session against the stored recipientPhoneHash. Return 404 rather than 403
    // to avoid leaking whether a gift exists for a different user.
    // A session without a phone cannot prove recipient identity, so it is
    // treated exactly like a mismatch (pentest finding PT-01).
    const phone = (session.user as { phone?: string }).phone;
    if (!phone || gift.recipientPhoneHash !== hashPhone(phone)) {
      recordClaimFailure(ip, userId, giftId);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Gift not found" },
        { status: 404 }
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Check if there's an invitation for this gift and recipient
    const invitation = await getInvitationByPhoneAndGift(phone, giftId);
    if (invitation) {
      // Invitation exists for this gift and recipient
      if (invitation.status !== "accepted") {
        return NextResponse.json<ApiResponse<never>>(
          {
            success: false,
            error: "You must complete registration via the invitation to claim this gift",
          },
          { status: 403 }
        );
      }
      // Mark invitation as claimed
      await claimInvitation(invitation.id);
    }

    const { txHash } = await claimGift(gift, validation.data.recipientStellarKey);

    return NextResponse.json<ApiResponse<{ txHash: string }>>({
      success: true,
      data: { txHash },
    });
  })
);
