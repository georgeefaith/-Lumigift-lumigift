/**
 * Minimal server-side PDF renderer for transaction receipts (issue #370).
 *
 * Produces a single-page, text-only PDF using the built-in Helvetica font,
 * so no third-party dependency is required and output stays well under 500 KB.
 */
import type { ReceiptData } from "@/server/services/transaction-history.service";

/** Escapes characters that are special inside PDF literal strings and drops non-ASCII. */
function pdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function formatDate(date: Date | null): string {
  return date ? new Date(date).toISOString() : "-";
}

/**
 * Renders a receipt as a PDF document.
 *
 * @param receipt - Receipt data returned by `generateReceiptData`.
 * @returns PDF file bytes.
 */
export function renderReceiptPdf(receipt: ReceiptData): Buffer {
  const lines: [string, string][] = [
    ["Gift ID", receipt.giftId],
    ["Amount (NGN)", String(receipt.amountNgn)],
    ["Amount (USDC)", receipt.amountUsdc],
    ["Sender", receipt.senderName || "-"],
    ["Recipient", receipt.recipientName || "-"],
    ["Status", receipt.status],
    ["Payment provider", receipt.provider || "-"],
    ["Provider reference", receipt.providerReference || "-"],
    ["Stellar tx hash", receipt.stellarTxHash ?? "-"],
    ["Created at", formatDate(receipt.createdAt)],
    ["Completed at", formatDate(receipt.completedAt)],
  ];

  const body = [
    "BT /F1 18 Tf 50 790 Td (Lumigift Transaction Receipt) Tj ET",
    ...lines.map(
      ([label, value], i) =>
        `BT /F1 10 Tf 50 ${750 - i * 22} Td (${pdfText(`${label}: ${value}`)}) Tj ET`
    ),
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(body, "latin1")} >>\nstream\n${body}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}
