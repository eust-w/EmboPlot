package modelgateway

import (
	"fmt"
	"strings"
	"time"
)

func withDefaults(cfg Config) Config {
	if cfg.CompatibleBaseURL == "" {
		cfg.CompatibleBaseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
	}
	if cfg.DashScopeBaseURL == "" {
		cfg.DashScopeBaseURL = "https://dashscope.aliyuncs.com/api/v1"
	}
	if cfg.ChatModel == "" {
		cfg.ChatModel = "qwen-plus"
	}
	if cfg.ParseModel == "" {
		cfg.ParseModel = cfg.ChatModel
	}
	if cfg.VisionModel == "" {
		cfg.VisionModel = "qwen3-vl-plus"
	}
	if cfg.EmbeddingModel == "" {
		cfg.EmbeddingModel = "text-embedding-v3"
	}
	if cfg.ImageModel == "" {
		cfg.ImageModel = "wan2.6-t2i"
	}
	if cfg.ImageEditModel == "" {
		cfg.ImageEditModel = "wan2.6-image"
	}
	if cfg.TTSModel == "" {
		cfg.TTSModel = "qwen3-tts-flash"
	}
	if cfg.ASRModel == "" {
		cfg.ASRModel = "qwen3-asr-flash"
	}
	if cfg.ModerationModel == "" {
		cfg.ModerationModel = cfg.ChatModel
	}
	if cfg.ImageSize == "" {
		cfg.ImageSize = "1696*960"
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 60 * time.Second
	}
	return cfg
}

func modelMap(cfg Config) map[string]string {
	return map[string]string{
		"chat":       cfg.ChatModel,
		"parse":      cfg.ParseModel,
		"vision":     cfg.VisionModel,
		"embedding":  cfg.EmbeddingModel,
		"image":      cfg.ImageModel,
		"imageEdit":  cfg.ImageEditModel,
		"tts":        cfg.TTSModel,
		"asr":        cfg.ASRModel,
		"moderation": cfg.ModerationModel,
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

func firstString(value any, fallback string) string {
	if stringValue, ok := value.(string); ok && strings.TrimSpace(stringValue) != "" {
		return strings.TrimSpace(stringValue)
	}
	return fallback
}

func truncateRunes(value string, max int) string {
	runes := []rune(value)
	if len(runes) <= max {
		return value
	}
	return string(runes[:max]) + "..."
}

func mapVoiceName(voice string) string {
	switch strings.TrimSpace(voice) {
	case "Puck":
		return "Ethan"
	case "Charon", "Fenrir":
		return "Dylan"
	case "Kore":
		return "Serena"
	case "Zephyr":
		return "Chelsie"
	case "":
		return "Cherry"
	default:
		return voice
	}
}

func DebugSummary(cfg Config) string {
	cfg = withDefaults(cfg)
	return fmt.Sprintf("dashscope chat=%s embedding=%s image=%s imageEdit=%s tts=%s asr=%s", cfg.ChatModel, cfg.EmbeddingModel, cfg.ImageModel, cfg.ImageEditModel, cfg.TTSModel, cfg.ASRModel)
}
