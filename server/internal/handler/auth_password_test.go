package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/multica-ai/multica/server/internal/auth"
	"golang.org/x/crypto/bcrypt"
)

const (
	passwordTestEmail    = "password-login-test@multica.ai"
	passwordTestPassword = "correct horse battery"
)

// seedPasswordUser creates a user with a known password and returns its id.
func seedPasswordUser(t *testing.T, email, password string) string {
	t.Helper()
	ctx := context.Background()

	hash := ""
	if password != "" {
		var err error
		hash, err = auth.HashPassword(password)
		if err != nil {
			t.Fatalf("HashPassword: %v", err)
		}
	}

	var userID string
	err := testPool.QueryRow(ctx, `
		INSERT INTO "user" (name, email, password_hash)
		VALUES ($1, $2, NULLIF($3, ''))
		RETURNING id
	`, "Password Test User", email, hash).Scan(&userID)
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})
	return userID
}

func postLogin(t *testing.T, email, password string) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	json.NewEncoder(&buf).Encode(map[string]string{"email": email, "password": password})
	req := httptest.NewRequest("POST", "/auth/login", &buf)
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "10.11.12.13:4242"
	w := httptest.NewRecorder()
	testHandler.PasswordLogin(w, req)
	return w
}

// bcryptDecoyHash has to be a real hash, otherwise the timing-equalising
// compare on the failure paths returns instantly and defeats its purpose.
func TestBcryptDecoyHashIsValid(t *testing.T) {
	if _, err := bcrypt.Cost([]byte(bcryptDecoyHash)); err != nil {
		t.Fatalf("decoy hash is not a valid bcrypt hash: %v", err)
	}
}

func TestPasswordLoginSuccess(t *testing.T) {
	seedPasswordUser(t, passwordTestEmail, passwordTestPassword)
	passwordLimiter.reset(passwordTestEmail + "|10.11.12.13")

	w := postLogin(t, passwordTestEmail, passwordTestPassword)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp LoginResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Token == "" {
		t.Fatal("expected a token")
	}
	if resp.User.Email != passwordTestEmail {
		t.Fatalf("expected email %q, got %q", passwordTestEmail, resp.User.Email)
	}
	if !resp.User.HasPassword {
		t.Fatal("expected has_password=true")
	}
	if !bytes.Contains([]byte(w.Header().Get("Set-Cookie")), []byte(auth.AuthCookieName)) {
		t.Fatalf("expected the auth cookie to be set, got %q", w.Header().Values("Set-Cookie"))
	}
}

func TestPasswordLoginIsCaseInsensitiveOnEmail(t *testing.T) {
	const email = "password-case-test@multica.ai"
	seedPasswordUser(t, email, passwordTestPassword)
	passwordLimiter.reset("password-case-test@multica.ai|10.11.12.13")

	w := postLogin(t, "  Password-Case-Test@Multica.AI  ", passwordTestPassword)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPasswordLoginWrongPassword(t *testing.T) {
	const email = "password-wrong-test@multica.ai"
	seedPasswordUser(t, email, passwordTestPassword)
	passwordLimiter.reset(email + "|10.11.12.13")
	t.Cleanup(func() { passwordLimiter.reset(email + "|10.11.12.13") })

	w := postLogin(t, email, "definitely not it")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
	if got := errorMessage(t, w); got != "invalid email or password" {
		t.Fatalf("unexpected error message %q", got)
	}
}

// An account with no password must fail exactly like a wrong password, so the
// endpoint can't be used to tell which accounts exist.
func TestPasswordLoginNoPasswordSetIsIndistinguishable(t *testing.T) {
	const email = "password-none-test@multica.ai"
	seedPasswordUser(t, email, "")
	passwordLimiter.reset(email + "|10.11.12.13")
	t.Cleanup(func() { passwordLimiter.reset(email + "|10.11.12.13") })

	w := postLogin(t, email, passwordTestPassword)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
	if got := errorMessage(t, w); got != "invalid email or password" {
		t.Fatalf("unexpected error message %q", got)
	}
}

func TestPasswordLoginUnknownUserDoesNotCreateAccount(t *testing.T) {
	const email = "password-unknown-test@multica.ai"
	passwordLimiter.reset(email + "|10.11.12.13")
	t.Cleanup(func() { passwordLimiter.reset(email + "|10.11.12.13") })

	w := postLogin(t, email, passwordTestPassword)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}

	var count int
	if err := testPool.QueryRow(context.Background(),
		`SELECT count(*) FROM "user" WHERE email = $1`, email).Scan(&count); err != nil {
		t.Fatalf("count users: %v", err)
	}
	if count != 0 {
		t.Fatalf("password login created %d account(s); signup must stay on the verified flows", count)
	}
}

