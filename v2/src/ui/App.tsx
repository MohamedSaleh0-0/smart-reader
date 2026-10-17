import { useEffect, useMemo, useRef, useState } from 'react';
import { formatBibliographicCitation, formatPassageCitation, joinCitationHtmlItems, joinCitationItems, toArabicDigits } from '../domain/citation';
import { buildOutline, expandableOutlineIds, filterOutline, outlineAncestorIds, type OutlineNode } from '../domain/outline';
import { normalizeArabicSearch } from '../domain/search';
import { matchesArabicSearch } from '../domain/arabic-root-search';
import type { LibrarySort } from '../domain/library-order';
import { normalizeShelfTag, setBookShelfTag } from '../domain/library-tags';
import { readerProgressPercent, resumeReaderPage } from '../domain/reading-progress';
import type { LibrarySearchMatch } from '../domain/library-search';
import { joinPassageParts, passagePartOffset } from '../domain/passage-text';
import type { BookRecord, LibraryFolder, Passage, PassageLinkGroup, PassageLinkWorkspace, StudyData, StudyHighlight, StudySettings } from '../domain/types';
import { addClip, addHighlightWithCategory, addStudyCategory as addStudyCategoryData, addStudyTag, assignFavoriteTag, clearClips, filterAndSortFavorites, filterHighlightsByCategory, highlightColors, listStudyNotebookEntries, normalizeStudyData, removeClip, removeHighlightsInRange, removeNotebookEntry, removePassageLink, removeStudyCategory as removeStudyCategoryData, removeStudyComment, removeStudyTag, renameStudyCategory, reorderClips, setStudyCategoryColor as setStudyCategoryColorData, toggleFavorite, toggleFavoriteTag, unassignedHighlightFilter, updateClipQuote, updateFavoriteDetails, updateNotebookEntry, upsertStudyComment, type FavoriteSort, type StudyNotebookViewEntry } from '../domain/study';
import { addPassageLinkTrayItemsToGroup, createPassageLinkGroup, emptyPassageLinkWorkspace, normalizePassageLinkWorkspace, removePassageLinkGroup, removePassageLinkGroupMember, removePassageLinkTrayItem, renamePassageLinkGroup, togglePassageLinkTrayItem } from '../domain/passage-links';
import { deleteLibraryFolder, getBooks, getLibraryFolders, getPassageLinkWorkspace, saveBook, saveLibraryFolder, savePassageLinkWorkspace } from '../storage/repository';
import { Icon } from './Icon';
import { CompanionPanel } from './CompanionPanel';
import { LibraryPage } from './LibraryPage';
import { StudySettingsPanel } from './StudySettingsPanel';
import { TurathSearchPanel } from './TurathSearchPanel';
import type { CollectionDocxInput } from '../export/collection-docx';
import { createStudyBackup, keepStudyEntriesForPassages, mergeStudyData } from '../domain/study-backup';
import { studyNotebookBookmarkName, applyStudyNotebookWordEdits } from '../domain/study-notebook-docx';
import { sanitizeRichTextHtml } from '../domain/rich-text';
import { RichNoteEditor } from './RichNoteEditor';
import { buildReadingSummaryText, buildReadingTeacherReportHtml, formatReadingDuration as formatStudyDuration, localReadingDateKey, READING_FLUSH_SECONDS, READING_MAX_FLUSH_DELAY_MS, READING_TICK_SECONDS, recordReadingTime, shouldCountReadingTick, summarizeReadingLibrary } from '../domain/reading-stats';
import demoBookMarkdown from '../samples/research-book.md?raw';
import demoFigureUrl from '../samples/research-figure.svg?url';

type ImportedBook = BookRecord & { stats?: { footnotes: number; images: number } };
type Theme = 'dark' | 'light';
type ReaderSearchResult = {
  id: string;
  page: number;
  kind: 'passage' | 'heading' | 'highlight';
  text: string;
  passage?: Passage;
  headingId?: string;
  highlightId?: string;
  categoryName?: string;
};
type PassageActions = {
  passage: Passage;
  quote: string;
  top: number;
  left: number;
  layout: 'vertical' | 'horizontal';
  range?: { start: number; end: number };
};
type StudyPanelTab = 'collection' | 'favorites' | 'notebook' | 'pinned' | 'links' | 'categories';
const highlightLabels = { yellow: 'أصفر', green: 'أخضر', blue: 'أزرق', pink: 'وردي', orange: 'برتقالي', purple: 'بنفسجي' } as const;

function quoteExcerpt(value: string, limit = 190) {
  return value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;
}

function loadReadingDeviceId(): string {
  try {
    const key = 'smart-reader:reading-device';
    const saved = window.localStorage.getItem(key);
    if (saved) return saved;
    const created = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `device-${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return `device-${Math.random().toString(36).slice(2, 12)}`;
  }
}

const readingDeviceId = loadReadingDeviceId();

function loadReadingStudentName(): string {
  try { return window.localStorage.getItem('smart-reader:reading-student') ?? ''; } catch { return ''; }
}

type ReadingStatsContentProps = {
  summary: ReturnType<typeof summarizeReadingLibrary>;
  studentName: string;
  onStudentNameChange: (name: string) => void;
  onCopySummary: () => void;
  onDownloadReport: () => void;
};

function ReadingStatsContent({ summary, studentName, onStudentNameChange, onCopySummary, onDownloadReport }: ReadingStatsContentProps) {
  const { reading, books } = summary;
  const maxSeconds = Math.max(60, ...reading.recentDays.map((day) => day.seconds));
  const totalSeconds = Object.values(reading.libraryDays).reduce((total, seconds) => total + seconds, 0);
  return <>
    <div className="study-stat-grid study-reading-summary">
      <div><strong>{formatStudyDuration(reading.libraryToday)}</strong><span>اليوم</span></div>
      <div><strong>{formatStudyDuration(reading.libraryWeek)}</strong><span>آخر ٧ أيام</span></div>
      <div><strong>{toArabicDigits(reading.currentStreak)}</strong><span>أيام متتالية</span></div>
      <div><strong>{toArabicDigits(reading.bestStreak)}</strong><span>أطول سلسلة</span></div>
    </div>
    <p className="study-reading-library">الإجمالي {formatStudyDuration(totalSeconds)} في {toArabicDigits(reading.activeDays)} يوم قراءة{reading.activeDays ? ` · المتوسط ${formatStudyDuration(totalSeconds / reading.activeDays)}` : ''}</p>
    <h4 className="study-subheading">آخر ١٤ يوماً · الأخضر يوم قراءة</h4>
    <div className="study-reading-chart" role="img" aria-label="وقت القراءة في آخر أربعة عشر يوماً">{reading.recentDays.map(({ date, seconds }) => <div className="study-reading-day" key={date} title={`${date} — ${formatStudyDuration(seconds)}`}><i className={seconds >= 60 ? 'is-active' : ''} style={{ height: `${Math.max(seconds ? 4 : 0, Math.round(seconds / maxSeconds * 52))}px` }} /><small>{toArabicDigits(Number(date.slice(-2)))}</small></div>)}</div>
    <h4 className="study-subheading">الكتب</h4>
    {books.length ? <ul className="study-reading-books">{books.map((book) => <li key={book.id}>
      <div className="study-reading-book-heading"><strong>{book.title}</strong><b>{formatStudyDuration(book.seconds)}</b></div>
      <p>{toArabicDigits(book.highlights)} تظليل · {toArabicDigits(book.comments)} تعليق{book.lastRead ? ` · آخر قراءة ${toArabicDigits(book.lastRead)}` : ''}</p>
      {book.chapters.length > 0 && <details><summary>تفصيل الأبواب</summary><ul>{book.chapters.map((chapter) => <li key={chapter.title}><span>{chapter.title}</span><small>{toArabicDigits(chapter.highlights)} تظليل · {toArabicDigits(chapter.comments)} تعليق</small></li>)}</ul></details>}
    </li>)}</ul> : <p className="study-empty">لا سجلّ بعد؛ افتح كتاباً واقرأ فيه.</p>}
    <label className="study-reading-name"><span>اسم الطالب في التقرير (اختياري)</span><input value={studentName} onChange={(event) => onStudentNameChange(event.currentTarget.value)} /></label>
    <div className="study-reading-actions"><button className="button button-primary" type="button" onClick={onDownloadReport}>تنزيل تقرير للمعلم (HTML)</button><button className="text-button" type="button" onClick={onCopySummary}>نسخ الملخص</button></div>
    <p className="study-reading-hint">الوقت تقديري؛ يُحتسب حين تكون الصفحة ظاهرة مع نشاط حديث، ويتوقف بعد ٩٠ ثانية من الخمول. تُعدّ الدقيقة يوم قراءة.</p>
  </>;
}

function escapeClipboardHtml(value: string) {
  const escaped = value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
  return escaped.replace(/\r?\n/g, '<br>');
}

function citationQuote(passage: Passage, quote: string, keepFootnotes: boolean): string {
  if (keepFootnotes || quote !== passage.text) return quote;
  const elements = passageElements(document.querySelector('.book-content') ?? document, passage.id);
  if (!elements.length) return quote;
  return joinPassageParts(elements.map((element) => {
    const copy = element.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('sup.footnote-ref').forEach((reference) => reference.remove());
    return copy.textContent ?? '';
  })) || quote;
}

function selectedQuoteForClipboard(quote: string, keepFootnotes: boolean, range?: Range): string {
  if (!range) return quote;
  const fragment = range.cloneContents();
  const selection = document.createElement('div');
  selection.append(fragment);
  selection.querySelectorAll('[data-ui]').forEach((element) => element.remove());
  if (!keepFootnotes) selection.querySelectorAll('sup.footnote-ref').forEach((reference) => reference.remove());
  selection.querySelectorAll('br').forEach((lineBreak) => lineBreak.replaceWith(document.createTextNode(' ')));
  selection.querySelectorAll('p, li, blockquote, div').forEach((block) => {
    block.before(document.createTextNode(' '));
    block.after(document.createTextNode(' '));
  });
  return selection.textContent?.replace(/\s+/g, ' ').trim() || quote;
}

function passageCitation(
  book: BookRecord,
  passage: Passage,
  quote: string,
  settings: StudySettings,
  footnoteIds: readonly string[] = [],
): string {
  const footnotes = settings.keepFootnotes
    ? footnoteIds.map((id) => book.footnotes.find((footnote) => footnote.id === id)?.text).filter((text): text is string => Boolean(text))
    : [];
  return formatPassageCitation(book, passage, citationQuote(passage, quote, settings.keepFootnotes), settings, footnotes);
}

function saveDocxFile(content: Uint8Array, fileName: string) {
  const blob = new Blob([content.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

async function buildStudyDocx(input: CollectionDocxInput): Promise<Uint8Array> {
  const { buildCollectionDocx } = await import('../export/collection-docx');
  return buildCollectionDocx(input);
}

function localPassageLink(book: BookRecord, passage: Passage) {
  const url = new URL(window.location.href);
  url.hash = `book=${encodeURIComponent(book.id)}&passage=${encodeURIComponent(passage.id)}`;
  return url.toString();
}

async function copyToClipboard(value: string, html?: string) {
  if (html && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/plain': new Blob([value], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      })]);
      return;
    } catch {
      // Fall through to the copy event for browsers/local-file contexts without rich clipboard access.
    }
  } else if (!html && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  if (html) {
    let richCopied = false;
    const onCopy = (event: ClipboardEvent) => {
      event.clipboardData?.setData('text/plain', value);
      event.clipboardData?.setData('text/html', html);
      event.preventDefault();
      richCopied = true;
    };
    document.addEventListener('copy', onCopy, true);
    try { document.execCommand('copy'); } catch { /* fall back to plain text below */ }
    document.removeEventListener('copy', onCopy, true);
    if (richCopied) return;
  }
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('تعذر النسخ من هذا المتصفح.');
}

function clipClipboardPayload(book: BookRecord, clip: StudyData['clips'][number], settings: StudySettings) {
  const passage = book.passages.find((item) => item.id === clip.passageId);
  if (!passage) return { text: clip.quote, html: `<p dir="rtl">${escapeClipboardHtml(clip.quote)}</p>` };
  const quote = citationQuote(passage, clip.quote, settings.keepFootnotes);
  const text = passageCitation(book, passage, clip.quote, settings, clip.footnoteIds);
  const citation = formatBibliographicCitation(book, passage, settings);
  const footnotes = settings.keepFootnotes
    ? (clip.footnoteIds ?? []).map((id) => book.footnotes.find((footnote) => footnote.id === id)?.text).filter((value): value is string => Boolean(value))
    : [];
  const noteHtml = footnotes.length
    ? `<p dir="rtl" style="font-size:12pt;color:#555">${footnotes.map(escapeClipboardHtml).join('<br>')}</p>`
    : '';
  return {
    text,
    html: `<p dir="rtl" style="margin:0 0 6pt">${escapeClipboardHtml(quote)} <span style="color:#2b5d86">${escapeClipboardHtml(citation)}</span></p>${noteHtml}`,
  };
}

function passageElements(root: ParentNode, passageId: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[data-passage-id="${CSS.escape(passageId)}"]`));
}

function passagePartText(part: HTMLElement): string {
  const clone = part.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.study-source-marks, .study-link-group-badge, .study-reciprocal-link').forEach((decoration) => decoration.remove());
  return clone.textContent ?? '';
}

