# Smart Reader

An Arabic-first reading and study app. This repository currently keeps the V1 GitHub Pages app at the root and develops its React-based successor in [`v2/`](v2/).

## Repository layout

- Root app files: current V1 deployment. Keep these paths in place until the Pages deployment is deliberately migrated.
- [`v2/`](v2/): independently built React app and optional local companion.
- [`docs/`](docs/), [`plan.md`](plan.md), and [`recreated.md`](recreated.md): product scope, release gates, implementation plan, and V1 feature ledger.
- [`test/`](test/) and [`test-fixtures/`](test-fixtures/): repository checks and sample import documents.

## V2 status

V2 is in active development and has not passed all browser, mobile, offline, and persistence acceptance checks. Review [`docs/v2-rebuild/`](docs/v2-rebuild/) and [`docs/release-readiness.md`](docs/release-readiness.md) before considering a switch from V1.

The portable preview is attached to the [GitHub Releases](https://github.com/MohamedSaleh0-0/smart-reader/releases) page. To build it locally, run `npm ci` and `npm run build:portable` from `v2/`.

## Run V2 locally

```powershell
cd v2
npm ci
npm run dev
```

The root `package.json` provides repository-level `check` and `test` scripts.
