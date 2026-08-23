package auth

import (
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

const (
	// PasswordMinLength is the shortest password we accept. Long-but-simple
	// beats short-but-clever, so length is the only composition rule.
	PasswordMinLength = 10
	// PasswordMaxLength caps input before it reaches bcrypt. bcrypt silently
	// truncates at 72 bytes, which would make the tail of a longer password
	// meaningless. Reject it instead of pretending it counted.
	PasswordMaxLength = 72
)

// ErrPasswordTooShort and friends are returned by ValidatePassword. The
// messages are user-facing: handlers pass them straight through as 400s.
var (
	ErrPasswordTooShort   = fmt.Errorf("password must be at least %d characters", PasswordMinLength)
	ErrPasswordTooLong    = fmt.Errorf("password must be at most %d bytes", PasswordMaxLength)
	ErrPasswordWhitespace = errors.New("password cannot start or end with whitespace")
)

// ValidatePassword enforces the strength rules for a new password.
func ValidatePassword(password string) error {
	if len(password) > PasswordMaxLength {
		return ErrPasswordTooLong
	}
	if utf8.RuneCountInString(password) < PasswordMinLength {
		return ErrPasswordTooShort
	}
	if strings.TrimSpace(password) != password {
		return ErrPasswordWhitespace
	}
	return nil
}

// HashPassword returns a bcrypt hash suitable for storing in
// "user".password_hash.
func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(hash), nil
}

// VerifyPassword reports whether password matches the stored bcrypt hash.
// An empty hash (account with no password set) never matches.
func VerifyPassword(hash, password string) bool {
	if hash == "" {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
