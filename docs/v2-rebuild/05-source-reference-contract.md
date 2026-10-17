# V2 source-reference contract

**Status:** initial foundation contract. It applies to local Markdown research notes and local structured books.

## Goal

A reader must be able to write ordinary Markdown while inserting a human-readable reference that opens the originating passage inside Smart Reader.

## Visible Markdown form

```md
> «النص المختار من الكتاب»
>
> [اسم الكتاب — عنوان القسم](#book=BOOK_ID&passage=PASSAGE_ID)
```

The visible text is editable by the reader. The application must not depend on the visible title to resolve the link.

## Stored reference form

Alongside the Markdown, the application stores a structured reference:

```ts
type NoteSourceReference = {
  bookId: string;
  passageId: string;
  sourceDocumentId: string;
  titleSnapshot: string;
  sectionTitleSnapshot?: string;
  quoteSnapshot?: string;
};
```

The local URL fragment is the first web-app navigation form. It can reopen a book and passage in the same installed/browser library, including after reload. It is not a global share link: another user cannot resolve a book that is not in their own library. The structured `bookId` and `passageId` remain the durable source of truth.

## First-release navigation rule

1. Resolve the `bookId` in the local library.
2. Resolve the `passageId` inside that book.
3. Open the book, scroll the passage into view, and flash it briefly.
4. If the book exists but the passage does not, say that the source changed and offer the book/section view.
5. If the book does not exist, show the readable citation without pretending that navigation is possible.

The first release does not use quote/prefix/suffix recovery. That belongs to a later re-import resilience feature.

## Source page markers in fixtures

The foundation fixtures use explicit page boundaries so importer tests can distinguish source pages from arbitrary reader pagination:

- Markdown: `<!-- sr:page N -->`
- HTML: an element with `data-source-page="N"`
- DOCX: a physical Word page break

The adapter should preserve these as source-page metadata when present. A format without explicit markers may still be imported, but it must not claim that generated reader pages are the original source pages.

## Safety rules

- A citation contains a snapshot of the book title so it remains readable even if live metadata changes.
- The app does not silently redirect a reference to a matching phrase elsewhere in the book.
- User-written Markdown around a source reference remains ordinary text and is never overwritten during navigation.
