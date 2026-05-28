package auth

import (
	"testing"
	"time"
)

func TestManagerSignsAndVerifiesToken(t *testing.T) {
	manager := NewManager(Config{JWTSecret: "test-secret", TokenTTL: time.Hour})

	token, err := manager.Sign("user_1", "director@example.com")
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	claims, err := manager.Verify(token)
	if err != nil {
		t.Fatalf("verify token: %v", err)
	}
	if claims.Subject != "user_1" || claims.Email != "director@example.com" {
		t.Fatalf("unexpected claims: %+v", claims)
	}
}

func TestManagerRejectsTamperedToken(t *testing.T) {
	manager := NewManager(Config{JWTSecret: "test-secret", TokenTTL: time.Hour})
	token, err := manager.Sign("user_1", "director@example.com")
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	if _, err := manager.Verify(token + "x"); err != ErrInvalidToken {
		t.Fatalf("expected invalid token error, got %v", err)
	}
}

func TestPasswordHashRoundTrip(t *testing.T) {
	hash, err := HashPassword("strong-password")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	if !CheckPassword(hash, "strong-password") {
		t.Fatal("expected password to match hash")
	}
	if CheckPassword(hash, "wrong-password") {
		t.Fatal("expected wrong password to fail")
	}
}
