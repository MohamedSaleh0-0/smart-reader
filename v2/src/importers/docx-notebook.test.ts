import { describe, expect, it } from 'vitest';
import { collectStudyNotebookWordEdits } from './docx-notebook';

describe('Word notebook comment paragraph parsing', () => {
  it('reads edited comment paragraphs until the next blank or bookmarked quote', () => {
    expect(collectStudyNotebookWordEdits([
      { bookmarks: [], style: 'Heading1', text: 'دفتر المذاكرة' },
      { bookmarks: ['nb_passage_1_1'], style: '', text: 'اقتباس [كتاب ص١]', quote: 'اقتباس' },
      { bookmarks: [], style: '', text: 'تعليق: تعليق Word' },
      { bookmarks: [], style: '', text: 'سطر إضافي' },
      { bookmarks: [], style: '', text: '' },
      { bookmarks: ['nbn_abc_passage_1_1'], style: '', text: 'اقتباس آخر', quote: 'اقتباس آخر' },
      { bookmarks: [], style: '', text: 'تعليق: ملاحظة جديدة' },
      { bookmarks: [], style: 'Heading1', text: 'المفضلة' },
      { bookmarks: [], style: '', text: 'تعليق: يجب تجاهلها' },
    ])).toEqual([
      { bookmarkName: 'nb_passage_1_1', text: 'تعليق Word\nسطر إضافي', quote: 'اقتباس' },
      { bookmarkName: 'nbn_abc_passage_1_1', text: 'ملاحظة جديدة', quote: 'اقتباس آخر' },
    ]);
  });

  it('ignores bookmarked paragraphs without the editable comment label', () => {
    expect(collectStudyNotebookWordEdits([
      { bookmarks: ['nb_p1'], style: '', text: 'اقتباس [كتاب ص١]', quote: 'اقتباس' },
      { bookmarks: [], style: '', text: 'نص غير موسوم' },
      { bookmarks: [], style: '', text: '' },
    ])).toEqual([]);
  });
});
