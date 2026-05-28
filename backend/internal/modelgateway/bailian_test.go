package modelgateway

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"emboplot/backend/internal/models"
)

func TestEmbedUsesCompatibleEmbeddingsEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/embeddings" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Fatalf("unexpected authorization header: %s", got)
		}

		var body struct {
			Model          string   `json:"model"`
			Input          []string `json:"input"`
			Dimensions     int      `json:"dimensions"`
			EncodingFormat string   `json:"encoding_format"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		if body.Model != "text-embedding-v3" || len(body.Input) != 1 || body.Input[0] != "深空剧场" {
			t.Fatalf("unexpected embedding request body: %+v", body)
		}
		if body.Dimensions != 1024 || body.EncodingFormat != "float" {
			t.Fatalf("unexpected embedding parameters: %+v", body)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"embedding":[0.1,0.2],"index":0}]}`))
	}))
	defer server.Close()

	gateway := New(Config{
		APIKey:            "test-key",
		CompatibleBaseURL: server.URL,
		DashScopeBaseURL:  server.URL,
		EmbeddingModel:    "text-embedding-v3",
		Timeout:           time.Second,
	}, server.Client())

	result, err := gateway.Embed(context.Background(), []string{"深空剧场"})
	if err != nil {
		t.Fatalf("embed: %v", err)
	}
	if len(result.Vectors) != 1 || len(result.Vectors[0]) != 2 {
		t.Fatalf("unexpected vectors: %+v", result.Vectors)
	}
	if result.Provider != "dashscope" || result.Model != "text-embedding-v3" {
		t.Fatalf("unexpected metadata: %+v", result)
	}
}

func TestGenerateImageNormalizesPromptBeforeWanRequest(t *testing.T) {
	var imagePrompt string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/chat/completions":
			var body struct {
				Model    string        `json:"model"`
				Messages []chatMessage `json:"messages"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatalf("decode chat body: %v", err)
			}
			if body.Model != "qwen-plus" || len(body.Messages) != 2 {
				t.Fatalf("unexpected chat prompt body: %+v", body)
			}
			_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"电影感雨夜便利店室内，玻璃门映出霓虹，两个角色隔着货架对峙，黑金深空科技质感，无文字无水印"}}]}`))
		case "/services/aigc/multimodal-generation/generation":
			var body struct {
				Model string `json:"model"`
				Input struct {
					Messages []struct {
						Role    string `json:"role"`
						Content []struct {
							Text string `json:"text"`
						} `json:"content"`
					} `json:"messages"`
				} `json:"input"`
				Parameters struct {
					N              int    `json:"n"`
					Size           string `json:"size"`
					PromptExtend   bool   `json:"prompt_extend"`
					Watermark      bool   `json:"watermark"`
					NegativePrompt string `json:"negative_prompt"`
				} `json:"parameters"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatalf("decode image body: %v", err)
			}
			if body.Model != "wan2.6-t2i" || len(body.Input.Messages) != 1 || len(body.Input.Messages[0].Content) != 1 {
				t.Fatalf("unexpected image request body: %+v", body)
			}
			imagePrompt = body.Input.Messages[0].Content[0].Text
			if imagePrompt != "电影感雨夜便利店室内，玻璃门映出霓虹，两个角色隔着货架对峙，黑金深空科技质感，无文字无水印" {
				t.Fatalf("image prompt was not normalized: %q", imagePrompt)
			}
			if body.Parameters.N != 1 || body.Parameters.Size != "1696*960" || !body.Parameters.PromptExtend || body.Parameters.Watermark {
				t.Fatalf("unexpected image parameters: %+v", body.Parameters)
			}
			_, _ = w.Write([]byte(`{"output":{"choices":[{"message":{"content":[{"image":"https://example.com/generated.png","type":"image"}]}}]}}`))
		default:
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	}))
	defer server.Close()

	gateway := New(Config{
		APIKey:            "test-key",
		CompatibleBaseURL: server.URL,
		DashScopeBaseURL:  server.URL,
		ChatModel:         "qwen-plus",
		ImageModel:        "wan2.6-t2i",
		ImageSize:         "1696*960",
		Timeout:           time.Second,
	}, server.Client())

	result, err := gateway.GenerateImage(context.Background(), "苏然: ......门铃没响。林深: 那晚一下了十七分钟零三秒。")
	if err != nil {
		t.Fatalf("generate image: %v", err)
	}
	if result.URL != "https://example.com/generated.png" {
		t.Fatalf("unexpected result: %+v", result)
	}
	if imagePrompt == "" {
		t.Fatal("expected image endpoint to receive a prompt")
	}
}

func TestGenerateScriptLineFallsBackWhenModelRepeatsRecentContent(t *testing.T) {
	repeated := "远处的车灯闪过，瞬间照亮了便利店门口紧绷的氛围。"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"type\":\"director\",\"name\":\"导演\",\"content\":\"远处的车灯闪过，瞬间照亮了便利店门口紧绷的氛围。\"}"}}]}`))
	}))
	defer server.Close()

	gateway := New(Config{
		APIKey:            "test-key",
		CompatibleBaseURL: server.URL,
		DashScopeBaseURL:  server.URL,
		ChatModel:         "qwen-plus",
		Timeout:           time.Second,
	}, server.Client())

	result, err := gateway.GenerateScriptLine(context.Background(), models.Room{
		CurrentStory: models.StorySetting{Title: "青涩的回响", Description: "雨夜便利店"},
		ActiveChars: []models.Character{
			{ID: "char_a", Name: "林深", Memory: "记得雨夜便利店的重逢。"},
		},
		GameSettings: models.GameSettings{Mood: "戏剧冲突"},
		ScriptTimeline: []models.ScriptLine{
			{Type: models.LogTypeDirector, Name: "导演", Content: repeated},
			{Type: models.LogTypeCharacter, CharacterID: "char_a", Name: "林深", Content: "你听见了吗？"},
		},
	})
	if err != nil {
		t.Fatalf("generate script line: %v", err)
	}
	if result.Content == "" || result.Content == repeated {
		t.Fatalf("expected duplicate content to be blocked, got %+v", result)
	}
}

