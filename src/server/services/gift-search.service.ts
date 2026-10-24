/**
 * Gift message search service — issue #375
 *
 * Uses PostgreSQL full-text search (tsvector/tsquery) on `gifts.message_tsv`
 * instead of ILIKE so queries hit the GIN index and results are ranked.
 */
import pool from "@/lib/db";

export interface GiftSearchResult {
  id: string;
  message: string | null;
  rank: number;
}

/**
 * Converts free-form user input into a safe `to_tsquery` expression:
 * each word becomes a prefix term, joined with AND.
 */
export function toTsQuery(input: string): string {
  return input
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean)
    .map((term) => `${term}:*`)
    .join(" & ");
}

/**
 * Searches gift messages for a sender, ordered by relevance.
 *
 * @param senderId - UUID of the gift sender.
 * @param query - Raw search text.
 * @param limit - Max rows to return (capped at 100).
 */
export async function searchGiftMessages(
  senderId: string,
  query: string,
  limit = 20
): Promise<GiftSearchResult[]> {
  const tsQuery = toTsQuery(query);
  if (!tsQuery) return [];

  const result = await pool.query<GiftSearchResult>(
    "SELECT id, message, ts_rank(message_tsv, q) AS rank " +
      "FROM gifts, to_tsquery('english', $2) AS q " +
      "WHERE sender_id = $1 AND message_tsv @@ q " +
      "ORDER BY rank DESC LIMIT $3",
    [senderId, tsQuery, Math.min(limit, 100)]
  );

  return result.rows;
}
