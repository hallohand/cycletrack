import { describe, it, expect } from 'vitest';
import { groupCycles, CycleGroup } from '../history-utils';
import { CycleEntry } from '../types';

function makeEntries(entries: CycleEntry[]): Record<string, CycleEntry> {
  const map: Record<string, CycleEntry> = {};
  for (const e of entries) map[e.date] = e;
  return map;
}

function dateOffset(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

describe('groupCycles', () => {
  it('returns empty array for empty entries', () => {
    expect(groupCycles({})).toEqual([]);
  });

  it('groups a single cycle', () => {
    const entries: CycleEntry[] = [
      { date: '2025-01-01', period: 'heavy' },
      { date: '2025-01-02', period: 'medium' },
      { date: '2025-01-03', period: 'light' },
    ];

    const cycles = groupCycles(makeEntries(entries));
    expect(cycles).toHaveLength(1);
    expect(cycles[0].startDate).toBe('2025-01-01');
    expect(cycles[0].periodLength).toBe(3);
  });

  it('groups multiple cycles correctly', () => {
    const entries: CycleEntry[] = [];

    // Cycle 1: Jan 1-5 period
    for (let i = 0; i < 5; i++) {
      entries.push({ date: dateOffset('2025-01-01', i), period: i < 3 ? 'heavy' : 'medium' });
    }

    // Cycle 2: Jan 29 (28 days later) - Feb 2 period
    for (let i = 0; i < 5; i++) {
      entries.push({ date: dateOffset('2025-01-29', i), period: i < 3 ? 'heavy' : 'medium' });
    }

    const cycles = groupCycles(makeEntries(entries));
    expect(cycles).toHaveLength(2);

    // Cycles are returned reversed (newest first)
    expect(cycles[1].startDate).toBe('2025-01-01');
    expect(cycles[0].startDate).toBe('2025-01-29');
  });

  it('does not start a new cycle from spotting', () => {
    const entries: CycleEntry[] = [
      { date: '2025-01-01', period: 'heavy' },
      { date: '2025-01-02', period: 'medium' },
      // 25 days later, spotting should NOT start a new cycle
      { date: '2025-01-26', period: 'spotting' },
    ];

    const cycles = groupCycles(makeEntries(entries));
    expect(cycles).toHaveLength(1);
  });

  it('marks fertile window and ovulation in cycle days', () => {
    const entries: CycleEntry[] = [];

    // Cycle 1
    for (let i = 0; i < 5; i++) {
      entries.push({ date: dateOffset('2025-01-01', i), period: 'medium' });
    }
    // LH peak on day 14
    entries.push({ date: dateOffset('2025-01-01', 13), lhTest: 'peak' });

    // Cycle 2 starts 28 days later
    for (let i = 0; i < 5; i++) {
      entries.push({ date: dateOffset('2025-01-29', i), period: 'medium' });
    }

    const cycles = groupCycles(makeEntries(entries));
    // Find cycle 1 (it's reversed, so index 1)
    const cycle1 = cycles.find(c => c.startDate === '2025-01-01');
    expect(cycle1).toBeDefined();

    // Should have ovulation and fertile days marked
    const ovuDays = cycle1!.days.filter(d => d.isOvulation);
    expect(ovuDays.length).toBeGreaterThan(0);

    const fertileDays = cycle1!.days.filter(d => d.isFertile);
    expect(fertileDays.length).toBeGreaterThan(0);
  });

  it('calculates cycle length correctly', () => {
    const entries: CycleEntry[] = [];

    // Cycle 1: starts Jan 1
    for (let i = 0; i < 5; i++) {
      entries.push({ date: dateOffset('2025-01-01', i), period: 'medium' });
    }

    // Cycle 2: starts Jan 30 (29 days later)
    for (let i = 0; i < 5; i++) {
      entries.push({ date: dateOffset('2025-01-30', i), period: 'medium' });
    }

    const cycles = groupCycles(makeEntries(entries));
    const cycle1 = cycles.find(c => c.startDate === '2025-01-01');
    expect(cycle1).toBeDefined();
    expect(cycle1!.length).toBe(29);
  });
});
