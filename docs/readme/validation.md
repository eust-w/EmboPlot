# Release validation

Date: 2026-10-25. Target: `v0.1.0-alpha.1`. A source implementation, a passing automated test and external-service acceptance are separate claims.

## Commands

```bash
npm ci
npm run lint
npm run build
npm run docs:check
npm audit
npm run showcase:record
npm run showcase:video
cd backend
go test -race -cover ./...
go vet ./...
```

## Local evidence

- TypeScript check, production build, Go race-enabled tests and `go vet` pass.
- Dependency updates remain within the existing compatible ranges; `npm audit` reports zero known vulnerabilities at the time of this check. That is a timestamped registry result, not a security certification.
- Gitleaks scanned the existing Git history without detecting a credential. The release index is separately checked before publication; this is not proof that all kinds of sensitive data can be detected automatically.
- Playwright records the real local UI against a Go API and a dedicated MongoDB database. It creates a fresh synthetic account through the normal registration API and uses normal authenticated resource endpoints.
- Desktop: 1440 x 900. Mobile: 390 x 844. Verified library/editor navigation, story setup, recipient selection, mention menu, stored scene image, Markdown download, room reentry/persistence and mobile drawer open/close. No browser errors were captured.
- The mobile test exposed hardcoded sidebar props; the release connects them to the actual React state.
- The approximately 30-second MP4 is a silent workflow recording with bilingual captions. The GIF is a compressed preview. The prewritten scene and prepared AI-assisted art are explicitly disclosed.

## Limits

- No live DashScope model request or real payment was used for the showcase. It does not measure model latency, narrative quality or TTS playback quality.
- The backend unit tests mostly use an in-memory store; the separate browser recording provides a narrow real-Mongo workflow check, not full database coverage.
- Build succeeds with a bundle-size warning (main JavaScript chunk over 500 kB). Code splitting remains future performance work.
- Public HTTPS deployment, provider URL expiry, document extraction formats and full billing reconciliation require separate acceptance.
- This is alpha software. The [security checklist](../../SECURITY.md) documents remaining production hardening requirements.

GitHub Actions runs frontend checks, race-enabled backend tests and the isolated browser workflow. See the [actual workflow result](https://github.com/eust-w/EmboPlot/actions/workflows/ci.yml), not just the README badge.
