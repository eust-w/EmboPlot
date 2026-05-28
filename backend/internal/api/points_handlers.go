package api

import (
	"net/http"
	"strconv"
)

func (s *Server) handlePoints(w http.ResponseWriter, r *http.Request, segments []string) {
	if len(segments) != 2 || segments[1] != "transactions" {
		writeError(w, http.StatusNotFound, "route not found")
		return
	}
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	limit := 50
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "limit must be a number")
			return
		}
		limit = parsed
	}
	items, err := s.repo.ListPointTransactions(r.Context(), currentUserID(r.Context()), limit)
	if err != nil {
		writeError(w, statusFromError(err), err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}
