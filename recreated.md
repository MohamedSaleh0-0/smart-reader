# Recreated feature ledger

This is the working parity checklist for rebuilding the original reader in `v2/`. The target is broad behavioral parity: match what triggers each feature, what actions it offers, and what result/state it produces. A visual redesign is allowed only when it preserves that behavior or is an explicitly approved exception recorded in `plan.md`. An item without `[x]` is not silently rejected or forgotten. Update the iteration note whenever a feature is added or meaningfully changed.

`[x]` means an implementation exists in v2; it does **not** by itself mean visual parity, accessibility, device compatibility, or the complete workflow has been verified. `[ ]` means planned/not implemented yet. `[?]` means the feature needs a product-scope decision, including whether it belongs in the current version. `[-]` means explicitly deferred, ignored, or superseded; it is recorded so it is not mistaken for forgotten work.

## Iterations

- **Iteration 1 — reader foundation:** React/TypeScript/Vite shell; Markdown import; Arabic pages, headings, footnotes and search; local book storage; basic passage copy/citation actions; original bundled fonts and themes.
- **Iteration 2 — hierarchy and fidelity pass:** contents outline became a nested tree built from heading levels (including skipped levels); chapter headers and section ornaments were adjusted against the original reader CSS.
- **Iteration 3 — source-behavior correction:** passage tools now appear directly on hover/selection, with no preliminary click; the outline now collapses/expands branches, searches headings, expands/collapses all, tracks the current heading, and jumps to it. The two non-original sharing/citation extras are pending scope decisions. Automated tests/build and manual visual comparison are recorded separately below.
- **Iteration 4 — approved local convenience:** restore a local-only passage URL because the user chose to keep it. This is a v2 addition, not a claim of original parity; citation-only copy is excluded because it is not an original action.
- **Iteration 5 — first structured-format adapter:** add HTML import into the shared book model, retaining explicit source pages, headings, standard semantic blocks, linked footnotes, and selected local image files. Browser fixture QA remains before treating the adapter as verified.
- **Iteration 6 — DOCX adapter:** add Word import for styled headings, explicit page breaks, lists, tables, safe external links, embedded raster images, and separate footnotes. TypeScript/build checks pass; browser fixture and real-book validation remain.
- **Iteration 7 — initial study tools:** add passage highlights, favorites, comments, and a quotation collection. Its single merged toolbar and mini-panel were not faithful to the reference and are corrected in iteration 8.
- **Iteration 8 — reference interaction correction:** split the passage toolbar from the selected-text toolbar; add original-style independent positioning, a left-side study drawer/FAB, collection reorder/TXT export, favorites/tags, comments, notebook, pins, same-book passage links, user categories, and basic counts. TypeScript/build and 23 unit tests pass (Vitest required a workspace temp-directory workaround); mouse/touch and visual comparison in a real browser are still required. Several original sections remain incomplete.
- **Iteration 9 — original-source parity audit:** compare the embedded Arabic guide and reader-engine sections in the original `index.html` with v2. Correct the meanings of the original pin/link action and unified notebook; document the exact gaps and implementation order in [08-original-feature-audit.md](docs/v2-rebuild/08-original-feature-audit.md). No reader behavior changed in this audit.
- **Iteration 10 — citation preferences:** add the original default citation template and per-book settings for template, optional author, footnotes on whole-passage copies, and separators between collected quotations. Keep generated page positions explicitly labeled as internal. TypeScript/build and unit tests pass; browser interaction and representative footnote output still need review. Word numbering/export remain incomplete.
- **Iteration 11 — explicit blank-page regression:** add a Markdown importer test proving consecutive page markers preserve a blank numbered source page. No runtime code change was needed because the importer already retained this structure; browser verification remains open.
- **Iteration 12 — Word blank-page fidelity:** fix DOCX pagination so consecutive explicit page breaks preserve an empty page, without treating consecutive layout-derived hints as blank pages; retain virtual pagination when Word has no page metadata. Pagination rules are unit-tested; a real-DOCX browser pass remains open.
- **Iteration 13 — cross-page passage continuity:** keep DOCX paragraph/list fragments split by Word page breaks as one logical passage for actions, selection offsets, highlights, footnotes, and citations; record the ending reader page and format page ranges. Domain, citation, and pagination tests pass. Real DOCX/browser checks for selection, hover, footnotes, and copied output remain.
- **Iteration 14 — Markdown image packaging:** resolve selected local raster-image files against relative Markdown paths and embed them at their original positions in the imported page; report missing/ambiguous/unsupported assets and block implicit remote/data URLs. Importer tests cover page location and duplicate filenames. SVG packaging and browser visual checks remain open.
- **Iteration 15 — cross-format footnote/page fidelity:** compare all three structured importers with the original's `fnFix`/page-close behavior; place Markdown, semantic HTML, and DOCX footnotes on every page containing a reference, number them per page by first reference, and use page-specific targets/back-links. Preserve unreferenced Markdown/HTML definitions at their authored page. Shared placement logic is unit-tested; Markdown behavior has importer tests, while HTML/DOCX markup, OCR-specific unstructured footnote conventions, and browser display remain unverified.
- **Iteration 16 — original favorites workflow:** inspect the original embedded reader code and recreate tag assignment/filtering, position/date sorting, bulk copy of the visible favorites with citations and notes, and each favorite's jump/copy/add-to-collection/remove actions. New tags are created inline rather than through a browser prompt; individual favorite notes remain directly editable and save when the field loses focus. Study writes now serialize against the latest stored book record to avoid racing those edits. Domain tests and production build pass; browser interaction/visual review and DOCX export remain.
- **Iteration 17 — category/color behavior:** inspect the original highlight-category engine, then restore one-to-one color associations, automatic category assignment for new marks, manual category selection with automatic linking when a color is unused, and an explicit no-category choice. Recreate a searchable category browser with highlighted passages in book order and source locations. Keep the legacy v2 category display hue separate from the new `highlightColor` mapping so existing study data is not silently reinterpreted. Domain tests and production build pass; browser review, category filtering in the main reader search, and DOCX export remain.
- **Iteration 18 — quotation collection actions:** re-inspect the original collection handler and restore inline edit, individual copy with citation/footnotes in plain-text and rich-text clipboard formats, and confirmed clear-all; preserve source passage/footnote IDs when editing, and keep the existing drag/keyboard reorder and single-item removal. Add domain tests for immutable editing and collection-only clearing. Build and unit tests pass; real-browser clipboard/interaction review and Word export remain.
- **Iteration 19 — study Word exports:** inspect the original DOCX builder and export handlers; add formatted Word downloads for the collection, visible favorites, individual/all categorized highlights, and a combined study notebook containing comments, quote notes, favorites, categories, and collected quotations. Preserve citations, configured footnotes, favorite/category notes, book headings, Arabic RTL layout, contents, and Word numbering. DOCX-specific tests and production build pass; a broader Vitest run is blocked by sandbox temp-file errors in unrelated suites, and browser/Word visual review remains.
- **Iteration 20 — unified study notebook:** combine passage comments and quote-linked notebook notes in one drawer tab while keeping existing records in their current stores. Add date/book-order sorting, editing for either entry type, individual removal, bulk copy with citations/notes, and make the combined Word export follow the selected notebook order. Focused domain tests (15) and production build pass; browser interaction and Word visual review remain. Category filtering in main search and formatted paste are still open.
- **Iteration 21 — category-filtered reader search:** add a search filter for saved highlight categories and uncategorized highlights. With a filter selected, the search lists matching marked excerpts, can search their text/category name, and jumps to the mark in the book. Domain tests (16) and production build pass; browser interaction review remains.
- **Iteration 22 — cross-book link tray:** make the passage 📌 action add/remove positions in a library-wide tray, create and name groups from selected positions across books, add tray members to existing groups, rename/delete groups, remove members, and navigate through group links shown at each linked passage. Store the shared workspace in its own IndexedDB store; keep pre-existing v2 quick pins readable. Focused link/study tests (18 total) and production build pass; browser interaction and multi-book acceptance remain.
- **Iteration 23 — reciprocal same-book links:** render a navigation chip at both endpoints of each one-to-one passage link, and let either endpoint remove the shared relation after confirmation. Reject self-links and duplicate links in either direction. The focused link/study tests (19 total) and production build pass; browser acceptance remains.
- **Iteration 24 — selected-text footnote copying:** follow the original selection payload: retain footnote reference markers when the per-book setting is enabled, remove them when disabled, and do not append the footnote body to a selected-range copy. Apply this to direct copy, citation copy, and collected selected text. Production build and all 64 v2 unit tests pass; browser clipboard verification remains open.
- **Iteration 25 — per-book study JSON portability:** add a versioned JSON backup for one book's study data, validate imported files, offer in-app merge/replace choices, and discard entries linked to passages absent from the open book. Merge preserves both favorite tags, keeps the newer comment, and prevents duplicate/reverse passage links. Three focused backup tests and the production build pass; browser download/import review remains open. The file contains study data, not book text.
- **Iteration 26 — Word notebook comment round-trip:** bookmark editable notebook quotes in the DOCX export and import text written after `تعليق:` back into passage comments, highlight notes, or quote notes. Empty comment text removes the matching entry; missing passage references are ignored. Six focused tests and the production build pass; browser/Word round-trip review remains open.
- **Iteration 27 — formatted notebook paste:** add a rich-paste mode for passage comments and quote notes. Preserve supported bold, italic, underline, lists, links, and safe colors alongside plain text; sanitize pasted/saved HTML, retain it in JSON backups, and include it when copying the notebook. Word import clears stale formatting when edited text changes. Production build and all 73 v2 unit tests pass; browser paste/clipboard and Word visual review remain open.
- **Iteration 28 — rich notebook Word export:** carry sanitized note markup into DOCX as formatted RTL Word runs and separate paragraphs, preserving emphasis, colors, highlighting, and list bullets alongside the `تعليق:` label and import bookmarks. The production build and all 74 v2 tests pass; real Word/browser visual review remains open.
- **Iteration 29 — reading statistics and teacher report:** record visible, recently active reading time by local day/device; show library totals, today/week, active days, current/best streaks, a 14-day chart, per-book reading/highlight/comment summaries, and per-chapter counts. Add copyable summaries, optional saved student name, and a downloadable HTML teacher report with escaped user content. The build and all 79 v2 unit tests pass; report download and browser visual acceptance remain open.
- **Iteration 30 — TXT import and lazy format loading:** TXT import now recognizes the original Arabic page-label forms, links numbered footnotes after separator lines, and treats files with multiple Markdown headings as Markdown. Volume labels remain visible with a warning because the current citation model has no volume field. Markdown, HTML, DOCX, Word-edit, and structured Word-export code load on demand; the initial production JavaScript chunk is 354.16 kB minified (104.61 kB gzip), below Vite's 500 kB advisory threshold. Automated verification and browser import acceptance are tracked in `plan.md`.
- **Iteration 31 — EPUB and ODT import:** EPUB spine content follows package reading order and remaps internal links; supported in-archive images are embedded locally. ODT maps headings, paragraphs, formatting, lists, tables, images, and notes into the sanitized HTML importer. Both use a shared bounded ZIP reader extracted from the DOCX adapter. The build and 87 v2 unit tests pass; end-to-end EPUB/ODT import and browser acceptance remain open.
- **Iteration 32 — library drag/drop:** when the library has no open book, dropping supported files shows a clear target and imports a single book with associated HTML/Markdown images or several book files in sequence. The build passes; browser drag/drop and multi-file acceptance remain open.
- **Iteration 33 — paste as a new book:** read plain text and rich HTML from the clipboard when allowed, fall back to a paste dialog, and let the user choose automatic detection, TXT, Markdown, or HTML import. The production build passes; clipboard permissions, pasted formatting, and browser workflow remain to be checked.
- **Iteration 34 — library-wide search:** search book title/author, headings, and passages with Arabic normalization, group matches by book, and jump to the matching heading or passage. Three focused domain tests and the 90-test suite/build pass; browser result/navigation acceptance remains open.
- **Iteration 35 — approximate Arabic root search:** add a remembered opt-in mode for reader headings, passages, and categorized highlights using light affix/stem heuristics. The production build passes; false positives are possible and browser acceptance remains open.
- **Iteration 36 — library shelf sorting:** restore sort by last read, date added, or title and remember the choice locally. New reading activity saves a last-read timestamp; older records use the latest day with recorded reading time. The production build passes; browser acceptance remains open.
- **Iteration 37 — saved reading progress:** persist the last reader page per book, restore it when opening or switching books, and show a percentage in the shelf. The production build passes; position restoration, cross-book behavior, and shelf display still need browser acceptance.
- **Iteration 38 — requirements-led book-level shelf tags:** create and assign user-defined tags per book, display assigned tags, and filter the shelf by tag. These remain separate from favorite/passage-study tags. The production build passes; persistence and interaction need browser acceptance.
- **Iteration 41 — user-review correction for library and comment flows:** replace the book-list/outline hybrid with a dedicated library home and a reader sidebar focused on the current book's outline. Add locally persisted nested folders, book filing, folder rename/delete with books retained, author/tag filters, and whole-library search across metadata, headings, and passages. Replace the incorrect outline-height slider from iteration 40 with a persistent horizontal sidebar splitter that also supports keyboard resizing. Remove the separate “add to notebook” passage actions; comments open in a modal over the book and are saved in the notebook. The production build passes; browser persistence, modal, splitter, and responsive acceptance remain.
- **Iteration 42 — portable single-file edition:** add a reproducible build that embeds the application, styles, bundled fonts, and demonstration book in one HTML file. The demo image is embedded too; each recipient still has a separate browser-local library. The production web build and portable HTML build pass; opening the file directly and browser storage behavior still need browser acceptance.

