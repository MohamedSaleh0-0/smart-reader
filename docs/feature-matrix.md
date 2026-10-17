# Smart Reader feature matrix

This document separates the product requirements from what is currently implemented and verified.

The handoff is treated as historical context; a feature becomes **verified** only after it passes the relevant workflow and device checks.

## Status definitions

- **Implemented**: code and a user-facing path exist, but broader device or live verification may still be needed.
- **Verified**: the main workflow has been tested on the stated target environment.
- **Partial**: some of the requested behavior exists, but coverage or reliability is incomplete.
- **Open**: implemented work has a known unresolved issue.

- **Deferred**: intentionally outside the first release scope.
- **Obsolete**: replaced or removed and should not be maintained.

## Current inventory

| Area | Current assessment | Verification needed | Release status |
|---|---|---|---|
| Root PWA shell, manifest, icons, service worker | Present at repository root | GitHub Pages deployment and offline reload | Implemented |
| Book import: HTML/XHTML, DOCX, Markdown, TXT, EPUB, ODT | Import pipeline exists in `index.html` | Fixtures for each format, malformed files, Arabic text | Implemented |
| PDF viewer | Local PDF.js viewer with search, outline, page navigation, and bookmarks | Text PDFs, scanned PDFs, mobile rendering, large files | Partial |
| Library shelf | Books, folders, tags/categories, colors, sorting | Requirements-led book tags/filter and shelf sorting exist; folders, categories/colors, and management flows remain | Partial |
| Reading and study tools | Highlights, notes, comments, copy/citation, links, notebook-related flows | Persistence, reload, backup/restore, mobile gestures | Implemented |
| Arabic search | Normalization, library search, root-search option, context results | Ranking quality on representative books | Implemented |
| Text-to-speech and audio comments | Browser audio features are present | Android, iPadOS, permissions, interruption/resume | Implemented; unverified |
| Backups and data safety | Snapshots, conflict/merge-related flows, save indicators | Restore matrix, quota failures, corrupted backup | Implemented; needs verification |
| Reading statistics and reports | Statistics and report generation are present | Accuracy against a controlled reading session | Implemented; unverified |
| AI panel | Anthropic, OpenAI, Gemini, OpenRouter, and Groq paths exist | Real keys, provider failures, privacy copy, mobile | Implemented; unverified |
| Claude Desktop bridge | `sr-mcp.js` and `.mcpb` are present | Current site/package version, Windows and Mac install | Implemented; release alignment open |
| Deep links | Book/page/ordinal hash contract exists | Real books, page-number perception mismatch | Implemented; open issue |
| Whole-library AI | Reader-side library scope exists | Large libraries, provider token limits, attribution | Partial |
| Public book connectors | No first-release implementation | Revisit after core workflow evidence | Deferred |
| Obsidian integration | No plugin in this repository | Design companion export/import later | Deferred |
| `SmartReader-PWA/` duplicate | Removed as obsolete | Confirm deletion in the cleanup commit | Obsolete |

## First-release scope decision

The first release will not depend on an external book connector. Users can import their own files, while external-library links or connectors remain a later experiment.

Obsidian is also a later integration. The standalone PWA remains the primary product; a future Obsidian companion should reuse stable book, annotation, and citation formats rather than replace the PWA immediately.

