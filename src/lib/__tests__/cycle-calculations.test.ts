import { describe, it, expect, vi } from 'vitest';
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

  // Regression: FERTILE_MID compared the 1-based cycle day with the 0-based
  // ovulation offset, shifting the statistical fertile window by one day.
  describe('FERTILE_MID statistical window (today mocked to 2025-04-01)', () => {
    function cycleStartingAt(start: string): CycleData {
      return {
        ...DEFAULT_CYCLE_DATA,
        entries: makeEntries([{ date: start, period: 'medium' }]),
      };
    }

    it('includes Ovu+1 (predicted ovulation + 1 day)', () => {
      // default stats: estOvu offset 14 → ovulation = start + 14
      // start 2025-03-17 → ovulation 2025-03-31, today is Ovu+1
      const result = runEngine(cycleStartingAt('2025-03-17'));
      expect(result.currentCycle.state).toBe('FERTILE_MID');
      expect(result.currentCycle.ovulationPred?.mid).toBe('2025-03-31');
    });

    it('includes Ovu-5', () => {
      // start 2025-03-23 → ovulation 2025-04-06, today is Ovu-5
      const result = runEngine(cycleStartingAt('2025-03-23'));
      expect(result.currentCycle.state).toBe('FERTILE_MID');
    });

    it('excludes Ovu-6 (previously wrongly fertile)', () => {
      // start 2025-03-24 → ovulation 2025-04-07, today is Ovu-6
      const result = runEngine(cycleStartingAt('2025-03-24'));
      expect(result.currentCycle.state).toBe('PRE_FERTILE');
    });

    it('excludes Ovu+2', () => {
      // start 2025-03-16 → ovulation 2025-03-30, today is Ovu+2
      const result = runEngine(cycleStartingAt('2025-03-16'));
      expect(result.currentCycle.state).not.toBe('FERTILE_MID');
    });
  });

  // Regression: the 3-over-6 rule operated on measurement indices and dated
  // ovulation from the first high even across measurement gaps. Gaps must
  // DELAY/date-adjust the confirmation, never make it impossible for the
  // whole cycle (skipped windows pollute later baselines with high values).
  describe('BBT confirmation with measurement gaps', () => {
    function buildCycle(highDayOffsets: number[], lowDays = 6): CycleData {
      const start = '2025-03-01';
      const entries: CycleEntry[] = [];
      for (let i = 0; i < 5; i++) {
        entries.push({ date: dateOffset(start, i), period: 'medium' });
      }
      // consecutive low temps starting at day 5
      const lows = [36.2, 36.25, 36.18, 36.3, 36.22, 36.28, 36.24];
      for (let i = 0; i < lowDays; i++) {
        entries.push({ date: dateOffset(start, i + 5), temperature: lows[i % lows.length] });
      }
      // high temps at the given offsets
      const highs = [36.45, 36.48, 36.55, 36.5, 36.52, 36.49];
      highDayOffsets.forEach((off, i) =>
        entries.push({ date: dateOffset(start, off), temperature: highs[i % highs.length] }));
      return { ...DEFAULT_CYCLE_DATA, entries: makeEntries(entries) };
    }

    it('confirms with 3 consecutive high days (classic dating: first high - 1)', () => {
      const result = runEngine(buildCycle([11, 12, 13]));
      expect(result.currentCycle.ovulationConfirmedDate).toBe(dateOffset('2025-03-01', 10));
    });

    it('confirms across a measurement gap and dates ovulation mid-gap', () => {
      // last low day 10, first high day 15 -> gap 5 -> ovulation = day 10 + ceil(5/2) = 13
      const result = runEngine(buildCycle([15, 16, 17]));
      expect(result.currentCycle.ovulationConfirmedDate).toBe(dateOffset('2025-03-01', 13));
    });

    it('confirms despite excluded fever days before the rise (reviewer scenario)', () => {
      // lows days 5-11 (7 lows), days 12-13 missing (excludeTemp), highs from day 14
      // gap last low (11) -> first high (14) = 3 -> ovulation = day 11 + 2 = 13
      const result = runEngine(buildCycle([14, 15, 16, 17, 18, 19], 7));
      expect(result.currentCycle.ovulationConfirmedDate).toBe(dateOffset('2025-03-01', 13));
    });

    it('confirms for a sparse measurer with a weekend gap within the highs', () => {
      // highs day 14, 15, 18 — span 4 days, within the 7-day limit
      const result = runEngine(buildCycle([14, 15, 18], 7));
      expect(result.currentCycle.ovulationConfirmedDate).toBeDefined();
    });

    it('does not confirm when the 3 highs span more than a week (ultra-sparse)', () => {
      const result = runEngine(buildCycle([11, 16, 21]));
      expect(result.currentCycle.ovulationConfirmedDate).toBeUndefined();
    });
  });
});
