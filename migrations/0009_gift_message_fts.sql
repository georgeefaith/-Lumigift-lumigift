-- Migration 0009: Full-text search on gift messages (issue #375)
--
-- Replaces ILIKE scans with a tsvector column kept in sync by a trigger and
-- backed by a GIN index. Verify with:
--   EXPLAIN SELECT id FROM gifts WHERE message_tsv @@ to_tsquery('english', 'birthday');
-- which should show a Bitmap Index Scan on idx_gifts_message_tsv.

ALTER TABLE gifts
  ADD COLUMN IF NOT EXISTS message_tsv TSVECTOR;

CREATE OR REPLACE FUNCTION gifts_message_tsv_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.message_tsv := to_tsvector('english', COALESCE(NEW.message, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gifts_message_tsv ON gifts;
CREATE TRIGGER trg_gifts_message_tsv
  BEFORE INSERT OR UPDATE OF message ON gifts
  FOR EACH ROW EXECUTE FUNCTION gifts_message_tsv_update();

-- Backfill existing rows
UPDATE gifts SET message_tsv = to_tsvector('english', COALESCE(message, ''));

CREATE INDEX IF NOT EXISTS idx_gifts_message_tsv ON gifts USING GIN (message_tsv);

COMMENT ON COLUMN gifts.message_tsv IS 'tsvector of message for full-text search; maintained by trg_gifts_message_tsv';
