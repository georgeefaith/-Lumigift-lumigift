import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withErrorHandler } from "@/server/middleware";
import { getGiftAnalyticsBySender } from "@/server/services/gift.service";
import type { ApiResponse } from "@/types";
import type { GiftAnalytics } from "@/server/services/gift.service";

export const GET = withErrorHandler(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const userId = (session.user as { id: string }).id;
  const analytics = await getGiftAnalyticsBySender(userId);
  return NextResponse.json<ApiResponse<GiftAnalytics>>({ success: true, data: analytics });
});
