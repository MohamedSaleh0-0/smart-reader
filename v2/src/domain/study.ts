import type { StudyData, StudyFavorite, StudyHighlight, StudySettings } from './types';
import { normalizeReadingStats } from './reading-stats';

export const highlightColors: StudyHighlight['color'][] = ['yellow', 'green', 'blue', 'pink', 'orange', 'purple'];

export const defaultStudySettings: StudySettings = {
  citationTemplate: '[{title} (ص: {page})]',
  includeAuthor: false,
  keepFootnotes: false,
  collectionSeparator: 'blank',
  restartWordNumberingPerChapter: false,
  notebookOrder: 'date',
};

export type StudyNotebookSort = StudySettings['notebookOrder'];
export const unassignedHighlightFilter = '__unassigned__';
export type StudyNotebookViewEntry = {
  id: string;
  kind: 'note' | 'comment';
  passageId: string;
  highlightId?: string;
  start?: number;
  end?: number;
  quote: string;
  text: string;
  html?: string;
  createdAt: string;
};

export function filterHighlightsByCategory(highlights: readonly StudyHighlight[], categoryFilter?: string): StudyHighlight[] {
  if (!categoryFilter) return [...highlights];
  return highlights.filter((highlight) => categoryFilter === unassignedHighlightFilter
    ? !highlight.categoryId
    : highlight.categoryId === categoryFilter);
}

export function emptyStudyData(): StudyData {
  return { highlights: [], favorites: [], comments: [], clips: [], notebook: [], categories: [], tags: [], links: [], pinnedPassageIds: [], reading: { days: {} }, settings: { ...defaultStudySettings } };
}

export function normalizeStudyData(
  study?: (Partial<Omit<StudyData, 'settings'>> & { settings?: Partial<StudySettings> }) | null,
): StudyData {
  const value = { ...emptyStudyData(), ...(study ?? {}) };
  return {
    ...value,
    highlights: Array.isArray(value.highlights) ? value.highlights : [],
    favorites: Array.isArray(value.favorites) ? value.favorites : [],
    comments: Array.isArray(value.comments) ? value.comments : [],
    clips: Array.isArray(value.clips) ? value.clips : [],
    notebook: Array.isArray(value.notebook) ? value.notebook : [],
    categories: Array.isArray(value.categories) ? value.categories : [],
    tags: Array.isArray(value.tags) ? value.tags : [],
    links: Array.isArray(value.links) ? value.links : [],
    pinnedPassageIds: Array.isArray(value.pinnedPassageIds) ? value.pinnedPassageIds : [],
    reading: normalizeReadingStats(value.reading),
    settings: { ...defaultStudySettings, ...(value.settings ?? {}) },
  };
}

export function toggleFavorite(study: StudyData, passageId: string, createdAt = new Date().toISOString()): StudyData {
  const exists = study.favorites.some((favorite) => favorite.passageId === passageId);
  return {
    ...study,
    favorites: exists
      ? study.favorites.filter((favorite) => favorite.passageId !== passageId)
      : [...study.favorites, { passageId, createdAt, note: '', tags: [] } satisfies StudyFavorite],
  };
}

export function updateFavoriteDetails(study: StudyData, passageId: string, details: { label?: string; note?: string }): StudyData {
  return { ...study, favorites: study.favorites.map((favorite) => favorite.passageId === passageId ? { ...favorite, ...details } : favorite) };
}

export function toggleFavoriteTag(study: StudyData, passageId: string, tag: string): StudyData {
  return {
    ...study,
    favorites: study.favorites.map((favorite) => {
      if (favorite.passageId !== passageId) return favorite;
      const tags = favorite.tags ?? [];
      return { ...favorite, tags: tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag] };
    }),
  };
}

export function assignFavoriteTag(study: StudyData, passageId: string, tag: string): StudyData {
  const value = tag.trim();
  if (!value) return study;
  const withTag = addStudyTag(study, value);
  return {
    ...withTag,
    favorites: withTag.favorites.map((favorite) => favorite.passageId === passageId
      ? { ...favorite, tags: (favorite.tags ?? []).includes(value) ? favorite.tags : [...(favorite.tags ?? []), value] }
      : favorite),
  };
}

export type FavoriteSort = 'page' | 'date';

