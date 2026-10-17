import type { StudyData, StudyReadingStats } from './types';

export type ReadingSummary = {
  bookDays: Record<string, number>;
  libraryDays: Record<string, number>;
  bookToday: number;
  bookWeek: number;
  bookTotal: number;
  activeDays: number;
  libraryToday: number;
  libraryWeek: number;
  currentStreak: number;
  bestStreak: number;
  todayCountsAsRead: boolean;
  recentDays: { date: string; seconds: number }[];
};

export type ReadingChapterSummary = { title: string; highlights: number; comments: number };
export type ReadingBookSummary = {
  id: string;
  title: string;
  seconds: number;
  highlights: number;
  comments: number;
  lastRead: string;
  chapters: ReadingChapterSummary[];
};
export type ReadingLibrarySummary = {
  reading: ReadingSummary;
  books: ReadingBookSummary[];
};

export const READING_IDLE_TIMEOUT_MS = 90_000;
export const READING_TICK_SECONDS = 5;
export const READING_FLUSH_SECONDS = 120;
export const READING_MAX_FLUSH_DELAY_MS = 180_000;

export function shouldCountReadingTick(isVisible: boolean, lastActivityAt: number, now: number): boolean {
  return isVisible && now - lastActivityAt < READING_IDLE_TIMEOUT_MS;
}

export function localReadingDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isValidReadingDateKey(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const date = new Date(0);
  date.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setHours(0, 0, 0, 0);
  return localReadingDateKey(date) === value;
}

export function normalizeReadingStats(value?: Partial<StudyReadingStats> | null): StudyReadingStats {
  const days: StudyReadingStats['days'] = {};
  if (value?.days && typeof value.days === 'object' && !Array.isArray(value.days)) {
    for (const [date, rawDevices] of Object.entries(value.days)) {
      if (!isValidReadingDateKey(date) || !rawDevices || typeof rawDevices !== 'object' || Array.isArray(rawDevices)) continue;
      const devices: Record<string, number> = {};
      for (const [deviceId, rawSeconds] of Object.entries(rawDevices)) {
        if (typeof rawSeconds === 'number' && Number.isFinite(rawSeconds) && Math.floor(rawSeconds) > 0) devices[deviceId] = Math.floor(rawSeconds);
      }
      if (Object.keys(devices).length) days[date] = devices;
    }
  }
  const lastReadAt = typeof value?.lastReadAt === 'string' && Number.isFinite(Date.parse(value.lastReadAt))
    ? new Date(value.lastReadAt).toISOString()
    : undefined;
  return { days, ...(lastReadAt ? { lastReadAt } : {}) };
}

export function recordReadingTime(study: StudyData, seconds: number, date: string, deviceId: string, recordedAt = new Date().toISOString()): StudyData {
  const amount = Math.floor(seconds);
  if (!Number.isFinite(amount) || amount <= 0 || !isValidReadingDateKey(date) || !deviceId) return study;
  const reading = normalizeReadingStats(study.reading);
  const devices = reading.days[date] ?? {};
  const normalizedRecordedAt = Number.isFinite(Date.parse(recordedAt)) ? new Date(recordedAt).toISOString() : new Date().toISOString();
  const lastReadAt = reading.lastReadAt && reading.lastReadAt > normalizedRecordedAt ? reading.lastReadAt : normalizedRecordedAt;
  return {
    ...study,
    reading: {
      lastReadAt,
      days: {
        ...reading.days,
        [date]: { ...devices, [deviceId]: (devices[deviceId] ?? 0) + amount },
      },
    },
  };
}

