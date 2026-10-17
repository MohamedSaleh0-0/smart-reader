import type { BookRecord, StudyData } from '../domain/types';
import { applyStudyNotebookWordEdits, type StudyNotebookWordEdit } from '../domain/study-notebook-docx';
import { readDocxDocumentXml } from './docx';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function wordText(node: Node): string {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element;
    if (element.namespaceURI === WORD_NS && element.localName === 't') return element.textContent ?? '';
    if (element.namespaceURI === WORD_NS && element.localName === 'br') return '\n';
    if (element.namespaceURI === WORD_NS && element.localName === 'tab') return '\t';
  }
  return Array.from(node.childNodes).map(wordText).join('');
}

function paragraphText(paragraph: Element): string {
  return wordText(paragraph);
}

function bookmarkNames(paragraph: Element): string[] {
  return Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 'bookmarkStart'))
    .map((bookmark) => bookmark.getAttributeNS(WORD_NS, 'name') ?? bookmark.getAttribute('w:name') ?? '')
    .filter((name) => /^(?:nb_[A-Za-z0-9_]+|nbn_[A-Za-z0-9_]+)$/.test(name));
}

function headingStyle(paragraph: Element): string {
  const style = paragraph.getElementsByTagNameNS(WORD_NS, 'pStyle')[0];
  return style?.getAttributeNS(WORD_NS, 'val') ?? style?.getAttribute('w:val') ?? '';
}

export type StudyNotebookWordParagraph = { bookmarks: string[]; style: string; text: string; quote?: string };

export function collectStudyNotebookWordEdits(paragraphs: readonly StudyNotebookWordParagraph[]): StudyNotebookWordEdit[] {
  const edits: StudyNotebookWordEdit[] = [];
  let currentBookmark: string | undefined;
  let currentQuote = '';
  let readingComment = false;
  let commentLines: string[] = [];
  const finish = () => {
    if (currentBookmark && readingComment) edits.push({ bookmarkName: currentBookmark, text: commentLines.join('\n').replace(/\s+$/, ''), quote: currentQuote });
  };

  for (const paragraph of paragraphs) {
    const names = paragraph.bookmarks;
    if (names.length) {
      finish();
      currentBookmark = names.find((name) => !name.startsWith('nbn_')) ?? names[0];
      currentQuote = paragraph.quote ?? '';
      readingComment = false;
      commentLines = [];
      continue;
    }

    if (/^(?:Heading|Title)/.test(paragraph.style)) {
      finish();
      currentBookmark = undefined;
      readingComment = false;
      commentLines = [];
      continue;
    }
    if (!currentBookmark) continue;

    const text = paragraph.text;
    if (!readingComment) {
      const match = text.match(/^\s*تعليق:\s?([\s\S]*)$/);
      if (match) {
        readingComment = true;
        commentLines = [match[1]];
      }
      continue;
    }
    if (!text.trim()) {
      finish();
      currentBookmark = undefined;
      readingComment = false;
      commentLines = [];
    } else commentLines.push(text);
  }
  finish();
  return edits;
}

export function parseStudyNotebookWordXml(source: string): StudyNotebookWordEdit[] {
  if (typeof DOMParser === 'undefined') throw new Error('استيراد Word يحتاج إلى متصفح يدعم تحليل XML.');
  const document = new DOMParser().parseFromString(source, 'application/xml');
  if (!document.documentElement || document.querySelector('parsererror')) throw new Error('تعذر تحليل المستند داخل ملف Word.');
  const paragraphs = Array.from(document.getElementsByTagNameNS(WORD_NS, 'p')).map((paragraph) => ({
    bookmarks: bookmarkNames(paragraph),
    style: headingStyle(paragraph),
    text: paragraphText(paragraph),
    quote: Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 'r'))
      .map((run) => wordText(run))
      .find((text) => text.trim()),
  }));
  return collectStudyNotebookWordEdits(paragraphs);
}

export async function readStudyNotebookWordEdits(buffer: ArrayBuffer): Promise<StudyNotebookWordEdit[]> {
  return parseStudyNotebookWordXml(await readDocxDocumentXml(buffer));
}

export async function importStudyNotebookDocx(
  buffer: ArrayBuffer,
  book: Pick<BookRecord, 'passages'>,
  study: StudyData,
  updatedAt = new Date().toISOString(),
  createId = () => crypto.randomUUID(),
) {
  return applyStudyNotebookWordEdits(book, study, await readStudyNotebookWordEdits(buffer), updatedAt, createId);
}
