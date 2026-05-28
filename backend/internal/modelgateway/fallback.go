package modelgateway

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"hash/fnv"
	"math"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"emboplot/backend/internal/models"
	"emboplot/backend/internal/store"
)

type FallbackGateway struct {
	cfg Config
}

func NewFallbackGateway(cfg Config) FallbackGateway {
	return FallbackGateway{cfg: withDefaults(cfg)}
}

func (g FallbackGateway) Capabilities() Capabilities {
	return Capabilities{Provider: "dashscope", Mode: "fallback", Models: modelMap(g.cfg)}
}

func (g FallbackGateway) GenerateScriptLine(_ context.Context, room models.Room) (models.ScriptLine, error) {
	nowMS := time.Now().UnixMilli()
	if requiredNextType(room.ScriptTimeline) == string(models.LogTypeDirector) {
		return models.ScriptLine{
			ID:        store.NewID("line"),
			Type:      models.LogTypeDirector,
			Name:      "导演",
			Content:   fallbackNarration(room),
			CreatedAt: nowMS,
		}, nil
	}
	if len(room.ActiveChars) == 0 {
		return models.ScriptLine{
			ID:        store.NewID("line"),
			Type:      models.LogTypeDirector,
			Content:   "场景短暂静默，新的事件正在暗处成形。",
			CreatedAt: nowMS,
		}, nil
	}

	index := len(room.ScriptTimeline) % len(room.ActiveChars)
	character := room.ActiveChars[index]
	targetType, targetID, targetName := fallbackTarget(room, character)
	return models.ScriptLine{
		ID:          store.NewID("line"),
		Type:        models.LogTypeCharacter,
		CharacterID: character.ID,
		Name:        character.Name,
		TargetType:  targetType,
		TargetID:    targetID,
		TargetName:  targetName,
		Action:      "百炼网关本地 fallback",
		Content: fmt.Sprintf(
			"我会按“%s”的基调继续推进。%s仍会记得：%s",
			firstNonEmpty(room.GameSettings.Mood, "戏剧冲突"),
			character.Name,
			firstNonEmpty(character.Memory, room.CurrentStory.Description),
		),
		CreatedAt: nowMS,
	}, nil
}

func fallbackTarget(room models.Room, speaker models.Character) (string, string, string) {
	for i := len(room.ScriptTimeline) - 1; i >= 0; i-- {
		line := room.ScriptTimeline[i]
		if line.Type == models.LogTypeCharacter && line.CharacterID != "" && line.CharacterID != speaker.ID {
			return "character", line.CharacterID, firstNonEmpty(line.Name, "对方")
		}
	}
	if len(room.ActiveChars) > 1 {
		for _, char := range room.ActiveChars {
			if char.ID != speaker.ID {
				return "character", char.ID, char.Name
			}
		}
	}
	return "self", "", "自言自语"
}

func fallbackNarration(room models.Room) string {
	last := ""
	for i := len(room.ScriptTimeline) - 1; i >= 0; i-- {
		if strings.TrimSpace(room.ScriptTimeline[i].Content) != "" {
			last = room.ScriptTimeline[i].Content
			break
		}
	}
	if last == "" {
		return "灯光收拢到舞台中央，新的因果线正在黑暗里显形。"
	}
	return fmt.Sprintf("上一句落下后，%s的空气短暂停滞。细节开始回应那条因果：%s", firstNonEmpty(room.CurrentStory.Title, "剧场"), truncateRunes(last, 48))
}

