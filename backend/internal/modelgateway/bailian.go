package modelgateway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
	"unicode"

	"emboplot/backend/internal/models"
	"emboplot/backend/internal/store"
)

type BailianGateway struct {
	cfg      Config
	client   *http.Client
	fallback FallbackGateway
}

func New(cfg Config, client *http.Client) Gateway {
	cfg = withDefaults(cfg)
	if strings.TrimSpace(cfg.APIKey) == "" {
		return NewFallbackGateway(cfg)
	}
	if client == nil {
		client = &http.Client{Timeout: cfg.Timeout}
	}
	return &BailianGateway{
		cfg:      cfg,
		client:   client,
		fallback: NewFallbackGateway(cfg),
	}
}

func (g *BailianGateway) Capabilities() Capabilities {
	return Capabilities{Provider: "dashscope", Mode: "live", Models: modelMap(g.cfg)}
}

func (g *BailianGateway) GenerateScriptLine(ctx context.Context, room models.Room) (models.ScriptLine, error) {
	payload := map[string]any{}
	system := "你是随流剧场的多智能体剧场推演引擎，负责连续剧本、导演旁白和角色反应。严格承接最近剧情事实，不跳戏，不重置场景。只输出 JSON，不要 Markdown。"
	user := scriptPrompt(room)
	content, err := g.chat(ctx, g.cfg.ChatModel, []chatMessage{
		{Role: "system", Content: system},
		{Role: "user", Content: user},
	}, 0.8, true)
	if err != nil {
		g.logFallback("generate_script_line.chat", err)
		return g.fallback.GenerateScriptLine(ctx, room)
	}
	if err := decodeModelJSON(content, &payload); err != nil {
		g.logFallback("generate_script_line.decode", err)
		return g.fallback.GenerateScriptLine(ctx, room)
	}

	line := models.ScriptLine{
		ID:          store.NewID("line"),
		Type:        models.LogType(firstString(payload["type"], string(models.LogTypeCharacter))),
		CharacterID: firstString(payload["characterId"], ""),
		Name:        firstString(payload["name"], ""),
		TargetType:  normalizeTargetType(firstString(payload["targetType"], "")),
		TargetID:    firstString(payload["targetId"], ""),
		TargetName:  firstString(payload["targetName"], ""),
		Action:      firstString(payload["action"], ""),
		Content:     firstString(payload["content"], ""),
		CreatedAt:   time.Now().UnixMilli(),
	}
	if line.Type == "" {
		line.Type = models.LogTypeCharacter
	}
	if requiredNextType(room.ScriptTimeline) == string(models.LogTypeDirector) && line.Type != models.LogTypeDirector {
		line.Type = models.LogTypeDirector
		line.CharacterID = ""
		line.Name = "导演"
		line.TargetType = ""
		line.TargetID = ""
		line.TargetName = ""
		line.Action = ""
	}
	line = normalizeScriptTarget(line, room.ActiveChars)
	if strings.TrimSpace(line.Content) == "" {
		g.logFallback("generate_script_line.empty_content", errors.New("empty content"))
		return g.fallback.GenerateScriptLine(ctx, room)
	}
	if isRecentDuplicateContent(line.Content, room.ScriptTimeline) {
		g.logFallback("generate_script_line.duplicate_content", errors.New("duplicate content"))
		return g.fallback.GenerateScriptLine(ctx, room)
	}
	return line, nil
}

func normalizeTargetType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "character", "everyone", "self", "air":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return ""
	}
}

func normalizeScriptTarget(line models.ScriptLine, active []models.Character) models.ScriptLine {
	if line.Type != models.LogTypeCharacter {
		line.TargetType = ""
		line.TargetID = ""
		line.TargetName = ""
		return line
	}
	line.TargetType = normalizeTargetType(line.TargetType)
	if line.TargetType == "" {
		line.TargetType = "everyone"
	}
	switch line.TargetType {
	case "character":
		target := findCharacter(active, line.TargetID, line.TargetName)
		if target.ID == "" || target.ID == line.CharacterID {
			line.TargetType = "self"
			line.TargetID = ""
			line.TargetName = ""
			return line
		}
		line.TargetID = target.ID
		line.TargetName = target.Name
	case "everyone":
		line.TargetID = ""
		line.TargetName = "对大家"
	case "self":
		line.TargetID = ""
		line.TargetName = "自言自语"
	case "air":
		line.TargetID = ""
		line.TargetName = "对空气"
	}
	return line
}

