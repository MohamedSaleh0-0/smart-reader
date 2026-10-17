import { normalizeArabicSearch } from './search';
import type { BookRecord, Passage } from './types';

export type LibrarySearchBook = Pick<BookRecord, 'id' | 'title' | 'author' | 'aliases' | 'pageNumberKind' | 'passages' | 'headings'>;
export type LibrarySearchMatch =
  | { kind: 'book'; bookId: string; bookTitle: string; pageNumberKind: BookRecord['pageNumberKind'] }
  | { kind: 'passage'; bookId: string; bookTitle: string; pageNumberKind: BookRecord['pageNumberKind']; passage: Passage }
  | { kind: 'heading'; bookId: string; bookTitle: string; pageNumberKind: BookRecord['pageNumberKind']; heading: BookRecord['headings'][number] };
export type LibrarySearchGroup = { bookId: string; bookTitle: string; author?: string; pageNumberKind: BookRecord['pageNumberKind']; matches: LibrarySearchMatch[] };

/** Search book metadata, passage text, and headings across the open library. */
export function searchLibrary(books: readonly LibrarySearchBook[], query: string): LibrarySearchGroup[] {
  const normalizedQuery = normalizeArabicSearch(query);
  if (normalizedQuery.length < 2) return [];
  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const containsAllWords = (value: string) => {
    const normalized = normalizeArabicSearch(value);
    return words.every((word) => normalized.includes(word));
  };

  return books.flatMap((book) => {
    const matches: LibrarySearchMatch[] = [];
    if (containsAllWords(`${book.title} ${book.author ?? ''} ${(book.aliases ?? []).join(' ')}`)) {
      matches.push({ kind: 'book', bookId: book.id, bookTitle: book.title, pageNumberKind: book.pageNumberKind });
    }
    for (const passage of book.passages) {
      if (containsAllWords(passage.text)) matches.push({ kind: 'passage', bookId: book.id, bookTitle: book.title, pageNumberKind: book.pageNumberKind, passage });
    }
    for (const heading of book.headings) {
      if (containsAllWords(heading.title)) matches.push({ kind: 'heading', bookId: book.id, bookTitle: book.title, pageNumberKind: book.pageNumberKind, heading });
    }
    return matches.length ? [{ bookId: book.id, bookTitle: book.title, author: book.author, pageNumberKind: book.pageNumberKind, matches }] : [];
  });
}