func (g FallbackGateway) ParseCharacter(_ context.Context, filename string, content string) (models.Character, error) {
	base := strings.TrimSuffix(filepath.Base(filename), filepath.Ext(filename))
	base = strings.TrimSpace(strings.ReplaceAll(base, "_", " "))
	if base == "" {
		base = "未命名角色"
	}
	excerpt := truncateRunes(strings.TrimSpace(content), 72)
	if excerpt == "" {
		excerpt = "上传文件未能直接提取正文，已根据文件名生成初始人设。"
	}
	voices := []string{"Cherry", "Serena", "Ethan", "Chelsie", "Dylan"}
	voice := voices[utf8.RuneCountInString(base)%len(voices)]
	now := time.Now().UTC()
	return models.Character{
		ID:          store.NewID("char"),
		Name:        base,
		Avatar:      "https://i.pravatar.cc/300?u=" + base,
		Description: "从《" + filename + "》解析出的角色背景：" + excerpt,
		Personality: "后端解析建议：语气保持稳定，围绕原文动机行动；遇到冲突时先暴露目标，再暴露情绪。",
		Memory:      "初始记忆区：" + excerpt,
		Status:      "idle",
		Creator:     "Me",
		VoiceName:   voice,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

func (g FallbackGateway) GenerateCharacter(_ context.Context, req CharacterDraftRequest) (models.Character, error) {
	base := firstNonEmpty(req.Name, firstPromptSentence(req.Prompt), "未命名角色")
	excerpt := truncateRunes(firstNonEmpty(req.Description, req.Prompt), 96)
	if excerpt == "" {
		excerpt = "根据导演提示生成的初始角色卡。"
	}
	now := time.Now().UTC()
	return models.Character{
		ID:          store.NewID("char"),
		Name:        base,
		Avatar:      "https://i.pravatar.cc/300?u=" + base,
		Description: excerpt,
		Personality: firstNonEmpty(req.Personality, "根据提示生成：语气稳定，行动围绕核心欲望展开，遇到冲突先暴露目标再暴露情绪。"),
		Memory:      firstNonEmpty(req.Memory, "初始记忆区："+excerpt),
		Status:      "idle",
		Creator:     "Me",
		VoiceName:   firstNonEmpty(req.VoiceName, "Kore"),
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

func (g FallbackGateway) GenerateStory(_ context.Context, req StoryDraftRequest) (models.StorySetting, error) {
	title := firstNonEmpty(req.Title, firstPromptSentence(req.Prompt), "未命名故事背景")
	description := truncateRunes(firstNonEmpty(req.Description, req.Prompt, "根据导演提示生成的故事背景。"), 120)
	now := time.Now().UTC()
	tags := req.Tags
	if len(tags) == 0 {
		tags = []string{"原创", "剧场"}
	}
	return models.StorySetting{
		ID:          store.NewID("story"),
		Title:       title,
		Description: description,
		CoverImage:  "https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20?w=800",
		Tags:        tags,
		Content:     firstNonEmpty(req.Content, "故事背景设定："+description),
		Creator:     "Me",
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

func (g FallbackGateway) GenerateImage(_ context.Context, prompt string) (MediaResult, error) {
	return MediaResult{}, fmt.Errorf("未配置 DASHSCOPE_API_KEY 或百炼文生图模型不可用，无法生成真实场景图: %s", truncateRunes(strings.TrimSpace(prompt), 120))
}

func (g FallbackGateway) EditImage(_ context.Context, req ImageEditRequest) (MediaResult, error) {
	return MediaResult{}, fmt.Errorf("未配置 DASHSCOPE_API_KEY 或百炼图像编辑模型不可用，无法微调参考图: %s", truncateRunes(strings.TrimSpace(req.Prompt), 120))
}

func (g FallbackGateway) GenerateSpeech(_ context.Context, text string, voice string) (MediaResult, error) {
	return MediaResult{
		URL:      fallbackToneWAVDataURL(),
		Provider: "dashscope",
		Model:    g.cfg.TTSModel,
	}, nil
}

func (g FallbackGateway) TranscribeAudio(_ context.Context, _ string, _ string) (TranscriptResult, error) {
	return TranscriptResult{Text: "未配置 DASHSCOPE_API_KEY，当前为本地转写占位结果。", Provider: "dashscope", Model: g.cfg.ASRModel}, nil
}

func (g FallbackGateway) Embed(_ context.Context, texts []string) (EmbeddingResult, error) {
	vectors := make([][]float64, 0, len(texts))
	for _, text := range texts {
		vectors = append(vectors, deterministicVector(text, 16))
	}
	return EmbeddingResult{Vectors: vectors, Provider: "dashscope", Model: g.cfg.EmbeddingModel}, nil
}

func (g FallbackGateway) Moderate(_ context.Context, text string) (ModerationResult, error) {
	lower := strings.ToLower(text)
	categories := []string{}
	if strings.Contains(lower, "kill") || strings.Contains(text, "自杀") {
		categories = append(categories, "self_harm_or_violence")
	}
	return ModerationResult{
		Allowed:    len(categories) == 0,
		Categories: categories,
		Reason:     "未配置 DASHSCOPE_API_KEY，当前使用本地轻量规则。",
		Provider:   "dashscope",
		Model:      g.cfg.ModerationModel,
	}, nil
}

func (g FallbackGateway) AnalyzeImage(_ context.Context, imageURL string, prompt string) (AnalysisResult, error) {
	return AnalysisResult{
		Text:     fmt.Sprintf("未配置 DASHSCOPE_API_KEY。图片 %s 的分析请求已收到：%s", imageURL, firstNonEmpty(prompt, "描述图片")),
		Provider: "dashscope",
		Model:    g.cfg.VisionModel,
	}, nil
}

func deterministicVector(text string, dimensions int) []float64 {
	hash := fnv.New64a()
	_, _ = hash.Write([]byte(text))
	seed := hash.Sum64()
	vector := make([]float64, dimensions)
	for i := range vector {
		seed = seed*6364136223846793005 + 1
		value := float64((seed>>32)%2000) / 1000
		vector[i] = value - 1
	}
	return vector
}

func fallbackToneWAVDataURL() string {
	const sampleRate = 24000
	const durationSeconds = 0.28
	const frequency = 660.0
	sampleCount := int(sampleRate * durationSeconds)
	pcm := make([]int16, sampleCount)
	for i := range pcm {
		phase := 2 * math.Pi * frequency * float64(i) / sampleRate
		envelope := 1.0
		if i < 800 {
			envelope = float64(i) / 800
		}
		if remaining := sampleCount - i; remaining < 1200 {
			envelope = math.Min(envelope, float64(remaining)/1200)
		}
		pcm[i] = int16(math.Sin(phase) * 9000 * envelope)
	}

	var buf bytes.Buffer
	dataSize := uint32(len(pcm) * 2)
	_ = binary.Write(&buf, binary.LittleEndian, []byte("RIFF"))
	_ = binary.Write(&buf, binary.LittleEndian, uint32(36)+dataSize)
	_ = binary.Write(&buf, binary.LittleEndian, []byte("WAVEfmt "))
	_ = binary.Write(&buf, binary.LittleEndian, uint32(16))
	_ = binary.Write(&buf, binary.LittleEndian, uint16(1))
	_ = binary.Write(&buf, binary.LittleEndian, uint16(1))
	_ = binary.Write(&buf, binary.LittleEndian, uint32(sampleRate))
	_ = binary.Write(&buf, binary.LittleEndian, uint32(sampleRate*2))
	_ = binary.Write(&buf, binary.LittleEndian, uint16(2))
	_ = binary.Write(&buf, binary.LittleEndian, uint16(16))
	_ = binary.Write(&buf, binary.LittleEndian, []byte("data"))
	_ = binary.Write(&buf, binary.LittleEndian, dataSize)
	for _, sample := range pcm {
		_ = binary.Write(&buf, binary.LittleEndian, sample)
	}
	return "data:audio/wav;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
}

func firstPromptSentence(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	for _, sep := range []string{"。", "，", "\n", ".", ","} {
		if index := strings.Index(value, sep); index > 0 {
			return truncateRunes(strings.TrimSpace(value[:index]), 16)
		}
	}
	return truncateRunes(value, 16)
}
