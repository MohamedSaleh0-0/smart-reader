# Smart Reader v2 implementation plan

Updated 2026-10-16 (iteration 41). This checklist remains active; older discovery sections may describe earlier scope decisions. Iterations 39–40 delivered the already listed alias, collection, category, link, Turath, fold, and library-search work. Iteration 40 also added an outline-height slider that did not match the requested horizontal resizing; iteration 41 replaces it with a persistent, keyboard-adjustable sidebar width, and adds the separate library page, nested folders, book filing, author/tag filtering, and modal comments saved in the notebook. The full review and remaining browser acceptance list is in `docs/v2-rebuild/09-user-review-triage.md`. The project continues with the user-approved recreate-first approach.

## How we will work with minimal demands on the user

The user has limited time for planning and repeated reviews. The assistant owns the source analysis, implementation, tests, fixture creation, architecture, and checklist maintenance. Work should continue independently wherever original behavior can be established from the prototype, existing decisions, and safe technical judgment.

### Non-negotiable recreation rule

“Recreate” means reproduce the original feature's user-observable behavior: the same trigger, action sequence, available choices, data/state change, navigation result, copied/exported output, and relevant keyboard/touch behavior. A similar-looking control that does something different is not parity. Before implementation, inspect the corresponding original code and workflow, then record the observable contract and test it against v2.

Visual styling, iconography, spacing, and placement may be modernized only when the original behavior remains available and the change has a concrete usability/accessibility reason. A change to the interaction sequence or outcome is a behavioral change, not a cosmetic redesign: do not make it merely because it seems nicer. First look for a way to improve presentation without losing behavior; if that is not possible, give the user one concise, evidence-based question and do the rest of the work meanwhile. Never describe an untested implementation as “exactly like the original.”

- [x] Use the original app as the behavioral reference; implement clear, already-agreed features without asking for approval each time.
- [x] Keep a single source of truth for feature status in `recreated.md` and execution/checkpoint status in this file; record implemented, tested, visually reviewed, deferred, and scope-undecided as distinct states.
- [x] For each work batch, inspect the matching original code/UI, write the acceptance checks, implement a bounded vertical slice, run relevant tests/build, and update both checklists before moving on. — **Applied in iteration 13; browser-level checks remain explicit instead of being inferred from code/tests.**
- [ ] Do not ask the user to choose architecture, libraries, or implementation details that can be decided from repository evidence and ordinary engineering judgment.
- [ ] Do not send generic “what do you think?” requests. At review gates, prepare the runnable version and ask only the few concrete questions listed below, with screenshots or exact reproduction steps when useful.
- [ ] Continue non-blocked work while waiting for a review. Record uncertain observations and keep them configurable; do not silently convert a guess into a product decision.

### Review gates — three bundled reviews, not review after every feature

1. **Reader and import review:** after the structured-reader acceptance batch. Provide one runnable build and short steps to import the supplied Markdown/HTML/DOCX samples. Ask only: (a) do page surfaces, font, headings, and page numbering feel like the original; (b) are footnotes/images/tables kept in the right place; (c) do the two passage toolbars appear and behave correctly; (d) does the copied citation look right? Include known limitations so the user can focus on those points.
2. **Study-workspace review:** after collection, favorites, unified notebook/comments, categories, and their principal exports have been brought close to the original. Ask only whether the original study-drawer organization is recognizable, whether favorite tags/filter/order match the user's mental model, and whether the prepared copy/export output is usable. Do not ask the user to retest domain cases already covered by automated tests.
3. **Whole-app and PDF review:** after library workflows, reading modes, statistics, and the separate PDF mode reach a coherent build. Provide a short checklist separating searchable/OCR PDFs from image-only scans. Ask for feedback only on visible defects, the known page/footnote/OCR fidelity cases, and any deliberate differences from the original.

