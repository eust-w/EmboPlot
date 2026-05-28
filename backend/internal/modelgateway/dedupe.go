package modelgateway

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"emboplot/backend/internal/models"
)

const recentContentBlacklistLimit = 8

func recentContentBlacklist(lines []models.ScriptLine) []string {
	start := 0
	if len(lines) > recentContentBlacklistLimit {
		start = len(lines) - recentContentBlacklistLimit
	}
	seen := make(map[string]bool, len(lines)-start)
	items := make([]string, 0, len(lines)-start)
	for _, line := range lines[start:] {
		content := strings.TrimSpace(line.Content)
		key := normalizeRepeatContent(content)
		if content == "" || key == "" || seen[key] {
			continue
		}
		seen[key] = true
		items = append(items, truncateRunes(content, 90))
	}
	return items
}

func isRecentDuplicateContent(content string, lines []models.ScriptLine) bool {
	current := normalizeRepeatContent(content)
	if current == "" {
		return false
	}
	start := 0
	if len(lines) > recentContentBlacklistLimit {
		start = len(lines) - recentContentBlacklistLimit
	}
	for _, line := range lines[start:] {
		previous := normalizeRepeatContent(line.Content)
		if previous == "" {
			continue
		}
		if current == previous || nearRepeat(current, previous) {
			return true
		}
	}
	return false
}

func normalizeRepeatContent(value string) string {
	var builder strings.Builder
	for _, r := range strings.TrimSpace(value) {
		if unicode.IsSpace(r) || unicode.IsPunct(r) || unicode.IsSymbol(r) {
			continue
		}
		builder.WriteRune(unicode.ToLower(r))
	}
	return builder.String()
}

func nearRepeat(a string, b string) bool {
	aLen := utf8.RuneCountInString(a)
	bLen := utf8.RuneCountInString(b)
	if aLen < 18 || bLen < 18 {
		return false
	}
	shorter, longer := a, b
	shorterLen, longerLen := aLen, bLen
	if aLen > bLen {
		shorter, longer = b, a
		shorterLen, longerLen = bLen, aLen
	}
	if float64(shorterLen)/float64(longerLen) < 0.85 {
		return false
	}
	return strings.Contains(longer, shorter)
}
