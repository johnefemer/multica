-- name: CreateCliAuthCode :exec
INSERT INTO cli_auth_code (code, state, jwt, expires_at)
VALUES ($1, $2, $3, $4);

-- name: ConsumeCliAuthCode :one
DELETE FROM cli_auth_code
WHERE code = $1
  AND state = $2
  AND expires_at > now()
RETURNING jwt;

-- name: PurgeExpiredCliAuthCodes :exec
DELETE FROM cli_auth_code
WHERE expires_at <= now();