## Reference-first recreation method

The earlier process was not being enforced tightly enough: the nested outline shipped without the original's collapse/expand controls, and a click-to-open action panel replaced the original's direct hover interaction. The correction is a per-feature gate:

1. Inspect the original UI and its code for the exact feature, including its states and interaction (mouse, touch, keyboard, navigation, and failure cases when applicable). Record what is observed; do not infer behavior from a feature name.
2. Assign a scope marker. Do not start a `[?]` item until its scope is decided. A `[-]` item stays deferred unless the product decision changes.
3. Write the user-visible behavior and acceptance checks before implementation, including imported-content fixtures for format-sensitive behavior.
4. Implement the smallest change that matches the reference or is demonstrably better without removing a reference behavior. Preserve unrelated work.
5. Verify domain rules with tests, file formats with fixtures, and interactions/styles in a real browser against the original. If browser comparison was not possible, say so instead of treating a build as parity proof.
6. Update this ledger with the iteration, evidence, and any remaining manual checks. Keep implementation status separate from verification status.

## Feature checklist

### App, library, and importing

- [?] Installable/offline app behavior and deployment/update flow — the obsolete duplicate `SmartReader-PWA/` folder is not the same thing as deciding whether v2 should be installable.
- [x] Import HTML books with semantic headings, lists, tables, links, explicit source-page containers, and separate linked footnotes — **iterations 5 and 15; note placement follows reference pages with page-local targets/numbers; fixture/browser QA remains**. Local images can be selected with the HTML file and are embedded; remote images are blocked and warned about. Original CSS styling is intentionally not imported.
- [x] Import DOCX with heading styles, tables/lists, explicit page breaks, embedded raster images, links, and separate footnotes — **iterations 6 and 15; note placement follows every reference page with page-local targets/numbers; browser fixture and representative-book QA remain; page labels are internal unless the source provides explicit printed numbers**.
- [x] Import Markdown books with headings, paragraphs, lists, emphasis, links, tables, images, footnotes, and explicit `<!-- sr:page N -->` markers — **iterations 1, 14, and 15; selected local raster images are packaged, and standard Markdown footnotes follow their reference pages with page-local numbering. SVG remains unsupported; OCR-specific marker conventions and browser visual checks remain.**
- [x] Import plain-text books and recognize page markers/headings — **iteration 30; page variants, Markdown detection, and separator-based notes have focused tests; browser acceptance remains.**
- [x] Import EPUB books with metadata, spine reading order, outline headings, RTL text, internal links, supported images, and linked notes — **iteration 31; build passes; end-to-end import fixture and browser acceptance remain.**
- [x] Import ODT books with headings, styled text, lists, tables, supported images, and linked notes — **iteration 31; build passes; end-to-end import fixture and browser acceptance remain.**
- [x] Paste text or formatted rich text as a new book; allow automatic, plain-text, Markdown, and HTML format choices — **iteration 33; build passes; clipboard and browser acceptance remain.**
- [x] Drag and drop supported books into the empty library; allow several books in one drop — **iteration 32; production build passes; browser drop and multi-file acceptance remain.**
- [x] Add the three-page Arabic demonstration book — **iteration 1**.
- [x] Correct imported book title and author metadata for future citations — **iteration 1**.
- [x] Keep explicit source-page labels distinct from generated internal reader positions — **iteration 1** for Markdown.
- [x] Preserve explicitly represented blank source pages — **iteration 11 for Markdown page markers; iteration 12 for consecutive explicit DOCX page breaks. Tests distinguish these from omitted numeric labels and unreliable layout-derived breaks.**
- [x] Place structured Markdown/HTML/DOCX footnotes with every page that contains their reference; number notes in first-reference order per page and keep each page's link/backlink targets unique — **iteration 15; shared placement and DOCX link rewriting are unit-tested, Markdown has importer tests, and HTML/DOCX browser output still needs review.**
- [x] Preserve one logical DOCX passage across explicit/layout page breaks, retain its ending reader page, and cite the full page range — **iteration 13; domain, citation, and page-group tests pass. Browser validation remains. Do not infer blank pages from numeric gaps because sources may intentionally omit pages.**
- [x] Preserve HTML-selected and DOCX-embedded raster images at their imported position, retaining available alt text/caption — **iterations 5–6 implementation; visual QA remains**.
- [x] Package selected local raster assets referenced by relative Markdown image paths. — **Iteration 14; importer tests cover the source page, image data URL, missing files, unsupported SVG, and same-basename disambiguation. Browser rendering remains to verify.**
- [x] Store books in browser IndexedDB without uploading their text to a server — **iteration 1**; this is not a guaranteed backup.

