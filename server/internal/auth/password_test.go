package auth

import (
	"strings"
	"testing"
)

func TestValidatePassword(t *testing.T) {
	tests := []struct {
		name     string
		password string
		wantErr  error
	}{
		{"ok_min_length", "correct-ho", nil},
		{"ok_long", "correct horse battery staple", nil},
		{"ok_unicode_counts_runes", "pässwörtli", nil}, // 10 runes, 13 bytes
		{"too_short", "short1234", ErrPasswordTooShort},
		{"empty", "", ErrPasswordTooShort},
		{"too_long", strings.Repeat("a", 73), ErrPasswordTooLong},
		{"leading_space", " leadingspace", ErrPasswordWhitespace},
		{"trailing_newline", "trailingnl\n", ErrPasswordWhitespace},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePassword(tt.password)
			if err != tt.wantErr {
				t.Fatalf("got err=%v want=%v", err, tt.wantErr)
			}
		})
	}
}

func TestHashAndVerifyPassword(t *testing.T) {
	const password = "correct horse battery staple"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if hash == password {
		t.Fatal("hash must not equal the plaintext password")
	}
	if !VerifyPassword(hash, password) {
		t.Fatal("VerifyPassword rejected the correct password")
	}
	if VerifyPassword(hash, password+"x") {
		t.Fatal("VerifyPassword accepted a wrong password")
	}
}

func TestHashPasswordIsSalted(t *testing.T) {
	const password = "correct horse battery staple"

	a, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	b, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if a == b {
		t.Fatal("two hashes of the same password are identical, salt is missing")
	}
}

func TestVerifyPasswordRejectsEmptyHash(t *testing.T) {
	if VerifyPassword("", "") {
		t.Fatal("empty hash must never verify")
	}
	if VerifyPassword("", "anything") {
		t.Fatal("empty hash must never verify")
	}
	if VerifyPassword("not-a-bcrypt-hash", "anything") {
		t.Fatal("malformed hash must never verify")
	}
}
