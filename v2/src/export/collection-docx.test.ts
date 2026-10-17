import { describe, expect, it } from 'vitest';
import { buildCollectionDocx } from './collection-docx';

function readStoredZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const entries = new Map<string, string>();
  let offset = 0;
  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    entries.set(name, decoder.decode(bytes.subarray(dataStart, dataStart + size)));
    offset = dataStart + size;
  }
  return entries;
}

const input = {
  bookTitle: 'كتاب الاختبار',
  author: 'مؤلف',
  headings: [
    { id: 'ch1', level: 1, title: 'الفصل الأول', readerPageNumber: 1 },
    { id: 'sec1', level: 2, title: 'المبحث الأول', readerPageNumber: 1 },
    { id: 'ch2', level: 1, title: 'الفصل الثاني', readerPageNumber: 2 },
  ],
  items: [
    { passageId: 'p1', quote: 'اقتباس <أول>', citation: '[كتاب الاختبار (ص: ١)]', footnotes: ['حاشية أولى'], readerPageNumber: 1, headingContext: 'المبحث الأول' },
    { passageId: 'p2', quote: 'اقتباس ثان', citation: '[كتاب الاختبار (ص: ٢)]', footnotes: [], readerPageNumber: 2, headingContext: 'الفصل الثاني' },
  ],
  restartNumberingPerChapter: true,
  createdAt: new Date('2026-10-12T12:00:00Z'),
};

describe('collection Word export', () => {
  it('builds an RTL Word package with linked hierarchy, ordered quotes, citations, and footnotes', () => {
    const entries = readStoredZip(buildCollectionDocx(input));
    const document = entries.get('word/document.xml') ?? '';
    const numbering = entries.get('word/numbering.xml') ?? '';

    expect(entries.has('[Content_Types].xml')).toBe(true);
    expect(entries.has('word/styles.xml')).toBe(true);
    expect(entries.has('word/footer1.xml')).toBe(true);
    expect(document).toContain('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"');
    expect(document).toContain('w:anchor="_Toc1"');
    expect(document).toContain('w:pStyle w:val="Heading1"');
    expect(document).toContain('الفصل الأول');
    expect(document).toContain('المبحث الأول');
    expect(document).toContain('اقتباس &lt;أول&gt;');
    expect(document).toContain('[كتاب الاختبار (ص: ١)]');
    expect(document).toContain('حاشية أولى');
    expect(document.indexOf('اقتباس &lt;أول&gt;')).toBeLessThan(document.indexOf('اقتباس ثان'));
    expect(document.match(/<w:numId/g)).toHaveLength(2);
    expect(numbering).toContain('<w:num w:numId="1">');
    expect(numbering).toContain('<w:num w:numId="2">');
    expect(document).toContain('عدد الاقتباسات: ٢');
  });

  it('shares one Word numbering sequence when chapter restarts are disabled', () => {
    const entries = readStoredZip(buildCollectionDocx({ ...input, restartNumberingPerChapter: false }));
    const document = entries.get('word/document.xml') ?? '';
    const numbering = entries.get('word/numbering.xml') ?? '';
    expect(document.match(/<w:numId/g)).toHaveLength(2);
    expect(document.match(/w:numId w:val="1"/g)).toHaveLength(2);
    expect(numbering).toContain('<w:num w:numId="1">');
    expect(numbering).not.toContain('<w:num w:numId="2">');
  });

  it('supports custom category groups, a tailored cover title, and highlight notes', () => {
    const entries = readStoredZip(buildCollectionDocx({
      ...input,
      coverTitle: 'التظليلات المصنفة من «كتاب الاختبار»',
      items: [
        { ...input.items[0], quote: 'تظليل أول', groupKey: 'cat-a', groupTitle: 'للمراجعة', note: 'تعليق على التظليل' },
        { ...input.items[1], quote: 'تظليل ثان', groupKey: 'cat-b', groupTitle: 'للحفظ' },
      ],
    }));
    const document = entries.get('word/document.xml') ?? '';

    expect(document).toContain('التظليلات المصنفة من «كتاب الاختبار»');
    expect(document).toContain('للمراجعة');
    expect(document).toContain('للحفظ');
    expect(document).toContain('تعليق على التظليل');
    expect(document.indexOf('للمراجعة')).toBeLessThan(document.indexOf('للحفظ'));
  });

  it('places stable bookmarks around notebook quotes so edited Word notes can be matched on import', () => {
    const entries = readStoredZip(buildCollectionDocx({
      ...input,
      items: [{ ...input.items[0], note: 'تعليق: تعليق قابل للتحديث', noteBookmarkName: 'nb_passage_1_1' }],
    }));
    const document = entries.get('word/document.xml') ?? '';

    expect(document).toContain('<w:bookmarkStart w:id="3" w:name="nb_passage_1_1"/>');
    expect(document).toContain('تعليق: تعليق قابل للتحديث');
    expect(document).toContain('<w:bookmarkEnd w:id="3"/>');
  });

  it('preserves sanitized notebook note formatting in Word runs and separate paragraphs', () => {
    const entries = readStoredZip(buildCollectionDocx({
      ...input,
      items: [{ ...input.items[0], note: 'تعليق: bold italic red', noteHtml: '<p><b>bold</b> <i>italic</i> <span style="color: rgb(255, 0, 0);">red</span></p><ul><li>first</li><li><u>second</u></li></ul>', noteBookmarkName: 'nb_passage_1_1' }],
    }));
    const document = entries.get('word/document.xml') ?? '';
    expect(document).toContain('<w:b/><w:bCs/>');
    expect(document).toContain('<w:i/><w:iCs/>');
    expect(document).toContain('<w:color w:val="FF0000"/>');
    expect(document).toContain('• first');
    expect(document).toContain('<w:u w:val="single"/>');
    expect(document).toContain('تعليق: ');
    expect(document.indexOf('first')).toBeLessThan(document.indexOf('second'));
    expect(document).toContain('w:name="nb_passage_1_1"');
  });
});
