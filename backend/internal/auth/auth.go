package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const defaultCookieName = "emboplot_session"

var ErrInvalidToken = errors.New("invalid auth token")

type Config struct {
	JWTSecret    string
	CookieName   string
	TokenTTL     time.Duration
	CookieSecure bool
}

type Manager struct {
	secret       []byte
	cookieName   string
	tokenTTL     time.Duration
	cookieSecure bool
	now          func() time.Time
}

type Claims struct {
	Subject   string `json:"sub"`
	Email     string `json:"email"`
	IssuedAt  int64  `json:"iat"`
	ExpiresAt int64  `json:"exp"`
}

func NewManager(cfg Config) *Manager {
	if strings.TrimSpace(cfg.JWTSecret) == "" {
		cfg.JWTSecret = "dev-only-change-me"
	}
	if cfg.CookieName == "" {
		cfg.CookieName = defaultCookieName
	}
	if cfg.TokenTTL <= 0 {
		cfg.TokenTTL = 14 * 24 * time.Hour
	}
	return &Manager{
		secret:       []byte(cfg.JWTSecret),
		cookieName:   cfg.CookieName,
		tokenTTL:     cfg.TokenTTL,
		cookieSecure: cfg.CookieSecure,
		now:          time.Now,
	}
}

func (m *Manager) CookieName() string {
	return m.cookieName
}

func (m *Manager) CookieSecure() bool {
	return m.cookieSecure
}

func (m *Manager) TokenTTL() time.Duration {
	return m.tokenTTL
}

func (m *Manager) Sign(userID string, email string) (string, error) {
	now := m.now().UTC()
	claims := Claims{
		Subject:   userID,
		Email:     email,
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(m.tokenTTL).Unix(),
	}

	header := map[string]string{"alg": "HS256", "typ": "JWT"}
	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", err
	}
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	unsigned := base64.RawURLEncoding.EncodeToString(headerJSON) + "." + base64.RawURLEncoding.EncodeToString(claimsJSON)
	signature := m.sign(unsigned)
	return unsigned + "." + signature, nil
}

func (m *Manager) Verify(token string) (Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return Claims{}, ErrInvalidToken
	}
	unsigned := parts[0] + "." + parts[1]
	expected := m.sign(unsigned)
	if !hmac.Equal([]byte(expected), []byte(parts[2])) {
		return Claims{}, ErrInvalidToken
	}

	claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return Claims{}, ErrInvalidToken
	}
	var claims Claims
	if err := json.Unmarshal(claimsBytes, &claims); err != nil {
		return Claims{}, ErrInvalidToken
	}
	if claims.Subject == "" || claims.ExpiresAt <= m.now().Unix() {
		return Claims{}, ErrInvalidToken
	}
	return claims, nil
}

func (m *Manager) sign(unsigned string) string {
	mac := hmac.New(sha256.New, m.secret)
	_, _ = mac.Write([]byte(unsigned))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hash), err
}

func CheckPassword(hash string, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
