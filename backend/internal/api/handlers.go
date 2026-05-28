package api

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"emboplot/backend/internal/models"
	"emboplot/backend/internal/store"
)

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleBootstrap(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	payload, err := s.repo.Bootstrap(r.Context(), currentUserID(r.Context()))
	if err != nil {
		writeError(w, statusFromError(err), err.Error())
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

func (s *Server) handleCharacters(w http.ResponseWriter, r *http.Request, segments []string) {
	if len(segments) == 1 {
		switch r.Method {
		case http.MethodGet:
			scope := r.URL.Query().Get("scope")
			if scope == "" {
				scope = "mine"
			}
			items, err := s.repo.ListCharacters(r.Context(), scope, currentUserID(r.Context()))
			if err != nil {
				writeError(w, statusFromError(err), err.Error())
				return
			}
			writeJSON(w, http.StatusOK, items)
		case http.MethodPost:
			var item models.Character
			if err := decodeJSON(r, &item); err != nil {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			saved, err := s.repo.SaveCharacter(r.Context(), currentUserID(r.Context()), item)
			if err != nil {
				writeError(w, statusFromError(err), err.Error())
				return
			}
			writeJSON(w, http.StatusCreated, saved)
		default:
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
		return
	}

	id := segments[1]
	if len(segments) == 2 && r.Method == http.MethodDelete {
		if err := s.repo.DeleteCharacter(r.Context(), currentUserID(r.Context()), id); err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}

	if len(segments) == 2 && r.Method == http.MethodPut {
		var item models.Character
		if err := decodeJSON(r, &item); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		saved, err := s.repo.UpdateCharacter(r.Context(), currentUserID(r.Context()), id, item)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, saved)
		return
	}

	if len(segments) == 3 && segments[2] == "publish" && r.Method == http.MethodPost {
		saved, err := s.repo.PublishCharacter(r.Context(), currentUserID(r.Context()), id)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, saved)
		return
	}
	if len(segments) == 3 && segments[2] == "unpublish" && r.Method == http.MethodPost {
		saved, err := s.repo.UnpublishCharacter(r.Context(), currentUserID(r.Context()), id)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, saved)
		return
	}
	if len(segments) == 3 && segments[2] == "acquire" && r.Method == http.MethodPost {
		saved, err := s.repo.AcquireCharacter(r.Context(), currentUserID(r.Context()), id)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, saved)
		return
	}
	writeError(w, http.StatusNotFound, "route not found")
}