### Library organization and discovery

- [x] Library page with book cards, authors, reading-state summaries, global search, and author/tag filters — **iteration 41; production build passes; browser acceptance remains.**
- [x] Create and nest folders, rename/delete folders while retaining their books, and move books between folders — **iteration 41; IndexedDB version 6 adds folders without replacing existing books; browser persistence acceptance remains.**
- [x] Create and assign user-defined tags per book, show them on shelf cards, and filter the shelf by tag — **iteration 38; production build passes; browser persistence and interaction checks remain.**
- [ ] Per-book categories and cover colors, with filtering.
- [x] Sort by last read, newest added, and title; remember the selected order — **iteration 36; build passes; old records use day-level reading activity; browser review remains.**
- [x] Search across the whole library and open a result at its location — **iteration 34; browser search/navigation acceptance remains.**
- [ ] Optional Arabic root/stem search across the library.
- [x] Link out to the Sunnah/hadith search site from selected text — **iteration 8 implementation; external navigation needs browser QA**.

### Reading, pages, outline, and search

- [x] Use the original bundled Amiri, Aref Ruqaa, and Cairo fonts — **iteration 1**.
- [x] Render imported Markdown as distinct page surfaces and show source-page or clearly labeled internal-page positions — **iteration 1**; visual edge cases remain to verify.
- [x] Decorate chapter headings with Arabic numbering, a title badge, and a running line; use the original reader's section-heading ornament — **iterations 1–2**; exact screenshot match remains unverified.
- [x] Provide persistent dark and light reading themes — **iteration 1**.
- [x] Adjust reading font size — **iteration 1**.
- [ ] Adjust line spacing, paragraph spacing, and page margins independently.
- [x] Build a **hierarchical dynamic outline** from heading levels, preserving order and nesting subsections under their nearest preceding parent — **iteration 2**; covered by unit tests.
- [x] Collapse/expand each outline branch; show nested children only while expanded — **iteration 3**; automated interaction/visual QA remains.
- [x] Search outline headings while preserving the matching heading's ancestor path — **iteration 3**; Arabic matching uses the existing normalization helper.
- [x] Expand all, collapse all, highlight the current heading while reading, and jump to the current location — **iteration 3**; manual comparison against the original remains.
- [x] Resize the current-book sidebar horizontally with pointer or keyboard and remember its width; long outline titles wrap. — **iteration 41 replaces the incorrect outline-height control from iteration 40; browser desktop/mobile acceptance remains.**
- [x] Navigate to headings and move between reader pages — **iteration 1**.
- [x] Save and restore the last reader page per book; show its percentage in the shelf — **iteration 37; production build passes; browser persistence and visual checks remain.**
- [ ] Navigate backward through reading history.
- [x] Search headings and passages inside the open book, with Arabic letter/diacritic normalization — **iteration 1**.
- [x] Search title/author metadata, headings, and passage text across the library; jump from results to the matching book location — **iteration 34; focused domain tests and build pass; browser search/navigation acceptance remains.**
- [x] Search by approximate Arabic roots in the open book, with an opt-in remembered toggle and categorized-highlight matching — **iteration 35; production build passes; stemming is heuristic and needs browser acceptance.**
- [x] Search a selected phrase in the current book, with links to external heritage-book and hadith search — **iteration 8 implementation; external-result behavior remains to verify**.
- [ ] Add keyboard shortcuts and a shortcut guide.
- [ ] Add fullscreen, page-fit, focus/spotlight, auto-scroll, and word-cursor modes. Paragraph folding was restored in iteration 40.
- [?] Split-screen reading and opening another book beside the current one — a requested improvement, not part of the confirmed original-feature parity pass; decide after that pass.
- [ ] Text-to-speech with current-sentence highlighting and voice/speed/pitch controls — reopened as a parity backlog item by the user's latest direction to recreate the original first, then prune; recreate and evaluate before release.

