<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# EmboPlot

互动式多角色剧场 demo。当前仓库包含 Vite/React 前端，以及 Go + MongoDB 后端 API。

View your app in AI Studio: https://ai.studio/apps/de8c2df8-ac5e-4846-90de-c9914697af3d

## Run Locally

**Prerequisites:** Node.js, Go 1.24+, Docker


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and set `AUTH_JWT_SECRET` plus `DASHSCOPE_API_KEY` for Alibaba Cloud Model Studio / 百炼 model calls.
3. Start MongoDB:
   `docker compose up -d mongodb`
4. Start the Go API:
   `npm run backend:dev`
5. In another terminal, run the app:
   `npm run dev`

The frontend proxies `/api` to `http://localhost:8080` by default. Auth uses an HttpOnly session cookie, so frontend requests include credentials automatically. If the API is unavailable, the demo falls back to local mock data so UI work can continue.

All model capabilities are routed through the Go backend. If `DASHSCOPE_API_KEY` is missing, the backend uses deterministic local fallback responses for development.

## Backend

The backend lives in `backend/`:

- `cmd/server` starts the HTTP API.
- `internal/api` owns routes, auth/session cookies, validation, exports, and onboarding parsing.
- `internal/auth` owns password hashing and signed session tokens.
- `internal/store` owns MongoDB persistence, user workspace seeding, and test-only memory storage.
- `internal/models` mirrors the frontend data contracts.

Useful commands:

- `npm run backend:test`
- `cd backend && GOSUMDB=off go test ./...` if the Go checksum service is temporarily unreachable.

Core routes:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/auth/me`
- `GET /api/bootstrap`
- `GET|POST /api/characters`
- `PUT /api/characters/{id}`
- `POST /api/characters/{id}/publish`
- `GET|POST /api/stories`
- `GET|POST /api/rooms`
- `GET|PUT|DELETE /api/rooms/{id}`
- `POST /api/rooms/{id}/lines`
- `POST /api/rooms/{id}/generate`
- `GET|PATCH /api/profile`
- `POST /api/onboarding/parse-character`
- `POST /api/exports/markdown`
- `GET /api/models/capabilities`
- `POST /api/models/character`
- `POST /api/models/story`
- `POST /api/models/image`
- `POST /api/models/character-image`
- `POST /api/models/story-image`
- `POST /api/models/image-edit`
- `POST /api/models/scene-image`
- `POST /api/models/speech`
- `POST /api/models/transcribe`
- `POST /api/models/embed`
- `POST /api/models/moderate`
- `POST /api/models/vision`
