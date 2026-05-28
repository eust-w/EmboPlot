package modelgateway

import (
	"context"
	"time"

	"emboplot/backend/internal/models"
)

type Config struct {
	APIKey            string
	CompatibleBaseURL string
	DashScopeBaseURL  string
	ChatModel         string
	ParseModel        string
	VisionModel       string
	EmbeddingModel    string
	ImageModel        string
	ImageEditModel    string
	TTSModel          string
	ASRModel          string
	ModerationModel   string
	ImageSize         string
	Timeout           time.Duration
}

type Capabilities struct {
	Provider string            `json:"provider"`
	Mode     string            `json:"mode"`
	Models   map[string]string `json:"models"`
}

type MediaResult struct {
	URL      string `json:"url"`
	TaskID   string `json:"taskId,omitempty"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
}

type TranscriptResult struct {
	Text     string `json:"text"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
}

type EmbeddingResult struct {
	Vectors  [][]float64 `json:"vectors"`
	Provider string      `json:"provider"`
	Model    string      `json:"model"`
}

type ModerationResult struct {
	Allowed    bool     `json:"allowed"`
	Categories []string `json:"categories"`
	Reason     string   `json:"reason"`
	Provider   string   `json:"provider"`
	Model      string   `json:"model"`
}

type AnalysisResult struct {
	Text     string `json:"text"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
}

type CharacterDraftRequest struct {
	Prompt      string `json:"prompt"`
	Name        string `json:"name,omitempty"`
	Description string `json:"description,omitempty"`
	Personality string `json:"personality,omitempty"`
	Memory      string `json:"memory,omitempty"`
	VoiceName   string `json:"voiceName,omitempty"`
}

type StoryDraftRequest struct {
	Prompt      string   `json:"prompt"`
	Title       string   `json:"title,omitempty"`
	Description string   `json:"description,omitempty"`
	Content     string   `json:"content,omitempty"`
	Tags        []string `json:"tags,omitempty"`
}

type ImageEditRequest struct {
	Prompt    string   `json:"prompt"`
	ImageURLs []string `json:"imageUrls"`
}

type Gateway interface {
	Capabilities() Capabilities
	GenerateScriptLine(context.Context, models.Room) (models.ScriptLine, error)
	ParseCharacter(context.Context, string, string) (models.Character, error)
	GenerateCharacter(context.Context, CharacterDraftRequest) (models.Character, error)
	GenerateStory(context.Context, StoryDraftRequest) (models.StorySetting, error)
	GenerateImage(context.Context, string) (MediaResult, error)
	EditImage(context.Context, ImageEditRequest) (MediaResult, error)
	GenerateSpeech(context.Context, string, string) (MediaResult, error)
	TranscribeAudio(context.Context, string, string) (TranscriptResult, error)
	Embed(context.Context, []string) (EmbeddingResult, error)
	Moderate(context.Context, string) (ModerationResult, error)
	AnalyzeImage(context.Context, string, string) (AnalysisResult, error)
}