function passageTextOffset(parts: readonly HTMLElement[], node: Node, offset: number): number | undefined {
  const textParts = parts.map(passagePartText);
  for (const [partIndex, part] of parts.entries()) {
    if (part === node || part.contains(node)) {
      try {
        const range = document.createRange();
        range.selectNodeContents(part);
        range.setEnd(node, offset);
        return passagePartOffset(textParts, partIndex, range.toString().length);
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function unwrapStudyHighlights(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('.study-highlight').forEach((mark) => {
    mark.replaceWith(document.createTextNode(mark.textContent ?? ''));
  });
  root.querySelectorAll('[data-passage-id]').forEach((passage) => passage.normalize());
}

function wrapStudyHighlight(parts: readonly HTMLElement[], start: number, end: number, color: string, id: string) {
  const totalLength = parts.reduce((total, part) => total + passagePartText(part).length, Math.max(0, parts.length - 1));
  if (start < 0 || end <= start || end > totalLength) return;
  const nodes: { node: Text; start: number; end: number }[] = [];
  let offset = 0;
  for (const part of parts) {
    const walker = document.createTreeWalker(part, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement?.closest('.study-source-marks, .study-link-group-badge, .study-reciprocal-link') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let current = walker.nextNode();
    while (current) {
      const node = current as Text;
      const nodeEnd = offset + node.length;
      if (nodeEnd > start && offset < end) nodes.push({ node, start: offset, end: nodeEnd });
      offset = nodeEnd;
      current = walker.nextNode();
    }
    offset += 1;
  }
  for (const item of nodes.reverse()) {
    const localStart = Math.max(start, item.start) - item.start;
    const localEnd = Math.min(end, item.end) - item.start;
    if (localEnd <= localStart || !item.node.parentNode) continue;
    const selected = item.node.splitText(localStart);
    selected.splitText(localEnd - localStart);
    const mark = document.createElement('mark');
    mark.className = `study-highlight color-${color}`;
    mark.dataset.highlightId = id;
    selected.parentNode?.insertBefore(mark, selected);
    mark.append(selected);
  }
}

function readerPageNumbers(book?: BookRecord) {
  if (!book) return [];
  return book.readerPages?.length
    ? book.readerPages
    : Array.from({ length: book.readerPageCount || book.sourcePageCount || 1 }, (_unused, index) => index + 1);
}

function ContentsTree({
  nodes,
  book,
  isRoot = false,
  expandedIds,
  currentHeadingId,
  onToggle,
  onJump,
}: {
  nodes: OutlineNode[];
  book: BookRecord;
  isRoot?: boolean;
  expandedIds: ReadonlySet<string>;
  currentHeadingId?: string;
  onToggle: (id: string) => void;
  onJump: (id: string, page: number) => void;
}) {
  return (
    <ul className="toc-tree" role={isRoot ? 'tree' : 'group'}>
      {nodes.map(({ heading, children }) => (
        <li className="toc-item" key={heading.id} role="treeitem" aria-expanded={children.length ? expandedIds.has(heading.id) : undefined}>
          <div className={`toc-row ${heading.id === currentHeadingId ? 'is-current' : ''}`}>
            {children.length > 0 ? (
              <button className="toc-branch-toggle" type="button" aria-label={`${expandedIds.has(heading.id) ? 'طي' : 'توسيع'} ${heading.title}`} aria-expanded={expandedIds.has(heading.id)} onClick={() => onToggle(heading.id)}>
                <Icon name={expandedIds.has(heading.id) ? 'chevronDown' : 'chevronRight'} width={14} height={14} />
              </button>
            ) : <span className="toc-branch-spacer" aria-hidden="true" />}
            <button className={`toc-link level-${heading.level}`} type="button" aria-current={heading.id === currentHeadingId ? 'location' : undefined} onClick={() => onJump(heading.id, heading.readerPageNumber)}>
              <span>{heading.title}</span>
              <small>{book.pageNumberKind === 'source' ? 'ص' : 'موضع'} {toArabicDigits(book.pageNumberKind === 'source' ? heading.sourcePageNumber ?? heading.readerPageNumber : heading.readerPageNumber)}</small>
            </button>
          </div>
          {children.length > 0 && expandedIds.has(heading.id) && <ContentsTree nodes={children} book={book} expandedIds={expandedIds} currentHeadingId={currentHeadingId} onToggle={onToggle} onJump={onJump} />}
        </li>
      ))}
    </ul>
  );
}

export function App() {
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [libraryFolders, setLibraryFolders] = useState<LibraryFolder[]>([]);
  const [booksReady, setBooksReady] = useState(false);
  const [activeBookId, setActiveBookId] = useState<string>();
  const [activeView, setActiveView] = useState<'library' | 'reader'>(() => {
    try { return localStorage.getItem('sr:v2:view') === 'reader' ? 'reader' : 'library'; } catch { return 'library'; }
  });
  const [linkWorkspace, setLinkWorkspace] = useState<PassageLinkWorkspace>(() => emptyPassageLinkWorkspace());
  const [selectedLinkTrayIds, setSelectedLinkTrayIds] = useState<string[]>([]);
  const [linkGroupNameDraft, setLinkGroupNameDraft] = useState('');
  const [confirmLinkGroupId, setConfirmLinkGroupId] = useState<string>();
  const [pendingLinkMemberRemoval, setPendingLinkMemberRemoval] = useState<{ groupId: string; bookId: string; passageId: string }>();
  const [pendingPassageNavigation, setPendingPassageNavigation] = useState<{ bookId: string; passageId: string }>();
  const [passageActions, setPassageActions] = useState<PassageActions>();
  const [selectionActions, setSelectionActions] = useState<PassageActions>();
  const [foldedPassageIds, setFoldedPassageIds] = useState<string[]>([]);
  const [turathOpen, setTurathOpen] = useState(false);
  const [turathInitialQuery, setTurathInitialQuery] = useState('');
  const [turathRequestId, setTurathRequestId] = useState(0);
  const [studyPanel, setStudyPanel] = useState<StudyPanelTab>();
  const [studyDrawerOpen, setStudyDrawerOpen] = useState(false);
  const [studyPassageId, setStudyPassageId] = useState<string>();
  const [commentDraft, setCommentDraft] = useState('');
  const [commentHtmlDraft, setCommentHtmlDraft] = useState<string>();
  const [commentContext, setCommentContext] = useState<{ start: number; end: number; quote: string }>();
  const [notebookDraft, setNotebookDraft] = useState('');
  const [notebookHtmlDraft, setNotebookHtmlDraft] = useState<string>();
  const [activeNotebookId, setActiveNotebookId] = useState<string>();
  const [activeNotebookKind, setActiveNotebookKind] = useState<'note' | 'comment'>();
  const [categoryDraft, setCategoryDraft] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [favoriteEditId, setFavoriteEditId] = useState<string>();
  const [favoriteLabelDraft, setFavoriteLabelDraft] = useState('');
  const [favoriteFilter, setFavoriteFilter] = useState('');
  const [favoriteSort, setFavoriteSort] = useState<FavoriteSort>('page');
  const [favoriteTagEditId, setFavoriteTagEditId] = useState<string>();
  const [favoriteTagDraft, setFavoriteTagDraft] = useState('');
  const [clipEditId, setClipEditId] = useState<string>();
  const [clipQuoteDraft, setClipQuoteDraft] = useState('');
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [confirmClipClear, setConfirmClipClear] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [draggedClipId, setDraggedClipId] = useState<string>();
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [expandedOutlineIds, setExpandedOutlineIds] = useState<Set<string>>(() => new Set());
  const [outlineQuery, setOutlineQuery] = useState('');
  const [librarySidebarWidth, setLibrarySidebarWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('sr:v2:library-sidebar-width'));
      return Number.isFinite(saved) && saved >= 190 && saved <= 480 ? saved : 238;
    } catch {
      return 238;
    }
  });
  const [currentHeadingId, setCurrentHeadingId] = useState<string>();
  const [metadataEditing, setMetadataEditing] = useState(false);
  const [metadataDraft, setMetadataDraft] = useState({ title: '', author: '', aliases: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [readerFontSize, setReaderFontSize] = useState(22);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rootSearchEnabled, setRootSearchEnabled] = useState(() => {
    try {
      return localStorage.getItem('sr:v2:root-search') === '1';
    } catch {
      return false;
    }
  });
  const [librarySearchInput, setLibrarySearchInput] = useState('');
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [libraryFolderFilter, setLibraryFolderFilter] = useState('all');
  const [libraryAuthorFilter, setLibraryAuthorFilter] = useState('');
  const [libraryTagFilter, setLibraryTagFilter] = useState('');
  const [librarySort, setLibrarySort] = useState<LibrarySort>(() => {
    try {
      const saved = localStorage.getItem('sr:v2:library-sort');
      return saved === 'added' || saved === 'title' ? saved : 'last-read';
    } catch {
      return 'last-read';
    }
  });
  const [searchCategoryId, setSearchCategoryId] = useState('');
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem('sr:v2:theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [status, setStatus] = useState('مكتبتك محفوظة محلياً على هذا الجهاز');
  const [readingStudentName, setReadingStudentName] = useState(loadReadingStudentName);
  const [bookPasteText, setBookPasteText] = useState('');
  const [bookPasteHtml, setBookPasteHtml] = useState('');
  const [bookPasteFormat, setBookPasteFormat] = useState<'auto' | 'text' | 'markdown' | 'html'>('auto');
  const [isBusy, setIsBusy] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isImportingNotebookWord, setIsImportingNotebookWord] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bookPasteDialog = useRef<HTMLDialogElement>(null);
  const bookPasteTextarea = useRef<HTMLTextAreaElement>(null);
  const notebookWordInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const readingStatsDialog = useRef<HTMLDialogElement>(null);
  const companionDialog = useRef<HTMLDialogElement>(null);
  const bookSettingsDialog = useRef<HTMLDialogElement>(null);
  const passageCommentDialog = useRef<HTMLDialogElement>(null);
  const sidebarResizeStart = useRef<{ x: number; width: number } | undefined>(undefined);
  const studyWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const linkWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const passageAnchor = useRef<HTMLElement | undefined>(undefined);
  const selectionAnchor = useRef<HTMLElement | undefined>(undefined);
  const selectionRange = useRef<Range | undefined>(undefined);
  const hidePassageToolbarTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    try { localStorage.setItem('sr:v2:library-sidebar-width', String(librarySidebarWidth)); } catch { /* keep the current session setting */ }
  }, [librarySidebarWidth]);

  useEffect(() => {
    try { localStorage.setItem('sr:v2:view', activeView); } catch { /* keep the current session view */ }
  }, [activeView]);

  function startLibrarySidebarResize(event: React.PointerEvent<HTMLDivElement>) {
    if (window.innerWidth <= 660) return;
    event.preventDefault();
    sidebarResizeStart.current = { x: event.clientX, width: librarySidebarWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function resizeLibrarySidebar(event: React.PointerEvent<HTMLDivElement>) {
    if (!sidebarResizeStart.current) return;
    const { x, width } = sidebarResizeStart.current;
    setLibrarySidebarWidth(Math.max(190, Math.min(480, Math.round(width + x - event.clientX))));
  }

  function stopLibrarySidebarResize() {
    sidebarResizeStart.current = undefined;
  }

  function handleLibrarySidebarResizeKey(event: React.KeyboardEvent<HTMLDivElement>) {
    const change = event.key === 'ArrowLeft' ? 24 : event.key === 'ArrowRight' ? -24 : event.key === 'Home' ? 190 - librarySidebarWidth : event.key === 'End' ? 480 - librarySidebarWidth : 0;
    if (!change) return;
    event.preventDefault();
    setLibrarySidebarWidth((width) => Math.max(190, Math.min(480, width + change)));
  }

  const activeBook = books.find((book) => book.id === activeBookId);
  const outline = useMemo(() => buildOutline(activeBook?.headings ?? []), [activeBook?.headings]);
  const filteredOutline = useMemo(() => filterOutline(outline, outlineQuery), [outline, outlineQuery]);
  const visibleExpandedOutlineIds = useMemo(
    () => outlineQuery.trim() ? new Set(expandableOutlineIds(filteredOutline)) : expandedOutlineIds,
    [expandedOutlineIds, filteredOutline, outlineQuery],
  );
  const pages = useMemo(() => readerPageNumbers(activeBook), [activeBook]);
  const pageIndex = Math.max(0, pages.indexOf(currentPage));
  const searchResults = useMemo(() => {
    const query = normalizeArabicSearch(searchQuery);
    if (!activeBook) return [];
    if (searchCategoryId) {
      const study = normalizeStudyData(activeBook.study);
      const categoryById = new Map(study.categories.map((category) => [category.id, category.name]));
      const passagesById = new Map(activeBook.passages.map((passage) => [passage.id, passage]));
      return filterHighlightsByCategory(study.highlights, searchCategoryId)
        .flatMap((highlight) => {
          const passage = passagesById.get(highlight.passageId);
          const categoryName = highlight.categoryId ? categoryById.get(highlight.categoryId) : undefined;
          const comment = study.comments.find((item) => item.passageId === highlight.passageId && item.start === highlight.start && item.end === highlight.end)?.text ?? '';
          if (!passage || (query && !matchesArabicSearch(`${highlight.quote} ${categoryName ?? ''} ${comment}`, query, rootSearchEnabled))) return [];
          return [{ id: highlight.id, highlightId: highlight.id, passage, page: passage.readerPageNumber, kind: 'highlight' as const, text: highlight.quote, categoryName }];
        })
        .sort((left, right) => left.page - right.page || left.passage.id.localeCompare(right.passage.id))
        .slice(0, 60);
    }
    if (!query) return [];
    const headings: ReaderSearchResult[] = activeBook.headings
      .filter((heading) => matchesArabicSearch(heading.title, query, rootSearchEnabled))
      .map((heading) => ({ id: heading.id, headingId: heading.id, page: heading.readerPageNumber, kind: 'heading', text: heading.title }));
    const passages: ReaderSearchResult[] = activeBook.passages
      .filter((passage) => matchesArabicSearch(passage.text, query, rootSearchEnabled))
      .map((passage) => ({ id: passage.id, page: passage.readerPageNumber, kind: 'passage', text: passage.text, passage }));
    return [...headings, ...passages].sort((a, b) => a.page - b.page || (a.kind === b.kind ? 0 : a.kind === 'heading' ? -1 : 1)).slice(0, 60);
  }, [activeBook, rootSearchEnabled, searchCategoryId, searchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => setLibrarySearchQuery(librarySearchInput), 220);
    return () => window.clearTimeout(timer);
  }, [librarySearchInput]);

  useEffect(() => {
    try {
      localStorage.setItem('sr:v2:library-sort', librarySort);
    } catch {
      // Shelf sorting still works when preference storage is unavailable.
    }
  }, [librarySort]);

  useEffect(() => {
    Promise.all([getBooks(), getLibraryFolders(), getPassageLinkWorkspace()])
      .then(([savedBooks, savedFolders, savedLinkWorkspace]) => {
        const ordered = savedBooks.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
        setBooks(ordered);
        setLibraryFolders(savedFolders);
        setActiveBookId(ordered[0]?.id);
        if (ordered[0]) setCurrentPage(resumeReaderPage(ordered[0]));
        setLinkWorkspace(savedLinkWorkspace);
        setBooksReady(true);
      })
      .catch(() => {
        setStatus('تعذر فتح المكتبة المحلية في هذا المتصفح.');
        setBooksReady(true);
      });
  }, []);

  useEffect(() => {
    if (!booksReady || !activeBookId || !pages.includes(currentPage)) return;
    const pageToSave = currentPage;
    const timer = window.setTimeout(() => {
      const write = studyWriteQueue.current.then(async () => {
        const latestBook = (await getBooks()).find((book) => book.id === activeBookId);
        if (!latestBook || latestBook.lastReaderPage === pageToSave) return;
        const updatedBook = { ...latestBook, lastReaderPage: pageToSave };
        await saveBook(updatedBook);
        setBooks((current) => current.map((book) => book.id === updatedBook.id ? updatedBook : book));
      });
      studyWriteQueue.current = write.catch(() => undefined);
      void write.catch(() => setStatus('تعذر حفظ موضع القراءة.'));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activeBookId, booksReady, currentPage, pages]);

  useEffect(() => {
    if (!activeBook || activeView !== 'reader') return;
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLElement>(`section[data-reader-page="${currentPage}"]`)?.scrollIntoView({ block: 'start' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeBookId, activeBook?.html, activeView]);

  useEffect(() => {
    if (!booksReady || !activeBookId || activeView !== 'reader') return;
    let lastActivity = Date.now();
    let lastFlush = Date.now();
    let accumulatedSeconds = 0;
    const accumulatedByDate = new Map<string, number>();
    let writing = false;
    let flushRequested = false;
    const flush = () => {
      const pending = [...accumulatedByDate.entries()];
      const seconds = pending.reduce((total, [, amount]) => total + amount, 0);
      if (seconds < 1) return;
      if (writing) { flushRequested = true; return; }
      accumulatedByDate.clear();
      accumulatedSeconds -= seconds;
      writing = true;
      flushRequested = false;
      const write = studyWriteQueue.current.then(async () => {
        const latestBook = (await getBooks()).find((book) => book.id === activeBookId);
        if (!latestBook) return;
        let study = normalizeStudyData(latestBook.study);
        const recordedAt = new Date().toISOString();
        for (const [date, daySeconds] of pending) study = recordReadingTime(study, daySeconds, date, readingDeviceId, recordedAt);
        const updatedBook = { ...latestBook, study };
        await saveBook(updatedBook);
        setBooks((current) => current.map((book) => book.id === updatedBook.id ? updatedBook : book));
      });
      studyWriteQueue.current = write.catch(() => undefined);
      void write.catch(() => {
        for (const [date, daySeconds] of pending) accumulatedByDate.set(date, (accumulatedByDate.get(date) ?? 0) + daySeconds);
        accumulatedSeconds += seconds;
      }).finally(() => {
        writing = false;
        if (flushRequested || accumulatedSeconds >= 120) flush();
      });
    };
    const activity = () => { lastActivity = Date.now(); };
    const visibility = () => {
      if (document.visibilityState === 'hidden') flush();
      else lastActivity = Date.now();
    };
    const activityEvents: (keyof WindowEventMap)[] = ['scroll', 'pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel', 'click'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, activity, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', flush);
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (shouldCountReadingTick(document.visibilityState === 'visible', lastActivity, now)) {
        const date = localReadingDateKey(new Date(now));
        accumulatedByDate.set(date, (accumulatedByDate.get(date) ?? 0) + READING_TICK_SECONDS);
        accumulatedSeconds += READING_TICK_SECONDS;
      }
      if (accumulatedSeconds >= READING_FLUSH_SECONDS || (accumulatedSeconds > 0 && now - lastFlush > READING_MAX_FLUSH_DELAY_MS)) {
        lastFlush = now;
        flush();
      }
    }, 5_000);
    return () => {
      window.clearInterval(timer);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, activity, true));
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [activeBookId, activeView, booksReady]);

  useEffect(() => {
    if (!booksReady) return;
    const resolveLocalPassageLink = () => {
      const parameters = new URLSearchParams(window.location.hash.slice(1));
      const bookId = parameters.get('book');
      const passageId = parameters.get('passage');
      if (!bookId || !passageId) return;
      const book = books.find((item) => item.id === bookId);
      const passage = book?.passages.find((item) => item.id === passageId);
      if (!book || !passage) {
        setStatus('هذا الرابط محلي؛ لا يوجد الكتاب والموضع في مكتبتك الحالية.');
        return;
      }
      setActiveBookId(book.id);
      setActiveView('reader');
      setCurrentPage(passage.readerPageNumber);
      window.setTimeout(() => focusPassage(passage.id), 100);
    };
    resolveLocalPassageLink();
    window.addEventListener('hashchange', resolveLocalPassageLink);
    return () => window.removeEventListener('hashchange', resolveLocalPassageLink);
  }, [books, booksReady]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121418' : '#dcdcd6');
    try {
      localStorage.setItem('sr:v2:theme', theme);
    } catch {
      // The reader still works if theme preference storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem('sr:v2:root-search', rootSearchEnabled ? '1' : '0');
    } catch {
      // Search mode remains available when preference storage is unavailable.
    }
  }, [rootSearchEnabled]);

  useEffect(() => {
    const observePages = () => {
      const article = document.querySelector('.book-content');
      if (!article || !activeBook) return;
      const observer = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const page = visible?.target.getAttribute('data-reader-page') ?? visible?.target.getAttribute('data-source-page');
        if (page) setCurrentPage(Number(page));
      }, { rootMargin: '-34% 0px -54% 0px', threshold: [0, 0.25, 0.5] });
      article.querySelectorAll<HTMLElement>('section[data-reader-page]').forEach((page) => observer.observe(page));
      return () => observer.disconnect();
    };
    const cleanup = observePages();
    return cleanup;
  }, [activeBookId, activeBook?.html]);

  useEffect(() => {
    const article = document.querySelector<HTMLElement>('.book-content');
    if (!article) return;
    unwrapStudyHighlights(article);
    for (const highlight of activeBook?.study?.highlights ?? []) {
      const parts = passageElements(article, highlight.passageId);
      if (!parts.length) continue;
      const text = parts.map(passagePartText).join(' ');
      let { start, end } = highlight;
      if (text.slice(start, end) !== highlight.quote) {
        const found = text.indexOf(highlight.quote);
        if (found < 0) continue;
        start = found;
        end = found + highlight.quote.length;
      }
      wrapStudyHighlight(parts, start, end, highlight.color, highlight.id);
    }
  }, [activeBookId, activeBook?.html, activeBook?.study?.highlights]);

  useEffect(() => {
    const article = document.querySelector<HTMLElement>('.book-content');
    if (!article || !activeBookId) return;
    article.querySelectorAll('.study-link-group-badge').forEach((badge) => badge.remove());
    for (const group of linkWorkspace.groups) {
      for (const member of group.members.filter((item) => item.bookId === activeBookId)) {
        const host = passageElements(article, member.passageId)[0];
        if (!host) continue;
        const others = group.members.filter((item) => item.bookId !== member.bookId || item.passageId !== member.passageId);
        if (!others.length) continue;
        const badge = document.createElement('span');
        badge.className = 'study-link-group-badge';
        if (group.name) {
          const name = document.createElement('strong');
          name.textContent = `${group.name}:`;
          badge.append(name);
        }
        for (const other of others.slice(0, 3)) {
          const jump = document.createElement('button');
          jump.type = 'button';
          jump.textContent = `${other.bookTitle} · ${other.pageNumberKind === 'source' ? 'ص' : 'موضع'} ${toArabicDigits(other.pageNumber)}`;
          jump.title = quoteExcerpt(other.quote, 100);
          jump.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            navigateToLinkedPassage(other.bookId, other.passageId);
          });
          badge.append(jump);
        }
        if (others.length > 3) {
          const more = document.createElement('span');
          more.textContent = `+${toArabicDigits(others.length - 3)}`;
          badge.append(more);
        }
        host.append(badge);
      }
    }
  }, [activeBookId, activeBook?.html, linkWorkspace.groups]);

  useEffect(() => {
    const article = document.querySelector<HTMLElement>('.book-content');
    if (!article || !activeBook) return;
    article.querySelectorAll('.study-reciprocal-link').forEach((badge) => badge.remove());
    for (const link of activeBook.study?.links ?? []) {
      const endpoints = [
        [link.fromPassageId, link.toPassageId],
        [link.toPassageId, link.fromPassageId],
      ] as const;
      for (const [sourceId, targetId] of endpoints) {
        const source = activeBook.passages.find((passage) => passage.id === sourceId);
        const target = activeBook.passages.find((passage) => passage.id === targetId);
        const host = passageElements(article, sourceId)[0];
        if (!source || !target || !host) continue;
        const targetPage = activeBook.pageNumberKind === 'source' ? target.sourcePageNumber ?? target.readerPageNumber : target.readerPageNumber;
        const badge = document.createElement('span');
        badge.className = 'study-reciprocal-link';
        const jump = document.createElement('button');
        jump.type = 'button';
        jump.textContent = `ينظر: ${activeBook.pageNumberKind === 'source' ? 'ص' : 'موضع'} ${toArabicDigits(targetPage)}`;
        jump.title = quoteExcerpt(target.text, 100);
        jump.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          selectPassage(target.id);
        });
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'study-reciprocal-remove';
        remove.textContent = '×';
        remove.setAttribute('aria-label', 'حذف الإحالة من الموضعين');
        remove.title = 'حذف الإحالة من الموضعين';
        remove.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (window.confirm('حذف هذه الإحالة من الموضعين؟')) void saveStudy((study) => removePassageLink(study, link.id), 'حُذفت الإحالة من الموضعين.');
        });
        badge.append(jump, remove);
        host.append(badge);
      }
    }
  }, [activeBookId, activeBook?.html, activeBook?.passages, activeBook?.study?.links]);

  useEffect(() => {
    const article = document.querySelector<HTMLElement>('.book-content');
    if (!article || !activeBook) return;
    article.querySelectorAll('.study-source-marks').forEach((marks) => marks.remove());
    const study = normalizeStudyData(activeBook.study);
    const passageIds = new Set([
      ...study.clips.map((item) => item.passageId),
      ...study.favorites.map((item) => item.passageId),
      ...study.notebook.map((item) => item.passageId),
      ...study.comments.map((item) => item.passageId),
      ...study.highlights.map((item) => item.passageId),
    ]);
    for (const passageId of passageIds) {
      const host = passageElements(article, passageId)[0];
      if (!host) continue;
      const marks = document.createElement('span');
      marks.className = 'study-source-marks';
      marks.setAttribute('role', 'group');
      marks.setAttribute('aria-label', 'العناصر المحفوظة لهذا المقطع');
      const addMark = (symbol: string, label: string, panel: StudyPanelTab, count = 1) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'study-source-mark';
        button.dataset.studyPanel = panel;
        button.dataset.studyPassage = passageId;
        button.textContent = count > 1 ? `${symbol}${toArabicDigits(count)}` : symbol;
        button.title = label;
        button.setAttribute('aria-label', `فتح ${label} لهذا المقطع`);
        marks.append(button);
      };
      const clips = study.clips.filter((item) => item.passageId === passageId);
      const favorites = study.favorites.filter((item) => item.passageId === passageId);
      const notes = study.notebook.filter((item) => item.passageId === passageId);
      const comments = study.comments.filter((item) => item.passageId === passageId);
      const highlights = study.highlights.filter((item) => item.passageId === passageId);
      if (clips.length) addMark('ق', 'الحافظة', 'collection', clips.length);
      if (favorites.length) addMark('★', 'المفضلة', 'favorites', favorites.length);
      if (notes.length || comments.length) addMark('د', 'دفتر المذاكرة', 'notebook', notes.length + comments.length);
      if (highlights.length) addMark('ظ', 'التظليلات والتصنيفات', 'categories', highlights.length);
      if (marks.childElementCount) host.append(marks);
    }
  }, [activeBookId, activeBook?.html, activeBook?.passages, activeBook?.study]);

  useEffect(() => {
    const article = document.querySelector<HTMLElement>('.book-content');
    if (!article || !activeBook) return;
    article.querySelectorAll('.passage-fold-toggle').forEach((toggle) => toggle.remove());
    article.querySelectorAll<HTMLElement>('[data-passage-id].is-folded').forEach((part) => part.classList.remove('is-folded'));
    for (const passageId of foldedPassageIds) {
      const parts = passageElements(article, passageId);
      const firstPart = parts[0];
      if (!firstPart) continue;
      parts.forEach((part) => part.classList.add('is-folded'));
      const passage = activeBook.passages.find((item) => item.id === passageId);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'passage-fold-toggle';
      toggle.dataset.foldPassageId = passageId;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'فقرة مطوية. اضغط لعرض الفقرة.');
      const summary = document.createElement('span');
      summary.className = 'passage-fold-summary';
      summary.textContent = `مطوي · ${quoteExcerpt(passage?.text ?? passagePartText(firstPart), 150)}`;
      toggle.append(summary);
      const highlights = (activeBook.study?.highlights ?? []).filter((highlight) => highlight.passageId === passageId);
      if (highlights.length) {
        const savedMarks = document.createElement('span');
        savedMarks.className = 'passage-fold-highlights';
        savedMarks.setAttribute('aria-label', `${toArabicDigits(highlights.length)} تظليل محفوظ`);
        for (const highlight of highlights) {
          const chip = document.createElement('span');
          chip.className = `passage-fold-highlight color-${highlight.color}`;
          chip.textContent = quoteExcerpt(highlight.quote, 95);
          savedMarks.append(chip);
        }
        toggle.append(savedMarks);
      }
      firstPart.before(toggle);
    }
  }, [activeBookId, activeBook?.html, activeBook?.passages, foldedPassageIds, activeBook?.study?.highlights]);

  useEffect(() => {
    if (!studyDrawerOpen || !studyPassageId) return;
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLElement>(`.study-drawer [data-study-passage-id="${CSS.escape(studyPassageId)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [studyDrawerOpen, studyPanel, studyPassageId]);

  useEffect(() => {
    if (!pendingPassageNavigation || !activeBook || pendingPassageNavigation.bookId !== activeBookId) return;
    const passage = activeBook.passages.find((item) => item.id === pendingPassageNavigation.passageId);
    if (!passage) {
      setStatus('الموضع المرتبط غير موجود في هذه النسخة من الكتاب.');
      setPendingPassageNavigation(undefined);
      return;
    }
    setCurrentPage(passage.readerPageNumber);
    const timer = window.setTimeout(() => {
      const target = passageElements(document, passage.id)[0];
      if (target) {
        focusPassage(passage.id);
        showPassageActions(target);
      }
      setPendingPassageNavigation(undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [activeBookId, activeBook, pendingPassageNavigation]);

  useEffect(() => {
    if (!activeBook) return;
    if (hidePassageToolbarTimer.current !== undefined) window.clearTimeout(hidePassageToolbarTimer.current);
    hidePassageToolbarTimer.current = undefined;
    setExpandedOutlineIds(new Set(outline.filter((node) => node.children.length > 0).map((node) => node.heading.id)));
    setOutlineQuery('');
    setSearchCategoryId('');
    setCurrentHeadingId(undefined);
    setPassageActions(undefined);
    setSelectionActions(undefined);
    setStudyPassageId(undefined);
    setFoldedPassageIds([]);
    setSelectedClipIds([]);
    setCommentDraft('');
    setCommentHtmlDraft(undefined);
    setCommentContext(undefined);
    setNotebookDraft('');
    setNotebookHtmlDraft(undefined);
    setActiveNotebookId(undefined);
    setSelectedCategoryId('');
    passageAnchor.current = undefined;
    selectionAnchor.current = undefined;
    selectionRange.current = undefined;
  }, [activeBookId, activeBook?.headings, outline]);

  useEffect(() => {
    if (!activeBook) return;
    let frame = 0;
    const updateCurrentHeading = () => {
      const headings = Array.from(document.querySelectorAll<HTMLElement>('.book-content [data-heading-id]'));
      if (!headings.length) {
        setCurrentHeadingId(undefined);
        return;
      }
      const marker = window.innerHeight * 0.34;
      let current = headings[0];
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > marker) break;
        current = heading;
      }
      const id = current.dataset.headingId;
      if (!id) return;
      setCurrentHeadingId((existing) => existing === id ? existing : id);
      const ancestors = outlineAncestorIds(outline, id) ?? [];
      if (ancestors.length) {
        setExpandedOutlineIds((existing) => {
          if (ancestors.every((ancestor) => existing.has(ancestor))) return existing;
          return new Set([...existing, ...ancestors]);
        });
      }
    };
    const onScroll = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateCurrentHeading);
    };
    updateCurrentHeading();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [activeBookId, activeBook?.html, outline]);

  useEffect(() => {
    if (!passageActions && !selectionActions) return;
    const reposition = () => {
      const passageElement = passageAnchor.current;
      if (passageActions && passageElement?.isConnected) {
        const passage = activeBook?.passages.find((item) => item.id === passageElement.dataset.passageId);
        if (passage) positionPassageActions(passageElement, passage, passage.text);
      } else if (passageActions) {
        setPassageActions(undefined);
      }
      const range = selectionRange.current;
      const selectedElement = selectionAnchor.current;
      if (selectionActions && range && selectedElement?.isConnected) {
        const passage = activeBook?.passages.find((item) => item.id === selectedElement.dataset.passageId);
        if (passage) positionSelectionActions(passage, selectionActions.quote, selectionActions.range ?? { start: 0, end: selectionActions.quote.length }, range.getBoundingClientRect());
      } else if (selectionActions) {
        setSelectionActions(undefined);
      }
    };
    window.addEventListener('scroll', reposition, { passive: true });
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition);
      window.removeEventListener('resize', reposition);
    };
  }, [activeBook, passageActions, selectionActions]);

  function focusPassage(passageId: string) {
    document.querySelectorAll('.passage-selected').forEach((item) => item.classList.remove('passage-selected'));
    const parts = passageElements(document, passageId);
    const wasFolded = foldedPassageIds.includes(passageId);
    if (wasFolded) {
      setFoldedPassageIds((current) => current.filter((id) => id !== passageId));
      parts.forEach((part) => part.classList.remove('is-folded'));
      document.querySelectorAll<HTMLButtonElement>(`.passage-fold-toggle[data-fold-passage-id="${CSS.escape(passageId)}"]`).forEach((toggle) => toggle.remove());
    }
    parts.forEach((part) => part.classList.add('passage-selected'));
    if (wasFolded) window.requestAnimationFrame(() => parts[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    else parts[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function foldSelectedPassage() {
    const range = selectionRange.current;
    const article = document.querySelector<HTMLElement>('.book-content');
    if (!range || !article) return;
    const passageIds = Array.from(article.querySelectorAll<HTMLElement>('[data-passage-id]'))
      .filter((part) => {
        try { return range.intersectsNode(part); } catch { return false; }
      })
      .map((part) => part.dataset.passageId)
      .filter((id): id is string => Boolean(id));
    if (!passageIds.length) return;
    setFoldedPassageIds((current) => Array.from(new Set([...current, ...passageIds])));
    window.getSelection()?.removeAllRanges();
    selectionRange.current = undefined;
    selectionAnchor.current = undefined;
    setSelectionActions(undefined);
  }

  function positionPassageActions(element: HTMLElement, passage: Passage, quote: string, anchorRect = element.getBoundingClientRect(), range?: { start: number; end: number }) {
    const page = element.closest<HTMLElement>('section[data-reader-page]');
    const pageRect = page?.getBoundingClientRect();
    const verticalLeft = anchorRect.right + 7;
    const hasRoomBesidePassage = Boolean(pageRect && pageRect.right - anchorRect.right >= 46 && verticalLeft + 40 <= window.innerWidth - 6);
    if (hasRoomBesidePassage) {
      const next = { passage, quote, top: Math.max(8, Math.min(anchorRect.top, window.innerHeight - 88)), left: verticalLeft, layout: 'vertical' as const, range };
      setPassageActions((current) => current && current.passage.id === passage.id && current.top === next.top && current.left === next.left && current.layout === next.layout ? current : next);
      return;
    }
    const toolbarTop = anchorRect.top >= 56 ? anchorRect.top - 48 : anchorRect.bottom + 8;
    const toolbarHalf = Math.min(165, Math.max(12, window.innerWidth / 2 - 8));
    const horizontalCenter = Math.min(Math.max(anchorRect.left + anchorRect.width / 2, toolbarHalf), window.innerWidth - toolbarHalf);
    const next = { passage, quote, top: Math.min(toolbarTop, window.innerHeight - 50), left: horizontalCenter, layout: 'horizontal' as const, range };
    setPassageActions((current) => current && current.passage.id === passage.id && current.top === next.top && current.left === next.left && current.layout === next.layout ? current : next);
  }

  function positionSelectionActions(passage: Passage, quote: string, range: { start: number; end: number }, anchorRect: DOMRect) {
    const toolbarTop = anchorRect.top >= 58 ? anchorRect.top - 52 : anchorRect.bottom + 8;
    const toolbarHalf = Math.min(315, Math.max(12, window.innerWidth / 2 - 7));
    const horizontalCenter = Math.min(Math.max(anchorRect.left + anchorRect.width / 2, toolbarHalf), window.innerWidth - toolbarHalf);
    const next = { passage, quote, top: Math.max(6, Math.min(toolbarTop, window.innerHeight - 54)), left: horizontalCenter, layout: 'horizontal' as const, range };
    setSelectionActions((current) => current && current.passage.id === passage.id && current.quote === quote && current.top === next.top && current.left === next.left && current.range?.start === range.start && current.range?.end === range.end ? current : next);
  }

  function showPassageActions(element: HTMLElement, quote?: string, anchorRect?: DOMRect, range?: { start: number; end: number }) {
    const passageId = element.dataset.passageId;
    const passage = activeBook?.passages.find((item) => item.id === passageId);
    if (!passage) return;
    if (hidePassageToolbarTimer.current !== undefined) window.clearTimeout(hidePassageToolbarTimer.current);
    hidePassageToolbarTimer.current = undefined;
    const resolvedQuote = passage.text;
    if (passageAnchor.current === element && passageActions?.passage.id === passage.id && passageActions.quote === resolvedQuote && passageActions.range?.start === range?.start && passageActions.range?.end === range?.end) return;
    passageAnchor.current = element;
    setStudyPassageId(passage.id);
    positionPassageActions(element, passage, resolvedQuote, element.getBoundingClientRect());
  }

  function showSelectionActions(element: HTMLElement, selectedRange: Range, quote: string, offsets: { start: number; end: number }) {
    const passage = activeBook?.passages.find((item) => item.id === element.dataset.passageId);
    if (!passage) return;
    if (hidePassageToolbarTimer.current !== undefined) window.clearTimeout(hidePassageToolbarTimer.current);
    hidePassageToolbarTimer.current = undefined;
    selectionAnchor.current = element;
    selectionRange.current = selectedRange.cloneRange();
    setStudyPassageId(passage.id);
    const startNode = selectedRange.startContainer;
    const startElement = startNode instanceof Element ? startNode : startNode.parentElement;
    const mark = startElement?.closest<HTMLElement>('mark.study-highlight');
    const savedHighlight = mark && quote === mark.textContent?.trim()
      ? activeBook?.study?.highlights.find((highlight) => highlight.id === mark.dataset.highlightId)
      : undefined;
    setSelectedCategoryId(savedHighlight ? savedHighlight.categoryId ?? 'none' : '');
    positionSelectionActions(passage, quote, offsets, selectedRange.getBoundingClientRect());
  }

  function scheduleHidePassageActions() {
    if (hidePassageToolbarTimer.current !== undefined) window.clearTimeout(hidePassageToolbarTimer.current);
    hidePassageToolbarTimer.current = window.setTimeout(() => {
      setPassageActions(undefined);
      passageAnchor.current = undefined;
      hidePassageToolbarTimer.current = undefined;
    }, 450);
  }

  function onReaderPointerOver(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType !== 'mouse') return;
    const passage = (event.target as HTMLElement).closest<HTMLElement>('[data-passage-id]');
    if (passage && event.currentTarget.contains(passage)) showPassageActions(passage);
  }

  function onReaderPointerUp(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === 'mouse') return;
    const passage = (event.target as HTMLElement).closest<HTMLElement>('[data-passage-id]');
    if (passage && event.currentTarget.contains(passage)) showPassageActions(passage);
  }

  function onReaderMouseUp(event: React.MouseEvent<HTMLElement>) {
    const selection = window.getSelection();
    const rawQuote = selection?.toString() ?? '';
    if (!rawQuote.trim() || !selection?.rangeCount) {
      setSelectionActions(undefined);
      selectionAnchor.current = undefined;
      selectionRange.current = undefined;
      return;
    }
    const anchor = selection.anchorNode;
    const anchorElement = anchor instanceof Element ? anchor : anchor?.parentElement;
    const passageElement = anchorElement?.closest<HTMLElement>('[data-passage-id]');
    if (!passageElement || !event.currentTarget.contains(passageElement)) {
      setSelectionActions(undefined);
      selectionAnchor.current = undefined;
      selectionRange.current = undefined;
      return;
    }
    const selectedRange = selection.getRangeAt(0);
    const focusNode = selection.focusNode;
    const focusElement = focusNode instanceof Element ? focusNode : focusNode?.parentElement;
    const focusPassage = focusElement?.closest<HTMLElement>('[data-passage-id]');
    const passageId = passageElement.dataset.passageId;
    if (!passageId || focusPassage?.dataset.passageId !== passageId) {
      setSelectionActions(undefined);
      selectionAnchor.current = undefined;
      selectionRange.current = undefined;
      return;
    }
    const parts = passageElements(event.currentTarget, passageId);
    const start = passageTextOffset(parts, selectedRange.startContainer, selectedRange.startOffset);
    const end = passageTextOffset(parts, selectedRange.endContainer, selectedRange.endOffset);
    if (start === undefined || end === undefined || end <= start) {
      setSelectionActions(undefined);
      selectionAnchor.current = undefined;
      selectionRange.current = undefined;
      return;
    }
    const leading = rawQuote.length - rawQuote.trimStart().length;
    const trailing = rawQuote.length - rawQuote.trimEnd().length;
    const exactStart = start + leading;
    const exactEnd = end - trailing;
    const passageRecord = activeBook?.passages.find((item) => item.id === passageId);
    const quote = passageRecord?.text.slice(exactStart, exactEnd).trim() ?? rawQuote.trim();
    if (exactEnd <= exactStart) return;
    const rangeRect = selectedRange.getBoundingClientRect();
    if (!rangeRect.width && !rangeRect.height) return;
    showPassageActions(passageElement);
    showSelectionActions(passageElement, selectedRange, quote, { start: exactStart, end: exactEnd });
  }

  function onReaderClick(event: React.MouseEvent<HTMLElement>) {
    const foldToggle = (event.target as HTMLElement).closest<HTMLButtonElement>('.passage-fold-toggle[data-fold-passage-id]');
    if (foldToggle) {
      event.preventDefault();
      event.stopPropagation();
      const passageId = foldToggle.dataset.foldPassageId;
      if (passageId) {
        setFoldedPassageIds((current) => current.filter((id) => id !== passageId));
        passageElements(event.currentTarget, passageId).forEach((part) => part.classList.remove('is-folded'));
        foldToggle.remove();
      }
      return;
    }
    const sourceMark = (event.target as HTMLElement).closest<HTMLButtonElement>('.study-source-mark[data-study-panel][data-study-passage]');
    if (sourceMark) {
      event.preventDefault();
      event.stopPropagation();
      const passageId = sourceMark.dataset.studyPassage;
      const panel = sourceMark.dataset.studyPanel as StudyPanelTab | undefined;
      if (!passageId || !panel) return;
      setStudyPassageId(passageId);
      setStudyPanel(panel);
      setStudyDrawerOpen(true);
      if (panel === 'notebook') {
        const entry = notebookEntries.find((item) => item.passageId === passageId);
        if (entry) openNotebookStudyEntry(entry);
      }
      if (panel !== 'notebook' || !notebookEntries.some((item) => item.passageId === passageId)) selectPassage(passageId);
      return;
    }
    const mark = (event.target as HTMLElement).closest<HTMLElement>('mark.study-highlight');
    if (!mark) return;
    const passage = mark.closest<HTMLElement>('[data-passage-id]');
    if (!passage) return;
    const range = document.createRange();
    range.selectNodeContents(mark);
    const parts = passageElements(event.currentTarget, passage.dataset.passageId ?? '');
    const start = passageTextOffset(parts, range.startContainer, range.startOffset);
    const end = passageTextOffset(parts, range.endContainer, range.endOffset);
    const rawQuote = range.toString();
    const leading = rawQuote.length - rawQuote.trimStart().length;
    const trailing = rawQuote.length - rawQuote.trimEnd().length;
    const passageRecord = activeBook?.passages.find((item) => item.id === passage.dataset.passageId);
    const quote = start === undefined || end === undefined
      ? rawQuote.trim()
      : passageRecord?.text.slice(start + leading, end - trailing).trim() ?? rawQuote.trim();
    if (start === undefined || end === undefined || end - trailing <= start + leading || !quote) return;
    showPassageActions(passage);
    showSelectionActions(passage, range, quote, { start: start + leading, end: end - trailing });
  }

  async function addBook(book: ImportedBook) {
    await saveBook(book);
    setBooks((current) => [book, ...current.filter((item) => item.id !== book.id)]);
    setActiveBookId(book.id);
    setActiveView('reader');
    setPassageActions(undefined);
    setSearchQuery('');
    setCurrentPage(resumeReaderPage(book));
    setStatus(book.warnings.length
      ? `استُورد الكتاب، مع تنبيه: ${book.warnings.join(' ')}`
      : `أُضيف «${book.title}» إلى المكتبة`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function updateBookShelfTag(bookId: string, rawTag: string, assigned: boolean): Promise<boolean> {
    const tag = normalizeShelfTag(rawTag);
    if (!tag) return false;
    const write = studyWriteQueue.current.then(async () => {
      const latestBook = (await getBooks()).find((book) => book.id === bookId);
      if (!latestBook) return;
      const updatedBook = setBookShelfTag(latestBook, tag, assigned);
      await saveBook(updatedBook);
      setBooks((current) => current.map((book) => book.id === bookId ? updatedBook : book));
    });
    studyWriteQueue.current = write.catch(() => undefined);
    try {
      await write;
      setStatus(assigned ? `أُضيف الوسم «${tag}» إلى الكتاب.` : `أُزيل الوسم «${tag}» من الكتاب.`);
      return true;
    } catch {
      setStatus('تعذر حفظ وسوم الكتاب محلياً.');
      return false;
    }
  }

  async function addBookShelfTag(bookId: string, rawTag: string): Promise<boolean> {
    const tag = normalizeShelfTag(rawTag);
    if (!tag) {
      setStatus('اكتب اسماً للوسم أولاً.');
      return false;
    }
    return updateBookShelfTag(bookId, tag, true);
  }

  async function moveBookToFolder(bookId: string, folderId?: string) {
    const write = studyWriteQueue.current.then(async () => {
      const latestBook = (await getBooks()).find((book) => book.id === bookId);
      if (!latestBook) return;
      const updatedBook: BookRecord = { ...latestBook, folderId };
      await saveBook(updatedBook);
      setBooks((current) => current.map((book) => book.id === bookId ? updatedBook : book));
    });
    studyWriteQueue.current = write.catch(() => undefined);
    try {
      await write;
      setStatus(folderId ? 'نُقل الكتاب إلى المجلد.' : 'أُزيل الكتاب من المجلد.');
    } catch {
      setStatus('تعذر حفظ موقع الكتاب في المجلد.');
    }
  }

  async function createLibraryFolder(parentId: string | undefined, name: string): Promise<boolean> {
    const normalizedName = name.trim();
    if (!normalizedName) return false;
    if (libraryFolders.some((folder) => folder.parentId === parentId && folder.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase())) {
      setStatus('يوجد مجلد بهذا الاسم في هذا المستوى.');
      return false;
    }
    const folder: LibraryFolder = { id: crypto.randomUUID(), name: normalizedName, parentId, createdAt: new Date().toISOString() };
    try {
      await saveLibraryFolder(folder);
      setLibraryFolders((current) => [...current, folder]);
      setLibraryFolderFilter(folder.id);
      setStatus(`أُنشئ مجلد «${normalizedName}».`);
      return true;
    } catch {
      setStatus('تعذر حفظ المجلد في المكتبة المحلية.');
      return false;
    }
  }

  async function renameLibraryFolder(folderId: string, name: string): Promise<boolean> {
    const normalizedName = name.trim();
    const existing = libraryFolders.find((folder) => folder.id === folderId);
    if (!existing || !normalizedName) return false;
    if (libraryFolders.some((folder) => folder.id !== folderId && folder.parentId === existing.parentId && folder.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase())) {
      setStatus('يوجد مجلد بهذا الاسم في هذا المستوى.');
      return false;
    }
    const updated = { ...existing, name: normalizedName };
    try {
      await saveLibraryFolder(updated);
      setLibraryFolders((current) => current.map((folder) => folder.id === folderId ? updated : folder));
      setStatus('حُفظ اسم المجلد.');
      return true;
    } catch {
      setStatus('تعذر حفظ اسم المجلد.');
      return false;
    }
  }

  async function removeLibraryFolder(folderId: string) {
    const removed = libraryFolders.find((folder) => folder.id === folderId);
    if (!removed) return;
    try {
      await deleteLibraryFolder(folderId);
      setLibraryFolders((current) => current.filter((folder) => folder.id !== folderId).map((folder) => folder.parentId === folderId ? { ...folder, parentId: removed.parentId } : folder));
      setBooks((current) => current.map((book) => book.folderId === folderId ? { ...book, folderId: undefined } : book));
      setLibraryFolderFilter(removed.parentId ?? 'all');
      setStatus('حُذف المجلد ونُقلت كتبه إلى غير المصنّف.');
    } catch {
      setStatus('تعذر حذف المجلد من المكتبة المحلية.');
    }
  }

  function openBookFromLibrary(book: BookRecord) {
    setActiveBookId(book.id);
    setActiveView('reader');
    setPassageActions(undefined);
    setSelectionActions(undefined);
    setSearchQuery('');
    setCurrentPage(resumeReaderPage(book));
  }

  async function loadDemo() {
    setIsBusy(true);
    try {
      const source = demoBookMarkdown.replaceAll('./research-figure.svg', '/samples/research-figure.svg');
      const { importMarkdown } = await import('../importers/markdown');
      const book = await importMarkdown(source, 'research-book.md');
      book.html = book.html.replaceAll('/samples/research-figure.svg', demoFigureUrl);
      await addBook(book);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر تحميل العينة.');
    } finally {
      setIsBusy(false);
    }
  }

  async function importFiles(fileList?: FileList | readonly File[] | null) {
    const files = Array.from(fileList ?? []);
    const sourceFiles = files.filter((file) => /\.(?:md|markdown|html|htm|docx|txt|epub|odt)$/i.test(file.name));
    if (sourceFiles.length !== 1) {
      setStatus(sourceFiles.length ? 'اختر كتاباً واحداً بصيغة Markdown أو HTML أو DOCX أو TXT أو EPUB أو ODT؛ ويمكن اختيار الصور المحلية مع HTML.' : 'اختر كتاب Markdown أو HTML أو DOCX أو TXT أو EPUB أو ODT؛ ويمكن تحديد الصور المحلية مع HTML.');
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    const source = sourceFiles[0];
    const assets = files.filter((file) => file !== source);
    setIsBusy(true);
    try {
      let book: ImportedBook;
      if (/\.html?$/i.test(source.name)) {
        const { importHtml } = await import('../importers/html');
        book = await importHtml(await source.text(), source.name, assets, source.webkitRelativePath || source.name);
      } else if (/\.docx$/i.test(source.name)) {
        const { importDocx } = await import('../importers/docx');
        book = await importDocx(source);
      } else if (/\.txt$/i.test(source.name)) {
        const { importPlainText } = await import('../importers/plain-text');
        book = await importPlainText(await source.text(), source.name, source.webkitRelativePath || source.name);
        if (assets.length) book.warnings.push('تُجاهلَت الملفات الإضافية؛ لا تُرفق الصور بملفات TXT.');
      } else if (/\.epub$/i.test(source.name)) {
        const { importEpub } = await import('../importers/epub');
        book = await importEpub(source);
      } else if (/\.odt$/i.test(source.name)) {
        const { importOdt } = await import('../importers/odt');
        book = await importOdt(source);
      } else {
        const { importMarkdown } = await import('../importers/markdown');
        book = await importMarkdown(await source.text(), source.name, { assets, sourcePath: source.webkitRelativePath || source.name });
      }
      if (/\.docx$/i.test(source.name) && assets.length) {
        book.warnings.push('تجاهل القارئ الملفات الإضافية؛ الصور المضمّنة في DOCX تُقرأ من الملف نفسه.');
      }
      await addBook(book);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر استيراد الملف.');
    } finally {
      setIsBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function importDroppedFiles(files: readonly File[]) {
    if (activeBook) return;
    const sourceFiles = files.filter((file) => /\.(?:md|markdown|html|htm|docx|txt|epub|odt)$/i.test(file.name));
    if (!sourceFiles.length) {
      setStatus('لم يُعثر على كتاب مدعوم في الملفات المسقطة. الصيغ المدعومة: Markdown وHTML وDOCX وTXT وEPUB وODT.');
      return;
    }
    if (sourceFiles.length === 1) {
      await importFiles(files);
      return;
    }
    const assets = files.filter((file) => !sourceFiles.includes(file));
    for (const source of sourceFiles) await importFiles([source, ...assets]);
  }

  function showBookPasteDialog(text = '', html = '') {
    setBookPasteText(text);
    setBookPasteHtml(html);
    setBookPasteFormat(html ? 'html' : 'auto');
    if (!bookPasteDialog.current?.open) bookPasteDialog.current?.showModal();
    window.setTimeout(() => bookPasteTextarea.current?.focus(), 30);
  }

  async function openBookPasteDialog() {
    let text = '';
    let html = '';
    try {
      if (navigator.clipboard?.read) {
        for (const item of await navigator.clipboard.read()) {
          if (item.types.includes('text/plain')) text = await (await item.getType('text/plain')).text();
          if (item.types.includes('text/html')) html = await (await item.getType('text/html')).text();
        }
      }
    } catch {
      // Browsers may deny clipboard reads; the dialog still accepts a direct paste.
    }
    showBookPasteDialog(text, html);
  }

  async function importPastedBook() {
    const text = bookPasteText;
    const html = bookPasteHtml;
    if (!text.trim() && !html.trim()) {
      setStatus('الصق نص الكتاب أولاً.');
      bookPasteTextarea.current?.focus();
      return;
    }
    const format = bookPasteFormat === 'auto'
      ? html.trim() ? 'html' : (text.match(/^#{1,6}\s/mg) ?? []).length >= 2 ? 'markdown' : 'text'
      : bookPasteFormat;
    setIsBusy(true);
    try {
      let book: ImportedBook;
      if (format === 'html') {
        book = await (await import('../importers/html')).importHtml(html || text, 'نص ملصق.html');
      } else if (format === 'markdown') {
        if (!text.trim()) throw new Error('لا يوجد نص Markdown لاستيراده.');
        book = await (await import('../importers/markdown')).importMarkdown(text, 'نص ملصق.md');
      } else {
        if (!text.trim()) throw new Error('لا يوجد نص عادي لاستيراده.');
        book = await (await import('../importers/plain-text')).importPlainText(text, 'نص ملصق.txt');
      }
      await addBook(book);
      bookPasteDialog.current?.close();
      setBookPasteText('');
      setBookPasteHtml('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر استيراد النص الملصق.');
    } finally {
      setIsBusy(false);
    }
  }

  function selectPassage(passageId: string, quote?: string) {
    const passage = activeBook?.passages.find((item) => item.id === passageId);
    if (!passage || !activeBook) return;
    setCurrentPage(passage.readerPageNumber);
    focusPassage(passage.id);
    window.setTimeout(() => {
      const target = passageElements(document, passage.id)[0];
      if (target) showPassageActions(target, quote);
    }, 250);
  }

  function openNotebookStudyEntry(entry: StudyNotebookViewEntry) {
    setStudyPassageId(entry.passageId);
    setStudyPanel('notebook');
    if (entry.kind === 'note') {
      setStudyDrawerOpen(true);
      setActiveNotebookKind('note');
      setActiveNotebookId(entry.id);
      setNotebookDraft(entry.text);
      setNotebookHtmlDraft(entry.html);
      setCommentContext(undefined);
    } else {
      setStudyDrawerOpen(false);
      setActiveNotebookKind('comment');
      setActiveNotebookId(undefined);
      setNotebookDraft('');
      setNotebookHtmlDraft(undefined);
      setCommentDraft(entry.text);
      setCommentHtmlDraft(entry.html);
      setCommentContext(entry.start !== undefined && entry.end !== undefined ? { start: entry.start, end: entry.end, quote: entry.quote } : undefined);
    }
    selectPassage(entry.passageId);
    if (entry.kind === 'comment') window.setTimeout(showPassageCommentDialog, 0);
  }

  function openLibrarySearchMatch(match: LibrarySearchMatch) {
    const book = books.find((item) => item.id === match.bookId);
    if (!book) return;
    const page = match.kind === 'passage'
      ? match.passage.readerPageNumber
      : match.kind === 'heading'
        ? match.heading.readerPageNumber
        : book.readerPages[0] ?? 1;
    setActiveBookId(book.id);
    setActiveView('reader');
    setCurrentPage(page);
    setSearchQuery('');
    setSearchCategoryId('');
    setPassageActions(undefined);
    setSelectionActions(undefined);
    window.setTimeout(() => {
      if (match.kind === 'passage') focusPassage(match.passage.id);
      else if (match.kind === 'heading') {
        setCurrentHeadingId(match.heading.id);
        document.querySelector<HTMLElement>(`[data-heading-id="${CSS.escape(match.heading.id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 220);
  }

  function navigateToLinkedPassage(bookId: string, passageId: string) {
    if (bookId === activeBookId) {
      if (activeBook?.passages.some((item) => item.id === passageId)) selectPassage(passageId);
      else setStatus('الموضع المرتبط غير موجود في هذه النسخة من الكتاب.');
      return;
    }
    if (!books.some((book) => book.id === bookId)) {
      setStatus('الكتاب المرتبط غير موجود في مكتبتك المحلية.');
      return;
    }
    setPendingPassageNavigation({ bookId, passageId });
    setActiveBookId(bookId);
    setActiveView('reader');
  }

  function goToPage(page: number) {
    const target = document.querySelector<HTMLElement>(`section[data-reader-page="${page}"]`);
    if (!target) return;
    setCurrentPage(page);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function copy(value: string, message: string, html?: string) {
    try {
      await copyToClipboard(value, html);
      setStatus(message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر النسخ.');
    }
  }

  async function saveStudy(update: (study: StudyData) => StudyData, successMessage: string): Promise<boolean> {
    if (!activeBook) return false;
    const baseBook = activeBook;
    const write = studyWriteQueue.current.then(async () => {
      const latestBook = (await getBooks()).find((book) => book.id === baseBook.id) ?? baseBook;
      const updatedBook = { ...latestBook, study: update(normalizeStudyData(latestBook.study)) };
      await saveBook(updatedBook);
      setBooks((current) => current.map((book) => book.id === updatedBook.id ? updatedBook : book));
    });
    studyWriteQueue.current = write.catch(() => undefined);
    try {
      await write;
      setStatus(successMessage);
      return true;
    } catch {
      setStatus('تعذر حفظ أداة المقطع محلياً.');
      return false;
    }
  }

  async function importStudyBackup(imported: StudyData, mode: 'merge' | 'replace') {
    if (!activeBook) return false;
    const passages = new Set(activeBook.passages.map((passage) => passage.id));
    const { study: compatible, dropped } = keepStudyEntriesForPassages(imported, passages);
    const message = dropped
      ? `${mode === 'replace' ? 'استُبدلت' : 'دُمجت'} بيانات المذاكرة؛ أُهملت ${toArabicDigits(dropped)} عناصر تشير إلى مواضع غير موجودة في هذا الكتاب.`
      : mode === 'replace' ? 'استُبدلت بيانات المذاكرة من النسخة.' : 'دُمجت بيانات المذاكرة من النسخة.';
    return saveStudy((current) => mode === 'replace' ? compatible : mergeStudyData(current, compatible), message);
  }

  function downloadStudyBackup() {
    if (!activeBook) return;
    const backup = createStudyBackup(activeBook, studyData);
    const safeTitle = activeBook.title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'كتاب';
    const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${safeTitle} - نسخة المذاكرة.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    setStatus('نُزّلت نسخة بيانات المذاكرة لهذا الكتاب.');
  }

  function updateLinkWorkspace(update: (workspace: PassageLinkWorkspace) => PassageLinkWorkspace, successMessage: string) {
    const write = linkWriteQueue.current.then(async () => {
      const latest = normalizePassageLinkWorkspace(await getPassageLinkWorkspace());
      const updated = update(latest);
      await savePassageLinkWorkspace(updated);
      setLinkWorkspace(updated);
    });
    linkWriteQueue.current = write.catch(() => undefined);
    void write.then(() => setStatus(successMessage), () => setStatus('تعذر حفظ لوحة الإحالات محلياً.'));
  }

  function toggleLinkTraySelection(itemId: string) {
    setSelectedLinkTrayIds((current) => current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]);
  }

  function createLinkGroupFromSelection() {
    const items = linkWorkspace.trayItems.filter((item) => selectedLinkTrayIds.includes(item.id));
    if (items.length < 2) {
      setStatus('اختر موضعين على الأقل من سلة الربط.');
      return;
    }
    const group: PassageLinkGroup = {
      id: crypto.randomUUID(),
      name: linkGroupNameDraft.trim(),
      createdAt: new Date().toISOString(),
      members: items.map(({ id: _id, addedAt: _addedAt, ...member }) => member),
    };
    updateLinkWorkspace((workspace) => createPassageLinkGroup(workspace, group, selectedLinkTrayIds), 'أُنشئت مجموعة الإحالات.');
    setSelectedLinkTrayIds([]);
    setLinkGroupNameDraft('');
  }

  function addSelectedTrayItemsToGroup(groupId: string) {
    if (!selectedLinkTrayIds.length) return;
    updateLinkWorkspace((workspace) => addPassageLinkTrayItemsToGroup(workspace, groupId, selectedLinkTrayIds), 'أُضيفت المواضع إلى مجموعة الإحالات.');
    setSelectedLinkTrayIds([]);
  }

  function updateStudySettings(patch: Partial<StudySettings>) {
    void saveStudy((study) => ({ ...study, settings: { ...study.settings, ...patch } }), 'حُفظت إعدادات الاستشهاد.');
  }

  function highlightPassage(color: (typeof highlightColors)[number], target = selectionActions ?? passageActions) {
    if (!activeBook || !target) return;
    if (!passageElements(document, target.passage.id).length) return;
    const start = target.range?.start ?? 0;
    const end = target.range?.end ?? target.passage.text.length;
    const quote = target.passage.text.slice(start, end);
    if (!quote.trim()) return;
    const highlight = { id: crypto.randomUUID(), passageId: target.passage.id, start, end, quote, color, createdAt: new Date().toISOString() };
    void saveStudy((study) => addHighlightWithCategory(study, highlight, selectedCategoryId || undefined), 'حُفظ التظليل محلياً.');
  }

  function erasePassageHighlight(target = selectionActions ?? passageActions) {
    if (!target) return;
    const start = target.range?.start ?? 0;
    const end = target.range?.end ?? target.passage.text.length;
    void saveStudy((study) => removeHighlightsInRange(study, target.passage.id, start, end), 'أُزيل التظليل من الموضع.');
  }

  function togglePassageFavorite(target = passageActions) {
    if (!target || !activeBook) return;
    const exists = activeBook.study?.favorites.some((item) => item.passageId === target.passage.id) ?? false;
    void saveStudy((study) => toggleFavorite(study, target.passage.id), exists ? 'أُزيل المقطع من المفضلة.' : 'أُضيف المقطع إلى المفضلة.');
    setStudyPanel('favorites');
    setStudyDrawerOpen(true);
  }

  function openPassageComment(target = selectionActions ?? passageActions) {
    if (!target || !activeBook) return;
    const saved = activeBook.study?.comments.find((item) => item.passageId === target.passage.id);
    setStudyPassageId(target.passage.id);
    setCommentContext(target.range ? { ...target.range, quote: target.quote } : undefined);
    setCommentDraft(saved?.text ?? '');
    setCommentHtmlDraft(saved?.html);
    setActiveNotebookId(undefined);
    setActiveNotebookKind('comment');
    setStudyPanel('notebook');
    setStudyDrawerOpen(false);
    setPassageActions(undefined);
    setSelectionActions(undefined);
    window.setTimeout(showPassageCommentDialog, 0);
  }

  function showPassageCommentDialog() {
    const dialog = passageCommentDialog.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    window.setTimeout(() => dialog.querySelector<HTMLTextAreaElement>('.study-note-textarea')?.focus(), 0);
  }

  async function savePassageComment() {
    if (!studyPassageId) return;
    const text = commentDraft.trim();
    const html = text ? sanitizeRichTextHtml(commentHtmlDraft ?? '') || undefined : undefined;
    const existing = studyData.comments.find((comment) => comment.passageId === studyPassageId);
    const saved = await saveStudy((study) => ({
        ...(text ? upsertStudyComment(study, { id: existing?.id ?? crypto.randomUUID(), passageId: studyPassageId, ...commentContext, text, html, updatedAt: new Date().toISOString() }) : { ...study, comments: study.comments.filter((item) => item.passageId !== studyPassageId) }),
    }), text ? 'حُفظ تعليق المقطع.' : 'أُزيل تعليق المقطع.');
    if (saved) {
      passageCommentDialog.current?.close();
      setActiveNotebookKind(undefined);
      setCommentContext(undefined);
    }
  }

  function clipPassage(target = selectionActions ?? passageActions) {
    if (!target) return;
    const quote = selectedQuoteForClipboard(target.quote, studyData.settings.keepFootnotes, target.range ? selectionRange.current : undefined);
    const clip = { id: crypto.randomUUID(), passageId: target.passage.id, quote, footnoteIds: target.range ? [] : [...(target.passage.footnoteIds ?? [])], createdAt: new Date().toISOString() };
    void saveStudy((study) => addClip(study, clip), 'أُضيف الاقتباس إلى الحافظة.');
    setStudyPanel('collection');
    setStudyDrawerOpen(true);
  }

  function saveNotebookEntry() {
    if (!activeNotebookId) return;
    const html = notebookDraft.trim() ? sanitizeRichTextHtml(notebookHtmlDraft ?? '') || undefined : undefined;
    void saveStudy((study) => updateNotebookEntry(study, activeNotebookId, notebookDraft, html), 'حُفظت ملاحظة دفتر المذاكرة.');
  }

  function addStudyCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryDraft.trim();
    if (!name) return;
    const category = { id: crypto.randomUUID(), name };
    void saveStudy((study) => addStudyCategoryData(study, category), 'أُضيف التصنيف.');
    setCategoryDraft('');
  }

  function addCustomTag(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tag = tagDraft.trim();
    if (!tag) return;
    void saveStudy((study) => addStudyTag(study, tag), 'أُضيف الوسم.');
    setTagDraft('');
  }

  function addFavoriteTag(event: React.FormEvent<HTMLFormElement>, passageId: string) {
    event.preventDefault();
    const tag = favoriteTagDraft.trim();
    if (!tag) return;
    void saveStudy((study) => assignFavoriteTag(study, passageId, tag), 'أُضيف الوسم إلى المقطع.');
    setFavoriteTagDraft('');
    setFavoriteTagEditId(undefined);
  }

  function saveFavoriteDetails(passageId: string) {
    void saveStudy((study) => updateFavoriteDetails(study, passageId, { label: favoriteLabelDraft.trim() || undefined }), 'حُفظ اسم المفضلة.');
    setFavoriteEditId(undefined);
  }

  function updateStudyCategory(id: string, name: string) {
    const value = name.trim();
    if (!value) return;
    void saveStudy((study) => renameStudyCategory(study, id, value), 'حُفظ اسم التصنيف.');
  }

  function updateStudyCategoryColor(id: string, color: string) {
    const value = color as StudyHighlight['color'] | '';
    void saveStudy((study) => setStudyCategoryColorData(study, id, value || undefined), 'حُفظ ربط لون التظليل بالتصنيف.');
  }

  function removeStudyCategory(id: string) {
    void saveStudy((study) => removeStudyCategoryData(study, id), 'حُذف التصنيف وأُبقيت التظليلات.');
    if (selectedCategoryId === id) setSelectedCategoryId('');
    if (searchCategoryId === id) setSearchCategoryId('');
  }

  function togglePassagePin(target = passageActions) {
    if (!target || !activeBook) return;
    const pageNumber = activeBook.pageNumberKind === 'source' ? target.passage.sourcePageNumber ?? target.passage.readerPageNumber : target.passage.readerPageNumber;
    const item = {
      id: crypto.randomUUID(),
      bookId: activeBook.id,
      bookTitle: activeBook.title,
      passageId: target.passage.id,
      pageNumber,
      pageNumberKind: activeBook.pageNumberKind,
      quote: target.passage.text,
      addedAt: new Date().toISOString(),
    } satisfies PassageLinkWorkspace['trayItems'][number];
    const exists = linkWorkspace.trayItems.some((candidate) => candidate.bookId === item.bookId && candidate.passageId === item.passageId);
    updateLinkWorkspace((workspace) => togglePassageLinkTrayItem(workspace, item), exists ? 'أُزيل المقطع من سلة الربط.' : 'أُضيف المقطع إلى سلة الربط.');
    setStudyPanel('links');
    setStudyDrawerOpen(true);
  }

  function selectedStudyClips() {
    return studyData.clips.filter((clip) => selectedClipIds.includes(clip.id));
  }

  function openTurathSearch(text: string) {
    setTurathInitialQuery(text);
    setTurathRequestId((requestId) => requestId + 1);
    setStudyDrawerOpen(false);
    setTurathOpen(true);
    setPassageActions(undefined);
    setSelectionActions(undefined);
  }

  function copyStudyCollection(clips: readonly StudyData['clips'][number][] = studyData.clips) {
    if (!activeBook) return;
    const payloads = clips.map((clip) => clipClipboardPayload(activeBook, clip, studyData.settings));
    const text = joinCitationItems(payloads.map((payload) => payload.text), studyData.settings.collectionSeparator);
    const html = joinCitationHtmlItems(payloads.map((payload) => payload.html), studyData.settings.collectionSeparator);
    if (text) void copy(text, 'نُسخت الاقتباسات المحددة مع بياناتها.', `<div dir="rtl">${html}</div>`);
  }

  function copyStudyClip(clip: StudyData['clips'][number]) {
    if (!activeBook) return;
    const payload = clipClipboardPayload(activeBook, clip, studyData.settings);
    void copy(payload.text, 'نُسخ الاقتباس مع بيانات الاستشهاد.', payload.html);
  }

  async function saveClipQuote(clipId: string) {
    const saved = await saveStudy((study) => updateClipQuote(study, clipId, clipQuoteDraft), 'حُفظ تعديل الاقتباس.');
    if (saved) {
      setClipEditId(undefined);
      setClipQuoteDraft('');
    }
  }

  async function clearStudyCollection() {
    const cleared = await saveStudy(clearClips, 'فُرّغت حافظة الاقتباسات.');
    if (cleared) {
      setConfirmClipClear(false);
      setClipEditId(undefined);
      setClipQuoteDraft('');
      setSelectedClipIds([]);
    }
  }

  function toggleClipSelection(clipId: string) {
    setSelectedClipIds((current) => current.includes(clipId) ? current.filter((id) => id !== clipId) : [...current, clipId]);
  }

  function copyStudyFavorites() {
    if (!activeBook) return;
    const items = visibleFavorites.map((favorite) => {
      const passage = activeBook.passages.find((item) => item.id === favorite.passageId);
      if (!passage) return '';
      const quote = passageCitation(activeBook, passage, passage.text, studyData.settings, passage.footnoteIds);
      return favorite.note?.trim() ? `${quote}\nتعليقي: ${favorite.note.trim()}` : quote;
    });
    const text = joinCitationItems(items, studyData.settings.collectionSeparator);
    if (text) void copy(text, 'نُسخت المقاطع المفضلة مع الاستشهادات والتعليقات.');
  }

  function copyStudyNotebook() {
    if (!activeBook || !notebookEntries.length) return;
    const items = notebookEntries.flatMap((entry) => {
      const passage = activeBook.passages.find((item) => item.id === entry.passageId);
      if (!passage) return [];
      const quote = citationQuote(passage, entry.quote, studyData.settings.keepFootnotes);
      const citation = formatBibliographicCitation(activeBook, passage, studyData.settings);
      const footnotes = studyData.settings.keepFootnotes && quote === passage.text
        ? (passage.footnoteIds ?? []).map((id) => activeBook.footnotes.find((footnote) => footnote.id === id)?.text).filter((text): text is string => Boolean(text))
        : [];
      return [{ entry, quote, citation, footnotes }];
    });
    const plain = items.map(({ entry, quote, citation, footnotes }, index) => [
      `${toArabicDigits(index + 1)}. «${quote}» ${citation}`,
      ...footnotes,
      entry.text.trim() ? `التعليق: ${entry.text.trim()}` : '',
    ].filter(Boolean).join('\n'));
    const rich = items.map(({ entry, quote, citation, footnotes }, index) => {
      const noteHtml = entry.html ? sanitizeRichTextHtml(entry.html) : escapeClipboardHtml(entry.text.trim());
      return `<p dir="rtl" style="margin:0 0 6pt">${toArabicDigits(index + 1)}. «${escapeClipboardHtml(quote)}» <span style="color:#2b5d86">${escapeClipboardHtml(citation)}</span></p>${footnotes.map((footnote) => `<p dir="rtl" style="font-size:12pt;color:#555">${escapeClipboardHtml(footnote)}</p>`).join('')}${entry.text.trim() ? `<div dir="rtl" style="color:#555">تعليق: ${noteHtml}</div>` : ''}`;
    });
    const text = joinCitationItems(plain, studyData.settings.collectionSeparator);
    const html = `<div dir="rtl">${joinCitationHtmlItems(rich, studyData.settings.collectionSeparator)}</div>`;
    if (text) void copy(text, 'نُسخ دفتر المذاكرة مع الاستشهادات والتعليقات.', html);
  }

  function downloadStudyCollectionTxt(clips: readonly StudyData['clips'][number][] = studyData.clips) {
    if (!activeBook || !clips.length) return;
    const items = clips.map((clip) => {
      const passage = activeBook.passages.find((item) => item.id === clip.passageId);
      return passage ? passageCitation(activeBook, passage, clip.quote, studyData.settings, clip.footnoteIds) : clip.quote;
    });
    const text = joinCitationItems(items, studyData.settings.collectionSeparator);
    const blobUrl = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${activeBook.title.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim() || 'مقتطفاتي'}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    setStatus('نُزّلت الاقتباسات المحددة بصيغة TXT مع الاستشهادات.');
  }

  async function downloadStudyCollectionDocx(clips: readonly StudyData['clips'][number][] = studyData.clips) {
    if (!activeBook || !clips.length) return;
    const items = clips.flatMap((clip) => {
      const passage = activeBook.passages.find((entry) => entry.id === clip.passageId);
      if (!passage) return [];
      const footnotes = (clip.footnoteIds ?? [])
        .map((id) => activeBook.footnotes.find((footnote) => footnote.id === id)?.text)
        .filter((text): text is string => Boolean(text));
      return [{
        passageId: passage.id,
        quote: clip.quote,
        citation: formatBibliographicCitation(activeBook, passage, studyData.settings),
        footnotes,
        readerPageNumber: passage.readerPageNumber,
        headingContext: passage.headingContext,
      }];
    });
    if (!items.length) return;
    const content = await buildStudyDocx({
      bookTitle: activeBook.title,
      author: activeBook.author,
      headings: activeBook.headings,
      items,
      restartNumberingPerChapter: studyData.settings.restartWordNumberingPerChapter,
    });
    const safeTitle = activeBook.title.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim() || 'اقتباساتي';
    saveDocxFile(content, `${safeTitle} - اقتباساتي.docx`);
    setStatus('صُدّرت الاقتباسات المحددة بصيغة Word.');
  }

  async function downloadStudyCategoryDocx(categoryId?: string) {
    if (!activeBook) return;
    const categories = studyData.categories.filter((category) => !categoryId || category.id === categoryId);
    const items = categories.flatMap((category) => studyData.highlights
      .filter((highlight) => highlight.categoryId === category.id)
      .sort((left, right) => (passagePositions.get(left.passageId) ?? Number.MAX_SAFE_INTEGER) - (passagePositions.get(right.passageId) ?? Number.MAX_SAFE_INTEGER) || left.start - right.start)
      .flatMap((highlight) => {
        const passage = activeBook.passages.find((entry) => entry.id === highlight.passageId);
        if (!passage) return [];
        const comment = studyData.comments.find((entry) => entry.passageId === highlight.passageId && entry.start === highlight.start && entry.end === highlight.end);
        const footnotes = studyData.settings.keepFootnotes
          ? (passage.footnoteIds ?? []).map((id) => activeBook.footnotes.find((footnote) => footnote.id === id)?.text).filter((text): text is string => Boolean(text))
          : [];
        return [{
          passageId: passage.id,
          quote: citationQuote(passage, highlight.quote, studyData.settings.keepFootnotes),
          citation: formatBibliographicCitation(activeBook, passage, studyData.settings),
          note: comment?.text,
          footnotes,
          readerPageNumber: passage.readerPageNumber,
          headingContext: passage.headingContext,
          groupKey: category.id,
          groupTitle: category.name,
        }];
      }));
    if (!items.length) return;
    const content = await buildStudyDocx({
      bookTitle: activeBook.title,
      author: activeBook.author,
      headings: activeBook.headings,
      items,
      restartNumberingPerChapter: studyData.settings.restartWordNumberingPerChapter,
      coverTitle: categoryId
        ? `تظليلات «${categories[0]?.name ?? ''}» من «${activeBook.title}»`
        : `التظليلات المصنفة من «${activeBook.title}»`,
    });
    const safeTitle = activeBook.title.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim() || 'تظليلاتي';
    const category = categories[0];
    const safeCategory = category?.name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim() || 'التصنيفات';
    const fileName = categoryId ? `${safeTitle} - ${safeCategory}.docx` : `${safeTitle} - التظليلات المصنفة.docx`;
    saveDocxFile(content, fileName);
    setStatus(categoryId ? `صُدّرت تظليلات تصنيف «${category?.name ?? ''}» بصيغة Word.` : 'صُدّرت التظليلات المصنفة بصيغة Word.');
  }

  async function downloadStudyFavoritesDocx() {
    if (!activeBook || !visibleFavorites.length) return;
    const items = visibleFavorites.flatMap((favorite) => {
      const passage = activeBook.passages.find((entry) => entry.id === favorite.passageId);
      if (!passage) return [];
      const footnotes = studyData.settings.keepFootnotes
        ? (passage.footnoteIds ?? []).map((id) => activeBook.footnotes.find((footnote) => footnote.id === id)?.text).filter((text): text is string => Boolean(text))
        : [];
      const metadata = [
        favorite.label?.trim() ? `الاسم: ${favorite.label.trim()}` : '',
        favorite.tags?.length ? `الوسوم: ${favorite.tags.join('، ')}` : '',
        favorite.note?.trim() ? `ملاحظة: ${favorite.note.trim()}` : '',
      ].filter(Boolean).join('\n');
      return [{
        passageId: passage.id,
        quote: citationQuote(passage, passage.text, studyData.settings.keepFootnotes),
        citation: formatBibliographicCitation(activeBook, passage, studyData.settings),
        note: metadata,
        footnotes,
        readerPageNumber: passage.readerPageNumber,
        headingContext: passage.headingContext,
      }];
    });
    if (!items.length) return;
    const content = await buildStudyDocx({
      bookTitle: activeBook.title,
      author: activeBook.author,
      headings: activeBook.headings,
      items,
      restartNumberingPerChapter: studyData.settings.restartWordNumberingPerChapter,
      coverTitle: favoriteFilter ? `المفضلة — ${favoriteFilter} من «${activeBook.title}»` : `المقاطع المفضلة من «${activeBook.title}»`,
    });
    const safeTitle = activeBook.title.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim() || 'مفضلتي';
    const safeFilter = favoriteFilter.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim();
    saveDocxFile(content, `${safeTitle} - ${safeFilter ? `المفضلة ${safeFilter}` : 'المقاطع المفضلة'}.docx`);
    setStatus('صُدّرت المقاطع المفضلة الظاهرة بصيغة Word.');
  }

  async function downloadStudyNotebookDocx() {
    if (!activeBook) return;
    const items: CollectionDocxInput['items'] = [];
    const appendItem = (input: {
      passageId: string;
      quote: string;
      note?: string;
      noteHtml?: string;
      footnoteIds?: readonly string[];
      groupKey: string;
      groupTitle: string;
      groupSectionKey?: string;
      groupSectionTitle?: string;
      headingContext?: string;
      noteBookmarkName?: string;
    }) => {
      const passage = activeBook.passages.find((entry) => entry.id === input.passageId);
      if (!passage) return;
      const footnotes = studyData.settings.keepFootnotes
        ? (input.footnoteIds ?? []).map((id) => activeBook.footnotes.find((footnote) => footnote.id === id)?.text).filter((text): text is string => Boolean(text))
        : [];
      items.push({
        passageId: passage.id,
        quote: citationQuote(passage, input.quote, studyData.settings.keepFootnotes),
        citation: formatBibliographicCitation(activeBook, passage, studyData.settings),
        note: input.note,
        noteHtml: input.noteHtml,
        footnotes,
        readerPageNumber: passage.readerPageNumber,
        headingContext: input.headingContext,
        groupKey: input.groupKey,
        groupTitle: input.groupTitle,
        groupSectionKey: input.groupSectionKey,
        groupSectionTitle: input.groupSectionTitle,
        noteBookmarkName: input.noteBookmarkName,
      });
    };

    notebookEntries.forEach((entry) => {
      const passage = activeBook.passages.find((item) => item.id === entry.passageId);
      appendItem({
      ...entry,
      note: `تعليق: ${entry.text.trim()}`,
      noteHtml: entry.html ? sanitizeRichTextHtml(entry.html) : undefined,
      footnoteIds: [],
      noteBookmarkName: studyNotebookBookmarkName(entry),
      groupKey: 'notebook',
      groupTitle: 'الدفتر: الاقتباسات وتعليقاتي',
      headingContext: passage?.headingContext,
    });
    });

    const allFavorites = filterAndSortFavorites(studyData.favorites, activeBook.passages.map((passage) => passage.id));
    allFavorites.forEach((favorite) => {
      const passage = activeBook.passages.find((entry) => entry.id === favorite.passageId);
      if (!passage) return;
      const note = [
        favorite.label?.trim() ? `الاسم: ${favorite.label.trim()}` : '',
        favorite.tags?.length ? `الوسوم: ${favorite.tags.join('، ')}` : '',
        favorite.note?.trim() ? `تعليقي: ${favorite.note.trim()}` : '',
      ].filter(Boolean).join('\n');
      appendItem({ passageId: passage.id, quote: passage.text, note, footnoteIds: passage.footnoteIds, groupKey: 'favorites', groupTitle: 'المفضلة', headingContext: passage.headingContext });
    });

    for (const category of studyData.categories) {
      const highlights = studyData.highlights
        .filter((highlight) => highlight.categoryId === category.id)
        .sort((left, right) => (passagePositions.get(left.passageId) ?? Number.MAX_SAFE_INTEGER) - (passagePositions.get(right.passageId) ?? Number.MAX_SAFE_INTEGER) || left.start - right.start);
      for (const highlight of highlights) {
        const passage = activeBook.passages.find((entry) => entry.id === highlight.passageId);
        if (!passage) continue;
        const comment = studyData.comments.find((entry) => entry.passageId === highlight.passageId && entry.start === highlight.start && entry.end === highlight.end);
        appendItem({
          passageId: passage.id,
          quote: highlight.quote,
          note: comment?.text ? `تعليق: ${comment.text}` : undefined,
          footnoteIds: highlight.quote === passage.text ? passage.footnoteIds : [],
          groupKey: 'categories',
          groupTitle: 'التصنيفات',
          groupSectionKey: category.id,
          groupSectionTitle: category.name,
        });
      }
    }

    studyData.clips.forEach((clip) => {
      const passage = activeBook.passages.find((entry) => entry.id === clip.passageId);
      if (!passage) return;
      appendItem({
        passageId: passage.id,
        quote: clip.quote,
        footnoteIds: clip.footnoteIds,
        groupKey: 'clips',
        groupTitle: 'الحافظة (المنقولات)',
        headingContext: passage.headingContext,
      });
    });
    if (!items.length) return;
    const content = await buildStudyDocx({
      bookTitle: activeBook.title,
      author: activeBook.author,
      headings: activeBook.headings,
      items,
      restartNumberingPerChapter: studyData.settings.restartWordNumberingPerChapter,
      coverTitle: `دفتر المذاكرة — ${activeBook.title}`,
    });
    const safeTitle = activeBook.title.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim() || 'دفتر المذاكرة';
    saveDocxFile(content, `${safeTitle} - دفتر المذاكرة.docx`);
    setStatus('صُدّر دفتر المذاكرة وأدوات الدراسة بصيغة Word.');
  }

  async function importNotebookWord(file?: File) {
    if (!file || !activeBook || isImportingNotebookWord) return;
    setIsImportingNotebookWord(true);
    if (notebookWordInput.current) notebookWordInput.current.value = '';
    try {
      const { readStudyNotebookWordEdits } = await import('../importers/docx-notebook');
      const edits = await readStudyNotebookWordEdits(await file.arrayBuffer());
      if (!edits.length) {
        setStatus('لم يُعثر على تعليقات دفتر قابلة للاستيراد في ملف Word.');
        return;
      }
      const updatedAt = new Date().toISOString();
      const preview = applyStudyNotebookWordEdits(activeBook, studyData, edits, updatedAt);
      if (!preview.changed) {
        setStatus(preview.ignored
          ? `لم تُطبّق ${toArabicDigits(preview.ignored)} تعديلات لأن مواضعها غير موجودة في هذا الكتاب.`
          : 'لا توجد تغييرات جديدة في تعليقات Word.');
        return;
      }
      const message = preview.ignored
        ? `استُوردت ${toArabicDigits(preview.changed)} تعديلات من Word؛ وتُركت ${toArabicDigits(preview.ignored)} مواضع غير معروفة.`
        : `استُوردت ${toArabicDigits(preview.changed)} تعديلات من Word.`;
      await saveStudy((current) => applyStudyNotebookWordEdits(activeBook, current, edits, updatedAt).study, message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر استيراد تعديلات Word.');
    } finally {
      setIsImportingNotebookWord(false);
    }
  }

  function moveClip(fromId: string, toId: string) {
    if (fromId === toId) return;
    void saveStudy((study) => reorderClips(study, fromId, toId), 'أُعيد ترتيب الاقتباسات.');
    setDraggedClipId(undefined);
  }

  function moveClipByKeyboard(clipId: string, direction: -1 | 1) {
    const index = studyData.clips.findIndex((clip) => clip.id === clipId);
    const target = studyData.clips[index + direction];
    if (target) moveClip(clipId, target.id);
  }

  async function saveMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeBook || !metadataDraft.title.trim()) {
      setStatus('اكتب عنوان الكتاب قبل الحفظ.');
      return;
    }
    const seenAliases = new Set<string>();
    const aliases = metadataDraft.aliases.split(/\r?\n/).map((alias) => alias.trim()).filter((alias) => {
      const key = alias.toLocaleLowerCase();
      if (!alias || seenAliases.has(key)) return false;
      seenAliases.add(key);
      return true;
    });
    const metadata = {
      title: metadataDraft.title.trim(),
      author: metadataDraft.author.trim() || undefined,
      aliases: aliases.length ? aliases : undefined,
    };
    try {
      const write = studyWriteQueue.current.then(async () => {
        const latestBook = (await getBooks()).find((book) => book.id === activeBook.id);
        if (!latestBook) throw new Error('لم يعد الكتاب في المكتبة.');
        const updatedBook: BookRecord = { ...latestBook, ...metadata };
        await saveBook(updatedBook);
        setBooks((current) => current.map((book) => book.id === updatedBook.id ? updatedBook : book));
      });
      studyWriteQueue.current = write.catch(() => undefined);
      await write;
      setMetadataEditing(false);
      setStatus('حُفظت بيانات الكتاب وأسماؤه البديلة.');
    } catch {
      setStatus('تعذر حفظ بيانات الكتاب محلياً.');
    }
  }

  function toggleOutlineBranch(id: string) {
    setExpandedOutlineIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function jumpToHeading(id: string, page: number) {
    const ancestors = outlineAncestorIds(outline, id) ?? [];
    if (ancestors.length) setExpandedOutlineIds((current) => new Set([...current, ...ancestors]));
    setCurrentHeadingId(id);
    setCurrentPage(page);
    document.querySelector<HTMLElement>(`[data-heading-id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const studyPassage = activeBook?.passages.find((passage) => passage.id === studyPassageId);
  const studyData = normalizeStudyData(activeBook?.study);
  const readingReport = summarizeReadingLibrary(books);
  const visibleFavorites = filterAndSortFavorites(studyData.favorites, activeBook?.passages.map((passage) => passage.id) ?? [], favoriteFilter, favoriteSort);
  const passagePositions = new Map((activeBook?.passages ?? []).map((passage, index) => [passage.id, index]));
  const notebookEntries = listStudyNotebookEntries(studyData, activeBook?.passages.map((passage) => passage.id) ?? [], studyData.settings.notebookOrder).map((entry) => {
    const passage = activeBook?.passages.find((item) => item.id === entry.passageId);
    const quote = entry.quote || (passage ? passage.text.slice(entry.start ?? 0, entry.end ?? passage.text.length) : '');
    return { ...entry, quote };
  });
  const normalizedCategoryQuery = normalizeArabicSearch(categoryQuery.trim());
  const visibleCategoryGroups = studyData.categories.map((category) => {
    const categoryMatchesQuery = Boolean(normalizedCategoryQuery && normalizeArabicSearch(category.name).includes(normalizedCategoryQuery));
    return {
      category,
      highlights: studyData.highlights
        .filter((highlight) => highlight.categoryId === category.id)
        .filter((highlight) => {
          if (!normalizedCategoryQuery || categoryMatchesQuery) return true;
          const note = studyData.comments.find((comment) => comment.passageId === highlight.passageId && comment.start === highlight.start && comment.end === highlight.end)?.text ?? '';
          return normalizeArabicSearch(`${highlight.quote} ${note}`).includes(normalizedCategoryQuery);
        })
        .sort((left, right) => (passagePositions.get(left.passageId) ?? Number.MAX_SAFE_INTEGER) - (passagePositions.get(right.passageId) ?? Number.MAX_SAFE_INTEGER) || left.start - right.start),
    };
  }).filter(({ category, highlights }) => highlights.length > 0 || !normalizedCategoryQuery || normalizeArabicSearch(category.name).includes(normalizedCategoryQuery));
  const uncategorizedHighlightCount = studyData.highlights.filter((highlight) => !highlight.categoryId).length;
  const activeNotebookEntry = activeNotebookKind === 'note' ? studyData.notebook.find((entry) => entry.id === activeNotebookId) : undefined;
  const activeNotebookComment = activeNotebookKind === 'comment' ? studyData.comments.find((comment) => comment.passageId === studyPassageId) : undefined;
  const activeNotebookContextQuote = activeNotebookEntry?.quote ?? activeNotebookComment?.quote ?? commentContext?.quote ?? studyPassage?.text;

  function updateReadingStudentName(name: string) {
    setReadingStudentName(name);
    try { window.localStorage.setItem('smart-reader:reading-student', name); } catch { /* report name is optional when local storage is unavailable */ }
  }

  function copyReadingSummary() {
    void copyToClipboard(buildReadingSummaryText(readingReport, readingStudentName))
      .then(() => setStatus('نُسخ ملخص القراءة.'))
      .catch(() => setStatus('تعذر نسخ ملخص القراءة.'));
  }

  function downloadReadingReport() {
    const html = buildReadingTeacherReportHtml(readingReport, readingStudentName);
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `تقرير قراءة ${localReadingDateKey()}.html`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    setStatus('نُزّل تقرير القراءة.');
  }

  return (
    <div
      className={`app-shell${isDraggingFiles && activeView === 'library' ? ' is-file-drag-over' : ''}`}
      onDragEnter={(event) => {
        if (activeView !== 'library' || !Array.from(event.dataTransfer.types).includes('Files')) return;
        event.preventDefault();
        setIsDraggingFiles(true);
      }}
      onDragOver={(event) => {
        if (activeView !== 'library' || !Array.from(event.dataTransfer.types).includes('Files')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(event) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        setIsDraggingFiles(false);
      }}
      onDrop={(event) => {
        if (activeView !== 'library' || !Array.from(event.dataTransfer.types).includes('Files')) return;
        event.preventDefault();
        setIsDraggingFiles(false);
        void importDroppedFiles(Array.from(event.dataTransfer.files));
      }}
      onPaste={(event) => {
        if (activeView !== 'library') return;
        if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"]')) return;
        const files = Array.from(event.clipboardData.files);
        if (files.length) {
          event.preventDefault();
          void importDroppedFiles(files);
          return;
        }
        const text = event.clipboardData.getData('text/plain');
        const html = event.clipboardData.getData('text/html');
        if (text.length > 40 || html) {
          event.preventDefault();
          showBookPasteDialog(text, html);
        }
      }}
    >
      {isDraggingFiles && activeView === 'library' && <div className="file-drop-overlay" role="status" aria-live="polite"><div><Icon name="book" width={28} height={28} /><strong>أفلت الكتب لإضافتها إلى المكتبة</strong><span>Markdown · HTML · Word · TXT · EPUB · ODT</span></div></div>}
      <header className="topbar">
        <button className="brand" type="button" onClick={() => { setStudyDrawerOpen(false); setActiveView('library'); }} aria-label="فتح المكتبة">
          <span className="brand-mark" aria-hidden="true">ق</span>
          <span><strong>قارئ البحث</strong><small>قراءة عربية بصفحاتها وعناوينها</small></span>
        </button>
        <div className="topbar-actions">
          <span className="local-status" role="status"><i />{status}</span>
          <button className="text-button library-view-toggle" type="button" aria-label={activeView === 'reader' ? 'فتح المكتبة' : 'العودة إلى الكتاب'} title={activeView === 'reader' ? 'فتح المكتبة' : 'العودة إلى الكتاب'} disabled={activeView === 'library' && !activeBook} onClick={() => { setStudyDrawerOpen(false); setActiveView(activeView === 'reader' ? 'library' : 'reader'); }}><Icon name="book" width={17} height={17} /><span>{activeView === 'reader' ? 'المكتبة' : 'العودة إلى القراءة'}</span></button>
          <button className="text-button reading-stats-open" type="button" aria-label="إحصاءاتي" title="إحصاءاتي" onClick={() => readingStatsDialog.current?.showModal()}><Icon name="chart" width={17} height={17} /><span>إحصاءاتي</span></button>
          <button className="text-button companion-open" type="button" aria-label="ربط Claude أو Codex بالمكتبة" title="ربط Claude أو Codex بالمكتبة" disabled={!books.length} onClick={() => companionDialog.current?.showModal()}><Icon name="link" width={17} height={17} /><span>ربط المساعد</span></button>
          <button className="text-button book-settings-open" type="button" aria-label="إعدادات الكتاب" title={activeBook ? `إعدادات ${activeBook.title}` : 'اختر كتاباً لفتح إعداداته'} disabled={!activeBook} onClick={() => bookSettingsDialog.current?.showModal()}><Icon name="settings" width={17} height={17} /><span>إعدادات الكتاب</span></button>
          <button className="icon-button theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'} title="تبديل المظهر">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} width={18} height={18} />
          </button>
          <button className="button button-primary" type="button" onClick={() => fileInput.current?.click()} disabled={isBusy} title="لإرفاق الصور المحلية، حدّدها مع ملف Markdown أو HTML في الاختيار نفسه">
            {isBusy ? 'جارٍ الاستيراد…' : 'استيراد كتاب'}
          </button>
          <input ref={fileInput} className="visually-hidden" type="file" accept=".md,.markdown,.html,.htm,.docx,.txt,.epub,.odt,text/markdown,text/html,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip,application/vnd.oasis.opendocument.text,image/*" multiple onChange={(event) => void importFiles(event.currentTarget.files)} />
        </div>
      </header>

      <dialog ref={companionDialog} className="reading-stats-dialog companion-dialog" aria-label="ربط مساعد الذكاء الاصطناعي" onClick={(event) => { if (event.target === event.currentTarget) companionDialog.current?.close(); }}>
        <header><div><span className="eyebrow">مشاركة محلية اختيارية</span><h2>ربط Claude وCodex</h2></div><button className="icon-button" type="button" aria-label="إغلاق ربط المساعد" onClick={() => companionDialog.current?.close()}><Icon name="close" width={17} height={17} /></button></header>
        <div className="reading-stats-dialog-content companion-dialog-content">
          <CompanionPanel
            books={books}
            activeBook={activeBook}
            selection={selectionActions && activeBook ? { bookId: activeBook.id, passageId: selectionActions.passage.id, text: selectionActions.quote } : undefined}
            onClose={() => companionDialog.current?.close()}
          />
        </div>
      </dialog>

      <dialog ref={readingStatsDialog} className="reading-stats-dialog" aria-label="إحصاءات القراءة">
        <header><div><span className="eyebrow">مكتبتك كاملة</span><h2>إحصاءات القراءة</h2></div><button className="icon-button" type="button" aria-label="إغلاق إحصاءات القراءة" onClick={() => readingStatsDialog.current?.close()}><Icon name="close" width={17} height={17} /></button></header>
        <div className="reading-stats-dialog-content"><ReadingStatsContent summary={readingReport} studentName={readingStudentName} onStudentNameChange={updateReadingStudentName} onCopySummary={copyReadingSummary} onDownloadReport={downloadReadingReport} /></div>
      </dialog>

      <dialog ref={passageCommentDialog} className="passage-comment-dialog" aria-labelledby="passage-comment-title" onClose={() => setActiveNotebookKind(undefined)} onClick={(event) => { if (event.target === event.currentTarget) passageCommentDialog.current?.close(); }}>
        <form className="passage-comment-form" onSubmit={(event) => { event.preventDefault(); void savePassageComment(); }}>
          <header><div><span className="eyebrow">دفتر المذاكرة</span><h2 id="passage-comment-title">{commentContext ? 'تعليق على النص المحدد' : 'تعليق على المقطع'}</h2></div><button className="icon-button" type="button" aria-label="إغلاق التعليق" onClick={() => passageCommentDialog.current?.close()}><Icon name="close" width={17} height={17} /></button></header>
          <div className="passage-comment-content">
            <p className="passage-comment-quote" dir="rtl">{quoteExcerpt(commentContext?.quote ?? activeBook?.passages.find((passage) => passage.id === studyPassageId)?.text ?? '', 260)}</p>
            <p className="passage-comment-hint">سيُحفظ التعليق في الدفتر ويرتبط بهذا الموضع في الكتاب.</p>
            <RichNoteEditor key={`passage-comment:${studyPassageId}:${commentContext?.start ?? 'whole'}`} resetKey={`${studyPassageId ?? ''}:${commentContext?.start ?? 'whole'}`} value={commentDraft} htmlValue={commentHtmlDraft} label="نص التعليق" placeholder="اكتب تعليقك هنا…" onChange={(text, html) => { setCommentDraft(text); setCommentHtmlDraft(html); }} />
          </div>
          <footer><button className="text-button" type="button" onClick={() => passageCommentDialog.current?.close()}>إلغاء</button><button className="button button-primary" type="submit">{commentDraft.trim() ? 'حفظ في الدفتر' : 'حذف التعليق'}</button></footer>
        </form>
      </dialog>

      {activeBook && <dialog ref={bookSettingsDialog} className="reading-stats-dialog book-settings-dialog" aria-label="إعدادات الكتاب">
        <header><div><span className="eyebrow">{activeBook.title}</span><h2>إعدادات الكتاب</h2></div><button className="icon-button" type="button" aria-label="إغلاق إعدادات الكتاب" onClick={() => bookSettingsDialog.current?.close()}><Icon name="close" width={17} height={17} /></button></header>
        <div className="reading-stats-dialog-content book-settings-dialog-content"><StudySettingsPanel book={activeBook} settings={studyData.settings} onChange={updateStudySettings} onEditMetadata={() => { setMetadataDraft({ title: activeBook.title, author: activeBook.author ?? '', aliases: (activeBook.aliases ?? []).join('\n') }); setMetadataEditing(true); bookSettingsDialog.current?.close(); }} onExportStudy={downloadStudyBackup} onImportStudy={importStudyBackup} /></div>
      </dialog>}

      <dialog ref={bookPasteDialog} className="book-paste-dialog" aria-label="الصق كتاباً جديداً">
        <header><div><span className="eyebrow">إضافة إلى المكتبة</span><h2>الصق نصاً</h2></div><button className="icon-button" type="button" aria-label="إغلاق نافذة لصق كتاب" onClick={() => bookPasteDialog.current?.close()}><Icon name="close" width={17} height={17} /></button></header>
        <div className="book-paste-content">
          <label className="book-paste-field"><span>نص الكتاب</span><textarea ref={bookPasteTextarea} value={bookPasteText} onChange={(event) => setBookPasteText(event.currentTarget.value)} onPaste={(event) => { const html = event.clipboardData.getData('text/html'); if (html) { setBookPasteHtml(html); setBookPasteFormat('html'); } }} placeholder="الصق نص الكتاب هنا…"></textarea></label>
          <label className="book-paste-format"><span>صيغة النص</span><select value={bookPasteFormat} onChange={(event) => setBookPasteFormat(event.currentTarget.value as typeof bookPasteFormat)}><option value="auto">تلقائي</option><option value="text">نص عادي</option><option value="markdown">Markdown</option>{bookPasteHtml && <option value="html">التنسيق المنسوخ (HTML)</option>}</select></label>
          <p>يكتشف الوضع التلقائي HTML المنسوخ وعناوين Markdown، ويحافظ على علامات الصفحات المعروفة في النص العادي.</p>
        </div>
        <footer><button className="button button-primary" type="button" onClick={() => void importPastedBook()} disabled={isBusy}>{isBusy ? 'جارٍ الاستيراد…' : 'إضافة الكتاب'}</button><button className="text-button" type="button" onClick={() => bookPasteDialog.current?.close()}>إلغاء</button></footer>
      </dialog>

      {activeView === 'library' ? <LibraryPage books={books} folders={libraryFolders} activeBookId={activeBookId} currentPage={currentPage} searchInput={librarySearchInput} searchQuery={librarySearchQuery} folderFilter={libraryFolderFilter} authorFilter={libraryAuthorFilter} tagFilter={libraryTagFilter} sort={librarySort} isBusy={isBusy} onSearchInput={setLibrarySearchInput} onFolderFilter={setLibraryFolderFilter} onAuthorFilter={setLibraryAuthorFilter} onTagFilter={setLibraryTagFilter} onSort={setLibrarySort} onOpenBook={openBookFromLibrary} onOpenMatch={openLibrarySearchMatch} onImport={() => fileInput.current?.click()} onPasteBook={() => void openBookPasteDialog()} onLoadDemo={() => void loadDemo()} onCreateFolder={createLibraryFolder} onRenameFolder={renameLibraryFolder} onDeleteFolder={removeLibraryFolder} onMoveBook={moveBookToFolder} onToggleTag={updateBookShelfTag} onAddTag={addBookShelfTag} /> : <div className="workspace" style={{ '--library-sidebar-width': `${librarySidebarWidth}px` } as React.CSSProperties}>
        <aside className="library-panel reader-outline-panel" aria-label="فهرس الكتاب الحالي">
          <div className="panel-heading"><div><span className="eyebrow">الكتاب الحالي</span><h2>{activeBook?.title ?? 'لا يوجد كتاب مفتوح'}</h2></div><button className="text-button" type="button" onClick={() => setActiveView('library')} disabled={!books.length}>المكتبة</button></div>
          {activeBook ? <>
            <div className="reader-sidebar-book-info"><span>{activeBook.author || 'مؤلف غير محدد'}</span><span>{toArabicDigits(activeBook.readerPageCount)} صفحة</span></div>
            <button className="text-button reader-sidebar-edit" type="button" onClick={() => { setMetadataDraft({ title: activeBook.title, author: activeBook.author ?? '', aliases: (activeBook.aliases ?? []).join('\n') }); setMetadataEditing(true); }}>تعديل بيانات الكتاب</button>
            <nav className="contents-nav" aria-label="فهرس الكتاب">
              <div className="toc-heading"><div className="section-label">فهرس المحتويات</div><button className="text-button" type="button" onClick={() => currentHeadingId && jumpToHeading(currentHeadingId, activeBook.headings.find((item) => item.id === currentHeadingId)?.readerPageNumber ?? currentPage)} disabled={!currentHeadingId}>موضعي الآن</button></div>
              <input className="toc-search" type="search" value={outlineQuery} onChange={(event) => setOutlineQuery(event.target.value)} placeholder="ابحث في العناوين…" aria-label="ابحث في عناوين الفهرس" />
              <div className="toc-bulk-actions"><button type="button" onClick={() => setExpandedOutlineIds(new Set(expandableOutlineIds(outline)))}>توسيع الكل</button><button type="button" onClick={() => setExpandedOutlineIds(new Set())}>طيّ الكل</button></div>
              {filteredOutline.length ? <ContentsTree isRoot nodes={filteredOutline} book={activeBook} expandedIds={visibleExpandedOutlineIds} currentHeadingId={currentHeadingId} onToggle={toggleOutlineBranch} onJump={jumpToHeading} /> : <p className="toc-empty">لا توجد عناوين مطابقة.</p>}
            </nav>
            <div className="library-footnote">الكتاب محفوظ محلياً على هذا الجهاز.</div>
          </> : <p className="book-filter-empty">افتح كتاباً من صفحة المكتبة.</p>}
        </aside>

        <div className="library-sidebar-resizer" role="separator" aria-label="تغيير عرض الشريط الجانبي" aria-orientation="vertical" aria-valuemin={190} aria-valuemax={480} aria-valuenow={librarySidebarWidth} tabIndex={0} onPointerDown={startLibrarySidebarResize} onPointerMove={resizeLibrarySidebar} onPointerUp={stopLibrarySidebarResize} onPointerCancel={stopLibrarySidebarResize} onKeyDown={handleLibrarySidebarResizeKey} />

        <main className="reader-panel">
          {activeBook ? (
            <>
              <header className="reader-heading">
                {metadataEditing ? (
                  <form className="metadata-editor" onSubmit={(event) => void saveMetadata(event)}>
                    <label>عنوان الكتاب<input autoFocus value={metadataDraft.title} onChange={(event) => setMetadataDraft((draft) => ({ ...draft, title: event.target.value }))} /></label>
                    <label>المؤلف<input value={metadataDraft.author} onChange={(event) => setMetadataDraft((draft) => ({ ...draft, author: event.target.value }))} /></label>
                    <label className="metadata-aliases">أسماء بديلة (اسم في كل سطر)<textarea rows={2} value={metadataDraft.aliases} onChange={(event) => setMetadataDraft((draft) => ({ ...draft, aliases: event.target.value }))} placeholder="أسماء أخرى للكتاب تساعد في العثور عليه" /></label>
                    <div><button className="button button-primary" type="submit">حفظ البيانات</button><button className="text-button" type="button" onClick={() => setMetadataEditing(false)}>إلغاء</button></div>
                  </form>
                ) : (
                  <div className="reader-title-block">
                    <span className="eyebrow">{activeBook.sourceName} · {activeBook.pageNumberKind === 'source' ? `${toArabicDigits(activeBook.sourcePageCount)} صفحات مصدر` : `${toArabicDigits(activeBook.readerPageCount)} صفحات بترقيم داخلي`}</span>
                    <div className="reader-title-line"><h1>{activeBook.title}</h1><button className="metadata-edit" type="button" title="تعديل بيانات الكتاب المستخدمة في الاستشهاد" aria-label="تعديل بيانات الكتاب" onClick={() => { setMetadataDraft({ title: activeBook.title, author: activeBook.author ?? '', aliases: (activeBook.aliases ?? []).join('\n') }); setMetadataEditing(true); }}><Icon name="edit" width={15} height={15} /></button></div>
                    {activeBook.author && <p>{activeBook.author}</p>}
                  </div>
                )}
                <span className="format-pill">{/\.html?$/i.test(activeBook.sourceName) ? 'HTML' : /\.docx$/i.test(activeBook.sourceName) ? 'DOCX' : 'Markdown'}</span>
              </header>
              <div className="reader-controls" aria-label="أدوات القراءة">
                <button className="page-step" type="button" disabled={pageIndex <= 0} onClick={() => goToPage(pages[pageIndex - 1])} aria-label="الصفحة السابقة"><Icon name="chevronLeft" width={17} height={17} /></button>
                <span className="page-counter">{activeBook.pageNumberKind === 'source' ? 'ص' : 'موضع'} {toArabicDigits(currentPage)} <span>·</span> {toArabicDigits(pageIndex + 1)} / {toArabicDigits(pages.length)}</span>
                <button className="page-step" type="button" disabled={pageIndex >= pages.length - 1} onClick={() => goToPage(pages[pageIndex + 1])} aria-label="الصفحة التالية"><Icon name="chevronRight" width={17} height={17} /></button>
                <span className="control-divider" />
                <button className={`search-toggle ${searchOpen ? 'is-open' : ''}`} type="button" onClick={() => { const next = !searchOpen; setSearchOpen(next); if (next) window.setTimeout(() => searchInput.current?.focus(), 0); }} aria-label={searchOpen ? 'إغلاق البحث' : 'البحث في نص الكتاب'} title="البحث في نص الكتاب"><Icon name="search" width={16} height={16} /><span>بحث</span></button>
                <span className="control-divider" />
                <button className="font-control" type="button" onClick={() => setReaderFontSize((size) => Math.max(18, size - 1))} aria-label="تصغير خط القراءة">A−</button>
                <button className="font-control" type="button" onClick={() => setReaderFontSize((size) => Math.min(30, size + 1))} aria-label="تكبير خط القراءة">A+</button>
              </div>
              {activeBook.warnings.length > 0 && <div className="import-warning" role="status">{activeBook.warnings.join(' ')}</div>}
              {searchOpen && (
                <section className="book-search" aria-label="البحث في الكتاب">
                  <div className="search-input-row"><input ref={searchInput} type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="ابحث في نص الكتاب…" aria-label="عبارة البحث" /><button className="root-search-toggle" type="button" onClick={() => setRootSearchEnabled((enabled) => !enabled)} aria-pressed={rootSearchEnabled} title="البحث بالجذر تقريبي ويشمل بعض صيغ الكلمة">جذر</button><button type="button" onClick={() => setSearchQuery('')} disabled={!searchQuery}>مسح</button></div>
                  {(studyData.categories.length > 0 || studyData.highlights.some((highlight) => !highlight.categoryId)) && <label className="search-category-filter"><span>تصفية النتائج حسب التصنيف</span><select aria-label="تصفية نتائج البحث حسب تصنيف التظليل" value={searchCategoryId} onChange={(event) => setSearchCategoryId(event.target.value)}><option value="">نص الكتاب والعناوين</option>{studyData.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}{studyData.highlights.some((highlight) => !highlight.categoryId) && <option value={unassignedHighlightFilter}>تظليلات بلا تصنيف</option>}</select></label>}
                  {(searchQuery.trim() || searchCategoryId) && <div className="search-result-count">{searchResults.length ? `${toArabicDigits(searchResults.length)} ${searchCategoryId ? 'تظليل' : 'نتيجة'}${searchResults.length === 60 ? ' على الأقل' : ''}` : 'لا توجد نتائج مطابقة'}</div>}
                  {searchResults.length > 0 && <ul className="search-results">{searchResults.map((result) => <li key={`${result.kind}-${result.id}`}><button type="button" onClick={() => {
                    if (result.kind === 'heading') jumpToHeading(result.headingId!, result.page);
                    else {
                      selectPassage(result.passage!.id);
                      if (result.kind === 'highlight' && result.highlightId) window.setTimeout(() => document.querySelector<HTMLElement>(`[data-highlight-id="${CSS.escape(result.highlightId!)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 280);
                    }
                  }}><span>{result.kind === 'heading' ? 'عنوان' : result.kind === 'highlight' ? `تظليل · ${result.categoryName ?? 'بلا تصنيف'}` : 'مقطع'} · {activeBook.pageNumberKind === 'source' ? 'ص' : 'موضع'} {toArabicDigits(activeBook.pageNumberKind === 'source' ? (result.passage?.sourcePageNumber ?? result.page) : result.page)}</span><small>{quoteExcerpt(result.text, 125)}</small></button></li>)}</ul>}
                </section>
              )}
              <div className="reader-card" onPointerOver={onReaderPointerOver} onPointerUp={onReaderPointerUp} onMouseUp={onReaderMouseUp} onClick={onReaderClick} onPointerLeave={scheduleHidePassageActions}>
                <article className="book-content" style={{ '--reader-font-size': `${readerFontSize}px` } as React.CSSProperties} dangerouslySetInnerHTML={{ __html: activeBook.html }} />
              </div>
              {passageActions && (
                <div className={`passage-toolbar ${passageActions.layout}`} role="toolbar" aria-label="أدوات المقطع" aria-orientation={passageActions.layout === 'vertical' ? 'vertical' : 'horizontal'} style={{ top: passageActions.top, left: passageActions.left }} onPointerEnter={() => { if (hidePassageToolbarTimer.current !== undefined) window.clearTimeout(hidePassageToolbarTimer.current); hidePassageToolbarTimer.current = undefined; }} onPointerLeave={scheduleHidePassageActions}>
                  <button type="button" aria-label="نسخ المقطع مع الاستشهاد" title="نسخ المقطع مع الاستشهاد" onClick={() => void copy(passageCitation(activeBook, passageActions.passage, passageActions.passage.text, studyData.settings, passageActions.passage.footnoteIds), 'نُسخ المقطع مع بيانات الاستشهاد.')}><Icon name="citation" width={17} height={17} /></button>
                  <button type="button" aria-label="إضافة المقطع إلى الحافظة" title="إضافة المقطع إلى الحافظة" onClick={() => clipPassage(passageActions)}><Icon name="plus" width={18} height={18} /></button>
                  <button type="button" aria-label={studyData.favorites.some((item) => item.passageId === passageActions.passage.id) ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'} title={studyData.favorites.some((item) => item.passageId === passageActions.passage.id) ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'} className={studyData.favorites.some((item) => item.passageId === passageActions.passage.id) ? 'is-saved' : ''} onClick={() => togglePassageFavorite(passageActions)}><Icon name="bookmark" width={17} height={17} /></button>
                  <button type="button" aria-label="تعليق نصي على المقطع" title="تعليق نصي على المقطع" onClick={() => openPassageComment(passageActions)}><Icon name="comment" width={17} height={17} /></button>
                  <button type="button" aria-label={linkWorkspace.trayItems.some((item) => item.bookId === activeBook.id && item.passageId === passageActions.passage.id) ? 'إزالة من سلة الربط بين المقاطع' : 'إضافة إلى سلة الربط بين المقاطع'} title={linkWorkspace.trayItems.some((item) => item.bookId === activeBook.id && item.passageId === passageActions.passage.id) ? 'إزالة من سلة الربط بين المقاطع' : 'إضافة إلى سلة الربط بين المقاطع'} className={linkWorkspace.trayItems.some((item) => item.bookId === activeBook.id && item.passageId === passageActions.passage.id) ? 'is-saved' : ''} onClick={() => togglePassagePin(passageActions)}><Icon name="link" width={17} height={17} /></button>
                  <button type="button" aria-label="نسخ رابط موضعي لهذه المكتبة المحلية" title="نسخ رابط موضعي لهذه المكتبة المحلية" onClick={() => void copy(localPassageLink(activeBook, passageActions.passage), 'نُسخ رابط موضعي لهذه المكتبة المحلية.')}><Icon name="copy" width={17} height={17} /></button>
                </div>
              )}
              {selectionActions && (
                <div className="selection-toolbar" role="toolbar" aria-label="أدوات النص المحدد" style={{ top: selectionActions.top, left: selectionActions.left }} onPointerEnter={() => { if (hidePassageToolbarTimer.current !== undefined) window.clearTimeout(hidePassageToolbarTimer.current); hidePassageToolbarTimer.current = undefined; }}>
                  <select aria-label="تصنيف التظليل" value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.currentTarget.value)} title="تلقائي: يستخدم التصنيف المرتبط بلون التظليل. بلا تصنيف: يتجاوز هذا الربط.">
                    <option value="">تلقائي: تصنيف اللون</option>
                    <option value="none">بلا تصنيف: تخطّي الربط</option>
                    {studyData.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                  <span className="toolbar-divider" aria-hidden="true" />
                  {highlightColors.map((color) => <button key={color} className={`highlight-swatch swatch-${color}`} type="button" aria-label={`تظليل ${highlightLabels[color]}`} title={`تظليل ${highlightLabels[color]}`} onClick={() => highlightPassage(color, selectionActions)} />)}
                  <span className="toolbar-divider" aria-hidden="true" />
                  <button type="button" aria-label="إزالة التظليل عن النص المحدد" title="إزالة التظليل عن النص المحدد" onClick={() => erasePassageHighlight(selectionActions)}><Icon name="eraser" width={17} height={17} /></button>
                  <button type="button" aria-label="التعليق على النص المحدد" title="التعليق على النص المحدد" onClick={() => openPassageComment(selectionActions)}><Icon name="comment" width={17} height={17} /></button>
                  <button type="button" aria-label="نسخ النص المحدد مع الاستشهاد" title="نسخ النص المحدد مع الاستشهاد" onClick={() => { const quote = selectedQuoteForClipboard(selectionActions.quote, studyData.settings.keepFootnotes, selectionRange.current); void copy(passageCitation(activeBook, selectionActions.passage, quote, studyData.settings), 'نُسخ النص المحدد مع الاستشهاد.'); }}><Icon name="citation" width={17} height={17} /></button>
                  <button type="button" aria-label="إضافة النص المحدد إلى الحافظة" title="إضافة النص المحدد إلى الحافظة" onClick={() => clipPassage(selectionActions)}><Icon name="collection" width={17} height={17} /></button>
                  <button type="button" aria-label="البحث عن النص المحدد في الكتاب" title="البحث عن النص المحدد في الكتاب" onClick={() => { setSearchQuery(selectionActions.quote); setSearchOpen(true); }}><Icon name="search" width={17} height={17} /></button>
                  <button type="button" aria-label="البحث عن النص في تراث" title="البحث عن النص في تراث" onClick={() => openTurathSearch(selectionActions.quote)}><Icon name="book" width={17} height={17} /></button>
                  <button type="button" aria-label="البحث عن النص في السنة" title="البحث عن النص في السنة" onClick={() => window.open(`https://sunnah.one/?s=${encodeURIComponent(selectionActions.quote)}`, '_blank', 'noopener,noreferrer')}><Icon name="hadith" width={17} height={17} /></button>
                  <button type="button" aria-label="طي الفقرة المحددة" title="طي الفقرة المحددة" onClick={foldSelectedPassage}><Icon name="fold" width={17} height={17} /></button>
                </div>
              )}
            </>
          ) : (
            <section className="welcome-card">
              <span className="eyebrow">قارئ عربي</span>
              <h1>كتابك، بصفحاته وعناوينه كما ينبغي أن تُقرأ.</h1>
              <p>استورد Markdown أو HTML أو DOCX، أو افتح العينة لتجربة الصفحات، الفهرس، الحواشي، ونسخ المقتطفات باستشهاداتها.</p>
              <button className="button button-primary" type="button" onClick={() => void loadDemo()} disabled={isBusy}>{isBusy ? 'جارٍ التحميل…' : 'افتح عينة القراءة'}</button>
              <div className="welcome-details"><span>صفحات مصدر</span><span>فهرس وعناوين</span><span>نسخ مع الاستشهاد</span></div>
            </section>
          )}
        </main>
      </div>}
      {activeBook && activeView === 'reader' && <>
        <button className="study-fab" type="button" aria-label={studyDrawerOpen ? 'إغلاق لوحة المذاكرة' : 'فتح لوحة المذاكرة'} title="لوحة المذاكرة" aria-expanded={studyDrawerOpen} onClick={() => { if (!studyPanel) setStudyPanel('collection'); setStudyDrawerOpen((open) => !open); }}><Icon name="collection" width={22} height={22} /><span>{toArabicDigits(studyData.clips.length)}</span></button>
        {studyDrawerOpen && <>
          <aside className="study-drawer" aria-label="لوحة المذاكرة">
            <header className="study-drawer-header"><div><span className="eyebrow">مقاطع هذا الكتاب</span><h2>لوحة المذاكرة</h2></div><button className="icon-button" type="button" aria-label="إغلاق لوحة المذاكرة" onClick={() => setStudyDrawerOpen(false)}><Icon name="close" width={17} height={17} /></button></header>
            <nav className="study-drawer-tabs" aria-label="أقسام لوحة المذاكرة">
              {([
                ['collection', 'الحافظة', studyData.clips.length, 'collection'],
                ['favorites', 'المفضلة', studyData.favorites.length, 'bookmark'],
                ['notebook', 'الدفتر', notebookEntries.length, 'notebook'],
                ['pinned', 'مواضع سريعة', studyData.pinnedPassageIds.length, 'pin'],
                ['links', 'الإحالات', studyData.links.length + linkWorkspace.trayItems.length + linkWorkspace.groups.length, 'link'],
                ['categories', 'التصنيفات', studyData.categories.length, 'tag'],
              ] as const).map(([tab, label, count, icon]) => (
                <button key={tab} type="button" aria-pressed={studyPanel === tab} className={studyPanel === tab ? 'is-active' : ''} onClick={() => setStudyPanel(tab)}><Icon name={icon} width={16} height={16} /><span>{label}</span>{count !== undefined && <small>{toArabicDigits(count)}</small>}</button>
              ))}
            </nav>
            <div className="study-drawer-content">
              {studyPanel === 'favorites' && <section className="study-panel-body">
                <div className="study-panel-title"><h3>المقاطع المفضلة</h3><div className="study-collection-tools"><button className="text-button" type="button" onClick={copyStudyFavorites} disabled={!visibleFavorites.length}><Icon name="copy" width={14} height={14} /> نسخ الظاهر مع الاستشهاد</button><button className="text-button" type="button" onClick={downloadStudyFavoritesDocx} disabled={!visibleFavorites.length}>Word (الظاهر)</button></div></div>
                <div className="favorite-manager-toolbar">
                  <label>الترتيب <select aria-label="ترتيب المفضلة" value={favoriteSort} onChange={(event) => setFavoriteSort(event.target.value as FavoriteSort)}><option value="page">حسب ترتيب الكتاب</option><option value="date">الأحدث إضافة</option></select></label>
                </div>
                <div className="favorite-filter-list" role="group" aria-label="تصفية المفضلة حسب الوسم">
                  <button type="button" aria-pressed={!favoriteFilter} className={!favoriteFilter ? 'is-active' : ''} onClick={() => setFavoriteFilter('')}>الكل</button>
                  {studyData.tags.map((tag) => <button type="button" key={tag} aria-pressed={favoriteFilter === tag} className={favoriteFilter === tag ? 'is-active' : ''} onClick={() => setFavoriteFilter(favoriteFilter === tag ? '' : tag)}>{tag}</button>)}
                </div>
                {visibleFavorites.length ? <ul className="study-item-list">{visibleFavorites.map((item) => {
                  const passage = activeBook.passages.find((entry) => entry.id === item.passageId);
                  if (!passage) return null;
                  return <li className={`study-favorite-item ${studyPassageId === item.passageId ? 'is-source-selected' : ''}`} data-study-passage-id={item.passageId} key={item.passageId}>
                    <div className="study-favorite-head"><button type="button" onClick={() => selectPassage(passage.id)}><span>{item.label ? `${item.label}: ` : ''}{quoteExcerpt(passage.text, 120)}</span><small>{activeBook.pageNumberKind === 'source' ? 'ص' : 'موضع'} {toArabicDigits(activeBook.pageNumberKind === 'source' ? passage.sourcePageNumber ?? passage.readerPageNumber : passage.readerPageNumber)}</small></button><button className="study-remove" type="button" aria-label="تعديل اسم المفضلة" title="تعديل الاسم" onClick={() => { setFavoriteEditId(passage.id); setFavoriteLabelDraft(item.label ?? ''); }}><Icon name="edit" width={15} height={15} /></button></div>
                    <textarea className="study-favorite-note" defaultValue={item.note ?? ''} placeholder="تعليقك على هذه الفقرة…" aria-label={`تعليق على المقطع المفضل: ${quoteExcerpt(passage.text, 60)}`} onBlur={(event) => { const note = event.currentTarget.value; void saveStudy((study) => updateFavoriteDetails(study, passage.id, { note: note || undefined }), 'حُفظ تعليق المفضلة.'); }} />
                    {studyData.tags.length > 0 && <div className="study-favorite-tags" aria-label="وسوم المفضلة">{studyData.tags.map((tag) => <button type="button" key={tag} aria-pressed={(item.tags ?? []).includes(tag)} className={(item.tags ?? []).includes(tag) ? 'is-active' : ''} onClick={() => void saveStudy((study) => toggleFavoriteTag(study, passage.id, tag), 'حُدّثت وسوم المقطع.')}>{tag}</button>)}</div>}
                    {favoriteTagEditId === passage.id
                      ? <form className="study-favorite-editor study-favorite-tag-editor" onSubmit={(event) => addFavoriteTag(event, passage.id)}><input autoFocus value={favoriteTagDraft} onChange={(event) => setFavoriteTagDraft(event.target.value)} placeholder="اسم الوسم" aria-label="اسم الوسم الجديد" /><div><button className="button button-primary" type="submit">إضافة</button><button className="text-button" type="button" onClick={() => { setFavoriteTagEditId(undefined); setFavoriteTagDraft(''); }}>إلغاء</button></div></form>
                      : <button className="favorite-add-tag" type="button" onClick={() => { setFavoriteTagEditId(passage.id); setFavoriteTagDraft(''); }}><Icon name="plus" width={12} height={12} /> وسم جديد</button>}
                    <div className="study-favorite-actions">
                      <button className="text-button" type="button" onClick={() => void copy(passageCitation(activeBook, passage, passage.text, studyData.settings, passage.footnoteIds), 'نُسخ المقطع مع الاستشهاد.')}><Icon name="copy" width={14} height={14} /> نسخ</button>
                      <button className="text-button" type="button" onClick={() => void saveStudy((study) => addClip(study, { id: crypto.randomUUID(), passageId: passage.id, quote: passage.text, footnoteIds: [...(passage.footnoteIds ?? [])], createdAt: new Date().toISOString() }), 'أُضيف المقطع إلى الحافظة.')}><Icon name="collection" width={14} height={14} /> إلى الحافظة</button>
                      <button className="study-remove" type="button" onClick={() => void saveStudy((study) => toggleFavorite(study, passage.id), 'أُزيل المقطع من المفضلة.')}>إزالة</button>
                    </div>
                    {favoriteEditId === passage.id && <form className="study-favorite-editor" onSubmit={(event) => { event.preventDefault(); saveFavoriteDetails(passage.id); }}><input value={favoriteLabelDraft} onChange={(event) => setFavoriteLabelDraft(event.target.value)} placeholder="اسم اختياري" aria-label="اسم المقطع المفضل" /><div><button className="button button-primary" type="submit">حفظ الاسم</button><button className="text-button" type="button" onClick={() => setFavoriteEditId(undefined)}>إلغاء</button></div></form>}
                  </li>;
                })}</ul> : <p className="study-empty">{studyData.favorites.length ? 'لا توجد مقاطع مفضلة بهذا الوسم.' : 'أضف المقاطع المهمة إلى المفضلة من شريط أدوات المقطع.'}</p>}
              </section>}
              {studyPanel === 'collection' && <section className="study-panel-body"><div className="study-panel-title"><h3>حافظة الاقتباسات</h3><div className="study-collection-tools"><span className="study-selection-count">{toArabicDigits(selectedStudyClips().length)} محدد</span><button className="text-button" type="button" onClick={() => setSelectedClipIds(studyData.clips.map((clip) => clip.id))} disabled={!studyData.clips.length}>تحديد الكل</button><button className="text-button" type="button" onClick={() => setSelectedClipIds([])} disabled={!selectedStudyClips().length}>إلغاء التحديد</button><button className="text-button" type="button" onClick={() => copyStudyCollection(selectedStudyClips())} disabled={!selectedStudyClips().length}><Icon name="copy" width={13} height={13} /> نسخ المحدد</button><button className="text-button" type="button" onClick={() => downloadStudyCollectionTxt(selectedStudyClips())} disabled={!selectedStudyClips().length}>TXT</button><button className="text-button" type="button" onClick={() => void downloadStudyCollectionDocx(selectedStudyClips())} disabled={!selectedStudyClips().length}>Word</button><button className="text-button study-clear-trigger" type="button" onClick={() => setConfirmClipClear(true)} disabled={!studyData.clips.length}><Icon name="trash" width={13} height={13} /> تفريغ</button></div></div>
                {confirmClipClear && studyData.clips.length > 0 && <div className="study-clear-confirm" role="group" aria-label="تأكيد تفريغ حافظة الاقتباسات"><span>تفريغ الحافظة كلها؟</span><button className="study-remove" type="button" onClick={() => void clearStudyCollection()}>تفريغ</button><button className="text-button" type="button" onClick={() => setConfirmClipClear(false)}>إلغاء</button></div>}
                {studyData.clips.length ? <ul className="study-item-list">{studyData.clips.map((item) => {
                  const passage = activeBook.passages.find((entry) => entry.id === item.passageId);
                  return <li className={`${draggedClipId === item.id ? 'is-dragging ' : ''}${studyPassageId === item.passageId ? 'is-source-selected' : ''}`} data-study-passage-id={item.passageId} key={item.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const fromId = event.dataTransfer.getData('text/plain') || draggedClipId; if (fromId) moveClip(fromId, item.id); }}>
                    <input className="study-clip-select" type="checkbox" aria-label={`تحديد الاقتباس: ${quoteExcerpt(item.quote, 70)}`} checked={selectedClipIds.includes(item.id)} onChange={() => toggleClipSelection(item.id)} />
                    {clipEditId === item.id
                      ? <div className="study-clip-editor"><textarea autoFocus value={clipQuoteDraft} aria-label="تعديل نص الاقتباس" onChange={(event) => setClipQuoteDraft(event.currentTarget.value)} /><div><button className="button button-primary" type="button" onClick={() => void saveClipQuote(item.id)}>حفظ</button><button className="text-button" type="button" onClick={() => { setClipEditId(undefined); setClipQuoteDraft(''); }}>إلغاء</button></div></div>
                      : <button className="study-clip-quote" type="button" onClick={() => passage && selectPassage(passage.id)}><span>{quoteExcerpt(item.quote, 120)}</span><small>{passage ? `${activeBook.pageNumberKind === 'source' ? 'ص' : 'موضع'} ${toArabicDigits(activeBook.pageNumberKind === 'source' ? passage.sourcePageNumber ?? passage.readerPageNumber : passage.readerPageNumber)}` : 'موضع غير متاح'}</small></button>}
                    <span className="study-drag-handle" draggable title="اسحب لإعادة ترتيب الاقتباس" role="button" tabIndex={0} aria-label="إعادة ترتيب الاقتباس بالسحب أو بمفتاحي السهمين" onDragStart={(event) => { setDraggedClipId(item.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id); }} onDragEnd={() => setDraggedClipId(undefined)} onKeyDown={(event) => { if (event.key === 'ArrowUp') { event.preventDefault(); moveClipByKeyboard(item.id, -1); } if (event.key === 'ArrowDown') { event.preventDefault(); moveClipByKeyboard(item.id, 1); } }}><Icon name="grip" width={17} height={17} /></span>
                    <div className="study-clip-actions">{clipEditId !== item.id && <><button className="study-icon-action" type="button" aria-label="نسخ الاقتباس مع الاستشهاد" title="نسخ الاقتباس مع الاستشهاد" onClick={() => copyStudyClip(item)}><Icon name="copy" width={15} height={15} /></button><button className="study-icon-action" type="button" aria-label="البحث عن الاقتباس في تراث" title="البحث عن الاقتباس في تراث" onClick={() => openTurathSearch(item.quote)}><Icon name="book" width={15} height={15} /></button><button className="study-icon-action" type="button" aria-label="تعديل الاقتباس" title="تعديل الاقتباس" onClick={() => { setClipEditId(item.id); setClipQuoteDraft(item.quote); }}><Icon name="edit" width={15} height={15} /></button></>}
                      <button className="study-remove" type="button" aria-label="إزالة الاقتباس من الحافظة" onClick={() => { setSelectedClipIds((current) => current.filter((id) => id !== item.id)); void saveStudy((study) => removeClip(study, item.id), 'أُزيل الاقتباس من الحافظة.'); }}>إزالة</button></div>
                  </li>;
                })}</ul> : <p className="study-empty">أضف اقتباسات من شريط أدوات المقطع، ثم انسخها مجتمعة.</p>}
              </section>}
              {studyPanel === 'notebook' && <section className="study-panel-body">
                <div className="study-panel-title"><h3>دفتر المذاكرة</h3><div className="study-collection-tools"><button className="text-button" type="button" onClick={copyStudyNotebook} disabled={!notebookEntries.length}><Icon name="copy" width={14} height={14} /> نسخ الكل</button><button className="text-button" type="button" onClick={downloadStudyNotebookDocx} disabled={!studyData.notebook.length && !studyData.comments.length && !studyData.favorites.length && !studyData.clips.length && !studyData.highlights.some((highlight) => highlight.categoryId && studyData.categories.some((category) => category.id === highlight.categoryId))}>Word (كامل)</button><button className="text-button" type="button" onClick={() => notebookWordInput.current?.click()} disabled={isImportingNotebookWord}>{isImportingNotebookWord ? 'جارٍ الاستيراد…' : 'استيراد تعديلات Word'}</button><input ref={notebookWordInput} className="visually-hidden" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => void importNotebookWord(event.currentTarget.files?.[0])} /></div></div>
                <p className="study-context">صدّر دفتر Word، عدّل النص بعد «تعليق:»، ثم استورد الملف لتحديث التعليقات والملاحظات المرتبطة بعلاماتها.</p>
                <label className="favorite-manager-toolbar">الترتيب <select aria-label="ترتيب دفتر المذاكرة" value={studyData.settings.notebookOrder} onChange={(event) => updateStudySettings({ notebookOrder: event.target.value as StudyData['settings']['notebookOrder'] })}><option value="date">بترتيب الإضافة</option><option value="page">بترتيب الكتاب</option></select></label>
                {activeNotebookKind === 'note' && activeNotebookEntry && <div className="study-notebook-editor"><p className="study-context">{quoteExcerpt(activeNotebookContextQuote ?? '', 180)}</p><RichNoteEditor key={`note:${activeNotebookId}`} resetKey={activeNotebookId ?? ''} value={notebookDraft} htmlValue={notebookHtmlDraft} label="ملاحظة دفتر المذاكرة" placeholder="أضف ملاحظة لهذا المقتطف…" onChange={(text, html) => { setNotebookDraft(text); setNotebookHtmlDraft(html); }} /><button className="button button-primary full-width" type="button" onClick={saveNotebookEntry}>حفظ الملاحظة</button></div>}
                {!activeNotebookEntry && <p className="study-empty">تظهر هنا التعليقات المرتبطة بمقاطع الكتاب. أضف تعليقاً من زر «تعليق» في أدوات المقطع أو النص المحدد.</p>}
                {notebookEntries.length > 0 && <ul className="study-item-list">{notebookEntries.map((entry) => {
                  const passage = activeBook.passages.find((item) => item.id === entry.passageId);
                  return <li className={studyPassageId === entry.passageId ? 'is-source-selected' : ''} data-study-passage-id={entry.passageId} key={`${entry.kind}-${entry.id}`}>
                    <button type="button" onClick={() => openNotebookStudyEntry(entry)}><span>{quoteExcerpt(entry.quote, 100)}</span><small>{entry.kind === 'comment' ? 'تعليق' : entry.text ? 'مقتطف مع ملاحظة' : 'مقتطف محفوظ'}{passage ? ` · ${activeBook.pageNumberKind === 'source' ? 'ص' : 'موضع'} ${toArabicDigits(activeBook.pageNumberKind === 'source' ? passage.sourcePageNumber ?? passage.readerPageNumber : passage.readerPageNumber)}` : ''}</small></button>
                    <button className="study-remove" type="button" aria-label={entry.kind === 'comment' ? 'حذف التعليق من الدفتر' : 'حذف المقتطف من الدفتر'} onClick={() => {
                      if (entry.kind === 'comment') {
                        void saveStudy((study) => removeStudyComment(study, entry.id, entry.passageId), 'حُذف التعليق من الدفتر.');
                        if (activeNotebookKind === 'comment' && studyPassageId === entry.passageId) { setActiveNotebookKind(undefined); setCommentDraft(''); setCommentHtmlDraft(undefined); }
                      } else {
                        void saveStudy((study) => removeNotebookEntry(study, entry.id), 'حُذف المقتطف من الدفتر.');
                        if (activeNotebookId === entry.id) { setActiveNotebookId(undefined); setActiveNotebookKind(undefined); setNotebookDraft(''); setNotebookHtmlDraft(undefined); }
                      }
                    }}>إزالة</button>
                  </li>;
                })}</ul>}
              </section>}
              {studyPanel === 'pinned' && <section className="study-panel-body"><h3>مواضع سريعة محفوظة</h3>
                {studyData.pinnedPassageIds.length ? <ul className="study-item-list">{studyData.pinnedPassageIds.map((id) => {
                  const passage = activeBook.passages.find((entry) => entry.id === id);
                  if (!passage) return null;
                  return <li key={id}><button type="button" onClick={() => selectPassage(id)}><span>{quoteExcerpt(passage.text, 120)}</span><small>{activeBook.pageNumberKind === 'source' ? 'ص' : 'موضع'} {toArabicDigits(activeBook.pageNumberKind === 'source' ? passage.sourcePageNumber ?? passage.readerPageNumber : passage.readerPageNumber)}</small></button><button className="study-remove" type="button" aria-label="إلغاء تثبيت المقطع" onClick={() => void saveStudy((study) => ({ ...study, pinnedPassageIds: study.pinnedPassageIds.filter((item) => item !== id) }), 'أُزيل المقطع من لوحة الإحالات.')}>إزالة</button></li>;
                })}</ul> : <p className="study-empty">لا توجد مواضع سريعة محفوظة. استخدم 📌 لبدء مجموعة إحالات بين المقاطع.</p>}
              </section>}
              {studyPanel === 'links' && <section className="study-panel-body">
                <div className="study-panel-title"><h3>سلة الربط بين الكتب</h3><button className="text-button" type="button" onClick={() => { updateLinkWorkspace((workspace) => ({ ...workspace, trayItems: [] }), 'فُرِّغت سلة الربط.'); setSelectedLinkTrayIds([]); }} disabled={!linkWorkspace.trayItems.length}>إفراغ السلة</button></div>
                <p className="study-empty">أضف مواضع من كتب مختلفة من أداة 📌، ثم اختر اثنين أو أكثر لإنشاء مجموعة إحالات.</p>
                {linkWorkspace.trayItems.length ? <ul className="study-item-list study-link-tray-list">{linkWorkspace.trayItems.map((item) => <li key={item.id}>
                  <input type="checkbox" aria-label={`اختيار موضع ${item.bookTitle}`} checked={selectedLinkTrayIds.includes(item.id)} onChange={() => toggleLinkTraySelection(item.id)} />
                  <button type="button" onClick={() => navigateToLinkedPassage(item.bookId, item.passageId)}><span>{quoteExcerpt(item.quote, 100)}</span><small>{item.bookTitle} · {item.pageNumberKind === 'source' ? 'ص' : 'موضع'} {toArabicDigits(item.pageNumber)}</small></button>
                  <button className="study-remove" type="button" aria-label="إزالة من سلة الربط" onClick={() => { updateLinkWorkspace((workspace) => removePassageLinkTrayItem(workspace, item.id), 'أُزيل الموضع من سلة الربط.'); setSelectedLinkTrayIds((current) => current.filter((id) => id !== item.id)); }}>إزالة</button>
                </li>)}</ul> : <p className="study-empty">سلة الربط فارغة. افتح أداة 📌 على أي مقطع لإضافته.</p>}
                <div className="study-link-create"><input value={linkGroupNameDraft} onChange={(event) => setLinkGroupNameDraft(event.target.value)} placeholder="اسم اختياري للمجموعة" aria-label="اسم مجموعة الإحالات" /><button className="button button-primary" type="button" onClick={createLinkGroupFromSelection} disabled={selectedLinkTrayIds.length < 2}>ربط المحدد</button></div>
                {linkWorkspace.groups.length > 0 && <><h3 className="study-subheading">مجموعات الإحالات</h3><div className="study-link-groups">{linkWorkspace.groups.map((group) => <section className="study-link-group-card" key={group.id}>
                  <header><input aria-label="اسم مجموعة الإحالات" defaultValue={group.name} placeholder="اسم اختياري للمجموعة" onBlur={(event) => { const name = event.currentTarget.value.trim(); if (name && name !== group.name) updateLinkWorkspace((workspace) => renamePassageLinkGroup(workspace, group.id, name), 'حُفظ اسم مجموعة الإحالات.'); else if (!name) event.currentTarget.value = group.name; }} /><button className="study-remove" type="button" aria-label="حذف مجموعة الإحالات" onClick={() => setConfirmLinkGroupId(group.id)}>حذف المجموعة</button></header>
                  {confirmLinkGroupId === group.id && <div className="study-clear-confirm" role="group" aria-label="تأكيد حذف مجموعة الإحالات"><span>حذف الإحالة من كل المواضع؟</span><button className="study-remove" type="button" onClick={() => { updateLinkWorkspace((workspace) => removePassageLinkGroup(workspace, group.id), 'حُذفت مجموعة الإحالات.'); setConfirmLinkGroupId(undefined); }}>حذف</button><button className="text-button" type="button" onClick={() => setConfirmLinkGroupId(undefined)}>إلغاء</button></div>}
                  <ul className="study-item-list">{group.members.map((member) => <li key={`${member.bookId}-${member.passageId}`}><button type="button" onClick={() => navigateToLinkedPassage(member.bookId, member.passageId)}><span>{quoteExcerpt(member.quote, 90)}</span><small>{member.bookTitle} · {member.pageNumberKind === 'source' ? 'ص' : 'موضع'} {toArabicDigits(member.pageNumber)}</small></button><button className="study-remove" type="button" aria-label={`إزالة موضع من ${group.name || 'مجموعة الإحالات'}`} onClick={() => setPendingLinkMemberRemoval({ groupId: group.id, bookId: member.bookId, passageId: member.passageId })}>إزالة</button>
                    {pendingLinkMemberRemoval?.groupId === group.id && pendingLinkMemberRemoval.bookId === member.bookId && pendingLinkMemberRemoval.passageId === member.passageId && <div className="study-clear-confirm" role="group" aria-label="تأكيد إزالة موضع من الإحالة"><span>إزالة هذا الموضع؟</span><button className="study-remove" type="button" onClick={() => { updateLinkWorkspace((workspace) => removePassageLinkGroupMember(workspace, group.id, member.bookId, member.passageId), 'حُدّثت مجموعة الإحالات.'); setPendingLinkMemberRemoval(undefined); }}>إزالة</button><button className="text-button" type="button" onClick={() => setPendingLinkMemberRemoval(undefined)}>إلغاء</button></div>}
                  </li>)}</ul>
                  {selectedLinkTrayIds.length > 0 && <button className="text-button" type="button" onClick={() => addSelectedTrayItemsToGroup(group.id)}>إضافة المحدد من السلة إلى هذه المجموعة</button>}
                </section>)}</div></>}
                <h3 className="study-subheading">إحالات هذا الكتاب</h3>
                {studyData.links.length ? <ul className="study-item-list">{studyData.links.map((link) => {
                  const from = activeBook.passages.find((entry) => entry.id === link.fromPassageId);
                  const to = activeBook.passages.find((entry) => entry.id === link.toPassageId);
                  if (!from || !to) return null;
                  return <li key={link.id}><button type="button" onClick={() => selectPassage(from.id)}><span>{quoteExcerpt(from.text, 70)}</span><small>الموضع الأول</small></button><button type="button" aria-label="الانتقال إلى المقطع المرتبط" title="الانتقال إلى المقطع المرتبط" onClick={() => selectPassage(to.id)}><Icon name="link" width={16} height={16} /></button><button className="study-remove" type="button" aria-label="حذف الإحالة" onClick={() => void saveStudy((study) => removePassageLink(study, link.id), 'حُذفت الإحالة.')}>إزالة</button></li>;
                })}</ul> : <p className="study-empty">من شريط المقطع اختر أيقونة الإحالة، ثم اختر المقطع المرتبط داخل الكتاب.</p>}
              </section>}
              {studyPanel === 'categories' && <section className="study-panel-body"><div className="study-panel-title"><h3>تصنيفات التظليل</h3><button className="text-button" type="button" onClick={() => downloadStudyCategoryDocx()} disabled={!studyData.highlights.some((highlight) => highlight.categoryId && studyData.categories.some((category) => category.id === highlight.categoryId))}>Word (الكل)</button></div><form className="study-category-form" onSubmit={addStudyCategory}><input value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} placeholder="اسم تصنيف جديد" aria-label="اسم تصنيف جديد" /><button className="icon-button" type="submit" aria-label="إضافة التصنيف"><Icon name="plus" width={17} height={17} /></button></form>
                {studyData.categories.length > 0 && <input className="study-category-search" type="search" value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} placeholder="ابحث في التصنيفات والتظليلات…" aria-label="ابحث في التصنيفات والتظليلات" />}
                {studyData.categories.length ? <div className="study-category-groups">{visibleCategoryGroups.map(({ category, highlights }) => <section className="study-category-group" key={category.id}>
                  <header className="study-category-group-header"><span className={`highlight-swatch ${category.highlightColor ? `swatch-${category.highlightColor}` : 'swatch-unlinked'}`} aria-hidden="true" /><input aria-label={`اسم التصنيف ${category.name}`} defaultValue={category.name} onBlur={(event) => { if (event.currentTarget.value.trim()) updateStudyCategory(category.id, event.currentTarget.value); else event.currentTarget.value = category.name; }} /><label className="study-category-color-label">لون تلقائي<select className="study-category-color-select" aria-label={`لون التظليل المرتبط بتصنيف ${category.name}`} value={category.highlightColor ?? ''} onChange={(event) => updateStudyCategoryColor(category.id, event.currentTarget.value)}><option value="">لا ربط</option>{highlightColors.map((color) => <option key={color} value={color}>{highlightLabels[color]}</option>)}</select></label><span className="study-category-count" aria-label={`${highlights.length} تظليل`}>{toArabicDigits(highlights.length)}</span><button className="study-remove" type="button" aria-label={`حذف التصنيف ${category.name}`} onClick={() => removeStudyCategory(category.id)}>حذف</button></header>
                  {highlights.length > 0 && <div className="study-category-export"><button className="text-button" type="button" onClick={() => downloadStudyCategoryDocx(category.id)}>تصدير هذا التصنيف Word</button></div>}
                  {highlights.length ? <ul className="study-category-highlights">{highlights.map((highlight) => {
                    const passage = activeBook.passages.find((entry) => entry.id === highlight.passageId);
                    if (!passage) return null;
                    const page = activeBook.pageNumberKind === 'source' ? passage.sourcePageNumber ?? passage.readerPageNumber : passage.readerPageNumber;
                    const note = studyData.comments.find((comment) => comment.passageId === highlight.passageId && comment.start === highlight.start && comment.end === highlight.end)?.text;
                    return <li className={studyPassageId === highlight.passageId ? 'is-source-selected' : ''} data-study-passage-id={highlight.passageId} key={highlight.id}><button type="button" onClick={() => selectPassage(passage.id)}><span><mark className={`study-highlight color-${highlight.color}`}>{quoteExcerpt(highlight.quote, 130)}</mark>{note && <small>{quoteExcerpt(note, 90)}</small>}</span><small>{activeBook.pageNumberKind === 'source' ? 'ص' : 'موضع'} {toArabicDigits(page)}</small></button></li>;
                  })}</ul> : <p className="study-empty">{normalizedCategoryQuery ? 'لا توجد تظليلات مطابقة لهذا البحث.' : 'لا تظليلات في هذا التصنيف بعد.'}</p>}
                </section>)}</div> : <p className="study-empty">أنشئ تصنيفاتك الخاصة. اربط تصنيفاً بلون لتُسند إليه التظليلات الجديدة تلقائياً، أو اختر تصنيفاً يدوياً من شريط التحديد.</p>}
                {uncategorizedHighlightCount > 0 && <section className="study-uncategorized-highlights"><h3 className="study-subheading">تظليلات بلا تصنيف</h3><ul className="study-category-highlights">{studyData.highlights.filter((highlight) => !highlight.categoryId).map((highlight) => {
                  const passage = activeBook.passages.find((entry) => entry.id === highlight.passageId);
                  if (!passage) return null;
                  const page = activeBook.pageNumberKind === 'source' ? passage.sourcePageNumber ?? passage.readerPageNumber : passage.readerPageNumber;
                  return <li className={studyPassageId === highlight.passageId ? 'is-source-selected' : ''} data-study-passage-id={highlight.passageId} key={highlight.id}><button type="button" onClick={() => selectPassage(passage.id)}><span><mark className={`study-highlight color-${highlight.color}`}>{quoteExcerpt(highlight.quote, 130)}</mark></span><small>{activeBook.pageNumberKind === 'source' ? 'ص' : 'موضع'} {toArabicDigits(page)}</small></button></li>;
                })}</ul></section>}
                <h3 className="study-subheading">وسوم المفضلة</h3><form className="study-category-form" onSubmit={addCustomTag}><input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder="وسم جديد للمفضلة" aria-label="وسم جديد للمفضلة" /><button className="icon-button" type="submit" aria-label="إضافة الوسم"><Icon name="plus" width={17} height={17} /></button></form>
                {studyData.tags.length ? <ul className="study-category-list">{studyData.tags.map((tag) => <li key={tag}><Icon name="tag" width={16} height={16} /><span className="study-tag-name">{tag}</span><button className="study-remove" type="button" aria-label={`حذف الوسم ${tag}`} onClick={() => void saveStudy((study) => removeStudyTag(study, tag), 'حُذف الوسم من المفضلة.')}>حذف</button></li>)}</ul> : <p className="study-empty">أنشئ وسوماً خاصة بك، ثم عيّنها للمقاطع من تبويب المفضلة.</p>}
              </section>}
            </div>
          </aside>
        </>}
      </>}
      {turathOpen && <TurathSearchPanel key={turathRequestId} initialQuery={turathInitialQuery} onClose={() => setTurathOpen(false)} />}
      <footer className="app-footer"><span>قارئ البحث · نسخة قيد التطوير</span><span>مرّر المؤشر على فقرة، أو حدّد نصاً، لإظهار أدوات القراءة والمقطع</span></footer>
    </div>
  );
}
