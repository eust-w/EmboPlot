package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"emboplot/backend/internal/api"
	"emboplot/backend/internal/modelgateway"
	"emboplot/backend/internal/models"
	"emboplot/backend/internal/store"
)

type fakeGateway struct{}

func (fakeGateway) Capabilities() modelgateway.Capabilities {
	return modelgateway.Capabilities{
		Provider: "dashscope",
		Mode:     "test",
		Models: map[string]string{
			"chat":       "qwen-plus",
			"embedding":  "text-embedding-v3",
			"image":      "wan2.6-t2i",
			"imageEdit":  "wan2.6-image",
			"tts":        "qwen3-tts-flash",
			"asr":        "qwen3-asr-flash",
			"moderation": "qwen-plus",
			"vision":     "qwen3-vl-plus",
		},
	}
}

func (fakeGateway) GenerateScriptLine(_ context.Context, room models.Room) (models.ScriptLine, error) {
	return models.ScriptLine{
		ID:          "fake_line",
		Type:        models.LogTypeCharacter,
		CharacterID: room.ActiveChars[0].ID,
		Name:        room.ActiveChars[0].Name,
		TargetType:  "everyone",
		TargetName:  "对大家",
		Action:      "模型测试",
		Content:     "这是来自百炼模型网关的测试台词。",
	}, nil
}

func (fakeGateway) ParseCharacter(_ context.Context, filename string, _ string) (models.Character, error) {
	return models.Character{
		ID:          "parsed_char",
		Name:        "解析角色",
		Avatar:      "https://i.pravatar.cc/300?u=parsed",
		Description: "从" + filename + "解析",
		Personality: "结构化 personality",
		Memory:      "结构化 memory",
		Status:      "idle",
		VoiceName:   "Cherry",
	}, nil
}

func (fakeGateway) GenerateCharacter(context.Context, modelgateway.CharacterDraftRequest) (models.Character, error) {
	return models.Character{
		ID:          "generated_char",
		Name:        "星港守望者",
		Avatar:      "https://i.pravatar.cc/300?u=generated",
		Description: "根据提示词生成的角色",
		Personality: "生成 personality",
		Memory:      "生成 memory",
		Status:      "idle",
		VoiceName:   "Kore",
	}, nil
}

func (fakeGateway) GenerateStory(context.Context, modelgateway.StoryDraftRequest) (models.StorySetting, error) {
	return models.StorySetting{
		ID:          "generated_story",
		Title:       "雾港余响",
		Description: "根据提示词生成的故事背景",
		CoverImage:  "https://example.com/story.png",
		Tags:        []string{"悬疑", "现代"},
		Content:     "生成 story content",
		Creator:     "Me",
	}, nil
}

func (fakeGateway) GenerateImage(context.Context, string) (modelgateway.MediaResult, error) {
	return modelgateway.MediaResult{URL: "https://example.com/scene.png", Provider: "dashscope", Model: "wan2.6-t2i"}, nil
}

func (fakeGateway) EditImage(context.Context, modelgateway.ImageEditRequest) (modelgateway.MediaResult, error) {
	return modelgateway.MediaResult{URL: "https://example.com/edited.png", Provider: "dashscope", Model: "wan2.6-image"}, nil
}

func (fakeGateway) GenerateSpeech(context.Context, string, string) (modelgateway.MediaResult, error) {
	return modelgateway.MediaResult{URL: "https://example.com/voice.wav", Provider: "dashscope", Model: "qwen3-tts-flash"}, nil
}

func (fakeGateway) TranscribeAudio(context.Context, string, string) (modelgateway.TranscriptResult, error) {
	return modelgateway.TranscriptResult{Text: "转写结果", Provider: "dashscope", Model: "qwen3-asr-flash"}, nil
}

func (fakeGateway) Embed(context.Context, []string) (modelgateway.EmbeddingResult, error) {
	return modelgateway.EmbeddingResult{Vectors: [][]float64{{0.1, 0.2, 0.3}}, Provider: "dashscope", Model: "text-embedding-v3"}, nil
}

