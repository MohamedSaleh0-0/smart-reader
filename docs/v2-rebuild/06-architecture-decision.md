# V2 foundation architecture decision

**Status:** React is selected for the UI. Vite is selected for the static app build. The unified Markdown pipeline is implemented as the first candidate, but final parser selection remains open until compared against markdown-it on the same fixture.

## Decision

Use a TypeScript web application with a static build tool and a component-based UI framework. The selected UI/build baseline is React + Vite, with the document pipeline separated from the UI:

```text
source file
  ↓
import adapter
  ↓
common structured-book model
  ↓
reader / page navigation / passage selection / citations
  ↓
local persistence
```

The first Markdown parser candidate is the unified ecosystem: Markdown parsing, GitHub-Flavored Markdown features such as tables and footnotes, conversion to a renderable syntax tree, and sanitisation before display. The initial importer implements this path and has automated fixture coverage. Passage IDs, footnote references, and source-page metadata are added in our own import transformation rather than inferred from rendered DOM alone.

## Candidates and tradeoffs

These choices are separate layers. Vite is a build tool; React, Vue, and Svelte are UI choices; unified and markdown-it are Markdown-processing choices. They can be combined in different ways.

### UI framework

| Candidate | Why it could fit | Tradeoff for this project |
|---|---|---|
| React | Large ecosystem and contributor pool; reusable components suit the library, reader, selection toolbar, notes, and side panels | More choices and conventions must be selected by us; JSX and React-specific patterns add concepts |
| Vue | Integrated, HTML-like single-file components; official tooling supports Vite, TypeScript, tests, and routing | Smaller ecosystem/contributor pool than React in many teams; still requires learning Vue conventions |
| Svelte | Concise components compiled to JavaScript; can keep UI code small | Different component model and smaller general ecosystem than React; must verify needed packages and contributor familiarity |
| Preact | Small alternative with React-compatible APIs and Vite setup | Compatibility is not identical to React; savings may not matter for a reading app if it complicates library choices |
| Vanilla TypeScript | Few dependencies; direct browser APIs and HTML | We must build and maintain component/state conventions ourselves, risking another tightly coupled application as workflows grow |

### Build tool

| Candidate | Fit |
|---|---|
| Vite | Good default for a client-side static app; provides a development server and production build without requiring a server framework |
| Parcel | Reasonable low-configuration alternative; should be considered only if it solves a concrete project constraint better |
| Webpack | Mature and flexible, but likely more configuration than this static app needs |

Vite does not force React: it supports several UI frameworks. The tool choice is therefore less consequential than the UI and document-model boundaries.

### Markdown processing

| Candidate | Why it could fit | Tradeoff |
|---|---|---|
| unified (`remark` / `rehype`) | Syntax trees and plugins support transformations, metadata, footnotes, tables, and safe HTML conversion; useful for creating our common document model | More packages and concepts; we must define compatible plugins and sanitize output correctly |
| markdown-it | Extensible parser with a token stream and a safe-by-default rendering configuration; could be a simpler choice | We must verify footnote support and how cleanly tokens map to our passage/page/media model |
| marked | Straightforward Markdown-to-HTML rendering and tokenization | Sanitization is a separate responsibility; we must verify extensions and structural extraction before adopting it |

## Current rationale for the leading candidate

- TypeScript gives the domain model compile-time checks as books, passages, media, notes, and citations grow.
- Vite can generate static files for deployment and supports a conventional local development loop.
- React is a reasonable fit for the library, contents navigation, passage selection, and later optional panels, especially if maintainers or future contributors already know it.
- A unified syntax tree is a reasonable fit when the importer must extract structure and attach stable IDs before rendering.
- HTML and DOCX adapters can produce the same structured-book model without duplicating reader logic.

React was selected after the contributors indicated no strong framework preference. It is a practical default because the reader combines a library, contents navigation, and passage actions; these are naturally decomposed into reusable UI components. This is a pragmatic choice, not a claim that React is uniquely capable: Vue, Svelte, and vanilla TypeScript could all build the same app. Keep the domain and importer layers framework-independent so the decision remains reversible if the first working slice exposes a concrete problem.

## Boundaries

The following rules are part of the decision:

- Importers never return arbitrary HTML as the domain model.
- The reader never parses Markdown itself.
- UI components never write directly to browser storage.
- Book content does not live in `localStorage`; the current implementation uses browser IndexedDB behind a repository (current schema version: 4). Fresh v2 storage is book-only. Existing v2 note records are left untouched during migration but are outside the current reader UI.
- Raw imported HTML is not rendered without sanitisation. The first Markdown importer drops raw HTML and blocks remote image loads; linked images must be local or explicitly imported.
- Local browser storage can be cleared or evicted; this foundation build must not be described as a guaranteed backup.
- Source pages and passages have stable IDs independent of their current DOM nodes; annotation/note records are a later feature.
- Vite’s build output must remain deployable as static files; no required backend is introduced by this decision.

## Deliberately postponed decisions

- Whether a small IndexedDB wrapper is justified; the first slice uses a narrow repository around the browser API.
- Routing and navigation library, if the first workflows demonstrate a need for one.
- Final Markdown parser selection; compare the unified pipeline against a smaller parser using the same fixture and structural acceptance checks.
- DOCX conversion library and its footnote/image limitations.
- PWA plugin versus a small custom service worker.
- OCR engine and PDF implementation.
- State-management library. The first spike should use a small application service and local React state until real coordination pressure appears.

## Spike acceptance criteria

The spike is successful if it can:

1. Parse `test-fixtures/v2/research-book.md`.
2. Preserve headings, tables, footnotes, image references, and page markers in a structured representation.
3. Generate stable IDs for the three repeated passages.
4. Render a safe HTML preview with Arabic RTL direction.
5. Copy a selected passage with its book title and source page citation.
6. Resolve a copied local passage link after a reload of the app.
7. Run its unit tests and production build from a clean checkout after dependencies are installed.

The UI framework decision is settled as React. The unified implementation passes automated fixture checks and produces a production build. Before treating the document pipeline or browser workflow as proven, compare it with markdown-it on the same fixture and run the import → read → copy citation/link → reload → return-to-passage flow in a clean browser profile. If the comparison or browser run exposes a material problem, revise the architecture before building more features.