### Passage actions, study tools, and links

- [x] Reveal whole-passage actions directly on hover/tap, and separate selected-text actions directly after selection — no preliminary click — **iteration 3 and corrected in iteration 8**; the two bars can coexist in code, but mouse/touch behavior still needs visual QA.
- [x] Restore V1's in-app Turath search from selected reader text and individual collection entries; restore folding for the selected source paragraph while keeping saved highlight excerpts visible and reopening it when navigating back. — **Iteration 40; production build passes; API/browser behavior remains to be accepted.**
- [x] Recreate the original study-workspace structure and behavior — **iterations 20–22** combine comment/note editing, sorting and bulk copy in the notebook; add category-filtered reader search and a cross-book link tray/groups. Legacy quick-pin records remain in a separate tab for existing data; visual/browser acceptance remains. See the source audit for remaining behavior gaps.
- [x] Copy selected text with a bibliographic/page citation — plain selected-text copy was removed from the toolbar per the user's review; keep native Ctrl+C for ordinary copying.
- [-] Copy citation details alone — no separate action was found in the original toolbar/guide, and it is not needed for the current reference-parity pass.
- [x] Copy a local link to a passage — **iteration 4; user-approved v2 convenience, not found as an original toolbar action.** It contains this library's book/passage IDs and resolves only if that book is stored in the same app/browser profile. It is not public sharing or a stable global ID.
- [x] Configure the original citation template, optional author, footnote-copy preference for whole-passage actions, and collection separators — **iteration 10; preferences are per-book and browser/footnote fixture QA remains**.
- [ ] Support reliable passage links after re-import or content edits.
- [x] Six-color highlighting of selected text; replacing/erasing part of a mark preserves the unaffected text — **iteration 7/8**; applying a color to a hovered whole paragraph is not offered.
- [x] Save a text comment on a passage or selected excerpt from a modal over the book; comments remain listed in the notebook. The separate “add to notebook” passage action was removed at the user's request — **iteration 41; browser save/edit acceptance remains.** Speech-to-text remains incomplete.
- [x] Click a saved highlight to reopen its selection toolbar for further action — **iteration 8 implementation; browser QA remains**.
- [x] User-managed highlight categories — **iterations 8/17/19/21:** create, rename, delete, assign, and associate each category with a highlight color; new highlights auto-inherit the matching category. Category groups and Arabic text search in both the categories pane and reader search are implemented, with individual/all Word exports; browser/Word visual review remains.
- [x] Associate highlight colors with categories and automatically assign the matching category to new highlights; allow manual selection and explicit no-category override — **iteration 17; domain tests pass; browser review remains.**
- [x] Add/remove passage favorites and navigate them in a favorites panel — **iteration 7; browser QA remains**.
- [x] Recreate original favorite management — **iteration 16:** multiple user-defined tags per favorite, filtering by one tag, sort by book position or newest addition, bulk copy of the visible filtered set with citations and notes, and per-item jump/copy/add-to-collection/remove. Domain tests and production build pass; browser review remains.
- [x] Export visible favorites to Word with citations, labels, tags, and notes. — **Iteration 19; DOCX package tests and build pass; browser/Word visual review remains.**
- [-] Separate named favorite lists — the original has one favorites collection with multi-tag assignment and tag filtering; reproducing that model does not require named lists.
- [ ] Pen/freehand drawing and colored text boxes on a page.
- [?] Keep v2's standalone quick-return pins? — **Not an original feature match.** Iteration 22 gives the 📌 passage action the original cross-book tray behavior; pre-existing quick-pin records remain readable in a separate tab. Revisit removal only during the planned feature-pruning review.
- [x] Recreate the cross-book passage-link workflow — **Iteration 22:** use the persistent multi-passage tray and named groups across books. Per the user's review, do not create new same-book one-to-one links; existing saved relations remain readable/removable for compatibility. Split view is still absent; browser acceptance remains.
- [x] Add/remove and edit quotations in the passage collection; select multiple or all, then copy or export the chosen items with citations/footnotes and clear the collection after confirmation — **iterations 7, 18, and 39; rich output is implemented, browser review remains**.
- [x] Reorder collected quotations by dragging; do not add up/down arrow controls (user explicitly rejected those) — **iteration 8; keyboard arrow-key reordering is also available on the drag handle, with no arrow buttons**.
- [x] Download the quotation collection as UTF-8 TXT with citations — **iteration 8 implementation; file-content/browser QA remains**.
- [x] Export the quotation collection as a structured DOCX like the original. — **Iteration 19; package includes citations, notes/footnotes, contents, headings, and numbered quotes; browser/Word visual review remains.**
- [x] Recreate the original unified notebook — **Iteration 20:** passage comments and quote-linked notes share one editable/sortable list, support bulk citation copy, and export in the selected order. Iteration 26 adds bookmark-based Word comment round-trip; iteration 27 adds sanitized formatted paste and persistence. Browser paste/clipboard and Word visual acceptance remain. Non-modal comment placement is an intentional requested UI change.
- [x] Add source marks for saved clips, favorites, notebook notes/comments, and highlights; clicking opens the related drawer section and selects the passage's study entry. Unassigned highlights are listed under categories. Browser and keyboard review remains; see [review triage](docs/v2-rebuild/09-user-review-triage.md).
- [-] Standalone Markdown research-note editor — explicitly out of the reader-recreation scope; the user asked to keep this a reader and did not approve a separate note-authoring product.
- [-] Record and store audio comments — explicitly removed; retain speech-to-text transcription as the intended alternative.
- [ ] Speech-to-text transcription for comments — requested instead of recording/storing audio; not implemented yet.
- [x] Use consistent, accessible SVG icons for passage actions instead of emoji or ambiguous punctuation glyphs — **iteration 7**.

