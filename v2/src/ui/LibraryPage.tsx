import { useEffect, useMemo, useState } from 'react';
import { normalizeArabicSearch } from '../domain/search';
import { searchLibrary, type LibrarySearchGroup, type LibrarySearchMatch } from '../domain/library-search';
import { sortLibraryBooks, type LibrarySort } from '../domain/library-order';
import { listShelfTags, normalizeShelfTag } from '../domain/library-tags';
import { readerProgressPercent } from '../domain/reading-progress';
import type { BookRecord, LibraryFolder } from '../domain/types';
import { toArabicDigits } from '../domain/citation';
import { Icon } from './Icon';

const ALL_BOOKS = 'all';
const UNFILED_BOOKS = 'unfiled';

type LibraryPageProps = {
  books: BookRecord[];
  folders: LibraryFolder[];
  activeBookId?: string;
  currentPage: number;
  searchInput: string;
  searchQuery: string;
  folderFilter: string;
  authorFilter: string;
  tagFilter: string;
  sort: LibrarySort;
  isBusy: boolean;
  onSearchInput: (value: string) => void;
  onFolderFilter: (value: string) => void;
  onAuthorFilter: (value: string) => void;
  onTagFilter: (value: string) => void;
  onSort: (value: LibrarySort) => void;
  onOpenBook: (book: BookRecord) => void;
  onOpenMatch: (match: LibrarySearchMatch) => void;
  onImport: () => void;
  onPasteBook: () => void;
  onLoadDemo: () => void;
  onCreateFolder: (parentId: string | undefined, name: string) => Promise<boolean>;
  onRenameFolder: (folderId: string, name: string) => Promise<boolean>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onMoveBook: (bookId: string, folderId: string | undefined) => Promise<void>;
  onToggleTag: (bookId: string, tag: string, assigned: boolean) => Promise<boolean>;
  onAddTag: (bookId: string, tag: string) => Promise<boolean>;
};

function FolderTree({
  folders,
  selectedId,
  books,
  parentId,
  onSelect,
}: {
  folders: LibraryFolder[];
  selectedId: string;
  books: BookRecord[];
  parentId?: string;
  onSelect: (id: string) => void;
}) {
  const children = folders.filter((folder) => folder.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name));
  if (!children.length) return null;
  return <ul className="library-folder-tree">{children.map((folder) => {
    const count = books.filter((book) => book.folderId === folder.id).length;
    return <li key={folder.id}>
      <button className={selectedId === folder.id ? 'is-selected' : ''} type="button" onClick={() => onSelect(folder.id)} aria-current={selectedId === folder.id ? 'page' : undefined}>
        <Icon name="book" width={15} height={15} /><span>{folder.name}</span><small>{toArabicDigits(count)}</small>
      </button>
      <FolderTree folders={folders} selectedId={selectedId} books={books} parentId={folder.id} onSelect={onSelect} />
    </li>;
  })}</ul>;
}

function folderPath(folder: LibraryFolder, folders: LibraryFolder[]) {
  const names = [folder.name];
  let parentId = folder.parentId;
  const visited = new Set([folder.id]);
  while (parentId) {
    if (visited.has(parentId)) break;
    visited.add(parentId);
    const parent = folders.find((item) => item.id === parentId);
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parentId;
  }
  return names.join(' / ');
}

