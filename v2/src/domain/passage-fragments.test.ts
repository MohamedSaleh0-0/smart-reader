import { describe, expect, it } from 'vitest';
import { appendPassageFragment } from './passage-fragments';
import type { Passage } from './types';

const passage: Passage = {
  id: 'p-1', text: 'بداية الفقرة', readerPageNumber: 4, readerPageEndNumber: 4,
  headingContext: 'الفصل الأول', footnoteIds: ['note-1'],
};

describe('passages that continue across pages', () => {
  it('keeps one logical passage, appends its text and footnotes, and records the end page', () => {
    expect(appendPassageFragment(passage, { text: 'تتمة الفقرة.', readerPageNumber: 5, footnoteIds: ['note-1', 'note-2'] }))
      .toEqual({
        ...passage,
        text: 'بداية الفقرة تتمة الفقرة.',
        readerPageEndNumber: 5,
        footnoteIds: ['note-1', 'note-2'],
      });
  });

  it('does not mutate the original passage while extending it', () => {
    appendPassageFragment(passage, { text: 'تتمة.', readerPageNumber: 5 });
    expect(passage).toEqual({
      id: 'p-1', text: 'بداية الفقرة', readerPageNumber: 4, readerPageEndNumber: 4,
      headingContext: 'الفصل الأول', footnoteIds: ['note-1'],
    });
  });
});
