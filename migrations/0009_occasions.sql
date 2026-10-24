-- Migration: saved occasions for gift reminders
-- Issue #341: Add gift reminder scheduling for upcoming occasions
--
-- contact_name is a free-text label chosen by the user (e.g. "Mum") — it is
-- NOT recipient PII: no phone number or email is stored for the contact.

CREATE TABLE IF NOT EXISTS occasions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT        NOT NULL,
  contact_name      TEXT        NOT NULL CHECK (char_length(contact_name) BETWEEN 1 AND 60),
  label             TEXT        NOT NULL CHECK (char_length(label) BETWEEN 1 AND 60),
  -- Month/day of the recurring occasion; the year is ignored when scheduling
  occasion_date     DATE        NOT NULL,
  reminders_enabled BOOLEAN     NOT NULL DEFAULT TRUE,
  last_reminded_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_occasions_user_id ON occasions (user_id);
CREATE INDEX IF NOT EXISTS idx_occasions_reminders
  ON occasions (EXTRACT(MONTH FROM occasion_date), EXTRACT(DAY FROM occasion_date))
  WHERE reminders_enabled;
