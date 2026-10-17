import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const fixture = name => resolve(root, 'test-fixtures', 'v2', name);
const read = name => readFile(fixture(name), 'utf8');

const sharedBookContent = [
  'أصول القراءة البحثية',
  'فريق اختبار القارئ الذكي',
  'الفصل الأول القراءة المقصودة',
  'الفصل الثاني التوثيق والعودة',
  'الرجوع إلى المصدر يحفظ سياق الفائدة',
  'https://example.org/manhaj',
  'العنصر',
  '2026',
  '١٢',
];

test('v2 Markdown and HTML fixtures contain the shared Arabic import contract', async () => {
  for (const name of ['research-book.md', 'research-book.html']) {
    const content = await read(name);
    for (const expected of sharedBookContent) {
      assert.ok(content.includes(expected), `${name} is missing ${expected}`);
    }
    assert.equal(
      content.split('الرجوع إلى المصدر يحفظ سياق الفائدة').length - 1,
      3,
      `${name} must retain three identical passages`,
    );
  }
});

test('v2 HTML fixture explicitly declares Arabic RTL semantics and separate footnotes', async () => {
  const html = await read('research-book.html');
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.equal((html.match(/data-source-page=/g) || []).length, 3);
  assert.match(html, /src="\.\/research-figure\.svg"/);
  assert.match(html, /alt="مخطط يربط السؤال بالمصدر ثم بالملاحظة"/);
  assert.match(html, /<table>/);
  assert.match(html, /id="fn-method"/);
  assert.match(html, /id="fn-identity"/);
});

test('v2 Markdown fixture declares three ordered source pages', async () => {
  const markdown = await read('research-book.md');
  assert.deepEqual(
    [...markdown.matchAll(/<!-- sr:page (\d) -->/g)].map(match => match[1]),
    ['1', '2', '3'],
  );
  assert.match(markdown, /!\[مخطط يربط السؤال بالمصدر ثم بالملاحظة\]\(\.\/research-figure\.png\)/);
});

test('v2 research note documents three unresolved source-reference placeholders', async () => {
  const note = await read('research-note.md');
  assert.equal(note.match(/\(#book=BOOK_ID&passage=PASSAGE_ID\)/g)?.length ?? 0, 3);
  assert.match(note, /# ملاحظات في القراءة البحثية/);
});

test('v2 fixture contract and DOCX artifact are present', async () => {
  await Promise.all([
    access(fixture('research-book.docx')),
    access(fixture('expected-results.md')),
  ]);
  const expected = await read('expected-results.md');
  assert.match(expected, /two visibly separate footnotes/);
  assert.match(expected, /page break in its middle/);
  assert.match(expected, /different `passageId`/);
});
