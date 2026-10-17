export function joinPassageParts(parts: readonly string[]): string {
  return parts.map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');
}

export function passagePartOffset(parts: readonly string[], partIndex: number, localOffset: number): number | undefined {
  if (!Number.isInteger(partIndex) || partIndex < 0 || partIndex >= parts.length || localOffset < 0 || localOffset > parts[partIndex].length) return undefined;
  let offset = localOffset;
  for (let index = 0; index < partIndex; index += 1) offset += parts[index].length + 1;
  return offset;
}
