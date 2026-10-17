import { describe, expect, it } from 'vitest';
import { emptyStudyData } from './study';
import { applyStudyNotebookWordEdits, notebookEntryBookmarkName, studyNotebookBookmarkName } from './study-notebook-docx';
import type { BookRecord, StudyData } from './types';

const book: Pick<BookRecord, 'passages'> = {
  passages: [
    { id: 'p1', text: 'نص الفقرة الأولى.', readerPageNumber: 1 },
    { id: 'p2', text: 'نص الفقرة الثانية.', readerPageNumber: 2 },
  ],
};

describe('notebook Word comment round-trip', () => {
  it('creates safe bookmarks for comments, highlight notes, and quote notes', () => {
    expect(studyNotebookBookmarkName({ id: 'c1', kind: 'comment', passageId: 'passage-1-a', quote: '', text: '', createdAt: 'today' }))
      .toBe('nb_passage_1_a');
    expect(studyNotebookBookmarkName({ id: 'n1', kind: 'note', passageId: 'p1', highlightId: 'highlight-1', quote: 'نص', text: '', createdAt: 'today' }))
      .toBe('nb_h_highlight1');
    expect(notebookEntryBookmarkName('note-id', 'passage-1-a')).toMatch(/^nbn_[a-z0-9]+_passage_1_a$/);
    expect(notebookEntryBookmarkName('id', 'p'.repeat(50))).toBeUndefined();
  });

  it('updates comments and notes by their bookmark while ignoring missing passage IDs', () => {
    const current: StudyData = {
      ...emptyStudyData(),
      highlights: [{ id: 'highlight-1', passageId: 'p1', start: 0, end: 3, quote: 'نص', color: 'yellow', createdAt: 'today' }],
      comments: [{ id: 'comment-1', passageId: 'p1', quote: 'مقتطف', start: 0, end: 3, text: 'قديم', updatedAt: '2026-01-01' }],
      notebook: [
        { id: 'note-id', passageId: 'p1', quote: 'مقتطف', text: 'ملاحظة قديمة', createdAt: 'today' },
        { id: 'highlight-note', passageId: 'p1', highlightId: 'highlight-1', quote: 'نص', text: 'تعليق قديم', createdAt: 'today' },
      ],
    };
    const highlightNote = { id: 'highlight-note', kind: 'note' as const, passageId: 'p1', highlightId: 'highlight-1', quote: 'نص', text: '', createdAt: 'today' };
    const noteBookmark = notebookEntryBookmarkName('note-id', 'p1')!;
    const result = applyStudyNotebookWordEdits(book, current, [
      { bookmarkName: 'nb_p1', text: 'تعليق محدّث' },
      { bookmarkName: studyNotebookBookmarkName(highlightNote)!, text: 'ملاحظة التظليل' },
      { bookmarkName: noteBookmark, text: 'ملاحظة مقتطف محدّثة' },
      { bookmarkName: 'nb_p2', text: 'تعليق جديد' },
      { bookmarkName: 'nb_missing', text: 'تعليق يتيم' },
    ], '2026-02-01', (() => { let id = 0; return () => `new-${++id}`; })());

    expect(result.changed).toBe(4);
    expect(result.ignored).toBe(1);
    expect(result.study.comments).toEqual([
      { ...current.comments[0], text: 'تعليق محدّث', updatedAt: '2026-02-01' },
      { id: 'new-1', passageId: 'p2', quote: 'نص الفقرة الثانية.', text: 'تعليق جديد', updatedAt: '2026-02-01' },
    ]);
    expect(result.study.notebook.map((entry) => entry.text)).toEqual(['ملاحظة مقتطف محدّثة', 'ملاحظة التظليل']);
  });

  it('removes emptied comments and can recreate a deleted quote note from its bookmarked passage', () => {
    const current = {
      ...emptyStudyData(),
      comments: [{ id: 'comment-1', passageId: 'p1', text: 'قديم', updatedAt: '2026-01-01' }],
    };
    const result = applyStudyNotebookWordEdits(book, current, [
      { bookmarkName: 'nb_p1', text: '' },
      { bookmarkName: notebookEntryBookmarkName('removed-note', 'p2')!, text: 'ملاحظة مستعادة', quote: 'اقتباس Word' },
    ], '2026-02-01', () => 'restored-note');

    expect(result.changed).toBe(2);
    expect(result.study.comments).toEqual([]);
    expect(result.study.notebook).toEqual([{ id: 'restored-note', passageId: 'p2', quote: 'اقتباس Word', text: 'ملاحظة مستعادة', createdAt: '2026-02-01' }]);
  });
});