func TestPasswordLoginRateLimit(t *testing.T) {
	const email = "password-throttle-test@multica.ai"
	seedPasswordUser(t, email, passwordTestPassword)
	key := email + "|10.11.12.13"
	passwordLimiter.reset(key)
	t.Cleanup(func() { passwordLimiter.reset(key) })

	for i := 0; i < passwordAttemptsPerKey; i++ {
		if w := postLogin(t, email, "wrong password here"); w.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: expected 401, got %d", i+1, w.Code)
		}
	}

	// Cap reached: even the correct password is refused until the window rolls.
	w := postLogin(t, email, passwordTestPassword)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 after %d failures, got %d: %s", passwordAttemptsPerKey, w.Code, w.Body.String())
	}
}

func TestPasswordLoginMissingFields(t *testing.T) {
	if w := postLogin(t, "", passwordTestPassword); w.Code != http.StatusBadRequest {
		t.Fatalf("empty email: expected 400, got %d", w.Code)
	}
	if w := postLogin(t, passwordTestEmail, ""); w.Code != http.StatusBadRequest {
		t.Fatalf("empty password: expected 400, got %d", w.Code)
	}
}

func TestSetPasswordFirstTimeNeedsNoCurrentPassword(t *testing.T) {
	const newPassword = "brand new password"
	t.Cleanup(func() {
		testPool.Exec(context.Background(),
			`UPDATE "user" SET password_hash = NULL WHERE id = $1`, testUserID)
	})

	req := newRequest("PUT", "/api/me/password", map[string]string{"new_password": newPassword})
	w := httptest.NewRecorder()
	testHandler.SetPassword(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp UserResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !resp.HasPassword {
		t.Fatal("expected has_password=true after setting a password")
	}

	// The response must never carry the hash, under any key.
	if bytes.Contains(w.Body.Bytes(), []byte("$2a$")) {
		t.Fatal("response leaked the bcrypt hash")
	}

	user, err := testHandler.Queries.GetUser(context.Background(), parseUUID(testUserID))
	if err != nil {
		t.Fatalf("GetUser: %v", err)
	}
	if !auth.VerifyPassword(user.PasswordHash.String, newPassword) {
		t.Fatal("stored hash does not verify against the new password")
	}
}

func TestSetPasswordChangeRequiresCurrentPassword(t *testing.T) {
	const oldPassword = "the old password"
	const newPassword = "the new password"

	hash, err := auth.HashPassword(oldPassword)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if _, err := testPool.Exec(context.Background(),
		`UPDATE "user" SET password_hash = $2 WHERE id = $1`, testUserID, hash); err != nil {
		t.Fatalf("seed password: %v", err)
	}
	t.Cleanup(func() {
		testPool.Exec(context.Background(),
			`UPDATE "user" SET password_hash = NULL WHERE id = $1`, testUserID)
		passwordLimiter.reset("user:" + testUserID)
	})

	// Wrong current password is refused and leaves the stored hash alone.
	req := newRequest("PUT", "/api/me/password", map[string]string{
		"current_password": "not the old password",
		"new_password":     newPassword,
	})
	w := httptest.NewRecorder()
	testHandler.SetPassword(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}

	user, err := testHandler.Queries.GetUser(context.Background(), parseUUID(testUserID))
	if err != nil {
		t.Fatalf("GetUser: %v", err)
	}
	if !auth.VerifyPassword(user.PasswordHash.String, oldPassword) {
		t.Fatal("a rejected change must not touch the stored password")
	}

	// Correct current password goes through.
	req = newRequest("PUT", "/api/me/password", map[string]string{
		"current_password": oldPassword,
		"new_password":     newPassword,
	})
	w = httptest.NewRecorder()
	testHandler.SetPassword(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	user, err = testHandler.Queries.GetUser(context.Background(), parseUUID(testUserID))
	if err != nil {
		t.Fatalf("GetUser: %v", err)
	}
	if !auth.VerifyPassword(user.PasswordHash.String, newPassword) {
		t.Fatal("stored hash does not verify against the new password")
	}
}

func TestSetPasswordRejectsWeakPassword(t *testing.T) {
	// Independent of the other tests' cleanup order.
	if _, err := testPool.Exec(context.Background(),
		`UPDATE "user" SET password_hash = NULL WHERE id = $1`, testUserID); err != nil {
		t.Fatalf("clear password: %v", err)
	}

	req := newRequest("PUT", "/api/me/password", map[string]string{"new_password": "short"})
	w := httptest.NewRecorder()
	testHandler.SetPassword(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}

	user, err := testHandler.Queries.GetUser(context.Background(), parseUUID(testUserID))
	if err != nil {
		t.Fatalf("GetUser: %v", err)
	}
	if user.PasswordHash.Valid {
		t.Fatal("a rejected password must not be stored")
	}
}

func TestSetPasswordRequiresAuth(t *testing.T) {
	var buf bytes.Buffer
	json.NewEncoder(&buf).Encode(map[string]string{"new_password": "a good long password"})
	req := httptest.NewRequest("PUT", "/api/me/password", &buf)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	testHandler.SetPassword(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

func errorMessage(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode error body %q: %v", w.Body.String(), err)
	}
	return resp["error"]
}