export function filterAndSortFavorites(
  favorites: readonly StudyFavorite[],
  passageOrder: readonly string[],
  filterTag = '',
  sort: FavoriteSort = 'page',
): StudyFavorite[] {
  const positions = new Map(passageOrder.map((passageId, index) => [passageId, index]));
  return favorites
    .filter((favorite) => !filterTag || (favorite.tags ?? []).includes(filterTag))
    .slice()
    .sort((left, right) => sort === 'date'
      ? right.createdAt.localeCompare(left.createdAt)
      : (positions.get(left.passageId) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.passageId) ?? Number.MAX_SAFE_INTEGER));
}

export function listStudyNotebookEntries(
  study: StudyData,
  passageOrder: readonly string[],
  sort: StudyNotebookSort = 'date',
): StudyNotebookViewEntry[] {
  const entries: StudyNotebookViewEntry[] = [
    ...study.notebook.map((entry) => ({ ...entry, kind: 'note' as const })),
    ...study.comments.map((comment, index) => ({
      id: comment.id ?? `legacy:${comment.passageId}:${comment.start ?? ''}:${comment.end ?? ''}:${index}`,
      kind: 'comment' as const,
      passageId: comment.passageId,
      start: comment.start,
      end: comment.end,
      quote: comment.quote ?? '',
      text: comment.text,
      html: comment.html,
      createdAt: comment.updatedAt,
    })),
  ];
  if (sort === 'date') return entries.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const positions = new Map(passageOrder.map((passageId, index) => [passageId, index]));
  return entries.sort((left, right) =>
    (positions.get(left.passageId) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.passageId) ?? Number.MAX_SAFE_INTEGER)
    || (left.start ?? 0) - (right.start ?? 0)
    || left.createdAt.localeCompare(right.createdAt));
}

export function addClip(study: StudyData, clip: StudyData['clips'][number]): StudyData {
  if (study.clips.some((item) => item.passageId === clip.passageId && item.quote === clip.quote)) return study;
  return { ...study, clips: [...study.clips, clip] };
}

export function removeClip(study: StudyData, clipId: string): StudyData {
  return { ...study, clips: study.clips.filter((item) => item.id !== clipId) };
}

export function updateClipQuote(study: StudyData, clipId: string, quote: string): StudyData {
  if (!study.clips.some((item) => item.id === clipId)) return study;
  return { ...study, clips: study.clips.map((item) => item.id === clipId ? { ...item, quote } : item) };
}

export function clearClips(study: StudyData): StudyData {
  return study.clips.length ? { ...study, clips: [] } : study;
}

export function reorderClips(study: StudyData, fromId: string, toId: string): StudyData {
  if (fromId === toId) return study;
  const from = study.clips.findIndex((item) => item.id === fromId);
  const to = study.clips.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0) return study;
  const clips = [...study.clips];
  const [moving] = clips.splice(from, 1);
  clips.splice(to, 0, moving);
  return { ...study, clips };
}

export function addNotebookEntry(study: StudyData, entry: StudyData['notebook'][number]): StudyData {
  return { ...study, notebook: [...study.notebook, entry] };
}

export function updateNotebookEntry(study: StudyData, entryId: string, text: string, html?: string): StudyData {
  return { ...study, notebook: study.notebook.map((entry) => entry.id === entryId ? { ...entry, text, html } : entry) };
}

export function removeNotebookEntry(study: StudyData, entryId: string): StudyData {
  return { ...study, notebook: study.notebook.filter((entry) => entry.id !== entryId) };
}

export function upsertStudyComment(study: StudyData, comment: StudyData['comments'][number]): StudyData {
  return { ...study, comments: [...study.comments.filter((item) => item.passageId !== comment.passageId), comment] };
}

export function removeStudyComment(study: StudyData, commentId: string, passageId?: string): StudyData {
  const comments = study.comments.filter((comment) => comment.id
    ? comment.id !== commentId
    : !(passageId && comment.passageId === passageId));
  return comments.length === study.comments.length ? study : { ...study, comments };
}

export function addStudyCategory(study: StudyData, category: StudyData['categories'][number]): StudyData {
  return { ...study, categories: [...study.categories, category] };
}

export function setStudyCategoryColor(study: StudyData, categoryId: string, color?: StudyHighlight['color']): StudyData {
  if (!study.categories.some((category) => category.id === categoryId)) return study;
  return {
    ...study,
    categories: study.categories.map((category) => {
      if (category.id === categoryId) return { ...category, highlightColor: color };
      return color && category.highlightColor === color ? { ...category, highlightColor: undefined } : category;
    }),
  };
}

