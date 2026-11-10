-- Workers Free caps WebCrypto PBKDF2 at 100k iterations; the app needs
-- 210k. Verification therefore runs bcrypt (cost 12) inside Postgres via
-- pgcrypto, on a peppered HMAC of the PIN — the raw PIN never reaches the DB.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
