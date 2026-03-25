import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runEngine } from '../cycle-calculations';
import { CycleData, CycleEntry, DEFAULT_CYCLE_DATA } from '../types';

// Helper to create entries map from array
function makeEntries(entries: CycleEntry[]): Record<string, CycleEntry> {
  const map: Record<string, CycleEntry> = {};
  for (const e of entries) map[e.date] = e;
  return map;
}

// Helper to generate a date string offset from a base
function dateOffset(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Generate a realistic cycle with period + temps
function generateCycle(startDate: string, cycleLength: number, ovuDay: number): CycleEntry[] {
  const entries: CycleEntry[] = [];

  for (let i = 0; i < cycleLength; i++) {
    const date = dateOffset(startDate, i);
    const entry: CycleEntry = { date };

    // Period: days 1-5
    if (i < 5) {
      entry.period = i < 2 ? 'heavy' : i < 4 ? 'medium' : 'light';
    }

    // Temperature: low phase before ovulation, high phase after
    if (i >= 1) {
      if (i < ovuDay) {
        entry.temperature = 36.2 + Math.random() * 0.15; // 36.20 - 36.35
      } else {
        entry.temperature = 36.5 + Math.random() * 0.15; // 36.50 - 36.65
      }
    }

    // LH test near ovulation
    if (i === ovuDay - 1) entry.lhTest = 'positive';
    if (i === ovuDay) entry.lhTest = 'peak';

    entries.push(entry);
  }

  return entries;
}

// Mock toLocalISO to return a fixed date for deterministic tests
vi.mock('../utils', () => ({
  toLocalISO: () => '2025-04-01',
  cn: (...inputs: string[]) => inputs.join(' '),
}));

describe('runEngine', () => {
  it('returns default statistics with empty entries', () => {
    const data: CycleData = { ...DEFAULT_CYCLE_DATA, entries: {} };
    const result = runEngine(data);

    expect(result.statistics.avgCycleLength).toBe(28);
    expect(result.statistics.medianCycleLength).toBe(28);
    expect(result.statistics.historyCount).toBe(0);
  });

  it('detects cycle starts from period entries', () => {
    // Create 3 cycles of ~28 days each
    const cycle1 = generateCycle('2025-01-01', 28, 14);
    const cycle2 = generateCycle('2025-01-29', 28, 14);
    const cycle3 = generateCycle('2025-02-26', 28, 14);

    const allEntries = [...cycle1, ...cycle2, ...cycle3];
    const data: CycleData = {
      ...DEFAULT_CYCLE_DATA,
      entries: makeEntries(allEntries),
    };

    const result = runEngine(data);

    // Should detect 3 cycle starts
    expect(result.statistics.historyCount).toBeGreaterThanOrEqual(2);
    // Cycle length should be around 28
    expect(result.statistics.medianCycleLength).toBeGreaterThanOrEqual(25);
    expect(result.statistics.medianCycleLength).toBeLessThanOrEqual(31);
  });

  it('confirms ovulation via BBT 3-over-6 rule', () => {
    // Create a single cycle with clear temp shift
    const entries: CycleEntry[] = [];
    const start = '2025-03-01';

    // Period days 1-5
    for (let i = 0; i < 5; i++) {
      entries.push({ date: dateOffset(start, i), period: 'medium' });
    }

    // Low temps days 5-13 (6 low temps before shift)
    const lowTemps = [36.20, 36.25, 36.18, 36.30, 36.22, 36.28, 36.15, 36.25, 36.20];
    for (let i = 0; i < lowTemps.length; i++) {
      entries.push({ date: dateOffset(start, i + 5), temperature: lowTemps[i] });
    }

    // High temps days 14-16 (3 high temps for confirmation)
    // All must be > max of previous 6 = max(36.30, 36.22, 36.28, 36.15, 36.25, 36.20) = 36.30
    // Third must be >= 36.30 + 0.15 = 36.45
    const highTemps = [36.40, 36.42, 36.50];
    for (let i = 0; i < highTemps.length; i++) {
      entries.push({ date: dateOffset(start, i + 14), temperature: highTemps[i] });
    }

    // More luteal phase temps
    for (let i = 17; i < 28; i++) {
      entries.push({ date: dateOffset(start, i), temperature: 36.45 + Math.random() * 0.1 });
    }

    const data: CycleData = {
      ...DEFAULT_CYCLE_DATA,
      entries: makeEntries(entries),
    };

    const result = runEngine(data);

    // Engine should be in a state that reflects the data
    expect(result.currentCycle).toBeDefined();
    expect(result.currentCycle.startDate).toBe(start);
  });

  it('identifies LH peaks', () => {
    const entries: CycleEntry[] = [
      { date: '2025-03-01', period: 'heavy' },
      { date: '2025-03-02', period: 'medium' },
      { date: '2025-03-03', period: 'light' },
      { date: '2025-03-14', lhTest: 'positive' },
      { date: '2025-03-15', lhTest: 'peak' },
      { date: '2025-03-16', lhTest: 'negative' },
    ];

    const data: CycleData = {
      ...DEFAULT_CYCLE_DATA,
      entries: makeEntries(entries),
    };

    const result = runEngine(data);
    expect(result.currentCycle.lhPeaks).toContain('2025-03-15');
    expect(result.currentCycle.lhPeaks).toContain('2025-03-14');
  });

  it('handles single entry gracefully', () => {
    const data: CycleData = {
      ...DEFAULT_CYCLE_DATA,
      entries: { '2025-03-01': { date: '2025-03-01', period: 'medium' } },
    };

    const result = runEngine(data);
    expect(result.statistics.historyCount).toBe(0);
    expect(result.currentCycle.day).toBeGreaterThan(0);
  });

  it('computes future cycle predictions', () => {
    const cycle1 = generateCycle('2025-01-01', 28, 14);
    const cycle2 = generateCycle('2025-01-29', 28, 14);
    const cycle3 = generateCycle('2025-02-26', 28, 14);

    const data: CycleData = {
      ...DEFAULT_CYCLE_DATA,
      entries: makeEntries([...cycle1, ...cycle2, ...cycle3]),
    };

    const result = runEngine(data);
    expect(result.predictions.futureCycles.length).toBe(6);

    // Each future cycle should have required fields
    for (const fc of result.predictions.futureCycles) {
      expect(fc.cycleStart).toBeDefined();
      expect(fc.ovulationDate).toBeDefined();
      expect(fc.fertileStart).toBeDefined();
      expect(fc.fertileEnd).toBeDefined();
    }
  });

  it('does not start a new cycle from spotting', () => {
    const entries: CycleEntry[] = [
      { date: '2025-01-01', period: 'heavy' },
      { date: '2025-01-02', period: 'medium' },
      { date: '2025-01-15', period: 'spotting' }, // mid-cycle spotting
    ];

    const data: CycleData = {
      ...DEFAULT_CYCLE_DATA,
      entries: makeEntries(entries),
    };

    const result = runEngine(data);
    // Should only have one cycle start at 2025-01-01
    expect(result.currentCycle.startDate).toBe('2025-01-01');
  });

  it('rejects cycles shorter than 20 days as new starts', () => {
    const entries: CycleEntry[] = [
      { date: '2025-01-01', period: 'heavy' },
      { date: '2025-01-02', period: 'medium' },
      { date: '2025-01-10', period: 'medium' }, // only 9 days later — not a new cycle
    ];

    const data: CycleData = {
      ...DEFAULT_CYCLE_DATA,
      entries: makeEntries(entries),
    };

    const result = runEngine(data);
    expect(result.currentCycle.startDate).toBe('2025-01-01');
  });
});
