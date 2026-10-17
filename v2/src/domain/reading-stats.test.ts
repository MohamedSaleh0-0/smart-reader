import { describe, expect, it } from 'vitest';
import { emptyStudyData } from './study';
import { localReadingDateKey, mergeReadingStats, normalizeReadingStats, recordReadingTime, shouldCountReadingTick, summarizeReadingTime } from './reading-stats';

const today = new Date(2026, 9, 12, 12);

describe('reading-time statistics', () => {
  it('records positive whole seconds per local day and device', () => {
    const study = recordReadingTime(emptyStudyData(), 30.9, localReadingDateKey(today), 'device-a');
    const updated = recordReadingTime(study, 45, localReadingDateKey(today), 'device-a');
    expect(updated.reading?.days['2026-10-12']).toEqual({ 'device-a': 75 });
    expect(recordReadingTime(updated, 0, '2026-10-12', 'device-a')).toBe(updated);
  });

  it('counts time only while visible and after recent activity', () => {
    expect(shouldCountReadingTick(true, 10_000, 99_999)).toBe(true);
    expect(shouldCountReadingTick(true, 10_000, 100_000)).toBe(false);
    expect(shouldCountReadingTick(false, 99_000, 100_000)).toBe(false);
  });

  it('normalizes malformed day/device entries and merges backups without double-counting a device', () => {
    expect(normalizeReadingStats({ days: {
      '2026-10-12': { 'device-a': 61.8, 'device-b': -4 },
      invalid: { 'device-a': 90 },
      '2026-13-40': { 'device-a': 120 },
    } })).toEqual({ days: { '2026-10-12': { 'device-a': 61 } } });
    expect(mergeReadingStats(
      { days: { '2026-10-12': { 'device-a': 90 } } },
      { days: { '2026-10-12': { 'device-a': 120, 'device-b': 30 } } },
    )).toEqual({ days: { '2026-10-12': { 'device-a': 120, 'device-b': 30 } } });
  });

  it('summarizes the current book and library with one-minute reading days and streaks', () => {
    const book = {
      ...emptyStudyData(),
      reading: { days: {
        '2026-10-12': { a: 60 },
        '2026-10-11': { a: 60 },
        '2026-10-10': { a: 45 },
        '2026-10-09': { a: 120 },
      } },
    };
    const otherBook = { ...emptyStudyData(), reading: { days: {
      '2026-10-12': { b: 30 },
      '2026-10-10': { b: 60 },
    } } };
    const result = summarizeReadingTime(book, [book, otherBook], today);
    expect(result.bookToday).toBe(60);
    expect(result.bookWeek).toBe(285);
    expect(result.bookTotal).toBe(285);
    expect(result.activeDays).toBe(3);
    expect(result.libraryToday).toBe(90);
    expect(result.libraryWeek).toBe(375);
    expect(result.currentStreak).toBe(4);
    expect(result.bestStreak).toBe(4);
    expect(result.todayCountsAsRead).toBe(true);
    expect(result.recentDays).toHaveLength(14);
  });
});
