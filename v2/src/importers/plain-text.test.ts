import { describe, expect, it } from 'vitest';
import { importPlainText } from './plain-text';

describe('plain text importer', () => {
  it('preserves paragraphs and literal Markdown while applying explicit Arabic page labels', async () => {
    const book = await importPlainText(
      '\uFEFF[ص: ٥]\r\n\r\nعنوان **نص**\r\nسطر ثانٍ.\r\n\r\n[ص: ٦]\r\n\r\nنهاية.',
      'ملاحظات.txt',
    );

    expect(book.title).toBe('ملاحظات');
    expect(book.sourcePages).toEqual([5, 6]);
    expect(book.readerPages).toEqual([5, 6]);
    expect(book.passages.map((passage) => passage.text)).toEqual(['عنوان **نص**\nسطر ثانٍ.', 'نهاية.']);
    expect(book.html).not.toContain('<strong>نص</strong>');
  });

  it('keeps volume page labels visible and warns that only standalone page labels map to citations', async () => {
    const book = await importPlainText('[ج٢ ص١٢]\n\nنص الصفحة.', 'مجلد.txt');

    expect(book.pageNumberKind).toBe('virtual');
    expect(book.passages[0]?.text).toContain('[ج٢ ص١٢]');
    expect(book.warnings.join(' ')).toContain('لا تخزن رقم الجزء');
  });

  it('recognizes the original Arabic page-label spellings', async () => {
    const book = await importPlainText('ص ١١\n\nالصفحة: ١٢\n\nنص الصفحة الثانية.', 'صفحات.txt');

    expect(book.sourcePages).toEqual([11, 12]);
    expect(book.passages.at(-1)?.sourcePageNumber).toBe(12);
  });

  it('imports numbered footnotes after a separator and links their body references', async () => {
    const book = await importPlainText('متن الفقرة (١).\n\nــــــــــــ\n(١) شرح الحاشية.', 'حواشٍ.txt');

    expect(book.footnotes).toHaveLength(1);
    expect(book.footnotes[0]?.text).toContain('شرح الحاشية');
    expect(book.passages[0]?.footnoteIds).toContain(book.footnotes[0]?.id);
  });

  it('treats text with multiple Markdown headings as Markdown', async () => {
    const book = await importPlainText('# الكتاب\n\n## الفصل الأول\n\n**نص منسق**\n\nص: ١٣\n\nنهاية.', 'كتاب.txt');

    expect(book.headings).toHaveLength(2);
    expect(book.sourcePages).toEqual([1, 13]);
    expect(book.html).toContain('<strong>نص منسق</strong>');
  });

  it('rejects files with no readable content', async () => {
    await expect(importPlainText('\uFEFF  \n\0', 'empty.txt')).rejects.toThrow('الملف النصي فارغ');
  });
});
