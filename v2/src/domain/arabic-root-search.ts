import { normalizeArabicSearch } from './search';

const PREFIXES = ['وبال', 'وكال', 'ولل', 'وال', 'فال', 'بال', 'كال', 'لل', 'ال', 'وب', 'وك', 'ول', 'فب', 'فل', 'وس', 'فس', 'و', 'ف', 'ب', 'ك', 'ل', 'س'];
const SECONDARY_PREFIXES = ['بال', 'كال', 'لل', 'ال', 'ب', 'ل', 'ك', 'س'];
const SUFFIXES = ['كما', 'هما', 'تما', 'هم', 'هن', 'كم', 'كن', 'نا', 'ني', 'ها', 'ون', 'ين', 'ان', 'ات', 'تم', 'تن', 'وا', 'ما', 'ه', 'ك', 'ي', 'ا', 'ت', 'ن', 'م', 'ء'];
const DERIVATION_PREFIXES = 'متنس';
const WEAK_LETTERS = /[اويءئؤى]/g;
const TOKEN = /[ء-ي٠-٩a-z0-9]+/g;

/** Approximate Arabic stem variants using the same light affix rules as the original reader. */
export function arabicRootVariants(word: string): string[] {
  const normalized = normalizeArabicSearch(word);
  if (!normalized) return [];

  const variants = new Set([normalized]);
  for (const prefix of PREFIXES) {
    if (normalized.startsWith(prefix) && normalized.length - prefix.length >= 3) {
      variants.add(normalized.slice(prefix.length));
    }
  }

  for (const variant of [...variants]) {
    for (const prefix of SECONDARY_PREFIXES) {
      if (variant.startsWith(prefix) && variant.length - prefix.length >= 3) {
        variants.add(variant.slice(prefix.length));
      }
    }
  }

  const suffixedVariants = new Set(variants);
  for (const variant of variants) {
    for (const suffix of SUFFIXES) {
      if (!variant.endsWith(suffix) || variant.length - suffix.length < 3) continue;
      const stem = variant.slice(0, -suffix.length);
      suffixedVariants.add(stem);
      for (const secondarySuffix of SUFFIXES) {
        if (stem.endsWith(secondarySuffix) && stem.length - secondarySuffix.length >= 3) {
          suffixedVariants.add(stem.slice(0, -secondarySuffix.length));
        }
      }
    }
  }

  const roots = new Set<string>();
  for (const variant of suffixedVariants) {
    const stem = variant.replace(WEAK_LETTERS, '');
    addStemVariants(stem, variant.length, roots);
  }
  return [...roots];
}

function addStemVariants(stem: string, originalLength: number, roots: Set<string>) {
  if (stem.length < 2) return;
  if (stem.length <= 4) roots.add(stem);
  if (stem.length === 3 && originalLength > 3 && DERIVATION_PREFIXES.includes(stem[0])) roots.add(stem.slice(1));
  if (stem.length === 4) {
    if (DERIVATION_PREFIXES.includes(stem[0])) roots.add(stem.slice(1));
    if (stem[1] === 'ت' || stem[1] === 'ن') roots.add(stem[0] + stem.slice(2));
  }
  if (stem.length === 5) {
    if (stem.startsWith('ست')) roots.add(stem.slice(2));
    if (DERIVATION_PREFIXES.includes(stem[0])) {
      const reduced = stem.slice(1);
      roots.add(reduced);
      if (reduced[1] === 'ت' || reduced[1] === 'ن') roots.add(reduced[0] + reduced.slice(2));
    }
    if (stem[1] === 'ت') roots.add(stem[0] + stem.slice(2));
  }
}

/** Match all query words literally, or by approximate roots when the user enables root search. */
export function matchesArabicSearch(text: string, query: string, useRoots = false): boolean {
  const normalizedText = normalizeArabicSearch(text);
  const normalizedQuery = normalizeArabicSearch(query);
  if (!normalizedQuery) return false;
  if (normalizedText.includes(normalizedQuery)) return true;
  if (!useRoots) return false;

  const queryWords = tokenize(normalizedQuery);
  const textWords = tokenize(normalizedText);
  if (!queryWords.length || !textWords.length) return false;
  return queryWords.every((queryWord) => {
    if (queryWord.length < 3) return textWords.some((textWord) => textWord.includes(queryWord));
    const queryRoots = new Set(arabicRootVariants(queryWord));
    return queryRoots.size > 0 && textWords.some((textWord) => {
      if (textWord === queryWord) return true;
      return arabicRootVariants(textWord).some((root) => queryRoots.has(root));
    });
  });
}

function tokenize(value: string): string[] {
  TOKEN.lastIndex = 0;
  return [...value.matchAll(TOKEN)].map((match) => match[0]);
}
