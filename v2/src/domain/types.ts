export type Passage = {
  id: string;
  text: string;
  readerPageNumber: number;
  readerPageEndNumber?: number;
  sourcePageNumber?: number;
  sourcePageEndNumber?: number;
  headingContext?: string;
  footnoteIds?: string[];
};

export type Footnote = {
  id: string;
  text: string;
  definitionReaderPage: number;
  sourcePageNumber?: number;
  referencedBy: { passageId: string; readerPageNumber: number; sourcePageNumber?: number }[];
};

export type StudyHighlight = {
  id: string;
  passageId: string;
  start: number;
  end: number;
  quote: string;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'orange' | 'purple';
  categoryId?: string;
  createdAt: string;
};

export type StudyCategory = {
  id: string;
  name: string;
  /** Legacy display hue from early v2 records; it is not an automatic highlight-color link. */
  color?: StudyHighlight['color'];
  highlightColor?: StudyHighlight['color'];
};

export type StudyFavorite = {
  passageId: string;
  createdAt: string;
  label?: string;
  note?: string;
  tags?: string[];
};

export type StudyComment = {
  id?: string;
  passageId: string;
  start?: number;
  end?: number;
  quote?: string;
  text: string;
  html?: string;
  updatedAt: string;
};

export type StudyNotebookEntry = {
  id: string;
  passageId: string;
  highlightId?: string;
  quote: string;
  text: string;
  html?: string;
  createdAt: string;
};

export type StudyClip = {
  id: string;
  passageId: string;
  quote: string;
  footnoteIds?: string[];
  createdAt: string;
};

export type StudySettings = {
  citationTemplate: string;
  includeAuthor: boolean;
  keepFootnotes: boolean;
  collectionSeparator: 'blank' | 'line' | 'stars';
  restartWordNumberingPerChapter: boolean;
  notebookOrder: 'date' | 'page';
};

export type StudyReadingStats = {
  /** Local calendar day → seconds recorded by each browser/device id. */
  days: Record<string, Record<string, number>>;
  /** Most recent flush of active reading time, used for precise last-read shelf ordering. */
  lastReadAt?: string;
};

export type StudyData = {
  highlights: StudyHighlight[];
  favorites: StudyFavorite[];
  comments: StudyComment[];
  clips: StudyClip[];
  notebook: StudyNotebookEntry[];
  categories: StudyCategory[];
  tags: string[];
  links: { id: string; fromPassageId: string; toPassageId: string; createdAt: string }[];
  pinnedPassageIds: string[];
  reading?: StudyReadingStats;
  settings: StudySettings;
};

export type PassageLinkMember = {
  bookId: string;
  bookTitle: string;
  passageId: string;
  pageNumber: number;
  pageNumberKind: 'source' | 'virtual';
  quote: string;
};

export type PassageLinkTrayItem = PassageLinkMember & {
  id: string;
  addedAt: string;
};

export type PassageLinkGroup = {
  id: string;
  name: string;
  createdAt: string;
  members: PassageLinkMember[];
};

export type PassageLinkWorkspace = {
  id: 'library-links';
  trayItems: PassageLinkTrayItem[];
  groups: PassageLinkGroup[];
};

export type LibraryFolder = {
  id: string;
  name: string;
  parentId?: string;
  createdAt: string;
};

export type BookRecord = {
  id: string;
  title: string;
  author?: string;
  aliases?: string[];
  language: string;
  html: string;
  headings: { id: string; level: number; title: string; readerPageNumber: number; sourcePageNumber?: number }[];
  passages: Passage[];
  footnotes: Footnote[];
  sourcePages: number[];
  readerPages: number[];
  sourcePageCount: number;
  readerPageCount: number;
  pageNumberKind: 'source' | 'virtual';
  importedAt: string;
  lastReaderPage?: number;
  /** Book-level shelf labels, kept separate from passage-study tags. */
  shelfTags?: string[];
  /** Optional library folder; missing means the book is unfiled. */
  folderId?: string;
  sourceName: string;
  warnings: string[];
  study?: StudyData;
};
