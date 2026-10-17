import { describe, expect, it } from 'vitest';
import { addClip, addHighlight, addHighlightWithCategory, addNotebookEntry, addStudyCategory, addStudyTag, assignFavoriteTag, clearClips, emptyStudyData, filterAndSortFavorites, filterHighlightsByCategory, linkPassages, listStudyNotebookEntries, normalizeStudyData, removeHighlightsInRange, removeStudyCategory, removeStudyComment, removeStudyTag, reorderClips, setStudyCategoryColor, toggleFavorite, toggleFavoriteTag, togglePinnedPassage, unassignedHighlightFilter, updateClipQuote, updateFavoriteDetails, updateNotebookEntry } from './study';
import type { StudyHighlight } from './types';

const highlight = (id: string, start: number, end: number): StudyHighlight => ({
  id, passageId: 'p1', start, end, quote: 'selected', color: 'yellow', createdAt: '2026-10-09T00:00:00.000Z',
});

describe('passage study data', () => {
  it('filters reader-search highlights by category or uncategorized marks', () => {
    const highlights = [
      { ...highlight('h1', 0, 8), categoryId: 'cat1' },
      { ...highlight('h2', 9, 17), categoryId: 'cat2' },
      highlight('h3', 18, 26),
    ];

    expect(filterHighlightsByCategory(highlights, 'cat1').map(({ id }) => id)).toEqual(['h1']);
    expect(filterHighlightsByCategory(highlights, unassignedHighlightFilter).map(({ id }) => id)).toEqual(['h3']);
    expect(filterHighlightsByCategory(highlights).map(({ id }) => id)).toEqual(['h1', 'h2', 'h3']);
  });

  it('toggles a passage favorite without changing unrelated study data', () => {
    const initial = emptyStudyData();
    const favorited = toggleFavorite(initial, 'p1', 'today');
    expect(favorited.favorites).toEqual([{ passageId: 'p1', createdAt: 'today', note: '', tags: [] }]);
    expect(toggleFavorite(favorited, 'p1').favorites).toEqual([]);
  });

  it('keeps a single copy of an identical clipped quotation', () => {
    const initial = emptyStudyData();
    const clip = { id: 'c1', passageId: 'p1', quote: 'quote', createdAt: 'today' };
    expect(addClip(addClip(initial, clip), { ...clip, id: 'c2' }).clips).toHaveLength(1);
  });

  it('reorders collected passages by drag target without introducing arrow controls', () => {
    const initial = { ...emptyStudyData(), clips: [
      { id: 'a', passageId: 'p1', quote: 'one', createdAt: 'today' },
      { id: 'b', passageId: 'p2', quote: 'two', createdAt: 'today' },
      { id: 'c', passageId: 'p3', quote: 'three', createdAt: 'today' },
    ] };
    expect(reorderClips(initial, 'c', 'a').clips.map(({ id }) => id)).toEqual(['c', 'a', 'b']);
    expect(reorderClips(initial, 'missing', 'a')).toBe(initial);
  });

  it('edits one collected quotation without losing its source metadata and clears only the collection', () => {
    const initial = {
      ...emptyStudyData(),
      clips: [
        { id: 'c1', passageId: 'p1', quote: 'old quote', footnoteIds: ['fn1'], createdAt: 'today' },
        { id: 'c2', passageId: 'p2', quote: 'another quote', createdAt: 'yesterday' },
      ],
      favorites: [{ passageId: 'p3', createdAt: 'today', tags: ['للمراجعة'] }],
    };
    const edited = updateClipQuote(initial, 'c1', 'edited quote');
    expect(edited.clips[0]).toEqual({ ...initial.clips[0], quote: 'edited quote' });
    expect(edited.clips[1]).toEqual(initial.clips[1]);
    expect(updateClipQuote(initial, 'missing', 'ignored')).toBe(initial);

    const cleared = clearClips(edited);
    expect(cleared.clips).toEqual([]);
    expect(cleared.favorites).toEqual(initial.favorites);
    expect(clearClips(cleared)).toBe(cleared);
    expect(initial.clips[0].quote).toBe('old quote');
  });

  it('fills fields missing from a study record saved by an earlier version', () => {
    expect(normalizeStudyData({ favorites: [] })).toEqual(emptyStudyData());
  });

  it('fills new citation preferences in a legacy record while preserving saved choices', () => {
    const normalized = normalizeStudyData({ settings: { includeAuthor: true, collectionSeparator: 'line' } });
    expect(normalized.settings).toEqual({
      citationTemplate: '[{title} (ص: {page})]',
      includeAuthor: true,
      keepFootnotes: false,
      collectionSeparator: 'line',
      restartWordNumberingPerChapter: false,
      notebookOrder: 'date',
    });
  });

  it('manages notebook entries, user categories, pins and passage links immutably', () => {
    const original = emptyStudyData();
    const withNote = addNotebookEntry(original, { id: 'n1', passageId: 'p1', quote: 'quote', text: '', createdAt: 'today' });
    const editedNote = updateNotebookEntry(withNote, 'n1', 'my note');
    const categorized = addStudyCategory(editedNote, { id: 'cat1', name: 'للحفظ', color: 'yellow' });
    const pinned = togglePinnedPassage(categorized, 'p1');
    const linked = linkPassages(linkPassages(linkPassages(pinned, { id: 'l1', fromPassageId: 'p1', toPassageId: 'p2', createdAt: 'today' }), { id: 'l2', fromPassageId: 'p1', toPassageId: 'p2', createdAt: 'later' }), { id: 'l3', fromPassageId: 'p2', toPassageId: 'p1', createdAt: 'reverse' });
    expect(editedNote.notebook[0].text).toBe('my note');
    expect(linked.links).toHaveLength(1);
    expect(linked.pinnedPassageIds).toEqual(['p1']);
    expect(removeStudyCategory(linked, 'cat1').categories).toHaveLength(0);
    expect(original).toEqual(emptyStudyData());
  });

  it('combines quote notes and comments in notebook order and removes a comment without touching notes', () => {
    const initial = {
      ...emptyStudyData(),
      notebook: [
        { id: 'n1', passageId: 'p2', quote: 'second passage', text: 'note', createdAt: '2026-10-03' },
        { id: 'n2', passageId: 'p1', quote: 'first passage', text: '', createdAt: '2026-10-04' },
      ],
      comments: [
        { id: 'c1', passageId: 'p1', start: 12, end: 18, quote: 'late excerpt', text: 'comment', updatedAt: '2026-10-02' },
        { id: 'c2', passageId: 'p1', start: 2, end: 8, quote: 'early excerpt', text: 'earlier in page', updatedAt: '2026-10-05' },
      ],
    };

    expect(listStudyNotebookEntries(initial, ['p1', 'p2'], 'date').map(({ id }) => id)).toEqual(['c1', 'n1', 'n2', 'c2']);
    expect(listStudyNotebookEntries(initial, ['p1', 'p2'], 'page').map(({ id }) => id)).toEqual(['n2', 'c2', 'c1', 'n1']);
    const withoutComment = removeStudyComment(initial, 'c1');
    expect(withoutComment.comments.map(({ id }) => id)).toEqual(['c2']);
    expect(withoutComment.notebook).toEqual(initial.notebook);
    expect(removeStudyComment(withoutComment, 'missing')).toBe(withoutComment);

    const legacy = { ...initial, comments: [{ passageId: 'p2', text: 'old comment', updatedAt: '2026-10-06' }] };
    expect(removeStudyComment(legacy, 'legacy:p2:::', 'p2').comments).toEqual([]);
  });

  it('allows custom tags and editable labels/notes on passage favorites', () => {
    const favorited = toggleFavorite(emptyStudyData(), 'p1', 'today');
    const tagged = toggleFavoriteTag(addStudyTag(favorited, 'للمراجعة'), 'p1', 'للمراجعة');
    const edited = updateFavoriteDetails(tagged, 'p1', { label: 'مهم', note: 'ارجع له' });
    const removed = removeStudyTag(edited, 'للمراجعة');
    expect(edited.favorites[0]).toMatchObject({ label: 'مهم', note: 'ارجع له', tags: ['للمراجعة'] });
    expect(removed.favorites[0].tags).toEqual([]);
    expect(removed.tags).toEqual([]);
  });

  it('assigns a newly created tag to a favorite once and adds it to the shared tag list', () => {
    const favorite = toggleFavorite(emptyStudyData(), 'p1', '2026-10-10T10:00:00.000Z');
    const assigned = assignFavoriteTag(favorite, 'p1', ' للمراجعة ');
    const assignedAgain = assignFavoriteTag(assigned, 'p1', 'للمراجعة');
    expect(assigned.tags).toEqual(['للمراجعة']);
    expect(assigned.favorites[0].tags).toEqual(['للمراجعة']);
    expect(assignedAgain.favorites[0].tags).toEqual(['للمراجعة']);
    expect(assignFavoriteTag(favorite, 'missing', 'وسم')).toMatchObject({ tags: ['وسم'], favorites: favorite.favorites });
  });

  it('filters favorites by one tag and sorts by passage order or newest date without mutating input', () => {
    const first = { passageId: 'p2', createdAt: '2026-10-10T10:00:00.000Z', tags: ['للمراجعة', 'للحفظ'] };
    const second = { passageId: 'p1', createdAt: '2026-10-11T10:00:00.000Z', tags: ['للحفظ'] };
    const third = { passageId: 'p3', createdAt: '2026-10-09T10:00:00.000Z', tags: [] };
    const favorites = [first, second, third];
    expect(filterAndSortFavorites(favorites, ['p1', 'p2', 'p3'], 'للحفظ').map(({ passageId }) => passageId)).toEqual(['p1', 'p2']);
    expect(filterAndSortFavorites(favorites, ['p1', 'p2', 'p3'], '', 'date').map(({ passageId }) => passageId)).toEqual(['p1', 'p2', 'p3']);
    expect(filterAndSortFavorites(favorites, ['p1', 'p2', 'p3']).map(({ passageId }) => passageId)).toEqual(['p1', 'p2', 'p3']);
    expect(favorites).toEqual([first, second, third]);
  });

  it('replaces overlapping highlight ranges and erases ranges that intersect a selection', () => {
    const initial = { ...emptyStudyData(), highlights: [highlight('a', 0, 8), highlight('b', 12, 18)] };
    const added = addHighlight(initial, highlight('c', 5, 14));
    expect(added.highlights.map(({ start, end }) => [start, end])).toEqual([[0, 5], [14, 18], [5, 14]]);
    expect(removeHighlightsInRange({ ...added, highlights: [highlight('x', 0, 8), highlight('y', 12, 18)] }, 'p1', 7, 15).highlights.map(({ start, end }) => [start, end])).toEqual([[0, 7], [15, 18]]);
  });

  it('links one highlight color to one category and applies that category automatically', () => {
    const base = emptyStudyData();
    const first = { id: 'cat1', name: 'فوائد', highlightColor: 'yellow' as const };
    const second = { id: 'cat2', name: 'تنبيهات', highlightColor: 'green' as const };
    const linked = setStudyCategoryColor({ ...base, categories: [first, second] }, 'cat1', 'green');
    expect(linked.categories).toEqual([{ ...first, highlightColor: 'green' }, { ...second, highlightColor: undefined }]);
    const automatic = addHighlightWithCategory(linked, { ...highlight('h1', 0, 4), color: 'green' });
    expect(automatic.highlights[0].categoryId).toBe('cat1');
    expect(setStudyCategoryColor(linked, 'missing', 'pink')).toBe(linked);
  });

  it('lets a selected category acquire an unused color and lets explicit no-category override auto-linking', () => {
    const initial = { ...emptyStudyData(), categories: [{ id: 'cat1', name: 'فوائد' }] };
    const chosen = addHighlightWithCategory(initial, { ...highlight('h1', 0, 4), color: 'blue' }, 'cat1');
    expect(chosen.categories[0].highlightColor).toBe('blue');
    expect(chosen.highlights[0].categoryId).toBe('cat1');
    const explicitNone = addHighlightWithCategory(chosen, { ...highlight('h2', 8, 12), color: 'blue' }, 'none');
    expect(explicitNone.highlights.find(({ id }) => id === 'h2')?.categoryId).toBeUndefined();
  });

  it('does not treat the legacy v2 category display hue as an automatic highlight-color link', () => {
    const legacy = normalizeStudyData({ categories: [{ id: 'old', name: 'قديم', color: 'yellow' }] });
    const result = addHighlightWithCategory(legacy, { ...highlight('h1', 0, 4), color: 'yellow' });
    expect(legacy.categories[0]).toMatchObject({ color: 'yellow' });
    expect(legacy.categories[0].highlightColor).toBeUndefined();
    expect(result.highlights[0].categoryId).toBeUndefined();
  });
});
