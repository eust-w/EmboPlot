# Reproduce the showcase

The README shows real browser interactions with the local React app and Go/MongoDB API. A fresh account receives **prewritten fictional data** through normal authenticated endpoints. Model and payment keys are empty. The recorder does not stub successful model responses or use a production account.

## Prerequisites

- Follow [local setup](getting-started.md); have MongoDB on `127.0.0.1:27017`.
- Install FFmpeg for MP4/GIF encoding and Chromium for recording:

```bash
npm ci
npx playwright install chromium
```

For Linux recording, install a CJK font such as Noto Sans CJK so Chinese captions are legible. The Browser plugin is not required; the script uses Playwright directly for reproducible video capture.

## Isolate the backend

Build once, then run from a temporary directory so the production/local `.env` cannot override test configuration. In a dedicated terminal, from the repository root:

```bash
ROOT="$PWD"
RUN_DIR="$(mktemp -d)"
(cd backend && go build -o "$RUN_DIR/emboplot-api" ./cmd/server)
cd "$RUN_DIR"
env PORT=18088 \
  MONGODB_URI=mongodb://127.0.0.1:27017 \
  MONGODB_DATABASE=emboplot_showcase \
  ALLOWED_ORIGIN=http://localhost:3197 \
  PUBLIC_BASE_URL=http://localhost:3197 \
  AUTH_JWT_SECRET="$(openssl rand -hex 32)" \
  AUTH_COOKIE_SECURE=false \
  DASHSCOPE_API_KEY= HUPIJIAO_APP_ID= HUPIJIAO_APP_SECRET= \
  ./emboplot-api
```

Do not reuse a real database for `emboplot_showcase`. The script creates a fresh disposable account on each run, removes only that account's private seed resources, then creates its own cast, story and room. Test accounts remain in that dedicated database; remove the test database manually when no longer needed. No credentials/cookies are saved in the recording artifacts.

## Record

In another terminal from the repository root:

```bash
VITE_API_PROXY_TARGET=http://127.0.0.1:18088 \
  npm run dev -- --port 3197 --host 127.0.0.1 --strictPort
```

Then:

```bash
npm run showcase:record
npm run showcase:video
```

The recorder refuses a non-local `SHOWCASE_URL` and checks that the model gateway is in fallback mode. It exercises the library, character editor, theater setup, target selection, mention menu, saved scene image, Markdown download, room reentry and mobile drawer. It asserts persistence, browser errors and mobile page width. It intentionally does **not** test live model generation or payment settlement.

Outputs:

- `docs/media/*.jpg`: real screenshots for the README.
- `docs/media/demo.gif`: a compact animated preview.
- `.artifacts/showcase/emboplot-walkthrough.mp4`: silent video with burned-in bilingual captions.
- `.artifacts/showcase/emboplot-walkthrough.srt`: separate accessible subtitle text.
- `.artifacts/showcase/sample-script.md`: actual downloaded export.
- `.artifacts/showcase/chapters.json`: recording timestamps.

The raw recording and MP4 are ignored by Git. Upload the MP4/SRT to a GitHub Release; keep only lightweight preview media in the repository. The renderer adds captions in a separate bottom band, never on top of application controls. Update both READMEs when changing release asset URLs.

## Source material

[`fixture.mjs`](../scripts/showcase/fixture.mjs) contains the original scene and characters. [Media provenance](media/README.md) describes the AI-assisted illustrations. The [sample script](examples/the-last-signal.md) includes an English translation for readers who do not read Chinese.
