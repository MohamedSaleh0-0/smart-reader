# V2 technical spike results

**Status:** reader-first implementation slice; not a release candidate. Updated 2026-10-09.

## Decisions and current scope

- React + TypeScript + Vite remain the v2 UI/build baseline.
- The first release journey is import → read/navigate → copy passage/citation/local link. Book-note authoring and annotation management are deferred.
- Markdown is the first implemented import adapter. Semantic HTML and DOCX remain required before the structured-reader foundation can be called complete.
- The unified/remark pipeline is implemented and tested, but final parser selection remains open until compared with markdown-it using the same fixtures.
- IndexedDB persists books behind a repository; database schema version 4 stores distinct source-page and reader-page metadata and migrates older book records. Existing local note records are not deleted, but v2 no longer reads or exposes them.
- A local passage URL fragment identifies a book and stable passage ID. It resolves only inside the same local library and is not a public share link.

## Implemented in v2

- Import a Markdown file or load the three-page Arabic fixture.
- Build source-page groups or generated virtual reading pages, Arabic display labels, headings, stable passage IDs, footnote definitions, image references, and passage-to-footnote relationships.
- Render tables, lists, links, images, footnotes, and RTL Arabic content through a sanitized pipeline; remote images are not fetched implicitly.
- Keep footnote definitions within their declared source page and link references to the footnote location.
- Use the original prototype's locally bundled Amiri, Aref Ruqaa, and Cairo fonts, palette, page surfaces, and decorated heading treatment in dark/light modes.
- Navigate by source page and contents; adjust reader text size.
- Search indexed passages with common Arabic orthographic normalization and edit title/author metadata used in citations.
- Distinguish printed source-page citations from internal positions generated for unmarked Markdown.
- Select a passage and copy it, copy it with its book/page citation, or copy a local passage link.
- Keep the original application intact and isolate the replacement under `v2/`.

## Automated evidence

- Root `npm test`: 11 tests pass.
- `v2/npm test`: 3 dependency-free domain-contract tests pass.
- `v2/npm run test:unit`: importer and citation tests pass, including Arabic/nonsequential page labels, source-page-local footnotes, stable repeated-passage IDs, unsafe HTML removal, blocked remote images, and citation metadata.
- `v2/npm run build`: TypeScript check and Vite production build pass.

These checks do not substitute for loading the app in a browser. The current visual port, IndexedDB upgrade path, copy permissions, and reload/deep-link behavior still need a browser/device review.

## Known limitations and next evidence needed

- Semantic HTML and DOCX adapters are not implemented.
- User-provided relative image assets are warned about but not yet packaged with the imported book.
- Markdown parser choice is provisional until the parser comparison is done.
- Search within the open book is not yet implemented in v2.
- The current PDF/OCR, AI, TTS, notes, and annotation tracks remain deferred.
- Browser storage can be cleared or evicted; users need another copy of important files until export/backup is designed and tested.

## Next work

1. Run the current reader in a browser and compare page typography/layout to the original screenshots in both themes.
2. Test import, page stepping, passage selection, clipboard citation, and local-link reload in a clean browser profile.
3. Implement semantic HTML import, verify it against its fixture and a real Arabic source, then do the same for DOCX.
4. Add safe local image packaging and verify search/citations in the browser.