func (s *Server) handleStories(w http.ResponseWriter, r *http.Request, segments []string) {
	if len(segments) == 1 {
		switch r.Method {
		case http.MethodGet:
			scope := r.URL.Query().Get("scope")
			if scope == "" {
				scope = "mine"
			}
			items, err := s.repo.ListStories(r.Context(), scope, currentUserID(r.Context()))
			if err != nil {
				writeError(w, statusFromError(err), err.Error())
				return
			}
			writeJSON(w, http.StatusOK, items)
		case http.MethodPost:
			var item models.StorySetting
			if err := decodeJSON(r, &item); err != nil {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			saved, err := s.repo.SaveStory(r.Context(), currentUserID(r.Context()), item)
			if err != nil {
				writeError(w, statusFromError(err), err.Error())
				return
			}
			writeJSON(w, http.StatusCreated, saved)
		default:
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
		return
	}

	if len(segments) == 2 && r.Method == http.MethodDelete {
		if err := s.repo.DeleteStory(r.Context(), currentUserID(r.Context()), segments[1]); err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}

	if len(segments) == 3 && r.Method == http.MethodPost {
		id := segments[1]
		var (
			saved models.StorySetting
			err   error
		)
		switch segments[2] {
		case "publish":
			saved, err = s.repo.PublishStory(r.Context(), currentUserID(r.Context()), id)
		case "unpublish":
			saved, err = s.repo.UnpublishStory(r.Context(), currentUserID(r.Context()), id)
		case "acquire":
			saved, err = s.repo.AcquireStory(r.Context(), currentUserID(r.Context()), id)
		default:
			writeError(w, http.StatusNotFound, "route not found")
			return
		}
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		if segments[2] == "acquire" {
			writeJSON(w, http.StatusCreated, saved)
			return
		}
		writeJSON(w, http.StatusOK, saved)
		return
	}

	writeError(w, http.StatusNotFound, "route not found")
}

func (s *Server) handleAssets(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	items, err := s.repo.ListAssets(r.Context(), currentUserID(r.Context()))
	if err != nil {
		writeError(w, statusFromError(err), err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

type createRoomRequest struct {
	Title        string              `json:"title"`
	StoryID      string              `json:"storyId"`
	CharacterIDs []string            `json:"characterIds"`
	GameSettings models.GameSettings `json:"gameSettings"`
}

func (s *Server) handleRooms(w http.ResponseWriter, r *http.Request, segments []string) {
	if len(segments) == 1 {
		switch r.Method {
		case http.MethodGet:
			items, err := s.repo.ListRooms(r.Context(), currentUserID(r.Context()))
			if err != nil {
				writeError(w, statusFromError(err), err.Error())
				return
			}
			writeJSON(w, http.StatusOK, items)
		case http.MethodPost:
			var req createRoomRequest
			if err := decodeJSON(r, &req); err != nil {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			room, err := s.buildRoom(r, req)
			if err != nil {
				writeError(w, statusFromError(err), err.Error())
				return
			}
			saved, err := s.repo.SaveRoom(r.Context(), currentUserID(r.Context()), room)
			if err != nil {
				writeError(w, statusFromError(err), err.Error())
				return
			}
			writeJSON(w, http.StatusCreated, saved)
		default:
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
		return
	}

	roomID := segments[1]
	if len(segments) == 2 && r.Method == http.MethodGet {
		room, err := s.repo.GetRoom(r.Context(), currentUserID(r.Context()), roomID)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, room)
		return
	}

	if len(segments) == 2 && r.Method == http.MethodPut {
		var room models.Room
		if err := decodeJSON(r, &room); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		saved, err := s.repo.UpdateRoom(r.Context(), currentUserID(r.Context()), roomID, room)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, saved)
		return
	}

	if len(segments) == 2 && r.Method == http.MethodDelete {
		if err := s.repo.DeleteRoom(r.Context(), currentUserID(r.Context()), roomID); err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}

	if len(segments) == 3 && segments[2] == "lines" && r.Method == http.MethodPost {
		var line models.ScriptLine
		if err := decodeJSON(r, &line); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		room, err := s.repo.AppendLine(r.Context(), currentUserID(r.Context()), roomID, normalizeLine(line))
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, room)
		return
	}

	if len(segments) == 3 && segments[2] == "generate" && r.Method == http.MethodPost {
		room, err := s.repo.GetRoom(r.Context(), currentUserID(r.Context()), roomID)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		var req struct {
			ScriptTimeline   []models.ScriptLine `json:"scriptTimeline"`
			ActiveCharacters []models.Character  `json:"activeCharacters"`
			CharacterIDs     []string            `json:"characterIds"`
			CurrentStory     models.StorySetting `json:"currentStory"`
			GameSettings     models.GameSettings `json:"gameSettings"`
		}
		if r.Body != nil && r.Body != http.NoBody && r.ContentLength != 0 {
			if err := decodeJSON(r, &req); err != nil {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			if len(req.ScriptTimeline) > 0 {
				room.ScriptTimeline = make([]models.ScriptLine, 0, len(req.ScriptTimeline))
				for _, item := range req.ScriptTimeline {
					room.ScriptTimeline = append(room.ScriptTimeline, normalizeLine(item))
				}
			}
			if len(req.ActiveCharacters) > 0 {
				room.ActiveChars = req.ActiveCharacters
				room.CharacterIDs = req.CharacterIDs
				if len(room.CharacterIDs) == 0 {
					room.CharacterIDs = make([]string, 0, len(req.ActiveCharacters))
					for _, character := range req.ActiveCharacters {
						if character.ID != "" {
							room.CharacterIDs = append(room.CharacterIDs, character.ID)
						}
					}
				}
			}
			if req.CurrentStory.ID != "" {
				room.CurrentStory = req.CurrentStory
				room.StoryID = req.CurrentStory.ID
			}
			if req.GameSettings.Language != "" {
				room.GameSettings = req.GameSettings
			}
		}
		finalizeCharge, ok := s.reserveAICharge(w, r, aiCharge{
			Reason: chargeReason("script_generate"),
			Points: pointsScriptGenerate,
			Metadata: chargeMetadata(r.URL.Path, map[string]string{
				"roomId": roomID,
			}),
		})
		if !ok {
			return
		}
		line, err := s.modelGateway.GenerateScriptLine(r.Context(), room)
		if err != nil {
			finalizeCharge(err)
			writeError(w, statusFromError(err), err.Error())
			return
		}
		line = normalizeLine(line)
		if _, err := s.repo.AppendLine(r.Context(), currentUserID(r.Context()), roomID, line); err != nil {
			finalizeCharge(err)
			writeError(w, statusFromError(err), err.Error())
			return
		}
		finalizeCharge(nil)
		writeJSON(w, http.StatusOK, line)
		return
	}

	writeError(w, http.StatusNotFound, "route not found")
}

func (s *Server) buildRoom(r *http.Request, req createRoomRequest) (models.Room, error) {
	if req.StoryID == "" {
		return models.Room{}, fmt.Errorf("storyId is required")
	}
	if len(req.CharacterIDs) == 0 {
		return models.Room{}, fmt.Errorf("at least one character is required")
	}
	userID := currentUserID(r.Context())
	stories, err := s.repo.ListStories(r.Context(), "mine", userID)
	if err != nil {
		return models.Room{}, err
	}
	characters, err := s.repo.ListCharacters(r.Context(), "mine", userID)
	if err != nil {
		return models.Room{}, err
	}

	var story models.StorySetting
	for _, item := range stories {
		if item.ID == req.StoryID {
			story = item
			break
		}
	}
	if story.ID == "" {
		return models.Room{}, store.ErrNotFound
	}

	characterMap := make(map[string]models.Character, len(characters))
	for _, item := range characters {
		characterMap[item.ID] = item
	}
	active := make([]models.Character, 0, len(req.CharacterIDs))
	for _, id := range req.CharacterIDs {
		if item, ok := characterMap[id]; ok {
			active = append(active, item)
		}
	}
	if len(active) == 0 {
		return models.Room{}, store.ErrNotFound
	}

	now := time.Now().UTC()
	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = story.Title
	}
	settings := req.GameSettings
	if settings.Language == "" {
		settings.Language = "Chinese (Simplified)"
	}
	if settings.Pace == "" {
		settings.Pace = "Balanced"
	}
	if settings.Complexity == "" {
		settings.Complexity = "Standard"
	}
	if settings.Mood == "" {
		settings.Mood = "戏剧冲突"
	}
	timeline := []models.ScriptLine{
		{
			ID:        store.NewID("line"),
			Type:      models.LogTypeDirector,
			Content:   fmt.Sprintf("【%s】的故事拉开了帷幕。", story.Title),
			CreatedAt: now.UnixMilli(),
		},
	}
	if strings.TrimSpace(settings.InitialPlot) != "" {
		timeline = append(timeline, models.ScriptLine{
			ID:        store.NewID("line"),
			Type:      models.LogTypeDirector,
			Content:   strings.TrimSpace(settings.InitialPlot),
			CreatedAt: now.UnixMilli(),
		})
	}
	return models.Room{
		Title:          title,
		StoryID:        story.ID,
		CharacterIDs:   req.CharacterIDs,
		CurrentStory:   story,
		ActiveChars:    active,
		GameSettings:   settings,
		ScriptTimeline: timeline,
		Status:         "running",
		CreatedAt:      now,
		UpdatedAt:      now,
	}, nil
}

func (s *Server) handleProfile(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		profile, err := s.repo.GetProfile(r.Context(), currentUserID(r.Context()))
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, profile)
	case http.MethodPatch:
		var profile models.Profile
		if err := decodeJSON(r, &profile); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		updated, err := s.repo.UpdateProfile(r.Context(), currentUserID(r.Context()), profile)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, updated)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleOnboarding(w http.ResponseWriter, r *http.Request, segments []string) {
	if len(segments) != 2 || segments[1] != "parse-character" {
		writeError(w, http.StatusNotFound, "route not found")
		return
	}
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file is required")
		return
	}
	defer file.Close()

	content, _ := io.ReadAll(io.LimitReader(file, 64*1024))
	finalizeCharge, ok := s.reserveAICharge(w, r, aiCharge{
		Reason: chargeReason("character_parse"),
		Points: pointsCharacterParse,
		Metadata: chargeMetadata(r.URL.Path, map[string]string{
			"filename": header.Filename,
		}),
	})
	if !ok {
		return
	}
	parsed, err := s.modelGateway.ParseCharacter(r.Context(), header.Filename, string(content))
	if err != nil {
		finalizeCharge(err)
		writeError(w, statusFromError(err), err.Error())
		return
	}
	finalizeCharge(nil)
	writeJSON(w, http.StatusOK, parsed)
}

func (s *Server) handleExports(w http.ResponseWriter, r *http.Request, segments []string) {
	if len(segments) != 2 {
		writeError(w, http.StatusNotFound, "route not found")
		return
	}
	if segments[1] == "audio" {
		s.handleAudioExport(w, r)
		return
	}
	if segments[1] != "markdown" {
		writeError(w, http.StatusNotFound, "route not found")
		return
	}
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var payload struct {
		Title          string              `json:"title"`
		ScriptTimeline []models.ScriptLine `json:"scriptTimeline"`
	}
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"markdown": renderMarkdown(payload.Title, payload.ScriptTimeline)})
}