export function mergeReadingStats(current?: StudyReadingStats, imported?: StudyReadingStats): StudyReadingStats {
  const left = normalizeReadingStats(current);
  const right = normalizeReadingStats(imported);
  const days = { ...left.days };
  for (const [date, devices] of Object.entries(right.days)) {
    const merged = { ...(days[date] ?? {}) };
    for (const [deviceId, seconds] of Object.entries(devices)) merged[deviceId] = Math.max(merged[deviceId] ?? 0, seconds);
    days[date] = merged;
  }
  const lastReadAt = [left.lastReadAt, right.lastReadAt].filter((value): value is string => Boolean(value)).sort().at(-1);
  return { days, ...(lastReadAt ? { lastReadAt } : {}) };
}

type ReadingStudy = Partial<StudyData> & Pick<StudyData, 'reading'>;

function aggregateDays(studies: readonly ReadingStudy[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const study of studies) {
    const reading = normalizeReadingStats(study.reading);
    for (const [date, devices] of Object.entries(reading.days)) {
      totals[date] = (totals[date] ?? 0) + Object.values(devices).reduce((sum, seconds) => sum + seconds, 0);
    }
  }
  return totals;
}

function previousDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const previous = new Date(year, month - 1, day);
  previous.setDate(previous.getDate() - 1);
  return localReadingDateKey(previous);
}

function weekTotal(days: Record<string, number>, today: string): number {
  let total = 0;
  let date = today;
  for (let index = 0; index < 7; index += 1) {
    total += days[date] ?? 0;
    date = previousDay(date);
  }
  return total;
}

function streaks(days: Record<string, number>, today: string): { current: number; best: number } {
  const qualifies = (date: string) => (days[date] ?? 0) >= 60;
  let current = 0;
  let date = qualifies(today) ? today : previousDay(today);
  while (qualifies(date)) { current += 1; date = previousDay(date); }

  const dates = Object.keys(days).filter(qualifies).sort();
  let best = 0;
  let run = 0;
  let last = '';
  for (const item of dates) {
    run = last && previousDay(item) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = item;
  }
  return { current, best };
}

export function summarizeReadingTime(bookStudy: ReadingStudy, libraryStudies: readonly ReadingStudy[], now = new Date()): ReadingSummary {
  const today = localReadingDateKey(now);
  const bookDays = aggregateDays([bookStudy]);
  const libraryDays = aggregateDays(libraryStudies);
  const streak = streaks(libraryDays, today);
  const recentDays: ReadingSummary['recentDays'] = [];
  let date = today;
  for (let index = 0; index < 14; index += 1) {
    recentDays.unshift({ date, seconds: libraryDays[date] ?? 0 });
    date = previousDay(date);
  }
  return {
    bookDays,
    libraryDays,
    bookToday: bookDays[today] ?? 0,
    bookWeek: weekTotal(bookDays, today),
    bookTotal: Object.values(bookDays).reduce((sum, seconds) => sum + seconds, 0),
    activeDays: Object.values(bookDays).filter((seconds) => seconds >= 60).length,
    libraryToday: libraryDays[today] ?? 0,
    libraryWeek: weekTotal(libraryDays, today),
    currentStreak: streak.current,
    bestStreak: streak.best,
    todayCountsAsRead: (libraryDays[today] ?? 0) >= 60,
    recentDays,
  };
}

type ReadingBook = {
  id: string;
  title: string;
  headings: readonly { title: string }[];
  passages: readonly { id: string; headingContext?: string }[];
  study?: StudyData;
};

