-- Migration: recipient reactions / thank-you notes
-- Issue #343: Add gift reaction and thank-you note from recipient
--
-- One reaction per gift (PK on gift_id). Rows are insert-only: the application
-- never updates them, and the trigger below rejects any UPDATE.

CREATE TABLE IF NOT EXISTS gift_reactions (
  gift_id     TEXT        PRIMARY KEY,
  emoji       TEXT        NOT NULL,
  message     TEXT        CHECK (message IS NULL OR char_length(message) <= 280),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION reject_gift_reaction_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'gift_reactions are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_gift_reactions_immutable ON gift_reactions;
CREATE TRIGGER trg_gift_reactions_immutable
  BEFORE UPDATE ON gift_reactions
  FOR EACH ROW EXECUTE FUNCTION reject_gift_reaction_update();
