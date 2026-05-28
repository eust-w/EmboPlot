package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"emboplot/backend/internal/auth"
	"emboplot/backend/internal/modelgateway"
	"emboplot/backend/internal/models"
	"emboplot/backend/internal/store"
)

type ServerOptions struct {
	AllowedOrigin string
	Logger        *slog.Logger
	Auth          auth.Config
	ModelGateway  modelgateway.Gateway
	Payment       PaymentConfig
}

type Server struct {
	repo          store.Repository
	modelGateway  modelgateway.Gateway
	authManager   *auth.Manager
	allowedOrigin string
	payment       PaymentConfig
	logger        *slog.Logger
}

func NewServer(repo store.Repository, opts ServerOptions) *Server {
	logger := opts.Logger
	if logger == nil {
		logger = slog.Default()
	}
	gateway := opts.ModelGateway
	if gateway == nil {
		gateway = modelgateway.NewFallbackGateway(modelgateway.Config{})
	}
	return &Server{
		repo:          repo,
		modelGateway:  gateway,
		authManager:   auth.NewManager(opts.Auth),
		allowedOrigin: opts.AllowedOrigin,
		payment:       opts.Payment.withDefaults(),
		logger:        logger,
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.setCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	start := time.Now()
	defer func() {
		s.logger.Debug("request completed", "method", r.Method, "path", r.URL.Path, "duration", time.Since(start))
	}()

	if !strings.HasPrefix(r.URL.Path, "/api/") && r.URL.Path != "/api" {
		writeError(w, http.StatusNotFound, "route not found")
		return
	}

	segments := apiSegments(r.URL.Path)
	if len(segments) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"name": "EmboPlot API", "ok": true})
		return
	}

	if !s.isPublicRoute(segments, r.Method) {
		user, err := s.authenticate(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		r = r.WithContext(contextWithUser(r.Context(), user))
	}

	switch segments[0] {
	case "health":
		s.handleHealth(w, r)
	case "auth":
		s.handleAuth(w, r, segments)
	case "bootstrap":
		s.handleBootstrap(w, r)
	case "characters":
		s.handleCharacters(w, r, segments)
	case "stories":
		s.handleStories(w, r, segments)
	case "assets":
		s.handleAssets(w, r)
	case "rooms":
		s.handleRooms(w, r, segments)
	case "profile":
		s.handleProfile(w, r)
	case "points":
		s.handlePoints(w, r, segments)
	case "payments":
		s.handlePayments(w, r, segments)
	case "onboarding":
		s.handleOnboarding(w, r, segments)
	case "exports":
		s.handleExports(w, r, segments)
	case "models":
		s.handleModels(w, r, segments)
	default:
		writeError(w, http.StatusNotFound, "route not found")
	}
}

func (s *Server) setCORS(w http.ResponseWriter) {
	origin := s.allowedOrigin
	if origin == "" {
		origin = "*"
	}
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Access-Control-Expose-Headers", "X-Points-Charged, X-Points-Remaining, X-Points-Reason")
}

func apiSegments(path string) []string {
	trimmed := strings.Trim(strings.TrimPrefix(path, "/api"), "/")
	if trimmed == "" {
		return nil
	}
	return strings.Split(trimmed, "/")
}

func decodeJSON(r *http.Request, out any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	return decoder.Decode(out)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{"error": message})
}

func statusFromError(err error) int {
	if errors.Is(err, store.ErrNotFound) {
		return http.StatusNotFound
	}
	if errors.Is(err, store.ErrDuplicate) {
		return http.StatusConflict
	}
	if errors.Is(err, store.ErrPublishedLocked) {
		return http.StatusConflict
	}
	if errors.Is(err, store.ErrInsufficientPoints) {
		return http.StatusPaymentRequired
	}
	return http.StatusInternalServerError
}

func (s *Server) isPublicRoute(segments []string, method string) bool {
	if len(segments) == 0 {
		return true
	}
	if segments[0] == "health" || segments[0] == "auth" {
		return true
	}
	if len(segments) == 3 && segments[0] == "payments" && segments[1] == "hupijiao" && segments[2] == "notify" && method == http.MethodPost {
		return true
	}
	return segments[0] == "models" && len(segments) == 2 && segments[1] == "capabilities" && method == http.MethodGet
}

func (s *Server) authenticate(r *http.Request) (models.User, error) {
	cookie, err := r.Cookie(s.authManager.CookieName())
	if err != nil {
		return models.User{}, err
	}
	claims, err := s.authManager.Verify(cookie.Value)
	if err != nil {
		return models.User{}, err
	}
	return s.repo.GetUserByID(r.Context(), claims.Subject)
}
