import { describe, expect, it } from 'vitest';
import { groupDocxPages, type DocxImportBlock } from './docx-pagination';

const paragraph = (text: string): DocxImportBlock => ({ kind: 'paragraph', html: `<p>${text}</p>` });
const hardBreak: DocxImportBlock = { kind: 'break', hard: true };
const softBreak: DocxImportBlock = { kind: 'break', hard: false };
const labels = (pages: DocxImportBlock[][]) => pages.map((page) => page.map((block) => block.kind === 'break' ? 'break' : block.html));

describe('DOCX page boundaries', () => {
  it('keeps explicit page breaks between non-empty pages', () => {
    expect(labels(groupDocxPages([paragraph('الأولى'), hardBreak, paragraph('الثانية')], { hasHardBreaks: true, useSoftBreaks: false })))
      .toEqual([['<p>الأولى</p>'], ['<p>الثانية</p>']]);
  });

  it('retains a shared logical-passage identity across a Word page break', () => {
    const first = { ...paragraph('بداية فقرة'), passageGroupId: 'paragraph-1', continuation: false };
    const second = { ...paragraph('تتمة الفقرة'), passageGroupId: 'paragraph-1', continuation: true };

    expect(groupDocxPages([first, hardBreak, second], { hasHardBreaks: true, useSoftBreaks: false }))
      .toEqual([[first], [second]]);
  });

  it('preserves an explicitly blank page between consecutive hard page breaks', () => {
    expect(labels(groupDocxPages([paragraph('الأولى'), hardBreak, hardBreak, paragraph('الثالثة')], { hasHardBreaks: true, useSoftBreaks: false })))
      .toEqual([['<p>الأولى</p>'], [], ['<p>الثالثة</p>']]);
  });

  it('preserves a leading blank page when an explicit hard break precedes the first content', () => {
    expect(labels(groupDocxPages([hardBreak, paragraph('الثانية')], { hasHardBreaks: true, useSoftBreaks: false })))
      .toEqual([[], ['<p>الثانية</p>']]);
  });

  it('does not infer blank source pages from repeated layout-derived breaks', () => {
    expect(labels(groupDocxPages([paragraph('الأولى'), softBreak, softBreak, paragraph('الثانية')], { hasHardBreaks: false, useSoftBreaks: true })))
      .toEqual([['<p>الأولى</p>'], ['<p>الثانية</p>']]);
  });

  it('does not create a trailing blank page from a single terminal break', () => {
    expect(labels(groupDocxPages([paragraph('الأولى'), hardBreak], { hasHardBreaks: true, useSoftBreaks: false })))
      .toEqual([['<p>الأولى</p>']]);
  });

  it('retains the virtual-page heuristic when Word has no page-break metadata', () => {
    const first = paragraph(Array.from({ length: 280 }, () => 'كلمة').join(' '));
    const second = paragraph('بداية الموضع التالي');

    expect(groupDocxPages([first, second], { hasHardBreaks: false, useSoftBreaks: false }))
      .toEqual([[first], [second]]);
  });
});
