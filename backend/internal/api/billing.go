package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"emboplot/backend/internal/models"
)

const (
	pointsScriptGenerate   = 8
	pointsCharacterParse   = 15
	pointsCharacterDraft   = 12
	pointsStoryDraft       = 12
	pointsImageGenerate    = 30
	pointsImageEdit        = 35
	pointsSpeechUnit       = 2
	pointsTranscribe       = 10
	pointsEmbedPerText     = 1
	pointsModerate         = 1
	pointsVision           = 12
	speechBillingUnitRunes = 80
)

type aiCharge struct {
	Reason   string
	Points   int
	Metadata map[string]string
}

func (s *Server) reserveAICharge(w http.ResponseWriter, r *http.Request, charge aiCharge) (func(error), bool) {
	if charge.Points <= 0 {
		return func(error) {}, true
	}
	userID := currentUserID(r.Context())
	profile, err := s.repo.DebitPoints(r.Context(), userID, charge.Points, charge.Reason, charge.Metadata)
	if err != nil {
		writeError(w, statusFromError(err), err.Error())
		return nil, false
	}
	finalized := false
	return func(operationErr error) {
		if finalized {
			return
		}
		finalized = true
		if operationErr != nil {
			if _, refundErr := s.repo.CreditPoints(r.Context(), userID, charge.Points, "refund:"+charge.Reason, charge.Metadata); refundErr != nil {
				s.logger.Warn("failed to refund points", "userId", userID, "points", charge.Points, "reason", charge.Reason, "error", refundErr)
			}
			return
		}
		writePointHeaders(w, charge, profile.Points)
	}, true
}

func writePointHeaders(w http.ResponseWriter, charge aiCharge, remaining int) {
	w.Header().Set("X-Points-Charged", strconv.Itoa(charge.Points))
	w.Header().Set("X-Points-Remaining", strconv.Itoa(remaining))
	w.Header().Set("X-Points-Reason", charge.Reason)
}

func speechPoints(text string) int {
	runes := utf8.RuneCountInString(strings.TrimSpace(text))
	if runes == 0 {
		return pointsSpeechUnit
	}
	units := (runes + speechBillingUnitRunes - 1) / speechBillingUnitRunes
	if units < 1 {
		units = 1
	}
	return units * pointsSpeechUnit
}

func embedPoints(texts []string) int {
	count := 0
	for _, text := range texts {
		if strings.TrimSpace(text) != "" {
			count++
		}
	}
	if count == 0 {
		count = 1
	}
	return count * pointsEmbedPerText
}

func audioExportPoints(lines []models.ScriptLine) int {
	total := 0
	for _, line := range lines {
		if strings.TrimSpace(line.AudioURL) != "" {
			continue
		}
		text := speechTextForExportLine(line)
		if text == "" {
			continue
		}
		total += speechPoints(text)
	}
	return total
}

func chargeMetadata(path string, extra map[string]string) map[string]string {
	metadata := map[string]string{"path": path}
	for key, value := range extra {
		if strings.TrimSpace(value) == "" {
			continue
		}
		metadata[key] = value
	}
	return metadata
}

func chargeReason(name string) string {
	return fmt.Sprintf("ai:%s", name)
}
