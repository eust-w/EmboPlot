package api_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"emboplot/backend/internal/api"
	"emboplot/backend/internal/modelgateway"
	"emboplot/backend/internal/store"
)

type countingSpeechGateway struct {
	fakeGateway
	calls *int
}

func (g countingSpeechGateway) GenerateSpeech(ctx context.Context, text string, voice string) (modelgateway.MediaResult, error) {
	*g.calls++
	return g.fakeGateway.GenerateSpeech(ctx, text, voice)
}

func TestRoomGenerateDeductsPointsAndReturnsBalanceHeaders(t *testing.T) {
	repo := store.NewMemoryStore()
	server := api.NewServer(repo, api.ServerOptions{ModelGateway: fakeGateway{}})
	cookie := registerTestUser(t, server, "billing-room@example.com")
	bootstrap := getBootstrap(t, server, cookie)
	if len(bootstrap.Rooms) == 0 {
		t.Fatal("expected seeded room")
	}
	before := getProfilePoints(t, server, cookie)

	req := httptest.NewRequest(http.MethodPost, "/api/rooms/"+bootstrap.Rooms[0].ID+"/generate", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("X-Points-Charged"); got != "8" {
		t.Fatalf("expected charged header 8, got %q", got)
	}
	if got := getProfilePoints(t, server, cookie); got != before-8 {
		t.Fatalf("expected points to decrease by 8, before=%d after=%d", before, got)
	}
	if got := rec.Header().Get("X-Points-Remaining"); got != "292" {
		t.Fatalf("expected remaining header 292, got %q", got)
	}
}

func TestInsufficientPointsBlocksAIRequest(t *testing.T) {
	repo := store.NewMemoryStore()
	calls := 0
	server := api.NewServer(repo, api.ServerOptions{ModelGateway: countingSpeechGateway{calls: &calls}})
	cookie := registerTestUser(t, server, "billing-empty@example.com")
	user, err := repo.GetUserByEmail(context.Background(), "billing-empty@example.com")
	if err != nil {
		t.Fatalf("get user: %v", err)
	}
	if _, err := repo.DebitPoints(context.Background(), user.ID, 300, "test_zero_balance", nil); err != nil {
		t.Fatalf("zero balance: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/models/speech", strings.NewReader(`{"text":"你好","voiceName":"Cherry"}`))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusPaymentRequired {
		t.Fatalf("expected status 402, got %d: %s", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("X-Points-Required"); got != "2" {
		t.Fatalf("expected required header 2, got %q", got)
	}
	if got := rec.Header().Get("X-Points-Remaining"); got != "0" {
		t.Fatalf("expected remaining header 0, got %q", got)
	}
	if got := rec.Header().Get("X-Points-Reason"); got != "ai:speech" {
		t.Fatalf("expected reason header ai:speech, got %q", got)
	}
	if calls != 0 {
		t.Fatalf("expected model gateway not to be called, got %d calls", calls)
	}
	if got := getProfilePoints(t, server, cookie); got != 0 {
		t.Fatalf("expected points to stay at 0, got %d", got)
	}
}

func TestPointTransactionsEndpointReturnsDetailedLedger(t *testing.T) {
	repo := store.NewMemoryStore()
	server := api.NewServer(repo, api.ServerOptions{ModelGateway: fakeGateway{}})
	cookie := registerTestUser(t, server, "billing-ledger@example.com")

	req := httptest.NewRequest(http.MethodPost, "/api/models/speech", strings.NewReader(`{"text":"你好","voiceName":"Cherry"}`))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected speech status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/points/transactions?limit=5", nil)
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected ledger status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var transactions []struct {
		ID           string            `json:"id"`
		Delta        int               `json:"delta"`
		BalanceAfter int               `json:"balanceAfter"`
		Reason       string            `json:"reason"`
		Metadata     map[string]string `json:"metadata"`
		CreatedAt    string            `json:"createdAt"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &transactions); err != nil {
		t.Fatalf("decode transactions: %v", err)
	}
	if len(transactions) != 1 {
		t.Fatalf("expected one transaction, got %+v", transactions)
	}
	got := transactions[0]
	if got.ID == "" || got.CreatedAt == "" {
		t.Fatalf("expected id and createdAt, got %+v", got)
	}
	if got.Delta != -2 || got.BalanceAfter != 298 || got.Reason != "ai:speech" {
		t.Fatalf("unexpected transaction: %+v", got)
	}
	if got.Metadata["path"] != "/api/models/speech" {
		t.Fatalf("expected path metadata, got %+v", got.Metadata)
	}
}

func TestBillableModelRoutesDeductPoints(t *testing.T) {
	tests := []struct {
		name string
		path string
		body string
		cost int
	}{
		{name: "character draft", path: "/api/models/character", body: `{"prompt":"深空港口观测员"}`, cost: 12},
		{name: "story draft", path: "/api/models/story", body: `{"prompt":"潮湿南方小城的旧照谜案"}`, cost: 12},
		{name: "image", path: "/api/models/image", body: `{"prompt":"雨夜便利店"}`, cost: 30},
		{name: "image edit", path: "/api/models/image-edit", body: `{"prompt":"换成黑金机能夹克","imageUrls":["https://example.com/ref.png"]}`, cost: 35},
		{name: "speech", path: "/api/models/speech", body: `{"text":"你好","voiceName":"Cherry"}`, cost: 2},
		{name: "transcribe", path: "/api/models/transcribe", body: `{"audioData":"data:audio/wav;base64,AAAA","language":"zh"}`, cost: 10},
		{name: "embed", path: "/api/models/embed", body: `{"texts":["角色记忆"]}`, cost: 1},
		{name: "moderate", path: "/api/models/moderate", body: `{"text":"安全内容"}`, cost: 1},
		{name: "vision", path: "/api/models/vision", body: `{"imageUrl":"https://example.com/a.png","prompt":"描述图片"}`, cost: 12},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := api.NewServer(store.NewMemoryStore(), api.ServerOptions{ModelGateway: fakeGateway{}})
			cookie := registerTestUser(t, server, "billing-"+strings.ReplaceAll(tt.name, " ", "-")+"@example.com")
			before := getProfilePoints(t, server, cookie)
			req := httptest.NewRequest(http.MethodPost, tt.path, strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			req.AddCookie(cookie)
			rec := httptest.NewRecorder()
			server.ServeHTTP(rec, req)
			if rec.Code != http.StatusOK {
				t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
			}
			if got := getProfilePoints(t, server, cookie); got != before-tt.cost {
				t.Fatalf("expected points to decrease by %d, before=%d after=%d", tt.cost, before, got)
			}
		})
	}
}

func getProfilePoints(t *testing.T, server *api.Server, cookie *http.Cookie) int {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/profile", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("profile status %d: %s", rec.Code, rec.Body.String())
	}
	var profile struct {
		Points int `json:"points"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &profile); err != nil {
		t.Fatalf("decode profile: %v", err)
	}
	return profile.Points
}
