-- 000_prerequisites.sql
--
-- Objects that later migrations depend on but that were never captured in a
-- migration (they were created by hand in the cloud database). Without this
-- file the migrations cannot be applied to a fresh database (local edition,
-- staging, CI). Safe to run on a database that already has them.

-- Generic "touch updated_at" trigger function. Used by triggers in 005, 006,
-- 009, 011, 012, 021, 022, 025 and 037. Same body as update_updated_at() in 001.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
