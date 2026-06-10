import { describe, it, expect } from 'vitest';
import { addDays, diffDays, parseDateForDisplay } from '../date-utils';

// DST regression tests: the old implementation mixed UTC parsing with local
// setDate/getDate, which shifted results by one day across DST transitions.
// process.env.TZ is honored at runtime by Node ≥ 16 on Linux.

function withTZ(tz: string, fn: () => void) {
    const prev = process.env.TZ;
    process.env.TZ = tz;
    try {
        fn();
    } finally {
        if (prev === undefined) delete process.env.TZ;
        else process.env.TZ = prev;
    }
}

describe('addDays', () => {
    it('adds days within a month', () => {
        expect(addDays('2026-06-10', 5)).toBe('2026-06-15');
        expect(addDays('2026-06-10', -10)).toBe('2026-05-31');
    });

    it('crosses month and year boundaries', () => {
        expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
        expect(addDays('2024-02-28', 1)).toBe('2024-02-29'); // leap year
    });

    it('is DST-safe in Europe/Berlin (spring transition end of March)', () => {
        withTZ('Europe/Berlin', () => {
            expect(addDays('2026-03-25', 7)).toBe('2026-04-01');
            expect(addDays('2026-03-28', 28)).toBe('2026-04-25');
            // autumn transition (end of October)
            expect(addDays('2026-10-24', 3)).toBe('2026-10-27');
        });
    });

    it('is DST-safe in America/Halifax (western hemisphere)', () => {
        withTZ('America/Halifax', () => {
            expect(addDays('2026-03-01', 60)).toBe('2026-04-30');
            expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
        });
    });

    it('produces no duplicate days when iterating across a DST boundary', () => {
        withTZ('Europe/Berlin', () => {
            const seen = new Set<string>();
            for (let i = 0; i < 10; i++) {
                const iso = addDays('2026-03-25', i);
                expect(seen.has(iso)).toBe(false);
                seen.add(iso);
            }
        });
    });
});

describe('diffDays', () => {
    it('computes whole-day differences', () => {
        expect(diffDays('2026-06-15', '2026-06-10')).toBe(5);
        expect(diffDays('2026-06-10', '2026-06-15')).toBe(-5);
        expect(diffDays('2026-06-10', '2026-06-10')).toBe(0);
    });

    it('is exact across DST boundaries', () => {
        withTZ('Europe/Berlin', () => {
            expect(diffDays('2026-04-01', '2026-03-25')).toBe(7);
        });
    });
});

describe('parseDateForDisplay', () => {
    it('keeps the calendar day in western timezones', () => {
        withTZ('America/Halifax', () => {
            const d = parseDateForDisplay('2026-06-10');
            expect(d.getDate()).toBe(10);
            expect(d.getMonth()).toBe(5);
        });
    });
});
