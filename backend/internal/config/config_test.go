package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotenvLoadsLocalDevelopmentFile(t *testing.T) {
	unsetenv(t, "DASHSCOPE_API_KEY")
	unsetenv(t, "DASHSCOPE_CHAT_MODEL")

	dir := t.TempDir()
	envFile := filepath.Join(dir, ".env")
	if err := os.WriteFile(envFile, []byte("DASHSCOPE_API_KEY=test-local-key\nDASHSCOPE_CHAT_MODEL=test-chat\n"), 0o600); err != nil {
		t.Fatalf("write env file: %v", err)
	}

	if err := LoadDotenv(envFile); err != nil {
		t.Fatalf("load dotenv: %v", err)
	}

	cfg := Load()
	if cfg.ModelGateway.APIKey != "test-local-key" {
		t.Fatalf("expected API key from .env, got %q", cfg.ModelGateway.APIKey)
	}
	if cfg.ModelGateway.ChatModel != "test-chat" {
		t.Fatalf("expected chat model from .env, got %q", cfg.ModelGateway.ChatModel)
	}
}

func TestLoadDotenvRefreshesStaleExplicitEnvironment(t *testing.T) {
	t.Setenv("DASHSCOPE_API_KEY", "stale-key")

	dir := t.TempDir()
	envFile := filepath.Join(dir, ".env")
	if err := os.WriteFile(envFile, []byte("DASHSCOPE_API_KEY=file-key\n"), 0o600); err != nil {
		t.Fatalf("write env file: %v", err)
	}

	if err := LoadDotenv(envFile); err != nil {
		t.Fatalf("load dotenv: %v", err)
	}

	cfg := Load()
	if cfg.ModelGateway.APIKey != "file-key" {
		t.Fatalf("expected local .env to refresh stale key, got %q", cfg.ModelGateway.APIKey)
	}
}

func TestLoadDotenvIgnoresMissingFiles(t *testing.T) {
	if err := LoadDotenv(filepath.Join(t.TempDir(), ".env")); err != nil {
		t.Fatalf("missing env file should not fail: %v", err)
	}
}

func unsetenv(t *testing.T, key string) {
	t.Helper()

	previous, existed := os.LookupEnv(key)
	if err := os.Unsetenv(key); err != nil {
		t.Fatalf("unset %s: %v", key, err)
	}

	t.Cleanup(func() {
		if existed {
			_ = os.Setenv(key, previous)
			return
		}
		_ = os.Unsetenv(key)
	})
}