func findCharacter(active []models.Character, id string, name string) models.Character {
	for _, char := range active {
		if strings.TrimSpace(id) != "" && char.ID == id {
			return char
		}
	}
	for _, char := range active {
		if strings.TrimSpace(name) != "" && char.Name == strings.TrimSpace(name) {
			return char
		}
	}
	return models.Character{}
}

func (g *BailianGateway) ParseCharacter(ctx context.Context, filename string, content string) (models.Character, error) {
	prompt := fmt.Sprintf(`请把上传的人物资料解析为随流剧场角色卡 JSON。
文件名：%s
正文：
%s

必须输出字段：
name, description, personality, memory, voiceName。
voiceName 必须从 Cherry, Serena, Ethan, Chelsie, Dylan, Jada, Andre 中选择一个。`, filename, truncateRunes(content, 6000))

	modelOutput, err := g.chat(ctx, g.cfg.ParseModel, []chatMessage{
		{Role: "system", Content: "你是角色设定编辑。只输出 JSON。"},
		{Role: "user", Content: prompt},
	}, 0.2, true)
	if err != nil {
		g.logFallback("parse_character.chat", err)
		return g.fallback.ParseCharacter(ctx, filename, content)
	}
	var parsed map[string]any
	if err := decodeModelJSON(modelOutput, &parsed); err != nil {
		g.logFallback("parse_character.decode", err)
		return g.fallback.ParseCharacter(ctx, filename, content)
	}
	name := modelFieldString(parsed["name"])
	if strings.TrimSpace(name) == "" {
		g.logFallback("parse_character.empty_name", errors.New("empty name"))
		return g.fallback.ParseCharacter(ctx, filename, content)
	}
	now := time.Now().UTC()
	return models.Character{
		ID:          store.NewID("char"),
		Name:        name,
		Avatar:      "https://i.pravatar.cc/300?u=" + name,
		Description: modelFieldString(parsed["description"]),
		Personality: modelFieldString(parsed["personality"]),
		Memory:      modelFieldString(parsed["memory"]),
		Status:      "idle",
		Creator:     "Me",
		VoiceName:   firstNonEmpty(modelFieldString(parsed["voiceName"]), "Cherry"),
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

func (g *BailianGateway) GenerateCharacter(ctx context.Context, req CharacterDraftRequest) (models.Character, error) {
	prompt := characterDraftPrompt(req)
	if strings.TrimSpace(prompt) == "" {
		return models.Character{}, errors.New("character prompt is required")
	}
	modelOutput, err := g.chat(ctx, g.cfg.ParseModel, []chatMessage{
		{Role: "system", Content: "你是随流剧场的资深角色卡编剧。只输出 JSON，不要 Markdown。"},
		{Role: "user", Content: prompt},
	}, 0.45, true)
	if err != nil {
		g.logFallback("generate_character.chat", err)
		return g.fallback.GenerateCharacter(ctx, req)
	}
	var parsed map[string]any
	if err := decodeModelJSON(modelOutput, &parsed); err != nil {
		g.logFallback("generate_character.decode", err)
		return g.fallback.GenerateCharacter(ctx, req)
	}
	parsedName := modelFieldString(parsed["name"])
	if strings.TrimSpace(parsedName) == "" {
		g.logFallback("generate_character.empty_name", errors.New("empty name"))
		return g.fallback.GenerateCharacter(ctx, req)
	}
	now := time.Now().UTC()
	name := firstNonEmpty(parsedName, req.Name, "未命名角色")
	return models.Character{
		ID:          store.NewID("char"),
		Name:        name,
		Avatar:      "https://i.pravatar.cc/300?u=" + name,
		Description: firstNonEmpty(modelFieldString(parsed["description"]), req.Description, req.Prompt),
		Personality: firstNonEmpty(modelFieldString(parsed["personality"]), req.Personality),
		Memory:      firstNonEmpty(modelFieldString(parsed["memory"]), req.Memory),
		Status:      "idle",
		Creator:     "Me",
		VoiceName:   firstNonEmpty(modelFieldString(parsed["voiceName"]), req.VoiceName, "Kore"),
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

func (g *BailianGateway) GenerateStory(ctx context.Context, req StoryDraftRequest) (models.StorySetting, error) {
	prompt := storyDraftPrompt(req)
	if strings.TrimSpace(prompt) == "" {
		return models.StorySetting{}, errors.New("story prompt is required")
	}
	modelOutput, err := g.chat(ctx, g.cfg.ParseModel, []chatMessage{
		{Role: "system", Content: "你是随流剧场的资深故事背景编剧。只输出 JSON，不要 Markdown。"},
		{Role: "user", Content: prompt},
	}, 0.45, true)
	if err != nil {
		g.logFallback("generate_story.chat", err)
		return g.fallback.GenerateStory(ctx, req)
	}
	var parsed map[string]any
	if err := decodeModelJSON(modelOutput, &parsed); err != nil {
		g.logFallback("generate_story.decode", err)
		return g.fallback.GenerateStory(ctx, req)
	}
	title := firstNonEmpty(modelFieldString(parsed["title"]), req.Title, "未命名故事背景")
	now := time.Now().UTC()
	tags := modelFieldStrings(parsed["tags"])
	if len(tags) == 0 {
		tags = req.Tags
	}
	if len(tags) == 0 {
		tags = []string{"原创", "剧场"}
	}
	return models.StorySetting{
		ID:          store.NewID("story"),
		Title:       title,
		Description: firstNonEmpty(modelFieldString(parsed["description"]), req.Description, req.Prompt),
		CoverImage:  "https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20?w=800",
		Tags:        compactTags(tags),
		Content:     firstNonEmpty(modelFieldString(parsed["content"]), req.Content),
		Creator:     "Me",
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

func (g *BailianGateway) GenerateImage(ctx context.Context, prompt string) (MediaResult, error) {
	normalizedPrompt, err := g.normalizeImagePrompt(ctx, prompt)
	if err != nil {
		return MediaResult{}, err
	}
	body := map[string]any{
		"model": g.cfg.ImageModel,
		"input": map[string]any{
			"messages": []map[string]any{
				{
					"role": "user",
					"content": []map[string]string{
						{"text": normalizedPrompt},
					},
				},
			},
		},
		"parameters": map[string]any{
			"prompt_extend":   true,
			"watermark":       false,
			"n":               1,
			"size":            g.cfg.ImageSize,
			"negative_prompt": "文字，字幕，水印，logo，UI界面，低清晰度，畸形肢体，多余手指，过曝，糊脸，杂乱构图",
		},
	}
	var response dashScopeGenerationResponse
	if err := g.postDashScope(ctx, "/services/aigc/multimodal-generation/generation", body, &response); err != nil {
		return MediaResult{}, fmt.Errorf("百炼文生图生成失败: %w", err)
	}
	if image := response.firstImage(); image != "" {
		return MediaResult{URL: image, Provider: "dashscope", Model: g.cfg.ImageModel}, nil
	}
	if response.Output.TaskID != "" {
		return MediaResult{TaskID: response.Output.TaskID, Provider: "dashscope", Model: g.cfg.ImageModel}, nil
	}
	return MediaResult{}, errors.New("百炼文生图未返回图片 URL")
}

func (g *BailianGateway) EditImage(ctx context.Context, req ImageEditRequest) (MediaResult, error) {
	images := compactImageURLs(req.ImageURLs)
	if len(images) == 0 {
		return MediaResult{}, errors.New("at least one reference image is required")
	}
	normalizedPrompt, err := g.normalizeImageEditPrompt(ctx, req.Prompt)
	if err != nil {
		return MediaResult{}, err
	}
	content := []map[string]string{{"text": normalizedPrompt}}
	for _, imageURL := range images {
		content = append(content, map[string]string{"image": imageURL})
	}
	body := map[string]any{
		"model": g.cfg.ImageEditModel,
		"input": map[string]any{
			"messages": []map[string]any{
				{
					"role":    "user",
					"content": content,
				},
			},
		},
		"parameters": map[string]any{
			"enable_interleave": false,
			"prompt_extend":     true,
			"watermark":         false,
			"n":                 1,
			"size":              "1K",
			"negative_prompt":   "文字，字幕，水印，logo，UI界面，低清晰度，畸形肢体，多余手指，过曝，糊脸，杂乱构图，改变角色身份",
		},
	}
	var response dashScopeGenerationResponse
	if err := g.postDashScope(ctx, "/services/aigc/multimodal-generation/generation", body, &response); err != nil {
		return MediaResult{}, fmt.Errorf("百炼图文生图微调失败: %w", err)
	}
	if image := response.firstImage(); image != "" {
		return MediaResult{URL: image, Provider: "dashscope", Model: g.cfg.ImageEditModel}, nil
	}
	if response.Output.TaskID != "" {
		return MediaResult{TaskID: response.Output.TaskID, Provider: "dashscope", Model: g.cfg.ImageEditModel}, nil
	}
	return MediaResult{}, errors.New("百炼图文生图未返回图片 URL")
}

func (g *BailianGateway) normalizeImagePrompt(ctx context.Context, raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", errors.New("image prompt is required")
	}

	content, err := g.chat(ctx, g.cfg.ChatModel, []chatMessage{
		{
			Role: "system",
			Content: `你是影视概念美术提示词整理器。把输入的剧本片段、旁白、角色对白或用户指令，整理成一段可直接用于文生图的正向 prompt。
要求：
1. 只输出最终画面 prompt，不要 Markdown、JSON、解释、标题或项目符号。
2. 去掉说话人标签、引号、口头省略号和不可视的对白结构，把它们转译为可视元素、动作、空间、光线、构图和情绪。
3. 保留具体人物关系、场景因果和关键道具；不要凭空更换地点。
4. 明确电影感、横向 16:9、黑金深空科技美学、高对比暗色、琥珀色微光、无文字、无字幕、无水印、无 UI。
5. 输出中文为主，控制在 1200 字以内。`,
		},
		{Role: "user", Content: truncateRunes(raw, 6000)},
	}, 0.2, false)
	if err != nil {
		return "", fmt.Errorf("百炼文生图提示词规整失败: %w", err)
	}

	normalized := cleanImagePrompt(content)
	if normalized == "" {
		return "", errors.New("百炼文生图提示词规整结果为空")
	}
	return truncateRunes(normalized, 2000), nil
}

func (g *BailianGateway) normalizeImageEditPrompt(ctx context.Context, raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", errors.New("image edit prompt is required")
	}
	content, err := g.chat(ctx, g.cfg.ChatModel, []chatMessage{
		{
			Role: "system",
			Content: `你是角色头像图像编辑提示词整理器。把用户的修改描述整理成一段可直接用于图文生图/参考图编辑的 prompt。
要求：
1. 只输出最终编辑 prompt，不要 Markdown、JSON、解释、标题或项目符号。
2. 保持参考图中的同一角色身份、面部特征、年龄感和主体构图，除非用户明确要求改变。
3. 把抽象描述转成可视化的发型、服装、材质、光线、背景、镜头和情绪。
4. 明确黑金深空科技质感、角色头像/半身像、无文字、无字幕、无水印、无 UI。
5. 中文为主，控制在 1200 字以内。`,
		},
		{Role: "user", Content: truncateRunes(raw, 6000)},
	}, 0.2, false)
	if err != nil {
		return "", fmt.Errorf("百炼图文生图提示词规整失败: %w", err)
	}
	normalized := cleanImagePrompt(content)
	if normalized == "" {
		return "", errors.New("百炼图文生图提示词规整结果为空")
	}
	return truncateRunes(normalized, 2000), nil
}

func characterDraftPrompt(req CharacterDraftRequest) string {
	return fmt.Sprintf(`请根据导演给出的信息生成一个可用于多智能体剧场的角色卡 JSON。

导演提示词：
%s

已有基础信息：
name: %s
description: %s
personality: %s
memory: %s
voiceName: %s

必须输出字段：
name, description, personality, memory, voiceName。

字段要求：
- name：中文或中英混合，简洁有记忆点。
- description：一句到两句角色简介，突出身份、欲望和矛盾。
- personality：作为 AI 角色的行为逻辑 prompt，包含说话语气、行动原则、禁忌和冲突反应。
- memory：初始长期记忆区，列出关键经历、关系和不能忘记的秘密。
- voiceName：从 Puck, Charon, Kore, Fenrir, Zephyr, Cherry, Serena, Ethan, Chelsie, Dylan, Jada, Andre 中选择一个。`,
		truncateRunes(req.Prompt, 6000),
		req.Name,
		req.Description,
		req.Personality,
		req.Memory,
		req.VoiceName,
	)
}

func storyDraftPrompt(req StoryDraftRequest) string {
	return fmt.Sprintf(`请根据导演给出的信息生成一个可用于互动剧场初始化的故事背景 JSON。

导演提示词：
%s

已有基础信息：
title: %s
description: %s
content: %s
tags: %s

必须输出字段：
title, description, content, tags。

字段要求：
- title：中文标题，短、有画面感，适合显示在故事背景卡片上。
- description：一句到两句简介，说明时代/地点/核心矛盾。
- content：完整故事背景设定，包含时间地点、世界观规则、主要冲突、可持续推演的事件钩子、禁忌或秘密；适合给多智能体作为初始化上下文。
- tags：2 到 4 个短标签，例如 现代、悬疑、科幻、遗憾、治愈、硬核。`,
		truncateRunes(req.Prompt, 6000),
		req.Title,
		req.Description,
		req.Content,
		strings.Join(req.Tags, "、"),
	)
}

func compactImageURLs(values []string) []string {
	images := make([]string, 0, min(len(values), 4))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		images = append(images, value)
		if len(images) == 4 {
			break
		}
	}
	return images
}

func compactTags(values []string) []string {
	tags := make([]string, 0, min(len(values), 4))
	seen := map[string]bool{}
	for _, value := range values {
		value = truncateRunes(strings.TrimSpace(value), 8)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		tags = append(tags, value)
		if len(tags) == 4 {
			break
		}
	}
	if len(tags) == 0 {
		return []string{"原创", "剧场"}
	}
	return tags
}

func modelFieldString(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case []string:
		parts := make([]string, 0, len(typed))
		for _, item := range typed {
			if strings.TrimSpace(item) != "" {
				parts = append(parts, strings.TrimSpace(item))
			}
		}
		return strings.Join(parts, "\n")
	case []any:
		parts := make([]string, 0, len(typed))
		for _, item := range typed {
			if text := modelFieldString(item); text != "" {
				parts = append(parts, text)
			}
		}
		return strings.Join(parts, "\n")
	case map[string]any:
		data, err := json.Marshal(typed)
		if err == nil {
			return string(data)
		}
	}
	return ""
}

func modelFieldStrings(value any) []string {
	switch typed := value.(type) {
	case []string:
		return typed
	case []any:
		values := make([]string, 0, len(typed))
		for _, item := range typed {
			if text := modelFieldString(item); text != "" {
				values = append(values, text)
			}
		}
		return values
	case string:
		fields := strings.FieldsFunc(typed, func(r rune) bool {
			switch r {
			case ',', '，', '、', ';', '；', '\n':
				return true
			default:
				return false
			}
		})
		values := make([]string, 0, len(fields))
		for _, field := range fields {
			if strings.TrimSpace(field) != "" {
				values = append(values, strings.TrimSpace(field))
			}
		}
		return values
	default:
		if text := modelFieldString(value); text != "" {
			return []string{text}
		}
		return nil
	}
}

func cleanImagePrompt(value string) string {
	value = strings.TrimSpace(value)
	value = strings.TrimPrefix(value, "```text")
	value = strings.TrimPrefix(value, "```json")
	value = strings.TrimPrefix(value, "```")
	value = strings.TrimSuffix(value, "```")
	value = strings.Trim(value, " \t\r\n`\"'“”‘’")
	lines := strings.Split(strings.ReplaceAll(value, "\r\n", "\n"), "\n")
	parts := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		line = trimPromptListPrefix(line)
		if line != "" {
			parts = append(parts, line)
		}
	}
	return strings.Join(parts, "，")
}

func trimPromptListPrefix(line string) string {
	for _, prefix := range []string{"- ", "* ", "• ", "-\t", "*\t", "•\t"} {
		if strings.HasPrefix(line, prefix) {
			return strings.TrimSpace(strings.TrimPrefix(line, prefix))
		}
	}
	runes := []rune(line)
	if len(runes) >= 2 && unicode.IsDigit(runes[0]) && isListSeparator(runes[1]) {
		return strings.TrimSpace(string(runes[2:]))
	}
	if len(runes) >= 3 && unicode.IsDigit(runes[0]) && unicode.IsDigit(runes[1]) && isListSeparator(runes[2]) {
		return strings.TrimSpace(string(runes[3:]))
	}
	return line
}

func isListSeparator(value rune) bool {
	switch value {
	case '.', '、', ')', '）':
		return true
	default:
		return false
	}
}

func (g *BailianGateway) GenerateSpeech(ctx context.Context, text string, voice string) (MediaResult, error) {
	body := map[string]any{
		"model": g.cfg.TTSModel,
		"input": map[string]any{
			"text":          text,
			"voice":         mapVoiceName(voice),
			"language_type": "Chinese",
		},
	}
	var response dashScopeGenerationResponse
	if err := g.postDashScope(ctx, "/services/aigc/multimodal-generation/generation", body, &response); err != nil {
		g.logFallback("generate_speech", err)
		return g.fallback.GenerateSpeech(ctx, text, voice)
	}
	if response.Output.Audio.URL != "" {
		return MediaResult{URL: response.Output.Audio.URL, Provider: "dashscope", Model: g.cfg.TTSModel}, nil
	}
	if response.Output.URL != "" {
		return MediaResult{URL: response.Output.URL, Provider: "dashscope", Model: g.cfg.TTSModel}, nil
	}
	return g.fallback.GenerateSpeech(ctx, text, voice)
}

func (g *BailianGateway) TranscribeAudio(ctx context.Context, audioData string, language string) (TranscriptResult, error) {
	body := map[string]any{
		"model": g.cfg.ASRModel,
		"input": map[string]any{
			"messages": []map[string]any{
				{"role": "system", "content": []map[string]string{{"text": ""}}},
				{"role": "user", "content": []map[string]string{{"audio": audioData}}},
			},
		},
		"parameters": map[string]any{
			"asr_options": map[string]any{
				"enable_itn": true,
				"language":   firstNonEmpty(language, "zh"),
			},
		},
	}
	var response dashScopeGenerationResponse
	if err := g.postDashScope(ctx, "/services/aigc/multimodal-generation/generation", body, &response); err != nil {
		g.logFallback("transcribe_audio", err)
		return g.fallback.TranscribeAudio(ctx, audioData, language)
	}
	if text := response.firstText(); text != "" {
		return TranscriptResult{Text: text, Provider: "dashscope", Model: g.cfg.ASRModel}, nil
	}
	return g.fallback.TranscribeAudio(ctx, audioData, language)
}

func (g *BailianGateway) Embed(ctx context.Context, texts []string) (EmbeddingResult, error) {
	body := map[string]any{
		"model":           g.cfg.EmbeddingModel,
		"input":           texts,
		"dimensions":      1024,
		"encoding_format": "float",
	}
	var response compatibleEmbeddingResponse
	if err := g.postCompatible(ctx, "/embeddings", body, &response); err != nil {
		g.logFallback("embed", err)
		return g.fallback.Embed(ctx, texts)
	}
	vectors := make([][]float64, 0, len(response.Data))
	for _, item := range response.Data {
		vectors = append(vectors, item.Embedding)
	}
	if len(vectors) == 0 {
		return g.fallback.Embed(ctx, texts)
	}
	return EmbeddingResult{Vectors: vectors, Provider: "dashscope", Model: g.cfg.EmbeddingModel}, nil
}

func (g *BailianGateway) Moderate(ctx context.Context, text string) (ModerationResult, error) {
	prompt := `请判断以下用户生成内容是否适合进入公开创作市场。只输出 JSON：
{"allowed":true|false,"categories":["..."],"reason":"..."}
内容：
` + text
	content, err := g.chat(ctx, g.cfg.ModerationModel, []chatMessage{
		{Role: "system", Content: "你是内容安全审核器。只输出 JSON。"},
		{Role: "user", Content: prompt},
	}, 0, true)
	if err != nil {
		g.logFallback("moderate.chat", err)
		return g.fallback.Moderate(ctx, text)
	}
	var result ModerationResult
	if err := decodeModelJSON(content, &result); err != nil {
		g.logFallback("moderate.decode", err)
		return g.fallback.Moderate(ctx, text)
	}
	result.Provider = "dashscope"
	result.Model = g.cfg.ModerationModel
	return result, nil
}

func (g *BailianGateway) AnalyzeImage(ctx context.Context, imageURL string, prompt string) (AnalysisResult, error) {
	content := []map[string]any{
		{"type": "image_url", "image_url": map[string]string{"url": imageURL}},
		{"type": "text", "text": firstNonEmpty(prompt, "请描述这张图像并提取可用于剧场设定的视觉标签。")},
	}
	output, err := g.chat(ctx, g.cfg.VisionModel, []chatMessage{
		{Role: "user", Content: content},
	}, 0.2, false)
	if err != nil {
		g.logFallback("analyze_image", err)
		return g.fallback.AnalyzeImage(ctx, imageURL, prompt)
	}
	return AnalysisResult{Text: output, Provider: "dashscope", Model: g.cfg.VisionModel}, nil
}

func (g *BailianGateway) logFallback(operation string, err error) {
	slog.Warn("dashscope gateway fallback", "operation", operation, "error", err)
}

type chatMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

func (g *BailianGateway) chat(ctx context.Context, model string, messages []chatMessage, temperature float64, jsonMode bool) (string, error) {
	body := map[string]any{
		"model":       model,
		"messages":    messages,
		"temperature": temperature,
	}
	if jsonMode {
		body["response_format"] = map[string]string{"type": "json_object"}
	}

	var response struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}
	if err := g.postCompatible(ctx, "/chat/completions", body, &response); err != nil {
		return "", err
	}
	if response.Error != nil {
		return "", errors.New(response.Error.Message)
	}
	if len(response.Choices) == 0 {
		return "", errors.New("empty chat completion")
	}
	return response.Choices[0].Message.Content, nil
}