export function addStudyTag(study: StudyData, tag: string): StudyData {
  const value = tag.trim();
  if (!value || study.tags.includes(value)) return study;
  return { ...study, tags: [...study.tags, value] };
}

export function removeStudyTag(study: StudyData, tag: string): StudyData {
  return { ...study, tags: study.tags.filter((item) => item !== tag), favorites: study.favorites.map((favorite) => ({ ...favorite, tags: (favorite.tags ?? []).filter((item) => item !== tag) })) };
}

export function renameStudyCategory(study: StudyData, categoryId: string, name: string): StudyData {
  return { ...study, categories: study.categories.map((category) => category.id === categoryId ? { ...category, name } : category) };
}

export function removeStudyCategory(study: StudyData, categoryId: string): StudyData {
  return {
    ...study,
    categories: study.categories.filter((category) => category.id !== categoryId),
    highlights: study.highlights.map((highlight) => highlight.categoryId === categoryId ? { ...highlight, categoryId: undefined } : highlight),
  };
}

export function togglePinnedPassage(study: StudyData, passageId: string): StudyData {
  return {
    ...study,
    pinnedPassageIds: study.pinnedPassageIds.includes(passageId)
      ? study.pinnedPassageIds.filter((id) => id !== passageId)
      : [...study.pinnedPassageIds, passageId],
  };
}

export function linkPassages(study: StudyData, link: StudyData['links'][number]): StudyData {
  if (link.fromPassageId === link.toPassageId || study.links.some((item) =>
    (item.fromPassageId === link.fromPassageId && item.toPassageId === link.toPassageId)
    || (item.fromPassageId === link.toPassageId && item.toPassageId === link.fromPassageId))) return study;
  return { ...study, links: [...study.links, link] };
}

export function removePassageLink(study: StudyData, linkId: string): StudyData {
  return { ...study, links: study.links.filter((link) => link.id !== linkId) };
}

export function addHighlight(study: StudyData, highlight: StudyHighlight): StudyData {
  const highlights = study.highlights.flatMap((item) => {
    if (item.passageId !== highlight.passageId || item.end <= highlight.start || item.start >= highlight.end) return [item];
    const retained: StudyHighlight[] = [];
    if (item.start < highlight.start) {
      const end = highlight.start;
      retained.push({ ...item, id: `${item.id}-left-${highlight.id}`, end, quote: item.quote.slice(0, end - item.start) });
    }
    if (item.end > highlight.end) {
      const start = highlight.end;
      retained.push({ ...item, id: `${item.id}-right-${highlight.id}`, start, quote: item.quote.slice(start - item.start) });
    }
    return retained;
  });
  return { ...study, highlights: [...highlights, highlight] };
}

export function addHighlightWithCategory(
  study: StudyData,
  highlight: StudyHighlight,
  selectedCategoryId?: string | 'none',
): StudyData {
  if (selectedCategoryId === 'none') return addHighlight(study, { ...highlight, categoryId: undefined });

  const selectedCategory = selectedCategoryId
    ? study.categories.find((category) => category.id === selectedCategoryId)
    : study.categories.find((category) => category.highlightColor === highlight.color);
  if (!selectedCategory) return addHighlight(study, { ...highlight, categoryId: undefined });

  const canLinkColor = Boolean(selectedCategoryId)
    && !selectedCategory.highlightColor
    && !study.categories.some((category) => category.highlightColor === highlight.color);
  const categorizedStudy = canLinkColor
    ? setStudyCategoryColor(study, selectedCategory.id, highlight.color)
    : study;
  return addHighlight(categorizedStudy, { ...highlight, categoryId: selectedCategory.id });
}

export function removeHighlightsInRange(study: StudyData, passageId: string, start: number, end: number): StudyData {
  return {
    ...study,
    highlights: study.highlights.flatMap((item) => {
      if (item.passageId !== passageId || item.end <= start || item.start >= end) return [item];
      const retained: StudyHighlight[] = [];
      if (item.start < start) {
        retained.push({ ...item, id: `${item.id}-left-${start}`, end: start, quote: item.quote.slice(0, start - item.start) });
      }
      if (item.end > end) {
        retained.push({ ...item, id: `${item.id}-right-${end}`, start: end, quote: item.quote.slice(end - item.start) });
      }
      return retained;
    }),
  };
}
