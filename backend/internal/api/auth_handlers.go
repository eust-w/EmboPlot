package api

import (
	"errors"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"emboplot/backend/internal/auth"
	"emboplot/backend/internal/models"
	"emboplot/backend/internal/store"
)

type authResponse struct {
	User models.PublicUser `json:"user"`
}

type credentialsRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Nickname string `json:"nickname,omitempty"`
}

func (s *Server) handleAuth(w http.ResponseWriter, r *http.Request, segments []string) {
	if len(segments) != 2 {
		writeError(w, http.StatusNotFound, "route not found")
		return
	}

	switch segments[1] {
	case "register":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		s.handleRegister(w, r)
	case "login":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		s.handleLogin(w, r)
	case "logout":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		s.clearSessionCookie(w)
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	case "session":
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		user, err := s.authenticate(r)
		if err != nil {
			writeJSON(w, http.StatusOK, map[string]any{"user": nil})
			return
		}
		writeJSON(w, http.StatusOK, authResponse{User: user.Public()})
	case "me":
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		user, err := s.authenticate(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		writeJSON(w, http.StatusOK, authResponse{User: user.Public()})
	default:
		writeError(w, http.StatusNotFound, "route not found")
	}
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req credentialsRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	email, err := normalizeEmail(req.Email)
	if err != nil {
		writeError(w, http.StatusBadRequest, "valid email is required")
		return
	}
	if err := validatePassword(req.Password); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create password hash")
		return
	}

	now := time.Now().UTC()
	nickname := strings.TrimSpace(req.Nickname)
	if nickname == "" {
		nickname = "新导演"
	}
	user, err := s.repo.CreateUser(r.Context(), models.User{
		ID:           store.NewID("user"),
		Email:        email,
		PasswordHash: passwordHash,
		UID:          store.NewUID(),
		Nickname:     nickname,
		AvatarChar:   firstAvatarChar(nickname),
		Signature:    "用文字编织平行时空的导演。",
		Tags:         []string{"新导演"},
		Points:       300,
		Status:       "active",
		CreatedAt:    now,
		UpdatedAt:    now,
		LastLoginAt:  now,
	})
	if err != nil {
		writeError(w, statusFromError(err), err.Error())
		return
	}
	if err := s.setSessionCookie(w, user); err != nil {
		writeError(w, http.StatusInternalServerError, "could not issue session")
		return
	}
	writeJSON(w, http.StatusCreated, authResponse{User: user.Public()})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req credentialsRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	email, err := normalizeEmail(req.Email)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	user, err := s.repo.GetUserByEmail(r.Context(), email)
	if err != nil || !auth.CheckPassword(user.PasswordHash, req.Password) {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	user.LastLoginAt = time.Now().UTC()
	user.UpdatedAt = user.LastLoginAt
	user, err = s.repo.UpdateUser(r.Context(), user)
	if err != nil {
		writeError(w, statusFromError(err), err.Error())
		return
	}
	if err := s.setSessionCookie(w, user); err != nil {
		writeError(w, http.StatusInternalServerError, "could not issue session")
		return
	}
	writeJSON(w, http.StatusOK, authResponse{User: user.Public()})
}

func (s *Server) setSessionCookie(w http.ResponseWriter, user models.User) error {
	token, err := s.authManager.Sign(user.ID, user.Email)
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     s.authManager.CookieName(),
		Value:    token,
		Path:     "/",
		MaxAge:   int(s.authManager.TokenTTL().Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.authManager.CookieSecure(),
	})
	return nil
}

func (s *Server) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     s.authManager.CookieName(),
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.authManager.CookieSecure(),
	})
}

func normalizeEmail(value string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(value))
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email || !strings.Contains(email, "@") {
		return "", errors.New("invalid email")
	}
	return email, nil
}

func validatePassword(password string) error {
	if len(password) < 8 {
		return errors.New("password must be at least 8 characters")
	}
	return nil
}

func firstAvatarChar(value string) string {
	trimmed := strings.TrimSpace(value)
	for _, r := range trimmed {
		return strings.ToUpper(string(r))
	}
	return "E"
}
