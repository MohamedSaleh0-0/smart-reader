import type { ReactNode, SVGProps } from 'react';

export type IconName = 'copy' | 'citation' | 'link' | 'bookmark' | 'comment' | 'collection' | 'notebook' | 'pin' | 'highlight' | 'eraser' | 'sun' | 'moon' | 'search' | 'edit' | 'trash' | 'book' | 'fold' | 'volume' | 'hadith' | 'close' | 'plus' | 'settings' | 'chart' | 'tag' | 'chevronLeft' | 'chevronRight' | 'chevronDown' | 'grip';

const paths: Record<IconName, ReactNode> = {
  copy: <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3"/></>,
  citation: <><path d="M7 4h10l3 3v13H7z"/><path d="M17 4v4h4M10 12h7M10 16h7"/><path d="M4 8v13h13"/></>,
  link: <><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></>,
  bookmark: <><path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.8L6 21z"/></>,
  comment: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z"/><path d="M7.5 11.5h.01M12.5 11.5h.01M17.5 11.5h.01"/></>,
  collection: <><path d="M4 7.5h16v12H4z"/><path d="M8 4.5h8M6 2.5h12M8 12h8M8 15.5h5"/></>,
  notebook: <><path d="M6 3.5h13v17H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z"/><path d="M8 3.5v17M12 8h4M12 12h4M12 16h3M2.5 7h3M2.5 12h3M2.5 17h3"/></>,
  pin: <><path d="m16 3 5 5-4 1-4 4-1 4-2-2-6 6 5-7-2-2 4-1 4-4z"/></>,
  highlight: <><path d="m14 4 6 6M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="M3 22h18"/></>,
  eraser: <><path d="m7 4 13 13-5 5H8L3 17a2.8 2.8 0 0 1 0-4z"/><path d="m11 8-8 8M13 22h8"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
  moon: <path d="M20.8 14.2A8.5 8.5 0 0 1 9.8 3.2 8.5 8.5 0 1 0 20.8 14.2Z"/>,
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
  edit: <><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5a2.1 2.1 0 0 0-3-3z"/><path d="m14.5 7 3 3"/></>,
  trash: <><path d="M4 7h16M10 11v6m4-6v6M5.5 7l1 14h11l1-14M9 7V4h6v3"/></>,
  book: <><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H12v17H5.5A2.5 2.5 0 0 0 3 22z"/><path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H12v17h6.5A2.5 2.5 0 0 1 21 22z"/></>,
  fold: <><path d="m7 9 5 5 5-5M7 15l5 5 5-5"/><path d="M12 3v5"/></>,
  volume: <><path d="M4 10v4h4l5 4V6l-5 4z"/><path d="M17 9a5 5 0 0 1 0 6M19.5 6.5a9 9 0 0 1 0 11"/></>,
  hadith: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5A2.5 2.5 0 0 1 20 22z"/><path d="M7 8h2M7 12h2m6-4h2m-2 4h2"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.2.9-1.2 2.1-1.4-.5a7.8 7.8 0 0 1-1.6.9l-.2 1.5h-2.4l-.3-1.5a7.8 7.8 0 0 1-1.6-.9l-1.4.5-1.2-2.1 1.2-.9a6.6 6.6 0 0 1 0-1.8l-1.2-.9 1.2-2.1 1.4.5a7.8 7.8 0 0 1 1.6-.9l.3-1.5h2.4l.2 1.5a7.8 7.8 0 0 1 1.6.9l1.4-.5 1.2 2.1-1.2.9a6.6 6.6 0 0 1 0 1.7Z"/></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V4h9l8.6 8.6a.6.6 0 0 1 0 .8Z"/><circle cx="7.5" cy="8" r="1"/></>,
  chevronLeft: <path d="m15 18-6-6 6-6"/>,
  chevronRight: <path d="m9 18 6-6-6-6"/>,
  chevronDown: <path d="m6 9 6 6 6-6"/>,
  grip: <><circle cx="8" cy="6" r="1"/><circle cx="16" cy="6" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="18" r="1"/><circle cx="16" cy="18" r="1"/></>,
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{paths[name]}</svg>;
}