**Current checkpoint:** Iterations 35–40 delivered reader root search, shelf sorting, saved reading progress, per-book tags, library search, Turath search, and selected-paragraph folding. Iteration 41 adds a distinct library home with nested local folders and metadata/content filters, a horizontal resize handle for the current-book outline sidebar, and modal passage comments. The V2 production build and TypeScript check pass. The 90 V2 unit tests and 11 repository tests passed at iteration 34 but have not been rerun after later iterations. Browser persistence, interaction, and responsive review remain open.

Visual matching ultimately needs a human with the original and the new build visible. Until a gate is ready, the assistant should use code inspection, fixtures, automated tests, and screenshots/browser automation if available; never claim that a passing build proves visual parity. If the user cannot review a gate, keep implementing against the original and carry the open visual checks forward.

### Autonomous work batches

The sequence below is the delivery order. Each batch is completed and tested before the next begins; architectural extraction happens incrementally alongside feature work, not as a risky rewrite.

1. **Structured-reader correctness:** source-page and page-range semantics, explicit blank-page representation, reference-page footnote association across Markdown/HTML/DOCX, and Markdown-relative images are implemented (iterations 11–15); complete Markdown/HTML/DOCX browser fixture acceptance and prepare Review Gate 1. OCR-specific marker syntax and HTML skipped-page handling still need representative-source validation.
2. **Study workspace parity:** comments and quote notes now share the notebook; favorite multi-tags/filter/order/bulk copy, collection editing, category/color/search filters, cross-book groups, bookmark-based Word comment round-trip, and formatted paste are implemented. Same-book link creation was removed at the user's direction; old saved relations remain readable/removable. Finish accessibility/browser acceptance. Keep the user's modal comment UI without stored audio comments.
3. **Study exports and reporting:** collection/favorites/notebook/category Word exports, numbering, per-book study JSON portability, Word comment round-trip, reading-time/streak/library totals, per-chapter counts, summary copying, and the downloadable teacher report are implemented. Browser download and visual acceptance remain open.
4. **Library and import parity:** TXT import recognizes the original page-label variants, numbered notes after a separator, and Markdown files with multiple headings. EPUB follows its declared spine and ODT maps structured text into the shared HTML importer; drag/drop is restored for the empty library. Browser fixtures remain. Root search and shelf sorting are implemented in iterations 35–36; nested folders and per-book tags/filtering are implemented in iterations 38 and 41; per-book categories/colors, metadata management, error handling, and migration/browser acceptance remain. Keep every importer behind the shared book contract.
5. **Reader tools and navigation:** page progress is implemented in iteration 37. Remaining gaps include reader modes, shortcuts/help, backward history, split/tabs, the user's cream theme, and calm save/undo feedback. Cross-book groups are implemented; do not offer creation of same-book one-to-one links. Keep the current SVG icon direction and rejected outline pin/collection arrows out.
6. **Native PDF mode:** implement the original PDF.js behaviors as a separate adapter/viewer (outline, text search, page navigation/favorites, zoom/fit/invert, saved position), plus target-page emphasis when searchable text permits. Preserve simple read/favorite behavior for scanned PDFs; do not promise OCR until a separate decision/implementation exists.
7. **Recovery, onboarding, and finish:** revisit snapshots, backup/restore, conflict handling/sync, tours, help, accessibility, responsive behavior, and run the complete regression/acceptance suite. Then prepare Review Gates 2 and 3 as applicable and make a final parity/deviation report.

**Default when scope is unclear:** reproduce the original behavior. Keep only user-approved changes (no stored voice comments; text transcription instead, modal comments, SVG icons, no up/down reorder buttons, and no outline pin). Park unresolved extras such as external-note handoff without blocking the rest. Ask the user only when a decision changes product scope or requires personal access/credentials, legal/rights judgment, destructive data action, or behavior that cannot be inferred safely from the prototype.

### Explicitly approved differences — keep these from being accidentally “fixed” back

