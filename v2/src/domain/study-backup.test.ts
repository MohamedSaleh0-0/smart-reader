import { describe, expect, it } from 'vitest';
import { defaultStudySettings, emptyStudyData } from './study';
import { createStudyBackup, keepStudyEntriesForPassages, mergeStudyData, parseStudyBackup } from './study-backup';
import type { StudyData } from './types';

const book = { id: 'book-1', title: 'كتاب القراءة', sourceName: 'source.md' };

describe('per-book study JSON backup', () => {
  it('round-trips a versioned backup and rejects unsupported or malformed files', () => {
    const study = { ...emptyStudyData(), tags: ['مراجعة'], settings: { ...defaultStudySettings, keepFootnotes: true } };
    const backup = createStudyBackup(book, study, new Date('2026-10-12T10:00:00.000Z'));

    expect(parseStudyBackup(JSON.parse(JSON.stringify(backup)))).toEqual(backup);
    expect(parseStudyBackup({ ...backup, version: 2 })).toBeUndefined();
    expect(parseStudyBackup({ ...backup, study: { ...study, highlights: [{}] } })).toBeUndefined();
    expect(parseStudyBackup({ ...backup, study: { ...study, reading: { days: { '2026-13-40': { device: 60 } } } } })).toBeUndefined();
  });

  it('merges unique study items, combines favorite tags, keeps the newest comment, and deduplicates reverse links', () => {
    const current: StudyData = {
      ...emptyStudyData(),
      favorites: [{ passageId: 'p1', createdAt: '2026-01-01', note: 'old note', tags: ['قديم'] }],
      comments: [{ id: 'c1', passageId: 'p1', text: 'old', updatedAt: '2026-01-01' }],
      links: [{ id: 'link-1', fromPassageId: 'p1', toPassageId: 'p2', createdAt: '2026-01-01' }],
      reading: { days: { '2026-10-12': { 'device-a': 90 } } },
    };
    const imported: StudyData = {
      ...emptyStudyData(),
      favorites: [{ passageId: 'p1', createdAt: '2026-01-01', note: 'updated note', tags: ['جديد'] }, { passageId: 'p3', createdAt: '2026-01-02' }],
      comments: [{ id: 'c2', passageId: 'p1', text: 'new', updatedAt: '2026-02-01' }],
      clips: [{ id: 'clip-1', passageId: 'p3', quote: 'اقتباس', createdAt: '2026-02-01' }],
      links: [
        { id: 'reverse', fromPassageId: 'p2', toPassageId: 'p1', createdAt: '2026-02-01' },
        { id: 'link-2', fromPassageId: 'p3', toPassageId: 'p4', createdAt: '2026-02-01' },
      ],
      settings: { ...defaultStudySettings, keepFootnotes: true },
      reading: { days: { '2026-10-12': { 'device-a': 120, 'device-b': 30 } } },
    };

    const merged = mergeStudyData(current, imported);
    expect(merged.favorites).toEqual([
      { passageId: 'p1', createdAt: '2026-01-01', note: 'updated note', tags: ['قديم', 'جديد'] },
      { passageId: 'p3', createdAt: '2026-01-02' },
    ]);
    expect(merged.comments).toEqual(imported.comments);
    expect(merged.clips).toEqual(imported.clips);
    expect(merged.links).toEqual([current.links[0], imported.links[1]]);
    expect(merged.settings.keepFootnotes).toBe(true);
    expect(merged.reading?.days['2026-10-12']).toEqual({ 'device-a': 120, 'device-b': 30 });
  });

  it('drops study items that point to passages missing from the current book', () => {
    const study: StudyData = {
      ...emptyStudyData(),
      highlights: [{ id: 'h1', passageId: 'missing', start: 0, end: 2, quote: 'نص', color: 'yellow', createdAt: 'today' }],
      favorites: [{ passageId: 'p1', createdAt: 'today' }, { passageId: 'missing', createdAt: 'today' }],
      comments: [{ passageId: 'missing', text: 'تعليق', updatedAt: 'today' }],
      clips: [{ id: 'c1', passageId: 'missing', quote: 'اقتباس', createdAt: 'today' }],
      notebook: [{ id: 'n1', passageId: 'missing', quote: 'اقتباس', text: 'ملاحظة', createdAt: 'today' }],
      links: [{ id: 'l1', fromPassageId: 'p1', toPassageId: 'missing', createdAt: 'today' }],
      pinnedPassageIds: ['missing'],
    };

    const result = keepStudyEntriesForPassages(study, new Set(['p1']));
    expect(result.dropped).toBe(7);
    expect(result.study.highlights).toEqual([]);
    expect(result.study.favorites).toEqual([study.favorites[0]]);
    expect(result.study.comments).toEqual([]);
    expect(result.study.clips).toEqual([]);
    expect(result.study.notebook).toEqual([]);
    expect(result.study.links).toEqual([]);
    expect(result.study.pinnedPassageIds).toEqual([]);
  });
});
