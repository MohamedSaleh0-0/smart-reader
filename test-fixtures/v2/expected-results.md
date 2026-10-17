# V2 foundation fixture expected results

These fixtures specify the smallest behaviour required before a v2 import adapter is accepted. They are test sources, not user documentation.

## Shared book expectations

Every adapter must create a book with:

- title: `أصول القراءة البحثية`
- author: `فريق اختبار القارئ الذكي`
- RTL reading direction
- a heading hierarchy containing one level-1 heading, two level-2 headings, two level-3 headings, and one level-4 heading
- three separate occurrences of `الرجوع إلى المصدر يحفظ سياق الفائدة`, one on each source page
- one embedded image on source page 2, with alt text and caption
- one external link to `https://example.org/manhaj`
- one ordered list and one unordered list
- one three-column, three-row data table
- two visibly separate footnotes
- both `12` and `١٢`
- three ordered reading pages; printed/source page numbers are populated only where the source format explicitly provides them: Markdown markers and HTML `data-source-page` labels are `1`, `2`, and `3`, while DOCX hard page breaks create internal reader positions rather than invented printed labels
- page 3 containing `الفصل الثالث بناء الملاحظة`

## Markdown expectations

- `<!-- sr:page 1 -->`, `<!-- sr:page 2 -->`, and `<!-- sr:page 3 -->` remain ordered source-page markers.
- The image reference resolves to a packaged/local asset rather than an inaccessible relative path.
- The Markdown image uses `./research-figure.png` and has Arabic alt text; the same-page image file must be selected with the Markdown file so the import embeds it in place.
- YAML front matter is read as metadata where supported; otherwise the user can edit imported metadata.
- Table pipes do not appear as ordinary paragraph text.
- Footnote references link to the matching footnote text.

## Semantic HTML expectations

- The document `lang="ar"` and `dir="rtl"` are honoured.
- The three `[data-source-page]` containers remain three ordered source pages.
- The image `src`, alt text, and caption remain associated with source page 2.
- The HTML image resolves relative to the imported HTML document.
- The title and author meta tags are available to the importer.
- Structural tags (`article`, `section`, headings, lists, table, blockquote, aside) retain their meaning.
- The two footnote links resolve to their matching entries in the `aside`.

## DOCX expectations

- The document contains at least three physical pages, with page breaks preserved between them.
- A focused importer regression also verifies that consecutive explicit hard page breaks preserve an empty reader page, while layout-derived break hints do not manufacture blank pages.
- The embedded image remains associated with its paragraph/order position and its alternative text or caption where DOCX exposes them.
- The image is embedded in the DOCX package, not linked to the fixture directory.
- Heading styles become the same heading levels as the other fixtures.
- Table cells remain in a structured table, not flattened into one paragraph.
- The external hyperlink remains identifiable as a link.
- The two Word footnotes remain distinct from body paragraphs and retain their order.
- The fixture contains one true ordered list and one true bullet list in its Word numbering part; these become semantic reading lists.
- A paragraph/list item split by a Word page break remains one logical passage across both page fragments; selecting either fragment opens actions for the full passage, and its citation reports the start–end reader-page range.
- The DOCX fixture includes a paragraph with an explicit page break in its middle and footnote references on both fragments; the reader should keep one passage identity, preserve both footnotes, and cite the full page range.

## Passage and note expectations

- Selecting either repeated sentence produces a different `passageId`.
- A source-reference inserted into a note contains the visible book/section text and a structured locator.
- Clicking the reference returns to the selected occurrence and flashes it.
- Reopening the same browser profile preserves the book, note, and link.
