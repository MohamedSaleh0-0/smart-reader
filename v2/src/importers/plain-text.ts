import { importMarkdown } from './markdown';

const PAGE_LABEL = /^\s*[\[({]?\s*(?:(?:ج|جـ|الجزء)\s*:?\s*([\d٠-٩۰-۹]+)\s*[،,/\-–]?\s*)?(?:ص|صـ|الصفحة)\s*:?\s*([\d٠-٩۰-۹]+)\s*[\])}]?\s*$/;
const MARKDOWN_SPECIAL = /([\\`*_[\]{}()#+.!|>~-])/g;
const FOOTNOTE_SEPARATOR = /^[ـ_\-–—*=]{5,}$/;
const FOOTNOTE_LINE = /^[([]\s*([\d٠-٩۰-۹]+)\s*[)\]]\s*[-–:]?\s*(.+)$/;

function toWesternDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) >= 0x06f0 ? digit.charCodeAt(0) - 0x06f0 : digit.charCodeAt(0) - 0x0660));
}

function escapePlainLine(line: string): string {
  return line.replace(MARKDOWN_SPECIAL, '\\$1');
}

/** Import UTF-8/plain text while retaining paragraph boundaries and the original page-label convention. */
export async function importPlainText(text: string, sourceName: string, sourcePath = sourceName) {
  const source = text.replace(/^\uFEFF/, '').replace(/\0/g, '').replace(/\r\n?/g, '\n');
  if (!source.trim()) throw new Error('الملف النصي فارغ ولا يحتوي على مقاطع للقراءة.');

  let volumeLabels = 0;
  const lines = source.split('\n');
  const markdownMode = (source.match(/^#{1,6}\s/mg) ?? []).length >= 2;
  if (markdownMode) {
    const markdown = lines.map((line) => {
      const page = PAGE_LABEL.exec(line);
      if (page && !page[1]) return `<!-- sr:page ${toWesternDigits(page[2])} -->`;
      if (page?.[1]) volumeLabels += 1;
      return line;
    }).join('\n');
    const book = await importMarkdown(markdown, sourceName, { sourcePath });
    if (volumeLabels) book.warnings.push('حُفظت علامات الجزء والصفحة كنص؛ الإحالة الحالية لا تخزن رقم الجزء.');
    return book;
  }

  const pages: { pageNumber?: string; lines: string[] }[] = [{ lines: [] }];
  for (const line of lines) {
    const page = PAGE_LABEL.exec(line);
    if (page && !page[1]) pages.push({ pageNumber: toWesternDigits(page[2]), lines: [] });
    else {
      if (page?.[1]) volumeLabels += 1;
      pages[pages.length - 1].lines.push(line);
    }
  }

  const markdown = pages.map((page, pageIndex) => {
    const output: string[] = [];
    if (page.pageNumber) output.push(`<!-- sr:page ${page.pageNumber} -->`, '');
    const separatorIndex = page.lines.findIndex((line) => FOOTNOTE_SEPARATOR.test(line.trim()));
    const textLines = separatorIndex < 0 ? page.lines : page.lines.slice(0, separatorIndex);
    const noteLines = separatorIndex < 0 ? [] : page.lines.slice(separatorIndex + 1);
    const notes = new Map<string, { id: string; text: string }>();
    let lastNote: { id: string; text: string } | undefined;
    for (const line of noteLines) {
      const note = FOOTNOTE_LINE.exec(line.trim());
      if (note) {
        const number = toWesternDigits(note[1]);
        const entry = { id: `txt-${pageIndex + 1}-${number}`, text: note[2] };
        notes.set(number, entry);
        lastNote = entry;
      } else if (lastNote && line.trim()) {
        lastNote.text += ` ${line.trim()}`;
      }
    }

    const references = new Map<string, string>();
    const markedLines = textLines.map((line) => line.replace(/\(([٠-٩۰-۹\d]+)\)/g, (match, rawNumber: string) => {
      const entry = notes.get(toWesternDigits(rawNumber));
      if (!entry) return match;
      const placeholder = `SRFOOTNOTE${references.size}END`;
      references.set(placeholder, `[^${entry.id}]`);
      return placeholder;
    }));
    // Replace each temporary token after escaping the original text so TXT markup stays literal.
    output.push(...markedLines.map((line) => escapePlainLine(line).replace(/SRFOOTNOTE\d+END/g, (token) => references.get(token) ?? token)));
    if (notes.size) {
      output.push('', ...[...notes.values()].map((entry) => `[^${entry.id}]: ${escapePlainLine(entry.text.replace(/\n/g, ' '))}`));
    }
    return output.join('\n');
  }).join('\n\n');
  const book = await importMarkdown(markdown, sourceName, { sourcePath });
  if (volumeLabels) book.warnings.push('حُفظت علامات الجزء والصفحة كنص؛ الإحالة الحالية لا تخزن رقم الجزء.');
  return book;
}
