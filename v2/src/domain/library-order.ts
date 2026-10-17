import type { BookRecord } from './types';

export type LibrarySort = 'last-read' | 'added' | 'title';

const titleCollator = new Intl.Collator('ar', { sensitivity: 'base', numeric: true });

/** Sorts the shelf without mutating the books array. Last-read uses the most recent day with recorded activity. */
export function sortLibraryBooks(books: readonly BookRecord[], sort: LibrarySort): BookRecord[] {
  const recentFirst = (left: BookRecord, right: BookRecord) => right.importedAt.localeCompare(left.importedAt);

  return [...books].sort((left, right) => {
    if (sort === 'title') return titleCollator.compare(left.title, right.title) || recentFirst(left, right);
    if (sort === 'added') return recentFirst(left, right) || titleCollator.compare(left.title, right.title);

    const readDifference = lastReadPosition(right).localeCompare(lastReadPosition(left));
    return readDifference || recentFirst(left, right) || titleCollator.compare(left.title, right.title);
  });
}

function lastReadPosition(book: BookRecord): string {
  const preciseLastRead = book.study?.reading?.lastReadAt;
  if (preciseLastRead && Number.isFinite(Date.parse(preciseLastRead))) return new Date(preciseLastRead).toISOString();

  const days = book.study?.reading?.days;
  if (!days) return '';
  return Object.entries(days)
    .filter(([date, devices]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Object.values(devices).some((seconds) => Number.isFinite(seconds) && seconds > 0))
    .map(([date]) => date)
    .sort()
    .at(-1) ?? '';
}
