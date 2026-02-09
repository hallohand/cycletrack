import { CycleEntry } from '@/lib/types';

export interface CycleGroup {
    id: string;
    startDate: string;
    endDate?: string;
    length?: number;
    periodLength: number;
    entries: CycleEntry[];
    days: {
        date: string;
        isPeriod: boolean;
        isSpotting?: boolean;
        isFertile: boolean;
        isOvulation: boolean;
        hasSex: boolean;
    }[];
}

// Helper: Parse YYYY-MM-DD as Local Date at Noon to avoid Timezone shifts
function parseDateSafe(dateStr: string): Date {
    // Append T12:00:00 to ensure we are in the middle of the day, 
    // avoiding midnight shifts due to T00:00:00Z being previous day in Western hemisphere 
    // or T00:00:00 Local being shifted if not careful.
    // Actually: new Date('YYYY-MM-DD') is UTC.
    // We want to work with timestamps that represent differences in DAYS reliably.
    // Best way: treat everything as UTC for calculation, or force Noon Local.

    // Let's use UTC for calculations to be safe from DST shifts too.
    const d = new Date(dateStr);
    // This is UTC midnight.
    return d;
}

function diffDays(d1: string, d2: string): number {
    const t1 = parseDateSafe(d1).getTime();
    const t2 = parseDateSafe(d2).getTime();
    return Math.round((t1 - t2) / (1000 * 60 * 60 * 24));
}

