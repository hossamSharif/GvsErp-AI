-- Sets the passwords of the Supabase service roles to POSTGRES_PASSWORD.
-- Runs once, when the database volume is first created.
-- Adapted from github.com/supabase/supabase/blob/master/docker/volumes/db/roles.sql
-- (supabase_functions_admin removed: Edge Functions are not part of the local edition).
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER pgbouncer WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';
