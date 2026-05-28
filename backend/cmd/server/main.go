package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"time"

	"emboplot/backend/internal/api"
	"emboplot/backend/internal/config"
	"emboplot/backend/internal/modelgateway"
	"emboplot/backend/internal/store"
)

func main() {
	if err := config.LoadDotenv(".env", "../.env"); err != nil && !os.IsNotExist(err) {
		log.Printf("load local .env: %v", err)
	}

	cfg := config.Load()
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	repo, err := store.NewMongoStore(ctx, cfg.MongoURI, cfg.MongoDatabase)
	if err != nil {
		log.Fatalf("connect mongodb: %v", err)
	}
	defer repo.Disconnect(context.Background())

	if err := repo.EnsureSeed(ctx); err != nil {
		log.Fatalf("seed mongodb: %v", err)
	}

	server := api.NewServer(repo, api.ServerOptions{
		AllowedOrigin: cfg.AllowedOrigin,
		Logger:        logger,
		Auth:          cfg.Auth,
		ModelGateway:  modelgateway.New(cfg.ModelGateway, nil),
		Payment: api.PaymentConfig{
			PublicBaseURL: cfg.PublicBaseURL,
			Hupijiao: api.HupijiaoConfig{
				AppID:      cfg.Payment.HupijiaoAppID,
				AppSecret:  cfg.Payment.HupijiaoAppSecret,
				GatewayURL: cfg.Payment.HupijiaoGatewayURL,
			},
		},
	})

	addr := ":" + cfg.Port
	logger.Info("EmboPlot API listening", "addr", addr, "database", cfg.MongoDatabase, "models", modelgateway.DebugSummary(cfg.ModelGateway))
	if err := http.ListenAndServe(addr, server); err != nil {
		log.Fatal(err)
	}
}
