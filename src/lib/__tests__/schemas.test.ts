import { describe, it, expect } from 'vitest';
import { validateImportData } from '../schemas';
import { CycleData, DEFAULT_CYCLE_DATA } from '../types';

function makeValidExport(overrides?: Partial<CycleData>): string {
  const data: CycleData = {
    ...DEFAULT_CYCLE_DATA,
    entries: {
      '2025-01-01': { date: '2025-01-01', period: 'heavy', temperature: 36.5 },
      '2025-01-02': { date: '2025-01-02', period: 'medium' },
      '2025-01-15': { date: '2025-01-15', lhTest: 'peak', cervix: 'eggwhite' },
    },
    ...overrides,
  };
  return JSON.stringify(data);
}

describe('validateImportData', () => {
  it('accepts valid import data', () => {
    const result = validateImportData(makeValidExport());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data.entries)).toHaveLength(3);
      expect(result.warnings).toHaveLength(0);
    }
  });

  it('rejects invalid JSON', () => {
    const result = validateImportData('not json{');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('JSON');
    }
  });

  it('rejects data without entries field', () => {
    const result = validateImportData(JSON.stringify({ cycleLength: 28 }));
    expect(result.success).toBe(false);
  });

  it('skips entries with invalid dates', () => {
    const data = {
      entries: {
        'bad-date': { date: 'bad-date', period: 'heavy' },
        '2025-01-01': { date: '2025-01-01', period: 'medium' },
      },
    };
    const result = validateImportData(JSON.stringify(data));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data.entries)).toHaveLength(1);
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });

  it('skips entries with out-of-range temperature', () => {
    const data = {
      entries: {
        '2025-01-01': { date: '2025-01-01', temperature: 50 }, // way too high
      },
    };
    const result = validateImportData(JSON.stringify(data));
    expect(result.success).toBe(false); // all entries invalid = failure
  });

  it('accepts all valid period flow types', () => {
    for (const flow of ['light', 'medium', 'heavy', 'spotting']) {
      const data = {
        entries: {
          '2025-01-01': { date: '2025-01-01', period: flow },
        },
      };
      const result = validateImportData(JSON.stringify(data));
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid cervix types', () => {
    for (const cervix of ['dry', 'sticky', 'creamy', 'watery', 'eggwhite']) {
      const data = {
        entries: {
          '2025-01-01': { date: '2025-01-01', cervix },
        },
      };
      const result = validateImportData(JSON.stringify(data));
      expect(result.success).toBe(true);
    }
  });

  it('validates cycleLength constraints', () => {
    const data = {
      entries: { '2025-01-01': { date: '2025-01-01' } },
      cycleLength: 10, // too short (min 15)
    };
    const result = validateImportData(JSON.stringify(data));
    expect(result.success).toBe(false);
  });

  it('returns warnings for partially valid data', () => {
    const data = {
      entries: {
        '2025-01-01': { date: '2025-01-01', period: 'heavy' },
        '2025-01-02': { date: '2025-01-02', period: 'INVALID_FLOW' },
      },
    };
    const result = validateImportData(JSON.stringify(data));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data.entries)).toHaveLength(1);
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });
});
