import { useEffect, useRef, useState } from 'react';
import type { BookRecord, Passage } from '../domain/types';

const COMPANION_URL = 'http://127.0.0.1:47832';
const TOKEN_KEY = 'sr:v2:companion-token';

type SharedSelection = { bookId: string; passageId: string; text: string } | undefined;
type Provider = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'groq';
type ModelOption = { id: string; label: string };
type AnswerSource = { id: number; bookId: string; title: string; label: string; heading: string; url: string; excerpt: string };
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; sources?: AnswerSource[] };
type CompanionResponse = { error?: string; ok?: boolean; bookCount?: number; shared?: boolean; activeTitle?: string };
type TtsProvider = 'openai' | 'google' | 'azure';
type TtsVoice = { id: string; label: string; locale?: string };
type TtsSample = { id: string; provider: TtsProvider; voice: string; voiceLabel: string; model: string; text: string; audioUrl: string; durationMs: number; pronunciation: number; naturalness: number; pacing: number };

function providerLabel(provider: Provider) {
  return ({ gemini: 'Google Gemini', openai: 'OpenAI', anthropic: 'Claude API', openrouter: 'OpenRouter', groq: 'Groq' })[provider];
}

function ttsProviderLabel(provider: TtsProvider) {
  return ({ openai: 'OpenAI TTS', google: 'Google Cloud TTS', azure: 'Azure Speech' })[provider];
}

type CompanionPanelProps = {
  books: BookRecord[];
  activeBook?: BookRecord;
  selection?: SharedSelection;
  onClose: () => void;
};

function readSavedToken() {
  try { return localStorage.getItem(TOKEN_KEY) ?? ''; } catch { return ''; }
}

function shareableBook(book: BookRecord) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    pageNumberKind: book.pageNumberKind,
    passages: book.passages.map((passage: Passage) => ({
      id: passage.id,
      text: passage.text,
      readerPageNumber: passage.readerPageNumber,
      readerPageEndNumber: passage.readerPageEndNumber,
      sourcePageNumber: passage.sourcePageNumber,
      sourcePageEndNumber: passage.sourcePageEndNumber,
      headingContext: passage.headingContext,
      footnoteIds: passage.footnoteIds,
    })),
    footnotes: book.footnotes.map(({ id, text }) => ({ id, text })),
  };
}

