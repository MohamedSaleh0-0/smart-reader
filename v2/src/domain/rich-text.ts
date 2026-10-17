const BLOCK_TAGS = new Set(['P', 'DIV', 'BLOCKQUOTE', 'PRE']);
const OMIT_TAGS = /^(SCRIPT|STYLE|META|LINK|TITLE|HEAD|IFRAME|OBJECT|EMBED|SVG|IMG|CANVAS|VIDEO|AUDIO|FORM|INPUT|BUTTON|SELECT|TEXTAREA)$/;

function safeColor(value: string): boolean {
  const color = value.trim();
  return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i.test(color)
    && !/^(inherit|initial|unset|transparent|windowtext|currentcolor)$/i.test(color);
}

function copyRichNode(source: Node, target: HTMLElement): void {
  source.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      target.appendChild(document.createTextNode(node.textContent ?? ''));
      return;
    }
    if (!(node instanceof Element) || OMIT_TAGS.test(node.tagName)) return;
    if (node.tagName === 'BR') {
      target.appendChild(document.createElement('br'));
      return;
    }

    let current = target;
    const tag = node.tagName;
    if (/^H[1-6]$/.test(tag)) {
      const paragraph = document.createElement('p');
      const bold = document.createElement('b');
      paragraph.appendChild(bold);
      target.appendChild(paragraph);
      current = bold;
    } else if (BLOCK_TAGS.has(tag)) {
      const block = document.createElement(tag.toLowerCase());
      target.appendChild(block);
      current = block;
    } else if (tag === 'UL' || tag === 'OL' || tag === 'LI') {
      const listItem = document.createElement(tag.toLowerCase());
      target.appendChild(listItem);
      current = listItem;
    } else if (tag === 'A' && /^(https?:|mailto:)/i.test(node.getAttribute('href') ?? '')) {
      const link = document.createElement('a');
      link.href = node.getAttribute('href') ?? '';
      link.target = '_blank';
      link.rel = 'noopener';
      target.appendChild(link);
      current = link;
    }

    const style = (node as HTMLElement).style;
    if (/^(B|STRONG)$/.test(tag) || /^(bold|bolder)$/.test(style.fontWeight) || Number(style.fontWeight) >= 600) {
      const bold = document.createElement('b'); current.appendChild(bold); current = bold;
    }
    if (/^(I|EM)$/.test(tag) || style.fontStyle === 'italic') {
      const italic = document.createElement('i'); current.appendChild(italic); current = italic;
    }
    if (tag === 'U' || /underline/.test(style.textDecorationLine || style.textDecoration || '')) {
      const underline = document.createElement('u'); current.appendChild(underline); current = underline;
    }
    if (/^(S|STRIKE|DEL)$/.test(tag) || /line-through/.test(style.textDecorationLine || style.textDecoration || '')) {
      const strike = document.createElement('s'); current.appendChild(strike); current = strike;
    }
    if (tag === 'SUB' || tag === 'SUP') {
      const script = document.createElement(tag.toLowerCase()); current.appendChild(script); current = script;
    }

    const color = style.color || node.getAttribute('color') || '';
    const background = style.backgroundColor || '';
    if ((color && safeColor(color)) || (background && safeColor(background)) || tag === 'MARK') {
      const span = document.createElement('span');
      if (color && safeColor(color)) span.style.color = color;
      if (background && safeColor(background)) span.style.backgroundColor = background;
      else if (tag === 'MARK') span.style.backgroundColor = '#ffe066';
      current.appendChild(span);
      current = span;
    }

    copyRichNode(node, current);
    if (tag === 'TD' || tag === 'TH') target.appendChild(document.createTextNode(' '));
  });
}

/** Sanitizes pasted or saved note markup to the formatting the study editor supports. */
export function sanitizeRichTextHtml(source: string): string {
  if (typeof DOMParser === 'undefined') return '';
  const parsed = new DOMParser().parseFromString(String(source || ''), 'text/html');
  const output = document.createElement('div');
  copyRichNode(parsed.body, output);
  return output.innerHTML.replace(/\u00a0/g, ' ').trim();
}

export function plainTextAsRichHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
    .replace(/\r?\n/g, '<br>');
}

export function richHtmlToPlainText(source: string): string {
  const safeHtml = sanitizeRichTextHtml(source);
  const holder = document.createElement('div');
  holder.innerHTML = safeHtml;
  return (holder.innerText || holder.textContent || '').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
