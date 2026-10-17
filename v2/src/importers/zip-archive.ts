type ZipEntry = { method: number; compressedSize: number; size: number; localOffset: number };
export type ZipArchive = { read: (path: string) => Promise<Uint8Array | undefined>; text: (path: string) => Promise<string | undefined> };

const MAX_ARCHIVE_SIZE = 200 * 1024 * 1024;
const MAX_ENTRY_SIZE = 48 * 1024 * 1024;
const MAX_TOTAL_SIZE = 160 * 1024 * 1024;
const MAX_ENTRIES = 4096;

function findEndOfCentralDirectory(view: DataView, formatName: string): number {
  const firstOffset = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let offset = view.byteLength - 22; offset >= firstOffset; offset -= 1) {
    if (view.getUint32(offset, true) !== 0x06054b50) continue;
    const commentLength = view.getUint16(offset + 20, true);
    if (offset + 22 + commentLength === view.byteLength) return offset;
  }
  throw new Error(`ملف ${formatName} ليس أرشيف ZIP صالحاً أو يستخدم امتداد ZIP غير مدعوم.`);
}

/** Read a bounded, unencrypted, non-ZIP64 archive without extracting paths to disk. */
export async function readZipArchive(buffer: ArrayBuffer, formatName = 'ZIP'): Promise<ZipArchive> {
  if (buffer.byteLength > MAX_ARCHIVE_SIZE) throw new Error(`حجم ملف ${formatName} أكبر من الحد المدعوم حالياً (٢٠٠ ميغابايت).`);
  const view = new DataView(buffer);
  const end = findEndOfCentralDirectory(view, formatName);
  if (view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0) throw new Error(`ملفات ${formatName} متعددة الأقراص غير مدعومة.`);
  const entriesOnDisk = view.getUint16(end + 8, true);
  const entryCount = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (entriesOnDisk !== entryCount || entryCount > MAX_ENTRIES || entryCount === 0xffff || directoryOffset === 0xffffffff || directorySize === 0xffffffff) {
    throw new Error(`بنية ${formatName} أكبر من حدود القراءة الآمنة أو تستخدم ZIP64.`);
  }
  if (directoryOffset + directorySize > end) throw new Error(`فهرس ${formatName} غير صالح.`);

  const decoder = new TextDecoder('utf-8');
  const entries = new Map<string, ZipEntry>();
  let cursor = directoryOffset;
  let totalSize = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) throw new Error(`تعذر قراءة فهرس ${formatName}.`);
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const diskStart = view.getUint16(cursor + 34, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > end || diskStart !== 0 || (flags & 1) !== 0) throw new Error(`يحتوي ${formatName} على مدخل مشفر أو موزع على عدة أقراص.`);
    if (![0, 8].includes(method)) throw new Error(`طريقة الضغط في ${formatName} غير مدعومة.`);
    if (size === 0xffffffff || compressedSize === 0xffffffff || localOffset === 0xffffffff) throw new Error(`ملفات ${formatName} بصيغة ZIP64 غير مدعومة حالياً.`);
    if (size > MAX_ENTRY_SIZE) throw new Error(`يحتوي ${formatName} على عنصر أكبر من الحد الآمن للقراءة.`);
    totalSize += size;
    if (totalSize > MAX_TOTAL_SIZE) throw new Error(`الحجم الإجمالي لمحتويات ${formatName} أكبر من الحد الآمن للقراءة.`);
    const name = decoder.decode(new Uint8Array(buffer, cursor + 46, nameLength)).replaceAll('\\', '/');
    if (name && !name.endsWith('/')) entries.set(name, { method, compressedSize, size, localOffset });
    cursor = next;
  }

  async function read(path: string): Promise<Uint8Array | undefined> {
    const entry = entries.get(path);
    if (!entry) return undefined;
    const offset = entry.localOffset;
    if (offset + 30 > buffer.byteLength || view.getUint32(offset, true) !== 0x04034b50) throw new Error(`عنصر ${formatName} تالف: ${path}`);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const start = offset + 30 + nameLength + extraLength;
    const finish = start + entry.compressedSize;
    if (finish > buffer.byteLength) throw new Error(`بيانات ${formatName} غير مكتملة: ${path}`);
    const compressed = new Uint8Array(buffer, start, entry.compressedSize);
    if (entry.method === 0) {
      if (compressed.byteLength !== entry.size) throw new Error(`حجم عنصر ${formatName} غير مطابق: ${path}`);
      return compressed.slice();
    }
    if (typeof DecompressionStream === 'undefined') throw new Error(`هذا المتصفح لا يدعم فك ضغط ملفات ${formatName}.`);
    let decompressor: DecompressionStream;
    try { decompressor = new DecompressionStream('deflate-raw'); }
    catch { throw new Error(`هذا المتصفح لا يدعم نوع الضغط المستخدم في ${formatName}.`); }
    const reader = new Blob([compressed]).stream().pipeThrough(decompressor).getReader();
    const chunks: Uint8Array[] = [];
    let outputSize = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        outputSize += value.byteLength;
        if (outputSize > entry.size || outputSize > MAX_ENTRY_SIZE) {
          await reader.cancel();
          throw new Error(`تجاوز فك الضغط الحجم المعلن لعنصر ${formatName}: ${path}`);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    if (outputSize !== entry.size) throw new Error(`حجم عنصر ${formatName} غير مكتمل: ${path}`);
    const result = new Uint8Array(outputSize);
    let position = 0;
    for (const chunk of chunks) { result.set(chunk, position); position += chunk.byteLength; }
    return result;
  }

  return { read, text: async (path) => { const bytes = await read(path); return bytes ? new TextDecoder().decode(bytes) : undefined; } };
}
