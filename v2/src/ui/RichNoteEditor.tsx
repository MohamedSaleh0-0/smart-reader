import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { plainTextAsRichHtml, sanitizeRichTextHtml } from '../domain/rich-text';

type RichNoteEditorProps = {
  value: string;
  htmlValue?: string;
  label: string;
  placeholder: string;
  resetKey: string;
  onChange: (text: string, html: string | undefined) => void;
};

function insertAtSelection(editor: HTMLDivElement, value: string, asHtml: boolean): void {
  const selection = window.getSelection();
  let range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
  if (!range || !editor.contains(range.commonAncestorContainer)) {
    range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
  }
  range.deleteContents();
  let inserted: Node;
  if (asHtml) {
    const template = document.createElement('template');
    template.innerHTML = sanitizeRichTextHtml(value);
    inserted = template.content;
  } else inserted = document.createTextNode(value);
  range.insertNode(inserted);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

export function RichNoteEditor({ value, htmlValue, label, placeholder, resetKey, onChange }: RichNoteEditorProps) {
  const [richEnabled, setRichEnabled] = useState(false);
  const richEditor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!richEnabled || !richEditor.current) return;
    richEditor.current.innerHTML = sanitizeRichTextHtml(htmlValue || plainTextAsRichHtml(value));
  }, [richEnabled, resetKey]);

  function syncRichDraft() {
    const editor = richEditor.current;
    if (!editor) return;
    const html = sanitizeRichTextHtml(editor.innerHTML);
    const text = (editor.innerText || editor.textContent || '').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    onChange(text, html || undefined);
  }

  function pasteRichContent(event: ClipboardEvent<HTMLDivElement>) {
    const clipboard = event.clipboardData;
    if (!clipboard) return;
    const html = clipboard.getData('text/html');
    const text = clipboard.getData('text/plain');
    if (!html && !text) return;
    event.preventDefault();
    const safeHtml = html ? sanitizeRichTextHtml(html) : '';
    insertAtSelection(event.currentTarget, safeHtml || text, Boolean(safeHtml));
  }

  return <div className="study-note-input">
    <div className="study-note-tools">
      <button className={`text-button${richEnabled ? ' is-active' : ''}`} type="button" aria-pressed={richEnabled} onClick={() => setRichEnabled((enabled) => !enabled)}>
        {richEnabled ? 'إيقاف تنسيق اللصق' : 'تفعيل اللصق بتنسيقه الأصلي'}
      </button>
      <span>عريض، مائل، ألوان وقوائم</span>
    </div>
    {richEnabled
      ? <div ref={richEditor} className="study-note-rich" contentEditable suppressContentEditableWarning dir="rtl" role="textbox" aria-multiline="true" aria-label={label} data-placeholder={placeholder} onInput={syncRichDraft} onPaste={pasteRichContent} />
      : <textarea className="study-note-textarea" value={value} onChange={(event) => onChange(event.currentTarget.value, undefined)} placeholder={placeholder} aria-label={label} />}
  </div>;
}
