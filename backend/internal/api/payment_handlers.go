package api

import (
	"context"
	"crypto/md5"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"

	"emboplot/backend/internal/models"
)

const (
	hupijiaoProvider       = "hupijiao"
	hupijiaoAPIVersion     = "1.1"
	defaultHupijiaoGateway = "https://api.dpweixin.com/payment/do.html"
)

type PaymentConfig struct {
	PublicBaseURL string         `json:"publicBaseUrl"`
	Hupijiao      HupijiaoConfig `json:"hupijiao"`
	Plans         []RechargePlan `json:"plans"`
}

type HupijiaoConfig struct {
	AppID      string `json:"-"`
	AppSecret  string `json:"-"`
	GatewayURL string `json:"gatewayUrl"`
}

type RechargePlan struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Points      int    `json:"points"`
	AmountCents int    `json:"amountCents"`
}

type rechargeRequest struct {
	PlanID string `json:"planId"`
}

type rechargeResponse struct {
	TradeOrderID string `json:"tradeOrderId"`
	PayURL       string `json:"payUrl"`
	QRCodeURL    string `json:"qrCodeUrl"`
	Points       int    `json:"points"`
	AmountCents  int    `json:"amountCents"`
	Status       string `json:"status"`
}

func (c PaymentConfig) withDefaults() PaymentConfig {
	c.PublicBaseURL = strings.TrimRight(strings.TrimSpace(c.PublicBaseURL), "/")
	if strings.TrimSpace(c.Hupijiao.GatewayURL) == "" {
		c.Hupijiao.GatewayURL = defaultHupijiaoGateway
	}
	if len(c.Plans) == 0 {
		c.Plans = defaultRechargePlans()
	}
	return c
}

func defaultRechargePlans() []RechargePlan {
	return []RechargePlan{
		{ID: "starter", Label: "入门", Points: 500, AmountCents: 4900},
		{ID: "pro", Label: "推荐", Points: 1200, AmountCents: 9900},
		{ID: "max", Label: "超值", Points: 6500, AmountCents: 49900},
	}
}

func (s *Server) handlePayments(w http.ResponseWriter, r *http.Request, segments []string) {
	if len(segments) == 2 && segments[1] == "plans" {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"plans": s.payment.Plans})
		return
	}

	if len(segments) == 2 && segments[1] == "recharge" {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		s.handleCreateRechargeOrder(w, r)
		return
	}

	if len(segments) == 3 && segments[1] == "hupijiao" && segments[2] == "notify" {
		if r.Method != http.MethodPost {
			writePlain(w, http.StatusMethodNotAllowed, "fail")
			return
		}
		s.handleHupijiaoNotify(w, r)
		return
	}

	writeError(w, http.StatusNotFound, "route not found")
}

func (s *Server) handleCreateRechargeOrder(w http.ResponseWriter, r *http.Request) {
	if !s.payment.hupijiaoEnabled() {
		writeError(w, http.StatusServiceUnavailable, "payment provider is not configured")
		return
	}
	var payload rechargeRequest
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	plan, ok := s.payment.planByID(payload.PlanID)
	if !ok {
		writeError(w, http.StatusBadRequest, "unknown recharge plan")
		return
	}

	tradeOrderID, err := newPaymentTradeOrderID()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create order id")
		return
	}
	userID := currentUserID(r.Context())
	title := paymentTitle(plan)
	order := models.PaymentOrder{
		UserID:       userID,
		Provider:     hupijiaoProvider,
		TradeOrderID: tradeOrderID,
		PlanID:       plan.ID,
		Title:        title,
		Points:       plan.Points,
		AmountCents:  plan.AmountCents,
		Status:       "pending",
	}
	order, err = s.repo.SavePaymentOrder(r.Context(), userID, order)
	if err != nil {
		writeError(w, statusFromError(err), err.Error())
		return
	}

	paymentURL, qrCodeURL, err := s.createHupijiaoPayment(r.Context(), order)
	if err != nil {
		s.logger.Warn("hupijiao order creation failed", "tradeOrderId", order.TradeOrderID, "error", err)
		writeError(w, http.StatusBadGateway, "payment provider request failed")
		return
	}
	order.PayURL = paymentURL
	order.QRCodeURL = qrCodeURL
	order, err = s.repo.SavePaymentOrder(r.Context(), userID, order)
	if err != nil {
		writeError(w, statusFromError(err), err.Error())
		return
	}

	writeJSON(w, http.StatusOK, rechargeResponse{
		TradeOrderID: order.TradeOrderID,
		PayURL:       order.PayURL,
		QRCodeURL:    order.QRCodeURL,
		Points:       order.Points,
		AmountCents:  order.AmountCents,
		Status:       order.Status,
	})
}

