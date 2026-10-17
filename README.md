# Smart Reader

An Arabic-first reading and study app. The repository contains the existing single-page app at the root and an independently built React-based v2 in [`v2/`](v2/).

## v2 status

The v2 reader is in active development. Its current scope and open release checks are documented in [`docs/v2-rebuild/`](docs/v2-rebuild/) and [`docs/release-readiness.md`](docs/release-readiness.md). A portable preview is available in [`release/`](release/); see its README for browser-storage and offline limitations.

## Run v2 locally

```powershell
cd v2
npm ci
npm run dev
```

The root `package.json` also provides repository-level `check` and `test` scripts. The v2 production and portable builds are defined in `v2/package.json`.
