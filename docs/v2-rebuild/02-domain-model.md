# Phase 2 — v2 domain model

**Status:** draft. This defines the concepts that v2 must protect; it is not yet a database schema or a technology choice.

## Why this model exists

The prototype mixes several kinds of location: page, generated reader segment, printed page label, section, and exact passage. v2 must model them separately so that Markdown imports, citations, notes, deep links, and later OCR conversions can remain reliable.

## Core entities

| Entity | Meaning | Key responsibilities |
|---|---|---|
| `Book` | The user-facing intellectual work in the library | Title, author, edition metadata, cover, collection membership, source documents |
| `SourceDocument` | A particular imported file or conversion source | File type, original filename, checksum, import method, import status, provenance |
| `SourcePage` | A physical/source-order page from a document | Original sequence, printed label, source dimensions, empty-page status, OCR confidence where relevant |
| `ReaderSegment` | A rendered unit used by the structured reader | Stable order and mapping to source pages; may contain one or more passages |
| `Passage` | The smallest addressable reading/annotation target | Canonical text, stable ID, source-page relation, heading context, quote locator |
| `Heading` | Hierarchical structural landmark | Level, title, parent, target passage/segment |
| `Footnote` | Supplementary text associated with a source page or passage | Marker, body, source relation, display behaviour |
| `MediaAsset` | An image or other supported embedded media item | Binary asset, media type, dimensions, alternative text, caption, provenance, and placement anchor |
| `Annotation` | A user action anchored to one or more passages | Highlight, note, clip, bookmark, link, pen/text annotation where supported |
| `NoteDocument` | A standalone user-authored Markdown note | Title, Markdown body, citation/link embeds, links back to passages |
| `Tag` | User-defined reusable label | Name, colour, optional description; editable and deletable |
| `Collection` | User-defined grouping | Folder, bookmark list, reading list, or study collection; membership is many-to-many where appropriate |
| `Citation` | A portable reference to a book location and optional quote | Book identity, resolved metadata snapshot, locator, display style, quote |
| `ImportRun` | An auditable attempt to create/update a source document | Input, converter version, warnings, outcomes, mapping statistics |
| `Backup` | Versioned export/import package | Format version, timestamps, included objects, integrity checks |

## Relationship map

```text
Book
  └─ SourceDocument (one or more editions/files)
       └─ SourcePage (zero or more; preserves source order)
            └─ ReaderSegment (zero or more)
                 └─ Passage (one or more)
                      ├─ Annotation (zero or more)
                      └─ Citation (zero or more)

Tag ↔ Annotation                 many-to-many
Collection ↔ Book                many-to-many, depending on collection type
Collection ↔ Annotation          many-to-many, for bookmark/study collections
Heading → Passage/ReaderSegment  navigational target
Footnote → SourcePage/Passage    explicit parent relationship
MediaAsset → SourcePage/Passage  explicit placement and provenance relationship
NoteDocument → Citation/Passage  explicit links to source material
```

## Location and page rules

These rules are invariants, not optional UI behaviour:

1. `sourcePageOrdinal` is the physical order in the source document. It includes blank pages.
2. `printedPageLabel` is text found or declared in the source, such as `٢٤`; it may be absent, repeated, Roman, or non-numeric.
3. `readerSegmentOrdinal` is a rendering/navigation number. It must never be presented as the source’s printed page without qualification.
4. A `Passage` has a stable ID and a quote locator. It is not identified only by a visual page number.
5. A source page with no recognised text remains a source page. It cannot be dropped because its content is empty or short.
6. Footnotes belong to a known source page and, where possible, a specific passage. They must not silently merge into body text.
7. A conversion that cannot establish page boundaries must record that limitation in its `ImportRun`; it must not fabricate a claim of source-page fidelity.
8. An image is preserved as an asset plus a location, not merely as a filename or an image detached from the text.

## Proposed location object

```ts
type PassageLocator = {
  bookId: string;
  sourceDocumentId: string;
  sourcePageOrdinal?: number;
  printedPageLabel?: string;
  readerSegmentId?: string;
  passageId?: string;
  quote?: string;  // selected passage text
  prefix?: string; // a short excerpt immediately before it
  suffix?: string; // a short excerpt immediately after it
};
```