func (s *Server) createHupijiaoPayment(ctx context.Context, order models.PaymentOrder) (string, string, error) {
	form := map[string]string{
		"version":        hupijiaoAPIVersion,
		"appid":          s.payment.Hupijiao.AppID,
		"trade_order_id": order.TradeOrderID,
		"total_fee":      formatAmountCents(order.AmountCents),
		"title":          sanitizePaymentTitle(order.Title),
		"time":           strconv.FormatInt(time.Now().Unix(), 10),
		"notify_url":     s.payment.publicURL("/api/payments/hupijiao/notify"),
		"return_url":     s.payment.publicURL("/?payment=success&tradeOrderId=" + url.QueryEscape(order.TradeOrderID)),
		"callback_url":   s.payment.publicURL("/?payment=cancel&tradeOrderId=" + url.QueryEscape(order.TradeOrderID)),
		"plugins":        "emboplot",
		"nonce_str":      randomHex(16),
	}
	form["hash"] = hupijiaoSign(form, s.payment.Hupijiao.AppSecret)

	encoded := url.Values{}
	for key, value := range form {
		encoded.Set(key, value)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.payment.Hupijiao.GatewayURL, strings.NewReader(encoded.Encode()))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("hupijiao status %d", resp.StatusCode)
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return "", "", err
	}
	flat := stringifyMap(payload)
	if hash := strings.TrimSpace(flat["hash"]); hash != "" && !hupijiaoVerify(flat, s.payment.Hupijiao.AppSecret) {
		return "", "", fmt.Errorf("invalid hupijiao response hash")
	}
	if code := strings.TrimSpace(flat["errcode"]); code != "" && code != "0" {
		return "", "", fmt.Errorf("hupijiao errcode %s: %s", code, flat["errmsg"])
	}
	payURL := strings.TrimSpace(flat["url"])
	qrCodeURL := strings.TrimSpace(flat["url_qrcode"])
	if payURL == "" && qrCodeURL == "" {
		return "", "", fmt.Errorf("hupijiao response missing payment url")
	}
	return payURL, qrCodeURL, nil
}

func (s *Server) handleHupijiaoNotify(w http.ResponseWriter, r *http.Request) {
	if !s.payment.hupijiaoEnabled() {
		writePlain(w, http.StatusServiceUnavailable, "fail")
		return
	}
	if err := r.ParseForm(); err != nil {
		writePlain(w, http.StatusBadRequest, "fail")
		return
	}
	values := valuesToStringMap(r.PostForm)
	if !hupijiaoVerify(values, s.payment.Hupijiao.AppSecret) {
		s.logger.Warn("invalid hupijiao notify hash", "tradeOrderId", values["trade_order_id"])
		writePlain(w, http.StatusBadRequest, "fail")
		return
	}
	if strings.TrimSpace(values["appid"]) != s.payment.Hupijiao.AppID {
		writePlain(w, http.StatusBadRequest, "fail")
		return
	}
	if strings.TrimSpace(values["status"]) != "OD" {
		writePlain(w, http.StatusOK, "success")
		return
	}
	tradeOrderID := strings.TrimSpace(values["trade_order_id"])
	if tradeOrderID == "" {
		writePlain(w, http.StatusBadRequest, "fail")
		return
	}
	order, err := s.repo.GetPaymentOrderByTradeID(r.Context(), tradeOrderID)
	if err != nil {
		writePlain(w, statusFromError(err), "fail")
		return
	}
	amountCents, err := parseAmountCents(values["total_fee"])
	if err != nil || amountCents != order.AmountCents {
		writePlain(w, http.StatusBadRequest, "fail")
		return
	}

	order, shouldCredit, err := s.repo.MarkPaymentOrderPaid(r.Context(), tradeOrderID, values["open_order_id"], values["transaction_id"])
	if err != nil {
		writePlain(w, statusFromError(err), "fail")
		return
	}
	if shouldCredit {
		_, err = s.repo.CreditPoints(r.Context(), order.UserID, order.Points, "payment:hupijiao", map[string]string{
			"tradeOrderId":  order.TradeOrderID,
			"planId":        order.PlanID,
			"provider":      order.Provider,
			"openOrderId":   order.OpenOrderID,
			"transactionId": order.TransactionID,
		})
		if err != nil {
			s.logger.Error("failed to credit payment points", "tradeOrderId", order.TradeOrderID, "userId", order.UserID, "error", err)
			writePlain(w, statusFromError(err), "fail")
			return
		}
	}
	writePlain(w, http.StatusOK, "success")
}

