# Contributing to auralog-sdk

Thanks for your interest in improving the Auralog JavaScript SDK! This guide covers the basics.

## Scope

This repo is the **JavaScript/TypeScript SDK** only. For issues with the Auralog service itself (ingest, dashboard, analysis, billing), head to [auralog.ai](https://auralog.ai) or the [docs](https://docs.auralog.ai).

## Reporting bugs

Open a [bug report](https://github.com/auralog-ai/auralog-js/issues/new?template=bug_report.yml). Include:

- SDK version
- Runtime (Node version, browser, Deno, etc.)
- Minimal reproduction
- What you expected vs. what happened

## Suggesting features

Open a [feature request](https://github.com/auralog-ai/auralog-js/issues/new?template=feature_request.yml). Describe the use case first, the proposed API second.

## Security issues

**Please don't open public issues for vulnerabilities.** See [SECURITY.md](./SECURITY.md) for how to report them privately.

## Development setup

Requirements: Node ≥ 20, npm.

```bash
git clone https://github.com/auralog-ai/auralog-js.git
cd auralog-js
npm ci
npm test
```

## Making a change

1. Fork the repo and create a branch from `main` (e.g., `fix/flush-on-shutdown`).
2. Keep PRs small and focused. One logical change per PR.
3. Add or update tests for any behavior change.
4. Run the full check locally before opening a PR:
   ```bash
   npm run lint && npm test && npm run build
   ```
5. Open a PR against `main`. CI will run on Node 20 and 22.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `test:` — tests only
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `build:` — build system, CI, dependencies
- `chore:` — other housekeeping (e.g., release commits)

One line is fine for small changes; add a body if context matters.

## Releases

Maintainers publish via GitHub Releases. Tagging `vX.Y.Z` + publishing a release triggers the `Release` workflow, which runs tests and publishes to npm via OIDC Trusted Publisher — no manual `npm publish` needed.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