### PDF reading mode

- [ ] Separate native PDF mode, kept distinct from converted structured-book reading — original-feature parity backlog; not part of iteration 8.
- [ ] For text/OCR PDFs: read pages, use embedded outline, search recognized text, navigate pages, and favorite pages.
- [ ] For image-only/scanned PDFs: read pages and favorite pages; OCR is a separate follow-up capability.
- [ ] PDF zoom, fit-to-width/page, continuous scrolling, and optional dark/inverted page view from the original.
- [ ] Preserve PDF position and page favorites after reload.
- [ ] Convert/OCR PDF into a structured book while preserving original page boundaries and keeping footnotes with their source page.

The original app has a PDF.js viewer but no first-party OCR engine in its inspected code; it directs users to an external “الكتب المصوّرة” conversion workflow and then to import the resulting HTML. Decide separately whether v2 should accept prepared OCR output only or add in-app OCR.

### Requested UX changes beyond the original

These are product changes from the user's hands-on test notes, not claims about original parity. Keep them visible so “copy the original first” does not erase the improvements the user explicitly asked for.

- [ ] Add a warm cream/low-glare reading surface in addition to the original dark/light themes.
- [ ] Replace blocking browser notices/prompts with calm in-app feedback; for reversible deletions, offer a five-second undo where safe.
- [ ] Stop the saved/synchronization indicator from flickering during ordinary scrolling; only reflect real save-state transitions.
- [x] Open passage comments in a modal over the book and save them to the notebook — **iteration 41; browser visual/save/edit QA remains.**
- [ ] Add a focused passage-tagging interaction, then verify tags can be created, renamed, removed, and applied without disrupting reading.
- [ ] In PDF mode, navigation to a passage should open the right PDF page and visibly mark the target passage when the PDF text layer permits it.
- [?] Decide whether to support PDF++-style handoff of a selected quote plus its citation/context to another note. The reader has internal collection/comments; this request may mean an external Markdown/Obsidian destination, whose first-release scope and target are not yet decided.
- [x] Use consistent SVG icons instead of emoji in the recreated study tools — **iteration 7/8**.
- [-] Do not restore the original outline's pin control; the user said it has no useful meaning there.
- [-] Do not add up/down arrow buttons to reorder the quotation collection; the user explicitly rejected them.

