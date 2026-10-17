# Phase 1 — v2 product brief

**Status:** current direction for the first v2 release; implementation is underway. This revises the earlier note-taking proposal. Final public-release approval still belongs to the project decision group.

## Product promise

Smart Reader is an Arabic-first reader for books and research materials. It preserves useful document structure, makes passages easier to find again, and helps readers copy text with an honest citation to its book and page.

The primary audience includes students and scholars in Islamic studies—طلاب العلم وعلماء الشريعة—without excluding other readers, students, or researchers.

## Core reader journey

1. Import a supported structured book into a local library.
2. Read it in comfortable Arabic typography with its pages, headings, contents, tables, images, and footnotes represented as faithfully as the source allows.
3. Navigate by page or contents and locate a passage.
4. Copy the passage alone, copy it with a book/page citation, or copy a local link back to that passage.
5. Reopen the book and resolve that local link in the same library.

## Product and design principles

- **Readable before feature-rich:** the reading surface is the product's center, not a dashboard beside the book.
- **Fidelity before automation:** preserve page boundaries, blank pages, and footnote relationships before adding clever extraction.
- **Arabic and RTL first:** typography, headings, numbering, selection, and page layout are core requirements.
- **Traceable citations:** every citation names the actual book and a meaningful page; the user can correct book metadata.
- **Honest pagination:** declared source pages may be cited as pages; automatically generated reading pages must be identified as internal positions.
- **Honest capability boundaries:** explain what a format preserves and what it cannot provide.
- **Local-first for the initial reader:** imported books remain in browser storage; this is not yet a backup system.
- **Progressive enhancement:** PDF/OCR, AI, cloud sync, and desktop bridges are optional later tracks, not prerequisites.
- **Visual continuity where the prototype succeeded:** carry forward its local Arabic fonts, reader palette, page surface, decorated headings, and pagination; reorganize tools only when that improves reading.

## Current release scope

### In scope

- A local book library.
- Markdown first, followed by semantic HTML and DOCX adapters using one structured-book model.
- Arabic RTL reader with source-page boundaries, printed page labels, table of contents, and source-aware passage locations.
- In-book Arabic-normalized passage search and editable book title/author metadata.
- Passage selection with copy text, copy citation, and copy local passage link actions.
- Original prototype-inspired typography and decorated page/headings in dark and light themes.

### Explicitly deferred

- Book notes, standalone Markdown notes, highlights, clips, tag management, and study boards.
- Native PDF viewing and OCR. A later PDF release can be deliberately limited: text PDFs may support outline/search/page favourites; scanned PDFs may support reading/page favourites unless OCR is provided.
- AI providers and Claude Desktop.
- TTS/audio comments, Obsidian integration, external-library connectors, multi-book tabs/split view, cloud sync, and full backup/restore.

## Release-level acceptance outcomes

- A user can import each supported format and reopen the book in the same browser profile.
- Source pages, headings, tables, images, and footnotes remain distinguishable to the extent promised by that adapter.
- Page/contents navigation reaches the requested source location.
- A selected passage can be copied alone or with correct book/page details.
- A copied local link returns to the intended passage in the same local library.
- The reader is legible and usable in Arabic on desktop and mobile, in both themes.
- Unsupported structures and the lack of backup/restore are stated honestly.
