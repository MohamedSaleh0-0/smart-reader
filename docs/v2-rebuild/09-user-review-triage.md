# V2 review triage

This file tracks the user's structured review separately from feature parity. “Implemented” means the change is in the code; it does not mean the browser workflow has been visually accepted.

## Implemented from this review

- **Book aliases:** book metadata accepts alternate titles, stores them with the book, and includes them in library search. Acceptance: save multiple aliases, reload, and find the book by each alias regardless of letter case.
- **Dedicated library page:** a separate library home provides hierarchical folders, book filing, author and book-tag filters, whole-library text search, result navigation, and reading progress. The reader view keeps a current-book outline sidebar. Folders/books are stored locally in IndexedDB. Acceptance: reload with existing data, create/nest/rename/delete folders, move books, and confirm books remain available.
- **Resizable reader sidebar:** the divider now adjusts the sidebar width horizontally by pointer or keyboard and remembers the width. The incorrect outline-height slider was removed. Acceptance: drag the divider both directions, use arrow/Home/End keys, reload, and check long titles at desktop and mobile widths.
- **Library search results:** matching metadata, heading, and passage results render on the library page next to its search/filter controls. Acceptance: search aliases and body text, then open each result at the matching passage or heading.
- **Comment action:** removed “إضافة إلى الدفتر” from both passage toolbars. The comment action opens a modal over the book; saving adds or updates the comment in the notebook, and opening an existing comment from the notebook returns to this modal. Acceptance: add, edit, remove, and reopen comments on a passage and selected text without opening the study drawer.
- **Current-book search:** its control now has the visible label “بحث”. Acceptance: search distinctive body text, navigate to a result, and clear the query.
- **Study drawer contents:** library reading statistics remain in the top-bar statistics screen; the drawer no longer duplicates them. Book citation, footnote, separator, metadata, and study-backup settings are available from the top bar in “إعدادات الكتاب” while a book is open.
- **Passage controls:** removed plain selected-text copy while retaining citation copy; moved passage/selection toolbars above the study drawer; clarified the automatic-color and no-category choices.
- **Passage linking:** removed the new same-book one-to-one link action. Kept the cross-book multi-passage tray and gave its action a chain-link icon. Existing saved same-book links remain readable and removable for compatibility.
- **Study backlinks:** saved quotes, favorites, notebook comments/notes, and highlights now add compact marks beside their source passage. Each mark opens the related drawer section and emphasizes the passage's entry; notebook marks open the matching editor. Uncategorized highlights are listed in the categories section so their mark has a destination too.
- **Collection selection:** each saved quote can be selected. The collection offers select all, clear selection, copy selected, TXT, and Word actions; exports retain collection order and citations/footnotes.
- **Selected paragraph folding:** the selection toolbar can fold its source paragraph. Fold summaries keep saved highlight snippets visible, and jumping to that passage from study/search unfolds it again. Acceptance: fold a highlighted paragraph, reopen it from its summary and from the study list, and verify the saved highlight and source position remain intact.

## Confirmed V1 behavior and recommended semantics

- V1 exposed “تعليق سريع” and “إلى الدفتر” separately, but the user's current choice is to remove the separate “إضافة إلى الدفتر” action and keep “تعليق”. Comments are stored in the notebook and are created/edited in a modal over the book. V1 did **not** restyle the passage as a blockquote.
- Keep **الحافظة** and **المفضلة** as distinct concepts: the former is a working anthology for editing, ordering, bulk copy, and export; the latter is a retrieval list with tags and filters. Use clearer labels and selection actions to reduce the impression of duplicate storage.
- Keep highlight **تصنيفات** and favorite **وسوم** separate in meaning and storage. A highlight category describes an annotation and can be assigned by color; a favorite tag is a user-defined retrieval label that can be multi-assigned. They may share visual styling and management patterns without merging their behavior.
- Keep passage comments and existing notebook entries together in one notebook view; new passage comments open in the overlay modal without opening the drawer. Preserve historical entries and their source links.
- Retain an explicit way to remove a highlight. Choosing another highlight color changes its color; it does not erase the mark. The current eraser is therefore useful unless a direct “remove highlight” action replaces it.
- “تلقائي حسب اللون” assigns the category linked to the selected highlight color. “بلا تصنيف” explicitly leaves the new highlight uncategorized, even if that color has a linked category. The labels are clearer now; a short in-product explanation is still needed.

## Remaining work and acceptance criteria

### Library and reading navigation

- [ ] Browser-check the separate library/reader switch and its return-to-reading behavior.
- [ ] Browser-check folder create, nesting, rename, delete, book filing, and persistence across reloads; verify deleting a folder keeps its books and moves child folders up one level.
- [ ] Browser-check horizontal sidebar resizing with pointer and keyboard, saved width after reload, and wrapped chapter titles at desktop and mobile widths.
- [ ] Browser-check global search across titles, aliases, authors, headings, and passage text; verify filters, excerpts, and passage navigation.
- [ ] Browser-check current-book body search independently of outline search.
- [ ] Verify imported HTML pages, page labels, and outline generation using a representative real book.

### Passage actions and study links

- [ ] Browser-check bidirectional source marks for saved favorites, collection quotes, highlights/comments, and notebook entries. Each mark should open the matching study item; study items should jump back to the passage. Check multiple saved items on one passage and notes spanning a page break.
- [ ] Browser-check collection multi-select, including selecting a subset, select-all/clear-selection, output order, citations, and footnotes in copy, TXT, and Word.
- [ ] Reconcile collection/favorite and comment/notebook wording without discarding saved records.
- [ ] Keep one multi-passage linking workflow across books; verify its icon, selection, member navigation, and old relation compatibility.
- [ ] Browser-check comment modal placement, add/edit/remove persistence, selected-text quote context, and Enter/newline behavior. Ensure the modal sits above the book and never opens the study drawer.
- [ ] Verify toolbars reposition or become scrollable on small screens and when the study drawer is open.
- [ ] Browser-check selected-paragraph folding, including the folded highlight summary and automatic unfolding when navigating from a saved study item.
- [ ] Review the eraser control after a replacement removal action exists.

### Study drawer and global areas

- [ ] Add an easy switch between active-book study items and the global multi-book link workspace. The existing view is still mostly book-specific with cross-book links mixed into one tab.
- [ ] Confirm statistics and settings entry points work on desktop and mobile; check that book settings are unavailable until a book is open.

### Search integrations and future scope

- [x] Restore an in-app Turath search panel from both selected reader text and individual collection entries. It supports V1-style exact-phrase and smart-word modes, result snippets, pagination, and a fallback link to the Turath site. Acceptance still requires a browser check with representative Arabic queries, result navigation, pagination, and clipboard launch.
- [ ] OCR, online storage/backup, AI, and Islamic library/search integrations are future scope; define provider, privacy, offline, and import requirements before implementation.

### User clarification still needed later

- One review bullet ends with “the button that” and does not identify the button or desired change. It does not block the items above.
- The unified UI/UX criteria audit is deferred until the review items are settled. At that point, use a short set of criteria (discoverability, consistency, feedback, error recovery, accessibility, responsive behavior, and data safety) and score each workflow with browser evidence.

## Current verification boundary

The recent source changes have passed the V2 production build. No browser review has yet been done for the revised search placement, aliases, moved settings, toolbars, or mobile layout. Keep this distinction explicit when updating the feature ledger.