export function summarizeReadingLibrary(books: readonly ReadingBook[], now = new Date()): ReadingLibrarySummary {
  const studies: { book: ReadingBook; study: ReadingStudy }[] = books.map((book) => ({ book, study: book.study ?? { reading: { days: {} } } }));
  const reading = summarizeReadingTime(studies[0]?.study ?? { reading: { days: {} } }, studies.map(({ study }) => study), now);
  const summaries = studies.map(({ book, study }): ReadingBookSummary => {
    const normalized = normalizeReadingStats(study.reading);
    const days = Object.entries(normalized.days).filter(([, devices]) => Object.values(devices).some((seconds) => seconds > 0)).map(([date]) => date).sort();
    const passageChapters = new Map(book.passages.map((passage) => [passage.id, passage.headingContext?.trim() || 'غير مصنف']));
    const chapters = new Map<string, ReadingChapterSummary>();
    const ensureChapter = (title: string) => {
      let chapter = chapters.get(title);
      if (!chapter) {
        chapter = { title, highlights: 0, comments: 0 };
        chapters.set(title, chapter);
      }
      return chapter;
    };
    for (const highlight of study.highlights ?? []) ensureChapter(passageChapters.get(highlight.passageId) ?? 'غير مصنف').highlights += 1;
    const notes = [
      ...(study.comments ?? []).filter((entry) => entry.text.trim()),
      ...(study.notebook ?? []).filter((entry) => entry.text.trim()),
    ];
    for (const note of notes) ensureChapter(passageChapters.get(note.passageId) ?? 'غير مصنف').comments += 1;
    const headingOrder = new Map<string, number>();
    book.headings.forEach((heading, index) => { if (!headingOrder.has(heading.title.trim())) headingOrder.set(heading.title.trim(), index); });
    const chapterList = [...chapters.values()].sort((left, right) =>
      (headingOrder.get(left.title) ?? Number.MAX_SAFE_INTEGER) - (headingOrder.get(right.title) ?? Number.MAX_SAFE_INTEGER)
      || left.title.localeCompare(right.title));
    return {
      id: book.id,
      title: book.title,
      seconds: Object.values(normalized.days).reduce((total, devices) => total + Object.values(devices).reduce((sum, seconds) => sum + seconds, 0), 0),
      highlights: study.highlights?.length ?? 0,
      comments: notes.length,
      lastRead: days.at(-1) ?? '',
      chapters: chapterList,
    };
  }).filter((book) => book.seconds > 0 || book.highlights > 0 || book.comments > 0)
    .sort((left, right) => right.seconds - left.seconds || left.title.localeCompare(right.title));
  return { reading, books: summaries };
}

function arabicDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
}

export function formatReadingDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) return `${arabicDigits(rounded)} ث`;
  const minutes = Math.round(rounded / 60);
  if (minutes < 60) return `${arabicDigits(minutes)} د`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${arabicDigits(hours)} س${remaining ? ` ${arabicDigits(remaining)} د` : ''}`;
}

export function buildReadingSummaryText(summary: ReadingLibrarySummary, studentName = ''): string {
  const { reading, books } = summary;
  const topBooks = books.slice(0, 6).map((book) => `  • ${book.title.slice(0, 50)}: ${formatReadingDuration(book.seconds)}${book.highlights ? ` · ${arabicDigits(book.highlights)} تظليل` : ''}`).join('\n');
  return `${studentName.trim() ? `الطالب: ${studentName.trim()}\n` : ''}وقت القراءة الكلي: ${formatReadingDuration(Object.values(reading.libraryDays).reduce((sum, seconds) => sum + seconds, 0))} (${arabicDigits(reading.activeDays)} يوم قراءة)\nاليوم: ${formatReadingDuration(reading.libraryToday)} · آخر ٧ أيام: ${formatReadingDuration(reading.libraryWeek)}\nالأيام المتتالية: ${arabicDigits(reading.currentStreak)} (الأطول: ${arabicDigits(reading.bestStreak)})\nالتظليل: ${arabicDigits(books.reduce((sum, book) => sum + book.highlights, 0))} · التعليقات: ${arabicDigits(books.reduce((sum, book) => sum + book.comments, 0))}${topBooks ? `\nالكتب:\n${topBooks}` : ''}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

