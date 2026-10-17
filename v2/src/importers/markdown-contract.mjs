import { createPassageId } from '../domain/document.mjs';

function metadataValue(frontMatter, key) {
  const match = new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(frontMatter);
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : undefined;
}

function stripFrontMatter(source) {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

function sourcePages(source) {
  const matches = [...source.matchAll(/^<!--\s*sr:page\s+(\d+)\s*-->\s*$/gm)];
  if (!matches.length) return [{ number: 1, text: source, sourceOrder: 1 }];
  return matches.map((match, index) => ({
    number: Number(match[1]),
    sourceOrder: index + 1,
    text: source.slice(match.index + match[0].length, matches[index + 1]?.index ?? source.length),
  }));
}

export function parseMarkdownContract(source) {
  const frontMatterMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  const frontMatter = frontMatterMatch?.[1] ?? '';
  const cleanSource = stripFrontMatter(source);
  const pages = sourcePages(cleanSource);
  const headings = [];
  const footnotes = [];
  const media = [];
  const passages = [];

  for (const page of pages) {
    const lines = page.text.split(/\r?\n/);
    let passageOrdinal = 0;
    let headingContext;
    for (const line of lines) {
      const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
      if (heading) {
        headingContext = heading[2];
        headings.push({
          id: `heading-${page.number}-${headings.length + 1}`,
          level: heading[1].length,
          title: heading[2],
          sourcePageOrdinal: page.number,
        });
        continue;
      }
      const footnote = /^\[\^([^\]]+)\]:\s*(.+)$/.exec(line);
      if (footnote) {
        footnotes.push({ id: footnote[1], text: footnote[2], sourcePageOrdinal: page.number });
        continue;
      }
      const image = /!\[([^\]]*)\]\(([^)]+)\)/.exec(line);
      if (image) {
        media.push({
          id: `media-${page.number}-${media.length + 1}`,
          altText: image[1],
          source: image[2],
          sourcePageOrdinal: page.number,
          orderInSegment: media.length + 1,
        });
      }
      if (!line.trim() || /^\|/.test(line) || /^<!--/.test(line) || /^\s*[-*_]{3,}\s*$/.test(line)) continue;
      if (/^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line)) continue;
      if (/^\s*>/.test(line)) continue;
      passageOrdinal += 1;
      passages.push({
        id: createPassageId(page.number, passageOrdinal, line.trim()),
        text: line.trim(),
        sourcePageOrdinal: page.number,
        headingContext,
      });
    }
  }

  return {
    kind: 'structured-book',
    metadata: {
      title: metadataValue(frontMatter, 'title') ?? headings[0]?.title ?? 'Untitled book',
      author: metadataValue(frontMatter, 'author'),
      language: metadataValue(frontMatter, 'language') ?? 'ar',
    },
    sourcePages: pages.map(({ text: _text, ...page }) => page),
    headings,
    passages,
    footnotes,
    media,
  };
}
