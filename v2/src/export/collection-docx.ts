import type { StudySettings } from '../domain/types';

export type CollectionDocxHeading = {
  id: string;
  level: number;
  title: string;
  readerPageNumber: number;
};

export type CollectionDocxItem = {
  passageId: string;
  quote: string;
  citation: string;
  footnotes?: string[];
  note?: string;
  /** Sanitized rich markup for the note body; the label remains in `note`. */
  noteHtml?: string;
  readerPageNumber: number;
  headingContext?: string;
  groupKey?: string;
  groupTitle?: string;
  groupSectionKey?: string;
  groupSectionTitle?: string;
  noteBookmarkName?: string;
};

export type CollectionDocxInput = {
  bookTitle: string;
  author?: string;
  headings: CollectionDocxHeading[];
  items: CollectionDocxItem[];
  restartNumberingPerChapter: StudySettings['restartWordNumberingPerChapter'];
  coverTitle?: string;
  createdAt?: Date;
};

type QuoteGroup = { key: string; title: string; sections: { key: string; title: string; items: CollectionDocxItem[] }[] };
type ZipEntry = { name: string; data: string };

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const FONT = 'Traditional Arabic';

function xml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character] ?? character);
}

function run(value: string, options: { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; vertical?: 'superscript' | 'subscript'; color?: string; background?: string; size?: number } = {}) {
  const properties = [
    `<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>`,
    options.bold ? '<w:b/><w:bCs/>' : '',
    options.italic ? '<w:i/><w:iCs/>' : '',
    options.underline ? '<w:u w:val="single"/>' : '',
    options.strike ? '<w:strike/>' : '',
    options.vertical ? `<w:vertAlign w:val="${options.vertical}"/>` : '',
    options.color ? `<w:color w:val="${options.color}"/>` : '',
    options.background ? `<w:shd w:val="clear" w:color="auto" w:fill="${options.background}"/>` : '',
    options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : '',
    '<w:rtl/>',
  ].join('');
  const content = value.split('\n').map((part, index) => `${index ? '<w:br/>' : ''}<w:t xml:space="preserve">${xml(part)}</w:t>`).join('');
  return `<w:r><w:rPr>${properties}</w:rPr>${content}</w:r>`;
}

type RichNoteStyle = { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; vertical?: 'superscript' | 'subscript'; color?: string; background?: string };
type RichNoteRun = { text: string; style: RichNoteStyle };

