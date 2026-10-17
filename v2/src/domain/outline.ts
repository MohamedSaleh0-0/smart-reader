import type { BookRecord } from './types';
import { normalizeArabicSearch } from './search';

export type OutlineHeading = BookRecord['headings'][number];

export type OutlineNode = {
  heading: OutlineHeading;
  children: OutlineNode[];
};

/** Builds a nested outline from an ordered heading stream. Skipped levels attach
 * to the nearest preceding heading with a smaller level; leading headings stay roots. */
export function buildOutline(headings: readonly OutlineHeading[]): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: { level: number; node: OutlineNode }[] = [];

  for (const heading of headings) {
    const node: OutlineNode = { heading, children: [] };
    while (stack.length && stack.at(-1)!.level >= heading.level) stack.pop();
    const parent = stack.at(-1)?.node;
    (parent?.children ?? roots).push(node);
    stack.push({ level: heading.level, node });
  }

  return roots;
}

/** Filters headings while retaining every ancestor needed to show their path. */
export function filterOutline(nodes: readonly OutlineNode[], query: string): OutlineNode[] {
  const normalizedQuery = normalizeArabicSearch(query);
  if (!normalizedQuery) return nodes as OutlineNode[];

  return nodes.flatMap((node) => {
    const children = filterOutline(node.children, normalizedQuery);
    if (!normalizeArabicSearch(node.heading.title).includes(normalizedQuery) && children.length === 0) return [];
    return [{ ...node, children }];
  });
}

export function expandableOutlineIds(nodes: readonly OutlineNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.children.length ? [node.heading.id] : []),
    ...expandableOutlineIds(node.children),
  ]);
}

/** Returns the IDs of parent branches from the root to the target's parent. */
export function outlineAncestorIds(nodes: readonly OutlineNode[], targetId: string, ancestors: string[] = []): string[] | undefined {
  for (const node of nodes) {
    if (node.heading.id === targetId) return ancestors;
    const result = outlineAncestorIds(node.children, targetId, [...ancestors, node.heading.id]);
    if (result) return result;
  }
  return undefined;
}