func TestGenerateCharacterUsesParseModel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		var body struct {
			Model          string        `json:"model"`
			Messages       []chatMessage `json:"messages"`
			ResponseFormat struct {
				Type string `json:"type"`
			} `json:"response_format"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		if body.Model != "qwen-plus" || body.ResponseFormat.Type != "json_object" || len(body.Messages) != 2 {
			t.Fatalf("unexpected character generation body: %+v", body)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"name\":\"星港守望者\",\"description\":\"守在深空港口边缘的观测员。\",\"personality\":\"冷静克制，先观察后行动。\",\"memory\":[\"记得港口失事的夜晚。\",\"不能说出完整名单。\"],\"voiceName\":\"Kore\"}"}}]}`))
	}))
	defer server.Close()

	gateway := New(Config{
		APIKey:            "test-key",
		CompatibleBaseURL: server.URL,
		DashScopeBaseURL:  server.URL,
		ParseModel:        "qwen-plus",
		Timeout:           time.Second,
	}, server.Client())

	result, err := gateway.GenerateCharacter(context.Background(), CharacterDraftRequest{Prompt: "深空港口观测员，知道一次事故真相"})
	if err != nil {
		t.Fatalf("generate character: %v", err)
	}
	if result.Name != "星港守望者" || result.VoiceName != "Kore" || result.Personality == "" || !strings.Contains(result.Memory, "完整名单") {
		t.Fatalf("unexpected generated character: %+v", result)
	}
}

