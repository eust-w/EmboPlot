package api

import (
	"fmt"
	"net/http"
	"strings"

	"emboplot/backend/internal/modelgateway"
	"emboplot/backend/internal/models"
)

func (s *Server) handleModels(w http.ResponseWriter, r *http.Request, segments []string) {
	if len(segments) < 2 {
		writeError(w, http.StatusNotFound, "route not found")
		return
	}

	switch segments[1] {
	case "capabilities":
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		writeJSON(w, http.StatusOK, s.modelGateway.Capabilities())
	case "image":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var req struct {
			Prompt string `json:"prompt"`
		}
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		result, err := s.modelGateway.GenerateImage(r.Context(), req.Prompt)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, result)
	case "character":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var req modelgateway.CharacterDraftRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		result, err := s.modelGateway.GenerateCharacter(r.Context(), req)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, result)
	case "story":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var req modelgateway.StoryDraftRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		result, err := s.modelGateway.GenerateStory(r.Context(), req)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, result)
	case "character-image":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var req struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			Personality string `json:"personality"`
			Memory      string `json:"memory"`
			Prompt      string `json:"prompt"`
		}
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		result, err := s.modelGateway.GenerateImage(r.Context(), characterImagePrompt(req.Name, req.Description, req.Personality, req.Memory, req.Prompt))
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, result)
	case "story-image":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var req struct {
			Title       string   `json:"title"`
			Description string   `json:"description"`
			Content     string   `json:"content"`
			Tags        []string `json:"tags"`
			Prompt      string   `json:"prompt"`
		}
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		result, err := s.modelGateway.GenerateImage(r.Context(), storyImagePrompt(req.Title, req.Description, req.Content, req.Tags, req.Prompt))
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, result)
	case "image-edit":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var req modelgateway.ImageEditRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		result, err := s.modelGateway.EditImage(r.Context(), req)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, result)
	case "scene-image":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var req struct {
			RoomTitle        string              `json:"roomTitle"`
			StoryTitle       string              `json:"storyTitle"`
			StoryDescription string              `json:"storyDescription"`
			Mood             string              `json:"mood"`
			Lines            []models.ScriptLine `json:"lines"`
		}
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		prompt, err := sceneImagePrompt(req.RoomTitle, req.StoryTitle, req.StoryDescription, req.Mood, req.Lines)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		result, err := s.modelGateway.GenerateImage(r.Context(), prompt)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, result)
	case "speech":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var req struct {
			Text      string `json:"text"`
			VoiceName string `json:"voiceName"`
		}
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		result, err := s.modelGateway.GenerateSpeech(r.Context(), req.Text, req.VoiceName)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, result)
	case "transcribe":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var req struct {
			AudioData string `json:"audioData"`
			Language  string `json:"language"`
		}
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		result, err := s.modelGateway.TranscribeAudio(r.Context(), req.AudioData, req.Language)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, result)
	case "embed":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var req struct {
			Texts []string `json:"texts"`
		}
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		result, err := s.modelGateway.Embed(r.Context(), req.Texts)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, result)
	case "moderate":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var req struct {
			Text string `json:"text"`
		}
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		result, err := s.modelGateway.Moderate(r.Context(), req.Text)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, result)
	case "vision":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var req struct {
			ImageURL string `json:"imageUrl"`
			Prompt   string `json:"prompt"`
		}
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		result, err := s.modelGateway.AnalyzeImage(r.Context(), req.ImageURL, req.Prompt)
		if err != nil {
			writeError(w, statusFromError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, result)
	default:
		writeError(w, http.StatusNotFound, "route not found")
	}
}

func characterImagePrompt(name string, description string, personality string, memory string, prompt string) string {
	return fmt.Sprintf(`为互动剧场角色生成一张头像/半身像。
角色名：%s
角色简介：%s
性格设定：%s
长期记忆：%s
导演补充：%s

画面要求：单人角色头像或半身像，正面或三分之二侧脸，清晰面部特征，电影感概念设计，黑金深空科技美学，高对比暗色背景，琥珀色微光，适合角色卡封面；不要文字、水印、字幕或 UI。`,
		firstNonEmpty(name, "未命名角色"),
		firstNonEmpty(description, "根据角色基础信息生成"),
		firstNonEmpty(personality, "稳定、鲜明、有冲突反应"),
		firstNonEmpty(memory, "保留角色关键经历和关系"),
		firstNonEmpty(prompt, "生成可用于角色卡的视觉形象"),
	)
}

func storyImagePrompt(title string, description string, content string, tags []string, prompt string) string {
	return fmt.Sprintf(`为互动剧场故事背景生成一张封面图。
故事标题：%s
故事简介：%s
完整设定：%s
标签：%s
导演补充：%s

画面要求：横向电影海报构图，表现世界观空间、核心矛盾和情绪基调；黑金/深空科技审美，高对比暗色背景，琥珀色微光，具有可持续剧场推演的场景线索；不要文字、水印、字幕或 UI。`,
		firstNonEmpty(title, "未命名故事背景"),
		firstNonEmpty(description, "根据故事基础信息生成"),
		firstNonEmpty(content, "生成可用于互动剧场初始化的故事空间"),
		firstNonEmpty(strings.Join(tags, "、"), "原创"),
		firstNonEmpty(prompt, "生成故事背景封面"),
	)
}

func sceneImagePrompt(roomTitle string, storyTitle string, storyDescription string, mood string, lines []models.ScriptLine) (string, error) {
	if len(lines) == 0 {
		return "", fmt.Errorf("at least one script line is required")
	}
	parts := make([]string, 0, len(lines))
	for _, line := range lines {
		content := strings.TrimSpace(line.Content)
		if content == "" {
			continue
		}
		speaker := strings.TrimSpace(line.Name)
		if speaker == "" {
			switch line.Type {
			case models.LogTypeDirector:
				speaker = "导演旁白"
			case models.LogTypeUser:
				speaker = "用户指令"
			default:
				speaker = "角色"
			}
		}
		action := strings.TrimSpace(line.Action)
		if action != "" {
			parts = append(parts, fmt.Sprintf("%s（%s）: %s", speaker, action, content))
			continue
		}
		parts = append(parts, fmt.Sprintf("%s: %s", speaker, content))
	}
	if len(parts) == 0 {
		return "", fmt.Errorf("selected script lines have no content")
	}
	return fmt.Sprintf(`为互动剧场生成一张电影感场景图。
剧场：%s
故事：%s
世界观：%s
情绪基调：%s
选中台词：
%s

画面要求：横向 16:9，深空科技感与黑金高对比美学，聚焦当前台词共同表达的场景、人物关系和情绪张力；不要出现文字、水印、字幕或 UI。`,
		firstNonEmpty(roomTitle, "未命名剧场"),
		firstNonEmpty(storyTitle, "未命名故事"),
		firstNonEmpty(storyDescription, "根据选中台词推断空间与人物关系"),
		firstNonEmpty(mood, "戏剧冲突"),
		strings.Join(parts, "\n"),
	), nil
}