- Open the comment editor in a modal over the book while preserving comment save, edit, retrieval, and notebook storage.
- Use consistent SVG icons instead of emoji; icon changes must not remove or combine actions.
- Do not show up/down reorder arrows. Preserve the same reorder capability through the already implemented drag/keyboard interaction.
- Do not add the original outline pin control.
- Do not record/store audio comments. Speech-to-text is the approved alternative; it is not permission to restore audio recording.
- Keep the user-approved local-only passage link as an extra, clearly distinct from original parity.
- Cream theme and calmer notices/save feedback are approved presentation/feedback improvements only if they preserve the underlying reading, save, and undo outcomes.

If another discrepancy from the original is discovered, first implement the original behavior as the default. Add a new exception here only after the user approves it.

### When user input is genuinely required

Ask only when source code, existing decisions, and safe implementation cannot settle a product-impacting question. State: **what exact decision is blocked; what the original does (if relevant); the smallest set of options and the recommended one; and what independent work continues meanwhile.** For a review request, provide a ready-to-run build, numbered steps, expected behavior, and at most a few focused feedback questions. Never ask the user to perform code analysis or repeat automated checks.

## Product and design decisions

- [x] Keep the original application intact as a behavioural and visual reference. — **Applied**
- [x] Recreate the original workflows and tools before pruning, while preserving the already explicit removal of stored audio comments. — **Decision updated by user on 2026-10-10; implementation is in progress**
- [x] Treat Markdown, semantic HTML, and DOCX as the initial structured-book import targets. — **Agreed; adapters now exist, but HTML/DOCX browser acceptance is pending**
- [x] Keep Markdown/HTML/DOCX structured reading as the first import lane; treat native PDF reading as its own mode rather than mixing its behavior into structured pages. — **Agreed; PDF parity remains in the backlog**
- [x] Keep standalone Markdown note-authoring, AI providers, Claude Desktop, Obsidian, and external library connectors outside this prototype-parity pass unless the project decision group reopens them. — **Applied initially; the user reopened cloud AI and Claude/Codex integration on 2026-10-16**
- [x] Reopen original TTS and study-notebook features for recreation-first parity; retain the user's explicit decision not to store voice comments and use transcription instead. — **Decision updated 2026-10-10; TTS/transcription remain unimplemented**
- [x] Use the original bundled Amiri, Aref Ruqaa, and Cairo fonts and its dark/light reader palette. — **Applied in v2**
- [x] Preserve source-page markers separately from displayed Arabic labels, without labeling generated DOCX positions as printed pages. — **Applied for Markdown and marked HTML; DOCX hard-break positions are disclosed as internal**
- [ ] Confirm the release boundary and public branding/rights with the project decision group. — **Not applied**

## Phase 0 — prototype and evidence

- [x] Inventory the current prototype's working, partial, and deferred feature areas. — **Applied** (`docs/v2-rebuild/00-prototype-inventory.md`)
- [x] Capture user-tested problems and conclusions. — **Applied** (`docs/core-workflows.md`, `docs/feature-matrix.md`)
- [x] Create three-page Markdown, HTML, and DOCX test sources. — **Applied**
- [x] Inspect the original reader's page, font, palette, and heading implementation. — **Applied** (reader engine in root `index.html`; v2 now ports its principal visual rules)
- [x] Compare the original built-in feature guide and embedded reader-engine workflows against the actual v2 implementation. — **Applied in iteration 9** (`docs/v2-rebuild/08-original-feature-audit.md`; no app behavior was changed)
- [ ] Verify all source formats and edge cases in a real browser with the project owner's representative books. — **Not applied**

## Phase 1 — user journey and acceptance

