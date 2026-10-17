import type { BookRecord, StudyData, StudyHighlight } from './types';
import { emptyStudyData, linkPassages, normalizeStudyData } from './study';
import { isValidReadingDateKey, mergeReadingStats } from './reading-stats';

export type StudyBackup = {
  format: 'smart-reader-study-backup';
  version: 1;
  exportedAt: string;
  book: { id: string; title: string; sourceName: string };
  study: StudyData;
};

const highlightColors: StudyHighlight['color'][] = ['yellow', 'green', 'blue', 'pink', 'orange', 'purple'];

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || isString(value);
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isHighlight(value: unknown): boolean {
  return record(value)
    && isString(value.id)
    && isString(value.passageId)
    && typeof value.start === 'number' && Number.isFinite(value.start)
    && typeof value.end === 'number' && Number.isFinite(value.end)
    && isString(value.quote)
    && highlightColors.includes(value.color as StudyHighlight['color'])
    && isOptionalString(value.categoryId)
    && isString(value.createdAt);
}

function isFavorite(value: unknown): boolean {
  return record(value)
    && isString(value.passageId)
    && isString(value.createdAt)
    && isOptionalString(value.label)
    && isOptionalString(value.note)
    && (value.tags === undefined || isStringArray(value.tags));
}

function isComment(value: unknown): boolean {
  return record(value)
    && isOptionalString(value.id)
    && isString(value.passageId)
    && isOptionalNumber(value.start)
    && isOptionalNumber(value.end)
    && isOptionalString(value.quote)
    && isString(value.text)
    && isOptionalString(value.html)
    && isString(value.updatedAt);
}

function isClip(value: unknown): boolean {
  return record(value)
    && isString(value.id)
    && isString(value.passageId)
    && isString(value.quote)
    && (value.footnoteIds === undefined || isStringArray(value.footnoteIds))
    && isString(value.createdAt);
}

function isNotebookEntry(value: unknown): boolean {
  return record(value)
    && isString(value.id)
    && isString(value.passageId)
    && isOptionalString(value.highlightId)
    && isString(value.quote)
    && isString(value.text)
    && isOptionalString(value.html)
    && isString(value.createdAt);
}

function isCategory(value: unknown): boolean {
  return record(value)
    && isString(value.id)
    && isString(value.name)
    && (value.color === undefined || highlightColors.includes(value.color as StudyHighlight['color']))
    && (value.highlightColor === undefined || highlightColors.includes(value.highlightColor as StudyHighlight['color']));
}

function isLink(value: unknown): boolean {
  return record(value)
    && isString(value.id)
    && isString(value.fromPassageId)
    && isString(value.toPassageId)
    && isString(value.createdAt);
}

function isSettings(value: unknown): boolean {
  return record(value)
    && isString(value.citationTemplate)
    && typeof value.includeAuthor === 'boolean'
    && typeof value.keepFootnotes === 'boolean'
    && ['blank', 'line', 'stars'].includes(String(value.collectionSeparator))
    && typeof value.restartWordNumberingPerChapter === 'boolean'
    && ['date', 'page'].includes(String(value.notebookOrder));
}

function isReadingStats(value: unknown): boolean {
  if (value === undefined) return true;
  if (!record(value) || !record(value.days)) return false;
  return Object.entries(value.days).every(([date, devices]) => isValidReadingDateKey(date)
    && record(devices)
    && Object.values(devices).every((seconds) => typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0));
}

function isStudyData(value: unknown): value is StudyData {
  return record(value)
    && Array.isArray(value.highlights) && value.highlights.every(isHighlight)
    && Array.isArray(value.favorites) && value.favorites.every(isFavorite)
    && Array.isArray(value.comments) && value.comments.every(isComment)
    && Array.isArray(value.clips) && value.clips.every(isClip)
    && Array.isArray(value.notebook) && value.notebook.every(isNotebookEntry)
    && Array.isArray(value.categories) && value.categories.every(isCategory)
    && isStringArray(value.tags)
    && Array.isArray(value.links) && value.links.every(isLink)
    && isStringArray(value.pinnedPassageIds)
    && isReadingStats(value.reading)
    && isSettings(value.settings);
}

