import type { BookRecord, Footnote, Passage } from '../domain/types';
import { placeFootnotesByReferencePage } from '../domain/footnote-placement';

type ImportedHtml = BookRecord & { stats: { footnotes: number; images: number } };
type SourcePage = { element: Element; label: string; page: number; ordinal: number };
type FootnoteDefinition = { id: string; element: HTMLLIElement; page: number; pageOrdinal: number };

const ALLOWED_HTML = new Set([
  'a', 'article', 'aside', 'blockquote', 'br', 'caption', 'code', 'dd', 'del', 'div', 'dl', 'dt', 'em',
  'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img', 'li', 'ol', 'p', 'pre',
  'section', 'small', 'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'th', 'thead', 'tfoot',
  'tr', 'u', 'ul',
]);
const DROP_HTML = new Set(['audio', 'button', 'embed', 'form', 'iframe', 'input', 'link', 'object', 'script', 'style', 'svg', 'template', 'video']);
const ALLOWED_SVG = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'title', 'desc']);
const SAFE_IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp']);

function hash(value: string): string {
  let result = 2166136261;
  for (const char of value) {
    result ^= char.codePointAt(0) ?? 0;
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function toArabicDigits(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
}

function numericPage(value: string | null): number | undefined {
  if (!value) return undefined;
  const western = value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  }).trim();
  if (!/^\d+$/.test(western)) return undefined;
  const parsed = Number(western);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizedText(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function normalizedPath(path: string): string {
  const decoded = (() => { try { return decodeURIComponent(path); } catch { return path; } })();
  const result: string[] = [];
  for (const part of decoded.replaceAll('\\', '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') result.pop();
    else result.push(part);
  }
  return result.join('/').toLocaleLowerCase();
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function sanitizeSvg(source: string): string | undefined {
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
  const svg = parsed.documentElement;
  if (svg.localName.toLowerCase() !== 'svg' || parsed.querySelector('parsererror')) return undefined;
  const safeAttributes = new Set([
    'xmlns', 'viewbox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
    'd', 'points', 'transform', 'fill', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
    'opacity', 'offset', 'stop-color', 'stop-opacity', 'font-size', 'font-family', 'text-anchor', 'id', 'role',
  ]);
  for (const element of [svg, ...Array.from(parsed.querySelectorAll('*'))].reverse()) {
    if (!ALLOWED_SVG.has(element.localName.toLowerCase())) {
      element.remove();
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      const safeLocalPaint = /^(?:url\(\s*#[\w.-]+\s*\)|#[\da-f]{3,8}|none|currentcolor|transparent|[\w.-]+)$/i.test(value);
      if (!safeAttributes.has(name) || name.startsWith('on') || (['fill', 'stroke', 'stop-color'].includes(name) && !safeLocalPaint)) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  return new XMLSerializer().serializeToString(svg);
}

async function fileAsDataUrl(file: File): Promise<string | undefined> {
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  const extensionMime = ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml' } as Record<string, string>)[extension ?? ''];
  const declaredMime = file.type.toLowerCase();
  const mime = SAFE_IMAGE_MIME.has(declaredMime) || declaredMime === 'image/svg+xml' ? declaredMime : extensionMime || '';
  if (mime === 'image/svg+xml' || extension === 'svg') {
    const safeSvg = sanitizeSvg(await file.text());
    return safeSvg ? `data:image/svg+xml;base64,${base64(new TextEncoder().encode(safeSvg))}` : undefined;
  }
  if (!SAFE_IMAGE_MIME.has(mime)) return undefined;
  return `data:${mime};base64,${base64(new Uint8Array(await file.arrayBuffer()))}`;
}

function isSafeHref(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /^(?:javascript|vbscript|data|file):/i.test(trimmed) || trimmed.startsWith('//')) return false;
  return trimmed.startsWith('#') || /^(?:https?:|mailto:|tel:)/i.test(trimmed) || !/^[a-z][a-z\d+.-]*:/i.test(trimmed);
}

function cleanNode(source: Node, targetDocument: Document): Node | null {
  if (source.nodeType === Node.TEXT_NODE) return targetDocument.createTextNode(source.nodeValue ?? '');
  if (!(source instanceof Element)) return null;
  const tag = source.localName.toLowerCase();
  if (DROP_HTML.has(tag)) return null;
  if (!ALLOWED_HTML.has(tag)) {
    const fragment = targetDocument.createDocumentFragment();
    for (const child of Array.from(source.childNodes)) {
      const safeChild = cleanNode(child, targetDocument);
      if (safeChild) fragment.append(safeChild);
    }
    return fragment;
  }
  const element = targetDocument.createElement(tag);
  for (const attribute of Array.from(source.attributes)) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;
    if (name.startsWith('on') || name === 'style' || name === 'srcset' || name === 'target') continue;
    if (name === 'href' && tag === 'a' && isSafeHref(value)) element.setAttribute('href', value);
    else if (name === 'src' && tag === 'img' && /^data:image\/(?:png|jpeg|gif|webp|avif|bmp|svg\+xml);base64,/i.test(value)) element.setAttribute('src', value);
    else if (['alt', 'title', 'colspan', 'rowspan', 'scope', 'dir', 'lang', 'aria-label', 'role', 'id', 'href'].includes(name)
      || ['data-source-page', 'data-reader-page', 'data-page-label', 'data-page-kind', 'data-passage-id', 'data-heading-id'].includes(name)
      || (name === 'class' && /^(?:footnotes|footnote-ref|footnote-backref|chapter-heading|chapter-number|chapter-title|chapter-line)$/.test(value))) {
      if (name !== 'href' && name !== 'src') element.setAttribute(name, value);
    }
  }
  for (const child of Array.from(source.childNodes)) {
    const safeChild = cleanNode(child, targetDocument);
    if (safeChild) element.append(safeChild);
  }
  return element;
}

function footnoteText(element: HTMLLIElement): string {
  const clone = element.cloneNode(true) as HTMLLIElement;
  clone.querySelectorAll('a').forEach((anchor) => anchor.remove());
  return normalizedText(clone);
}

function findFootnotePage(definition: HTMLLIElement, pages: readonly SourcePage[]): SourcePage | undefined {
  const containingPage = pages.find((page) => page.element.contains(definition));
  if (containingPage) return containingPage;
  const pageElement = definition.closest('[data-source-page], [data-page-number]');
  return pages.find((page) => page.element === pageElement);
}

export async function importHtml(source: string, sourceName: string, assets: readonly File[] = [], sourcePath = sourceName): Promise<ImportedHtml> {
  if (typeof DOMParser === 'undefined') throw new Error('استيراد HTML يحتاج إلى متصفح يدعم تحليل صفحات الويب.');
  const document = new DOMParser().parseFromString(source, 'text/html');
  const content = document.querySelector('main, article, [role="main"]') ?? document.body;
  const warnings = new Set<string>();
  if (document.querySelector('style, [style], link[rel~="stylesheet"]')) warnings.add('تنسيقات HTML الأصلية لا تُنقل حرفياً؛ يطبق القارئ تنسيق القراءة الخاص به.');
  document.querySelectorAll('script, style, iframe, object, embed, form, input, button, video, audio, template').forEach((element) => element.remove());

  const title = document.querySelector('meta[name="title" i], meta[property="og:title" i]')?.getAttribute('content')?.trim()
    || document.title.trim()
    || content.querySelector('h1')?.textContent?.trim()
    || sourceName.replace(/\.[^.]+$/, '');
  const author = document.querySelector('meta[name="author" i], meta[property="author" i], meta[property="og:author" i]')?.getAttribute('content')?.trim() || undefined;
  const bookId = `book-${hash(`${title}\n${source}`)}`;
  const sourceDir = sourcePath.replaceAll('\\', '/').split('/').slice(0, -1).join('/');
  const assetEntries = assets.map((file) => ({ file, path: normalizedPath(file.webkitRelativePath || file.name) }));

  for (const image of Array.from(content.querySelectorAll('img'))) {
    const src = image.getAttribute('src')?.trim();
    if (!src) {
      warnings.add('صورة HTML بلا مسار صالح؛ احتُفظ بالنص البديل فقط.');
      continue;
    }
    if (/^(?:https?:)?\/\//i.test(src)) {
      image.removeAttribute('src');
      warnings.add('حُجبت الصور البعيدة؛ اختر ملفات الصور مع HTML لتضمينها محلياً.');
      continue;
    }
    if (/^data:image\/(?:png|jpeg|gif|webp|avif|bmp);base64,/i.test(src)) continue;
    if (/^data:/i.test(src)) {
      image.removeAttribute('src');
      warnings.add('نوع صورة مضمن غير مدعوم؛ احتُفظ بالنص البديل فقط.');
      continue;
    }
    const relativeSource = src.split(/[?#]/, 1)[0];
    const resolved = normalizedPath(`${sourceDir}/${relativeSource}`);
    const basename = normalizedPath(relativeSource).split('/').at(-1);
    let matches = assetEntries.filter((entry) => entry.path === resolved);
    if (!matches.length && basename) matches = assetEntries.filter((entry) => normalizedPath(entry.file.name) === basename);
    if (matches.length !== 1) {
      image.removeAttribute('src');
      warnings.add(matches.length > 1
        ? 'تعذر تحديد ملف صورة محلي لأن أسماء الملفات المختارة متكررة.'
        : 'لم تُختر بعض الصور المحلية مع ملف HTML؛ اختر ملف HTML والصور التابعة له معاً.');
      continue;
    }
    const dataUrl = await fileAsDataUrl(matches[0].file);
    if (!dataUrl) {
      image.removeAttribute('src');
      warnings.add('صيغة صورة محلية غير مدعومة؛ احتُفظ بالنص البديل والتعليق.');
      continue;
    }
    image.setAttribute('src', dataUrl);
  }

  const markerSelector = '[data-source-page], [data-page-number]';
  const pageElements = content.matches(markerSelector)
    ? [content]
    : Array.from(content.querySelectorAll(markerSelector)).filter((element) => !element.parentElement?.closest(markerSelector));
  const hasExplicitPages = pageElements.length > 0;
  let pageRoots: Element[] = pageElements;
  if (!hasExplicitPages) {
    const blocks = Array.from(content.childNodes).filter((node) => node.nodeType !== Node.TEXT_NODE || Boolean(node.nodeValue?.trim()));
    const groups: Node[][] = [];
    let current: Node[] = [];
    let wordCount = 0;
    for (const block of blocks) {
      const text = (block.textContent ?? '').trim();
      const words = text ? text.split(/\s+/).length : 0;
      const startsChapter = block instanceof Element && /^h1$/i.test(block.localName);
      if (current.length && (startsChapter || (wordCount >= 280 && !(/^h[1-6]$/i.test((block as Element).localName ?? ''))))) {
        groups.push(current);
        current = [];
        wordCount = 0;
      }
      current.push(block);
      wordCount += words;
    }
    if (current.length || !groups.length) groups.push(current);
    pageRoots = groups.map((group) => {
      const wrapper = document.createElement('div');
      group.forEach((node) => wrapper.append(node));
      return wrapper;
    });
  }
  const pages: SourcePage[] = pageRoots.map((element, index) => {
    const label = element.getAttribute('data-source-page') ?? element.getAttribute('data-page-number') ?? String(index + 1);
    return { element, label, page: numericPage(label) ?? index + 1, ordinal: index + 1 };
  });
  if (!pageRoots.some((root) => Boolean(normalizedText(root) || root.querySelector('img')))) {
    throw new Error('ملف HTML لا يحتوي على نص أو صور قابلة للقراءة.');
  }
  const hasNumericSourcePages = hasExplicitPages && pages.every((page) => numericPage(page.label) !== undefined);
  if (hasExplicitPages && !hasNumericSourcePages) warnings.add('حُفظت حدود صفحات المصدر، لكن بعض أرقامها غير رقمية؛ ستُعرض كمواضع قراءة داخلية حتى لا يُختلق رقم مطبوع.');
  if (!hasExplicitPages) warnings.add('لا يحتوي HTML على علامات صفحات مصدر؛ قُسّم المحتوى إلى مواضع قراءة داخلية حسب العناوين والفقرات، ولا تمثل هذه المواضع صفحات مطبوعة.');

  const pageAnchors = pageRoots.flatMap((root) => Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')));
  const referencedIds = new Set([...pageAnchors, ...Array.from(document.body.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'))].map((anchor) => {
    try { return decodeURIComponent(anchor.getAttribute('href')!.slice(1)); } catch { return anchor.getAttribute('href')!.slice(1); }
  }));
  const candidateItems = new Set([...pageRoots.flatMap((root) => Array.from(root.querySelectorAll<HTMLLIElement>('li[id]'))), ...Array.from(document.body.querySelectorAll<HTMLLIElement>('li[id]'))]);
  const definitionItems = Array.from(candidateItems).filter((item) => {
    if (!referencedIds.has(item.id)) return false;
    const container = item.closest('aside, [role="doc-endnotes"], [class*="footnote" i], [aria-label*="حاش" i], [aria-label*="footnote" i], [aria-label*="endnote" i]');
    return Boolean(container) || /^(?:fn|footnote|endnote)[-_\d]/i.test(item.id);
  });
  const semanticFootnoteContainers = new Set<Element>();
  const definitions: FootnoteDefinition[] = definitionItems.map((element, index) => {
    const container = element.closest('aside, [role="doc-endnotes"], [class*="footnote" i], [aria-label*="حاش" i], [aria-label*="footnote" i], [aria-label*="endnote" i]');
    if (container) semanticFootnoteContainers.add(container);
    const page = findFootnotePage(element, pages) ?? pages.at(-1)!;
    return { id: element.id || `footnote-${index + 1}`, element, page: page.page, pageOrdinal: page.ordinal };
  });
  for (const definition of definitions) definition.element.remove();
  for (const container of semanticFootnoteContainers) {
    if (!container.querySelector('li[id]')) container.remove();
  }

  const footnoteIds = new Set(definitions.map((definition) => definition.id));
  const footnoteTarget = (id: string, pageOrdinal: number) => `sr-html-footnote-${hash(`${bookId}:${id}:${pageOrdinal}`)}`;
  const referenceCounts = new Map<string, number>();
  const firstReference = new Map<string, string>();
  const footnotePageReferences: { id: string; pageOrdinal: number }[] = [];
  const referenceKey = (id: string, pageOrdinal: number) => `${pageOrdinal}\u0000${id}`;
  const originalIds = new Map<string, string>();
  const pageElementsWithIds = new Set(pageRoots.flatMap((root) => Array.from(root.querySelectorAll<HTMLElement>('[id]'))));
  for (const element of pageElementsWithIds) {
    const original = element.id;
    if (!original || originalIds.has(original)) continue;
    const safe = `sr-html-${hash(`${bookId}:${original}`)}`;
    originalIds.set(original, safe);
    element.id = safe;
  }
  const contentAnchors = new Set(pageRoots.flatMap((root) => Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'))));
  for (const anchor of contentAnchors) {
    let originalTarget = anchor.getAttribute('href')!.slice(1);
    try { originalTarget = decodeURIComponent(originalTarget); } catch { /* Keep the literal fragment. */ }
    if (footnoteIds.has(originalTarget)) {
      const pageOrdinal = pages.find((page) => page.element.contains(anchor))?.ordinal ?? 1;
      const count = (referenceCounts.get(originalTarget) ?? 0) + 1;
      referenceCounts.set(originalTarget, count);
      const refId = `sr-html-ref-${hash(`${bookId}:${originalTarget}:${count}`)}`;
      const key = referenceKey(originalTarget, pageOrdinal);
      if (!firstReference.has(key)) firstReference.set(key, refId);
      footnotePageReferences.push({ id: originalTarget, pageOrdinal });
      anchor.id = refId;
      anchor.href = `#${footnoteTarget(originalTarget, pageOrdinal)}`;
      anchor.dataset.srFootnoteId = originalTarget;
      if (anchor.parentElement?.localName !== 'sup') {
        const sup = document.createElement('sup');
        anchor.replaceWith(sup);
        sup.append(anchor);
      }
      anchor.parentElement?.classList.add('footnote-ref');
    } else if (originalIds.has(originalTarget)) {
      anchor.setAttribute('href', `#${originalIds.get(originalTarget)}`);
    }
  }

  const pageNumbers = pages.map((page) => hasNumericSourcePages ? numericPage(page.label)! : page.ordinal);
  const headings: BookRecord['headings'] = [];
  const passages: Passage[] = [];
  const footnotes: Footnote[] = definitions.map((definition) => ({
    id: definition.id,
    text: footnoteText(definition.element),
    definitionReaderPage: hasNumericSourcePages ? definition.page : definition.pageOrdinal,
    ...(hasNumericSourcePages ? { sourcePageNumber: definition.page } : {}),
    referencedBy: [],
  }));
  const footnoteReferences: { id: string; passageId: string; readerPageNumber: number; sourcePageNumber?: number; pageOrdinal: number }[] = [];
  const placement = placeFootnotesByReferencePage(
    definitions.map((definition) => definition.id),
    footnotePageReferences.map(({ id, pageOrdinal }) => ({ id, pageKey: pageOrdinal })),
    new Map(definitions.map((definition) => [definition.id, definition.pageOrdinal])),
  );
  const footnoteNumberByPage = new Map([...placement.placementsByPage].map(([pageOrdinal, placements]) => [
    pageOrdinal,
    new Map(placements.map(({ id, number }) => [id, number])),
  ]));
  for (const page of pages) {
    for (const anchor of Array.from(page.element.querySelectorAll<HTMLAnchorElement>('[data-sr-footnote-id]'))) {
      const id = anchor.dataset.srFootnoteId;
      const number = id ? footnoteNumberByPage.get(page.ordinal)?.get(id) : undefined;
      if (number !== undefined) anchor.textContent = toArabicDigits(number);
    }
  }
  let chapterNumber = 0;
  const pageSections: HTMLElement[] = [];
  const language = document.documentElement.lang || 'ar';
  const direction = ['rtl', 'ltr', 'auto'].includes(document.documentElement.dir) ? document.documentElement.dir : 'rtl';

  for (const page of pages) {
    let headingContext: string | undefined;
    let passageOrdinal = 0;
    for (const heading of Array.from(page.element.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'))) {
      const titleText = normalizedText(heading);
      if (!titleText) continue;
      const level = Number(heading.localName.slice(1));
      const id = `heading-${page.ordinal}-${headings.length + 1}-${hash(`${bookId}:${titleText}`)}`;
      heading.dataset.headingId = id;
      headingContext = titleText;
      headings.push({ id, level, title: titleText, readerPageNumber: pageNumbers[page.ordinal - 1], ...(hasNumericSourcePages ? { sourcePageNumber: pageNumbers[page.ordinal - 1] } : {}) });
      if (level === 1) {
        chapterNumber += 1;
        const originalChildren = Array.from(heading.childNodes);
        heading.replaceChildren();
        heading.classList.add('chapter-heading');
        const number = document.createElement('span');
        number.className = 'chapter-number';
        number.textContent = toArabicDigits(chapterNumber);
        const titleSpan = document.createElement('span');
        titleSpan.className = 'chapter-title';
        titleSpan.append(...originalChildren);
        const line = document.createElement('span');
        line.className = 'chapter-line';
        heading.append(number, titleSpan, line);
      }
    }

    for (const paragraph of Array.from(page.element.querySelectorAll<HTMLElement>('p'))) {
      const text = normalizedText(paragraph);
      if (!text) continue;
      passageOrdinal += 1;
      const readerPageNumber = pageNumbers[page.ordinal - 1];
      const passageId = `passage-${page.ordinal}-${passageOrdinal}-${hash(`${bookId}:${text}`)}`;
      paragraph.dataset.passageId = passageId;
      const ids = Array.from(paragraph.querySelectorAll<HTMLElement>('[data-sr-footnote-id]')).map((anchor) => anchor.dataset.srFootnoteId!).filter((id) => footnoteIds.has(id));
      passages.push({ id: passageId, text, readerPageNumber, ...(hasNumericSourcePages ? { sourcePageNumber: readerPageNumber } : {}), headingContext, footnoteIds: [...new Set(ids)] });
      for (const id of new Set(ids)) footnoteReferences.push({ id, passageId, readerPageNumber, ...(hasNumericSourcePages ? { sourcePageNumber: readerPageNumber } : {}), pageOrdinal: page.ordinal });
    }

    const section = document.createElement('section');
    section.setAttribute('data-reader-page', String(pageNumbers[page.ordinal - 1]));
    section.setAttribute('data-page-label', hasNumericSourcePages ? toArabicDigits(pageNumbers[page.ordinal - 1]) : toArabicDigits(page.ordinal));
    section.setAttribute('data-page-kind', hasNumericSourcePages ? 'source' : 'virtual');
    section.setAttribute('dir', direction);
    section.setAttribute('lang', language);
    if (hasNumericSourcePages) section.setAttribute('data-source-page', String(pageNumbers[page.ordinal - 1]));
    for (const child of Array.from(page.element.childNodes)) {
      const safe = cleanNode(child, document);
      if (safe) section.append(safe);
    }
    pageSections.push(section);
  }

  for (const footnote of footnotes) {
    const pageOrdinal = placement.firstReferencePageById.get(footnote.id);
    if (pageOrdinal === undefined) continue;
    footnote.definitionReaderPage = pageNumbers[pageOrdinal - 1];
    if (hasNumericSourcePages) footnote.sourcePageNumber = pageNumbers[pageOrdinal - 1];
  }
  const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));
  for (const [pageOrdinal, placements] of placement.placementsByPage) {
    const container = document.createElement('div');
    container.className = 'footnotes';
    const list = document.createElement('ol');
    container.append(list);
    for (const { id, number: footnoteNumber } of placements) {
      const definition = definitionById.get(id)!;
      const item = document.createElement('li');
      item.id = footnoteTarget(id, pageOrdinal);
      const number = document.createElement('span');
      number.textContent = `(${toArabicDigits(footnoteNumber)}) `;
      item.append(number);
      for (const child of Array.from(definition.element.childNodes)) {
        const safe = cleanNode(child, document);
        if (safe) item.append(safe);
      }
      const backrefId = firstReference.get(referenceKey(id, pageOrdinal));
      if (backrefId) {
        const firstParagraph = item.querySelector('p') ?? item;
        const backref = document.createElement('a');
        backref.className = 'footnote-backref';
        backref.href = `#${backrefId}`;
        backref.setAttribute('aria-label', 'العودة إلى موضع الحاشية');
        backref.textContent = ' ↩';
        firstParagraph.append(backref);
      }
      list.append(item);
    }
    pageSections[pageOrdinal - 1]?.append(container);
  }

  for (const footnote of footnotes) {
    footnote.referencedBy = footnoteReferences.filter((reference) => reference.id === footnote.id).map(({ passageId, readerPageNumber, sourcePageNumber }) => ({ passageId, readerPageNumber, sourcePageNumber }));
  }
  const html = pageSections.map((section) => section.outerHTML).join('');
  const imageCount = (html.match(/<img\b[^>]*\bsrc=/g) ?? []).length;
  const sourcePages = hasNumericSourcePages ? pageNumbers : [];
  return {
    id: bookId,
    title,
    author,
    language,
    html,
    headings,
    passages,
    footnotes,
    sourcePages,
    readerPages: pageNumbers,
    sourcePageCount: sourcePages.length,
    readerPageCount: pageNumbers.length,
    pageNumberKind: hasNumericSourcePages ? 'source' : 'virtual',
    importedAt: new Date().toISOString(),
    sourceName,
    warnings: [...warnings],
    stats: { footnotes: footnotes.length, images: imageCount },
  };
}