- [x] Define the reader journey: import/read/navigate → hover a passage or select text → use the independent passage and selection toolbars → save/use study material from the study drawer. — **Implemented in code; browser acceptance remains**
- [x] Include basic in-book passage search and editable title/author metadata so citations can be corrected. — **Applied in the UI; browser testing remains**
- [x] Keep the original quote-linked study notebook in the parity scope; do not expand it into a standalone Markdown note editor. Keep AI/Claude, Obsidian, and external connectors deferred. — **Applied as scope**
- [?] Reconcile earlier deferrals for backup/restore, cross-device sync, and multi-book tabs/split-screen with the user's recreate-first direction. They exist in the original, but were previously identified as later-release work; do not quietly call them absent from the original or build cloud behavior without reviewing its requirements.
- [ ] Run the journey with intended Arabic readers and record failures. — **Not applied**

## Phase 2 — domain and technical foundation

- [x] Model books, source pages, headings, passages, footnotes, and citations independently of the UI. — **Applied**
- [x] Separate declared source-page numbers from generated reader-page positions; never cite an internal page as a printed page. — **Applied for Markdown and marked HTML; DOCX hard breaks are retained as internal positions because Word does not provide printed labels reliably**
- [x] Keep passage references stable across repeated text and add local book/passage links. — **Applied**
- [x] Use IndexedDB behind a versioned repository and migrate older v2 book records. — **Applied in code; browser migration not manually verified**
- [x] Sanitize Markdown output and block implicit remote image loads. — **Applied and unit-tested**
- [x] Select React + TypeScript + Vite for the new UI/build. — **Applied**
- [ ] Compare unified/remark with markdown-it against the same fixtures before finalizing the Markdown parser choice. — **Not applied**
- [ ] Extract study persistence into an application workflow and split the growing React screen into reader, toolbar, and study-drawer components. — **Domain state transitions now have pure tested helpers; UI orchestration still lives in `App.tsx`**
- [ ] Verify the accessibility and Arabic/RTL design in desktop and mobile browsers. — **Not applied**

## Phase 3 — reader visual and interaction slice

- [x] Reuse the original locally bundled fonts without network font requests. — **Applied**
- [x] Port the original dark and light palettes and make the theme switch persistent. — **Applied; browser visual review remains**
- [x] Render each declared Markdown source page as a distinct page surface with its printed number. — **Applied; long/empty-page cases remain to verify**
- [x] Paginate unmarked Markdown into virtual reader pages and label citations as internal locations. — **Applied; long-paragraph behavior needs browser review**
- [x] Port decorated chapter/section heading treatments and Arabic chapter/page numerals. — **Applied; browser visual review remains**
- [x] Add page stepping, reader font-size controls, and a dynamic contents outline nested by heading level. — **Applied in iterations 2–3; nested/collapsible behavior is implemented; visual review remains**
- [x] Add Arabic-normalized passage search and editable book title/author metadata. — **Applied**
- [x] Replace note composition with passage copy, citation copy, and a user-approved local passage link. — **Applied; local link is a v2 convenience, not original parity**
- [x] Restore direct hover/tap passage actions and a separate selection toolbar without a preliminary click. — **Initial direct behavior in iteration 3; independent bars corrected in iteration 8; manual browser verification remains**
- [x] Add outline branch toggles, search, expand/collapse all, active-heading tracking, and current-location navigation. — **Applied in iteration 3; manual browser verification remains**
- [ ] Compare the separate right-side passage toolbar and floating selection toolbar, including their coexistence, against the original in desktop dark/light modes. — **Not applied; iteration 8 code needs user/browser QA**
- [ ] Verify hover/touch reveal, selected-range actions, copy/citation, external searches, and same-profile local links in the browser. — **Not applied for the corrected two-toolbar implementation; prior iteration 3 test does not verify this new behavior**
- [x] Verify outline: open/close each level, expand/collapse all, search paths, current-heading highlight, and jump-to-current. — **User tested iteration 3 and reported it is okay**
- [ ] Check touch behavior and narrow-screen layout; touch uses tap to reveal controls because it has no hover.
- [-] Citation-only copy action — no separate action was found in the original; excluded from the parity pass.
- [ ] Check selection toolbar, page breaks, footnotes, tables, images, and print layout visually against the original. — **Not applied**
- [ ] Verify local passage-link behavior after reload and verify the helpful message when the linked book is absent. — **Not applied**

