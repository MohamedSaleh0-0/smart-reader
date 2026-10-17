import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import type { BookRecord, Footnote, Passage } from '../domain/types';
import { placeFootnotesByReferencePage } from '../domain/footnote-placement';

type Node = {
  type: string;
  value?: string;
  depth?: number;
  url?: string;
  alt?: string;
  identifier?: string;
  label?: string;
  children?: Node[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
};

type Root = { type: 'root'; children: Node[] };
type MarkdownImageAsset = Pick<File, 'name' | 'type' | 'size' | 'arrayBuffer'> & { webkitRelativePath?: string };
type MarkdownImportOptions = { assets?: readonly MarkdownImageAsset[]; sourcePath?: string };
type HastNode = { type: string; tagName?: string; properties?: Record<string, unknown>; children?: HastNode[] };

type Extracted = {
  headings: BookRecord['headings'];
  passages: Passage[];
  pageNumbers: number[];
  sourcePages: number[];
  pageNumberKind: BookRecord['pageNumberKind'];
  footnotes: Footnote[];
  footnoteReferences: { identifier: string; passageId: string; readerPageNumber: number; sourcePageNumber?: number }[];
  imageCount: number;
  imageSources: string[];
  imageWarnings: string[];
};

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    section: [...(defaultSchema.attributes?.section ?? []), 'dataSourcePage', 'dataReaderPage', 'dataPageLabel', 'dataPageKind'],
    p: [...(defaultSchema.attributes?.p ?? []), 'dataPassageId'],
    div: [...(defaultSchema.attributes?.div ?? []), ['className', 'footnotes']],
    sup: [...(defaultSchema.attributes?.sup ?? []), ['className', 'footnote-ref']],
    a: [...(defaultSchema.attributes?.a ?? []), ['className', 'footnote-backref'], 'id'],
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'dataHeadingId', ['className', 'chapter-heading']],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'dataHeadingId'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'dataHeadingId'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'dataHeadingId'],
    h5: [...(defaultSchema.attributes?.h5 ?? []), 'dataHeadingId'],
    h6: [...(defaultSchema.attributes?.h6 ?? []), 'dataHeadingId'],
    span: [...(defaultSchema.attributes?.span ?? []), ['className', 'chapter-number', 'chapter-title', 'chapter-line']],
  },
  protocols: { ...defaultSchema.protocols, src: [''] },
} satisfies import('hast-util-sanitize').Schema;

const SAFE_MARKDOWN_IMAGE_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp',
};
const MAX_MARKDOWN_IMAGE_BYTES = 16 * 1024 * 1024;
const MAX_MARKDOWN_ASSET_BYTES = 32 * 1024 * 1024;

function hash(value: string): string {
  let result = 2166136261;
  for (const char of value) {
    result ^= char.codePointAt(0) ?? 0;
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function toArabicDigits(value: number): string {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
}

function toWesternDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) >= 0x06f0 ? digit.charCodeAt(0) - 0x06f0 : digit.charCodeAt(0) - 0x0660));
}

