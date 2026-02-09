import { CycleData, CycleEntry, CycleStatistics, EngineResult, CycleState, FutureCycle, DailyPrediction } from './types';
import { toLocalISO } from './utils';

// --- Helpers ---
const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;

function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

function diffDays(d1: string, d2: string): number {
    return Math.floor((new Date(d1).getTime() - new Date(d2).getTime()) / MILLIS_PER_DAY);
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(values: number[], meanVal: number): number {
    if (values.length <= 1) return 1; // Default uncertainty
    const variance = values.reduce((sum, val) => sum + Math.pow(val - meanVal, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
}

// --- 1. Historical Statistics ---

function analyzeHistory(entries: Record<string, CycleEntry>): { stats: CycleStatistics, cycleStarts: string[] } {
    const sortedEntries = Object.values(entries).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Identify Cycle Starts
    const starts: string[] = [];
    for (let i = 0; i < sortedEntries.length; i++) {
        const e = sortedEntries[i];
        const prev = i > 0 ? sortedEntries[i - 1] : null;
        // Spotting should NOT start a new cycle
        const isPeriodFlow = e.period && e.period !== 'spotting';
        const prevIsPeriodFlow = prev?.period && prev.period !== 'spotting';
        const isStart = isPeriodFlow && (!prevIsPeriodFlow || diffDays(e.date, prev!.date) > 8);
        if (isStart) starts.push(e.date);
    }

    // Calculate Lengths
    const lengths: number[] = [];
    for (let i = 0; i < starts.length - 1; i++) {
        const len = diffDays(starts[i + 1], starts[i]);
        if (len >= 20 && len <= 45) { // Filter obvious outliers for robust stats
            lengths.push(len);
        }
    }

    // Fallback if no history
    if (lengths.length < 2) {
        return {
            stats: {
                avgCycleLength: 28, medianCycleLength: 28, stdDevCycleLength: 1.5,
                avgLutealLength: 14, medianLutealLength: 14, historyCount: lengths.length
            },
            cycleStarts: starts
        };
    }

    const med = median(lengths);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const sd = stdDev(lengths, avg);

    // Calculate actual luteal phase from confirmed ovulations
    const lutealLengths: number[] = [];
    for (let i = 0; i < starts.length - 1; i++) {
        const cycleStart = starts[i];
        const nextStart = starts[i + 1];
        const cycleLen = diffDays(nextStart, cycleStart);
        if (cycleLen < 20 || cycleLen > 45) continue;

        // Find confirmed ovulation in this cycle via BBT shift
        const cycleEntries = Object.values(entries)
            .filter(e => e.date >= cycleStart && e.date < nextStart)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const validTemps = cycleEntries.filter(e => e.temperature && !e.excludeTemp);

        for (let j = 6; j < validTemps.length - 2; j++) {
            const prev6 = validTemps.slice(j - 6, j);
            const next3 = validTemps.slice(j, j + 3);
            if (prev6.length < 6) continue;
            const baseline = Math.max(...prev6.map(e => e.temperature!));
            const threshold = baseline + 0.2;
            const isShift = next3.every(e => e.temperature! >= baseline + 0.05) && next3[2].temperature! >= threshold;
            if (isShift) {
                const ovuDate = addDays(validTemps[j].date, -1);
                const luteal = diffDays(nextStart, ovuDate);
                if (luteal >= 8 && luteal <= 20) lutealLengths.push(luteal);
                break;
            }
        }
    }

    const lutealAvg = lutealLengths.length >= 2
        ? lutealLengths.reduce((a, b) => a + b, 0) / lutealLengths.length
        : 14;
    const lutealMed = lutealLengths.length >= 2 ? median(lutealLengths) : 14;

    return {
        stats: {
            avgCycleLength: avg, medianCycleLength: med, stdDevCycleLength: sd,
            avgLutealLength: lutealAvg, medianLutealLength: lutealMed, historyCount: lengths.length
        },
        cycleStarts: starts
    };
}

// --- 2. Multi-Month Prediction (Iterative) ---

function predictFuture(currentStart: string, stats: CycleStatistics, count: number = 6): FutureCycle[] {
    const predictions: FutureCycle[] = [];
    let lastStart = currentStart;

    // We process K future cycles
    // Cycle 1 starts after "current cycle" ends. 
    // Wait, "currentStart" is the start of the *active* cycle.
    // So FutureCycle[0] is the *next* cycle.

    // Initial estimation for *end* of current cycle / start of next
    // S_next = S_current + MedianLength
    let nextStartMean = new Date(currentStart).getTime() + stats.medianCycleLength * MILLIS_PER_DAY;

    // Uncertainty accumulation
    let varianceSum = stats.stdDevCycleLength * stats.stdDevCycleLength;

    for (let k = 0; k < count; k++) {
        const startMeanDate = new Date(nextStartMean);
        const startIso = startMeanDate.toISOString().split('T')[0];
        const uncertainty = Math.sqrt(varianceSum); // SD of this predicted start date

        // Prediction for THIS future cycle
        // Ovulation = Start + (CycleLen - Luteal)
        const cycleLen = stats.medianCycleLength;
        const luteal = stats.medianLutealLength;
        const ovulationDayIndex = cycleLen - luteal;

        const ovuDate = addDays(startIso, ovulationDayIndex);

        // Ranges (68% CI = +/- 1 SD)
        const lowOffset = Math.floor(-1 * uncertainty);
        const highOffset = Math.ceil(1 * uncertainty);

        predictions.push({
            cycleStart: startIso,
            cycleStartLow: addDays(startIso, lowOffset),
            cycleStartHigh: addDays(startIso, highOffset),

            ovulationDate: ovuDate,
            ovulationLow: addDays(ovuDate, lowOffset), // Assuming Luteal Phase is stable, uncertainty comes from Cycle Start
            ovulationHigh: addDays(ovuDate, highOffset),

            fertileStart: addDays(ovuDate, -5),
            fertileEnd: addDays(ovuDate, 1) // User request: +1 day after Ovulation
        });

        // Step for next iteration
        nextStartMean += stats.medianCycleLength * MILLIS_PER_DAY;
        varianceSum += stats.stdDevCycleLength * stats.stdDevCycleLength; // Variance adds up
    }

    return predictions;
}

// --- 3. Current Cycle Analysis (NFP State Machine) ---

function analyzeCurrent(entries: Record<string, CycleEntry>, currentStart: string, stats: CycleStatistics, todayStr: string, periodLength: number = 5) {
    // Filter entries for current cycle
    const cycleEntries = Object.values(entries)
        .filter(e => e.date >= currentStart)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let state: CycleState = 'PRE_FERTILE';
    let confirmedOvuDate: string | undefined = undefined;
    let coverline: number | undefined = undefined;

    // Find LH Peak
    const lhPeakEntry = cycleEntries.find(e => e.lhTest === 'peak' || e.lhTest === 'positive');

    // Find BBT Shift
    // Need 6 low temps followed by 3 high temps
    // Baseline = max of 6 low temps
    // Threshold = Baseline + 0.2
    // Shift = 3 consecutive temps >= Threshold

    const validTemps = cycleEntries.filter(e => e.temperature && !e.excludeTemp);

    for (let i = 6; i < validTemps.length - 2; i++) {
        // Candidate for first high day is validTemps[i]
        const prev6 = validTemps.slice(i - 6, i);
        const next3 = validTemps.slice(i, i + 3); // Includes the 'shift' day + 2 following

        if (prev6.length < 6) continue;

        const baseline = Math.max(...prev6.map(e => e.temperature!));
        const threshold = baseline + 0.2; // Strict NFP rule often 0.2, simplified here

        const isShift = next3.every(e => e.temperature! >= baseline + 0.05) && next3[2].temperature! >= threshold; // NFP Rules are complex. 
        // Simplified Rule for App: All 3 must be > baseline, and at least one > baseline + 0.2?
        // Let's use: All 3 > baseline, and 3rd is >= baseline + 0.2

        if (isShift) {
            confirmedOvuDate = addDays(validTemps[i].date, -1); // Ovulation is day before shift
            coverline = baseline;
            state = 'OVU_CONFIRMED';
            break;
        }
    }

    // Determine State if not confirmed
    if (state !== 'OVU_CONFIRMED') {
        if (lhPeakEntry) {
            // Check if we are long past peak
            const daysSincePeak = diffDays(todayStr, lhPeakEntry.date);
            if (daysSincePeak > 4) state = 'ANOVULATORY_SUSPECTED';
            else if (daysSincePeak > 0) state = 'POST_OVU_PENDING';
            else state = 'PEAK_LH'; // Today is peak or before
        } else {
            // Check for Menstruation
            const currentDay = diffDays(todayStr, currentStart) + 1;
            if (currentDay <= periodLength) state = 'MENSTRUATION'; // Uses actual period length
            // Check for fertile window based on stats
            else {
                const estOvu = stats.medianCycleLength - stats.medianLutealLength;
                if (currentDay >= estOvu - 5 && currentDay <= estOvu) state = 'FERTILE_MID';
            }
        }
    }

    return {
        startDate: currentStart,
        day: diffDays(todayStr, currentStart) + 1,
        state,
        ovulationConfirmedDate: confirmedOvuDate,
        coverline
    };
}


// --- Main Engine Function ---

export function runEngine(data: CycleData): EngineResult {
    const { stats, cycleStarts } = analyzeHistory(data.entries);
    const lastStart = cycleStarts.length > 0 ? cycleStarts[cycleStarts.length - 1] : toLocalISO();
    const todayStr = toLocalISO();

    const currentAnalysis = analyzeCurrent(data.entries, lastStart, stats, todayStr, data.periodLength || 5);
    const futureCycles = predictFuture(lastStart, stats);

    // --- Today's Prediction (Merged) ---
    // If Ovulation is confirmed, we know exactly where we are (Luteal).
    // If not, we use statistical prediction or LH signs.

    let todayPhase: DailyPrediction['phase'] = 'follicular';
    let isFertile = false;
    let fertilityLevel: DailyPrediction['fertilityLevel'] = 0;

    if (currentAnalysis.state === 'MENSTRUATION') {
        todayPhase = 'menstruation';
    } else if (currentAnalysis.state === 'OVU_CONFIRMED') {
        todayPhase = 'luteal';
    } else {
        // Check predictive fertile window (from futureCycles[0] logic relative to current)
        const cycleLen = stats.medianCycleLength;
        const luteal = stats.medianLutealLength;
        const estOvuDay = cycleLen - luteal;

        // Are we in fertile window?
        // Window: [Ovu - 5, Ovu]
        // But currentAnalysis.state might already be FERTILE_MID or PEAK
        if (currentAnalysis.state === 'PEAK_LH') {
            todayPhase = 'ovulatory';
            isFertile = true;
            fertilityLevel = 3;
        } else if (currentAnalysis.state === 'FERTILE_MID') {
            todayPhase = 'ovulatory';
            isFertile = true;
            fertilityLevel = 2;
        } else if (currentAnalysis.day >= estOvuDay - 5 && currentAnalysis.day <= estOvuDay + 1) {
            todayPhase = 'ovulatory';
            isFertile = true;
            fertilityLevel = 1; // Statistical assumption
        }
    }

    const todayPrediction: DailyPrediction = {
        date: todayStr,
        phase: todayPhase,
        fertilityLevel,
        isFertile,
        isPeriod: currentAnalysis.state === 'MENSTRUATION',
        isOvulation: currentAnalysis.state === 'PEAK_LH' || (!!currentAnalysis.ovulationConfirmedDate && currentAnalysis.ovulationConfirmedDate === todayStr),
        isConfirmed: !!currentAnalysis.ovulationConfirmedDate,
        cycleDay: currentAnalysis.day
    };

    return {
        statistics: stats,
        currentCycle: currentAnalysis,
        predictions: {
            today: todayPrediction,
            futureCycles
        }
    };
}

// Backward compatibility for existing UI components
export function calculatePredictions(data: CycleData) {
    const engine = runEngine(data);
    const current = engine.currentCycle;
    const stats = engine.statistics;

    // Map EngineResult to old PredictionResult interface for compatibility
    // Or update UI to use engine result.
    // Let's return a hybrid or mapped object to avoid breaking everything immediately.

    // We need: nextPeriodStart, ovulationNext, fertileWindowStart, fertileWindowEnd...

    // If confirmed, next period is Ovu + Luteal
    let nextPeriod: Date;
    let ovulation: Date;

    if (current.ovulationConfirmedDate) {
        ovulation = new Date(current.ovulationConfirmedDate);
        nextPeriod = new Date(current.ovulationConfirmedDate);
        nextPeriod.setDate(nextPeriod.getDate() + stats.medianLutealLength);
    } else {
        // Statistical
        const start = new Date(current.startDate);
        nextPeriod = new Date(start);
        nextPeriod.setDate(nextPeriod.getDate() + stats.medianCycleLength);

        ovulation = new Date(nextPeriod);
        ovulation.setDate(ovulation.getDate() - stats.medianLutealLength);
    }

    return {
        nextPeriodStart: nextPeriod,
        ovulationNext: ovulation,
        fertileWindowStart: addDays(ovulation.toISOString().split('T')[0], -5), // string, but old typed Date? No, old typed Date.
        fertileWindowEnd: ovulation,

        currentPhase: engine.predictions.today.phase,
        isOvulationConfirmed: !!current.ovulationConfirmedDate,

        // Extras from Engine
        cycleDay: current.day,
        stats: stats,
        engineResult: engine // Pass full engine result for new components
    };
}
