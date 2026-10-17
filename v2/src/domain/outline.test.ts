import { describe, expect, it } from 'vitest';
import { buildOutline, expandableOutlineIds, filterOutline, outlineAncestorIds, type OutlineHeading } from './outline';

function heading(id: string, level: number): OutlineHeading {
  return { id, level, title: id, readerPageNumber: 1 };
}

describe('hierarchical contents outline', () => {
  it('nests sections under the nearest preceding shallower heading and preserves order', () => {
    const tree = buildOutline([
      heading('chapter-1', 1),
      heading('section-1', 2),
      heading('topic-1', 3),
      heading('section-2', 2),
      heading('chapter-2', 1),
    ]);

    expect(tree.map((node) => node.heading.id)).toEqual(['chapter-1', 'chapter-2']);
    expect(tree[0].children.map((node) => node.heading.id)).toEqual(['section-1', 'section-2']);
    expect(tree[0].children[0].children.map((node) => node.heading.id)).toEqual(['topic-1']);
  });

  it('handles skipped levels and headings that precede any top-level heading', () => {
    const tree = buildOutline([heading('orphan-topic', 3), heading('chapter', 1), heading('deep-topic', 4)]);

    expect(tree.map((node) => node.heading.id)).toEqual(['orphan-topic', 'chapter']);
    expect(tree[1].children[0].heading.id).toBe('deep-topic');
  });

  it('returns an empty tree for a book with no headings', () => {
    expect(buildOutline([])).toEqual([]);
  });

  it('filters by normalized Arabic text without losing the heading path', () => {
    const tree = buildOutline([
      heading('الفصل الأول', 1),
      heading('المبحث الثاني', 2),
      heading('عنوان النتيجة', 3),
      heading('مبحث آخر', 2),
    ]);
    const filtered = filterOutline(tree, 'النتيجة');

    expect(filtered.map((node) => node.heading.title)).toEqual(['الفصل الأول']);
    expect(filtered[0].children[0].heading.title).toBe('المبحث الثاني');
    expect(filtered[0].children[0].children[0].heading.title).toBe('عنوان النتيجة');
  });

  it('lists expandable branches and returns only the ancestors of a target', () => {
    const tree = buildOutline([heading('chapter', 1), heading('section', 2), heading('topic', 3)]);

    expect(expandableOutlineIds(tree)).toEqual(['chapter', 'section']);
    expect(outlineAncestorIds(tree, 'topic')).toEqual(['chapter', 'section']);
    expect(outlineAncestorIds(tree, 'chapter')).toEqual([]);
    expect(outlineAncestorIds(tree, 'missing')).toBeUndefined();
  });
});
