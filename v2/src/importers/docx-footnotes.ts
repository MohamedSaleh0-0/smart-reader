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

export function localizeDocxFootnoteLinks(
  markup: string,
  options: {
    bookId: string;
    pageNumber: number;
    footnoteIdByAttribute: ReadonlyMap<string, string>;
    numberByFootnoteId: ReadonlyMap<string, number>;
  },
): { markup: string; references: { id: string; referenceId?: string }[] } {
  const references: { id: string; referenceId?: string }[] = [];
  const localized = markup.replace(/<a\b[^>]*data-sr-footnote-id="[^"]+"[^>]*>[\s\S]*?<\/a>/g, (anchor) => {
    const attributeId = /\bdata-sr-footnote-id="([^"]+)"/.exec(anchor)?.[1];
    const id = attributeId ? options.footnoteIdByAttribute.get(attributeId) : undefined;
    if (!id) return anchor;
    const referenceId = /(?:^|\s)id="([^"]+)"/.exec(anchor)?.[1];
    references.push({ id, referenceId });
    const target = `sr-docx-fn-${hash(`${options.bookId}:${id}:${options.pageNumber}`)}`;
    const number = arabicDigits(options.numberByFootnoteId.get(id) ?? 1);
    return anchor
      .replace(/\bhref="[^"]*"/, `href="#${target}"`)
      .replace(/>([^<]*)<\/a>$/, `>${number}</a>`);
  });
  return { markup: localized, references };
}
