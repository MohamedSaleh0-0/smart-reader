import type { BookRecord } from './types';

export function normalizeShelfTag(value: string): string | undefined {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized ? normalized.slice(0, 40) : undefined;
}

function shelfTagKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function listShelfTags(books: readonly BookRecord[]): string[] {
  const tags = new Map<string, string>();
  for (const book of books) {
    for (const rawTag of book.shelfTags ?? []) {
      const tag = normalizeShelfTag(rawTag);
      if (tag && !tags.has(shelfTagKey(tag))) tags.set(shelfTagKey(tag), tag);
    }
  }
  return [...tags.values()].sort((left, right) => left.localeCompare(right, 'ar'));
}

export function bookHasShelfTag(book: BookRecord, tag: string): boolean {
  const key = shelfTagKey(tag);
  return (book.shelfTags ?? []).some((item) => shelfTagKey(item) === key);
}

export function setBookShelfTag(book: BookRecord, rawTag: string, assigned: boolean): BookRecord {
  const tag = normalizeShelfTag(rawTag);
  if (!tag) return book;
  const tags = (book.shelfTags ?? []).filter((item) => shelfTagKey(item) !== shelfTagKey(tag));
  if (assigned) tags.push(tag);
  return { ...book, shelfTags: tags };
}

export function filterBooksByShelfTag(books: readonly BookRecord[], tag: string): BookRecord[] {
  if (!tag) return [...books];
  return books.filter((book) => bookHasShelfTag(book, tag));
}
