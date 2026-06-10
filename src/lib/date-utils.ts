// Shared UTC-safe date arithmetic for 'YYYY-MM-DD' strings.
// 'YYYY-MM-DD' parses as UTC midnight; all arithmetic must stay in UTC.
// Mixing local setDate/getDate with UTC parsing shifts results by one day
// when the range crosses a DST transition.

const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;

/** Add `days` to a 'YYYY-MM-DD' string, returning 'YYYY-MM-DD'. */
export function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
}

/** Whole-day difference d1 - d2 between two 'YYYY-MM-DD' strings. */
export function diffDays(d1: string, d2: string): number {
    return Math.round((new Date(d1).getTime() - new Date(d2).getTime()) / MILLIS_PER_DAY);
}

/** Parse 'YYYY-MM-DD' for *display* in the local timezone without day-shift.
 *  new Date('YYYY-MM-DD') is UTC midnight, which is the previous day in
 *  timezones west of UTC; anchoring at local noon avoids that. */
export function parseDateForDisplay(iso: string): Date {
    return new Date(`${iso}T12:00:00`);
}
