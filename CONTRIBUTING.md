# Contributing to EmboPlot

[中文说明](#中文说明) · [Quick start](docs/getting-started.md) · [Architecture](docs/architecture.md)

EmboPlot is an early-stage project. Focused fixes, reproducible bug reports, documentation and original example stories are welcome. A small, verified pull request is more useful than a large rewrite.

## Development loop

1. Fork the repository, create a branch, and follow the [local setup](docs/getting-started.md).
2. For substantial changes, open an issue describing the workflow and acceptance criteria first.
3. Keep React views in `src/components`, API orchestration in `backend/internal/api`, persistence in `store`, and model-specific calls in `modelgateway`.
4. Add a regression test for a behavior change. Use deterministic test gateways, not paid external calls in CI.
5. Run the checks below, inspect the diff for sensitive data, then open a PR.

```bash
npm ci
npm run lint
npm run build
npm run docs:check
npm audit
cd backend
go test -race ./...
go vet ./...
```

For UI changes, attach desktop and mobile screenshots and list the flow you exercised. For model changes, record model IDs, context policy and whether results came from a live API or fallback. For billing changes, include insufficient-balance, failure/refund and duplicate-notification cases.

## Useful first contributions

- Make all modal controls accessible to keyboard and screen-reader users.
- Add an English UI locale; bilingual documentation does not mean the UI is translated.
- Add focused integration tests for reentering rooms and retaining media.
- Improve document extraction with explicit format and failure handling.
- Contribute an original short scenario with a clear license and content provenance.

These are contribution directions, not a promise that the features are already implemented. Search existing issues before starting.

## Contribution boundaries

- Never submit `.env`, private keys, cookies, real customer content or signed media URLs.
- Only contribute content you have permission to redistribute. Identify AI-assisted artwork and include its source/prompt where applicable.
- Do not silently replace failures with simulated success. Keep live, fallback and fixture modes distinguishable.
- Avoid unrelated formatting and dependency upgrades in a feature PR.
- Use descriptive commits, for example `fix(theater): retain cast on room reload`.
- By contributing, you agree to license your original contributions under this repository's Apache-2.0 license.

## Community

Be respectful, explain disagreements technically, and do not publish personal information or harass other contributors. Security reports belong in the [private reporting channel](SECURITY.md), not public issues.

## 中文说明

欢迎提交小而完整的改进：先明确用户流程与验收方式，再实现、测试并提供证据。大功能请先开 Issue 讨论。UI 修改需附桌面与移动端截图；模型修改需区分真实 API、fallback 与预置样例；计费修改需覆盖失败退款和重复回调。不要提交密钥、真实用户数据或无权再分发的素材。PR 可以使用中文或英文。
