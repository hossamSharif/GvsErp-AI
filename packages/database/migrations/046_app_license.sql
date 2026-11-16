-- 046_app_license.sql
--
-- Local edition license storage (see apps/api/src/services/license.service.ts).
-- One row per installation. Only the API's service role may read or write it:
-- RLS is on with no policies, and anon/authenticated have no privileges, so
-- signed-in users can't change the license or the clock data through the data API.
--
-- Unused (stays empty) in the cloud.

CREATE TABLE IF NOT EXISTS app_license (
    id            SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    license_key   TEXT,
    installed_at  TIMESTAMPTZ,
    last_seen_at  TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_license ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_license FROM anon, authenticated;
GRANT ALL ON app_license TO service_role;