export function createStudyBackup(book: Pick<BookRecord, 'id' | 'title' | 'sourceName'>, study: StudyData, exportedAt = new Date()): StudyBackup {
  return {
    format: 'smart-reader-study-backup',
    version: 1,
    exportedAt: exportedAt.toISOString(),
    book: { id: book.id, title: book.title, sourceName: book.sourceName },
    study: normalizeStudyData(study),
  };
}

export function parseStudyBackup(value: unknown): StudyBackup | undefined {
  if (!record(value) || value.format !== 'smart-reader-study-backup' || value.version !== 1
    || !isString(value.exportedAt) || !record(value.book)
    || !isString(value.book.id) || !isString(value.book.title) || !isString(value.book.sourceName)
    || !isStudyData(value.study)) return undefined;
  return value as StudyBackup;
}

function mergeByKey<T>(current: readonly T[], imported: readonly T[], keyOf: (value: T) => string): T[] {
  const values = new Map(current.map((value) => [keyOf(value), value]));
  for (const value of imported) values.set(keyOf(value), value);
  return [...values.values()];
}

export function mergeStudyData(current: StudyData, imported: StudyData): StudyData {
  const currentFavorites = new Map(current.favorites.map((favorite) => [favorite.passageId, favorite]));
  const favorites = mergeByKey(current.favorites, imported.favorites, (favorite) => favorite.passageId).map((favorite) => {
    const previous = currentFavorites.get(favorite.passageId);
    const incoming = imported.favorites.find((item) => item.passageId === favorite.passageId);
    return previous && incoming
      ? { ...previous, ...incoming, tags: [...new Set([...(previous.tags ?? []), ...(incoming.tags ?? [])])] }
      : favorite;
  });

  const commentsByPassage = new Map(current.comments.map((comment) => [comment.passageId, comment]));
  for (const comment of imported.comments) {
    const previous = commentsByPassage.get(comment.passageId);
    if (!previous || comment.updatedAt >= previous.updatedAt) commentsByPassage.set(comment.passageId, comment);
  }

  const combined = normalizeStudyData({
    ...current,
    highlights: mergeByKey(current.highlights, imported.highlights, (item) => item.id),
    favorites,
    comments: [...commentsByPassage.values()],
    clips: mergeByKey(current.clips, imported.clips, (item) => item.id),
    notebook: mergeByKey(current.notebook, imported.notebook, (item) => item.id),
    categories: mergeByKey(current.categories, imported.categories, (item) => item.id),
    tags: [...new Set([...current.tags, ...imported.tags])],
    pinnedPassageIds: [...new Set([...current.pinnedPassageIds, ...imported.pinnedPassageIds])],
    settings: imported.settings,
    reading: mergeReadingStats(current.reading, imported.reading),
    links: [],
  });
  let linked: StudyData = { ...combined, links: [] };
  for (const link of mergeByKey(current.links, imported.links, (item) => item.id)) linked = linkPassages(linked, link);
  return linked;
}

export function keepStudyEntriesForPassages(study: StudyData, passageIds: ReadonlySet<string>): { study: StudyData; dropped: number } {
  let dropped = 0;
  const keep = <T extends { passageId: string }>(items: T[]) => {
    const result = items.filter((item) => passageIds.has(item.passageId));
    dropped += items.length - result.length;
    return result;
  };
  const links = study.links.filter((link) => passageIds.has(link.fromPassageId) && passageIds.has(link.toPassageId));
  dropped += study.links.length - links.length;
  const pinnedPassageIds = study.pinnedPassageIds.filter((passageId) => passageIds.has(passageId));
  dropped += study.pinnedPassageIds.length - pinnedPassageIds.length;
  return {
    study: { ...study, highlights: keep(study.highlights), favorites: keep(study.favorites), comments: keep(study.comments), clips: keep(study.clips), notebook: keep(study.notebook), links, pinnedPassageIds },
    dropped,
  };
}
