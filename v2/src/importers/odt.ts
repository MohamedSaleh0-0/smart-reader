import { importHtml } from './html';
import { readZipArchive } from './zip-archive';
import type { BookRecord } from '../domain/types';

type ImportedOdt = BookRecord & { stats: { footnotes: number; images: number } };
const OFFICE_NS = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
const TEXT_NS = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
const STYLE_NS = 'urn:oasis:names:tc:opendocument:xmlns:style:1.0';
const FO_NS = 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const TABLE_NS = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';
const DRAW_NS = 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0';
const MAX_EMBEDDED_IMAGES = 32 * 1024 * 1024;
const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp',
};

function xmlDocument(source: string, label: string): Document {
  const parsed = new DOMParser().parseFromString(source, 'application/xml');
  if (!parsed.documentElement || Array.from(parsed.getElementsByTagName('*')).some((element) => element.localName === 'parsererror')) throw new Error(`تعذر تحليل ${label} داخل ملف ODT.`);
  return parsed;
}

function elements(root: ParentNode, namespace: string, name: string): Element[] {
  return Array.from(root.querySelectorAll('*')).filter((element) => element.namespaceURI === namespace && element.localName === name);
}

function element(root: ParentNode, namespace: string, name: string): Element | undefined {
  return elements(root, namespace, name)[0];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function zipPath(value: string): string | undefined {
  let decoded: string;
  try { decoded = decodeURIComponent(value.split(/[?#]/, 1)[0]); } catch { return undefined; }
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

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function textProperties(style: Element | undefined): { bold: boolean; italic: boolean; underline: boolean } {
  const properties = style ? element(style, STYLE_NS, 'text-properties') : undefined;
  const weight = properties?.getAttributeNS(FO_NS, 'font-weight')?.toLowerCase();
  const fontStyle = properties?.getAttributeNS(FO_NS, 'font-style')?.toLowerCase();
  const underline = properties?.getAttributeNS(STYLE_NS, 'text-underline-style')?.toLowerCase();
  return {
    bold: Boolean(weight && weight !== 'normal' && weight !== '400' && weight !== '300'),
    italic: fontStyle === 'italic' || fontStyle === 'oblique',
    underline: Boolean(underline && underline !== 'none'),
  };
}

function applyTextStyles(html: string, style: Element | undefined): string {
  const properties = textProperties(style);
  let result = html;
  if (properties.bold) result = `<strong>${result}</strong>`;
  if (properties.italic) result = `<em>${result}</em>`;
  if (properties.underline) result = `<u>${result}</u>`;
  return result;
}

/** Import the ODT body, basic styles, lists, tables, images, and notes into the HTML book contract. */
export async function importOdt(file: File): Promise<ImportedOdt> {
  if (typeof DOMParser === 'undefined') throw new Error('استيراد ODT يحتاج إلى متصفح يدعم تحليل XML.');
  const archive = await readZipArchive(await file.arrayBuffer(), 'ODT');
  const warnings = new Set<string>();
  const contentXml = await archive.text('content.xml');
  if (!contentXml) throw new Error('ملف ODT لا يحتوي على content.xml.');
  const content = xmlDocument(contentXml, 'المحتوى');
  const metadataXml = await archive.text('meta.xml');
  const metadata = metadataXml ? xmlDocument(metadataXml, 'البيانات الوصفية') : undefined;
  const title = metadata ? element(metadata, 'http://purl.org/dc/elements/1.1/', 'title')?.textContent?.trim() : '';
  const author = metadata ? element(metadata, 'http://purl.org/dc/elements/1.1/', 'creator')?.textContent?.trim() : '';
  const language = metadata ? element(metadata, 'http://purl.org/dc/elements/1.1/', 'language')?.textContent?.trim().split(/[-_]/)[0] : '';
  const styles = new Map<string, Element>();
  for (const style of elements(content, STYLE_NS, 'style')) {
    const name = style.getAttributeNS(STYLE_NS, 'name');
    if (name) styles.set(name, style);
  }
  const stylesXml = await archive.text('styles.xml');
  if (stylesXml) {
    const stylesDocument = xmlDocument(stylesXml, 'التنسيقات');
    for (const style of elements(stylesDocument, STYLE_NS, 'style')) {
      const name = style.getAttributeNS(STYLE_NS, 'name');
      if (name && !styles.has(name)) styles.set(name, style);
    }
  }

  const footnotes: { id: string; html: string }[] = [];
  let footnoteIndex = 0;
  const embeddedBytes = { value: 0 };
  let imageCount = 0;
  const inline = async (node: Node): Promise<string> => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.nodeValue ?? '');
    if (!(node instanceof Element)) return '';
    const name = node.localName;
    if (node.namespaceURI === TEXT_NS && name === 's') {
      const count = Math.min(1000, Math.max(1, Number(node.getAttributeNS(TEXT_NS, 'c') ?? 1) || 1));
      return ' '.repeat(count);
    }
    if (node.namespaceURI === TEXT_NS && name === 'tab') return ' ';
    if (node.namespaceURI === TEXT_NS && name === 'line-break') return '<br>';
    if (node.namespaceURI === TEXT_NS && name === 'note') {
      const id = `odt-footnote-${++footnoteIndex}`;
      const noteBody = element(node, TEXT_NS, 'note-body');
      const noteHtml = noteBody ? await blocks(noteBody) : '';
      footnotes.push({ id, html: `<li id="${id}">${noteHtml}</li>` });
      const citation = element(node, TEXT_NS, 'note-citation')?.textContent?.trim() || String(footnoteIndex);
      return `<a href="#${id}">${escapeHtml(citation)}</a>`;
    }
    if (node.namespaceURI === DRAW_NS && name === 'image') {
      const href = node.getAttributeNS(XLINK_NS, 'href') ?? '';
      const path = zipPath(href);
      const extension = path?.split('.').at(-1)?.toLowerCase() ?? '';
      const mime = IMAGE_MIME_BY_EXTENSION[extension];
      const bytes = path ? await archive.read(path) : undefined;
      if (bytes && mime && embeddedBytes.value + bytes.byteLength <= MAX_EMBEDDED_IMAGES) {
        embeddedBytes.value += bytes.byteLength;
        imageCount += 1;
        return `<img src="data:${mime};base64,${base64(bytes)}" alt="${escapeHtml(node.getAttribute('alt') ?? '')}">`;
      }
      warnings.add(bytes ? 'تجاوزت صور ODT حد التخزين المحلي الآمن أو أن صيغتها غير مدعومة.' : 'تعذر العثور على صورة ODT أو أن مسارها غير صالح.');
      return '';
    }
    if (node.namespaceURI === TEXT_NS && name === 'a') {
      const href = node.getAttributeNS(XLINK_NS, 'href') ?? '';
      const contentHtml = await inlineChildren(node);
      return /^(?:https?:|mailto:|tel:|#)/i.test(href) || !/^[a-z][a-z\d+.-]*:/i.test(href)
        ? `<a href="${escapeHtml(href)}">${contentHtml}</a>`
        : contentHtml;
    }
    const contentHtml = await inlineChildren(node);
    if (node.namespaceURI === TEXT_NS && name === 'span') return applyTextStyles(contentHtml, styles.get(node.getAttributeNS(TEXT_NS, 'style-name') ?? ''));
    return contentHtml;
  };

  async function inlineChildren(parent: Node): Promise<string> {
    const chunks: string[] = [];
    for (const child of Array.from(parent.childNodes)) chunks.push(await inline(child));
    return chunks.join('');
  }

  async function blocks(parent: Node): Promise<string> {
    const output: string[] = [];
    for (const child of Array.from(parent.childNodes)) {
      if (!(child instanceof Element)) continue;
      if (child.namespaceURI === TEXT_NS && child.localName === 'h') {
        const level = Math.min(6, Math.max(1, Number(child.getAttributeNS(TEXT_NS, 'outline-level') ?? 1) || 1));
        output.push(`<h${level}>${await inlineChildren(child)}</h${level}>`);
      } else if (child.namespaceURI === TEXT_NS && child.localName === 'p') {
        const paragraph = await inlineChildren(child);
        if (paragraph.trim()) output.push(`<p>${applyTextStyles(paragraph, styles.get(child.getAttributeNS(TEXT_NS, 'style-name') ?? ''))}</p>`);
      } else if (child.namespaceURI === TEXT_NS && child.localName === 'list') {
        const items: string[] = [];
        for (const item of elements(child, TEXT_NS, 'list-item').filter((entry) => entry.parentElement === child)) items.push(`<li>${await blocks(item)}</li>`);
        if (items.length) output.push(`<ul>${items.join('')}</ul>`);
      } else if (child.namespaceURI === TABLE_NS && child.localName === 'table') {
        const rows: string[] = [];
        for (const row of elements(child, TABLE_NS, 'table-row').filter((entry) => {
          let parent = entry.parentElement;
          while (parent && parent !== child) {
            if (parent.namespaceURI === TABLE_NS && parent.localName === 'table') return false;
            parent = parent.parentElement;
          }
          return parent === child;
        })) {
          const cells: string[] = [];
          for (const cell of Array.from(row.children).filter((entry) => entry.namespaceURI === TABLE_NS && ['table-cell', 'covered-table-cell'].includes(entry.localName))) {
            if (cell.localName === 'covered-table-cell') continue;
            cells.push(`<td>${await blocks(cell)}</td>`);
          }
          if (cells.length) rows.push(`<tr>${cells.join('')}</tr>`);
        }
        if (rows.length) output.push(`<table><tbody>${rows.join('')}</tbody></table>`);
      } else if (child.namespaceURI === DRAW_NS && child.localName === 'frame') {
        const image = elements(child, DRAW_NS, 'image')[0];
        if (image) output.push(`<p>${await inline(image)}</p>`);
      } else output.push(await blocks(child));
    }
    return output.join('');
  }

  const body = element(content, OFFICE_NS, 'text');
  if (!body) throw new Error('ملف ODT لا يحتوي على نص قابل للقراءة.');
  const bodyHtml = await blocks(body);
  if (!bodyHtml.trim()) throw new Error('ملف ODT لا يحتوي على فقرات أو صور قابلة للقراءة.');
  const referencedFootnotes = footnotes.filter((note) => bodyHtml.includes(`href="#${note.id}"`));
  const html = `<!doctype html><html lang="${escapeHtml(language || 'ar')}" dir="${['ar', 'fa', 'ur', 'he'].includes((language || 'ar').toLowerCase()) ? 'rtl' : 'ltr'}"><head><title>${escapeHtml(title || file.name.replace(/\.odt$/i, ''))}</title>${author ? `<meta name="author" content="${escapeHtml(author)}">` : ''}</head><body><main>${bodyHtml}${referencedFootnotes.length ? `<ol class="footnotes">${referencedFootnotes.map((note) => note.html).join('')}</ol>` : ''}</main></body></html>`;
  const book = await importHtml(html, file.name);
  book.title = title || book.title;
  book.author = author || undefined;
  book.language = language || 'ar';
  book.warnings = [...new Set([...book.warnings, ...warnings])];
  return { ...book, stats: { ...book.stats, images: Math.max(imageCount, book.stats.images) } };
}