export function CompanionPanel({ books, activeBook, selection, onClose }: CompanionPanelProps) {
  const [token, setToken] = useState(readSavedToken);
  const [scope, setScope] = useState<'book' | 'library'>('book');
  const [tab, setTab] = useState<'mcp' | 'chat' | 'tts'>('mcp');
  const [status, setStatus] = useState('لم يتم التحقق من اتصال المساعد بعد.');
  const [isBusy, setIsBusy] = useState(false);
  const [sharedCount, setSharedCount] = useState(0);
  const [provider, setProvider] = useState<Provider>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<ModelOption[]>([]);
  const [model, setModel] = useState('');
  const [question, setQuestion] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [allowCloudSend, setAllowCloudSend] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>('google');
  const [ttsApiKeys, setTtsApiKeys] = useState<Record<TtsProvider, string>>({ openai: '', google: '', azure: '' });
  const [ttsRegion, setTtsRegion] = useState('');
  const [ttsVoices, setTtsVoices] = useState<TtsVoice[]>([]);
  const [ttsModels, setTtsModels] = useState<string[]>([]);
  const [ttsModel, setTtsModel] = useState('');
  const [ttsVoice, setTtsVoice] = useState('');
  const [ttsText, setTtsText] = useState(() => selection?.text || activeBook?.passages[0]?.text || '');
  const [ttsConsent, setTtsConsent] = useState(false);
  const [ttsSamples, setTtsSamples] = useState<TtsSample[]>([]);
  const audioUrls = useRef<string[]>([]);
  const ttsTextBytes = new TextEncoder().encode(ttsText).length;
  const ttsTextWithinSharedLimit = ttsText.length <= 4096 && ttsTextBytes <= 5000;

  useEffect(() => () => { audioUrls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);
  useEffect(() => {
    if (!ttsText.trim() && (selection?.text || activeBook?.passages[0]?.text)) setTtsText(selection?.text || activeBook?.passages[0]?.text || '');
  }, [selection?.text, activeBook?.id, activeBook?.passages, ttsText]);

  async function request<T extends object = CompanionResponse>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('authorization', `Bearer ${token.trim()}`);
    if (options.body) headers.set('content-type', 'application/json');
    const response = await fetch(`${COMPANION_URL}${path}`, { ...options, headers });
    const body = await response.json().catch(() => ({})) as CompanionResponse;
    if (!response.ok) {
      if (response.status === 401) throw new Error('رمز الربط غير صحيح. اعرض الرمز من المساعد المحلي ثم أدخله هنا.');
      throw new Error(body.error || `فشل الطلب (${response.status}).`);
    }
    return body as T;
  }

  function rememberToken() {
    try { localStorage.setItem(TOKEN_KEY, token.trim()); } catch { /* The connection still works for this session. */ }
  }

  async function checkConnection() {
    setIsBusy(true);
    try {
      if (!token.trim()) throw new Error('أدخل رمز الربط الذي يعرضه المساعد المحلي.');
      const health = await fetch(`${COMPANION_URL}/health`, { signal: AbortSignal.timeout(2500) });
      if (!health.ok) throw new Error('المساعد المحلي لم يستجب. شغّله أولًا من Claude أو Codex أو بالأمر الموضح أدناه.');
      const state = await request('/v1/session');
      rememberToken();
      setSharedCount(state.bookCount ?? 0);
      setStatus(state.shared ? `متصل؛ تتم مشاركة ${state.bookCount} كتاب/كتب، والكتاب النشط: ${state.activeTitle}.` : 'المساعد متصل، ولم تشارك أي كتاب بعد.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر الاتصال بالمساعد المحلي.');
    } finally {
      setIsBusy(false);
    }
  }

  function booksInScope() {
    return scope === 'library' ? books : activeBook ? [activeBook] : [];
  }

  function sessionPayload() {
    const booksToShare = booksInScope();
    const selectionForScope = selection?.text && booksToShare.some((book) => book.id === selection.bookId) ? selection : undefined;
    return {
      books: booksToShare.map(shareableBook),
      activeBookId: activeBook?.id,
      selection: selectionForScope,
      baseUrl: window.location.href,
    };
  }

  async function shareBooks() {
    setIsBusy(true);
    try {
      if (!token.trim()) throw new Error('أدخل رمز الربط الذي يعرضه المساعد المحلي.');
      const booksToShare = booksInScope();
      if (!booksToShare.length) throw new Error(scope === 'library' ? 'لا توجد كتب في المكتبة.' : 'افتح كتابًا أولًا لمشاركته.');
      const result = await request('/v1/session', {
        method: 'POST',
        body: JSON.stringify(sessionPayload()),
      });
      rememberToken();
      setSharedCount(result.bookCount ?? booksToShare.length);
      setStatus(`تمت مشاركة ${result.bookCount ?? booksToShare.length} كتاب/كتب مع المساعد المحلي. النص يبقى في ذاكرة المساعد حتى تنهي المشاركة أو تغلقه.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر مشاركة الكتب.');
    } finally {
      setIsBusy(false);
    }
  }

  async function loadModels() {
    setIsBusy(true);
    try {
      if (!token.trim()) throw new Error('أدخل رمز المساعد المحلي أولًا.');
      if (!apiKey.trim()) throw new Error('أدخل مفتاح API للمزود أولًا.');
      const result = await request<{ models: ModelOption[] }>('/v1/models', { method: 'POST', body: JSON.stringify({ provider, apiKey }) });
      setModels(result.models ?? []);
      setModel(result.models?.[0]?.id ?? '');
      rememberToken();
      setStatus(result.models?.length ? `عُثر على ${result.models.length} نموذجًا من ${providerLabel(provider)}.` : 'لم يُرجع المزود نماذج متاحة لهذا المفتاح.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر جلب قائمة النماذج.');
    } finally {
      setIsBusy(false);
    }
  }

  async function askQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text || isBusy) return;
    if (!allowCloudSend) {
      setStatus('وافق على إرسال السؤال والمقاطع المسترجعة إلى المزود السحابي قبل المتابعة.');
      return;
    }
    const booksToShare = booksInScope();
    if (!booksToShare.length) {
      setStatus(scope === 'library' ? 'لا توجد كتب في المكتبة.' : 'افتح كتابًا أولًا.');
      return;
    }
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    const priorHistory = chatMessages.slice(-8).map(({ role, content }) => ({ role, content }));
    setChatMessages((current) => [...current, userMessage]);
    setQuestion('');
    setIsBusy(true);
    try {
      if (!token.trim()) throw new Error('أدخل رمز المساعد المحلي أولًا.');
      if (!apiKey.trim()) throw new Error('أدخل مفتاح API للمزود المختار.');
      if (!model.trim()) throw new Error('حمّل قائمة النماذج واختر نموذجًا.');
      await request('/v1/session', { method: 'POST', body: JSON.stringify(sessionPayload()) });
      setSharedCount(booksToShare.length);
      const result = await request<{ answer: string; sources: AnswerSource[]; model: string }>('/v1/ask', {
        method: 'POST',
        body: JSON.stringify({ question: text, history: priorHistory, provider, apiKey, model, scope, bookId: activeBook?.id }),
      });
      rememberToken();
      setSharedCount(booksToShare.length);
      setChatMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: result.answer, sources: result.sources }]);
      setStatus(`أجاب ${providerLabel(provider)} باستخدام ${result.model}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر الحصول على إجابة.';
      setChatMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: `تعذر إكمال الطلب: ${message}` }]);
      setStatus(message);
    } finally {
      setIsBusy(false);
    }
  }

  function changeProvider(value: Provider) {
    setProvider(value);
    setModels([]);
    setModel('');
    setAllowCloudSend(false);
  }

  function changeScope(value: 'book' | 'library') {
    if (scope === value) return;
    setScope(value);
    setChatMessages([]);
    setAllowCloudSend(false);
  }

  async function loadTtsVoices() {
    setIsBusy(true);
    try {
      if (!token.trim()) throw new Error('أدخل رمز المساعد المحلي أولًا.');
      const apiKey = ttsApiKeys[ttsProvider].trim();
      if (!apiKey) throw new Error(`أدخل مفتاح ${ttsProviderLabel(ttsProvider)} أولًا.`);
      const result = await request<{ voices: TtsVoice[]; models: string[]; note: string }>('/v1/tts/voices', {
        method: 'POST',
        body: JSON.stringify({ provider: ttsProvider, apiKey, region: ttsRegion }),
      });
      setTtsVoices(result.voices ?? []);
      setTtsVoice(result.voices?.[0]?.id ?? '');
      setTtsModels(result.models ?? []);
      setTtsModel(result.models?.[0] ?? '');
      setStatus(result.note || `عُثر على ${result.voices?.length ?? 0} صوت عربي.`);
      rememberToken();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر جلب أصوات المزود.');
    } finally {
      setIsBusy(false);
    }
  }

  async function generateTtsSample() {
    setIsBusy(true);
    try {
      const apiKey = ttsApiKeys[ttsProvider].trim();
      const text = ttsText.trim();
      if (!token.trim()) throw new Error('أدخل رمز المساعد المحلي أولًا.');
      if (!apiKey) throw new Error(`أدخل مفتاح ${ttsProviderLabel(ttsProvider)}.`);
      if (!ttsConsent) throw new Error('وافق على إرسال النص إلى مزود الصوت قبل التوليد.');
      if (!ttsVoice) throw new Error('اجلب قائمة الأصوات واختر صوتًا عربيًا.');
      if (!text || text.length > 4096 || new TextEncoder().encode(text).length > 5000) throw new Error('للمقارنة بين المزودات، يجب أن يكون النص ضمن ٤٠٩٦ حرفًا و٥٠٠٠ بايت UTF-8.');
      if (ttsProvider === 'openai' && !ttsModel.trim()) throw new Error('اختر نموذج TTS متاحًا لمفتاحك.');
      const startedAt = performance.now();
      const result = await request<{ audioBase64: string; contentType: string; model: string; voice: string }>('/v1/tts/synthesize', {
        method: 'POST',
        body: JSON.stringify({ provider: ttsProvider, apiKey, model: ttsModel, voice: ttsVoice, locale: ttsVoices.find((voice) => voice.id === ttsVoice)?.locale, region: ttsRegion, text }),
      });
      const binary = Uint8Array.from(atob(result.audioBase64), (character) => character.charCodeAt(0));
      const audioUrl = URL.createObjectURL(new Blob([binary], { type: result.contentType || 'audio/mpeg' }));
      audioUrls.current.push(audioUrl);
      const voice = ttsVoices.find((item) => item.id === result.voice);
      const sample: TtsSample = { id: crypto.randomUUID(), provider: ttsProvider, voice: result.voice, voiceLabel: voice?.label || result.voice, model: result.model, text, audioUrl, durationMs: Math.round(performance.now() - startedAt), pronunciation: 0, naturalness: 0, pacing: 0 };
      setTtsSamples((current) => [sample, ...current]);
      setStatus(`اكتمل توليد عينة ${ttsProviderLabel(ttsProvider)}. الصوت مولّد بالذكاء الاصطناعي.`);
      rememberToken();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر توليد العينة الصوتية.');
    } finally {
      setIsBusy(false);
    }
  }

  function rateTtsSample(sampleId: string, field: 'pronunciation' | 'naturalness' | 'pacing', value: number) {
    setTtsSamples((current) => current.map((sample) => sample.id === sampleId ? { ...sample, [field]: value } : sample));
  }

  function clearTtsSamples() {
    audioUrls.current.forEach((url) => URL.revokeObjectURL(url));
    audioUrls.current = [];
    setTtsSamples([]);
  }

  function changeTtsProvider(value: TtsProvider) {
    setTtsProvider(value);
    setTtsVoices([]);
    setTtsModels([]);
    setTtsVoice('');
    setTtsModel('');
    setTtsConsent(false);
  }

  async function stopSharing() {
    setIsBusy(true);
    try {
      await request('/v1/session', { method: 'DELETE' });
      setSharedCount(0);
      setStatus('انتهت المشاركة ومُسحت نسخة الجسر الموجودة في الذاكرة.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إنهاء المشاركة.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="companion-panel" aria-label="ربط Claude وCodex بالمكتبة">
      <nav className="companion-tabs" aria-label="خيارات المساعد">
        <button type="button" aria-pressed={tab === 'mcp'} onClick={() => setTab('mcp')}>ربط Claude وCodex</button>
        <button type="button" aria-pressed={tab === 'chat'} onClick={() => setTab('chat')}>اسأل داخل التطبيق</button>
        <button type="button" aria-pressed={tab === 'tts'} onClick={() => setTab('tts')}>مقارنة الأصوات</button>
      </nav>
      {tab === 'mcp' ? <>
      <p className="companion-panel-intro">
        يربط هذا الخيار القارئ بمساعد محلي على جهازك. لا يرسل التطبيق كتابًا قبل أن تختار المشاركة. أدوات Claude وCodex للقراءة فقط؛ وعند استدعاء أداة، يصبح النص المسترجع جزءًا من محادثة ذلك المساعد.
      </p>

      <label className="companion-field">
        <span>رمز المساعد المحلي</span>
        <input type="password" autoComplete="off" spellCheck={false} value={token} onChange={(event) => setToken(event.currentTarget.value)} placeholder="الصق الرمز الذي يعرضه companion" dir="ltr" />
      </label>

      <div className="companion-actions">
        <button type="button" className="text-button" onClick={() => void checkConnection()} disabled={isBusy}>{isBusy ? 'جارٍ الاتصال…' : 'اختبار الاتصال'}</button>
        <button type="button" className="text-button" onClick={() => void stopSharing()} disabled={isBusy || sharedCount === 0}>إنهاء المشاركة</button>
      </div>

      <fieldset className="companion-scope">
        <legend>ما الذي تريد مشاركته؟</legend>
        <label><input type="radio" name="companion-scope" checked={scope === 'book'} onChange={() => setScope('book')} /> الكتاب المفتوح{activeBook ? `: ${activeBook.title}` : ''}</label>
        <label><input type="radio" name="companion-scope" checked={scope === 'library'} onChange={() => setScope('library')} /> المكتبة كاملة ({books.length})</label>
      </fieldset>

      <div className="companion-share-row">
        <button type="button" className="button button-primary" onClick={() => void shareBooks()} disabled={isBusy || (scope === 'book' && !activeBook) || (scope === 'library' && !books.length)}>
          {isBusy ? 'جارٍ تحديث المشاركة…' : 'مشاركة النطاق المختار'}
        </button>
        {sharedCount > 0 && <span>{sharedCount} كتاب/كتب مشتركة</span>}
      </div>

      <p className="companion-status" role="status" aria-live="polite">{status}</p>
      <details className="companion-setup">
        <summary>إعداد Claude أو Codex</summary>
        <p>ثبّت Node.js على جهازك، ثم أضف هذا الملف كخادم MCP في إعدادات Claude Desktop أو Codex:</p>
        <code dir="ltr">node "مسار المشروع/v2/companion/smart-reader-companion.mjs"</code>
        <p>بعد تشغيل Claude أو Codex، أدخل الرمز الذي يعرضه الأمر التالي في هذا النموذج:</p>
        <code dir="ltr">node "مسار المشروع/v2/companion/smart-reader-companion.mjs" --show-token</code>
        <p>يمكن تشغيل المساعد المحلي دون عميل MCP بالأمر <code dir="ltr">--serve</code>. يظل الربط متاحًا على جهازك فقط عبر 127.0.0.1، ويمكنك إنهاء المشاركة لمسح النصوص من ذاكرته.</p>
      </details>
      </> : tab === 'chat' ? <>
        <p className="companion-panel-intro">يبحث المساعد محليًا في النطاق الذي تختاره، ثم يرسل السؤال والمقاطع المسترجعة إلى مزود API السحابي. مفتاح API يبقى في ذاكرة هذه الصفحة والطلب؛ لا يُحفظ في ملف التطبيق أو إعدادات المساعد المحلي.</p>
        <label className="companion-field"><span>رمز المساعد المحلي</span><input type="password" autoComplete="off" spellCheck={false} value={token} onChange={(event) => setToken(event.currentTarget.value)} placeholder="الصق الرمز الذي يعرضه companion" dir="ltr" /></label>
        <div className="companion-actions"><button type="button" className="text-button" onClick={() => void checkConnection()} disabled={isBusy}>{isBusy ? 'جارٍ الاتصال…' : 'اختبار الاتصال'}</button><button type="button" className="text-button" onClick={() => void stopSharing()} disabled={isBusy || sharedCount === 0}>إنهاء المشاركة</button></div>
        <label className="companion-field"><span>مزود API</span><select value={provider} onChange={(event) => changeProvider(event.currentTarget.value as Provider)}><option value="gemini">Google Gemini</option><option value="openai">OpenAI</option><option value="anthropic">Claude API</option><option value="openrouter">OpenRouter</option><option value="groq">Groq</option></select></label>
        <label className="companion-field"><span>مفتاح API للمزود</span><input type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={(event) => setApiKey(event.currentTarget.value)} placeholder={`مفتاح ${providerLabel(provider)}`} dir="ltr" /></label>
        <div className="companion-model-row"><label className="companion-field"><span>النموذج</span><input list="companion-model-list" value={model} onChange={(event) => setModel(event.currentTarget.value)} placeholder="حمّل قائمة النماذج أو أدخل المعرّف" dir="ltr" /><datalist id="companion-model-list">{models.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</datalist></label><button type="button" className="text-button" onClick={() => void loadModels()} disabled={isBusy}>{isBusy ? 'جارٍ الجلب…' : 'جلب النماذج'}</button></div>
        <fieldset className="companion-scope"><legend>نطاق السؤال</legend><label><input type="radio" name="ai-scope" checked={scope === 'book'} onChange={() => changeScope('book')} /> الكتاب المفتوح{activeBook ? `: ${activeBook.title}` : ''}</label><label><input type="radio" name="ai-scope" checked={scope === 'library'} onChange={() => changeScope('library')} /> المكتبة كاملة ({books.length})</label></fieldset>
        <div className="companion-chat" aria-live="polite">{chatMessages.length ? chatMessages.map((message) => <article key={message.id} className={`companion-message ${message.role}`}><strong>{message.role === 'user' ? 'أنت' : 'المساعد'}</strong><p dir="auto">{message.content}</p>{message.sources?.length ? <ul className="companion-sources">{message.sources.map((source) => <li key={`${source.bookId}:${source.id}`}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title} · {source.label}{source.heading ? ` · ${source.heading}` : ''}</a> : <span>{source.title} · {source.label}</span>}<small>{source.excerpt}</small></li>)}</ul> : null}</article>) : <p className="companion-chat-empty">لم تبدأ محادثة بعد. اختر المزود والنطاق، ثم اكتب سؤالك.</p>}</div>
        <form className="companion-ask-form" onSubmit={(event) => void askQuestion(event)}>
          <label className="companion-field"><span>سؤالك</span><textarea value={question} onChange={(event) => setQuestion(event.currentTarget.value)} placeholder="اكتب سؤالًا عن النص أو الكتاب…" rows={3} /></label>
          <label className="companion-consent"><input type="checkbox" checked={allowCloudSend} onChange={(event) => setAllowCloudSend(event.currentTarget.checked)} /> أوافق على إرسال السؤال والمقاطع المسترجعة إلى المزود السحابي المختار. قد يترتب على استخدام API تكلفة، وتخضع البيانات لسياسة المزود.</label>
          <div className="companion-share-row"><button type="submit" className="button button-primary" disabled={isBusy || !question.trim() || !allowCloudSend}>{isBusy ? 'جارٍ طلب الإجابة…' : 'اسأل من كتبي'}</button><button type="button" className="text-button" onClick={() => setChatMessages([])} disabled={!chatMessages.length || isBusy}>مسح المحادثة</button></div>
        </form>
        <p className="companion-status" role="status" aria-live="polite">{status}</p>
      </> : <>
        <p className="companion-panel-intro">ولّد النص نفسه بأصوات عربية من مزودات سحابية، ثم استمع وقارن النطق والطبيعية والوقفات وزمن التوليد. مزودات الصوت تتقاضى رسومًا بحسب خطتك. لا يُحفظ المفتاح أو الصوت بعد إغلاق التطبيق أو مسح العينات.</p>
        <label className="companion-field"><span>رمز المساعد المحلي</span><input type="password" autoComplete="off" spellCheck={false} value={token} onChange={(event) => setToken(event.currentTarget.value)} placeholder="الصق الرمز الذي يعرضه companion" dir="ltr" /></label>
        <label className="companion-field"><span>مزود تحويل النص إلى صوت</span><select value={ttsProvider} onChange={(event) => changeTtsProvider(event.currentTarget.value as TtsProvider)}><option value="google">Google Cloud TTS</option><option value="azure">Azure Speech</option><option value="openai">OpenAI TTS</option></select></label>
        <label className="companion-field"><span>مفتاح المزود (لا يُحفظ)</span><input type="password" autoComplete="off" spellCheck={false} value={ttsApiKeys[ttsProvider]} onChange={(event) => setTtsApiKeys((current) => ({ ...current, [ttsProvider]: event.currentTarget.value }))} placeholder={`مفتاح ${ttsProviderLabel(ttsProvider)}`} dir="ltr" /></label>
        {ttsProvider === 'azure' && <label className="companion-field"><span>منطقة مورد Azure Speech</span><input value={ttsRegion} onChange={(event) => setTtsRegion(event.currentTarget.value)} placeholder="مثال: uaenorth أو westeurope" dir="ltr" /></label>}
        {ttsProvider === 'openai' && <label className="companion-field"><span>نموذج TTS المتاح لحسابك</span><input list="companion-tts-models" value={ttsModel} onChange={(event) => setTtsModel(event.currentTarget.value)} placeholder="جلب الأصوات يحدّث النماذج المتاحة" dir="ltr" /><datalist id="companion-tts-models">{ttsModels.map((item) => <option key={item} value={item} />)}</datalist></label>}
        <div className="companion-actions"><button type="button" className="text-button" onClick={() => void checkConnection()} disabled={isBusy}>{isBusy ? 'جارٍ الاتصال…' : 'اختبار المساعد المحلي'}</button><button type="button" className="button" onClick={() => void loadTtsVoices()} disabled={isBusy}>{isBusy ? 'جارٍ الجلب…' : 'جلب الأصوات العربية'}</button></div>
        <label className="companion-field"><span>الصوت</span><select value={ttsVoice} onChange={(event) => setTtsVoice(event.currentTarget.value)} disabled={!ttsVoices.length}><option value="">اختر صوتًا عربيًا</option>{ttsVoices.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>)}</select></label>
        {ttsProvider === 'openai' && <p className="companion-provider-note">وثائق OpenAI تقول إن الأصوات محسّنة للإنجليزية رغم دعم العربية؛ لذلك نقيس النتيجة على نصك بدل افتراض جودة النطق.</p>}
        <label className="companion-field"><span>النص نفسه لكل عينة ({ttsText.length}/٤٠٩٦ حرفًا · {ttsTextBytes}/٥٠٠٠ بايت)</span><textarea value={ttsText} onChange={(event) => setTtsText(event.currentTarget.value)} dir="rtl" rows={5} maxLength={4096} placeholder="الصق فقرة من كتابك للمقارنة…" /></label>
        {!ttsTextWithinSharedLimit && <p className="companion-provider-note">قلّص النص ليبقى ضمن حد المقارنة المشترك بين مزودات الصوت.</p>}
        {selection?.text && <button type="button" className="text-button" onClick={() => setTtsText(selection.text)}>استخدام النص المحدد</button>}
        <label className="companion-consent"><input type="checkbox" checked={ttsConsent} onChange={(event) => setTtsConsent(event.currentTarget.checked)} /> أوافق على إرسال هذا النص إلى مزود الصوت المختار لتوليد عينة. الصوت مولّد آليًا وقد يترتب على الطلب تكلفة.</label>
        <div className="companion-share-row"><button type="button" className="button button-primary" onClick={() => void generateTtsSample()} disabled={isBusy || !ttsConsent || !ttsText.trim() || !ttsTextWithinSharedLimit || !ttsVoice}>{isBusy ? 'جارٍ توليد الصوت…' : 'ولّد عينة صوتية'}</button><button type="button" className="text-button" onClick={clearTtsSamples} disabled={!ttsSamples.length}>مسح العينات</button></div>
        <div className="tts-samples">{ttsSamples.map((sample) => <article className="tts-sample" key={sample.id}>
          <header><div><strong>{sample.voiceLabel}</strong><small>{ttsProviderLabel(sample.provider)} · {sample.model} · {(sample.durationMs / 1000).toFixed(1)} ث</small></div><a href={sample.audioUrl} download={`smart-reader-${sample.provider}-${sample.voice}.mp3`}>تنزيل</a></header>
          <audio controls preload="none" src={sample.audioUrl}>المتصفح لا يدعم تشغيل الصوت.</audio>
          <details><summary>النص المولّد</summary><p dir="rtl">{sample.text}</p></details>
          <div className="tts-ratings">{([['pronunciation', 'وضوح النطق'], ['naturalness', 'طبيعية الصوت'], ['pacing', 'الوقفات والإيقاع']] as const).map(([field, label]) => <label key={field}>{label}<select value={sample[field]} onChange={(event) => rateTtsSample(sample.id, field, Number(event.currentTarget.value))}><option value={0}>قيّم</option>{[1, 2, 3, 4, 5].map((rating) => <option value={rating} key={rating}>{rating} / ٥</option>)}</select></label>)}</div>
        </article>)}</div>
        <p className="companion-status" role="status" aria-live="polite">{status}</p>
      </>}

      <footer className="companion-footer"><button type="button" className="text-button" onClick={onClose}>إغلاق</button></footer>
    </section>
  );
}