## Phase 4 — complete the initial structured-reader release

- [x] Implement and test the Markdown import adapter with three-page Arabic fixtures. — **Applied**
- [x] Implement semantic HTML import into the same book/page/passage model. — **Iteration 5 implementation exists; browser fixture and representative-book tests remain**
- [x] Implement DOCX import into the same model with Word heading styles, explicit page breaks, structured lists/tables, embedded raster images, links, and separate footnotes. — **Iteration 6 implementation exists; run the DOCX fixture and representative books in a browser before calling it verified**
- [x] Preserve blank reader pages represented by consecutive explicit Word page breaks; do not infer blank pages from layout-derived breaks. — **Iteration 12; pagination tests cover leading/intermediate blanks, ordinary and terminal breaks, and retain the virtual-page heuristic. Real-DOCX visual verification remains.**
- [x] Place structured Markdown/HTML/DOCX footnotes with every page that contains their reference, number in first-reference order per page, and keep page-specific links/backlinks valid. — **Iteration 15; shared placement and DOCX link localization tests pass; Markdown importer tests pass; HTML/DOCX browser output remains unverified.**
- [x] Keep DOCX paragraphs/list items split by a page break as one logical passage; preserve fragment-aware selection/highlight offsets and cite the full reader-page range. — **Iteration 13; 7 pagination tests, 2 passage-fragment tests, and citation range tests pass. Validate actual DOCX hover/selection/footnote/copy behavior in the browser.**
- [x] Package selected local images for HTML and embedded images for DOCX while retaining their reading position. — **Code exists; HTML/DOCX visual fixture checks remain**
- [x] Package selected local raster assets referenced by Markdown-relative image paths and retain their in-book position. — **Iteration 14; importer tests pass; SVG and browser visual verification remain.**
- [x] Add in-book search across indexed passage text. — **Applied; search-result behavior needs browser testing**
- [ ] Test real Arabic books in Markdown, HTML, and DOCX; document unsupported structures instead of silently dropping them. — **Not applied**
- [ ] Import `test-fixtures/v2/research-book.html` together with `research-figure.svg`, and import `research-book.docx`; verify three pages, heading hierarchy, tables/lists, image position/alt, separate footnotes, and citation/page labels. — **Needs browser acceptance; this environment has no browser runtime**
- [ ] Run desktop/mobile accessibility and usability checks with students/researchers. — **Not applied**
- [ ] Pass the release acceptance checklist before calling the v2 reader ready. — **Not applied**

## Phase 5 — passage actions and study workspace (iterations 7–8)