function htmlColorToHex(value: string): string | undefined {
  const color = value.trim().toLowerCase();
  const names: Record<string, string> = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', orange: 'FFA500', purple: '800080', pink: 'FFC0CB', gray: '808080', grey: '808080', navy: '000080', teal: '008080', maroon: '800000', olive: '808000', lime: '00FF00', aqua: '00FFFF', fuchsia: 'FF00FF', brown: 'A52A2A' };
  if (names[color]) return names[color];
  const hex = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  if (hex) return hex.length === 3 ? [...hex].map((digit) => digit + digit).join('').toUpperCase() : hex.toUpperCase();
  const rgb = color.match(/^rgba?\(\s*(\d{1,3}|\d{1,3}%)\s*,\s*(\d{1,3}|\d{1,3}%)\s*,\s*(\d{1,3}|\d{1,3}%)(?:\s*,\s*[\d.]+)?\s*\)$/i);
  if (!rgb) return undefined;
  const channels = rgb.slice(1, 4).map((channel) => {
    const numeric = Number.parseFloat(channel);
    return Math.max(0, Math.min(255, Math.round(channel.endsWith('%') ? numeric * 255 / 100 : numeric)));
  });
  return channels.map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function decodeHtmlText(value: string): string {
  const codePoint = (digits: string, radix: number) => {
    const point = Number.parseInt(digits, radix);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : '\uFFFD';
  };
  return value
    .replace(/&#x([\da-f]+);/gi, (_, digits: string) => codePoint(digits, 16))
    .replace(/&#(\d+);/g, (_, digits: string) => codePoint(digits, 10))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

function htmlNoteParagraphs(source: string): RichNoteRun[][] {
  const paragraphs: RichNoteRun[][] = [];
  let current: RichNoteRun[] = [];
  let style: RichNoteStyle = {};
  const stack: { tag: string; previous: RichNoteStyle }[] = [];
  const flush = () => {
    if (current.length) {
      const last = current.at(-1);
      if (last) last.text = last.text.trimEnd();
      current = current.filter((item) => item.text.length > 0);
      if (current.length) paragraphs.push(current);
    }
    current = [];
  };
  const append = (text: string, runStyle: RichNoteStyle) => {
    let value = text.replace(/\s+/g, ' ');
    if (!value.trim()) {
      if (current.length && !current.at(-1)?.text.endsWith(' ')) current.push({ text: ' ', style: runStyle });
      return;
    }
    if (!current.length) value = value.trimStart();
    const previous = current.at(-1);
    if (previous && JSON.stringify(previous.style) === JSON.stringify(runStyle)) previous.text += value;
    else current.push({ text: value, style: { ...runStyle } });
  };
  const tokens = source.match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+/g) ?? [];
  for (const token of tokens) {
    if (token.startsWith('<!--')) continue;
    if (!token.startsWith('<')) { append(decodeHtmlText(token), style); continue; }
    const match = token.match(/^<\s*(\/?)\s*([\w-]+)([^>]*)>/);
    if (!match) continue;
    const closing = Boolean(match[1]);
    const tag = match[2].toLowerCase();
    const attributes = match[3];
    const block = ['p', 'div', 'blockquote', 'pre', 'ul', 'ol', 'li'].includes(tag);
    if (tag === 'br') { flush(); continue; }
    if (closing) {
      if (block) flush();
      const stackIndex = stack.map((entry) => entry.tag).lastIndexOf(tag);
      if (stackIndex >= 0) {
        style = stack[stackIndex].previous;
        stack.splice(stackIndex);
      }
      continue;
    }
    if (block) flush();
    if (tag === 'li') append('• ', {});
    const previous = style;
    const next = { ...style };
    if (tag === 'b' || tag === 'strong') next.bold = true;
    if (tag === 'i' || tag === 'em') next.italic = true;
    if (tag === 'u') next.underline = true;
    if (tag === 's' || tag === 'strike' || tag === 'del') next.strike = true;
    if (tag === 'sup') next.vertical = 'superscript';
    if (tag === 'sub') next.vertical = 'subscript';
    if (tag === 'mark') next.background = 'FFE066';
    const styleText = attributes.match(/\bstyle\s*=\s*(["'])(.*?)\1/i)?.[2] ?? '';
    const color = styleText.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1];
    const background = styleText.match(/(?:^|;)\s*background-color\s*:\s*([^;]+)/i)?.[1];
    if (color) next.color = htmlColorToHex(color);
    if (background) next.background = htmlColorToHex(background);
    stack.push({ tag, previous });
    style = next;
  }
  flush();
  return paragraphs;
}

function richNoteParagraphXml(runs: readonly RichNoteRun[], label = ''): string {
  const prefix = label ? run(label, { bold: true, color: '555555', size: 26 }) : '';
  return paragraph(prefix + runs.map((item) => run(item.text, { ...item.style, size: 26 })).join(''), { indent: 567, after: 40 });
}

function paragraph(runs: string, options: { style?: string; numId?: number; center?: boolean; after?: number; indent?: number; keepNext?: boolean } = {}) {
  const properties = [
    options.style ? `<w:pStyle w:val="${options.style}"/>` : '',
    options.numId ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${options.numId}"/></w:numPr>` : '',
    '<w:bidi/>',
    options.center ? '<w:jc w:val="center"/>' : '',
    options.after !== undefined ? `<w:spacing w:after="${options.after}"/>` : '',
    options.indent !== undefined ? `<w:ind w:left="${options.indent}"/>` : '',
    options.keepNext ? '<w:keepNext/>' : '',
  ].join('');
  return `<w:p><w:pPr>${properties}</w:pPr>${runs}</w:p>`;
}

function passageGroup(input: CollectionDocxInput, item: CollectionDocxItem) {
  if (item.groupKey && item.groupTitle) {
    const section = item.groupSectionTitle?.trim() || item.headingContext?.trim();
    return {
      rootKey: `custom:${item.groupKey}`,
      root: item.groupTitle,
      sectionKey: item.groupSectionKey ? `custom:${item.groupKey}:${item.groupSectionKey}` : section ? `custom:${item.groupKey}:${section}` : '',
      section: section ?? '',
    };
  }
  const context = item.headingContext?.trim();
  if (!context) return { rootKey: 'book', root: input.bookTitle, sectionKey: '', section: '' };

  let contextIndex = -1;
  for (let index = 0; index < input.headings.length; index += 1) {
    const heading = input.headings[index];
    if (heading.title.trim() === context && heading.readerPageNumber <= item.readerPageNumber) contextIndex = index;
  }
  if (contextIndex < 0) return { rootKey: `context:${context}`, root: context, sectionKey: '', section: '' };

  const current = input.headings[contextIndex];
  let rootIndex = current.level === 1 ? contextIndex : -1;
  if (rootIndex < 0) {
    for (let index = contextIndex - 1; index >= 0; index -= 1) {
      if (input.headings[index].level === 1) { rootIndex = index; break; }
    }
  }
  const rootHeading = rootIndex >= 0 ? input.headings[rootIndex] : undefined;
  const root = rootHeading?.title ?? input.bookTitle;
  const sectionHeading = current.level >= 2
    ? current
    : undefined;
  return {
    rootKey: rootHeading?.id ?? (rootHeading ? `${rootHeading.title}:${rootHeading.readerPageNumber}` : 'book'),
    root,
    sectionKey: sectionHeading?.id ?? '',
    section: sectionHeading?.title ?? '',
  };
}

function groupItems(input: CollectionDocxInput): QuoteGroup[] {
  const groups: QuoteGroup[] = [];
  for (const item of input.items) {
    const placement = passageGroup(input, item);
    let group = groups.find((candidate) => candidate.key === placement.rootKey);
    if (!group) {
      group = { key: placement.rootKey, title: placement.root, sections: [] };
      groups.push(group);
    }
    let section = group.sections.find((candidate) => candidate.key === placement.sectionKey);
    if (!section) {
      section = { key: placement.sectionKey, title: placement.section, items: [] };
      group.sections.push(section);
    }
    section.items.push(item);
  }
  return groups;
}

function quoteHeading(title: string, style: string, bookmark: number) {
  const name = `_Toc${bookmark}`;
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/><w:bidi/></w:pPr><w:bookmarkStart w:id="${bookmark}" w:name="${name}"/>${run(title)}<w:bookmarkEnd w:id="${bookmark}"/></w:p>`;
}

function bookmarkParagraph(value: string, name: string, id: number) {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(name)) return value;
  return value
    .replace('</w:pPr>', `</w:pPr><w:bookmarkStart w:id="${id}" w:name="${xml(name)}"/>`)
    .replace(/<\/w:p>$/, `<w:bookmarkEnd w:id="${id}"/></w:p>`);
}

function documentXml(input: CollectionDocxInput, groups: QuoteGroup[], createdAt: Date) {
  let bookmark = 0;
  let quoteCount = 0;
  let numbering = 1;
  const numIds = new Map<string, number>();
  const toc: { title: string; level: 1 | 2; bookmark: number }[] = [];
  const content: string[] = [];

  groups.forEach((group) => {
    const groupNumId = input.restartNumberingPerChapter ? numbering++ : 1;
    const rootBookmark = ++bookmark;
    toc.push({ title: group.title, level: 1, bookmark: rootBookmark });
    content.push(quoteHeading(group.title, 'Heading1', rootBookmark));
    group.sections.forEach((section) => {
      if (section.title) {
        const sectionBookmark = ++bookmark;
        toc.push({ title: section.title, level: 2, bookmark: sectionBookmark });
        content.push(quoteHeading(section.title, 'Heading2', sectionBookmark));
      }
      for (const item of section.items) {
        quoteCount += 1;
        const numId = input.restartNumberingPerChapter ? groupNumId : 1;
        numIds.set(String(numId), numId);
        let quoteParagraph = paragraph(
          `${run(item.quote)}${run(` ${item.citation}`, { color: '2B5D86', size: 28 })}`,
          { numId, after: 80 },
        );
        if (item.noteBookmarkName) quoteParagraph = bookmarkParagraph(quoteParagraph, item.noteBookmarkName, ++bookmark);
        content.push(quoteParagraph);
        if (item.note?.trim()) {
          if (item.noteHtml?.trim()) {
            const label = item.note.match(/^\s*تعليق:\s*/)?.[0] ?? '';
            const richParagraphs = htmlNoteParagraphs(item.noteHtml);
            if (richParagraphs.length) {
              content.push(richNoteParagraphXml(richParagraphs[0], label));
              richParagraphs.slice(1).forEach((runs) => content.push(richNoteParagraphXml(runs)));
            } else content.push(paragraph(run(item.note.trim(), { color: '555555', size: 26 }), { indent: 567, after: 40 }));
          } else content.push(paragraph(run(item.note.trim(), { color: '555555', size: 26 }), { indent: 567, after: 40 }));
        }
        for (const footnote of item.footnotes ?? []) {
          content.push(paragraph(run(footnote, { color: '555555', size: 24 }), { indent: 567, after: 40 }));
        }
        content.push(paragraph('', { after: 60 }));
      }
    });
  });

  const tocXml = [paragraph(run('الفهرس', { bold: true, color: '1F2D4D', size: 34 }), { center: true, after: 120 })];
  for (const entry of toc) {
    const id = `_Toc${entry.bookmark}`;
    tocXml.push(`<w:p><w:pPr><w:pStyle w:val="TOC${entry.level}"/><w:bidi/></w:pPr><w:hyperlink w:anchor="${id}" w:history="1">${run(entry.title, { bold: entry.level === 1 })}</w:hyperlink></w:p>`);
  }

  const arabicDate = `${createdAt.getDate()}/${createdAt.getMonth() + 1}/${createdAt.getFullYear()}`.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
  const cover = paragraph(run(input.coverTitle ?? `اقتباسات من «${input.bookTitle}»`, { bold: true, color: '1F2D4D', size: 48 }), { style: 'Title' })
    + paragraph(run(`من كتاب «${input.bookTitle}»${input.author ? ` — ${input.author}` : ''}`, { color: '555555', size: 28 }), { center: true, after: 40 })
    + paragraph(run(`عدد الاقتباسات: ${String(quoteCount).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])} — ${arabicDate}`, { color: '777777', size: 24 }), { center: true, after: 360 });

  const section = '<w:sectPr><w:footerReference w:type="default" r:id="rId4"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1304" w:bottom="1304" w:left="1304" w:header="709" w:footer="567"/><w:bidi/></w:sectPr>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${WORD_NS}" xmlns:r="${REL_NS}"><w:body>${cover}${tocXml.join('')}${content.join('')}${section}</w:body></w:document>`;
}

function stylesXml() {
  const fonts = `<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}" w:eastAsia="${FONT}"/>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${WORD_NS}"><w:docDefaults><w:rPrDefault><w:rPr>${fonts}<w:sz w:val="32"/><w:szCs w:val="32"/><w:lang w:val="ar-SA" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:spacing w:after="120" w:line="324" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="80"/><w:jc w:val="center"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:keepNext/><w:pageBreakBefore/><w:outlineLvl w:val="0"/></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:keepNext/><w:outlineLvl w:val="1"/></w:style><w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="TOC2"><w:name w:val="toc 2"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="440"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/></w:style></w:styles>`;
}

function numberingXml(ids: number[]) {
  const nums = [...new Set(ids)].map((id) => `<w:num w:numId="${id}"><w:abstractNumId w:val="0"/></w:num>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="${WORD_NS}"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="hindiNumbers"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="567" w:hanging="567"/></w:pPr><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/><w:b/><w:color w:val="1F2D4D"/><w:rtl/></w:rPr></w:lvl></w:abstractNum>${nums}</w:numbering>`;
}

function zipStore(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const u16 = (value: number) => [value & 0xff, (value >>> 8) & 0xff];
  const u32 = (value: number) => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
  const crc32 = (data: Uint8Array) => {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const join = (chunks: Uint8Array[]) => {
    const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
    let cursor = 0;
    for (const chunk of chunks) { result.set(chunk, cursor); cursor += chunk.length; }
    return result;
  };

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.data);
    const checksum = crc32(data);
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(checksum), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0),
    ]);
    localParts.push(local, name, data);
    const central = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(checksum), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
    ]);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralDirectory = join(centralParts);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
    ...u32(centralDirectory.length), ...u32(offset), ...u16(0),
  ]);
  return join([...localParts, centralDirectory, end]);
}