### Export, backups, and data safety

- [x] Export selected passages/collection, visible favorites, comments/notebook, and categorized highlights to formatted Word with headings, contents, citations, and configured footnotes. — **Iteration 19; browser/Word visual review remains.**
- [x] Add the original citation settings: citation template and optional author, footnote-copy behavior for whole passages, collection separators, and Word quote numbering — **iterations 10 and 19; selected-text footnote handling and visual review remain.**
- [x] Recreate collection-item edit, individual citation copy, and clear-all — **iteration 18; automated tests/build pass; browser verification remains**.
- [x] Combine passage comments and quote-linked notes in one notebook list/editor; sort by creation or book order, bulk-copy with citations/notes, and apply the selected order to Word export. — **Iteration 20; focused domain tests and production build pass; browser/Word visual review remains.**
- [x] Recreate formatted paste for notebook comments and quote notes; preserve sanitized rich markup in local study data and JSON backup, and use it in notebook clipboard and Word output. — **Iterations 27–28; build and 74-test suite pass; browser paste/clipboard and Word review remain.**
- [x] Round-trip edited comments through the linked Word notebook format with stable bookmarks. — **Iteration 26; imported Word text clears stale rich formatting when the text changes; browser/Word round-trip remains open.** Stored audio remains explicitly out of scope.
- [x] Export/import one book's study data as versioned JSON with merge/replace choices and passage-reference validation. — **Iteration 25; 3 focused backup tests pass; browser download/import review remains. Does not package book text.**
- [?] One-file library backup and restore, including supported metadata and study data — explicitly deferred earlier, but reconcile that decision with the newer recreate-first direction.
- [?] Dated snapshots, automatic backup destination, restore previews, and recovery before risky operations — previously deferred with backup/restore; revisit at the same scope checkpoint.
- [?] Cross-device Drive/folder linking and synchronization, with explicit conflict detection and merge/choose-local/choose-other actions — previously deferred; requires a deliberate storage, privacy, and conflict-resolution design before implementation.
- [ ] Clear, non-flickering save/sync status and accurate storage-failure/quota messaging.
- [ ] Explain that browser storage can be cleared or evicted and is not a backup.

