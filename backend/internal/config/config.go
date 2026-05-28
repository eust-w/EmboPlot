package config

import (
	"errors"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"

	"emboplot/backend/internal/auth"
	"emboplot/backend/internal/modelgateway"
)

func LoadDotenv(paths ...string) error {
	for _, path := range paths {
		if err := godotenv.Overload(path); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	return nil
}

type Config struct {
	Port          string
	MongoURI      string
	MongoDatabase string
	AllowedOrigin string
	Auth          auth.Config
	ModelGateway  modelgateway.Config
}

func Load() Config {
	return Config{
		Port:          getenv("PORT", "8080"),
		MongoURI:      getenv("MONGODB_URI", "mongodb://localhost:27017"),
		MongoDatabase: getenv("MONGODB_DATABASE", "emboplot"),
		AllowedOrigin: getenv("ALLOWED_ORIGIN", "http://localhost:3000"),
		Auth: auth.Config{
			JWTSecret:    getenv("AUTH_JWT_SECRET", "dev-only-change-me"),
			CookieName:   getenv("AUTH_COOKIE_NAME", "emboplot_session"),
			TokenTTL:     time.Duration(getenvInt("AUTH_TOKEN_TTL_HOURS", 336)) * time.Hour,
			CookieSecure: getenvBool("AUTH_COOKIE_SECURE", false),
		},
		ModelGateway: modelgateway.Config{
			APIKey:            os.Getenv("DASHSCOPE_API_KEY"),
			CompatibleBaseURL: getenv("DASHSCOPE_COMPATIBLE_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
			DashScopeBaseURL:  getenv("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/api/v1"),
			ChatModel:         getenv("DASHSCOPE_CHAT_MODEL", "qwen-plus"),
			ParseModel:        getenv("DASHSCOPE_PARSE_MODEL", "qwen-plus"),
			VisionModel:       getenv("DASHSCOPE_VISION_MODEL", "qwen3-vl-plus"),
			EmbeddingModel:    getenv("DASHSCOPE_EMBEDDING_MODEL", "text-embedding-v3"),
			ImageModel:        getenv("DASHSCOPE_IMAGE_MODEL", "wan2.6-t2i"),
			ImageEditModel:    getenv("DASHSCOPE_IMAGE_EDIT_MODEL", "wan2.6-image"),
			TTSModel:          getenv("DASHSCOPE_TTS_MODEL", "qwen3-tts-flash"),
			ASRModel:          getenv("DASHSCOPE_ASR_MODEL", "qwen3-asr-flash"),
			ModerationModel:   getenv("DASHSCOPE_MODERATION_MODEL", "qwen-plus"),
			ImageSize:         getenv("DASHSCOPE_IMAGE_SIZE", "1696*960"),
			Timeout:           time.Duration(getenvInt("DASHSCOPE_TIMEOUT_SECONDS", 60)) * time.Second,
		},
	}
}

func getenv(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getenvBool(key string, fallback bool) bool {
	if value := os.Getenv(key); value != "" {
		parsed, err := strconv.ParseBool(value)
		if err == nil {
			return parsed
		}
	}
	return fallback
}

func getenvInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		parsed, err := strconv.Atoi(value)
		if err == nil {
			return parsed
		}
	}
	return fallback
}
