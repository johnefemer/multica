-- Short-lived rendezvous table for the headless CLI device-code login flow.
--
-- Flow:
--   1. CLI prints the login URL with cli_state=<random-verifier>, no cli_callback.
--   2. After the user logs in, the frontend POSTs to /api/auth/cli/codes with
--      the verifier, server stores (code, state, jwt) and returns the opaque
--      `code` to display.
--   3. User pastes `code` into the CLI; CLI POSTs to /api/auth/cli/exchange
--      with {code, state}; server atomically deletes the row and returns jwt.
--   4. CLI does its existing JWT → PAT exchange.
--
-- Rows are one-shot and TTL-capped (5 min). UNIQUE on state ensures a
-- racing attacker who guessed the state cannot insert a competing pairing
-- under the legitimate user's session.
CREATE TABLE cli_auth_code (
    code        TEXT        PRIMARY KEY,
    state       TEXT        NOT NULL UNIQUE,
    jwt         TEXT        NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cli_auth_code_expires_at ON cli_auth_code(expires_at);