### Statistics, onboarding, and help

- [x] Reading time, streaks, library totals, per-book statistics, and highlights/comments per chapter. — **Iteration 29; tests/build pass; browser visual acceptance remains.**
- [x] Copyable reading summary and downloadable teacher report with an optional student name. — **Iteration 29; report escaping/structure tests pass; browser download/visual acceptance remains.**
- [ ] First-use guide book documenting implemented features.
- [ ] Guided tours for library, structured-book reader, and PDF reader.
- [ ] Help/shortcut reference and clear unsupported-format/error explanations.

The detailed source-to-v2 mapping, behavior corrections, known user-reported defects, and recommended order are recorded in [docs/v2-rebuild/08-original-feature-audit.md](docs/v2-rebuild/08-original-feature-audit.md).

### AI and external integrations

The original prototype had a provider-backed AI question panel and an opt-in Claude Desktop MCP bridge (`sr-mcp.js` and `.mcpb`). These were deferred in v2 until its canonical book and citation model stabilized. On 2026-10-16, the user reopened the work, chose cloud inference with a configurable provider, and approved an optional local companion. Keep the reader usable without that helper and do not bake provider credentials into the portable HTML.

- [x] Evaluation harness — compare Google Cloud TTS, Azure Speech, and OpenAI voices against the same Arabic excerpt. Score pronunciation, naturalness, pacing, and request latency; costs and provider data handling remain account-specific. Actual listening/rating still needs the user's provider keys and review.
- [ ] Phase 1 — adapt the existing local companion and read-only MCP server for v2, then support Claude Desktop and Codex. Let the reader opt in to sharing the active book or selected library scope; support current-book metadata, Arabic search, passage/page retrieval, selected text, and exact passage links. Expose no write tools in this phase. A first implementation now exists in `v2/companion`; packaging and client/browser acceptance remain.
- [ ] Phase 2 — in-app cloud AI panel using the same retrieval/citation layer. Support a selectable provider, one-book and library scope, source-linked answers, clear privacy/cost limits, and useful network/provider errors. Require confirmation before saving generated content. A first implementation now exists for Gemini, OpenAI, Claude API, OpenRouter, and Groq; provider/account and browser acceptance remain.
- [ ] After the voice comparison — add reader-integrated provider-backed TTS playback with sentence following, voice, speed, pitch, resume, and clear network failure behavior. The current comparator generates and plays downloadable samples only. Keep browser speech as an optional fallback, not the assumed quality baseline.
- [ ] Copy a question with relevant selected text, surrounding context, and page references for use outside the app; preserve this as an alternate flow beside in-app Q&A.
- [-] Obsidian companion/plugin — explicitly deferred to a later integration.
- [-] External book-library connectors — explicitly deferred; not a first-release target.

