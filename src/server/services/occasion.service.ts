/**
 * Occasion Reminder Service
 *
 * Users save recurring occasions (birthday, anniversary…) with a contact label.
 * A daily cron sends an SMS reminder 7 days before each occasion with a deep
 * link to start a new gift. Reminders can be disabled per occasion.
 *
 * Issue #341: [product] Add gift reminder scheduling for upcoming occasions
 */

import pool from "@/lib/db";
import { sendOccasionReminder } from "@/lib/sms";

/** Days before the occasion that the reminder is sent. */
export const REMINDER_LEAD_DAYS = 7;

export interface Occasion {
  id: string;
  userId: string;
  contactName: string;
  label: string;
  /** ISO date (YYYY-MM-DD); only month/day are used for scheduling */
  occasionDate: string;
  remindersEnabled: boolean;
  createdAt: Date;
}

interface OccasionRow {
  id: string;
  user_id: string;
  contact_name: string;
  label: string;
  occasion_date: string;
  reminders_enabled: boolean;
  created_at: Date;
}

const COLUMNS =
  "id, user_id, contact_name, label, to_char(occasion_date, 'YYYY-MM-DD') AS occasion_date, reminders_enabled, created_at";

function toOccasion(row: OccasionRow): Occasion {
  return {
    id: row.id,
    userId: row.user_id,
    contactName: row.contact_name,
    label: row.label,
    occasionDate: row.occasion_date,
    remindersEnabled: row.reminders_enabled,
    createdAt: row.created_at,
  };
}

export async function listOccasions(userId: string): Promise<Occasion[]> {
  const { rows } = await pool.query<OccasionRow>(
    "SELECT " + COLUMNS + " FROM occasions WHERE user_id = $1 ORDER BY occasion_date",
    [userId]
  );
  return rows.map(toOccasion);
}

export async function createOccasion(
  userId: string,
  input: { contactName: string; label: string; occasionDate: string }
): Promise<Occasion> {
  const { rows } = await pool.query<OccasionRow>(
    "INSERT INTO occasions (user_id, contact_name, label, occasion_date) " +
      "VALUES ($1, $2, $3, $4) RETURNING " +
      COLUMNS,
    [userId, input.contactName, input.label, input.occasionDate]
  );
  return toOccasion(rows[0]);
}

/** Toggles reminders for one occasion. Returns null if it does not belong to the user. */
export async function setOccasionReminders(
  userId: string,
  occasionId: string,
  enabled: boolean
): Promise<Occasion | null> {
  const { rows } = await pool.query<OccasionRow>(
    "UPDATE occasions SET reminders_enabled = $3 " +
      "WHERE id = $1 AND user_id = $2 RETURNING " +
      COLUMNS,
    [occasionId, userId, enabled]
  );
  return rows[0] ? toOccasion(rows[0]) : null;
}

export async function deleteOccasion(userId: string, occasionId: string): Promise<boolean> {
  const { rowCount } = await pool.query("DELETE FROM occasions WHERE id = $1 AND user_id = $2", [
    occasionId,
    userId,
  ]);
  return (rowCount ?? 0) > 0;
}

/**
 * Sends reminders for every enabled occasion falling exactly
 * {@link REMINDER_LEAD_DAYS} days from today (UTC). `last_reminded_at` guards
 * against duplicate SMS if the cron fires more than once in a day.
 *
 * @returns Number of reminders sent.
 */
export async function processOccasionReminders(now: Date = new Date()): Promise<number> {
  const target = new Date(now);
  target.setUTCDate(target.getUTCDate() + REMINDER_LEAD_DAYS);

  const { rows } = await pool.query<{
    id: string;
    contact_name: string;
    label: string;
    phone: string;
  }>(
    "SELECT o.id, o.contact_name, o.label, u.phone " +
      "FROM occasions o " +
      "JOIN users u ON u.id = o.user_id " +
      "WHERE o.reminders_enabled " +
      "AND EXTRACT(MONTH FROM o.occasion_date) = $1 " +
      "AND EXTRACT(DAY FROM o.occasion_date) = $2 " +
      "AND (o.last_reminded_at IS NULL OR o.last_reminded_at < NOW() - INTERVAL '1 day')",
    [target.getUTCMonth() + 1, target.getUTCDate()]
  );

  let sent = 0;
  for (const row of rows) {
    try {
      await sendOccasionReminder(row.phone, row.contact_name, row.label, row.id);
      await pool.query("UPDATE occasions SET last_reminded_at = NOW() WHERE id = $1", [row.id]);
      sent++;
    } catch (err) {
      console.error("[occasions] reminder failed", { occasionId: row.id, error: err });
    }
  }
  return sent;
}
