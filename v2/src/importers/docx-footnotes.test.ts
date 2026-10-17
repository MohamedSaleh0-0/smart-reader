import { describe, expect, it } from 'vitest';
import { localizeDocxFootnoteLinks } from './docx-footnotes';

describe('localizeDocxFootnoteLinks', () => {
  it('uses the page-local number and target while preserving the passage reference ID', () => {
    const result = localizeDocxFootnoteLinks(
      '<sup><a href="#old-target" data-sr-footnote-id="2" id="ref-2">8</a></sup>',
      {
        bookId: 'book-1',
        pageNumber: 4,
        footnoteIdByAttribute: new Map([['2', '2']]),
        numberByFootnoteId: new Map([['2', 1]]),
      },
    );

    expect(result.markup).toMatch(/href="#sr-docx-fn-[^"]+"/);
    expect(result.markup).toContain('id="ref-2">١</a>');
    expect(result.references).toEqual([{ id: '2', referenceId: 'ref-2' }]);
    expect(result.markup).not.toContain('old-target');

    const nextPage = localizeDocxFootnoteLinks(
      '<sup><a href="#old-target" data-sr-footnote-id="2" id="ref-3">9</a></sup>',
      {
        bookId: 'book-1',
        pageNumber: 5,
        footnoteIdByAttribute: new Map([['2', '2']]),
        numberByFootnoteId: new Map([['2', 1]]),
      },
    );
    expect(nextPage.markup).toContain('id="ref-3">١</a>');
    expect(nextPage.markup.match(/href="([^"]+)"/)?.[1]).not.toBe(result.markup.match(/href="([^"]+)"/)?.[1]);
  });

  it('does not rewrite a footnote link if its source ID is not in the parsed definitions', () => {
    const markup = '<a href="#old-target" data-sr-footnote-id="missing" id="ref-1">1</a>';
    const result = localizeDocxFootnoteLinks(markup, {
      bookId: 'book-1',
      pageNumber: 1,
      footnoteIdByAttribute: new Map(),
      numberByFootnoteId: new Map(),
    });

    expect(result.markup).toBe(markup);
    expect(result.references).toEqual([]);
  });
});