## Architecture chosen for v2

The target is a **layered modular monolith**, not microservices. It stays a static browser app with no required backend.

```text
React UI (library, hierarchical outline, reader, passage actions)
                    ↓ user actions / rendered domain data
Application workflows (import, navigate, search, copy/cite, save)
          ↓                         ↓
Domain model and rules       Adapter ports
(books, pages, headings,     (file import, storage,
 passages, footnotes,         clipboard, URL/navigation)
 citations, outline)              ↓
                         Browser adapters
                    (Markdown/HTML/DOCX/PDF,
                       IndexedDB, browser APIs)
```

Rules: import formats translate into one canonical book/page/passage model; the UI does not parse files or write IndexedDB directly; citation/search/outline rules stay outside React; all rendered imported content is sanitized; each adapter has fixture-based tests. React + TypeScript + Vite is the selected UI/build stack. The Markdown pipeline currently uses unified/remark.

**Implementation reality:** v2 already has the domain types, citation/search/outline modules, a Markdown importer, an IndexedDB repository, and the React reader. The UI currently calls the importer and repository directly, so the application-workflow layer in the diagram is a target boundary to extract as HTML/DOCX/PDF and study features grow—not a claim that every layer is already complete. HTML and DOCX must map into the same model and preserve page/footnote structure before being marked done.

## Verification rule

For every `[x]`, record the iteration and relevant automated test/fixture. Do not call it verified until the real user workflow is exercised. Visual parity, mobile/desktop behavior, import fidelity, storage migration, and backup/restore need their own checks; a successful TypeScript build is not feature verification. For every `[?]`, record the decision and rationale before building it. For every `[-]`, retain the deferral reason so future contributors know it was deliberate.