export function buildCollectionDocx(input: CollectionDocxInput): Uint8Array {
  const groups = groupItems(input);
  const createdAt = input.createdAt ?? new Date();
  const numberingCount = input.restartNumberingPerChapter ? Math.max(groups.length, 1) : 1;
  const title = input.coverTitle ?? `اقتباسات من «${input.bookTitle}»`;
  const isoDate = createdAt.toISOString().slice(0, 19) + 'Z';
  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="${WORD_NS}"><w:p><w:pPr><w:pStyle w:val="Footer"/><w:bidi/><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${run('١', { size: 24 })}<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';
  const documentRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>';
  const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="${WORD_NS}"><w:updateFields w:val="true"/></w:settings>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(title)}</dc:title><dc:creator>${xml(input.bookTitle)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${isoDate}</dcterms:created></cp:coreProperties>`;
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'docProps/core.xml', data: core },
    { name: 'word/document.xml', data: documentXml(input, groups, createdAt) },
    { name: 'word/styles.xml', data: stylesXml() },
    { name: 'word/numbering.xml', data: numberingXml(Array.from({ length: numberingCount }, (_, index) => index + 1)) },
    { name: 'word/settings.xml', data: settings },
    { name: 'word/footer1.xml', data: footer },
    { name: 'word/_rels/document.xml.rels', data: documentRels },
  ];
  return zipStore(entries);
}
