import { describe, expect, it } from 'vitest';
import { searchLibrary } from './library-search';

const books = [
  {
    id: 'book-one', title: 'القراءة', author: 'أحمد', pageNumberKind: 'source' as const,
    passages: [
      { id: 'p1', text: 'إدارة الوقت مهمة.', readerPageNumber: 1, sourcePageNumber: 1 },
      { id: 'p2', text: 'القراءة في البحث.', readerPageNumber: 2, sourcePageNumber: 2 },
    ],
    headings: [{ id: 'h1', level: 1, title: 'منهج البحث', readerPageNumber: 1 }],
  },
  {
    id: 'book-two', title: 'أصول الدراسة', pageNumberKind: 'virtual' as const,
    passages: [{ id: 'p3', text: 'إدارة المعرفة.', readerPageNumber: 4 }],
    headings: [],
  },
];

describe('library-wide search', () => {
  it('normalizes Arabic and finds matching passages across different books', () => {
    const results = searchLibrary(books, 'ادارة');

    expect(results.map((group) => group.bookId)).toEqual(['book-one', 'book-two']);
    expect(results[0]?.matches[0]?.kind).toBe('passage');
    expect((results[0]?.matches[0] as { passage: { text: string } }).passage.text).toBe('إدارة الوقت مهمة.');
    expect(searchLibrary(books, 'منهج البحث')[0]?.matches[0]?.kind).toBe('heading');
  });

  it('requires every query word in the same passage or heading', () => {
    const results = searchLibrary(books, 'إدارة القراءة');

    expect(results).toEqual([]);
  });

  it('also finds matching book metadata and ignores queries shorter than two normalized characters', () => {
    expect(searchLibrary(books, 'أصول الدراسة')[0]?.matches[0]?.kind).toBe('book');
    expect(searchLibrary(books, 'ا')).toEqual([]);
  });
});
