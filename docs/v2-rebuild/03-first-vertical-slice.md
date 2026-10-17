# First v2 vertical slice — structured book reader and citation

**Status:** active implementation specification. The earlier linked-note workflow has been replaced by a reader-first scope at the user's direction. Notes and annotation authoring are later features.

## What “vertical slice” means here

A vertical slice is one small but complete user journey that crosses the real layers of the application—not just a mock-up or an isolated parser. For this project:

> Import a structured book → preserve its source pages and headings → read and navigate → select a passage → copy the passage, a citation, or a local link → reopen that link at the same passage.

Implement and verify that journey with Markdown first. Once it works end to end, add semantic HTML and DOCX as separate import adapters into the same reader model.

## Reader user story

As an Arabic reader or researcher, I can import a supported book, read it with familiar Arabic typography and page structure, move through the contents/pages, and copy a passage with a citation that identifies its book and page.

## Current release scope

- A local library of imported books.
- Markdown import first, then semantic HTML, then DOCX.
- Arabic RTL reading with headings, paragraphs, emphasis, links, lists, tables, images, footnotes, and declared source pages where supported by the format.
- Contents navigation and source-page stepping.
- Arabic-normalized search over indexed passages and editable book title/author metadata.
- Stable passage IDs and local book/passage links.
- Passage actions: copy selected passage text, copy text with book/page citation, and copy local link.
- Original prototype-inspired Amiri/Aref Ruqaa/Cairo fonts, page surface, heading decoration, Arabic numbering, and dark/light palette.

## Not in this slice

- Book notes or a Markdown note editor.
- Highlights, clips, tags, bookmark collections, or study board.
- Native PDF viewer, OCR, AI, Claude Desktop, TTS, Obsidian, sync, backup/restore, or multi-book tabs.

## Acceptance criteria

### Import and reading

- The three-page Arabic Markdown fixture imports as three distinct visible source pages.
- Each page has a visible Arabic page number derived from its source marker; page navigation targets that page.
- A Markdown file without page markers is divided into virtual reading pages; its citations say “internal reading position,” not “printed page.”
- Search with common Arabic alef forms and tashkeel differences finds the intended passage.
- Heading levels remain navigable in an RTL contents list and receive the selected reader decorations.
- Tables render as tables; images retain their location within the page; footnote definitions remain visually distinguishable from body text.
- Imported unsafe HTML is sanitized and external images are not loaded implicitly.
- Semantic HTML and DOCX adapters must pass equivalent relevant criteria before those formats are claimed as supported.

### Passage and citation

- Selecting a paragraph displays non-modal copy actions without taking the reader away from the page.
- “Copy text” copies only the passage.
- “Copy with citation” includes the passage and the actual book title plus source page; author/heading context may be included when known.
- If the source has no page markers, citations must not invent a printed page number.
- “Copy passage link” creates a local link that resolves to that passage after reload in the same library.
- Correcting title/author metadata updates citations without changing stable book/passage links.

### Reader usability and data

- The original local fonts load without network access.
- Dark and light modes preserve the same page/heading design and persist the user's choice.
- Reader font-size controls, page navigation, contents navigation, and copy actions are keyboard accessible.
- Imported books survive reload in the same browser profile. The UI does not claim that browser storage is a backup.
- Test the journey in a clean browser profile on desktop and mobile before calling this release ready.

## Test fixtures

Use the existing parallel three-page Arabic sources `research-book.md`, `research-book.html`, and `research-book.docx`. They should include matching title/author metadata, multiple heading levels, repeated passages, links, emphasis, lists, a Markdown table, at least two footnotes, Arabic and Western numerals, and an image reference where supported.

Do not use the old `research-note.md` as a first-slice acceptance requirement; note authoring is deferred.

## Implementation order and exit gate

1. Finish and test Markdown reading, page navigation, selection, citation copying, and deep links.
2. Add HTML import against the common model and verify it with the paired fixture plus one real Arabic source.
3. Add DOCX import against the same model and verify physical page breaks/available footnotes with its fixture plus one real source.
4. Verify local image packaging, reload/migration, mobile layout, accessibility, and citations.
5. Only then call the reader foundation ready. Keep native PDF/OCR and note-taking out of this release unless the project decision group changes scope.
