import type { Passage } from './types';
import { joinPassageParts } from './passage-text';

export function appendPassageFragment(
  passage: Passage,
  fragment: { text: string; readerPageNumber: number; footnoteIds?: readonly string[] },
): Passage {
  return {
    ...passage,
    text: joinPassageParts([passage.text, fragment.text]),
    readerPageEndNumber: fragment.readerPageNumber,
    footnoteIds: [...new Set([...(passage.footnoteIds ?? []), ...(fragment.footnoteIds ?? [])])],
  };
}
