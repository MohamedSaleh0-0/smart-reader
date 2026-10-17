import { describe, expect, it } from 'vitest';
import { joinPassageParts, passagePartOffset } from './passage-text';

describe('logical passage fragments', () => {
  it('joins page-separated pieces with one readable space', () => {
    expect(joinPassageParts(['بداية الفقرة ', ' تتمتها', '', 'نهايتها.']))
      .toBe('بداية الفقرة تتمتها نهايتها.');
  });

  it('maps a text offset in a later page fragment into the joined passage', () => {
    expect(passagePartOffset(['بداية', 'تتمة الفقرة'], 1, 3)).toBe(9);
  });

  it('rejects invalid fragment offsets', () => {
    expect(passagePartOffset(['جزء'], 1, 0)).toBeUndefined();
    expect(passagePartOffset(['جزء'], 0, 4)).toBeUndefined();
  });
});
