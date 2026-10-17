/**
 * Dependency-free contract model for the v2 foundation spike.
 * A small, dependency-free contract used to verify the domain independently
 * from the React application and its parser dependencies.
 */

export function stableId(prefix, input) {
  let hash = 2166136261;
  for (const char of input) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

export function createPassageId(pageNumber, ordinal, text) {
  return `passage-${pageNumber}-${ordinal}-${stableId('x', text).slice(2)}`;
}

export function createSourceReference({ bookId, bookTitle, sectionTitle, passage }) {
  const label = [bookTitle, sectionTitle].filter(Boolean).join(' — ');
  return {
    markdown: `> «${passage.text}»\n>\n> [${label}](#book=${encodeURIComponent(bookId)}&passage=${encodeURIComponent(passage.id)})`,
    locator: {
      bookId,
      passageId: passage.id,
      sourcePageOrdinal: passage.sourcePageOrdinal,
      titleSnapshot: bookTitle,
      sectionTitleSnapshot: sectionTitle,
      quoteSnapshot: passage.text,
    },
  };
}

export function parseSourceReference(url) {
  if (!url.startsWith('#')) return null;
  const parameters = new URLSearchParams(url.slice(1));
  const bookId = parameters.get('book');
  const passageId = parameters.get('passage');
  return bookId && passageId ? { bookId, passageId } : null;
}
