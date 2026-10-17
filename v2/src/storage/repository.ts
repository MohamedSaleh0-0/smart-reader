import type { BookRecord, LibraryFolder } from '../domain/types';
import { emptyPassageLinkWorkspace, normalizePassageLinkWorkspace } from '../domain/passage-links';
import type { PassageLinkWorkspace } from '../domain/types';

const databaseName = 'smart-reader-v2';
const databaseVersion = 6;

function toArabicDigits(value: string): string {
  return value.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
}

function addMissingPageAttributes(html: string, pageKind: BookRecord['pageNumberKind']): string {
  return html.replace(/<section\b[^>]*\bdata-source-page="(\d+)"[^>]*>/g, (tag, page: string) => {
    let updated = tag;
    if (!/\bdata-reader-page=/.test(updated)) updated = updated.replace(/>$/, ` data-reader-page="${page}">`);
    if (!/\bdata-page-label=/.test(updated)) updated = updated.replace(/>$/, ` data-page-label="${toArabicDigits(page)}">`);
    if (!/\bdata-page-kind=/.test(updated)) updated = updated.replace(/>$/, ` data-page-kind="${pageKind}">`);
    return updated;
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = (event) => {
      const database = request.result;
      if (!database.objectStoreNames.contains('books')) database.createObjectStore('books', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('linkWorkspaces')) database.createObjectStore('linkWorkspaces', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('libraryFolders')) database.createObjectStore('libraryFolders', { keyPath: 'id' });

      if (event.oldVersion < 4) {
        const books = request.transaction!.objectStore('books');
        const cursorRequest = books.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const book = cursor.value as BookRecord;
          const fallbackPages = Array.from({ length: book.sourcePageCount || 1 }, (_unused, index) => index + 1);
          const pageNumberKind = book.pageNumberKind ?? (book.sourcePageCount > 1 ? 'source' : 'virtual');
          const sourcePages = pageNumberKind === 'source'
            ? (book.sourcePages?.length ? book.sourcePages : fallbackPages)
            : [];
          const readerPages = book.readerPages?.length ? book.readerPages : (book.sourcePages?.length ? book.sourcePages : fallbackPages);
          const html = typeof book.html === 'string' ? addMissingPageAttributes(book.html, pageNumberKind) : book.html;
          cursor.update({
            ...book,
            ...(event.oldVersion < 2 ? { footnotes: book.footnotes ?? [], warnings: book.warnings ?? [] } : {}),
            sourcePages,
            readerPages,
            sourcePageCount: pageNumberKind === 'source' ? (book.sourcePageCount || sourcePages.length) : 0,
            readerPageCount: book.readerPageCount ?? readerPages.length,
            pageNumberKind,
            html,
          });
          cursor.continue();
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local library storage.'));
  });
}

export async function getPassageLinkWorkspace(): Promise<PassageLinkWorkspace> {
  const database = await openDatabase();
  try {
    const saved = await requestResult(database.transaction('linkWorkspaces').objectStore('linkWorkspaces').get('library-links')) as PassageLinkWorkspace | undefined;
    return saved ? normalizePassageLinkWorkspace(saved) : emptyPassageLinkWorkspace();
  } finally {
    database.close();
  }
}

export async function savePassageLinkWorkspace(workspace: PassageLinkWorkspace): Promise<void> {
  const database = await openDatabase();
  try {
    await requestResult(database.transaction('linkWorkspaces', 'readwrite').objectStore('linkWorkspaces').put(normalizePassageLinkWorkspace(workspace)));
  } finally {
    database.close();
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local library operation failed.'));
  });
}

export async function saveBook(book: BookRecord): Promise<void> {
  const database = await openDatabase();
  try {
    await requestResult(database.transaction('books', 'readwrite').objectStore('books').put(book));
  } finally {
    database.close();
  }
}

export async function getBooks(): Promise<BookRecord[]> {
  const database = await openDatabase();
  try {
    return await requestResult(database.transaction('books').objectStore('books').getAll());
  } finally {
    database.close();
  }
}

export async function getLibraryFolders(): Promise<LibraryFolder[]> {
  const database = await openDatabase();
  try {
    return await requestResult(database.transaction('libraryFolders').objectStore('libraryFolders').getAll());
  } finally {
    database.close();
  }
}

export async function saveLibraryFolder(folder: LibraryFolder): Promise<void> {
  const database = await openDatabase();
  try {
    await requestResult(database.transaction('libraryFolders', 'readwrite').objectStore('libraryFolders').put(folder));
  } finally {
    database.close();
  }
}

/** Remove a folder, unfile its books, and attach child folders to its parent. */
export async function deleteLibraryFolder(folderId: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(['books', 'libraryFolders'], 'readwrite');
    const folders = transaction.objectStore('libraryFolders');
    const folderRequest = folders.get(folderId);
    folderRequest.onsuccess = () => {
      const parentId = (folderRequest.result as LibraryFolder | undefined)?.parentId;
      const childFolders = folders.openCursor();
      childFolders.onsuccess = () => {
        const cursor = childFolders.result;
        if (!cursor) return;
        const folder = cursor.value as LibraryFolder;
        if (folder.parentId === folderId) cursor.update({ ...folder, parentId });
        cursor.continue();
      };
      const books = transaction.objectStore('books').openCursor();
      books.onsuccess = () => {
        const cursor = books.result;
        if (!cursor) return;
        const book = cursor.value as BookRecord;
        if (book.folderId === folderId) cursor.update({ ...book, folderId: undefined });
        cursor.continue();
      };
      folders.delete(folderId);
    };
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not remove the library folder.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Library folder removal was cancelled.'));
    });
  } finally {
    database.close();
  }
}

