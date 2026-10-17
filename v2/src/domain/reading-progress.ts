import type { BookRecord } from './types';

export function bookReaderPages(book: Pick<BookRecord, 'readerPages' | 'sourcePages'>): number[] {
  const pages = book.readerPages.length ? book.readerPages : book.sourcePages;
  return pages.length ? pages : [1];
}

export function resumeReaderPage(book: BookRecord): number {
  const pages = bookReaderPages(book);
  return book.lastReaderPage && pages.includes(book.lastReaderPage) ? book.lastReaderPage : pages[0];
}

export function readerProgressPercent(book: BookRecord, currentPage = book.lastReaderPage): number {
  if (!currentPage) return 0;
  const pages = bookReaderPages(book);
  const pageIndex = pages.indexOf(currentPage);
  return pageIndex < 0 ? 0 : Math.round(((pageIndex + 1) / pages.length) * 100);
}
