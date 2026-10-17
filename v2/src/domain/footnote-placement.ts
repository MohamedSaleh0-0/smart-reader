export type FootnotePageReference = { id: string; pageKey: number };
export type FootnotePlacement = { id: string; pageKey: number; number: number };

export function placeFootnotesByReferencePage(
  footnoteIds: readonly string[],
  references: readonly FootnotePageReference[],
  authoredPageById: ReadonlyMap<string, number>,
): { placementsByPage: Map<number, FootnotePlacement[]>; firstReferencePageById: Map<string, number> } {
  const knownIds = new Set(footnoteIds);
  const idsByPage = new Map<number, string[]>();
  const firstReferencePageById = new Map<string, number>();

  for (const reference of references) {
    if (!knownIds.has(reference.id)) continue;
    const pageIds = idsByPage.get(reference.pageKey) ?? [];
    if (!pageIds.includes(reference.id)) pageIds.push(reference.id);
    idsByPage.set(reference.pageKey, pageIds);
    if (!firstReferencePageById.has(reference.id)) firstReferencePageById.set(reference.id, reference.pageKey);
  }

  for (const id of footnoteIds) {
    if (firstReferencePageById.has(id)) continue;
    const pageKey = authoredPageById.get(id);
    if (pageKey === undefined) continue;
    const pageIds = idsByPage.get(pageKey) ?? [];
    if (!pageIds.includes(id)) pageIds.push(id);
    idsByPage.set(pageKey, pageIds);
  }

  const placementsByPage = new Map<number, FootnotePlacement[]>();
  for (const [pageKey, ids] of idsByPage) {
    placementsByPage.set(pageKey, ids.map((id, index) => ({ id, pageKey, number: index + 1 })));
  }
  return { placementsByPage, firstReferencePageById };
}
