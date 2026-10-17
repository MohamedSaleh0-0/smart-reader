import { readZipArchive } from './zip-archive';
import type { BookRecord, Footnote, Passage } from '../domain/types';
import { appendPassageFragment } from '../domain/passage-fragments';
import { placeFootnotesByReferencePage } from '../domain/footnote-placement';
import { localizeDocxFootnoteLinks } from './docx-footnotes';
import { groupDocxPages, type DocxImportBlock } from './docx-pagination';

type ImportedDocx = BookRecord & { stats: { footnotes: number; images: number } };
type WordBlock = { kind: 'heading' | 'paragraph' | 'list' | 'table' | 'figure'; html: string; level?: number; listKind?: 'ol' | 'ul'; passageGroupId?: string; continuation?: boolean };
type ImportBlock = DocxImportBlock;

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const MAX_EMBEDDED_MEDIA_SIZE = 32 * 1024 * 1024;
const SAFE_IMAGE_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function hash(value: string): string {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.codePointAt(0) ?? 0;
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function arabicDigits(value: number): string {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
}

function normalizedText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

export async function readDocxDocumentXml(buffer: ArrayBuffer): Promise<string> {
  if (typeof DOMParser === 'undefined') throw new Error('استيراد Word يحتاج إلى متصفح يدعم تحليل XML.');
  const archive = await readZipArchive(buffer, 'DOCX');
  const document = await archive.text('word/document.xml');
  if (!document) throw new Error('ملف Word لا يحتوي على المستند الرئيسي.');
  return document;
}

function normalizeZipPath(path: string): string | undefined {
  const parts: string[] = [];
  for (const part of path.replaceAll('\\', '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return undefined;
      parts.pop();
    } else parts.push(part);
  }
  return parts.join('/');
}

function xmlDocument(source: string, name: string): Document {
  const parsed = new DOMParser().parseFromString(source, 'application/xml');
  if (!parsed.documentElement || parsed.querySelector('parsererror')) throw new Error(`تعذر تحليل ${name} داخل ملف Word.`);
  return parsed;
}

function wordChildren(element: Element, localName: string): Element[] {
  return Array.from(element.children).filter((child) => child.namespaceURI === WORD_NS && child.localName === localName);
}

function wordChild(element: Element | undefined | null, localName: string): Element | undefined {
  return element ? wordChildren(element, localName)[0] : undefined;
}

function wordAttribute(element: Element | undefined | null, name: string): string | undefined {
  return element?.getAttributeNS(WORD_NS, name) ?? element?.getAttribute(`w:${name}`) ?? undefined;
}

function isOn(element: Element | undefined | null): boolean {
  if (!element) return false;
  return !['0', 'false', 'off', 'none'].includes((wordAttribute(element, 'val') ?? '').toLowerCase());
}

function xmlAttribute(element: Element | undefined | null, namespace: string, name: string): string | undefined {
  return element?.getAttributeNS(namespace, name) ?? undefined;
}

function safeExternalLink(value: string | undefined): string | undefined {
  if (!value || /^(?:javascript|vbscript|data|file):/i.test(value.trim())) return undefined;
  return /^(?:https?:|mailto:|tel:)/i.test(value.trim()) ? value.trim() : undefined;
}

function resolveZipTarget(base: string, target: string): string | undefined {
  try {
    const decoded = decodeURIComponent(target.split(/[?#]/, 1)[0]);
    return normalizeZipPath(decoded.startsWith('/') ? decoded.slice(1) : `${base}/${decoded}`);
  } catch {
    return undefined;
  }
}

export async function importDocx(file: File): Promise<ImportedDocx> {
  if (typeof DOMParser === 'undefined') throw new Error('استيراد DOCX يحتاج إلى متصفح يدعم تحليل XML.');
  const archive = await readZipArchive(await file.arrayBuffer(), 'DOCX');
  const warnings = new Set<string>();
  const documentXml = await archive.text('word/document.xml');
  if (!documentXml) throw new Error('ملف Word لا يحتوي على المستند الرئيسي.');
  const document = xmlDocument(documentXml, 'المستند الرئيسي');
  const body = document.getElementsByTagNameNS(WORD_NS, 'body')[0];
  if (!body) throw new Error('ملف Word لا يحتوي على متن قابل للقراءة.');
  const coreXml = await archive.text('docProps/core.xml');
  const core = coreXml ? xmlDocument(coreXml, 'بيانات الكتاب') : undefined;
  const titleFromCore = core?.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'title')[0]?.textContent?.trim();
  const author = core?.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'creator')[0]?.textContent?.trim() || undefined;
  const language = wordAttribute(document.getElementsByTagNameNS(WORD_NS, 'lang')[0], 'val')?.split(/[-_]/)[0] || 'ar';
  const direction = ['ar', 'fa', 'ur', 'he'].includes(language.toLowerCase()) || Array.from(document.getElementsByTagNameNS(WORD_NS, 'bidi')).some(isOn) ? 'rtl' : 'ltr';
  const sourceName = file.name;
  const title = titleFromCore || sourceName.replace(/\.[^.]+$/, '');
  const bookId = `book-${hash(`${title}\n${sourceName}\n${documentXml}`)}`;

  const relationshipsXml = await archive.text('word/_rels/document.xml.rels');
  const relationships = new Map<string, { target: string; external: boolean; type: string }>();
  if (relationshipsXml) {
    const relDoc = xmlDocument(relationshipsXml, 'روابط المستند');
    for (const relation of Array.from(relDoc.getElementsByTagName('*')).filter((element) => element.localName === 'Relationship')) {
      const id = relation.getAttribute('Id');
      const target = relation.getAttribute('Target');
      if (id && target) relationships.set(id, { target, external: relation.getAttribute('TargetMode') === 'External', type: relation.getAttribute('Type') ?? '' });
    }
  }
  const mediaByRelation = new Map<string, string>();
  const documentBase = 'word';
  let embeddedMediaBytes = 0;
  for (const [id, relation] of relationships) {
    if (!relation.type.endsWith('/image') || relation.external) continue;
    const path = resolveZipTarget(documentBase, relation.target);
    if (!path) { warnings.add('تجاهل القارئ صورة ذات مسار غير صالح داخل ملف Word.'); continue; }
    const bytes = await archive.read(path);
    if (!bytes) { warnings.add('تعذر العثور على صورة مضمّنة في ملف Word.'); continue; }
    embeddedMediaBytes += bytes.byteLength;
    if (embeddedMediaBytes > MAX_EMBEDDED_MEDIA_SIZE) {
      warnings.add('تجاوزت الصور المضمّنة حد التخزين المحلي الآمن؛ بعض الصور الكبيرة تُركت خارج النسخة المستوردة.');
      continue;
    }
    const extension = path.split('.').at(-1)?.toLowerCase() ?? '';
    const mime = SAFE_IMAGE_MIME[extension];
    if (!mime) { warnings.add('صيغة صورة داخل ملف Word غير مدعومة؛ بقي نصها البديل إن توفر.'); continue; }
    mediaByRelation.set(id, `data:${mime};base64,${base64(bytes)}`);
  }

  const styles = new Map<string, { name: string; level?: number }>();
  const stylesXml = await archive.text('word/styles.xml');
  if (stylesXml) {
    const styleDocument = xmlDocument(stylesXml, 'أنماط المستند');
    for (const style of Array.from(styleDocument.getElementsByTagNameNS(WORD_NS, 'style'))) {
      const id = wordAttribute(style, 'styleId');
      if (!id) continue;
      const name = (wordAttribute(wordChild(style, 'name'), 'val') ?? '').trim().toLocaleLowerCase();
      const outline = wordChild(wordChild(style, 'pPr'), 'outlineLvl');
      const headingMatch = name.match(/^(?:heading|العنوان|عنوان)\s*(\d)$/);
      const builtInMatch = id.match(/^heading([1-6])$/i);
      const level = headingMatch ? Number(headingMatch[1]) : builtInMatch ? Number(builtInMatch[1]) : name === 'title' ? 0 : outline ? Number(wordAttribute(outline, 'val')) + 1 : undefined;
      styles.set(id, { name, level });
    }
  }

  const abstractListKind = new Map<string, 'ol' | 'ul'>();
  const listKindByNumberingId = new Map<string, 'ol' | 'ul'>();
  const numberingXml = await archive.text('word/numbering.xml');
  if (numberingXml) {
    const numberingDocument = xmlDocument(numberingXml, 'ترقيم القوائم');
    for (const abstract of Array.from(numberingDocument.getElementsByTagNameNS(WORD_NS, 'abstractNum'))) {
      const id = wordAttribute(abstract, 'abstractNumId');
      const level = Array.from(abstract.getElementsByTagNameNS(WORD_NS, 'lvl')).find((element) => wordAttribute(element, 'ilvl') === '0');
      const format = wordAttribute(wordChild(level, 'numFmt'), 'val');
      if (id) abstractListKind.set(id, format === 'bullet' ? 'ul' : 'ol');
    }
    for (const number of Array.from(numberingDocument.getElementsByTagNameNS(WORD_NS, 'num'))) {
      const id = wordAttribute(number, 'numId');
      const abstractId = wordAttribute(wordChild(number, 'abstractNumId'), 'val');
      const kind = abstractId ? abstractListKind.get(abstractId) : undefined;
      if (id && kind) listKindByNumberingId.set(id, kind);
    }
  }

  const footnoteTexts = new Map<string, string>();
  const footnotesXml = await archive.text('word/footnotes.xml');
  if (footnotesXml) {
    const footnoteDocument = xmlDocument(footnotesXml, 'الحواشي');
    for (const note of Array.from(footnoteDocument.getElementsByTagNameNS(WORD_NS, 'footnote'))) {
      const id = wordAttribute(note, 'id');
      const type = wordAttribute(note, 'type');
      if (!id || type === 'separator' || ['continuationSeparator', 'continuation-separator'].includes(type ?? '')) continue;
      footnoteTexts.set(id, '');
    }
  }

  const blocks: ImportBlock[] = [];
  const noteRefCounts = new Map<string, number>();
  let imageCount = 0;
  let logicalPassageOrdinal = 0;

  function paragraphHtml(paragraph: Element, isFootnote = false): { html: string; breaks: { at: number; hard: boolean }[] } {
    let html = '';
    const breaks: { at: number; hard: boolean }[] = [];
    const visit = (element: Element): void => {
      for (const child of Array.from(element.children)) {
        if (child.namespaceURI !== WORD_NS) continue;
        const local = child.localName;
        if (local === 'r') {
          const runProperties = wordChild(child, 'rPr');
          const boldElement = wordChild(runProperties, 'b');
          const italicElement = wordChild(runProperties, 'i');
          const underlineElement = wordChild(runProperties, 'u');
          const vertical = wordAttribute(wordChild(runProperties, 'vertAlign'), 'val');
          const bold = Boolean(boldElement) && !['0', 'false', 'off'].includes((wordAttribute(boldElement, 'val') ?? '').toLowerCase());
          const italic = Boolean(italicElement) && !['0', 'false', 'off'].includes((wordAttribute(italicElement, 'val') ?? '').toLowerCase());
          for (const content of Array.from(child.children)) {
            if (content.namespaceURI !== WORD_NS) continue;
            if (content.localName === 't') {
              let text = escapeHtml(content.textContent ?? '');
              if (bold) text = `<strong>${text}</strong>`;
              if (italic) text = `<em>${text}</em>`;
              if (wordAttribute(underlineElement, 'val') !== 'none' && underlineElement) text = `<u>${text}</u>`;
              if (vertical === 'superscript') text = `<sup>${text}</sup>`;
              if (vertical === 'subscript') text = `<sub>${text}</sub>`;
              html += text;
            } else if (content.localName === 'tab') html += '　';
            else if (content.localName === 'br') {
              const hard = wordAttribute(content, 'type') === 'page';
              if (hard && !isFootnote) breaks.push({ at: html.length, hard: true });
              else html += '<br>';
            } else if (content.localName === 'lastRenderedPageBreak' && !isFootnote) breaks.push({ at: html.length, hard: false });
            else if (content.localName === 'footnoteReference' && !isFootnote) {
              const id = wordAttribute(content, 'id');
              if (!id || !footnoteTexts.has(id)) { warnings.add('وجد المستند إحالة إلى حاشية لا يحتوي ملف Word على نصها.'); continue; }
              const count = (noteRefCounts.get(id) ?? 0) + 1;
              noteRefCounts.set(id, count);
              html += `<sup class="footnote-ref"><a href="#sr-docx-fn-${hash(`${bookId}:${id}`)}" data-sr-footnote-id="${escapeHtml(id)}" id="sr-docx-ref-${hash(`${bookId}:${id}:${count}`)}">${arabicDigits(count)}</a></sup>`;
            } else if (content.localName === 'drawing') {
              const docProperties = content.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'docPr')[0];
              const pictureProperties = content.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'cNvPr')[0];
              const blip = content.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'blip')[0];
              const relationId = blip?.getAttributeNS(REL_NS, 'embed');
              const source = relationId ? mediaByRelation.get(relationId) : undefined;
              const alt = docProperties?.getAttribute('descr') || pictureProperties?.getAttribute('descr') || docProperties?.getAttribute('title') || '';
              if (source) { html += `<img src="${source}" alt="${escapeHtml(alt)}">`; imageCount += 1; }
              else { if (alt) html += `<span>${escapeHtml(alt)}</span>`; warnings.add('لم يتمكن القارئ من عرض صورة في ملف Word؛ احتفظ بنصها البديل إن توفر.'); }
            }
          }
        } else if (local === 'hyperlink') {
          const id = xmlAttribute(child, REL_NS, 'id');
          const relation = id ? relationships.get(id) : undefined;
          let inner = '';
          const previous = html;
          html = '';
          visit(child);
          inner = html;
          html = previous + (relation?.external && safeExternalLink(relation.target) ? `<a href="${escapeHtml(relation.target)}">${inner}</a>` : inner);
        } else if (['ins', 'smartTag', 'fldSimple', 'sdt', 'sdtContent', 'customXml', 'proofErr'].includes(local)) visit(child);
      }
    };
    visit(paragraph);
    return { html: html.replace(/<\/strong><strong>/g, ''), breaks };
  }

  function emitParagraph(paragraph: Element, isFootnote = false): void {
    const properties = wordChild(paragraph, 'pPr');
    const styleId = wordAttribute(wordChild(properties, 'pStyle'), 'val');
    const style = styleId ? styles.get(styleId) : undefined;
    const outline = wordChild(properties, 'outlineLvl');
    const level = style?.level ?? (outline ? Number(wordAttribute(outline, 'val')) + 1 : undefined);
    const listProperties = wordChild(properties, 'numPr');
    const styleIsList = Boolean(style && /list|قائمة/.test(style.name));
    const numberingId = wordAttribute(wordChild(listProperties, 'numId'), 'val');
    const isList = Boolean(listProperties || styleIsList);
    const listKind = (numberingId ? listKindByNumberingId.get(numberingId) : undefined) ?? (styleIsList && /bullet|نقط/.test(style?.name ?? '') ? 'ul' : 'ol');
    const pageBreakBefore = isOn(wordChild(properties, 'pageBreakBefore'));
    if (pageBreakBefore && !isFootnote && blocks.some((block) => block.kind !== 'break')) blocks.push({ kind: 'break', hard: true });
    const rendered = paragraphHtml(paragraph, isFootnote);
    const useBreaks = rendered.breaks;
    const segments: string[] = [];
    let cursor = 0;
    for (const event of useBreaks) {
      segments.push(rendered.html.slice(cursor, event.at));
      cursor = event.at;
    }
    segments.push(rendered.html.slice(cursor));
    if (isFootnote) {
      return;
    }
    const kind = level !== undefined && level > 0 && level <= 6 ? 'heading' : isList ? 'list' : 'paragraph';
    const passageGroupId = kind === 'heading' ? undefined : `docx-passage-${++logicalPassageOrdinal}`;
    for (const [index, segment] of segments.entries()) {
      const html = segment.trim();
      const plain = normalizedText(html.replace(/<[^>]+>/g, ''));
      if (plain) blocks.push({ kind, html, ...(kind === 'heading' ? { level } : {}), ...(kind === 'list' ? { listKind } : {}), ...(passageGroupId ? { passageGroupId, continuation: index > 0 } : {}) });
      else if (html.includes('<img')) blocks.push({ kind: 'figure', html: `<figure>${html}</figure>` });
      if (index < useBreaks.length) blocks.push({ kind: 'break', hard: useBreaks[index].hard });
    }
  }

  function renderTable(table: Element): string {
    const rows = wordChildren(table, 'tr').map((row) => {
      const isHeader = isOn(wordChild(wordChild(row, 'trPr'), 'tblHeader'));
      const cellTag = isHeader ? 'th' : 'td';
      const cells = wordChildren(row, 'tc').map((cell) => {
        const paragraphs = wordChildren(cell, 'p').map((paragraph) => paragraphHtml(paragraph, true).html.trim()).filter(Boolean);
        const content = paragraphs.length ? paragraphs.join('<br>') : '';
        return `<${cellTag}>${content}</${cellTag}>`;
      });
      return cells.length ? `<tr>${cells.join('')}</tr>` : '';
    }).filter(Boolean);
    return rows.length ? `<table><tbody>${rows.join('')}</tbody></table>` : '';
  }

  // Parse footnote paragraphs after the run converter is ready, keeping note definitions distinct from body text.
  if (footnotesXml) {
    const noteDocument = xmlDocument(footnotesXml, 'الحواشي');
    for (const note of Array.from(noteDocument.getElementsByTagNameNS(WORD_NS, 'footnote'))) {
      const id = wordAttribute(note, 'id');
      const type = wordAttribute(note, 'type');
      if (!id || type === 'separator' || ['continuationSeparator', 'continuation-separator'].includes(type ?? '')) continue;
      const text = wordChildren(note, 'p').map((paragraph) => paragraphHtml(paragraph, true).html).join(' ').trim();
      footnoteTexts.set(id, text);
    }
  }

  for (const child of Array.from(body.children)) {
    if (child.namespaceURI !== WORD_NS) continue;
    if (child.localName === 'p') emitParagraph(child);
    else if (child.localName === 'tbl') {
      const table = renderTable(child);
      if (table) blocks.push({ kind: 'table', html: table });
    } else if (child.localName === 'sdt') {
      const content = wordChild(child, 'sdtContent');
      if (content) for (const nested of Array.from(content.children)) {
        if (nested.namespaceURI === WORD_NS && nested.localName === 'p') emitParagraph(nested);
        else if (nested.namespaceURI === WORD_NS && nested.localName === 'tbl') {
          const table = renderTable(nested);
          if (table) blocks.push({ kind: 'table', html: table });
        }
      }
    } else if (child.localName === 'sectPr') {
      const sectionType = wordAttribute(wordChild(child, 'type'), 'val');
      if (sectionType === 'nextPage' || sectionType === 'oddPage' || sectionType === 'evenPage') blocks.push({ kind: 'break', hard: true });
    } else if (!['bookmarkStart', 'bookmarkEnd', 'proofErr'].includes(child.localName)) warnings.add('بعض عناصر Word الخاصة بالتخطيط لم تُنقل إلى القارئ.');
  }

  if (!blocks.some((block) => block.kind !== 'break')) throw new Error('لم يعثر القارئ على نص أو صور قابلة للقراءة في ملف Word.');
  const hasHardBreaks = blocks.some((block) => block.kind === 'break' && block.hard);
  const hasSoftBreaks = blocks.some((block) => block.kind === 'break' && !block.hard);
  if (!hasHardBreaks && hasSoftBreaks) warnings.add('استُخدمت فواصل الصفحات المحفوظة كتلميحات من تخطيط Word؛ قد تختلف مواضعها باختلاف الخطوط وحجم العرض.');
  if (!hasHardBreaks && !hasSoftBreaks) warnings.add('لا يحتوي DOCX على فواصل صفحات محفوظة؛ أنشأ القارئ مواضع قراءة داخلية، ولا تمثل صفحات مطبوعة.');
  if (hasHardBreaks) warnings.add('حُفظت فواصل الصفحات الصريحة في Word؛ أرقام المواضع هنا داخلية وليست أرقام صفحات مطبوعة في الكتاب.');

  const useSoft = !hasHardBreaks && hasSoftBreaks;
  const pageGroups = groupDocxPages(blocks, { hasHardBreaks, useSoftBreaks: useSoft });
  if (!pageGroups.length) throw new Error('لم يتمكن القارئ من تكوين صفحات من ملف Word.');

  const footnoteIdByAttribute = new Map([...footnoteTexts.keys()].map((id) => [escapeHtml(id), id]));
  const footnotePageReferences = pageGroups.flatMap((pageBlocks, pageIndex) => pageBlocks.flatMap((block) => {
    if (block.kind === 'break') return [];
    return [...block.html.matchAll(/data-sr-footnote-id="([^"]+)"/g)]
      .flatMap(([, attributeId]) => {
        const id = footnoteIdByAttribute.get(attributeId);
        return id ? [{ id, pageKey: pageIndex + 1 }] : [];
      });
  }));
  const footnotePlacement = placeFootnotesByReferencePage([...footnoteTexts.keys()], footnotePageReferences, new Map());
  const footnoteNumbersByPage = new Map([...footnotePlacement.placementsByPage].map(([page, placements]) => [
    page,
    new Map(placements.map(({ id, number }) => [id, number])),
  ]));

  const headings: BookRecord['headings'] = [];
  const passages: Passage[] = [];
  const footnoteRefs: { id: string; passageId: string; readerPageNumber: number }[] = [];
  const pageHtml: string[] = [];
  const passagesByGroup = new Map<string, Passage>();
  const firstReferenceByPage = new Map<string, string>();
  const referenceKey = (id: string, pageNumber: number) => `${pageNumber}\u0000${id}`;
  const footnoteTarget = (id: string, pageNumber: number) => `sr-docx-fn-${hash(`${bookId}:${id}:${pageNumber}`)}`;
  const localizeFootnoteLinks = (markup: string, pageNumber: number): string => {
    const result = localizeDocxFootnoteLinks(markup, {
      bookId,
      pageNumber,
      footnoteIdByAttribute,
      numberByFootnoteId: footnoteNumbersByPage.get(pageNumber) ?? new Map(),
    });
    for (const { id, referenceId } of result.references) {
      const key = referenceKey(id, pageNumber);
      if (referenceId && !firstReferenceByPage.has(key)) firstReferenceByPage.set(key, referenceId);
    }
    return result.markup;
  };
  let chapterNumber = 0;
  let currentHeading: string | undefined;

  for (let pageIndex = 0; pageIndex < pageGroups.length; pageIndex += 1) {
    const pageNumber = pageIndex + 1;
    const pageContents: string[] = [];
    let passageOrdinal = 0;
    const pageBlocks = pageGroups[pageIndex];
    const registerPassage = (block: WordBlock, plain: string): { id: string; footnoteIds: string[] } => {
      const ids = Array.from(block.html.matchAll(/data-sr-footnote-id="([^"]+)"/g), (match) => match[1]);
      const existing = block.passageGroupId ? passagesByGroup.get(block.passageGroupId) : undefined;
      if (existing) {
        Object.assign(existing, appendPassageFragment(existing, { text: plain, readerPageNumber: pageNumber, footnoteIds: ids }));
        return { id: existing.id, footnoteIds: ids };
      }
      passageOrdinal += 1;
      const passageId = `passage-${pageNumber}-${passageOrdinal}-${hash(`${bookId}:${plain}`)}`;
      const passage: Passage = {
        id: passageId,
        text: plain,
        readerPageNumber: pageNumber,
        readerPageEndNumber: pageNumber,
        headingContext: currentHeading,
        footnoteIds: [...new Set(ids)],
      };
      passages.push(passage);
      if (block.passageGroupId) passagesByGroup.set(block.passageGroupId, passage);
      return { id: passageId, footnoteIds: ids };
    };
    for (let blockIndex = 0; blockIndex < pageBlocks.length; blockIndex += 1) {
      const block = pageBlocks[blockIndex];
      if (block.kind === 'heading') {
        const titleText = normalizedText(block.html.replace(/<[^>]+>/g, ''));
        const level = block.level ?? 1;
        const id = `heading-${pageNumber}-${headings.length + 1}-${hash(`${bookId}:${titleText}`)}`;
        headings.push({ id, level, title: titleText, readerPageNumber: pageNumber });
        currentHeading = titleText;
        if (level === 1) {
          chapterNumber += 1;
          pageContents.push(`<h1 data-heading-id="${id}" class="chapter-heading"><span class="chapter-number">${arabicDigits(chapterNumber)}</span><span class="chapter-title">${localizeFootnoteLinks(block.html, pageNumber)}</span><span class="chapter-line"></span></h1>`);
        } else pageContents.push(`<h${level} data-heading-id="${id}">${localizeFootnoteLinks(block.html, pageNumber)}</h${level}>`);
      } else if (block.kind === 'list') {
        const listKind = block.listKind ?? 'ol';
        const items: string[] = [];
        while (blockIndex < pageBlocks.length && pageBlocks[blockIndex].kind === 'list' && (pageBlocks[blockIndex] as WordBlock).listKind === listKind) {
          const listBlock = pageBlocks[blockIndex] as WordBlock;
          const html = localizeFootnoteLinks(listBlock.html, pageNumber);
          const plain = normalizedText(html.replace(/<[^>]+>/g, ''));
          if (plain) {
            const passage = registerPassage(listBlock, plain);
            for (const id of new Set(passage.footnoteIds)) footnoteRefs.push({ id, passageId: passage.id, readerPageNumber: pageNumber });
            items.push(`<li data-passage-id="${passage.id}"${listBlock.continuation ? ' data-passage-continuation="true"' : ''}>${html}</li>`);
          }
          blockIndex += 1;
        }
        blockIndex -= 1;
        if (items.length) pageContents.push(`<${listKind}>${items.join('')}</${listKind}>`);
      } else if (block.kind === 'paragraph') {
        const html = localizeFootnoteLinks(block.html, pageNumber);
        const plain = normalizedText(html.replace(/<[^>]+>/g, ''));
        if (!plain) continue;
        const passage = registerPassage(block, plain);
        for (const id of new Set(passage.footnoteIds)) footnoteRefs.push({ id, passageId: passage.id, readerPageNumber: pageNumber });
        pageContents.push(`<p data-passage-id="${passage.id}"${block.continuation ? ' data-passage-continuation="true"' : ''}>${html}</p>`);
      } else if (block.kind === 'table') pageContents.push(localizeFootnoteLinks(block.html, pageNumber));
      else if (block.kind === 'figure') {
        const caption = pageBlocks[blockIndex + 1];
        const captionText = caption?.kind === 'paragraph' ? normalizedText(caption.html.replace(/<[^>]+>/g, '')) : '';
        if (caption && caption.kind === 'paragraph' && /^(?:شكل|الصورة|figure|fig\.)\s*[\d٠-٩]*/i.test(captionText)) {
          pageContents.push(localizeFootnoteLinks(block.html.replace('</figure>', `<figcaption>${caption.html}</figcaption></figure>`), pageNumber));
          blockIndex += 1;
        } else pageContents.push(localizeFootnoteLinks(block.html, pageNumber));
      }
    }
    pageHtml.push(`<section data-reader-page="${pageNumber}" data-page-label="${arabicDigits(pageNumber)}" data-page-kind="virtual" dir="${direction}" lang="${escapeHtml(language)}">${pageContents.join('')}</section>`);
  }

  const footnotes: Footnote[] = [];
  const footnoteMarkupByPage = new Map<number, string[]>();
  for (const [id, html] of footnoteTexts) {
    const refs = footnoteRefs.filter((reference) => reference.id === id);
    const pageNumber = footnotePlacement.firstReferencePageById.get(id);
    if (pageNumber === undefined) continue;
    const plain = normalizedText(html.replace(/<[^>]+>/g, ''));
    footnotes.push({ id, text: plain, definitionReaderPage: pageNumber, referencedBy: refs.map(({ passageId, readerPageNumber }) => ({ passageId, readerPageNumber })) });
  }
  for (const [pageNumber, placements] of footnotePlacement.placementsByPage) {
    const items = footnoteMarkupByPage.get(pageNumber) ?? [];
    for (const { id, number } of placements) {
      const html = footnoteTexts.get(id);
      if (html === undefined) continue;
      const target = footnoteTarget(id, pageNumber);
      const backref = firstReferenceByPage.get(referenceKey(id, pageNumber));
      const backrefMarkup = backref ? `<a class="footnote-backref" href="#${backref}" aria-label="العودة إلى موضع الحاشية"> ↩</a>` : '';
      items.push(`<li id="${target}"><span>(${arabicDigits(number)}) </span>${html}${backrefMarkup}</li>`);
    }
    footnoteMarkupByPage.set(pageNumber, items);
  }
  for (const [pageNumber, items] of footnoteMarkupByPage) pageHtml[pageNumber - 1] += `<div class="footnotes"><ol>${items.join('')}</ol></div>`;
  for (const footnote of footnotes) footnote.referencedBy = footnoteRefs.filter((reference) => reference.id === footnote.id).map(({ passageId, readerPageNumber }) => ({ passageId, readerPageNumber }));

  if (Array.from(document.getElementsByTagNameNS(WORD_NS, 'instrText')).some((element) => /TOC/i.test(element.textContent ?? ''))) warnings.add('قد يحتاج فهرس Word الآلي إلى تحديث داخل برنامج Word؛ استُوردت العناوين الفعلية إلى فهرس القارئ.');
  if (document.getElementsByTagNameNS('http://schemas.openxmlformats.org/officeDocument/2006/math', 'oMath').length) warnings.add('المعادلات الرياضية في Word لا تُحوّل حالياً إلى صيغة قابلة للتحرير.');
  return {
    id: bookId,
    title,
    author,
    language,
    html: pageHtml.join(''),
    headings,
    passages,
    footnotes,
    sourcePages: [],
    readerPages: pageGroups.map((_page, index) => index + 1),
    sourcePageCount: 0,
    readerPageCount: pageGroups.length,
    pageNumberKind: 'virtual',
    importedAt: new Date().toISOString(),
    sourceName,
    warnings: [...warnings],
    stats: { footnotes: footnotes.length, images: imageCount },
  };
}