function SearchResults({ groups, onOpenMatch }: { groups: LibrarySearchGroup[]; onOpenMatch: (match: LibrarySearchMatch) => void }) {
  if (!groups.length) return null;
  return <section className="library-page-search-results" aria-label="نتائج البحث داخل الكتب">
    <header><h2>نتائج البحث داخل الكتب</h2><span>{toArabicDigits(groups.reduce((total, group) => total + group.matches.length, 0))} نتيجة</span></header>
    {groups.map((group) => <article key={group.bookId}>
      <h3>{group.bookTitle}{group.author && <small> · {group.author}</small>}</h3>
      <div>{group.matches.slice(0, 6).map((match, index) => {
        const text = match.kind === 'passage' ? match.passage.text : match.kind === 'heading' ? match.heading.title : 'بيانات الكتاب';
        const page = match.kind === 'passage' ? match.passage.readerPageNumber : match.kind === 'heading' ? match.heading.readerPageNumber : undefined;
        const sourcePage = match.kind === 'passage' ? match.passage.sourcePageNumber : match.kind === 'heading' ? match.heading.sourcePageNumber : undefined;
        const pageLabel = page === undefined ? 'فتح الكتاب' : match.pageNumberKind === 'source' ? `ص ${toArabicDigits(sourcePage ?? page)}` : `موضع ${toArabicDigits(page)}`;
        return <button key={`${match.kind}-${index}`} type="button" onClick={() => onOpenMatch(match)}><small>{pageLabel}</small><span>{text.slice(0, 200)}{text.length > 200 ? '…' : ''}</span></button>;
      })}</div>
      {group.matches.length > 6 && <small className="library-page-more-hits">تظهر أول ٦ نتائج لهذا الكتاب.</small>}
    </article>)}
  </section>;
}

