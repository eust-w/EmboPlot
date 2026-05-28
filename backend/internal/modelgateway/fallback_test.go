package modelgateway

import (
	"context"
	"strings"
	"testing"
)

func TestFallbackSpeechReturnsPlayableDataURL(t *testing.T) {
	result, err := NewFallbackGateway(Config{}).GenerateSpeech(context.Background(), "你好", "Cherry")
	if err != nil {
		t.Fatalf("generate fallback speech: %v", err)
	}
	if !strings.HasPrefix(result.URL, "data:audio/wav;base64,") {
		t.Fatalf("expected wav data url, got %q", result.URL[:min(len(result.URL), 32)])
	}
	if len(result.URL) <= len("data:audio/wav;base64,")+64 {
		t.Fatalf("expected non-empty audio payload, got length %d", len(result.URL))
	}
}

func TestFallbackImageDoesNotReturnMisleadingPlaceholder(t *testing.T) {
	result, err := NewFallbackGateway(Config{}).GenerateImage(context.Background(), "雨夜便利店")
	if err == nil {
		t.Fatalf("expected fallback image generation to fail, got result %+v", result)
	}
	if result.URL != "" {
		t.Fatalf("expected no placeholder image URL, got %q", result.URL)
	}
}
