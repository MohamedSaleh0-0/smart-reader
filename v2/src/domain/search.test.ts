import { describe, expect, it } from 'vitest';
import { normalizeArabicSearch } from './search';

describe('Arabic search normalization', () => {
  it('matches common alef forms and ignores tashkeel and tatweel', () => {
    expect(normalizeArabicSearch('إِدارةُ الـوَقْت')).toBe(normalizeArabicSearch('ادارة الوقت'));
  });
});
