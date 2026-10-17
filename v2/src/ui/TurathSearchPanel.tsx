import { useEffect, useRef, useState, type FormEvent } from 'react';

type TurathSearchMode = 'text' | 'smart';
type TurathResult = {
  bookId: string;
  bookTitle: string;
  authorName: string;
  volume: string;
  page: string;
  pageId: string;
  snippet: string;
};

function stripSearchText(value: string) {
  return value.replace(/[ؐ-ًؚ-ٰٟـ]/g, '').replace(/[«»"“”()[\]{}﴿﴾]/g, ' ').replace(/\s+/g, ' ').trim();
}

function makeSearchQuery(value: string, mode: TurathSearchMode) {
  const clean = stripSearchText(value);
  return mode === 'text' ? `"${clean}"` : clean.split(' ').filter((word) => word.length > 1).slice(0, 12).join(' ');
}

function decodeSnippet(value: string) {
  const decoder = document.createElement('textarea');
  decoder.innerHTML = value;
  return decoder.value;
}

function snippetContent(value: string) {
  const parts = decodeSnippet(value).split(/(<\/?em>)/gi);
  let emphasized = false;
  return parts.map((part, index) => {
    if (part.toLowerCase() === '<em>') { emphasized = true; return null; }
    if (part.toLowerCase() === '</em>') { emphasized = false; return null; }
    return emphasized ? <em key={index}>{part}</em> : part;
  });
}

function parseResult(raw: unknown): TurathResult | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const result = raw as Record<string, unknown>;
  let meta = result.meta;
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta) as unknown; } catch { meta = {}; }
  }
  const details = meta && typeof meta === 'object' ? meta as Record<string, unknown> : {};
  const bookId = String(result.book_id ?? '');
  if (!bookId) return undefined;
  return {
    bookId,
    bookTitle: String(details.book_name ?? `كتاب ${bookId}`),
    authorName: String(details.author_name ?? ''),
    volume: String(details.vol ?? ''),
    page: String(details.page ?? ''),
    pageId: String(details.page_id ?? ''),
    snippet: String(result.snip ?? ''),
  };
}

export function TurathSearchPanel({ initialQuery, onClose }: { initialQuery: string; onClose: () => void }) {
  const [query, setQuery] = useState(initialQuery.slice(0, 300));
  const [mode, setMode] = useState<TurathSearchMode>('text');
  const [results, setResults] = useState<TurathResult[]>([]);
  const [resultCount, setResultCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchInput = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<AbortController | undefined>(undefined);
  const requestId = useRef(0);
  const searchQuery = makeSearchQuery(query, mode);
  const siteUrl = `https://app.turath.io/search?q=${encodeURIComponent(searchQuery)}`;

  async function search(nextPage = 1, append = false, nextMode = mode, nextQuery = query) {
    const encodedQuery = makeSearchQuery(nextQuery, nextMode);
    if (encodedQuery.replace(/"/g, '').trim().length < 2) {
      setResults([]);
      setResultCount(0);
      setError('اكتب حرفين على الأقل للبحث.');
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const id = ++requestId.current;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 15_000);
    setLoading(true);
    setError('');
    if (!append) {
      setResults([]);
      setResultCount(0);
    }
    try {
      const response = await fetch(`https://api.turath.io/search?ver=3&q=${encodeURIComponent(encodedQuery)}${nextPage > 1 ? `&page=${nextPage}` : ''}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object') throw new Error('Invalid response');
      const payload = data as { data?: unknown; count?: unknown };
      const items = Array.isArray(payload.data) ? payload.data.map(parseResult).filter((item): item is TurathResult => Boolean(item)) : [];
      if (id !== requestId.current) return;
      setResults((current) => append ? [...current, ...items] : items);
      setResultCount(Number(payload.count) || 0);
      setPage(nextPage);
    } catch {
      if (id !== requestId.current) return;
      setError(timedOut ? 'انتهت مهلة الاتصال بتراث.' : 'تعذّر جلب النتائج داخل التطبيق. يمكنك فتح البحث في موقع تراث.');
    } finally {
      window.clearTimeout(timeout);
      if (id === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    searchInput.current?.focus();
    void search(1, false, 'text', initialQuery.slice(0, 300));
    return () => requestRef.current?.abort();
  }, []);

  function setSearchMode(nextMode: TurathSearchMode) {
    setMode(nextMode);
    void search(1, false, nextMode, query);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void search();
  }

  const hasMore = resultCount > results.length;

  return <div className="turath-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="turath-panel" role="dialog" aria-modal="true" aria-label="البحث في تراث" onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
      <header className="turath-panel-header"><div><span className="eyebrow">بحث في المكتبة التراثية</span><h2>تراث</h2></div><button className="icon-button" type="button" aria-label="إغلاق البحث في تراث" onClick={onClose}>×</button></header>
      <form className="turath-search-form" onSubmit={submit}>
        <label className="turath-query-label" htmlFor="turath-query">عبارة البحث</label>
        <textarea ref={searchInput} id="turath-query" rows={3} maxLength={300} value={query} onChange={(event) => setQuery(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void search(); } }} />
        <div className="turath-search-modes" role="radiogroup" aria-label="طريقة البحث">
          <button type="button" role="radio" aria-checked={mode === 'text'} className={mode === 'text' ? 'is-active' : ''} onClick={() => setSearchMode('text')}>بحث نصي · العبارة كما هي</button>
          <button type="button" role="radio" aria-checked={mode === 'smart'} className={mode === 'smart' ? 'is-active' : ''} onClick={() => setSearchMode('smart')}>بحث ذكي · الكلمات</button>
        </div>
        <div className="turath-search-actions"><button className="button button-primary" type="submit" disabled={loading}>{loading ? 'جارٍ البحث…' : 'ابحث'}</button><a className="button button-secondary" href={siteUrl} target="_blank" rel="noopener noreferrer">فتح في موقع تراث ↗</a></div>
      </form>
      <div className="turath-results" aria-live="polite" aria-busy={loading}>
        {loading && results.length === 0 && <p className="turath-message">جارٍ البحث في تراث…</p>}
        {error && <div className="turath-message" role="status">{error}{!navigator.onLine && <span> يبدو أنك غير متصل بالإنترنت.</span>}</div>}
        {!loading && !error && resultCount >= 0 && results.length === 0 && query.trim().length >= 2 && <p className="turath-message">لا توجد نتائج مطابقة.</p>}
        {results.length > 0 && <p className="turath-result-count">{new Intl.NumberFormat('ar').format(resultCount || results.length)} نتيجة</p>}
        {results.map((result, index) => {
          const location = [result.volume && result.volume !== '0' ? `ج ${result.volume}` : '', result.page ? `ص ${result.page}` : ''].filter(Boolean).join(' / ');
          return <a className="turath-result" href={`https://app.turath.io/book/${encodeURIComponent(result.bookId)}${result.pageId ? `/${encodeURIComponent(result.pageId)}` : ''}`} target="_blank" rel="noopener noreferrer" key={`${result.bookId}-${result.pageId}-${index}`}>
            <strong>{result.bookTitle}</strong>
            {(result.authorName || location) && <small>{result.authorName}{result.authorName && location ? ' — ' : ''}{location}</small>}
            <span>{snippetContent(result.snippet)}</span>
          </a>;
        })}
        {hasMore && <button className="button button-secondary turath-more" type="button" disabled={loading} onClick={() => void search(page + 1, true)}>{loading ? 'جارٍ تحميل النتائج…' : 'المزيد من النتائج'}</button>}
      </div>
    </aside>
  </div>;
}