func normalizeLine(line models.ScriptLine) models.ScriptLine {
	if line.ID == "" {
		line.ID = store.NewID("line")
	}
	if line.Type == "" {
		line.Type = models.LogTypeUser
	}
	if line.CreatedAt == 0 {
		line.CreatedAt = time.Now().UnixMilli()
	}
	line.Content = strings.TrimSpace(line.Content)
	return line
}

func renderMarkdown(title string, lines []models.ScriptLine) string {
	var builder strings.Builder
	title = strings.TrimSpace(title)
	if title == "" {
		title = "未命名剧本"
	}
	builder.WriteString("# ")
	builder.WriteString(title)
	builder.WriteString("\n\n")
	for _, line := range lines {
		switch line.Type {
		case models.LogTypeDirector:
			builder.WriteString("*")
			builder.WriteString(line.Content)
			builder.WriteString("*")
		case models.LogTypeCharacter:
			builder.WriteString("**")
			builder.WriteString(firstNonEmpty(line.Name, "角色"))
			builder.WriteString("**")
			if label := lineTargetLabel(line); label != "" {
				builder.WriteString(" → ")
				builder.WriteString(label)
			}
			if line.Action != "" {
				builder.WriteString("（")
				builder.WriteString(line.Action)
				builder.WriteString("）")
			}
			builder.WriteString("：")
			builder.WriteString(line.Content)
		default:
			builder.WriteString("> **导演指令**：")
			builder.WriteString(line.Content)
		}
		builder.WriteString("\n\n")
	}
	return builder.String()
}

func lineTargetLabel(line models.ScriptLine) string {
	switch strings.TrimSpace(line.TargetType) {
	case "character":
		target := firstNonEmpty(line.TargetName, "对方")
		if strings.HasPrefix(target, "对") {
			return target
		}
		return "对 " + target
	case "everyone":
		return "对大家"
	case "self":
		return "自言自语"
	case "air":
		return "对空气"
	default:
		return ""
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