- [x] Replace ambiguous passage-action glyphs with consistent, labelled SVG icons. — **Implemented; desktop/mobile visual review remains**
- [x] Add six-color selected-text highlights, with an eraser that preserves any un-erased part of a mark. — **Implemented and covered by domain tests; browser selection/rendering review remains**
- [x] Persist passage highlights, favorites, text comments, and collected quotations inside their book record in IndexedDB. — **Implemented; reload/migration behavior needs browser acceptance**
- [x] Serialize study writes and apply each update to the latest IndexedDB book record so quick successive edits do not overwrite each other. — **Iteration 17; build passes; concurrent UI behavior still needs browser acceptance**
- [x] Restore separate paragraph and selection toolbars, including direct hover/selection reveal and independent placement. — **Iteration 8; not yet browser-verified**
- [x] Replace the embedded mini-panel with a bottom-left study button and a left-side drawer containing collection, favorites, notebook, pins, links, and categories; statistics and settings remain in top-bar screens. — **Iterations 8 and 20; comments and quote notes share the notebook while retaining existing storage; other workflow gaps are listed below.**
- [x] Add passage comments through a modal over the book, plus favorites and quotation-collection panels. Comments are saved to the notebook; the separate add-to-notebook passage action was removed at user request. — **Iteration 41; browser interaction remains**
- [x] Save a selected passage to a quote-linked notebook and edit its note. — **Iteration 8 starter implementation; export and richer editing remain**
- [x] Create, rename, and delete custom highlight categories; assign one while highlighting; associate colors with categories and automatically classify new highlights by color. — **Iterations 8 and 17; category filtering, categorized browsing/export, and browser review remain**
- [x] Create/delete custom favorite tags, edit favorite labels/notes, filter by tag, sort by book position or date, copy favorites in bulk, and copy/add an individual favorite to the collection. — **Interaction implementation in iterations 8 and 16; Word export added in iteration 19; browser QA remains**
- [x] Pin a passage into a library-wide tray; create/name multi-book groups, add and remove members, and navigate linked passages. — **Iteration 22; separate IndexedDB link-workspace storage and domain tests are in place; browser/multi-book QA remains.** Existing quick-pin data stays readable.
- [-] Create new one-to-one same-book links — removed from the reader toolbar at the user's direction. Existing saved links remain visible/removable for compatibility.
- [x] Show study counts/current-page position and library-wide reading time, day totals, streaks, recent-day chart, per-book summaries, and per-chapter counts. — **Iterations 8 and 29; production build and 79 v2 unit tests pass; browser visual acceptance remains**
- [x] Copy the quotation collection with each item's citation; remove individual collection items; download collection as UTF-8 TXT. — **Iteration 8; browser file QA remains**
- [x] Edit a collected quote inline without changing its passage/footnote links; copy an individual item with citation and footnotes; clear the full collection after an in-app confirmation. Preserve original copy behavior by writing plain and RTL rich-text clipboard formats when available. — **Iteration 18; domain tests and build pass; browser interaction/clipboard review remains**
- [x] Reorder collection cards by drag-and-drop, with keyboard arrow-key support on the drag handle and no visible up/down buttons. — **Iteration 8; browser/touch QA remains**
- [x] Restore V1 in-app Turath search from selected reader text and individual collection entries, with exact/smart query modes, result snippets, pagination, and a site fallback. Restore selected-paragraph folding with saved-highlight summaries and automatic unfolding on navigation. — **Iteration 40; production build passes; Turath API availability and both workflows still need browser acceptance.**
- [ ] Verify selected-range highlighting for Arabic text and mixed inline formatting in a real browser; inspect page breaks and print output.
- [ ] Verify favorites, comments, highlights, and collection persist after reload and remain isolated between books.
- [ ] User-test toolbar density, icon meaning, comment placement, favorite navigation, and collection workflow.
- [ ] Verify categories/tags/favorite details persist and work correctly across reloads and books.
- [ ] Move study save/load orchestration out of `App.tsx`; retain pure domain functions for favorites, tags, categories, notebook, pins, links, and highlights.
- [ ] Implement freehand page marks and speech-to-text. Statistics/reporting are implemented in iteration 29; cross-book groups are implemented in iteration 22; split view remains a separate reader-mode gap.

## Phase 6 — complete the original-feature parity pass, then prune

