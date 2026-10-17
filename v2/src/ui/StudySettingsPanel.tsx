import { useEffect, useRef, useState } from 'react';
import { formatBibliographicCitation, toArabicDigits } from '../domain/citation';
import { keepStudyEntriesForPassages, parseStudyBackup } from '../domain/study-backup';
import type { BookRecord, StudyData, StudySettings } from '../domain/types';

const citationPresets = [
  { label: '[العنوان (ص: ١٤)]', value: '[{title} (ص: {page})]' },
  { label: '(العنوان، ص١٤)', value: '({title}، ص{page})' },
  { label: '[العنوان، المؤلف (ص: ١٤)]', value: '[{title}، {author} (ص: {page})]' },
] as const;

export function StudySettingsPanel({
  book,
  settings,
  onChange,
  onEditMetadata,
  onExportStudy,
  onImportStudy,
}: {
  book: BookRecord;
  settings: StudySettings;
  onChange: (patch: Partial<StudySettings>) => void;
  onEditMetadata: () => void;
  onExportStudy: () => void;
  onImportStudy: (study: StudyData, mode: 'merge' | 'replace') => Promise<boolean>;
}) {
  const [templateDraft, setTemplateDraft] = useState(settings.citationTemplate);
  const [pendingBackup, setPendingBackup] = useState<ReturnType<typeof parseStudyBackup>>();
  const [backupError, setBackupError] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const backupInput = useRef<HTMLInputElement>(null);
  useEffect(() => setTemplateDraft(settings.citationTemplate), [book.id, settings.citationTemplate]);
  useEffect(() => {
    setPendingBackup(undefined);
    setBackupError('');
    setBackupMessage('');
  }, [book.id]);

  const preview = formatBibliographicCitation(
    book,
    { id: 'citation-preview', text: 'نص الفقرة…', readerPageNumber: 31, sourcePageNumber: 31 },
    { ...settings, citationTemplate: templateDraft },
  );
  const importPreview = pendingBackup
    ? keepStudyEntriesForPassages(pendingBackup.study, new Set(book.passages.map((passage) => passage.id)))
    : undefined;

  function chooseTemplate(value: string) {
    setTemplateDraft(value);
    onChange({ citationTemplate: value });
  }

  async function readBackup(file?: File) {
    setBackupInputValue();
    setBackupError('');
    setBackupMessage('');
    if (!file) return;
    try {
      const value: unknown = JSON.parse(await file.text());
      const parsed = parseStudyBackup(value);
      if (!parsed) throw new Error('unsupported');
      setPendingBackup(parsed);
    } catch {
      setPendingBackup(undefined);
      setBackupError('هذا الملف ليس نسخة بيانات Smart Reader صالحة أو أن إصداره غير مدعوم.');
    }
  }

  function setBackupInputValue() {
    if (backupInput.current) backupInput.current.value = '';
  }

  async function importBackup(mode: 'merge' | 'replace') {
    if (!pendingBackup || backupBusy) return;
    setBackupBusy(true);
    setBackupError('');
    try {
      const saved = await onImportStudy(pendingBackup.study, mode);
      if (!saved) {
        setBackupError('تعذر حفظ البيانات المستوردة. أعد المحاولة بعد التأكد من توفر مساحة تخزين.');
        return;
      }
      setBackupMessage(mode === 'replace' ? 'استُبدلت بيانات المذاكرة بنجاح.' : 'دُمجت بيانات المذاكرة بنجاح.');
      setPendingBackup(undefined);
    } catch {
      setBackupError('تعذر حفظ البيانات المستوردة. أعد المحاولة بعد التأكد من توفر مساحة تخزين.');
    } finally {
      setBackupBusy(false);
    }
  }

  return <section className="study-panel-body study-settings-panel">
    <h3>إعدادات القراءة والاستشهاد</h3>
    <section className="study-setting-group" aria-labelledby="citation-template-label">
      <h4 id="citation-template-label">صيغة الاستشهاد</h4>
      <input
        className="study-setting-input"
        type="text"
        value={templateDraft}
        aria-label="قالب الاستشهاد"
        onChange={(event) => setTemplateDraft(event.currentTarget.value)}
        onBlur={() => onChange({ citationTemplate: templateDraft })}
      />
      <p className="study-context">استخدم {`{title}`} لعنوان الكتاب، و{`{page}`} للصفحة، و{`{author}`} للمؤلف.</p>
      <div className="study-setting-presets" aria-label="قوالب استشهاد جاهزة">
        {citationPresets.map((preset) => <button key={preset.value} className="text-button" type="button" onClick={() => chooseTemplate(preset.value)}>{preset.label}</button>)}
      </div>
      <label className="study-setting-check"><input type="checkbox" checked={settings.includeAuthor} onChange={(event) => onChange({ includeAuthor: event.currentTarget.checked })} /> أضف المؤلف بعد عنوان الكتاب</label>
      <div className="study-citation-preview" aria-live="polite">نص الفقرة… {preview}</div>
    </section>

    <section className="study-setting-group">
      <h4>الحواشي عند النسخ</h4>
      <label className="study-setting-check"><input type="checkbox" checked={settings.keepFootnotes} onChange={(event) => onChange({ keepFootnotes: event.currentTarget.checked })} /> أبقِ أرقام الحواشي وألحق نصوصها بالاقتباس</label>
      <p className="study-context">في نسخ التحديد الجزئي تبقى الأرقام فقط؛ يُلحق نص الحاشية عند نسخ المقطع الكامل.</p>
    </section>

    <section className="study-setting-group">
      <h4>الفاصل بين عناصر الحافظة</h4>
      <select className="study-setting-input" value={settings.collectionSeparator} onChange={(event) => onChange({ collectionSeparator: event.currentTarget.value as StudySettings['collectionSeparator'] })} aria-label="الفاصل بين عناصر الحافظة">
        <option value="blank">سطر فارغ</option>
        <option value="line">خط فاصل</option>
        <option value="stars">نجوم</option>
      </select>
    </section>

    <section className="study-setting-group">
      <h4>بيانات الكتاب</h4>
      <p className="study-context">{book.title}{book.author ? ` — ${book.author}` : ''}</p>
      <button className="text-button" type="button" onClick={onEditMetadata}>تعديل بيانات الكتاب</button>
    </section>

    <section className="study-setting-group" aria-labelledby="study-backup-title">
      <h4 id="study-backup-title">نسخة بيانات المذاكرة</h4>
      <p className="study-context">صدّر التظليلات والمفضلة والتعليقات والحافظة والتصنيفات والإعدادات، أو استوردها إلى هذا الكتاب. لا يتضمن الملف نص الكتاب.</p>
      <div className="study-setting-presets">
        <button className="text-button" type="button" onClick={onExportStudy}>تنزيل نسخة JSON</button>
        <button className="text-button" type="button" onClick={() => backupInput.current?.click()}>استيراد نسخة JSON</button>
        <input ref={backupInput} className="visually-hidden" type="file" accept=".json,application/json" onChange={(event) => void readBackup(event.currentTarget.files?.[0])} />
      </div>
      {backupError && <p className="study-context" role="alert">{backupError}</p>}
      {backupMessage && <p className="study-context" role="status">{backupMessage}</p>}
      {pendingBackup && <div className="study-clear-confirm" role="group" aria-label="اختيار طريقة استيراد نسخة المذاكرة">
        <span>النسخة من «{pendingBackup.book.title}»؛ هل تدمج عناصرها مع بيانات الكتاب أم تستبدل البيانات الحالية؟</span>
        {importPreview?.dropped ? <p className="study-context">لن تُستورد {toArabicDigits(importPreview.dropped)} عناصر مرتبطة بمواضع غير موجودة في «{book.title}».</p> : null}
        <button className="text-button" type="button" disabled={backupBusy} onClick={() => void importBackup('merge')}>دمج البيانات</button>
        <button className="study-remove" type="button" disabled={backupBusy} onClick={() => void importBackup('replace')}>استبدال البيانات</button>
        <button className="text-button" type="button" disabled={backupBusy} onClick={() => setPendingBackup(undefined)}>إلغاء</button>
      </div>}
    </section>
  </section>;
}
