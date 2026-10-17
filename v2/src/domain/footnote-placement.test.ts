import { describe, expect, it } from 'vitest';
import { placeFootnotesByReferencePage } from './footnote-placement';

describe('placeFootnotesByReferencePage', () => {
  it('orders and numbers notes by first reference on each page', () => {
    const result = placeFootnotesByReferencePage(
      ['defined-first', 'defined-second'],
      [
        { id: 'defined-second', pageKey: 1 },
        { id: 'defined-first', pageKey: 1 },
      ],
      new Map([['defined-first', 3], ['defined-second', 3]]),
    );

    expect(result.placementsByPage.get(1)).toEqual([
      { id: 'defined-second', pageKey: 1, number: 1 },
      { id: 'defined-first', pageKey: 1, number: 2 },
    ]);
    expect(result.firstReferencePageById.get('defined-first')).toBe(1);
  });

  it('places a referenced note on every reference page and keeps an orphan at its authored page', () => {
    const result = placeFootnotesByReferencePage(
      ['shared', 'orphan'],
      [
        { id: 'shared', pageKey: 4 },
        { id: 'shared', pageKey: 4 },
        { id: 'shared', pageKey: 5 },
      ],
      new Map([['shared', 3], ['orphan', 7]]),
    );

    expect(result.placementsByPage.get(4)).toEqual([{ id: 'shared', pageKey: 4, number: 1 }]);
    expect(result.placementsByPage.get(5)).toEqual([{ id: 'shared', pageKey: 5, number: 1 }]);
    expect(result.placementsByPage.get(7)).toEqual([{ id: 'orphan', pageKey: 7, number: 1 }]);
    expect(result.firstReferencePageById.get('shared')).toBe(4);
    expect(result.firstReferencePageById.has('orphan')).toBe(false);
  });
});
