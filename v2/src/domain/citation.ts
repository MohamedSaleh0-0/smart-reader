import { defaultStudySettings } from './study';
import type { BookRecord, Passage, StudySettings } from './types';

const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

export function toArabicDigits(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => arabicDigits[Number(digit)]);
}

export function formatBibliographicCitation(
  book: Pick<BookRecord, 'title' | 'author' | 'pageNumberKind'>,
  passage: Passage,
  preferences: Partial<StudySettings> = {},
): string {
  const settings = { ...defaultStudySettings, ...preferences };
  const template = settings.citationTemplate.trim() || defaultStudySettings.citationTemplate;
  const sourceStart = passage.sourcePageNumber ?? passage.readerPageNumber;
  const sourceEnd = passage.sourcePageEndNumber ?? sourceStart;
  const readerEnd = passage.readerPageEndNumber ?? passage.readerPageNumber;
  const sourceRange = sourceStart === sourceEnd ? toArabicDigits(sourceStart) : `${toArabicDigits(sourceStart)}–${toArabicDigits(sourceEnd)}`;
  const readerRange = passage.readerPageNumber === readerEnd
    ? toArabicDigits(passage.readerPageNumber)
    : `${toArabicDigits(passage.readerPageNumber)}–${toArabicDigits(readerEnd)}`;
  const page = book.pageNumberKind === 'source'
    ? sourceRange
    : `موضع قراءة داخلي ${readerRange} (لا يطابق صفحة مطبوعة)`;
  const authorInTemplate = template.includes('{author}');
  const title = settings.includeAuthor && book.author && !authorInTemplate
    ? `${book.title} لـ${book.author}`
    : book.title;

  return template
    .replaceAll('{title}', title)
    .replaceAll('{page}', page)
    .replaceAll('{author}', book.author ?? '')
    .replace(/\s+([،؛,:])/g, '$1')
    .replace(/([،؛,:])\s*([،؛,:])/g, '$1')
    .replace(/،\s*(?=[([])/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function formatPassageCitation(
  book: Pick<BookRecord, 'title' | 'author' | 'pageNumberKind'>,
  passage: Passage,
  quote = passage.text,
  preferences: Partial<StudySettings> = {},
  footnotes: readonly string[] = [],
): string {
  const citation = formatBibliographicCitation(book, passage, preferences);
  const notes = preferences.keepFootnotes ? footnotes : [];
  return `${quote} ${citation}${notes.length ? `\n${notes.join('\n')}` : ''}`;
}

export function joinCitationItems(items: readonly string[], separator: StudySettings['collectionSeparator']): string {
  const value = separator === 'line' ? '\n────────\n' : separator === 'stars' ? '\n* * *\n' : '\n\n';
  return items.filter(Boolean).join(value);
}

export function joinCitationHtmlItems(items: readonly string[], separator: StudySettings['collectionSeparator']): string {
  const value = separator === 'line'
    ? '<p dir="rtl" style="text-align:center;color:#999">────────</p>'
    : separator === 'stars'
      ? '<p dir="rtl" style="text-align:center">* * *</p>'
      : '';
  return items.filter(Boolean).join(value);
}
