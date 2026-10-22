/**
 * GET /api/v1/transactions/[giftId]/receipt
 *
 * Returns a downloadable PDF receipt for a specific gift, generated server-side.
 * Only the gift sender or recipient may download the receipt.
 *
 * The PDF includes:
 *   giftId, amountNgn, amountUsdc, provider, providerReference,
 *   stellarTxHash, status, senderName, recipientName, createdAt, completedAt
 *
 * Issue #150 — Transaction history & downloadable receipts.
 * Issue #370 — PDF receipt generation.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withAuth, withErrorHandler } from "@/server/middleware";
import { generateReceiptData } from "@/server/services/transaction-history.service";
import { renderReceiptPdf } from "@/server/services/receipt-pdf";
import { hashPhone } from "@/server/services/gift.service";

export const GET = withErrorHandler(
  withAuth(async (_req: NextRequest, context: unknown) => {
    const session = await getServerSession(authOptions);
    const user = session!.user as { id: string; phone?: string };

    const { params } = context as { params: { giftId: string } };
    const { giftId } = params;

    // generateReceiptData throws AppError FORBIDDEN unless the caller is the sender or recipient
    const receipt = await generateReceiptData(
      giftId,
      user.id,
      user.phone ? hashPhone(user.phone) : undefined
    );
    const pdf = renderReceiptPdf(receipt);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=receipt-${receipt.giftId}.pdf`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "private, no-store",
      },
    });
  })
);
