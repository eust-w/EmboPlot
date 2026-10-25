# Project Introduction Video

The 63.5-second introduction is available as 1920 x 1080 and 1080 x 1920 MP4s in the alpha release. It uses actual application screenshots, a prewritten fictional story, original AI-assisted illustrations, and Chinese synthetic narration. It is a narrated feature overview, not a recording of live model generation or a production acceptance test.

## Reproduce

Requires Node.js, the installed Playwright Chromium browser, and FFmpeg/ffprobe. Run from the repository root:

```bash
npm ci
npx playwright install chromium
# Option A: generate narration with your own authorized Bailian API key.
node --env-file=.env scripts/showcase/promo-speech.mjs
node scripts/showcase/render-promo.mjs

# Option B: explicitly use the local Tingting synthetic voice on macOS.
node scripts/showcase/render-promo.mjs --local-voice

node scripts/showcase/promo-covers.mjs
```

Outputs are written under ignored `.artifacts/promo/`. Existing `voice-N.wav` files are reused; move them aside before changing voices. The published introduction uses macOS Tingting synthetic narration. No cloned human voice or unlicensed background music is used.

## Editorial Sources

- `scripts/showcase/promo-plan.json`: exact narration and nine-shot sequence.
- `docs/media/`: application screenshots and fictional visual assets, with provenance in its README.
- `scripts/showcase/render-promo.mjs`: horizontal/vertical layouts, restrained motion, phrase captions, normalized voice, and H.264/AAC encoding.
- `scripts/showcase/promo-covers.mjs`: 3:4 and 4:3 cover layouts.

Disclosures remain in the film, platform descriptions, and native AI-content labels where available. Do not advertise the fixture as a live AI result, imply infinite memory, or claim the alpha is production-audited. Captions use approximate phrase timing rather than speech alignment.

## Distribution

Publicly verified posts are tracked here; upload completion and review are not the same as publication.

- [X introduction](https://x.com/eustancewu/status/2114439227098448034)
- [Douyin introduction](https://www.douyin.com/video/7700690048273894671), verified on the video page and marked normal in the creator dashboard.
- Xiaohongshu: `我做了个能当导演的AI剧场`, note `6ade5952000000000803cf44`, verified in the published list and the video page. Use the platform's share flow if a direct web link requires a signed URL.

Other destinations are not implied by these results. Signed viewer URLs are deliberately excluded.

Publishing scripts intentionally do not include browser sessions, account tokens, cookies, deployment credentials, or automatic posting schedules.
