# Smart Reader test fixtures

These small fixtures are for the import and reading workflows in `docs/core-workflows.md`.

- `sample.html`: Arabic headings, links, footnotes, and printed-page markers.
- `sample.txt`: plain Arabic text with page markers.
- `sample.md`: Markdown headings, lists, emphasis, links, and a footnote.
- `sample.docx`: Word headings, Arabic text, a footnote, and a page break.
- `sample.epub`: EPUB metadata, navigation, two chapters, and RTL content.
- `sample.odt`: OpenDocument headings, paragraphs, and a note.
- `sample-text.pdf`: selectable Arabic text, two pages, and PDF outline entries.

The scanned/OCR PDF fixture is intentionally omitted because a real one is already available for testing.

Expected common content:

- Title: `اختبار القارئ الذكي`
- Author: `فريق الاختبار`
- Printed page markers: `[ص: ١٢]` and `[ج ١ ص ١٣]`
- Search terms: `القراءة`, `البحث`, `الفائدة`

## V2 foundation fixtures

`v2/` contains matching Arabic fixtures for the v2 structured-book import contract:

- `research-book.md`: Markdown baseline.
- `research-book.html`: semantic HTML baseline.
- `research-book.docx`: DOCX baseline with heading styles, a table, hyperlink, and two footnotes.
- `research-note.md`: a Markdown research note with source-reference placeholders.
- `expected-results.md`: the acceptance contract shared by those fixtures.

The DOCX fixture is generated reproducibly with `scripts/create_v2_docx_fixture.py`.
