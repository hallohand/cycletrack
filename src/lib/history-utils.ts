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

import { addDays, diffDays } from '@/lib/date-utils';
import { toLocalISO } from '@/lib/utils';


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
            const today = toLocalISO();
            // If today < currentStart (impossible if sorted, but safety)
            if (diffDays(today, currentStart) < 0) {
                length = currentEntries.length; // Fallback
            } else {
                length = diffDays(today, currentStart) + 1;
            }
        }

        const periodLength = currentEntries.filter(e => e.period && e.period !== 'spotting').length;

        // Find Ovu Day Index (0-based index of ovulation day within the cycle)
        let ovuDayIndex = -1;

        // 1. LH rule — same convention as the engine: LAST positive/peak test + 1.
        for (let i = 0; i < length; i++) {
            const iso = addDays(currentStart, i);
            const entry = entriesMap[iso];
            if (entry?.lhTest === 'peak' || entry?.lhTest === 'positive') {
                ovuDayIndex = i + 1;
            }
        }

        // 2. Fallback: ovulation ≈ 14 days before the next cycle start.
        // Only valid for COMPLETED cycles — for the running cycle `length`
        // grows with every day, so the marker would wander daily.
        if (ovuDayIndex === -1 && nextStart && length >= 20) {
            // Engine convention: ovu offset = cycleLength - lutealLength,
            // i.e. 0-based index length - 14.
            ovuDayIndex = length - 14;
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
                // Fertile window: 5 days before + 1 day after ovulation (sperm 5d, egg 24h)
                if (i >= ovuDayIndex - 5 && i <= ovuDayIndex + 1) isFertile = true;
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

    entries.forEach((e) => {
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

                // Rule 1: Must be > 20 days from start (Standard Min Cycle)
                if (dayDiff < 20) {
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
