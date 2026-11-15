-- Stores the JWT expiry as a database setting. Runs once, on first database creation.
-- From github.com/supabase/supabase/blob/master/docker/volumes/db/jwt.sql
\set jwt_exp `echo "$JWT_EXP"`

ALTER DATABASE postgres SET "app.settings.jwt_exp" TO :'jwt_exp';
