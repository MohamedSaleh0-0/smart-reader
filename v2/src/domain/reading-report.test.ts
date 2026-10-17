import { describe, expect, it } from 'vitest';
import { emptyStudyData } from './study';
import { buildReadingSummaryText, buildReadingTeacherReportHtml, summarizeReadingLibrary } from './reading-stats';

describe('library reading report', () => {
  it('summarizes per-book and per-chapter activity and builds safe report output', () => {
    const study = {
      ...emptyStudyData(),
      reading: { days: { '2026-10-12': { device: 120 }, '2026-10-11': { device: 30 } } },
      highlights: [
        { id: 'h1', passageId: 'p2', start: 0, end: 4, quote: 'نص', color: 'yellow' as const, createdAt: '2026-10-12' },
      ],
      comments: [
        { id: 'c1', passageId: 'p1', text: 'تعليق', updatedAt: '2026-10-12' },
        { id: 'c2', passageId: 'p1', text: '  ', updatedAt: '2026-10-12' },
      ],
      notebook: [{ id: 'n1', passageId: 'p2', quote: 'نص', text: 'ملاحظة', createdAt: '2026-10-12' }],
    };
    const result = summarizeReadingLibrary([
      {
        id: 'book-a', title: '<كتاب>', headings: [{ title: 'باب أول' }, { title: 'باب ثاني' }],
        passages: [
          { id: 'p1', headingContext: 'باب أول' },
          { id: 'p2', headingContext: 'باب ثاني' },
        ], study,
      },
      { id: 'book-b', title: 'كتاب بلا سجل', headings: [], passages: [], study: emptyStudyData() },
    ], new Date(2026, 9, 12, 12));

    expect(result.reading.libraryToday).toBe(120);
    expect(result.reading.libraryWeek).toBe(150);
    expect(result.reading.activeDays).toBe(1);
    expect(result.reading.recentDays.at(-1)).toEqual({ date: '2026-10-12', seconds: 120 });
    expect(result.books).toHaveLength(1);
    expect(result.books[0]).toMatchObject({ id: 'book-a', seconds: 150, highlights: 1, comments: 2, lastRead: '2026-10-12' });
    expect(result.books[0].chapters).toEqual([
      { title: 'باب أول', highlights: 0, comments: 1 },
      { title: 'باب ثاني', highlights: 1, comments: 1 },
    ]);

    const text = buildReadingSummaryText(result, 'مريم');
    expect(text).toContain('الطالب: مريم');
    expect(text).toContain('<كتاب>: ٣ د');
    const report = buildReadingTeacherReportHtml(result, '<script>alert(1)</script>', new Date(2026, 9, 12, 12));
    expect(report).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(report).toContain('&lt;كتاب&gt;');
    expect(report).toContain('باب ثاني');
    expect(report).not.toContain('<script>alert(1)</script>');
  });
});