func (c PaymentConfig) hupijiaoEnabled() bool {
	return strings.TrimSpace(c.Hupijiao.AppID) != "" &&
		strings.TrimSpace(c.Hupijiao.AppSecret) != "" &&
		strings.TrimSpace(c.Hupijiao.GatewayURL) != "" &&
		strings.TrimSpace(c.PublicBaseURL) != ""
}

func (c PaymentConfig) planByID(id string) (RechargePlan, bool) {
	for _, plan := range c.Plans {
		if plan.ID == id {
			return plan, true
		}
	}
	return RechargePlan{}, false
}

func (c PaymentConfig) publicURL(path string) string {
	base := strings.TrimRight(c.PublicBaseURL, "/")
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return base + path
}

func paymentTitle(plan RechargePlan) string {
	return fmt.Sprintf("EmboPlot %d 剧情币", plan.Points)
}

func sanitizePaymentTitle(value string) string {
	value = strings.ReplaceAll(value, "%", "")
	out := strings.Builder{}
	for _, r := range value {
		if unicode.IsControl(r) || unicode.Is(unicode.So, r) {
			continue
		}
		out.WriteRune(r)
	}
	trimmed := strings.TrimSpace(out.String())
	if trimmed == "" {
		return "EmboPlot 剧情币"
	}
	runes := []rune(trimmed)
	if len(runes) > 42 {
		return string(runes[:42])
	}
	return trimmed
}

func hupijiaoSign(values map[string]string, secret string) string {
	keys := make([]string, 0, len(values))
	for key, value := range values {
		if key == "hash" || strings.TrimSpace(value) == "" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, key+"="+values[key])
	}
	sum := md5.Sum([]byte(strings.Join(parts, "&") + secret))
	return hex.EncodeToString(sum[:])
}

func hupijiaoVerify(values map[string]string, secret string) bool {
	got := strings.TrimSpace(values["hash"])
	if got == "" {
		return false
	}
	return strings.EqualFold(got, hupijiaoSign(values, secret))
}

func valuesToStringMap(values url.Values) map[string]string {
	out := make(map[string]string, len(values))
	for key := range values {
		out[key] = values.Get(key)
	}
	return out
}

func stringifyMap(values map[string]any) map[string]string {
	out := make(map[string]string, len(values))
	for key, value := range values {
		switch typed := value.(type) {
		case string:
			out[key] = typed
		case float64:
			if typed == float64(int64(typed)) {
				out[key] = strconv.FormatInt(int64(typed), 10)
			} else {
				out[key] = strconv.FormatFloat(typed, 'f', -1, 64)
			}
		case nil:
			out[key] = ""
		default:
			out[key] = fmt.Sprint(typed)
		}
	}
	return out
}

func formatAmountCents(cents int) string {
	return fmt.Sprintf("%d.%02d", cents/100, cents%100)
}

func parseAmountCents(value string) (int, error) {
	value = strings.TrimSpace(value)
	if value == "" || strings.HasPrefix(value, "-") {
		return 0, fmt.Errorf("invalid amount")
	}
	parts := strings.Split(value, ".")
	if len(parts) > 2 {
		return 0, fmt.Errorf("invalid amount")
	}
	yuan, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, err
	}
	cents := 0
	if len(parts) == 2 {
		fraction := parts[1]
		if len(fraction) > 2 {
			return 0, fmt.Errorf("invalid amount")
		}
		for len(fraction) < 2 {
			fraction += "0"
		}
		cents, err = strconv.Atoi(fraction)
		if err != nil {
			return 0, err
		}
	}
	return yuan*100 + cents, nil
}

func newPaymentTradeOrderID() (string, error) {
	return "EP" + strconv.FormatInt(time.Now().UnixMilli(), 10) + randomHex(5), nil
}

func randomHex(bytes int) string {
	buf := make([]byte, bytes)
	if _, err := rand.Read(buf); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return hex.EncodeToString(buf)
}

func writePlain(w http.ResponseWriter, status int, body string) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(body))
}