func (fakeGateway) Moderate(context.Context, string) (modelgateway.ModerationResult, error) {
	return modelgateway.ModerationResult{Allowed: true, Categories: []string{}, Reason: "ok", Provider: "dashscope", Model: "qwen-plus"}, nil
}

func (fakeGateway) AnalyzeImage(context.Context, string, string) (modelgateway.AnalysisResult, error) {
	return modelgateway.AnalysisResult{Text: "图片理解结果", Provider: "dashscope", Model: "qwen3-vl-plus"}, nil
}

func TestBootstrapReturnsSeedData(t *testing.T) {
	server := api.NewServer(store.NewMemoryStore(), api.ServerOptions{})
	cookie := registerTestUser(t, server, "bootstrap@example.com")

	req := httptest.NewRequest(http.MethodGet, "/api/bootstrap", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if len(payload["characters"].([]any)) == 0 {
		t.Fatal("expected seeded characters")
	}
	if len(payload["stories"].([]any)) == 0 {
		t.Fatal("expected seeded stories")
	}
	if len(payload["rooms"].([]any)) == 0 {
		t.Fatal("expected seeded rooms")
	}
}

func TestBootstrapRequiresAuthenticatedUser(t *testing.T) {
	server := api.NewServer(store.NewMemoryStore(), api.ServerOptions{})

	req := httptest.NewRequest(http.MethodGet, "/api/bootstrap", nil)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRegisterLoginMeAndLogout(t *testing.T) {
	server := api.NewServer(store.NewMemoryStore(), api.ServerOptions{})

	req := httptest.NewRequest(http.MethodGet, "/api/auth/session", nil)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"user":null`) {
		t.Fatalf("expected empty session response, got %d: %s", rec.Code, rec.Body.String())
	}

	registerBody := strings.NewReader(`{"email":"Director@Example.com","password":"strong-password","nickname":"星港导演"}`)
	req = httptest.NewRequest(http.MethodPost, "/api/auth/register", registerBody)
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected register status 201, got %d: %s", rec.Code, rec.Body.String())
	}
	cookie := firstCookie(t, rec)
	if !cookie.HttpOnly {
		t.Fatal("expected session cookie to be HttpOnly")
	}

	var registered struct {
		User struct {
			ID       string `json:"id"`
			Email    string `json:"email"`
			Nickname string `json:"nickname"`
			UID      string `json:"uid"`
		} `json:"user"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &registered); err != nil {
		t.Fatalf("decode register response: %v", err)
	}
	if registered.User.Email != "director@example.com" || registered.User.Nickname != "星港导演" || registered.User.UID == "" {
		t.Fatalf("unexpected registered user: %+v", registered.User)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected me status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "director@example.com") {
		t.Fatalf("expected me response to include email, got %s", rec.Body.String())
	}

	loginBody := strings.NewReader(`{"email":"director@example.com","password":"strong-password"}`)
	req = httptest.NewRequest(http.MethodPost, "/api/auth/login", loginBody)
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected login status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req.AddCookie(firstCookie(t, rec))
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected logout status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	cleared := firstCookie(t, rec)
	if cleared.MaxAge >= 0 {
		t.Fatalf("expected logout cookie to clear session, got MaxAge=%d", cleared.MaxAge)
	}
}

func TestLoginRejectsInvalidPassword(t *testing.T) {
	server := api.NewServer(store.NewMemoryStore(), api.ServerOptions{})
	registerTestUser(t, server, "wrong-password@example.com")

	loginBody := strings.NewReader(`{"email":"wrong-password@example.com","password":"incorrect-password"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", loginBody)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected login status 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestCreateRoomAndGenerateLine(t *testing.T) {
	server := api.NewServer(store.NewMemoryStore(), api.ServerOptions{ModelGateway: fakeGateway{}})
	cookie := registerTestUser(t, server, "room@example.com")
	bootstrap := getBootstrap(t, server, cookie)
	storyID := bootstrap.Stories[0].ID
	characterIDs := []string{bootstrap.Characters[0].ID, bootstrap.Characters[1].ID}

	payload, err := json.Marshal(map[string]any{
		"title":        "测试剧场",
		"storyId":      storyID,
		"characterIds": characterIDs,
		"gameSettings": map[string]string{"mood": "戏剧冲突", "pace": "Balanced", "complexity": "Standard", "language": "Chinese (Simplified)"},
	})
	if err != nil {
		t.Fatalf("marshal create room payload: %v", err)
	}
	body := bytes.NewReader(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/rooms", body)
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var room struct {
		ID             string `json:"id"`
		ScriptTimeline []struct {
			Type string `json:"type"`
		} `json:"scriptTimeline"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &room); err != nil {
		t.Fatalf("decode room: %v", err)
	}
	if room.ID == "" {
		t.Fatal("expected room id")
	}
	if len(room.ScriptTimeline) == 0 {
		t.Fatal("expected initial director line")
	}

	req = httptest.NewRequest(http.MethodPost, "/api/rooms/"+room.ID+"/generate", nil)
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var line struct {
		Type        string `json:"type"`
		CharacterID string `json:"characterId"`
		TargetType  string `json:"targetType"`
		TargetName  string `json:"targetName"`
		Content     string `json:"content"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &line); err != nil {
		t.Fatalf("decode line: %v", err)
	}
	if line.Type == "" || line.Content == "" {
		t.Fatalf("expected generated line with type and content, got %+v", line)
	}
	if line.Content != "这是来自百炼模型网关的测试台词。" {
		t.Fatalf("expected model gateway line, got %q", line.Content)
	}
	if line.TargetType != "everyone" || line.TargetName != "对大家" {
		t.Fatalf("expected generated line to include audience target, got %+v", line)
	}
}

type continuityGateway struct {
	fakeGateway
}

func (continuityGateway) GenerateScriptLine(_ context.Context, room models.Room) (models.ScriptLine, error) {
	last := ""
	if len(room.ScriptTimeline) > 0 {
		last = room.ScriptTimeline[len(room.ScriptTimeline)-1].Content
	}
	return models.ScriptLine{
		ID:        "continuity_line",
		Type:      models.LogTypeDirector,
		Name:      "导演",
		Content:   "承接：" + last,
		CreatedAt: 1,
	}, nil
}

type rosterGateway struct {
	fakeGateway
	seenCharacterIDs []string
}

func (g *rosterGateway) GenerateScriptLine(_ context.Context, room models.Room) (models.ScriptLine, error) {
	g.seenCharacterIDs = g.seenCharacterIDs[:0]
	for _, character := range room.ActiveChars {
		g.seenCharacterIDs = append(g.seenCharacterIDs, character.ID)
	}
	return models.ScriptLine{
		ID:          "roster_line",
		Type:        models.LogTypeCharacter,
		CharacterID: "char_added",
		Name:        "新加入者",
		TargetType:  "everyone",
		TargetName:  "对大家",
		Content:     "我也在场。",
		CreatedAt:   1,
	}, nil
}

func TestGenerateLineUsesRequestTimelineForContinuity(t *testing.T) {
	server := api.NewServer(store.NewMemoryStore(), api.ServerOptions{ModelGateway: continuityGateway{}})
	cookie := registerTestUser(t, server, "room-continuity@example.com")
	bootstrap := getBootstrap(t, server, cookie)
	room := bootstrap.Rooms[0]

	payload, err := json.Marshal(map[string]any{
		"scriptTimeline": []map[string]any{
			{
				"id":      "manual_latest",
				"type":    "user",
				"content": "刚才门铃坏了，所有人都听见了。",
			},
		},
	})
	if err != nil {
		t.Fatalf("marshal generate payload: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/rooms/"+room.ID+"/generate", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "刚才门铃坏了") {
		t.Fatalf("expected generation to use request timeline, got %s", rec.Body.String())
	}
}

func TestGenerateLineUsesRequestActiveCharacters(t *testing.T) {
	gateway := &rosterGateway{}
	server := api.NewServer(store.NewMemoryStore(), api.ServerOptions{ModelGateway: gateway})
	cookie := registerTestUser(t, server, "room-roster@example.com")
	bootstrap := getBootstrap(t, server, cookie)
	room := bootstrap.Rooms[0]

	added := models.Character{
		ID:          "char_added",
		Name:        "新加入者",
		Avatar:      "https://example.com/added.png",
		Description: "刚加入剧本的人物",
		Status:      "idle",
		VoiceName:   "Kore",
	}
	payload, err := json.Marshal(map[string]any{
		"scriptTimeline":   room.ScriptTimeline,
		"activeCharacters": append(room.ActiveChars, added),
	})
	if err != nil {
		t.Fatalf("marshal generate payload: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/rooms/"+room.ID+"/generate", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if !containsString(gateway.seenCharacterIDs, "char_added") {
		t.Fatalf("expected model gateway to receive added character, got %v", gateway.seenCharacterIDs)
	}
	if !strings.Contains(rec.Body.String(), "新加入者") {
		t.Fatalf("expected generated line to allow added character, got %s", rec.Body.String())
	}
}

func TestRoomCRUD(t *testing.T) {
	server := api.NewServer(store.NewMemoryStore(), api.ServerOptions{ModelGateway: fakeGateway{}})
	cookie := registerTestUser(t, server, "room-crud@example.com")
	bootstrap := getBootstrap(t, server, cookie)
	room := bootstrap.Rooms[0]
	room.Title = "已改名剧场"
	room.Status = "paused"

	payload, err := json.Marshal(room)
	if err != nil {
		t.Fatalf("marshal room: %v", err)
	}
	req := httptest.NewRequest(http.MethodPut, "/api/rooms/"+room.ID, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected update status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var updated models.Room
	if err := json.Unmarshal(rec.Body.Bytes(), &updated); err != nil {
		t.Fatalf("decode updated room: %v", err)
	}
	if updated.Title != "已改名剧场" || updated.Status != "paused" {
		t.Fatalf("expected updated room fields, got %+v", updated)
	}

	req = httptest.NewRequest(http.MethodDelete, "/api/rooms/"+room.ID, nil)
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected delete status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/rooms/"+room.ID, nil)
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected deleted room status 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestCharacterPublishLocksFutureEditsAndCanBeUnpublished(t *testing.T) {
	server := api.NewServer(store.NewMemoryStore(), api.ServerOptions{})
	cookie := registerTestUser(t, server, "character-publish@example.com")
	bootstrap := getBootstrap(t, server, cookie)
	character := bootstrap.Characters[0]

	req := httptest.NewRequest(http.MethodPost, "/api/characters/"+character.ID+"/publish", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected publish status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var published models.Character
	if err := json.Unmarshal(rec.Body.Bytes(), &published); err != nil {
		t.Fatalf("decode published character: %v", err)
	}
	if !published.IsPublic || published.PublishedAt == nil {
		t.Fatalf("expected public character with publishedAt, got %+v", published)
	}

	published.Name = "不应被保存的新名字"
	payload, err := json.Marshal(published)
	if err != nil {
		t.Fatalf("marshal character: %v", err)
	}
	req = httptest.NewRequest(http.MethodPut, "/api/characters/"+published.ID, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected locked update status 409, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodPost, "/api/characters/"+published.ID+"/unpublish", nil)
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected unpublish status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var unpublished models.Character
	if err := json.Unmarshal(rec.Body.Bytes(), &unpublished); err != nil {
		t.Fatalf("decode unpublished character: %v", err)
	}
	if unpublished.IsPublic || unpublished.PublishedAt == nil {
		t.Fatalf("expected downlined character to keep publishedAt, got %+v", unpublished)
	}

	unpublished.Description = "下线后也不能改"
	payload, err = json.Marshal(unpublished)
	if err != nil {
		t.Fatalf("marshal unpublished character: %v", err)
	}
	req = httptest.NewRequest(http.MethodPut, "/api/characters/"+unpublished.ID, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected downlined locked update status 409, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodPost, "/api/characters/"+unpublished.ID+"/publish", nil)
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected republish status 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestStoryPublishLocksFutureSavesAndCanBeUnpublished(t *testing.T) {
	server := api.NewServer(store.NewMemoryStore(), api.ServerOptions{})
	cookie := registerTestUser(t, server, "story-publish@example.com")
	bootstrap := getBootstrap(t, server, cookie)
	story := bootstrap.Stories[0]

	req := httptest.NewRequest(http.MethodPost, "/api/stories/"+story.ID+"/publish", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected publish status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var published models.StorySetting
	if err := json.Unmarshal(rec.Body.Bytes(), &published); err != nil {
		t.Fatalf("decode published story: %v", err)
	}
	if !published.IsPublic || published.PublishedAt == nil {
		t.Fatalf("expected public story with publishedAt, got %+v", published)
	}

	published.Title = "不应被保存的新背景"
	payload, err := json.Marshal(published)
	if err != nil {
		t.Fatalf("marshal story: %v", err)
	}
	req = httptest.NewRequest(http.MethodPost, "/api/stories", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected locked save status 409, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodPost, "/api/stories/"+published.ID+"/unpublish", nil)
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected unpublish status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var unpublished models.StorySetting
	if err := json.Unmarshal(rec.Body.Bytes(), &unpublished); err != nil {
		t.Fatalf("decode unpublished story: %v", err)
	}
	if unpublished.IsPublic || unpublished.PublishedAt == nil {
		t.Fatalf("expected downlined story to keep publishedAt, got %+v", unpublished)
	}

	unpublished.Description = "下线后也不能改"
	payload, err = json.Marshal(unpublished)
	if err != nil {
		t.Fatalf("marshal unpublished story: %v", err)
	}
	req = httptest.NewRequest(http.MethodPost, "/api/stories", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected downlined locked save status 409, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodPost, "/api/stories/"+unpublished.ID+"/publish", nil)
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected republish status 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAcquireMarketAssetsCopiesPrivateEditableDrafts(t *testing.T) {
	server := api.NewServer(store.NewMemoryStore(), api.ServerOptions{})
	cookie := registerTestUser(t, server, "market-acquire@example.com")
	bootstrap := getBootstrap(t, server, cookie)
	if len(bootstrap.MarketCharacters) == 0 || len(bootstrap.MarketStories) == 0 {
		t.Fatalf("expected market assets, got %+v", bootstrap)
	}
	sourceCharacter := bootstrap.MarketCharacters[0]
	sourceStory := bootstrap.MarketStories[0]

	req := httptest.NewRequest(http.MethodPost, "/api/characters/"+sourceCharacter.ID+"/acquire", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected acquire character status 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var copiedCharacter models.Character
	if err := json.Unmarshal(rec.Body.Bytes(), &copiedCharacter); err != nil {
		t.Fatalf("decode copied character: %v", err)
	}
	if copiedCharacter.ID == sourceCharacter.ID || copiedCharacter.UserID == "" || copiedCharacter.IsPublic || copiedCharacter.PublishedAt != nil {
		t.Fatalf("expected private character copy with new id, got %+v", copiedCharacter)
	}
	if copiedCharacter.Creator != "测试导演" {
		t.Fatalf("expected copied character creator to be current user, got %q", copiedCharacter.Creator)
	}

	copiedCharacter.Description = "市场获取后可在创作中心继续编辑"
	payload, err := json.Marshal(copiedCharacter)
	if err != nil {
		t.Fatalf("marshal copied character: %v", err)
	}
	req = httptest.NewRequest(http.MethodPut, "/api/characters/"+copiedCharacter.ID, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected copied character to be editable, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodPost, "/api/stories/"+sourceStory.ID+"/acquire", nil)
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected acquire story status 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var copiedStory models.StorySetting
	if err := json.Unmarshal(rec.Body.Bytes(), &copiedStory); err != nil {
		t.Fatalf("decode copied story: %v", err)
	}
	if copiedStory.ID == sourceStory.ID || copiedStory.UserID == "" || copiedStory.IsPublic || copiedStory.PublishedAt != nil {
		t.Fatalf("expected private story copy with new id, got %+v", copiedStory)
	}
	if copiedStory.Creator != "测试导演" {
		t.Fatalf("expected copied story creator to be current user, got %q", copiedStory.Creator)
	}

	copiedStory.Description = "市场获取后可在创作中心继续编辑"
	payload, err = json.Marshal(copiedStory)
	if err != nil {
		t.Fatalf("marshal copied story: %v", err)
	}
	req = httptest.NewRequest(http.MethodPost, "/api/stories", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected copied story to be editable, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestProfileAvatarURLPersistsAndSyncsToSessionUser(t *testing.T) {
	server := api.NewServer(store.NewMemoryStore(), api.ServerOptions{})
	cookie := registerTestUser(t, server, "profile-avatar@example.com")
	bootstrap := getBootstrap(t, server, cookie)

	payload, err := json.Marshal(map[string]any{
		"id":         bootstrap.Profile.ID,
		"uid":        bootstrap.Profile.UID,
		"nickname":   "头像导演",
		"avatarChar": "头",
		"avatarUrl":  "data:image/png;base64,QUJD",
		"signature":  bootstrap.Profile.Signature,
		"tags":       bootstrap.Profile.Tags,
	})
	if err != nil {
		t.Fatalf("marshal profile: %v", err)
	}
	req := httptest.NewRequest(http.MethodPatch, "/api/profile", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected profile update status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var updated map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &updated); err != nil {
		t.Fatalf("decode profile response: %v", err)
	}
	if updated["avatarUrl"] != "data:image/png;base64,QUJD" {
		t.Fatalf("expected profile avatarUrl to persist, got %+v", updated)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/auth/session", nil)
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected session status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var session struct {
		User struct {
			AvatarURL string `json:"avatarUrl"`
		} `json:"user"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &session); err != nil {
		t.Fatalf("decode session response: %v", err)
	}
	if session.User.AvatarURL != "data:image/png;base64,QUJD" {
		t.Fatalf("expected session avatarUrl to sync, got %+v", session.User)
	}
}

func TestParseCharacterOnboardingFile(t *testing.T) {
	server := api.NewServer(store.NewMemoryStore(), api.ServerOptions{ModelGateway: fakeGateway{}})
	cookie := registerTestUser(t, server, "parse@example.com")

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "星港守望者.txt")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write([]byte("她长期守在星港边缘，语气克制，擅长观察谎言。")); err != nil {
		t.Fatalf("write file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/onboarding/parse-character", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var character struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Personality string `json:"personality"`
		Memory      string `json:"memory"`
		VoiceName   string `json:"voiceName"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &character); err != nil {
		t.Fatalf("decode character: %v", err)
	}
	if character.Name == "" || character.Personality == "" || character.VoiceName == "" {
		t.Fatalf("expected parsed character fields, got %+v", character)
	}
	if character.Name != "解析角色" {
		t.Fatalf("expected model gateway parsed character, got %+v", character)
	}
}

func TestModelCapabilityRoutes(t *testing.T) {
	server := api.NewServer(store.NewMemoryStore(), api.ServerOptions{ModelGateway: fakeGateway{}})
	cookie := registerTestUser(t, server, "models@example.com")

	tests := []struct {
		name   string
		method string
		path   string
		body   string
		want   string
	}{
		{name: "capabilities", method: http.MethodGet, path: "/api/models/capabilities", want: "qwen-plus"},
		{name: "character", method: http.MethodPost, path: "/api/models/character", body: `{"prompt":"深空港口观测员"}`, want: "星港守望者"},
		{name: "story", method: http.MethodPost, path: "/api/models/story", body: `{"prompt":"潮湿南方小城的旧照谜案"}`, want: "雾港余响"},
		{name: "image", method: http.MethodPost, path: "/api/models/image", body: `{"prompt":"雨夜便利店"}`, want: "scene.png"},
		{name: "character image", method: http.MethodPost, path: "/api/models/character-image", body: `{"name":"林烛","description":"深空港口观测员"}`, want: "scene.png"},
		{name: "story image", method: http.MethodPost, path: "/api/models/story-image", body: `{"title":"雾港余响","description":"潮湿南方小城","content":"旧照与身份谜案","tags":["悬疑"]}`, want: "scene.png"},
		{name: "image edit", method: http.MethodPost, path: "/api/models/image-edit", body: `{"prompt":"换成黑金机能夹克","imageUrls":["https://example.com/ref.png"]}`, want: "edited.png"},
		{name: "scene image", method: http.MethodPost, path: "/api/models/scene-image", body: `{"roomTitle":"测试剧场","storyTitle":"星港","storyDescription":"深空车站","mood":"悬疑","lines":[{"id":"1","type":"character","name":"林烛","content":"灯塔还亮着。"},{"id":"2","type":"character","name":"苏然","content":"那不是给我们看的。"}]}`, want: "scene.png"},
		{name: "speech", method: http.MethodPost, path: "/api/models/speech", body: `{"text":"你好","voiceName":"Cherry"}`, want: "voice.wav"},
		{name: "transcribe", method: http.MethodPost, path: "/api/models/transcribe", body: `{"audioData":"data:audio/wav;base64,AAAA","language":"zh"}`, want: "转写结果"},
		{name: "embed", method: http.MethodPost, path: "/api/models/embed", body: `{"texts":["角色记忆"]}`, want: "0.1"},
		{name: "moderate", method: http.MethodPost, path: "/api/models/moderate", body: `{"text":"安全内容"}`, want: "ok"},
		{name: "vision", method: http.MethodPost, path: "/api/models/vision", body: `{"imageUrl":"https://example.com/a.png","prompt":"描述图片"}`, want: "图片理解结果"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, strings.NewReader(tt.body))
			if tt.body != "" {
				req.Header.Set("Content-Type", "application/json")
				req.AddCookie(cookie)
			}
			rec := httptest.NewRecorder()
			server.ServeHTTP(rec, req)
			if rec.Code != http.StatusOK {
				t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
			}
			if !strings.Contains(rec.Body.String(), tt.want) {
				t.Fatalf("expected response to contain %q, got %s", tt.want, rec.Body.String())
			}
		})
	}
}

func TestExportAudioRendersWholeScriptAsWAV(t *testing.T) {
	server := api.NewServer(store.NewMemoryStore(), api.ServerOptions{})
	cookie := registerTestUser(t, server, "audio-export@example.com")

	body := strings.NewReader(`{
		"title":"雨夜便利店",
		"activeCharacters":[{"id":"char_a","name":"林深","voiceName":"Kore"}],
		"scriptTimeline":[
			{"id":"1","type":"director","content":"雨水敲在便利店的玻璃门上。"},
			{"id":"2","type":"character","characterId":"char_a","name":"林深","action":"压低声音","content":"有人跟着我。"},
			{"id":"3","type":"user","content":"导演要求：镜头推进到柜台。"}
		]
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/exports/audio", body)
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if contentType := rec.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "audio/wav") {
		t.Fatalf("expected audio/wav content type, got %q", contentType)
	}
	if disposition := rec.Header().Get("Content-Disposition"); !strings.Contains(disposition, ".wav") {
		t.Fatalf("expected wav attachment disposition, got %q", disposition)
	}
	payload := rec.Body.Bytes()
	if len(payload) <= 44 {
		t.Fatalf("expected non-empty wav payload, got %d bytes", len(payload))
	}
	if string(payload[:4]) != "RIFF" || string(payload[8:12]) != "WAVE" {
		t.Fatalf("expected RIFF/WAVE payload header, got %q / %q", string(payload[:4]), string(payload[8:12]))
	}
}

func registerTestUser(t *testing.T, server *api.Server, email string) *http.Cookie {
	t.Helper()

	body := strings.NewReader(`{"email":"` + email + `","password":"strong-password","nickname":"测试导演"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("register test user: expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}
	return firstCookie(t, rec)
}

func firstCookie(t *testing.T, rec *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	cookies := rec.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatalf("expected response cookie, got none: %s", rec.Body.String())
	}
	return cookies[0]
}

func containsString(items []string, value string) bool {
	for _, item := range items {
		if item == value {
			return true
		}
	}
	return false
}

func getBootstrap(t *testing.T, server *api.Server, cookie *http.Cookie) models.Bootstrap {
	t.Helper()

	req := httptest.NewRequest(http.MethodGet, "/api/bootstrap", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("bootstrap: expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var bootstrap models.Bootstrap
	if err := json.Unmarshal(rec.Body.Bytes(), &bootstrap); err != nil {
		t.Fatalf("decode bootstrap: %v", err)
	}
	if len(bootstrap.Stories) == 0 || len(bootstrap.Characters) < 2 {
		t.Fatalf("expected starter workspace, got %+v", bootstrap)
	}
	return bootstrap
}
