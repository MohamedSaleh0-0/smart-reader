# Core workflows

These workflows define what must be reliable before adding more integrations. Each test should be recorded with the browser, device, fixture name, result, and notes.

The full suite below includes future formats and annotation/note scenarios. The current v2 first slice is narrower: import → read/navigate → copy passage, citation, or local passage link. Book-note authoring and annotation management are deferred; see [the active v2 plan](v2-rebuild/03-first-vertical-slice.md).

## Stage 0: test preparation

Create a small fixture set rather than testing with one unknown book:

- `sample.html`: Arabic headings, paragraphs, links, footnotes, and page markers.
- `sample.txt`: plain Arabic text with and without `[ص: ١٢]` markers.
- `sample.md`: `#`, `##`, lists, emphasis, links, and footnotes.
- `sample.docx`: heading styles, Arabic text, footnotes, and page breaks.
- `sample.epub`: metadata, table of contents, chapters, and RTL content.
- `sample.odt`: headings, paragraphs, and Arabic text.
- `sample-text.pdf`: selectable Arabic text, outline, and bookmarks.
- `sample-scanned.pdf`: image-only pages with no text layer.
- pasted sample: the same text entered through the paste workflow.

Use a clean browser profile for first-import tests and a second profile for restore tests.

## Stage 1: import acceptance tests

Run the following for every format:

1. Open Smart Reader with an empty library.
2. Import the file using the file picker.
3. Repeat using drag-and-drop when supported.
4. Review the detected title and author.
5. Confirm the preview or import confirmation is readable.
6. Confirm the book appears on the shelf.
7. Open the first, middle, and last available page.
8. Close the book and reopen it.
9. Reload the browser and reopen it again.
10. Delete the test book and confirm it disappears from the shelf.

Record one result for each format:

| Test ID | Input | Specific checks |
|---|---|---|
| IMP-HTML | HTML/XHTML | headings, links, footnotes, page markers, formatting |
| IMP-TXT | plain text | Arabic direction, paragraph splitting, page markers, long lines |
| IMP-MD | Markdown | heading hierarchy, emphasis, links, footnotes, lists |
| IMP-DOCX | Word document | heading styles, page breaks, footnotes, formatting |
| IMP-EPUB | EPUB | metadata, table of contents, chapter order, RTL content |
| IMP-ODT | OpenDocument | headings, paragraphs, Arabic text, malformed archive handling |
| IMP-PDF-TEXT | text PDF | open, page count, search, outline, bookmarks |
| IMP-PDF-SCAN | scanned PDF | open, scroll, page navigation, honest no-text-search message |
| IMP-PASTE | pasted text | title creation, formatting, page generation, save/reopen |

Acceptance criteria:

- Import errors explain what failed.
- A successful import does not produce an empty book.
- Arabic text is displayed in the correct direction.
- The book survives close and reload.
- Unsupported or malformed files fail safely.

## Stage 2: reading behavior

Run these checks on at least one HTML file, one DOCX/EPUB file, and both PDF fixtures:

1. Open the first page.
2. Navigate with the toolbar.
3. Navigate with keyboard controls on desktop.
4. Navigate by entering a page number.
5. Use the table of contents where available.
6. Change font size, line spacing, paragraph spacing, and margins.
7. Switch light/dark or reading themes.
8. Resize the window and test split-screen behavior.
9. Close and reopen the reader.
10. Confirm the last reading position behaves as documented.

For PDFs, separately record which study features work and which are viewer-only.

## Stage 3: search and study retrieval

Use the HTML, TXT, Markdown, DOCX, EPUB, and text-PDF fixtures:

1. Search an unmarked Arabic word.
2. Search a word with diacritics.
3. Search hamza variants and alternate Arabic letter forms.
4. Search from the library shelf.
5. Search inside the current book.
6. Enable root search and compare results.
7. Open a result with surrounding context.
8. Highlight a passage.
9. Add a normal note.
10. Add a formatted note or pasted comment.
11. Add a page bookmark or tag.
12. Leave the book and return later.
13. Locate the highlight and note again.
14. Copy the passage with its citation.

Acceptance criteria:

- Results lead to the intended passage.
- Search does not crash on empty, Arabic, or very long queries.
- Annotations are not silently lost.
- Citations identify the correct book and location.

## Stage 4: page identity and deep links

Use a book with printed page markers and a book with internally generated pages:

1. Copy a link to a normal page.
2. Copy a link to a page containing multiple fragments.
3. Open the link in the same tab.
4. Open it in a fresh tab.
5. Open it after closing and reopening the app.
6. Check the `p` page value.
7. Check the `o` ordinal value.
8. Compare the displayed page with the printed page in the source.
9. Test an invalid book ID.
10. Test an invalid page and ordinal.

Record separately whether the link identifies the correct text and whether the displayed number matches the source’s printed page. These are different problems.

## Stage 5: backup and recovery

1. Import one HTML book and one PDF.
2. Create highlights, notes, tags, and a bookmark.
3. Change a reader setting.
4. Export a backup.
5. Record the backup filename and format.
6. Create a second clean browser profile.
7. Import the backup there.
8. Confirm the books and study data are present.
9. Try an invalid or truncated backup.
10. Restore an older backup over newer data.
11. Confirm the conflict warning or merge behavior.
12. Test with storage blocked or unavailable where possible.

Acceptance criteria:

- The backup format is documented.
- Restore does not silently overwrite newer data.
- Invalid backups produce a clear error.
- Storage failures are visible and actionable.

## Stage 6: optional AI assistance

Run this only after the reader workflow works without AI:

1. Open a book with no API key.
2. Open the AI panel and confirm the setup message.
3. Select a passage and inspect the displayed context.
4. Configure one provider with a controlled test key.
5. Ask a question about the selected passage.
6. Check the cited page manually.
7. Ask a question without a selection.
8. Try an incorrect model name or provider error.
9. Cancel a streaming response.
10. Test whole-book scope.
11. Test whole-library scope with two books.
12. Confirm that attribution distinguishes the books.
13. Confirm the privacy warning explains what leaves the device.

Acceptance criteria:

- The reader remains useful without AI.
- Provider errors are actionable.
- Citations do not claim more precision than the indexed text supports.
- Selected text and book context are not sent unexpectedly.

## Stage 7: device and offline verification

Repeat the most important tests on each target:

| Environment | Import | Read | Study | Backup | Offline | AI |
|---|---:|---:|---:|---:|---:|---:|
| Desktop Chrome/Edge | Required | Required | Required | Required | Required | Required |
| Android Chrome/PWA | Required | Required | Required | Required | Required | Later |
| iPadOS Safari/PWA | Required | Required | Required | Required | Required | Later |
| Desktop Claude bridge | N/A | Required | Required | N/A | N/A | Required |

## Deferred from this verification cycle

- External book connectors.
- Obsidian plugin integration.
- Public book sharing and catalogue IDs.
- Optional online synchronization.

## Verification environments

The minimum matrix is:

| Environment | First book | Study/retrieval | Backup | AI |
|---|---:|---:|---:|---:|
| Desktop Chrome/Edge | Required | Required | Required | Required |
| Android Chrome/PWA | Required | Required | Required | Required later |
| iPadOS Safari/PWA | Required | Required | Required | Required later |
| Desktop Claude bridge | Not applicable | Required | Not applicable | Required |
