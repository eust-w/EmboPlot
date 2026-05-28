package api_test

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sort"
	"strings"
	"testing"

	"emboplot/backend/internal/api"
	"emboplot/backend/internal/models"
	"emboplot/backend/internal/store"
)

func TestCreateHupijiaoRechargeOrder(t *testing.T) {
	var received url.Values
	gateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST, got %s", r.Method)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse form: %v", err)
		}
		received = r.PostForm
		if received.Get("appid") != "test_app" || received.Get("version") != "1.1" {
			t.Fatalf("unexpected app/version: %s", received.Encode())
		}
		if received.Get("total_fee") != "49.00" || received.Get("notify_url") != "https://claworkers.com/api/payments/hupijiao/notify" {
			t.Fatalf("unexpected payment form: %s", received.Encode())
		}
		if !verifyTestHupijiaoHash(received, "test_secret") {
			t.Fatalf("invalid request hash: %s", received.Encode())
		}

		resp := map[string]string{
			"openid":     "12345",
			"url":        "https://pay.example.com/mobile",
			"url_qrcode": "https://pay.example.com/qrcode.png",
			"errcode":    "0",
			"errmsg":     "success!",
		}
		resp["hash"] = signTestHupijiao(resp, "test_secret")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer gateway.Close()

	server := api.NewServer(store.NewMemoryStore(), api.ServerOptions{
		Payment: api.PaymentConfig{
			PublicBaseURL: "https://claworkers.com",
			Hupijiao: api.HupijiaoConfig{
				AppID:      "test_app",
				AppSecret:  "test_secret",
				GatewayURL: gateway.URL,
			},
		},
	})
	cookie := registerTestUser(t, server, "pay-create@example.com")

	req := httptest.NewRequest(http.MethodPost, "/api/payments/recharge", strings.NewReader(`{"planId":"starter"}`))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var payload struct {
		TradeOrderID string `json:"tradeOrderId"`
		PayURL       string `json:"payUrl"`
		QRCodeURL    string `json:"qrCodeUrl"`
		Points       int    `json:"points"`
		AmountCents  int    `json:"amountCents"`
		Status       string `json:"status"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.TradeOrderID == "" || payload.PayURL != "https://pay.example.com/mobile" || payload.QRCodeURL == "" {
		t.Fatalf("unexpected response: %+v", payload)
	}
	if payload.Points != 500 || payload.AmountCents != 4900 || payload.Status != "pending" {
		t.Fatalf("unexpected order payload: %+v", payload)
	}
	if received.Get("trade_order_id") != payload.TradeOrderID {
		t.Fatalf("request trade order mismatch: form=%s response=%s", received.Get("trade_order_id"), payload.TradeOrderID)
	}
}

func TestHupijiaoNotifyCreditsPointsOnce(t *testing.T) {
	repo := store.NewMemoryStore()
	server := api.NewServer(repo, api.ServerOptions{
		Payment: api.PaymentConfig{
			PublicBaseURL: "https://claworkers.com",
			Hupijiao: api.HupijiaoConfig{
				AppID:      "test_app",
				AppSecret:  "test_secret",
				GatewayURL: "https://pay.example.com/payment/do.html",
			},
		},
	})
	cookie := registerTestUser(t, server, "pay-notify@example.com")
	before := getProfilePoints(t, server, cookie)

	order := createTestPaymentOrder(t, repo, "pay-notify@example.com", "starter")
	form := url.Values{
		"trade_order_id": {order.TradeOrderID},
		"total_fee":      {"49.00"},
		"transaction_id": {"wx_tx_123"},
		"open_order_id":  {"hupijiao_123"},
		"order_title":    {"EmboPlot 500 剧情币"},
		"status":         {"OD"},
		"appid":          {"test_app"},
		"time":           {"1779950000"},
		"nonce_str":      {"notify_nonce"},
	}
	form.Set("hash", signTestHupijiao(valuesToMap(form), "test_secret"))

	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/payments/hupijiao/notify", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		rec := httptest.NewRecorder()
		server.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != "success" {
			t.Fatalf("notify %d expected success, got %d %q", i+1, rec.Code, rec.Body.String())
		}
	}

	if got := getProfilePoints(t, server, cookie); got != before+500 {
		t.Fatalf("expected exactly one points credit, before=%d after=%d", before, got)
	}
	transactions, err := repo.ListPointTransactions(reqCtx(), order.UserID, 10)
	if err != nil {
		t.Fatalf("list transactions: %v", err)
	}
	credits := 0
	for _, item := range transactions {
		if item.Reason == "payment:hupijiao" && item.Delta == 500 {
			credits++
		}
	}
	if credits != 1 {
		t.Fatalf("expected one payment credit transaction, got %+v", transactions)
	}
}

func createTestPaymentOrder(t *testing.T, repo *store.MemoryStore, email string, planID string) models.PaymentOrder {
	t.Helper()
	user, err := repo.GetUserByEmail(reqCtx(), email)
	if err != nil {
		t.Fatalf("get user: %v", err)
	}
	order := models.PaymentOrder{
		UserID:       user.ID,
		TradeOrderID: "pay_test_order_1",
		PlanID:       planID,
		Points:       500,
		AmountCents:  4900,
		Title:        "EmboPlot 500 剧情币",
		Status:       "pending",
	}
	saved, err := repo.SavePaymentOrder(reqCtx(), user.ID, order)
	if err != nil {
		t.Fatalf("save order: %v", err)
	}
	return saved
}

func reqCtx() context.Context {
	return context.Background()
}

func verifyTestHupijiaoHash(values url.Values, secret string) bool {
	return strings.EqualFold(values.Get("hash"), signTestHupijiao(valuesToMap(values), secret))
}

func valuesToMap(values url.Values) map[string]string {
	out := make(map[string]string, len(values))
	for key := range values {
		out[key] = values.Get(key)
	}
	return out
}

func signTestHupijiao(values map[string]string, secret string) string {
	keys := make([]string, 0, len(values))
	for key, value := range values {
		if key == "hash" || value == "" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, fmt.Sprintf("%s=%s", key, values[key]))
	}
	sum := md5.Sum([]byte(strings.Join(parts, "&") + secret))
	return hex.EncodeToString(sum[:])
}
