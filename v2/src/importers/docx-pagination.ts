export type DocxPageBreak = { kind: 'break'; hard: boolean };
export type DocxPageContentBlock = {
  kind: 'heading' | 'paragraph' | 'list' | 'table' | 'figure';
  html: string;
  level?: number;
  listKind?: 'ol' | 'ul';
  passageGroupId?: string;
  continuation?: boolean;
};
export type DocxImportBlock = DocxPageContentBlock | DocxPageBreak;

export function groupDocxPages(
  blocks: readonly DocxImportBlock[],
  options: { hasHardBreaks: boolean; useSoftBreaks: boolean },
): DocxImportBlock[][] {
  const pages: DocxImportBlock[][] = [];
  let current: DocxImportBlock[] = [];
  let words = 0;
  const hasContent = () => current.some((block) => block.kind !== 'break');
  const flushContentPage = () => {
    if (hasContent()) pages.push(current);
    current = [];
    words = 0;
  };

  for (const block of blocks) {
    if (block.kind === 'break') {
      if (block.hard && options.hasHardBreaks) {
        if (hasContent()) flushContentPage();
        else pages.push([]);
      } else if (!block.hard && options.useSoftBreaks && hasContent()) {
        // Layout-derived Word breaks are hints, not proof of an intentionally blank page.
        flushContentPage();
      }
      continue;
    }

    const text = block.html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const isTopHeading = block.kind === 'heading' && block.level === 1;
    const wordCount = text ? text.split(/\s+/).length : 0;
    if (!options.hasHardBreaks && !options.useSoftBreaks && current.length && (isTopHeading || (words >= 280 && block.kind !== 'heading'))) {
      flushContentPage();
    }
    current.push(block);
    words += wordCount;
  }

  flushContentPage();
  return pages;
}
