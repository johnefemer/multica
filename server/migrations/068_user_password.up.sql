-- Password-based login. Nullable: accounts created through the email-code
-- or Google flows have no password until the user sets one, and those flows
-- keep working unchanged. Stores a bcrypt hash, never the password.
ALTER TABLE "user"
    ADD COLUMN password_hash TEXT;
