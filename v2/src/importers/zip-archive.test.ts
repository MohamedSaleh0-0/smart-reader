import { describe, expect, it } from 'vitest';
import { readZipArchive } from './zip-archive';

function storedZip(entries: { name: string; text: string }[]): ArrayBuffer {
  const encoder = new TextEncoder();
  const localRecords: Uint8Array[] = [];
  const centralRecords: Uint8Array[] = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const contents = encoder.encode(entry.text);
    const local = new Uint8Array(30 + name.length + contents.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(18, contents.length, true);
    localView.setUint32(22, contents.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(contents, 30 + name.length);
    localRecords.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(20, contents.length, true);
    centralView.setUint32(24, contents.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);
    centralRecords.push(central);
    localOffset += local.length;
  }

  const centralSize = centralRecords.reduce((sum, record) => sum + record.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);
  const chunks = [...localRecords, ...centralRecords, end];
  const archive = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { archive.set(chunk, offset); offset += chunk.length; }
  return archive.buffer;
}

describe('shared ZIP archive reader', () => {
  it('reads stored entries by path and decodes their UTF-8 text', async () => {
    const archive = await readZipArchive(storedZip([
      { name: 'META-INF/container.xml', text: '<container>كتاب</container>' },
      { name: 'Text/chapter.xhtml', text: '<p>مرحبا</p>' },
    ]));

    expect(await archive.text('META-INF/container.xml')).toBe('<container>كتاب</container>');
    expect(await archive.text('Text/chapter.xhtml')).toBe('<p>مرحبا</p>');
    expect(await archive.text('missing.xhtml')).toBeUndefined();
  });

  it('rejects a file without a valid ZIP directory', async () => {
    await expect(readZipArchive(new ArrayBuffer(0))).rejects.toThrow('أرشيف ZIP صالحاً');
  });
});