export function LibraryPage(props: LibraryPageProps) {
  const [newFolderName, setNewFolderName] = useState('');
  const [renameDraft, setRenameDraft] = useState('');
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const orderedBooks = useMemo(() => sortLibraryBooks(props.books, props.sort), [props.books, props.sort]);
  const tags = useMemo(() => listShelfTags(props.books), [props.books]);
  const authors = useMemo(() => Array.from(new Set(props.books.map((book) => book.author?.trim()).filter((author): author is string => Boolean(author)))).sort((a, b) => a.localeCompare(b)), [props.books]);
  const searchGroups = useMemo(() => searchLibrary(orderedBooks, props.searchQuery), [orderedBooks, props.searchQuery]);
  const matchedBookIds = useMemo(() => {
    const words = normalizeArabicSearch(props.searchQuery).split(/\s+/).filter(Boolean);
    const metadataMatches = props.books.filter((book) => {
      const folder = props.folders.find((item) => item.id === book.folderId);
      const value = normalizeArabicSearch([book.title, book.author ?? '', ...(book.aliases ?? []), ...(book.shelfTags ?? []), folder?.name ?? ''].join(' '));
      return words.length > 0 && words.every((word) => value.includes(word));
    }).map((book) => book.id);
    return new Set([...searchGroups.map((group) => group.bookId), ...metadataMatches]);
  }, [props.books, props.folders, props.searchQuery, searchGroups]);
  const selectedFolder = props.folders.find((folder) => folder.id === props.folderFilter);
  const parentFolderId = selectedFolder?.id;
  const filteredBooks = orderedBooks.filter((book) => {
    if (props.folderFilter === UNFILED_BOOKS && book.folderId) return false;
    if (props.folderFilter !== ALL_BOOKS && props.folderFilter !== UNFILED_BOOKS && book.folderId !== props.folderFilter) return false;
    if (props.authorFilter && book.author !== props.authorFilter) return false;
    if (props.tagFilter && !(book.shelfTags ?? []).includes(props.tagFilter)) return false;
    if (normalizeArabicSearch(props.searchQuery).length >= 2 && !matchedBookIds.has(book.id)) return false;
    return true;
  });

  useEffect(() => setRenameDraft(props.folders.find((folder) => folder.id === props.folderFilter)?.name ?? ''), [props.folderFilter, props.folders]);

  async function createFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    if (await props.onCreateFolder(parentFolderId, name)) setNewFolderName('');
  }

  async function renameFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFolder || !renameDraft.trim()) return;
    await props.onRenameFolder(selectedFolder.id, renameDraft.trim());
  }

  return <main className="library-page">
    <header className="library-page-heading">
      <div><span className="eyebrow">إدارة الكتب والقراءة</span><h1>المكتبة</h1><p>رتّب كتبك في مجلدات، وابحث في العناوين والمؤلفين والوسوم ومتن الكتب.</p></div>
      <div><span className="count-badge">{toArabicDigits(props.books.length)} كتاب</span><button className="button button-primary" type="button" onClick={props.onImport} disabled={props.isBusy}>{props.isBusy ? 'جارٍ الاستيراد…' : 'استيراد كتاب'}</button></div>
    </header>

    <div className="library-page-layout">
      <aside className="library-page-sidebar" aria-label="مجلدات المكتبة">
        <h2>المجلدات</h2>
        <nav>
          <button className={`library-folder-root ${props.folderFilter === ALL_BOOKS ? 'is-selected' : ''}`} type="button" onClick={() => props.onFolderFilter(ALL_BOOKS)} aria-current={props.folderFilter === ALL_BOOKS ? 'page' : undefined}><Icon name="book" width={16} height={16} /><span>كل الكتب</span><small>{toArabicDigits(props.books.length)}</small></button>
          <button className={`library-folder-root ${props.folderFilter === UNFILED_BOOKS ? 'is-selected' : ''}`} type="button" onClick={() => props.onFolderFilter(UNFILED_BOOKS)} aria-current={props.folderFilter === UNFILED_BOOKS ? 'page' : undefined}><Icon name="book" width={16} height={16} /><span>غير مصنّف</span><small>{toArabicDigits(props.books.filter((book) => !book.folderId).length)}</small></button>
          <FolderTree folders={props.folders} selectedId={props.folderFilter} books={props.books} onSelect={props.onFolderFilter} />
        </nav>
        <form className="library-folder-create" onSubmit={(event) => void createFolder(event)}><label htmlFor="library-folder-name">{selectedFolder ? `مجلد فرعي داخل «${selectedFolder.name}»` : 'إنشاء مجلد'}</label><div><input id="library-folder-name" value={newFolderName} maxLength={60} onChange={(event) => setNewFolderName(event.currentTarget.value)} placeholder="اسم المجلد" /><button className="icon-button" type="submit" aria-label="إنشاء المجلد" disabled={!newFolderName.trim()}><Icon name="plus" width={17} height={17} /></button></div></form>
        {selectedFolder && <div className="library-folder-manage"><form onSubmit={(event) => void renameFolder(event)}><label htmlFor="library-folder-rename">إعادة تسمية المجلد</label><div><input id="library-folder-rename" value={renameDraft || selectedFolder.name} onFocus={(event) => { if (!renameDraft) setRenameDraft(selectedFolder.name); }} onChange={(event) => setRenameDraft(event.currentTarget.value)} maxLength={60} /><button className="text-button" type="submit">حفظ</button></div></form><button className="text-button library-folder-delete" type="button" onClick={() => { if (window.confirm(`حذف مجلد «${selectedFolder.name}»؟ ستُنقل كتبه إلى «غير مصنّف» وتنتقل مجلداته الفرعية إلى المستوى الأعلى.`)) void props.onDeleteFolder(selectedFolder.id); }}>حذف المجلد</button></div>}
      </aside>

      <section className="library-page-main" aria-label="الكتب">
        <div className="library-page-filters">
          <label className="library-page-search"><Icon name="search" width={18} height={18} /><input type="search" value={props.searchInput} onChange={(event) => props.onSearchInput(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Escape') props.onSearchInput(''); }} placeholder="ابحث في الكتب والمؤلفين والنصوص…" aria-label="البحث في المكتبة" />{props.searchInput && <button className="icon-button" type="button" aria-label="مسح البحث" onClick={() => props.onSearchInput('')}><Icon name="close" width={15} height={15} /></button>}</label>
          <label><span>المؤلف</span><select value={props.authorFilter} onChange={(event) => props.onAuthorFilter(event.currentTarget.value)}><option value="">كل المؤلفين</option>{authors.map((author) => <option key={author} value={author}>{author}</option>)}</select></label>
          <label><span>وسم الكتاب</span><select value={props.tagFilter} onChange={(event) => props.onTagFilter(event.currentTarget.value)}><option value="">كل الوسوم</option>{tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label>
          <label><span>الترتيب</span><select value={props.sort} onChange={(event) => props.onSort(event.currentTarget.value as LibrarySort)}><option value="last-read">آخر قراءة</option><option value="added">تاريخ الإضافة</option><option value="title">العنوان</option></select></label>
        </div>
        {props.searchInput.trim().length === 1 && <p className="library-page-hint">اكتب حرفين على الأقل لبدء البحث.</p>}
        {props.searchQuery.trim().length >= 2 && <SearchResults groups={searchGroups} onOpenMatch={props.onOpenMatch} />}
        <div className="library-page-results-heading"><h2>{selectedFolder?.name ?? (props.folderFilter === UNFILED_BOOKS ? 'كتب غير مصنّفة' : 'كل الكتب')}</h2><span>{toArabicDigits(filteredBooks.length)} كتاب</span></div>
        {filteredBooks.length ? <div className="library-book-grid">{filteredBooks.map((book) => {
          const progress = readerProgressPercent(book, book.id === props.activeBookId ? props.currentPage : book.lastReaderPage);
          const bookTags = book.shelfTags ?? [];
          return <article className="library-book-card" key={book.id}>
            <button className="library-book-open" type="button" onClick={() => props.onOpenBook(book)}><span className="library-book-mark"><Icon name="book" width={27} height={27} /></span><span className="eyebrow">{book.author || 'مؤلف غير محدد'}</span><strong>{book.title}</strong><small>{toArabicDigits(book.readerPageCount)} صفحة · {book.sourceName}</small><span className="library-book-progress"><i style={{ width: `${progress}%` }} /></span><small>{progress ? `${toArabicDigits(progress)}٪ مقروء` : 'لم تبدأ القراءة'}</small></button>
            {bookTags.length > 0 && <div className="library-book-tags">{bookTags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
            <footer><label><span>المجلد</span><select aria-label={`مجلد ${book.title}`} value={book.folderId ?? ''} onChange={(event) => void props.onMoveBook(book.id, event.currentTarget.value || undefined)}><option value="">غير مصنّف</option>{props.folders.map((folder) => <option key={folder.id} value={folder.id}>{folderPath(folder, props.folders)}</option>)}</select></label><details className="library-book-tag-editor"><summary aria-label={`إدارة وسوم ${book.title}`}><Icon name="tag" width={16} height={16} /></summary><div><strong>وسوم الكتاب</strong>{tags.length > 0 && <div>{tags.map((tag) => <label key={tag}><input type="checkbox" checked={bookTags.includes(tag)} onChange={(event) => void props.onToggleTag(book.id, tag, event.currentTarget.checked)} /><span>{tag}</span></label>)}</div>}<form onSubmit={(event) => { event.preventDefault(); const tag = tagDrafts[book.id] ?? ''; if (normalizeShelfTag(tag)) void props.onAddTag(book.id, tag).then((saved) => { if (saved) setTagDrafts((drafts) => ({ ...drafts, [book.id]: '' })); }); }}><input value={tagDrafts[book.id] ?? ''} maxLength={40} onChange={(event) => setTagDrafts((drafts) => ({ ...drafts, [book.id]: event.currentTarget.value }))} placeholder="وسم جديد" aria-label={`إضافة وسم إلى ${book.title}`} /><button type="submit">إضافة</button></form></div></details></footer>
          </article>;
        })}</div> : <div className="library-page-empty"><Icon name="book" width={36} height={36} /><h3>{props.books.length ? 'لا توجد كتب مطابقة' : 'مكتبتك فارغة'}</h3><p>{props.books.length ? 'غيّر البحث أو التصفية، أو اختر مجلداً آخر.' : 'استورد كتاباً لتبدأ، أو جرّب عينة القراءة.'}</p>{!props.books.length && <div><button className="button button-primary" type="button" onClick={props.onImport} disabled={props.isBusy}>استيراد كتاب</button><button className="button button-secondary" type="button" onClick={props.onPasteBook}>الصق نصاً</button><button className="button button-secondary" type="button" onClick={props.onLoadDemo} disabled={props.isBusy}>افتح عينة القراءة</button></div>}</div>}
      </section>
    </div>
  </main>;
}
