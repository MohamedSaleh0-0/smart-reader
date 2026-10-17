# Phase 0 — prototype inventory

**Status:** initial evidence baseline, 2026-10-08. This is not a claim that every feature has been re-tested.

## Evidence used

- `HANDOFF.md`: historical implementation decisions, known limits, and release history.
- `REQUIREMENTS.md`: requests made during the prototype's development.
- `docs/feature-matrix.md` and `docs/core-workflows.md`: earlier implementation and verification records.
- Code audit of the repository root: the main application is a large single `index.html`, with an embedded reader engine; `sr-mcp.js` provides the Claude Desktop bridge.
- User-led exploratory testing and captured screenshots: PDF/page behaviour, Markdown rendering, annotation UX, TTS, library navigation, citation presentation, and OCR-derived Markdown.

## Current shape of the prototype

| Concern | Observed implementation | v2 implication |
|---|---|---|
| Application shell | Installable PWA with a root service worker and local assets | Keep the offline-capable web delivery model; redesign module boundaries |
| Main code | Most application behaviour is concentrated in `index.html`; the reading engine is embedded within it | Do not carry this structure forward; isolate modules and testable domain logic |
| Persistence | Books use IndexedDB; study state and settings use browser local storage | Preserve local-first capability, but define a versioned storage and export contract |
| Import | HTML/XHTML, Markdown, TXT, DOCX, EPUB, ODT, pasted text, and PDF paths exist | Build one shared contract, then verify Markdown, semantic HTML, and DOCX adapters in sequence |
| Reader | Structured-book reader has search, highlights, notes, TOC and deep-link behaviour | Keep the user outcomes, redesign around stable passage locations |
| PDF | Local PDF.js viewer supports page-level use; text features depend on a PDF text layer | Defer native PDF handling from the v2 foundation; specify a deliberately small viewer later |
| OCR-derived Markdown | User testing showed structure loss: page boundaries and footnotes became ordinary flowing passages | Define an explicit page-and-footnote-aware Markdown contract before relying on it for study |
| AI | Direct-browser provider integrations and a selectable provider panel exist | Keep as optional later capability; it must not define the core product |
| Claude Desktop | Local MCP bridge via `sr-mcp.js` and an `.mcpb` package | Preserve the integration contract only after core book/citation formats are stable |

## Feature disposition

| Capability | Prototype state | v2 disposition | Rationale |
|---|---|---|---|
| Arabic-first, RTL study reader | Working direction established | Keep and improve | This is the product's identity |
| Offline-first local library | Implemented with browser storage | Keep; redesign persistence | Must be explicit about storage limits and backup |
| Markdown books | Present | Keep as the first vertical slice | Most controllable way to prove reading, notes, citations, and search |
| Semantic HTML and DOCX import | Present but not fully verified | Keep in the foundation; add and verify one adapter at a time | Important sources, but they must share one core reader model |
| ODT and EPUB import | Present but not fully verified | Defer | They can follow the same adapter approach after the foundation |
| Native PDF viewer | Partial | Defer | A PDF layer adds complexity without enabling the main study workflow yet |
| OCR-derived Markdown | User testing exposed structural loss | Later Markdown-import milestone | Preserve declared pages and footnotes; the problem is structure, not disappearing text |
| Passage navigation / deep links | Present with page and ordinal mechanisms | Keep; redesign locator model | v2 must identify passages, not only approximate pages |
| Highlights, notes, clips | Present | Keep; redesign data model and UI | Notes must retain durable sources and citations |
| Tags/classes | Present with fixed classes | Redesign | Tags and collections must be user-defined and editable |
| Bookmark lists | Present in limited form | Redesign | One bookmark may need multiple collection memberships |
| Audio comments | Present | Remove from the v2 core | Text transcription is the requested retained outcome |
| Browser-native prompts/confirms | Present in places | Replace when those flows return | Use application-designed dialogs/undo patterns rather than `window.prompt()` / `window.confirm()` |
| Emoji-led UI | Present in places | Replace | Use a consistent, accessible icon system |
| TTS | Browser speech synthesis, dependent on installed voices | Later feature | It is not part of the v2 foundation workflow |
| Search and Arabic normalisation | Present | Keep and test | Valuable core research workflow |
| Backup / restore / snapshots | Present | Defer full recovery system | Do not claim durable storage until export/restore is implemented and verified |
| AI question panel | Present | Defer until core reader is dependable | AI is an enhancement, not the product promise |
| Claude Desktop bridge | Present | Defer after stable exports/indexes | Its citations depend on the v2 location model |
| External book connectors | Not first-release work | Defer | The project does not depend on them for v2 validation |
| Obsidian integration | Not implemented | Defer | A future companion should consume stable exports, not dictate the core design |
| Reader/note split and multi-book tabs | Requested | Split decision: early note side panel; later multi-book tabs | Reading beside a linked note has direct study value; tab management is a separate complexity |

## Findings that change the rebuild priority

1. **Document fidelity is the main product risk once OCR-derived Markdown is supported.** OCR-derived text may preserve words while losing page boundaries, blank pages, footnote relationships, and printed-page semantics.
2. **PDF handling is not in the v2 foundation.** If it returns later, a text/OCR PDF can offer outline navigation, search, and favourite pages; a scanned PDF can offer reading and favourite pages only, unless OCR is available.
3. **The book title / section-title citation issue is minor.** Metadata can be corrected by the user today; it remains a presentational improvement, not a Phase 0 blocker. The v2 model should still keep book metadata independent of section titles.
4. **The annotation workflow is more important than the current controls.** The desired outcome is passage-based notes, clips, tags, and retrieval—not preservation of the current modal/voice-note UI.
5. **The prototype contains a broad feature set but limited verification evidence.** v2 needs a fixture-led acceptance suite before feature parity claims.

## Known prototype risks to avoid importing into v2

- A single file owns UI, persistence, import, reader rendering, and provider integration.
- Page number, printed page label, page fragment, and exact passage can be conflated.
- Storage failures or browser eviction can be invisible to users without explicit health/backup design.
- A browser-native speech voice may be presented as if it were product-controlled.
- A modal can interrupt the activity the product is meant to support: reading.
- Provider/model changes can affect AI paths without warning.

## Phase 0 verification backlog

The existing [feature matrix](../feature-matrix.md) and [core workflows](../core-workflows.md) remain the test record. The next additions should be:

1. An OCR Markdown fixture with numbered pages, empty pages, Arabic numerals, footnotes, and ambiguous marker examples.
2. A real Markdown-table fixture and an expected rendered result.
3. A citation test that distinguishes book title, section title, physical page, printed page, and selected passage.
4. A device/restore test matrix using clean browser profiles.
