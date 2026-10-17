import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importMarkdown } from './markdown';

const fixturePath = resolve(process.cwd(), '../test-fixtures/v2/research-book.md');

describe('Markdown fixture import', () => {
  it('preserves the three declared source pages and major reading structures', async () => {
    const source = await readFile(fixturePath, 'utf8');
    const imageBytes = new Uint8Array(await readFile(resolve(process.cwd(), '../test-fixtures/v2/research-figure.png')));
    const image = new File([imageBytes], 'research-figure.png', { type: 'image/png' });
    const book = await importMarkdown(source, 'research-book.md', { assets: [image] });

    expect(book.title).toBe('أصول القراءة البحثية');
    expect(book.sourcePageCount).toBe(3);
    expect(book.sourcePages).toEqual([1, 2, 3]);
    expect(book.readerPages).toEqual([1, 2, 3]);
    expect(book.readerPageCount).toBe(3);
    expect(book.pageNumberKind).toBe('source');
    expect(book.headings.length).toBeGreaterThanOrEqual(6);
    expect(book.stats.footnotes).toBe(2);
    expect(book.footnotes[0].definitionReaderPage).toBe(1);
    expect(book.footnotes[0].referencedBy[0].readerPageNumber).toBe(1);
    expect(book.footnotes[1].definitionReaderPage).toBe(2);
    expect(book.passages.some((passage) => passage.text.startsWith('الحاشية الأولى'))).toBe(false);
    expect(book.stats.images).toBe(1);
    expect(book.html).toContain('<table>');
    expect(book.html).toContain('footnote');
    expect(book.html).toContain('<section data-source-page="1" data-reader-page="1" data-page-label="١" data-page-kind="source">');
    expect(book.html).toContain('data-source-page="2"');
    expect(book.html).toContain('class="chapter-number"');
    expect(book.html).toContain('class="chapter-title"');
    expect(book.html).toContain('class="chapter-line"');
    expect(book.html).toContain('<img');
    expect(book.html).toContain('src="data:image/png;base64,');
    expect(book.warnings).toEqual([]);
    const firstPage = /<section data-source-page="1"[^>]*>([\s\S]*?)<\/section>/.exec(book.html)?.[1];
    expect(firstPage).toContain('href="#user-content-sr-footnote-');
    expect(firstPage).toContain('الحاشية الأولى');
    const secondPage = /<section data-source-page="2"[^>]*>([\s\S]*?)<\/section>/.exec(book.html)?.[1];
    expect(secondPage).toContain('الحاشية الثانية');
    const thirdPage = /<section data-source-page="3"[^>]*>([\s\S]*?)<\/section>/.exec(book.html)?.[1];
    expect(thirdPage).not.toContain('class="footnotes"');
  });

  it('renders a footnote on each source page that references it, with unique local targets', async () => {
    const book = await importMarkdown(
      '<!-- sr:page 4 -->\n\n# الصفحة الأولى\n\nإحالة أولى[^shared].\n\n<!-- sr:page 5 -->\n\n# الصفحة الثانية\n\nإحالة ثانية[^shared].\n\n[^shared]: نص الحاشية المشتركة.',
      'repeated-footnote.md',
    );
    const pages = [...book.html.matchAll(/<section data-source-page="(\d+)"[^>]*>([\s\S]*?)<\/section>/g)];
    const firstPage = pages.find(([, page]) => page === '4')?.[2] ?? '';
    const secondPage = pages.find(([, page]) => page === '5')?.[2] ?? '';
    const targetIds = [...book.html.matchAll(/<li id="([^"]+)"/g)].map(([, id]) => id);

    expect(book.footnotes[0].definitionReaderPage).toBe(4);
    expect(book.footnotes[0].referencedBy.map((reference) => reference.readerPageNumber)).toEqual([4, 5]);
    expect(firstPage).toContain('نص الحاشية المشتركة');
    expect(secondPage).toContain('نص الحاشية المشتركة');
    expect(firstPage).toContain('>١</a>');
    expect(secondPage).toContain('>١</a>');
    expect(targetIds).toHaveLength(2);
    expect(new Set(targetIds).size).toBe(2);
    expect(firstPage).toMatch(/href="#user-content-sr-footnote-[^"]+"/);
    expect(secondPage).toMatch(/href="#user-content-sr-footnote-[^"]+"/);
  });

  it('numbers footnotes by first reference on the page rather than definition order', async () => {
    const book = await importMarkdown(
      '<!-- sr:page 1 -->\n\n# ترتيب الحواشي\n\nالإحالة الأولى[^z] ثم الثانية[^a].\n\n[^a]: تعريف الحاشية الثانية.\n\n[^z]: تعريف الحاشية الأولى.',
      'footnote-order.md',
    );
    const page = /<section data-source-page="1"[^>]*>([\s\S]*?)<\/section>/.exec(book.html)?.[1] ?? '';
    const numbers = [...page.matchAll(/class="footnote-ref"><a[^>]*>([^<]+)<\/a>/g)].map(([, number]) => number);

    expect(numbers).toEqual(['١', '٢']);
    expect(page.indexOf('تعريف الحاشية الأولى')).toBeLessThan(page.indexOf('تعريف الحاشية الثانية'));
  });

  it('assigns deterministic but distinct passage IDs to repeated sentences', async () => {
    const source = await readFile(fixturePath, 'utf8');
    const first = await importMarkdown(source, 'research-book.md');
    const second = await importMarkdown(source, 'research-book.md');
    const repeated = first.passages.filter((passage) => passage.text.includes('الرجوع إلى المصدر يحفظ سياق الفائدة'));

    expect(repeated).toHaveLength(3);
    expect(new Set(repeated.map((passage) => passage.id)).size).toBe(3);
    expect(second.passages.map((passage) => passage.id)).toEqual(first.passages.map((passage) => passage.id));
  });

  it('does not render raw unsafe HTML from an imported Markdown file', async () => {
    const book = await importMarkdown(
      '# اختبار\n\nفقرة آمنة.\n\n<img src=x onerror="alert(1)"><script>alert(2)</script>',
      'unsafe.md',
    );

    expect(book.html).not.toContain('<script');
    expect(book.html).not.toContain('onerror');
  });

  it('does not load remote images implicitly', async () => {
    const book = await importMarkdown('![tracked image](https://example.org/pixel.png)', 'remote-image.md');

    expect(book.html).toContain('<img');
    expect(book.html).not.toContain('src="https://example.org/pixel.png"');
    expect(book.warnings).toHaveLength(1);
  });

  it('does not trust author-supplied data image URLs', async () => {
    const book = await importMarkdown('![unsafe](data:image/png;base64,SGVsbG8=)', 'unsafe-image.md');

    expect(book.html).not.toContain('data:image/png;base64,SGVsbG8=');
    expect(book.html).toContain('<img');
  });

  it('embeds a selected relative image at its source-page location', async () => {
    const image = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'figure.png', { type: 'image/png' });
    Object.defineProperty(image, 'webkitRelativePath', { value: 'books/assets/figure.png' });
    const sameNameElsewhere = new File([new Uint8Array([0])], 'figure.png', { type: 'image/png' });
    Object.defineProperty(sameNameElsewhere, 'webkitRelativePath', { value: 'other/figure.png' });
    const book = await importMarkdown(
      '<!-- sr:page 2 -->\n\n![مخطط تجريبي](./assets/figure.png)',
      'research-book.md',
      { assets: [image, sameNameElsewhere], sourcePath: 'books/research-book.md' },
    );

    expect(book.html).toContain('<section data-source-page="2"');
    expect(book.html).toContain('<img src="data:image/png;base64,iVBORw0KGgo=" alt="مخطط تجريبي">');
    expect(book.stats.images).toBe(1);
    expect(book.warnings).toEqual([]);
  });

  it('warns when a relative image is missing or uses an unsupported format', async () => {
    const missing = await importMarkdown('![missing](./missing.png)', 'book.md');
    const svg = new File(['<svg/>'], 'vector.svg', { type: 'image/svg+xml' });
    const unsupported = await importMarkdown('![vector](./vector.svg)', 'book.md', { assets: [svg] });

    expect(missing.warnings[0]).toContain('غير مرفقة');
    expect(unsupported.warnings[0]).toContain('غير مدعومة');
    expect(unsupported.html).not.toContain('data:image/svg+xml');
  });

  it('uses declared printed page labels without inventing an empty page before the first marker', async () => {
    const book = await importMarkdown(
      '<!-- sr:page ٧ -->\n\n# صفحة متأخرة\n\nمقطع من الصفحة.\n\n<!-- sr:page ٩ -->\n\nصفحة أخرى.',
      'numbered-pages.md',
    );

    expect(book.sourcePages).toEqual([7, 9]);
    expect(book.readerPages).toEqual([7, 9]);
    expect(book.html).toContain('data-source-page="7" data-reader-page="7" data-page-label="٧" data-page-kind="source"');
    expect(book.sourcePageCount).toBe(2);
    expect(book.pageNumberKind).toBe('source');
  });

  it('preserves an explicitly declared blank source page between consecutive page markers', async () => {
    const book = await importMarkdown(
      '<!-- sr:page ٧ -->\n\n# صفحة أولى\n\nمقطع الصفحة الأولى.\n\n<!-- sr:page ٨ -->\n\n<!-- sr:page ٩ -->\n\nصفحة أخيرة.',
      'blank-source-page.md',
    );

    expect(book.sourcePages).toEqual([7, 8, 9]);
    expect(book.readerPages).toEqual([7, 8, 9]);
    expect(book.sourcePageCount).toBe(3);
    expect(book.readerPageCount).toBe(3);
    expect(book.html).toContain('<section data-source-page="8" data-reader-page="8" data-page-label="٨" data-page-kind="source"></section>');
  });

  it('adds virtual reading pages to unmarked Markdown without claiming printed source pages', async () => {
    const longParagraph = Array.from({ length: 285 }, () => 'كلمة').join(' ');
    const book = await importMarkdown(`# عنوان\n\n${longParagraph}\n\nفقرة في موضع تالٍ.`, 'unmarked.md');

    expect(book.pageNumberKind).toBe('virtual');
    expect(book.sourcePages).toEqual([]);
    expect(book.sourcePageCount).toBe(0);
    expect(book.readerPages).toEqual([1, 2]);
    expect(book.passages.at(-1)?.readerPageNumber).toBe(2);
    expect(book.passages.at(-1)?.sourcePageNumber).toBeUndefined();
    expect(book.html).toContain('data-page-kind="virtual"');
    expect(book.html).not.toContain('data-source-page=');
  });
});
