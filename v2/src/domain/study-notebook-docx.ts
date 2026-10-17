import type { BookRecord, StudyData } from './types';
import type { StudyNotebookViewEntry } from './study';

function compactId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function shortHash(value: string): string {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.codePointAt(0) ?? 0;
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function validBookmark(value: string): string | undefined {
  return value.length <= 40 && /^[A-Za-z][A-Za-z0-9_]*$/.test(value) ? value : undefined;
}

export function notebookEntryBookmarkName(id: string, passageId: string): string | undefined {
  return validBookmark(`nbn_${shortHash(id)}_${passageId.replace(/-/g, '_')}`);
}

export function studyNotebookBookmarkName(entry: StudyNotebookViewEntry): string | undefined {
  if (entry.kind === 'comment') return validBookmark(`nb_${entry.passageId.replace(/-/g, '_')}`);
  if (entry.highlightId) return validBookmark(`nb_h_${compactId(entry.highlightId)}`);
  return notebookEntryBookmarkName(entry.id, entry.passageId);
}

export type StudyNotebookWordEdit = {
  bookmarkName: string;
  text: string;
  quote?: string;
};

function passageIdForBookmark(bookmarkName: string): string | undefined {
  if (bookmarkName.startsWith('nb_h_')) return undefined;
  if (bookmarkName.startsWith('nbn_')) {
    const match = bookmarkName.match(/^nbn_[a-z0-9]+_(.+)$/);
    return match?.[1].replace(/_/g, '-');
  }
  if (bookmarkName.startsWith('nb_')) return bookmarkName.slice(3).replace(/_/g, '-');
  return undefined;
}

function noteEntryBookmarkMatches(bookmarkName: string, entry: StudyData['notebook'][number]): boolean {
  return notebookEntryBookmarkName(entry.id, entry.passageId) === bookmarkName;
}

export function applyStudyNotebookWordEdits(
  book: Pick<BookRecord, 'passages'>,
  study: StudyData,
  edits: readonly StudyNotebookWordEdit[],
  updatedAt = new Date().toISOString(),
  createId: () => string = () => crypto.randomUUID(),
): { study: StudyData; changed: number; ignored: number } {
  const passages = new Map(book.passages.map((passage) => [passage.id, passage]));
  let next = study;
  let changed = 0;
  let ignored = 0;

  for (const edit of edits) {
    const text = edit.text.replace(/\s+$/, '');
    if (edit.bookmarkName.startsWith('nb_h_')) {
      const highlightToken = edit.bookmarkName.slice('nb_h_'.length);
      const highlight = next.highlights.find((item) => compactId(item.id) === highlightToken);
      if (!highlight) { ignored += 1; continue; }
      const entry = next.notebook.find((item) => item.highlightId === highlight.id);
      if (!text) {
        if (entry) {
          next = { ...next, notebook: next.notebook.filter((item) => item.id !== entry.id) };
          changed += 1;
        }
      } else if (entry) {
        if (entry.text !== text) {
          next = { ...next, notebook: next.notebook.map((item) => item.id === entry.id ? { ...item, text, html: undefined } : item) };
          changed += 1;
        }
      } else {
        next = { ...next, notebook: [...next.notebook, { id: createId(), passageId: highlight.passageId, highlightId: highlight.id, quote: highlight.quote, text, createdAt: updatedAt }] };
        changed += 1;
      }
      continue;
    }

    const passageId = passageIdForBookmark(edit.bookmarkName);
    const passage = passageId ? passages.get(passageId) : undefined;
    if (!passage || !passageId) { ignored += 1; continue; }

    if (edit.bookmarkName.startsWith('nbn_')) {
      const entry = next.notebook.find((item) => noteEntryBookmarkMatches(edit.bookmarkName, item));
      if (!text) {
        if (entry) {
          next = { ...next, notebook: next.notebook.filter((item) => item.id !== entry.id) };
          changed += 1;
        }
      } else if (entry) {
        if (entry.text !== text) {
          next = { ...next, notebook: next.notebook.map((item) => item.id === entry.id ? { ...item, text } : item) };
          changed += 1;
        }
      } else {
        next = { ...next, notebook: [...next.notebook, { id: createId(), passageId, quote: edit.quote?.trim() || passage.text, text, createdAt: updatedAt }] };
        changed += 1;
      }
      continue;
    }

    const comment = next.comments.find((item) => item.passageId === passageId);
    if (!text) {
      if (comment) {
        next = { ...next, comments: next.comments.filter((item) => item.passageId !== passageId) };
        changed += 1;
      }
    } else if (comment) {
      if (comment.text !== text) {
        next = { ...next, comments: next.comments.map((item) => item.passageId === passageId ? { ...item, text, html: undefined, updatedAt } : item) };
        changed += 1;
      }
    } else {
      next = { ...next, comments: [...next.comments, { id: createId(), passageId, quote: passage.text, text, updatedAt }] };
      changed += 1;
    }
  }

  return { study: next, changed, ignored };
}
