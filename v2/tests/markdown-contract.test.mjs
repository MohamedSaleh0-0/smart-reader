import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceReference, parseSourceReference } from '../src/domain/document.mjs';
import { parseMarkdownContract } from '../src/importers/markdown-contract.mjs';

const root = resolve(import.meta.dirname, '../..');
const source = await readFile(resolve(root, 'test-fixtures/v2/research-book.md'), 'utf8');

test('the Markdown contract preserves three source pages and structure', () => {
  const book = parseMarkdownContract(source);
  assert.equal(book.metadata.title, 'أصول القراءة البحثية');
  assert.equal(book.metadata.author, 'فريق اختبار القارئ الذكي');
  assert.deepEqual(book.sourcePages.map(page => page.number), [1, 2, 3]);
  assert.ok(book.headings.length >= 6);
  assert.equal(book.footnotes.length, 2);
  assert.equal(book.media.length, 1);
  assert.equal(book.media[0].sourcePageOrdinal, 2);
});

test('repeated passages receive distinct stable IDs', () => {
  const book = parseMarkdownContract(source);
  const repeated = book.passages.filter(passage => passage.text.includes('الرجوع إلى المصدر يحفظ سياق الفائدة'));
  assert.equal(repeated.length, 3);
  assert.equal(new Set(repeated.map(passage => passage.id)).size, 3);
  assert.deepEqual(repeated.map(passage => passage.sourcePageOrdinal), [1, 2, 3]);
  assert.deepEqual(parseMarkdownContract(source).passages.map(passage => passage.id), book.passages.map(passage => passage.id));
});

test('a source reference round-trips through the local URL format', () => {
  const book = parseMarkdownContract(source);
  const passage = book.passages.find(item => item.text.includes('الرجوع إلى المصدر'));
  const reference = createSourceReference({
    bookId: 'research-book',
    bookTitle: book.metadata.title,
    sectionTitle: passage.headingContext,
    passage,
  });
  const url = reference.markdown.match(/\((#[^)]+)\)/)[1];
  assert.deepEqual(parseSourceReference(url), { bookId: 'research-book', passageId: passage.id });
  assert.equal(reference.locator.sourcePageOrdinal, 1);
});
