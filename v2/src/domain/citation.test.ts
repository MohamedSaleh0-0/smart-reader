import { describe, expect, it } from 'vitest';
import { formatBibliographicCitation, formatPassageCitation, joinCitationHtmlItems, joinCitationItems } from './citation';

const book = { title: 'أصول القراءة', author: 'باحث', pageNumberKind: 'source' as const };
const passage = { id: 'p-1', text: 'نص الفقرة.', readerPageNumber: 12, sourcePageNumber: 12, headingContext: 'الفصل الأول' };

describe('citation preferences', () => {
  it('uses the original default citation template without silently adding author or section title', () => {
    expect(formatBibliographicCitation(book, passage)).toBe('[أصول القراءة (ص: ١٢)]');
  });

  it('can add the author after the title when enabled', () => {
    expect(formatBibliographicCitation(book, passage, { includeAuthor: true })).toBe('[أصول القراءة لـباحث (ص: ١٢)]');
  });

  it('supports an explicit author token and removes its dangling punctuation when author is missing', () => {
    expect(formatBibliographicCitation(book, passage, { citationTemplate: '[{title}، {author} (ص: {page})]' }))
      .toBe('[أصول القراءة، باحث (ص: ١٢)]');
    expect(formatBibliographicCitation({ title: 'كتاب مجهول', pageNumberKind: 'source' }, { ...passage, sourcePageNumber: 3, readerPageNumber: 3 }, { citationTemplate: '[{title}، {author} (ص: {page})]' }))
      .toBe('[كتاب مجهول (ص: ٣)]');
  });

  it('formats passage text with its citation, and appends linked footnotes only when enabled', () => {
    expect(formatPassageCitation(book, passage, 'اقتباس محدد')).toBe('اقتباس محدد [أصول القراءة (ص: ١٢)]');
    expect(formatPassageCitation(book, passage, 'اقتباس محدد', { keepFootnotes: true }, ['نص الحاشية الأولى', 'نص الحاشية الثانية']))
      .toBe('اقتباس محدد [أصول القراءة (ص: ١٢)]\nنص الحاشية الأولى\nنص الحاشية الثانية');
  });

  it('labels generated reader positions so they cannot be mistaken for printed pages', () => {
    expect(formatBibliographicCitation(
      { title: 'مادة Markdown', pageNumberKind: 'virtual' },
      { id: 'p-4', text: 'مقطع.', readerPageNumber: 2 },
    )).toBe('[مادة Markdown (ص: موضع قراءة داخلي ٢ (لا يطابق صفحة مطبوعة))]');
  });

  it('shows the full page range for a passage split across source pages', () => {
    expect(formatBibliographicCitation(book, { ...passage, sourcePageNumber: 12, sourcePageEndNumber: 13 }))
      .toBe('[أصول القراءة (ص: ١٢–١٣)]');
    expect(formatBibliographicCitation(
      { title: 'مادة Word', pageNumberKind: 'virtual' },
      { id: 'p-5', text: 'فقرة ممتدة.', readerPageNumber: 2, readerPageEndNumber: 3 },
    )).toBe('[مادة Word (ص: موضع قراءة داخلي ٢–٣ (لا يطابق صفحة مطبوعة))]');
  });

  it('joins collected citations with the selected original separator', () => {
    expect(joinCitationItems(['الأول', 'الثاني'], 'blank')).toBe('الأول\n\nالثاني');
    expect(joinCitationItems(['الأول', 'الثاني'], 'line')).toBe('الأول\n────────\nالثاني');
    expect(joinCitationItems(['الأول', 'الثاني'], 'stars')).toBe('الأول\n* * *\nالثاني');
  });

  it('uses the matching visual separator when joining rich copied markup', () => {
    expect(joinCitationHtmlItems(['<p>one</p>', '', '<p>two</p>'], 'blank')).toBe('<p>one</p><p>two</p>');
    expect(joinCitationHtmlItems(['<p>one</p>', '<p>two</p>'], 'line')).toContain('────────');
    expect(joinCitationHtmlItems(['<p>one</p>', '<p>two</p>'], 'stars')).toContain('* * *');
  });
});