func TestGenerateStoryUsesParseModel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		var body struct {
			Model          string        `json:"model"`
			Messages       []chatMessage `json:"messages"`
			ResponseFormat struct {
				Type string `json:"type"`
			} `json:"response_format"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		if body.Model != "qwen-plus" || body.ResponseFormat.Type != "json_object" || len(body.Messages) != 2 {
			t.Fatalf("unexpected story generation body: %+v", body)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"title\":\"雾港余响\",\"description\":\"潮湿南方小城里的旧照谜案。\",\"content\":\"午夜便利店、巡演后台与旧胶片暗房交错，身份公开与私人记忆互相拉扯。\",\"tags\":[\"现代\",\"悬疑\",\"遗憾\"]}"}}]}`))
	}))
	defer server.Close()

	gateway := New(Config{
		APIKey:            "test-key",
		CompatibleBaseURL: server.URL,
		DashScopeBaseURL:  server.URL,
		ParseModel:        "qwen-plus",
		Timeout:           time.Second,
	}, server.Client())

	result, err := gateway.GenerateStory(context.Background(), StoryDraftRequest{Prompt: "潮湿南方小城的旧照谜案"})
	if err != nil {
		t.Fatalf("generate story: %v", err)
	}
	if result.Title != "雾港余响" || !strings.Contains(result.Content, "巡演后台") || len(result.Tags) != 3 {
		t.Fatalf("unexpected generated story: %+v", result)
	}
}

func TestEditImageSendsTextAndReferenceImage(t *testing.T) {
	var receivedImages int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/chat/completions":
			_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"保持同一角色，换成黑金机能夹克，琥珀侧光，无文字无水印"}}]}`))
		case "/services/aigc/multimodal-generation/generation":
			var body struct {
				Model string `json:"model"`
				Input struct {
					Messages []struct {
						Content []map[string]string `json:"content"`
					} `json:"messages"`
				} `json:"input"`
				Parameters struct {
					EnableInterleave bool `json:"enable_interleave"`
					PromptExtend     bool `json:"prompt_extend"`
				} `json:"parameters"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatalf("decode image edit body: %v", err)
			}
			if body.Model != "wan2.6-image" || len(body.Input.Messages) != 1 {
				t.Fatalf("unexpected image edit body: %+v", body)
			}
			if len(body.Input.Messages[0].Content) != 2 {
				t.Fatalf("expected text plus one reference image, got %+v", body.Input.Messages[0].Content)
			}
			if body.Input.Messages[0].Content[0]["text"] != "保持同一角色，换成黑金机能夹克，琥珀侧光，无文字无水印" {
				t.Fatalf("unexpected edit prompt: %+v", body.Input.Messages[0].Content[0])
			}
			if body.Input.Messages[0].Content[1]["image"] != "https://example.com/ref.png" {
				t.Fatalf("unexpected reference image: %+v", body.Input.Messages[0].Content[1])
			}
			if body.Parameters.EnableInterleave || !body.Parameters.PromptExtend {
				t.Fatalf("unexpected edit parameters: %+v", body.Parameters)
			}
			receivedImages++
			_, _ = w.Write([]byte(`{"output":{"choices":[{"message":{"content":[{"image":"https://example.com/edited.png"}]}}]}}`))
		default:
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	}))
	defer server.Close()

	gateway := New(Config{
		APIKey:            "test-key",
		CompatibleBaseURL: server.URL,
		DashScopeBaseURL:  server.URL,
		ChatModel:         "qwen-plus",
		ImageEditModel:    "wan2.6-image",
		Timeout:           time.Second,
	}, server.Client())

	result, err := gateway.EditImage(context.Background(), ImageEditRequest{
		Prompt:    "换成黑金机能夹克",
		ImageURLs: []string{"https://example.com/ref.png"},
	})
	if err != nil {
		t.Fatalf("edit image: %v", err)
	}
	if result.URL != "https://example.com/edited.png" || receivedImages != 1 {
		t.Fatalf("unexpected edit result: %+v, receivedImages=%d", result, receivedImages)
	}
}

func TestCleanImagePromptPreservesAspectRatio(t *testing.T) {
	prompt := cleanImagePrompt("```text\n1. 16:9 横向构图，雨夜便利店，黑金高对比\n2. 无文字无水印\n```")
	want := "16:9 横向构图，雨夜便利店，黑金高对比，无文字无水印"
	if prompt != want {
		t.Fatalf("unexpected clean prompt: %q", prompt)
	}
}