function decodedPath(path: string): string {
  const clean = path.split(/[?#]/, 1)[0];
  try { return decodeURIComponent(clean); } catch { return clean; }
}

function normalizedAssetPath(path: string): string {
  const parts: string[] = [];
  for (const part of decodedPath(path).replaceAll('\\', '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/').toLocaleLowerCase();
}

function resolveMarkdownImagePath(sourcePath: string, imagePath: string): string | undefined {
  if (!imagePath || imagePath.startsWith('/') || imagePath.startsWith('#') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(imagePath)) return undefined;
  const sourceParts = normalizedAssetPath(sourcePath).split('/').filter(Boolean);
  sourceParts.pop();
  const targetParts = decodedPath(imagePath).replaceAll('\\', '/').split('/');
  for (const part of targetParts) {
    if (!part || part === '.') continue;
    if (part === '..') sourceParts.pop();
    else sourceParts.push(part);
  }
  return sourceParts.join('/').toLocaleLowerCase();
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

async function createMarkdownAssetResolver(
  assets: readonly MarkdownImageAsset[],
  sourcePath: string,
  warnings: string[],
): Promise<(imagePath: string) => Promise<string | undefined>> {
  const byPath = new Map<string, MarkdownImageAsset[]>();
  const byName = new Map<string, MarkdownImageAsset[]>();
  for (const asset of assets) {
    const path = normalizedAssetPath(asset.webkitRelativePath || asset.name);
    const name = normalizedAssetPath(asset.name).split('/').at(-1) ?? '';
    if (path) byPath.set(path, [...(byPath.get(path) ?? []), asset]);
    if (name) byName.set(name, [...(byName.get(name) ?? []), asset]);
  }

  let totalBytes = 0;
  const encodedAssets = new Map<MarkdownImageAsset, string | undefined>();
  return async (imagePath) => {
    const targetPath = resolveMarkdownImagePath(sourcePath, imagePath);
    if (!targetPath) return undefined;
    const exact = byPath.get(targetPath) ?? [];
    const matches = exact.length ? exact : byName.get(targetPath.split('/').at(-1) ?? '') ?? [];
    if (matches.length !== 1) {
      warnings.push(matches.length > 1
        ? `تعذر تحديد الصورة «${imagePath}» لأن أكثر من ملف مرفق يحمل الاسم نفسه.`
        : `الصورة «${imagePath}» غير مرفقة؛ اختر ملفها مع كتاب Markdown.`);
      return undefined;
    }

    const asset = matches[0];
    if (encodedAssets.has(asset)) return encodedAssets.get(asset);
    const extension = asset.name.split('.').at(-1)?.toLowerCase() ?? '';
    const mime = SAFE_MARKDOWN_IMAGE_MIME[extension];
    if (!mime) {
      warnings.push(`صيغة الصورة «${asset.name}» غير مدعومة في Markdown؛ المتاح PNG وJPEG وGIF وWebP وAVIF وBMP.`);
      encodedAssets.set(asset, undefined);
      return undefined;
    }
    if (asset.size > MAX_MARKDOWN_IMAGE_BYTES || totalBytes + asset.size > MAX_MARKDOWN_ASSET_BYTES) {
      warnings.push(`تجاوزت الصورة «${asset.name}» حد الحجم الآمن للتضمين المحلي.`);
      encodedAssets.set(asset, undefined);
      return undefined;
    }
    const bytes = new Uint8Array(await asset.arrayBuffer());
    totalBytes += bytes.byteLength;
    const dataUrl = `data:${mime};base64,${base64(bytes)}`;
    encodedAssets.set(asset, dataUrl);
    return dataUrl;
  };
}

function resolveMarkdownImagesPlugin(resolveImage: (path: string) => Promise<string | undefined>, packaged: Map<string, string>) {
  let imageOrdinal = 0;
  return async (tree: Root) => {
    const visit = async (node: Node): Promise<void> => {
      if (node.type === 'image' && node.url && !node.url.startsWith('/') && !node.url.startsWith('#') && !/^(?:https?:|\/\/)/i.test(node.url)) {
        const dataUrl = await resolveImage(node.url);
        if (dataUrl) {
          const marker = `#sr-local-image-${++imageOrdinal}`;
          packaged.set(marker, dataUrl);
          node.url = marker;
        }
      }
      if (node.children) for (const child of node.children) await visit(child);
    };
    for (const node of tree.children) await visit(node);
  };
}

function embedSanitizedImagesPlugin(packaged: ReadonlyMap<string, string>) {
  return (tree: HastNode) => {
    const visit = (node: HastNode) => {
      if (node.type === 'element' && node.tagName === 'img' && typeof node.properties?.src === 'string') {
        const safeDataUrl = packaged.get(node.properties.src);
        if (safeDataUrl) node.properties.src = safeDataUrl;
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

function textContent(node: Node): string {
  if (node.type === 'text') return node.value ?? '';
  if (node.type === 'image') return node.alt ?? '';
  return (node.children ?? []).map(textContent).join('');
}

function footnoteIdentifiers(node: Node): string[] {
  const own = node.type === 'footnoteReference' && node.identifier ? [node.identifier] : [];
  return own.concat((node.children ?? []).flatMap(footnoteIdentifiers));
}

function readFrontMatter(source: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) return { content: source, metadata: {} as Record<string, string> };
  const metadata: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([\w-]+):\s*(.*?)\s*$/.exec(line);
    if (field) metadata[field[1]] = field[2].replace(/^(?:"(.*)"|'(.*)')$/, '$1$2');
  }
  return { content: source.slice(match[0].length), metadata };
}

function structurePlugin(extracted: Extracted) {
  return (tree: Root) => {
    const hasSourcePageMarkers = tree.children.some((node) => node.type === 'html' && /^\s*<!--\s*sr:page\s+([\d٠-٩۰-۹]+)\s*-->\s*$/.test(node.value ?? ''));
    const pages = new Map<number, Node[]>();
    let pageNumber = 1;
    pages.set(pageNumber, []);

    if (hasSourcePageMarkers) {
      for (const node of tree.children) {
        const pageMarker = node.type === 'html'
          ? /^\s*<!--\s*sr:page\s+([\d٠-٩۰-۹]+)\s*-->\s*$/.exec(node.value ?? '')
          : null;
        if (pageMarker) {
          const markerPage = Number(toWesternDigits(pageMarker[1]));
          if (pages.size === 1 && pageNumber === 1 && pages.get(1)?.length === 0 && markerPage !== 1) pages.delete(1);
          pageNumber = markerPage;
          if (!pages.has(pageNumber)) pages.set(pageNumber, []);
          continue;
        }
        pages.get(pageNumber)!.push(node);
      }
    } else {
      const wordCount = (node: Node) => textContent(node).trim().split(/\s+/).filter(Boolean).length;
      let words = 0;
      for (const node of tree.children) {
        const current = pages.get(pageNumber)!;
        const startsChapter = node.type === 'heading' && node.depth === 1;
        if (current.length && (startsChapter || (words >= 280 && node.type !== 'heading'))) {
          pageNumber += 1;
          pages.set(pageNumber, []);
          words = 0;
        }
        pages.get(pageNumber)!.push(node);
        words += wordCount(node);
      }
    }
    extracted.pageNumbers = [...pages.keys()];
    extracted.sourcePages = hasSourcePageMarkers ? [...pages.keys()] : [];
    extracted.pageNumberKind = hasSourcePageMarkers ? 'source' : 'virtual';

    const definitions = new Map<string, { node: Node; page: number }>();
    for (const [sourcePageOrdinal, children] of pages) {
      for (const node of children) {
        if (node.type !== 'footnoteDefinition') continue;
        const id = node.identifier ?? node.label ?? `footnote-${definitions.size + 1}`;
        definitions.set(id, { node, page: sourcePageOrdinal });
        extracted.footnotes.push({
          id,
          text: textContent(node).trim(),
          definitionReaderPage: sourcePageOrdinal,
          ...(hasSourcePageMarkers ? { sourcePageNumber: sourcePageOrdinal } : {}),
          referencedBy: [],
        });
      }
    }

    const pageRecords: { readerPageNumber: number; children: Node[] }[] = [];
    const pageNodes: Node[] = [];
    for (const [sourcePageOrdinal, children] of pages) {
      let headingContext: string | undefined;
      let paragraphOrdinal = 0;
      const bodyChildren = children.filter((node) => node.type !== 'footnoteDefinition');

      const visit = (node: Node) => {
        if (node.type === 'heading') {
          const title = textContent(node).trim();
          headingContext = title || headingContext;
          const headingId = `heading-${sourcePageOrdinal}-${extracted.headings.length + 1}`;
          const level = node.depth ?? 1;
          const hProperties: Record<string, unknown> = { ...node.data?.hProperties, dataHeadingId: headingId };
          if (level === 1) {
            const chapterNumber = extracted.headings.filter((heading) => heading.level === 1).length + 1;
            const headingChildren = node.children ?? [];
            hProperties.className = ['chapter-heading'];
            node.children = [
              { type: 'srChapterNumber', data: { hName: 'span', hProperties: { className: ['chapter-number'] } }, children: [{ type: 'text', value: toArabicDigits(chapterNumber) }] },
              { type: 'srChapterTitle', data: { hName: 'span', hProperties: { className: ['chapter-title'] } }, children: headingChildren },
              { type: 'srChapterLine', data: { hName: 'span', hProperties: { className: ['chapter-line'] } }, children: [] },
            ];
          }
          node.data = { ...node.data, hProperties };
          extracted.headings.push({
            id: headingId,
            level,
            title,
            readerPageNumber: sourcePageOrdinal,
            ...(hasSourcePageMarkers ? { sourcePageNumber: sourcePageOrdinal } : {}),
          });
          return;
        }
        if (node.type === 'paragraph') {
          const text = textContent(node).trim();
          if (text) {
            paragraphOrdinal += 1;
            const id = `passage-${sourcePageOrdinal}-${paragraphOrdinal}-${hash(text)}`;
            const footnoteIds = [...new Set(footnoteIdentifiers(node).filter((identifier) => definitions.has(identifier)))];
            node.data = {
              ...node.data,
              hProperties: { ...node.data?.hProperties, dataPassageId: id },
            };
            extracted.passages.push({
              id,
              text,
              readerPageNumber: sourcePageOrdinal,
              ...(hasSourcePageMarkers ? { sourcePageNumber: sourcePageOrdinal } : {}),
              headingContext,
              footnoteIds,
            });
            for (const identifier of footnoteIds) {
              extracted.footnoteReferences.push({
                identifier,
                passageId: id,
                readerPageNumber: sourcePageOrdinal,
                ...(hasSourcePageMarkers ? { sourcePageNumber: sourcePageOrdinal } : {}),
              });
            }
          }
        }
        if (node.type === 'image') {
          extracted.imageCount += 1;
          if (node.url) extracted.imageSources.push(node.url);
        }
        for (const child of node.children ?? []) visit(child);
      };

      bodyChildren.forEach(visit);
      pageRecords.push({ readerPageNumber: sourcePageOrdinal, children: bodyChildren });
    }

    const footnotePlacement = placeFootnotesByReferencePage(
      extracted.footnotes.map((footnote) => footnote.id),
      extracted.footnoteReferences.map(({ identifier, readerPageNumber }) => ({ id: identifier, pageKey: readerPageNumber })),
      new Map(extracted.footnotes.map((footnote) => [footnote.id, footnote.definitionReaderPage])),
    );
    for (const footnote of extracted.footnotes) {
      const references = extracted.footnoteReferences.filter((reference) => reference.identifier === footnote.id);
      if (!references.length) continue;
      footnote.definitionReaderPage = references[0].readerPageNumber;
      if (references[0].sourcePageNumber !== undefined) footnote.sourcePageNumber = references[0].sourcePageNumber;
    }
    const footnoteNumbersByPage = new Map([...footnotePlacement.placementsByPage].map(([page, placements]) => [
      page,
      new Map(placements.map(({ id, number }) => [id, number])),
    ]));
    const referenceKey = (id: string, page: number) => `${page}\u0000${id}`;
    const footnoteTarget = (id: string, page: number) => `sr-footnote-${hash(`${id}-${page}`)}`;
    const referenceCounts = new Map<string, number>();
    const firstReference = new Map<string, string>();

    const renderReferences = (node: Node, readerPageNumber: number): Node => {
      if (node.type === 'footnoteReference' && node.identifier && definitions.has(node.identifier)) {
        const identifier = node.identifier;
        const key = referenceKey(identifier, readerPageNumber);
        const occurrence = (referenceCounts.get(key) ?? 0) + 1;
        referenceCounts.set(key, occurrence);
        const referenceId = `sr-footnote-ref-${hash(`${identifier}-${readerPageNumber}-${occurrence}`)}`;
        if (!firstReference.has(key)) firstReference.set(key, referenceId);
        const anchor: Node = {
          type: 'srFootnoteLink',
          data: { hName: 'a', hProperties: { href: `#user-content-${footnoteTarget(identifier, readerPageNumber)}`, id: referenceId } },
          children: [{ type: 'text', value: toArabicDigits(footnoteNumbersByPage.get(readerPageNumber)?.get(identifier) ?? occurrence) }],
        };
        return { type: 'srFootnoteReference', data: { hName: 'sup', hProperties: { className: ['footnote-ref'] } }, children: [anchor] };
      }
      return { ...node, children: node.children?.map((child) => renderReferences(child, readerPageNumber)) };
    };

    const definitionsById = new Map(extracted.footnotes.map((footnote) => [footnote.id, definitions.get(footnote.id)!.node]));
    for (const { readerPageNumber: sourcePageOrdinal, children } of pageRecords) {
      const readerPageNumber = sourcePageOrdinal;
      const renderedChildren = children.map((child) => renderReferences(child, readerPageNumber));
      const listItems = (footnotePlacement.placementsByPage.get(readerPageNumber) ?? []).map(({ id, number }) => {
        const definition = definitionsById.get(id);
        const body = definition?.children ?? [];
        const firstParagraphIndex = body.findIndex((node) => node.type === 'paragraph');
        const footnoteBody = body.length ? body.map((node) => renderReferences(node, readerPageNumber)) : [{ type: 'paragraph', children: [{ type: 'text', value: '' }] }];
        if (firstParagraphIndex >= 0) {
          const firstParagraph = footnoteBody[firstParagraphIndex];
          const backrefId = firstReference.get(referenceKey(id, readerPageNumber));
          const backref: Node[] = backrefId ? [{
            type: 'srFootnoteBackref',
            data: { hName: 'a', hProperties: { className: ['footnote-backref'], href: `#user-content-${backrefId}`, ariaLabel: 'العودة إلى موضع الحاشية' } },
            children: [{ type: 'text', value: ' ↩' }],
          }] : [];
          firstParagraph.children = [
            { type: 'text', value: `(${toArabicDigits(number)}) ` },
            ...(firstParagraph.children ?? []),
            ...backref,
          ];
        }
        return {
          type: 'srFootnoteItem',
          data: { hName: 'li', hProperties: { id: footnoteTarget(id, readerPageNumber) } },
          children: footnoteBody,
        } as Node;
      });
      if (listItems.length) {
        renderedChildren.push({
          type: 'srFootnoteBlock',
          data: { hName: 'div', hProperties: { className: ['footnotes'] } },
          children: [{ type: 'srFootnoteList', data: { hName: 'ol' }, children: listItems }],
        });
      }

      const page: Node = {
        type: 'srPage',
        children: renderedChildren,
        data: {
          hName: 'section',
          hProperties: {
            ...(hasSourcePageMarkers ? { dataSourcePage: sourcePageOrdinal } : {}),
            dataReaderPage: sourcePageOrdinal,
            dataPageLabel: toArabicDigits(sourcePageOrdinal),
            dataPageKind: extracted.pageNumberKind,
          },
        },
      };
      pageNodes.push(page);
    }
    tree.children = pageNodes;
  };
}

export async function importMarkdown(source: string, sourceName: string, options: MarkdownImportOptions = {}): Promise<BookRecord & {
  stats: { footnotes: number; images: number };
}> {
  const { content, metadata } = readFrontMatter(source);
  const imageWarnings: string[] = [];
  const resolveImage = await createMarkdownAssetResolver(options.assets ?? [], options.sourcePath ?? sourceName, imageWarnings);
  const packagedImages = new Map<string, string>();
  const extracted: Extracted = {
    headings: [],
    passages: [],
    pageNumbers: [],
    sourcePages: [],
    pageNumberKind: 'virtual',
    footnotes: [],
    footnoteReferences: [],
    imageCount: 0,
    imageSources: [],
    imageWarnings,
  };
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(resolveMarkdownImagesPlugin, resolveImage, packagedImages)
    .use(structurePlugin, extracted)
    .use(remarkRehype)
    .use(rehypeSanitize, schema)
    .use(embedSanitizedImagesPlugin, packagedImages)
    .use(rehypeStringify)
    .process(content);

  const sourcePageCount = extracted.sourcePages.length;
  for (const footnote of extracted.footnotes) {
    footnote.referencedBy = extracted.footnoteReferences
      .filter((reference) => reference.identifier === footnote.id)
      .map(({ passageId, readerPageNumber, sourcePageNumber }) => ({ passageId, readerPageNumber, sourcePageNumber }));
  }
  const title = metadata.title || extracted.headings[0]?.title || sourceName.replace(/\.[^.]+$/, '');
  const id = `book-${hash(`${title}\n${source}`)}`;
  const warnings = [...new Set([
    ...extracted.imageWarnings,
    ...extracted.imageSources.flatMap((url) => /^https?:\/\//i.test(url) || url.startsWith('//')
      ? ['External images are blocked; import the image file locally to avoid remote requests.']
      : []),
  ])];
  return {
    id,
    title,
    author: metadata.author,
    language: metadata.language || 'ar',
    html: String(file),
    headings: extracted.headings,
    passages: extracted.passages,
    footnotes: extracted.footnotes,
    sourcePages: extracted.sourcePages,
    readerPages: extracted.pageNumbers,
    sourcePageCount,
    readerPageCount: extracted.pageNumbers.length,
    pageNumberKind: extracted.pageNumberKind,
    importedAt: new Date().toISOString(),
    sourceName,
    warnings,
    stats: { footnotes: extracted.footnotes.length, images: extracted.imageCount },
  };
}
