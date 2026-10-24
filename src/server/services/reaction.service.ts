/**
 * Gift Reaction Service
 *
 * After claiming, a recipient may send one emoji reaction plus an optional
 * thank-you note. Reactions are immutable once submitted and the note is run
 * through a profanity filter before storage. The sender is notified by SMS.
 *
 * Issue #343: [product] Add gift reaction and thank-you note from recipient
 */

import pool from "@/lib/db";
import { sendGiftReactionNotification } from "@/lib/sms";
import { stripHtmlTags } from "@/lib/sanitize";
import type { Gift } from "@/types";
import type { ALLOWED_REACTIONS } from "@/types/schemas";

export type ReactionEmoji = (typeof ALLOWED_REACTIONS)[number];

export interface GiftReaction {
  giftId: string;
  emoji: ReactionEmoji;
  message?: string;
  createdAt: Date;
}

const PROFANITY = [
  "fuck",
  "shit",
  "bitch",
  "bastard",
  "asshole",
  "dick",
  "cunt",
  "motherfucker",
  "slut",
  "whore",
];
const PROFANITY_RE = new RegExp(`\\b(${PROFANITY.join("|")})\\w*`, "gi");

/** Masks profane words, keeping the first letter (e.g. "shit" → "s***"). */
export function filterProfanity(text: string): string {
  return text.replace(PROFANITY_RE, (word) => word[0] + "*".repeat(word.length - 1));
}

export async function getReaction(giftId: string): Promise<GiftReaction | null> {
  const { rows } = await pool.query<{
    gift_id: string;
    emoji: ReactionEmoji;
    message: string | null;
    created_at: Date;
  }>("SELECT gift_id, emoji, message, created_at FROM gift_reactions WHERE gift_id = $1", [giftId]);
  const row = rows[0];
  if (!row) return null;
  return {
    giftId: row.gift_id,
    emoji: row.emoji,
    message: row.message ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Stores the recipient's reaction. Returns null if a reaction already exists
 * (reactions cannot be edited after submission).
 */
export async function createReaction(
  gift: Gift,
  emoji: ReactionEmoji,
  message?: string
): Promise<GiftReaction | null> {
  const cleaned = message ? filterProfanity(stripHtmlTags(message)?.trim() ?? "") : "";

  const { rows } = await pool.query<{ created_at: Date }>(
    "INSERT INTO gift_reactions (gift_id, emoji, message) VALUES ($1, $2, $3) " +
      "ON CONFLICT (gift_id) DO NOTHING RETURNING created_at",
    [gift.id, emoji, cleaned || null]
  );
  if (!rows[0]) return null;

  // Fire-and-forget sender notification — never block the recipient on SMS.
  pool
    .query<{ phone: string }>("SELECT phone FROM users WHERE id = $1", [gift.senderId])
    .then(({ rows: users }) =>
      users[0]
        ? sendGiftReactionNotification(users[0].phone, gift.recipientName, emoji, gift.id)
        : undefined
    )
    .catch((err: unknown) => console.error("[reaction] sender notification failed:", err));

  return { giftId: gift.id, emoji, message: cleaned || undefined, createdAt: rows[0].created_at };
}
