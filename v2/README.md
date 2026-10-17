# Smart Reader v2 workspace

This directory is the isolated React-based v2 foundation. It is intentionally separate from the current root application.

The current slice is a reader, not a note-taking workspace. It imports Markdown, semantic HTML, and DOCX into one book model. Explicit HTML source-page markers and DOCX hard page breaks are retained; generated positions are labeled internal rather than presented as printed page numbers. The DOCX adapter reads heading styles, lists, tables, safe external links, embedded raster images, and separate Word footnotes. For an HTML book with local images, select the HTML file and its image files together; remote images are blocked. Original HTML CSS is not imported. Markdown-relative image packaging remains open.

A reader can search passages, navigate pages or contents, correct title/author metadata, and copy a passage, citation, or local passage link. The reader uses the original prototype's bundled Arabic fonts and page/heading visual language in both dark and light modes. Book notes, highlights, and annotation management are deferred. HTML and DOCX fixture behavior, representative books, and browser/device compatibility still need verification. Browser storage is not a backup.

Run `npm install`, `npm test`, `npm run test:unit`, and `npm run build` from this directory. Vite serves the app with `npm run dev`.

The optional local companion connects explicitly shared books to Claude Desktop and Codex, and powers the in-app cloud Q&A panel. See [`companion/README.md`](companion/README.md); the reading app works without it. Cloud questions require a provider API key, which the app does not save.

The hosted GitHub Pages build records page visits with GoatCounter. Development builds do not load the counter, and the standalone portable HTML contains no GoatCounter code.