- [x] Inspect each remaining original workflow/code area and map its behavior, states, and failure cases to `recreated.md` before implementation. — **Applied in iteration 9; see `docs/v2-rebuild/08-original-feature-audit.md`.** The audit distinguishes original behavior, v2 code, user-reported defects, and scope decisions.
- [x] Reconcile study-workspace semantics: combine comments/quote notes in the notebook (iteration 20), filter reader search by highlight category (iteration 21), and add the original cross-book link tray/groups (iteration 22). Keep the user's modal comment placement and do not restore stored voice comments. The older v2 quick-pin list remains visible for existing data.
- [x] Recreate original favorite interactions: assign multiple user-defined tags, filter by tag, sort by book position or newest addition, bulk-copy the visible filtered list with citations and notes, and jump/copy/add-to-collection/remove each item. — **Iteration 16; domain behavior tests and production build pass; visual/browser acceptance remains.**
- [x] Link each highlight color to at most one user category; automatically classify a new highlight when its color has a linked category; let an explicit category choice acquire an unused color; allow an explicit “no category” override; browse category-grouped marks and search them by Arabic text. — **Iteration 17; domain tests and production build pass; browser/toolbar acceptance remains.**
- [x] Filter in-book search to saved highlights in a chosen category or to uncategorized highlights; search matching excerpts and jump to their locations. — **Iteration 21; domain tests and production build pass; browser acceptance remains.**
- [x] Implement original per-book citation template, optional author, whole-passage footnote-copy preference, and quotation-collection separators. — **Applied in iteration 10; unit tests pass; browser/footnote fixture QA remains.**
- [x] Apply the per-book footnote setting to selected-text direct/citation copies and selected quotation collection entries; preserve reference markers when enabled and remove them when disabled, without appending note bodies to partial selections. — **Iteration 24 follows the original selection payload; build and 64 unit tests pass. Browser clipboard checks with Markdown, HTML, and DOCX fixtures remain.**
- [x] Match original page-range citations for DOCX paragraphs split across known page breaks. — **Iteration 13; domain and citation tests pass; browser validation remains.**
- [ ] Preserve source-page sequence for OCR/HTML inputs with skipped labels; define blank-versus-omitted-page handling from representative fixtures instead of inferring from number gaps. The existing `<!-- sr:page N -->` contract preserves explicit blank markers; actual OCR marker syntax remains unknown.
- [x] Recreate reading statistics and teacher report: reading time, streaks, per-book/across-library totals, chapter-level highlights/comments, optional report name, summary copy, and HTML export. — **Iteration 29; report structure and escaping tests, 79-test suite, and production build pass; browser download/visual acceptance remains.**
- [x] Implement collection/favorites/notebook/category Word exports with a shared structured RTL DOCX layout, contents, headings, citations, configured footnotes, and notes. — **Iteration 19; DOCX package tests and production build pass; browser/Word visual review remains.**
- [x] Export/import one book's study data as versioned JSON; provide merge/replace choices and ignore study entries that reference passages missing from the open book. — **Iteration 25; 3 focused backup tests pass; 73-test suite/build pass; browser download/import review remains. This does not package book text.**
- [x] Round-trip comments edited in the linked Word notebook format by stable passage/highlight bookmarks. — **Iteration 26; six focused bookmark-generation, paragraph-parsing, and data-application tests and the 73-test suite/build pass; browser/Word visual acceptance remains.**
- [x] Paste and edit formatted notes in notebook comments and quote notes; preserve sanitized HTML in study data/JSON backups and formatted clipboard output. — **Iteration 27; production build and 73-test suite pass; browser paste/clipboard and Word visual acceptance remain open.**
- [x] Preserve rich notebook comment/note formatting in structured Word exports, including supported emphasis, colors, highlights, lists, paragraph breaks, labels, and stable import bookmarks. — **Iteration 28; production build and 74-test suite pass; Word/browser visual acceptance remains open.**
- [x] Import plain TXT with the original page-label syntax, Markdown auto-detection, and separator-based numbered footnotes. — **Iteration 30; focused importer tests cover page labels, footnotes, literal markup, and Markdown detection; production build passes. Browser acceptance remains. Volume numbers cannot be represented in the current citation model and stay visible with a warning.**
- [x] Import EPUB spine documents and ODT text through the sanitized HTML/book contract; preserve in-archive images, internal EPUB links, lists, tables, and editable notes where supported. — **Iteration 31; shared ZIP-reader tests and production build pass. Browser import fixtures and edge cases remain unverified.**
- [x] Drop supported book files onto the empty library; accept one book with associated HTML/Markdown images or import several book files sequentially. — **Iteration 32; production build passes. Browser drag/drop and multi-file acceptance remain.**
- [x] Paste a new book from plain or rich clipboard content, with automatic detection plus explicit TXT, Markdown, and HTML import choices. — **Iteration 33; production build passes; clipboard permissions, paste dialog, and imported formatting need browser acceptance.**
- [x] Search across book title/author metadata, heading text, and passage text using Arabic normalization; jump from results to the matching book and location. — **Iteration 34; three focused domain tests cover normalized multi-book matches, all-term matching, metadata, and short-query handling; browser result/navigation acceptance remains.**
- [x] Add a separate library home with nested folders, book filing, global search, author/tag filters, and a horizontal keyboard-adjustable reader-sidebar splitter — **iteration 41; production build passes; browser persistence, layout, and navigation review remains.**
- [ ] Add per-book category colors and cover colors, with filtering.
- [ ] Recreate missing reader modes and keyboard behaviors: backward history, line/paragraph spacing/margins, fullscreen, fit, focus, auto-scroll, word cursor, fold, and shortcut help.
- [x] Recreate multi-book passage groups and the tray using a single-reader workflow that switches books on navigation — **Iteration 22; browser/multi-book QA remains.** Same-book link creation was removed by the user's review; old saved relations remain readable/removable. The original split/tabs remain open.
- [ ] Design and implement PDF.js as a separate reading mode: page navigation, outline, text-layer search, page favorites, zoom/fit/invert, and saved state. OCR stays a separate decision: the original app delegates conversion externally; choose prepared OCR import versus in-app OCR before selecting technology.
- [x] Implement cloud Arabic TTS comparison across Google Cloud, Azure, and OpenAI using a shared text sample, playback/download, latency display, and user ratings for pronunciation, naturalness, and pacing. The user must supply provider keys and listen/rate; cost and provider data policies remain account-specific.
- [ ] After the voice review, select a preferred service or keep multiple choices, then add reader-integrated sentence-following playback and restore the voice/speed/pitch/resume controls.
- [ ] Recreate remaining drawing/freehand and selected-range multi-paragraph workflows. Provide speech-to-text as the approved alternative to recording/storing audio comments.
- [ ] Apply the user's recorded UX changes separately from original parity: cream reading theme, non-blocking undo notices, stable save indicator, and focused tag interaction; implement only after comparing against the original behavior where it overlaps.
- [ ] For PDF, implement passage deep-navigation and transient passage emphasis when the text layer supports matching; keep image-only PDFs' behavior honest and limited to page navigation/favorites unless OCR is added.
- [ ] Revisit original storage/recovery features (dated snapshots, JSON backup/restore, Drive/folder linking, conflict resolution) only after their earlier deferral is reconciled with the broader parity direction.
- [ ] Compare original and v2 workflows feature-by-feature in a browser and record discrepancies before calling any feature a parity match.
- [ ] After parity review, ask the project decision group which reconstructed features to keep, simplify, or remove; update `recreated.md` with the explicit decision.

## Later tracks (outside the original prototype parity pass unless reopened)

- [ ] OCR fidelity: recognize the actual OCR page-marker syntax and preserve blank/short pages; standard Markdown/HTML/DOCX footnotes now follow their reference pages (iteration 15), but raw OCR footnotes not encoded as structured definitions still need a real source fixture and explicit parsing rules.
- [x] First implementation of the prototype's provider-backed AI panel and Claude Desktop MCP bridge, extended to Codex. The user reopened this track on 2026-10-16 and chose cloud inference with a configurable provider. The local companion exposes read-only MCP and in-app Q&A with book/library scope and linked retrieval sources. Keep credentials out of portable HTML; provider, MCP-client, and browser acceptance remain.
- [ ] Multi-book tabs/split view, export/backup/restore, and optional sync.
- [ ] Obsidian integration and external book connectors.