export function buildReadingTeacherReportHtml(summary: ReadingLibrarySummary, studentName = '', generatedAt = new Date()): string {
  const { reading, books } = summary;
  const totalSeconds = Object.values(reading.libraryDays).reduce((sum, seconds) => sum + seconds, 0);
  const days = Object.entries(reading.libraryDays).filter(([, seconds]) => seconds > 0).sort(([left], [right]) => right.localeCompare(left)).slice(0, 30);
  const bookSections = books.map((book) => {
    const chapters = book.chapters.filter((chapter) => chapter.highlights || chapter.comments);
    const chapterTable = chapters.length
      ? `<table><thead><tr><th>الباب</th><th>التظليل</th><th>التعليقات</th></tr></thead><tbody>${chapters.map((chapter) => `<tr><td>${escapeHtml(chapter.title)}</td><td>${arabicDigits(chapter.highlights)}</td><td>${arabicDigits(chapter.comments)}</td></tr>`).join('')}</tbody></table>`
      : '<p>لا توجد ملاحظات أو تظليلات مرتبطة بعناوين.</p>';
    return `<section><h3>${escapeHtml(book.title)}</h3><p class="book-summary">${formatReadingDuration(book.seconds)} قراءة · ${arabicDigits(book.highlights)} تظليل · ${arabicDigits(book.comments)} تعليق${book.lastRead ? ` · آخر قراءة ${escapeHtml(arabicDigits(book.lastRead))}` : ''}</p>${chapterTable}</section>`;
  }).join('');
  const dayTable = days.length
    ? days.map(([date, seconds]) => `<tr><td>${escapeHtml(arabicDigits(date))}</td><td>${formatReadingDuration(seconds)}</td></tr>`).join('')
    : '<tr><td colspan="2">لا سجلّ بعد</td></tr>';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير قراءة</title><style>body{font-family:Tahoma,Arial,sans-serif;max-width:780px;margin:24px auto;padding:0 16px;color:#1d1d1d;line-height:1.9}h1{font-size:22px;color:#1f2d4d;margin:0}h2{font-size:16px;color:#1f2d4d;border-bottom:2px solid #c9a96a;padding-bottom:4px;margin-top:22px}h3{font-size:15px;margin:14px 0 0;color:#2b5d86}.summary{display:flex;gap:10px;flex-wrap:wrap}.summary div{flex:1;min-width:130px;border:1px solid #ddd;border-radius:10px;padding:8px 12px}.summary b{display:block;font-size:20px;color:#1f2d4d}table{width:100%;border-collapse:collapse;margin-top:4px}td,th{border-bottom:1px solid #e3e3e3;padding:4px 8px;text-align:right}th{background:#f4efe1}.muted,.book-summary{color:#777;font-size:13px}@media print{body{margin:0}}</style></head><body><h1>تقرير قراءة</h1><p class="muted">${studentName.trim() ? `الطالب: ${escapeHtml(studentName.trim())} · ` : ''}أُنشئ في ${escapeHtml(arabicDigits(localReadingDateKey(generatedAt)))}</p><h2>الملخص</h2><div class="summary"><div><b>${formatReadingDuration(totalSeconds)}</b>وقت القراءة الكلي</div><div><b>${arabicDigits(reading.activeDays)}</b>أيام القراءة</div><div><b>${arabicDigits(reading.currentStreak)}</b>أيام متتالية (الأطول ${arabicDigits(reading.bestStreak)})</div><div><b>${formatReadingDuration(reading.libraryWeek)}</b>آخر ٧ أيام</div><div><b>${arabicDigits(books.reduce((sum, book) => sum + book.highlights, 0))}</b>تظليل</div><div><b>${arabicDigits(books.reduce((sum, book) => sum + book.comments, 0))}</b>تعليق</div></div><h2>الكتب</h2>${bookSections || '<p>لا سجلّ بعد.</p>'}<h2>آخر الأيام (حتى ٣٠ يومًا)</h2><table><thead><tr><th>اليوم</th><th>الوقت</th></tr></thead><tbody>${dayTable}</tbody></table><p class="muted">وقت القراءة تقديري؛ يُحتسب حين تكون الصفحة ظاهرة مع نشاط حديث.</p></body></html>`;
}
