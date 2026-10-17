# V2 foundation delivery plan

**Goal:** deliver one dependable research workflow for Markdown, semantic HTML, and DOCX books—without native PDF, OCR, AI, TTS, or broad feature parity.

The first technical proof is isolated under `v2/` and does not replace v1 or imply that the project owner has approved the full foundation scope. Confirm the scope before expanding from the Markdown spike into the HTML/DOCX adapters.

## Step 1 — lock the input contracts

Before application code:

- Approve the first vertical-slice specification.
- Define the shared fixture content for Markdown, HTML, and DOCX.
- State what each format is expected to preserve and what may be warned about.
- Decide the visible citation/reference syntax in Markdown notes.
- Decide the early-version data warning because full backup/restore is deferred.

**Exit criterion:** the team can explain what successful import means for all three formats in one short page.

## Step 2 — create fixtures and expected results

Create controlled files:

| Fixture | Purpose |
|---|---|
| `research-book.md` | Markdown parsing and Arabic/RTL baseline |
| `research-book.html` | Semantic HTML import baseline |
| `research-book.docx` | Word headings, tables, hyperlinks, and footnote baseline |
| `research-note.md` | Note writing and source-reference rendering |

Each book should contain matching headings, paragraphs, repeated text, links, lists, a table, footnotes, and Arabic/Western numerals.

**Exit criterion:** each fixture has a reviewed expected-result checklist, rather than relying on visual memory.

## Step 3 — technical foundation spike

Build a small, disposable proof-of-concept answering only:

1. Can the chosen application foundation run locally and build reproducibly?
2. Can one Markdown file become the common structured-book representation?
3. Can that representation render RTL content and provide stable passage IDs?
4. Can a Markdown note store a structured reference and navigate back to a passage after reload?

No polished library, themes, PDF support, AI, or settings in this step.

**Exit criterion:** these four questions have evidence-backed answers. Otherwise revise the architecture before committing to it.

## Step 4 — shared structured-book core and Markdown adapter

Implement the smallest tested modules:

- Book and source-document metadata.
- Common document tree: headings, blocks/passages, links, tables, and footnotes.
- Local persistence for books and notes.
- Reader with TOC, search, selection, and passage navigation.
- Markdown note editor/preview and source-reference insertion.

The core must not know whether its structure came from Markdown, HTML, or DOCX.

**Exit criterion:** the Markdown adapter passes the vertical slice completely.

## Step 5 — semantic HTML adapter

Import semantic HTML into the common structured-book core. Unsupported markup is reported rather than silently represented as misleading content.

**Exit criterion:** the HTML fixture and one real Arabic HTML book pass the same workflow.

## Step 6 — DOCX adapter

Import DOCX into the common structured-book core. Preserve headings, paragraphs, lists, tables, hyperlinks, and available footnotes; report limits explicitly.

**Exit criterion:** the DOCX fixture and one real Arabic DOCX book pass the same workflow.

## Step 7 — usability gate

Test with real intended readers, using their own books and notes. Fix core-workflow failures before adding new feature families.

At the gate, choose the next release based on evidence: richer annotations, OCR Markdown/page structure, native PDF, AI/Claude Desktop, portability/backup, or multi-book layout.

## Quality rules

- Every bug becomes a fixture or regression test where feasible.
- Every source format declares what it preserves and what it does not.
- Do not start a later step because the UI looks finished; start it only after the previous exit criterion passes.
- Keep v1 usable as a comparison point until v2 replaces an agreed workflow.
- Record design decisions briefly, including rejected alternatives and their reason.