func (g *BailianGateway) postCompatible(ctx context.Context, path string, body any, out any) error {
	return g.postJSON(ctx, strings.TrimRight(g.cfg.CompatibleBaseURL, "/")+path, body, out, nil)
}

func (g *BailianGateway) postDashScope(ctx context.Context, path string, body any, out any) error {
	return g.postJSON(ctx, strings.TrimRight(g.cfg.DashScopeBaseURL, "/")+path, body, out, nil)
}

func (g *BailianGateway) postJSON(ctx context.Context, url string, body any, out any, extraHeaders map[string]string) error {
	data, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+g.cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	for key, value := range extraHeaders {
		req.Header.Set(key, value)
	}
	resp, err := g.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("dashscope status %d: %s", resp.StatusCode, string(raw))
	}
	if out == nil {
		return nil
	}
	return json.Unmarshal(raw, out)
}

type dashScopeGenerationResponse struct {
	RequestID string `json:"request_id"`
	Output    struct {
		URL    string `json:"url"`
		TaskID string `json:"task_id"`
		Audio  struct {
			URL string `json:"url"`
		} `json:"audio"`
		Choices []struct {
			Message struct {
				Content []map[string]any `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	} `json:"output"`
}

func (r dashScopeGenerationResponse) firstImage() string {
	for _, choice := range r.Output.Choices {
		for _, item := range choice.Message.Content {
			if value, ok := item["image"].(string); ok && value != "" {
				return value
			}
		}
	}
	return ""
}

func (r dashScopeGenerationResponse) firstText() string {
	for _, choice := range r.Output.Choices {
		for _, item := range choice.Message.Content {
			if value, ok := item["text"].(string); ok && value != "" {
				return value
			}
		}
	}
	return ""
}

type compatibleEmbeddingResponse struct {
	Data []struct {
		Embedding []float64 `json:"embedding"`
		Index     int       `json:"index"`
	} `json:"data"`
}
