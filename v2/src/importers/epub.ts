import { importHtml } from './html';
import { readZipArchive } from './zip-archive';
import type { BookRecord } from '../domain/types';

type ImportedEpub = BookRecord & { stats: { footnotes: number; images: number } };
type ManifestItem = { id: string; href: string; mediaType: string };
type EpubChapter = { path: string; body: Element; ids: Map<string, string>; targetId: string };

const DC_NS = 'http://purl.org/dc/elements/1.1/';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const MAX_EMBEDDED_IMAGES = 32 * 1024 * 1024;
const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp',
};

function xmlDocument(source: string, label: string): Document {
  const parsed = new DOMParser().parseFromString(source, 'application/xml');
  if (!parsed.documentElement || Array.from(parsed.getElementsByTagName('*')).some((element) => element.localName === 'parsererror')) throw new Error(`تعذر تحليل ${label} داخل ملف EPUB.`);
  return parsed;
}

function localElements(root: ParentNode, name: string): Element[] {
  return Array.from(root.querySelectorAll('*')).filter((element) => element.localName === name);
}

function zipPath(path: string): string | undefined {
  let decoded: string;
  try { decoded = decodeURIComponent(path.split(/[?#]/, 1)[0]); } catch { return undefined; }
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(decoded)) return undefined;
  const parts: string[] = [];
  for (const part of decoded.replaceAll('\\', '/').replace(/^\//, '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return undefined;
      parts.pop();
    } else parts.push(part);
  }
  return parts.join('/');
}

function resolveZipPath(baseFile: string, relativePath: string): string | undefined {
  const base = baseFile.split('/').slice(0, -1).join('/');
  return zipPath(`${base}/${relativePath}`);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function epubType(element: Element): string {
  return element.getAttribute('epub:type') ?? element.getAttributeNS('http://www.idpf.org/2007/ops', 'type') ?? '';
}

function normalizeFootnoteAsides(document: Document, warnings: Set<string>): void {
  for (const aside of localElements(document, 'aside')) {
    const type = epubType(aside).toLowerCase().split(/\s+/);
    const role = (aside.getAttribute('role') ?? '').toLowerCase();
    if (!type.includes('footnote') && !type.includes('endnote') && !['doc-footnote', 'doc-endnote'].includes(role)) continue;
    const item = document.createElementNS(XHTML_NS, 'li');
    if (aside.id) item.id = aside.id;
    while (aside.firstChild) item.append(aside.firstChild);
    const list = document.createElementNS(XHTML_NS, 'ol');
    list.setAttribute('class', 'footnotes');
    list.append(item);
    aside.replaceWith(list);
    warnings.add('تُنقل حواشي EPUB البنيوية إلى أسفل موضع الإحالة عند التعرف على رابطها.');
  }
}

async function embedImages(document: Document, chapterPath: string, manifestByPath: Map<string, ManifestItem>, archive: Awaited<ReturnType<typeof readZipArchive>>, bytesEmbedded: { value: number }, warnings: Set<string>): Promise<void> {
  for (const image of localElements(document, 'img')) {
    const src = image.getAttribute('src')?.trim();
    if (!src || /^(?:https?:)?\/\//i.test(src) || /^(?:data:|[a-z][a-z\d+.-]*:)/i.test(src)) {
      image.removeAttribute('src');
      if (src) warnings.add('حُجبت صورة EPUB خارجية أو من نوع غير مدعوم.');
      continue;
    }
    const path = resolveZipPath(chapterPath, src);
    const item = path ? manifestByPath.get(path) : undefined;
    const extension = path?.split('.').at(-1)?.toLowerCase() ?? '';
    const mime = item?.mediaType.startsWith('image/') ? item.mediaType.toLowerCase() : IMAGE_MIME_BY_EXTENSION[extension];
    if (!path || !mime || !Object.values(IMAGE_MIME_BY_EXTENSION).includes(mime)) {
      image.removeAttribute('src');
      warnings.add('صيغة صورة EPUB غير مدعومة؛ بقي النص البديل إن توفر.');
      continue;
    }
    const bytes = await archive.read(path);
    if (!bytes) {
      image.removeAttribute('src');
      warnings.add('تعذر العثور على صورة EPUB داخل الأرشيف.');
      continue;
    }
    bytesEmbedded.value += bytes.byteLength;
    if (bytesEmbedded.value > MAX_EMBEDDED_IMAGES) {
      image.removeAttribute('src');
      warnings.add('تجاوزت صور EPUB حد التخزين المحلي الآمن؛ تُركت الصور الكبيرة خارج النسخة المستوردة.');
      continue;
    }
    image.setAttribute('src', `data:${mime};base64,${base64(bytes)}`);
  }
}

function prefixChapterIds(chapter: EpubChapter, prefix: string): void {
  const chapterElements = [chapter.body, ...Array.from(chapter.body.querySelectorAll('*'))];
  for (const element of chapterElements) {
    const original = element.getAttribute('id');
    if (!original) continue;
    const safe = `${prefix}${original}`;
    chapter.ids.set(original, safe);
    element.setAttribute('id', safe);
  }
  const firstHeading = chapterElements.find((element) => /^h[1-6]$/.test(element.localName) && element !== chapter.body);
  const target = firstHeading ?? chapter.body.firstElementChild ?? chapter.body;
  if (!target.hasAttribute('id')) target.setAttribute('id', `${prefix}chapter`);
  chapter.targetId = target.getAttribute('id')!;
}

function rewriteChapterLinks(chapters: readonly EpubChapter[], chapterIndexByPath: Map<string, number>, warnings: Set<string>): void {
  for (const chapter of chapters) {
    for (const anchor of localElements(chapter.body, 'a').filter((element) => element.hasAttribute('href'))) {
      const href = anchor.getAttribute('href')?.trim();
      if (!href || /^(?:https?:|mailto:|tel:|\/\/)/i.test(href)) continue;
      const hashIndex = href.indexOf('#');
      const pathPart = hashIndex < 0 ? href : href.slice(0, hashIndex);
      const fragment = hashIndex < 0 ? '' : href.slice(hashIndex + 1);
      const destinationPath = pathPart ? resolveZipPath(chapter.path, pathPart) : chapter.path;
      const destinationIndex = destinationPath ? chapterIndexByPath.get(destinationPath) : undefined;
      const destination = destinationIndex === undefined ? undefined : chapters[destinationIndex];
      if (!destination) {
        if (pathPart) {
          anchor.removeAttribute('href');
          warnings.add('تجاهل القارئ رابط EPUB يشير إلى ملف خارج ترتيب القراءة أو إلى مسار غير صالح.');
        }
        continue;
      }
      let decodedFragment = fragment;
      try { decodedFragment = decodeURIComponent(fragment); } catch { /* Keep the literal fragment. */ }
      const target = decodedFragment ? destination.ids.get(decodedFragment) : destination.targetId;
      if (target) anchor.setAttribute('href', `#${target}`);
      else if (fragment) {
        anchor.removeAttribute('href');
        warnings.add('تعذر العثور على موضع داخلي يشير إليه رابط في EPUB.');
      }
    }
  }
}

/** Import the ordered EPUB spine through the same sanitizer and book model as HTML. */
export async function importEpub(file: File): Promise<ImportedEpub> {
  if (typeof DOMParser === 'undefined') throw new Error('استيراد EPUB يحتاج إلى متصفح يدعم تحليل XML.');
  const archive = await readZipArchive(await file.arrayBuffer(), 'EPUB');
  const warnings = new Set<string>();
  const containerXml = await archive.text('META-INF/container.xml');
  if (!containerXml) throw new Error('ملف EPUB لا يحتوي على META-INF/container.xml.');
  const container = xmlDocument(containerXml, 'فهرس الحزمة');
  const packagePathRaw = localElements(container, 'rootfile')[0]?.getAttribute('full-path');
  const packagePath = packagePathRaw ? zipPath(packagePathRaw) : undefined;
  if (!packagePath) throw new Error('تعذر تحديد مسار بيانات الكتاب داخل EPUB.');
  const packageXml = await archive.text(packagePath);
  if (!packageXml) throw new Error('ملف EPUB لا يحتوي على ملف OPF المشار إليه في الفهرس.');
  const opf = xmlDocument(packageXml, 'بيانات الكتاب');
  const metadata = localElements(opf, 'metadata')[0] ?? opf;
  const title = metadata.getElementsByTagNameNS(DC_NS, 'title')[0]?.textContent?.trim() || file.name.replace(/\.epub$/i, '');
  const author = metadata.getElementsByTagNameNS(DC_NS, 'creator')[0]?.textContent?.trim() || undefined;
  const language = metadata.getElementsByTagNameNS(DC_NS, 'language')[0]?.textContent?.trim().split(/[-_]/)[0] || 'ar';
  const spine = localElements(opf, 'spine')[0];
  if (!spine) throw new Error('ملف EPUB لا يحتوي على ترتيب قراءة (spine).');

  const manifest = new Map<string, ManifestItem>();
  for (const item of localElements(opf, 'item')) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (!id || !href) continue;
    const path = resolveZipPath(packagePath, href);
    if (path) manifest.set(id, { id, href, mediaType: item.getAttribute('media-type')?.toLowerCase() ?? '' });
  }
  const manifestByPath = new Map<string, ManifestItem>();
  for (const item of manifest.values()) {
    const path = resolveZipPath(packagePath, item.href);
    if (path) manifestByPath.set(path, item);
  }
  const chapterPaths = localElements(spine, 'itemref').flatMap((reference) => {
    const item = manifest.get(reference.getAttribute('idref') ?? '');
    const path = item ? resolveZipPath(packagePath, item.href) : undefined;
    return item && path && ['application/xhtml+xml', 'text/html'].includes(item.mediaType) ? [{ path, item }] : [];
  });
  if (!chapterPaths.length) throw new Error('لم يُعثر على صفحات XHTML/HTML قابلة للقراءة في ترتيب EPUB.');

  const chapters: EpubChapter[] = [];
  const chapterIndexByPath = new Map<string, number>();
  const embeddedBytes = { value: 0 };
  for (const { path } of chapterPaths) {
    const source = await archive.text(path);
    if (!source) {
      warnings.add('تعذر العثور على صفحة ضمن ترتيب القراءة في EPUB؛ تم تجاوزها.');
      continue;
    }
    const parsed = xmlDocument(source, `صفحة EPUB ${path}`);
    normalizeFootnoteAsides(parsed, warnings);
    await embedImages(parsed, path, manifestByPath, archive, embeddedBytes, warnings);
    const parsedBody = localElements(parsed, 'body')[0] ?? parsed.documentElement;
    const chapter: EpubChapter = { path, body: parsedBody, ids: new Map(), targetId: '' };
    prefixChapterIds(chapter, `epub-${chapters.length + 1}-`);
    chapters.push(chapter);
    chapterIndexByPath.set(path, chapters.length - 1);
  }
  if (!chapters.length) throw new Error('لم تُعثر على صفحات EPUB مكتملة في ترتيب القراءة.');
  rewriteChapterLinks(chapters, chapterIndexByPath, warnings);

  const direction = (spine.getAttribute('page-progression-direction') ?? '').toLowerCase();
  const inferredDirection = ['ar', 'fa', 'ur', 'he'].includes(language.toLowerCase()) ? 'rtl' : 'ltr';
  const html = `<!doctype html><html lang="${escapeHtml(language)}" dir="${direction === 'rtl' || direction === 'ltr' ? direction : inferredDirection}"><head><title>${escapeHtml(title)}</title>${author ? `<meta name="author" content="${escapeHtml(author)}">` : ''}</head><body><main>${chapters.map((chapter) => Array.from(chapter.body.childNodes).map((node) => new XMLSerializer().serializeToString(node)).join('')).join('\n')}</main></body></html>`;
  const book = await importHtml(html, file.name);
  book.title = title;
  book.author = author;
  book.language = language;
  book.warnings = [...new Set([...book.warnings, ...warnings])];
  return book;
}