For the first v2 slice, `bookId` + `passageId` is the normal locator. `quote`, `prefix`, and `suffix` are later resilience data: if a book is re-imported and passage IDs change, the application can look for the selected text and use the short text before and after it to distinguish repeated sentences. They are not a user-facing citation format. The application must disclose when it falls back from an exact passage to a broader location.

## Image model

```ts
type MediaPlacement = {
  sourcePageOrdinal?: number;
  readerSegmentId?: string;
  passageId?: string;
  orderInSegment?: number;
  pdfBox?: { x: number; y: number; width: number; height: number };
};

type MediaAsset = {
  id: string;
  mediaType: string;
  originalName?: string;
  contentHash: string;
  width?: number;
  height?: number;
  altText?: string;
  caption?: string;
  credit?: string;
  placement: MediaPlacement;
  sourceDocumentId: string;
};
```

The foundation reader supports block images. It stores the binary asset locally, gives it a stable ID, and stores its relation to the source page and surrounding passage. It should retain the original image when possible instead of unnecessarily re-encoding it.

For Markdown, preserve the image reference, import the image into the library, and retain alt text and caption. For HTML, resolve relative image URLs against the imported document and retain the source relationship. For DOCX, extract embedded media from the package and preserve its paragraph/order anchor, caption, and available alt text.

PDF is a later, separate contract. A PDF viewer can preserve the original page and, where the PDF exposes image objects, record a page number plus PDF coordinates. If the image is only part of a scanned page, the reliable fallback is to preserve the whole original PDF page; OCR text alone cannot reconstruct the image as an independent asset or guarantee its exact location. The UI must distinguish exact image placement from page-level preservation.

## Citation model

```ts
type Citation = {
  id: string;
  locator: PassageLocator;
  bookMetadataSnapshot: {
    title: string;
    author?: string;
    edition?: string;
  };
  sectionTitle?: string;
  quote?: string;
  createdAt: string;
};
```

The metadata snapshot makes a citation readable outside the library. The live `Book` metadata remains editable; a section title is supplementary information and never replaces the book title.

## Annotation model

Annotations should be typed rather than represented by unrelated UI controls:

```ts
type AnnotationKind =
  | 'highlight'
  | 'note'
  | 'clip'
  | 'bookmark'
  | 'link'
  | 'drawing';

type Annotation = {
  id: string;
  kind: AnnotationKind;
  anchors: PassageLocator[];
  body?: string;
  tags: string[];
  collectionIds: string[];
  createdAt: string;
  updatedAt: string;
};
```

Implications:

- The old fixed categories become seeded, editable tags rather than permanent fields.
- A bookmark can belong to several bookmark/study collections.
- Text notes and transcription remain; audio-file storage is not a foundation requirement.
- The default editor should be inline or side-panel based. A modal is a fallback, not the core experience.
- A `NoteDocument` is a first-class Markdown document, not only a field inside an annotation. It may contain normal user writing plus citation/link embeds.

## Import contracts

Each importer creates a `SourceDocument`, an `ImportRun`, and a documented fidelity result.

| Input | Minimum contract |
|---|---|
| Markdown book | Foundation input: preserve semantic headings, lists, links, footnotes, tables, and packaged images; create stable passages |
| Semantic HTML / DOCX | Foundation adapters: preserve available structure and report unsupported features |
| ODT / EPUB | Deferred adapters: preserve available structure and report unsupported features |
| OCR Markdown | Later input: preserve declared page boundaries—including blanks—and footnote associations; record marker rules and warnings |
| Text/OCR PDF | Later viewer input: outline navigation, search, and favourite pages where a text layer exists |
| Scanned PDF | Later viewer input: reading and favourite pages; state that text features require OCR |

## Decisions intentionally postponed

- Exact database/library choice and state-management library.
- Cloud identity and synchronisation semantics.
- OCR engine/provider and whether it runs locally or remotely.
- Rich drawing/ink representation.
- Public identifiers and sharing URLs.
- AI-provider request/response schemas.

Those choices must conform to this model, not reshape it accidentally.