function addDays(dateStr: string, days: number): string {
    const d = parseDateSafe(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}


export function groupCycles(entriesMap: Record<string, CycleEntry>): CycleGroup[] {
    const entries = Object.values(entriesMap).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const cycles: CycleGroup[] = [];

    let currentEntries: CycleEntry[] = [];
    let currentStart = '';
    let lastPeriodDateInCurrentCycle: string | null = null;

    const finishCycle = (end: string | undefined, nextStart: string | undefined) => {
        if (!currentStart) return;

        let length = 0;
        let endDate = end;

        if (nextStart) {
            length = diffDays(nextStart, currentStart);
            endDate = addDays(nextStart, -1);
        } else {
            const today = new Date().toISOString().split('T')[0];
            // If today < currentStart (impossible if sorted, but safety)
            if (diffDays(today, currentStart) < 0) {
                length = currentEntries.length; // Fallback
            } else {
                length = diffDays(today, currentStart) + 1;
            }
        }

        const periodLength = currentEntries.filter(e => e.period).length;

        // Find Ovu Day Index
        let ovuDayIndex = -1;

        // 1. Check for LH Peak
        // Find index of LH Peak
        for (let i = 0; i < length; i++) {
            const iso = addDays(currentStart, i);
            const entry = entriesMap[iso];
            if (entry?.lhTest === 'peak' || entry?.lhTest === 'positive') {
                // Assume ovulation 1 day after LAST positive/peak? Or first?
                // Simple rule: First Peak + 1. 
                // Let's iterate found entires properly? 
                // Actually we can just find it in currentEntries list if easier, 
                // but mapping index 'i' is better.
                if (ovuDayIndex === -1) {
                    ovuDayIndex = i + 1; // Ovulation day
                }
            }
        }

        // 2. Fallback to Length - 14
        if (ovuDayIndex === -1 && length >= 20) {
            ovuDayIndex = length - 14;
            // 0-indexed: Day 14 is index 13. 
            // If length 28. Ovu is 14 (Day 15?). 28-14 = 14.
            // If length 28, cycle is [0..27]. 
            // Ovu usually Day 14 (index 13)?? No, Day 14 before end.
            // If Start Jan 1. End Jan 28. Length 28.
            // Next start Jan 29.
            // Luteal phase starts after Ovu.
            // Ovu = End - 14. 
            // Jan 28 - 14 = Jan 14. 
            // Index 13 (Day 14). Correct.
            // But code was `i === ovuDayIndex - 1`. 
            // If index is 14, i==13 is true. 
            // So code effectively used index 13.

            // Let's standardize: ovuDayIndex is the 0-based index of ovulation day.
            ovuDayIndex = length - 14 - 1;
        }

        const visDays = [];
        for (let i = 0; i < length; i++) {
            const iso = addDays(currentStart, i);
            const entry = entriesMap[iso];

            // Strict Separation: Spotting is NOT a period.
            const isSpotting = entry?.period === 'spotting';
            const isPeriod = !!entry?.period && !isSpotting;

            let isOvulation = false;
            let isFertile = false;

            if (ovuDayIndex !== -1) {
                if (i === ovuDayIndex) isOvulation = true;
                if (i >= ovuDayIndex - 5 && i <= ovuDayIndex) isFertile = true;
            }

            // Override if manual LH Peak (visual only? no, logic above handles it)
            // But ensure we show the star if strictly calculated.

            visDays.push({
                date: iso,
                isPeriod,
                isSpotting,
                isFertile: isFertile && !isPeriod,
                isOvulation,
                hasSex: !!entry?.sex
            });
        }

        cycles.push({
            id: currentStart,
            startDate: currentStart,
            endDate,
            length,
            periodLength,
            entries: currentEntries,
            days: visDays
        });
    }

    entries.forEach((e, i) => {
        let isNewCycle = false;

        if (e.period) {
            // Ignore 'spotting' as cycle starter?
            // User feedback is key. Usually Spotting is NOT Day 1.
            // Let's prevent spotting from STARTING a new cycle, unless it's the only thing we have.
            // But if we are in a cycle, spotting is just part of it.

            const isSpotting = e.period === 'spotting';

            if (!currentStart) {
                // If strictly spotting at very beginning, maybe wait? 
                // But for now, any period starts the first cycle.
                isNewCycle = true;
            } else {
                const dayDiff = diffDays(e.date, currentStart);

                // Rule 1: Must be > 14 days from start
                if (dayDiff < 14) {
                    isNewCycle = false;
                } else {
                    // Rule 2: Must be > 10 days from last recorded period flow
                    const lastPeriodGap = lastPeriodDateInCurrentCycle
                        ? diffDays(e.date, lastPeriodDateInCurrentCycle)
                        : dayDiff;

                    if (lastPeriodGap > 10) {
                        // It qualifies time-wise.
                        // CycleTrack / Femometer convention:
                        // Spotting usually does NOT start a cycle. Red blood (Light/Medium/Heavy) does.
                        // So if isSpotting is true, we should ignore it as a "Cycle Starter"
                        // unless it is the ONLY thing we have for weeks? 
                        // But better to be strict: Spotting != Day 1.
                        if (isSpotting) {
                            isNewCycle = false;
                        } else {
                            isNewCycle = true;
                        }
                    }
                }
            }
        }

        // Special Case: First ever entry
        if (!currentStart && e.period && e.period !== 'spotting') {
            isNewCycle = true;
        }
        // If first entry IS spotting, we do NOT start a cycle?
        // Then it will be appended to "previous" (non-existent) or just ignored?
        // If currentStart is null, and we have entries, strict logic says they belong to "no cycle" or "previous unknown".
        // But `finishCycle` needs `currentStart`.
        // If we encounter spotting at start of sorted list, and no currentStart:
        // We probably should just wait for first real period.
        // OR we treat it as part of 'current entries' without a start date? No.

        if (isNewCycle) {
            if (currentStart) {
                finishCycle(undefined, e.date);
            }
            currentStart = e.date;
            currentEntries = [];
            lastPeriodDateInCurrentCycle = null;
        }

        if (currentStart) {
            currentEntries.push(e);
            if (e.period && e.period !== 'spotting') {
                lastPeriodDateInCurrentCycle = e.date;
            }
        }
    });

    if (currentStart) {
        finishCycle(undefined, undefined);
    }

    return cycles.reverse();
}
