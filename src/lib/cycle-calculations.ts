
import {
    CycleData,
    CycleEntry,
    CycleStatistics,
    EngineResult,
    CycleState,
    FutureCycle,
    DailyPrediction,
    CyclePhaseState
} from './types';
import { toLocalISO } from './utils';
import { addDays, diffDays } from './date-utils';

// --- Helpers ---

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(values: number[], meanVal: number): number {
    if (values.length <= 1) return 1;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - meanVal, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
}

// --- 1. Historical Statistics ---

function analyzeHistory(entries: Record<string, CycleEntry>): { stats: CycleStatistics, cycleStarts: string[] } {
    const sortedEntries = Object.values(entries).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Identify Cycle Starts
    const starts: string[] = [];
    let lastStart = '';

    for (let i = 0; i < sortedEntries.length; i++) {
        const e = sortedEntries[i];
        const prev = i > 0 ? sortedEntries[i - 1] : null;
        const isPeriodFlow = e.period && e.period !== 'spotting';

        let isStartCandidate = false;

        if (i === 0) {
            if (isPeriodFlow) isStartCandidate = true;
        } else {
            const prevIsPeriodFlow = prev?.period && prev.period !== 'spotting';
            if (isPeriodFlow && (!prevIsPeriodFlow || diffDays(e.date, prev!.date) > 8)) {
                isStartCandidate = true;
            }
        }

        if (isStartCandidate) {
            // Rule: Check against last confirmed start (Min 20 days)
            if (lastStart && diffDays(e.date, lastStart) < 20) {
                isStartCandidate = false;
            }

            if (isStartCandidate) {
                starts.push(e.date);
                lastStart = e.date;
            }
        }
    }

    // Calculate Lengths
    const lengths: number[] = [];
    for (let i = 0; i < starts.length - 1; i++) {
        const len = diffDays(starts[i + 1], starts[i]);
        if (len >= 15 && len <= 90) {
            lengths.push(len);
        }
    }

    // Fallback if insufficient history
    if (lengths.length < 2) {
        return {
            stats: {
                avgCycleLength: 28, medianCycleLength: 28, stdDevCycleLength: 3,
                avgLutealLength: 14, medianLutealLength: 14, historyCount: lengths.length
            },
            cycleStarts: starts
        };
    }

    // Winsorization-like logic? For now, simple median/stddev on filtered list
    const med = median(lengths);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const sd = stdDev(lengths, avg);

    // Calculate Luteal Phase (Retrospective)
    // We need to run the BBT logic on past cycles to find confirmed ovulations!
    const lutealLengths: number[] = [];

    // Iterate over past cycles
    for (let i = 0; i < starts.length - 1; i++) {
        const cycleStart = starts[i];
        const nextStart = starts[i + 1];

        // Extract cycle entries
        const cycleEntries = Object.values(entries)
            .filter(e => e.date >= cycleStart && e.date < nextStart)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Attempt BBT confirmation
        const bbtResult = confirmOvulationBBT(cycleEntries);
        if (bbtResult.confirmed && bbtResult.date) {
            const luteal = diffDays(nextStart, bbtResult.date);
            if (luteal >= 9 && luteal <= 18) { // Valid luteal range
                lutealLengths.push(luteal);
            }
        }
    }

    const lutealAvg = lutealLengths.length > 0
        ? lutealLengths.reduce((a, b) => a + b, 0) / lutealLengths.length
        : 14;
    const lutealMed = lutealLengths.length > 0 ? median(lutealLengths) : 14;

    return {
        stats: {
            avgCycleLength: avg, medianCycleLength: med, stdDevCycleLength: sd,
            avgLutealLength: lutealAvg, medianLutealLength: lutealMed, historyCount: lengths.length
        },
        cycleStarts: starts
    };
}


// --- 2. BBT & LH Logic ---

interface BBTConfirmation {
    confirmed: boolean;
    date?: string; // Ovulation Date (Day before shift)
    coverline?: number;
    firstHighDate?: string;
}

function confirmOvulationBBT(cycleEntries: CycleEntry[]): BBTConfirmation {
    const validTemps = cycleEntries.filter(e => e.temperature && !e.excludeTemp);
    if (validTemps.length < 9) return { confirmed: false }; // Need at least 6 low + 3 high

    // Sliding window for 3-over-6 rule
    for (let i = 6; i < validTemps.length - 2; i++) {
        const prev6 = validTemps.slice(i - 6, i);
        const next3 = validTemps.slice(i, i + 3);

        // Ultra-sparse Messung: Wenn die 3 Hochwerte mehr als eine Woche
        // auseinanderliegen, ist keine seriöse Bestätigung möglich.
        // WICHTIG: kleinere Lücken dürfen das Fenster NICHT verwerfen —
        // sonst wandern die Hochwerte in prev6 späterer Fenster, heben die
        // Baseline auf Hochlagen-Niveau und die Bestätigung wird für den
        // gesamten Zyklus unmöglich (statt sich nur zu verzögern).
        if (diffDays(next3[2].date, next3[0].date) > 7) continue;

        const baseline = Math.max(...prev6.map(e => e.temperature!));
        const threshold = baseline + 0.15; // Slightly relaxed from 0.20 strict NFP

        // Rule: All 3 next temps > baseline
        // And 3rd temp >= threshold (or maybe just strict logical shift)

        const isShift = next3.every(e => e.temperature! > baseline) &&
            (next3[2].temperature! >= threshold || next3.every(e => e.temperature! >= baseline + 0.05));

        if (isShift) {
            // Datierung: klassisch der Tag vor der ersten Hochmessung. Liegt
            // zwischen letzter Tief- und erster Hochmessung eine Messlücke,
            // fand der Anstieg irgendwo darin statt — die Lückenmitte ist
            // dann die beste Schätzung (statt die Bestätigung zu verweigern).
            const lastLow = prev6[5];
            const gap = diffDays(next3[0].date, lastLow.date);
            const ovuDate = gap <= 1
                ? addDays(next3[0].date, -1)
                : addDays(lastLow.date, Math.ceil(gap / 2));
            return {
                confirmed: true,
                date: ovuDate,
                coverline: baseline,
                firstHighDate: next3[0].date
            };
        }
    }
    return { confirmed: false };
}

function findLHPeaks(cycleEntries: CycleEntry[]): string[] {
    return cycleEntries
        .filter(e => e.lhTest === 'peak' || e.lhTest === 'positive')
        .map(e => e.date);
}


// --- 3. Current Cycle Analysis (State Machine) ---

function analyzeCurrent(
    entries: Record<string, CycleEntry>,
    currentStart: string,
    stats: CycleStatistics,
    todayStr: string
): CyclePhaseState {

    // Sort & Filter
    const cycleEntries = Object.values(entries)
        .filter(e => e.date >= currentStart)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const daysSinceStart = diffDays(todayStr, currentStart) + 1;

    // 1. Detect LH Peaks & BBT
    const lhPeaks = findLHPeaks(cycleEntries); // High/Positive
    const latestPeak = lhPeaks.length > 0 ? lhPeaks[lhPeaks.length - 1] : undefined;

    const bbt = confirmOvulationBBT(cycleEntries);

    // 2. Determine State
    let state: CycleState = 'PRE_FERTILE';

    // Check for bleeding first (only if very early?) 
    // Actually if we simply have bleeding today, we are in menstruation?
    const todayEntry = entries[todayStr];
    if (todayEntry?.period && todayEntry.period !== 'spotting') {
        // Only if early in cycle? Or creates new cycle?
        // Analyzing "Current" assumes 'currentStart' is the latest valid start. 
        // So bleeding today aligns with MENSTRUATION.
        if (daysSinceStart <= 7) state = 'MENSTRUATION';
    }

    if (state !== 'MENSTRUATION') {
        if (bbt.confirmed) {
            state = 'OVU_CONFIRMED';
        } else if (latestPeak) {
            const daysSincePeak = diffDays(todayStr, latestPeak);
            if (daysSincePeak === 0 || daysSincePeak === 1) {
                state = 'PEAK_LH';
            } else if (daysSincePeak > 1 && daysSincePeak < 5) {
                state = 'POST_OVU_PENDING';
            } else if (daysSincePeak >= 5) {
                state = 'ANOVULATORY_SUSPECTED';
            }
        } else {
            // Statistical windows — same basis as the prediction below:
            // ovulation date = currentStart + estOvu, fertile [Ovu-5, Ovu+1].
            const estOvu = stats.medianCycleLength - stats.medianLutealLength;
            const dToOvu = diffDays(todayStr, addDays(currentStart, estOvu));
            if (dToOvu >= -5 && dToOvu <= 1) {
                state = 'FERTILE_MID';
            }
        }
    }

    // 3. Predictions for THIS cycle
    // If Ovulation Confirmed:
    // Ovu = bbt.date
    // Period = Ovu + LL_med

    let ovDateMid: string;
    let ovDateMin: string;
    let ovDateMax: string;
    let ovConf: 'LOW' | 'MED' | 'HIGH' = 'LOW';

    if (bbt.confirmed && bbt.date) {
        ovDateMid = bbt.date;
        ovDateMin = bbt.date;
        ovDateMax = bbt.date;
        ovConf = 'HIGH';
    } else if (latestPeak) {
        // Peak Rule: Ovu is Peak+1 (range +1 to +2)
        ovDateMid = addDays(latestPeak, 1);
        ovDateMin = addDays(latestPeak, 0);
        ovDateMax = addDays(latestPeak, 2);
        ovConf = 'MED';
    } else {
        // Statistic
        const day = stats.medianCycleLength - stats.medianLutealLength;
        ovDateMid = addDays(currentStart, day);
        ovDateMin = addDays(currentStart, day - 2);
        ovDateMax = addDays(currentStart, day + 2);
        ovConf = 'LOW';
    }

    // Next Period Prediction
    let nextPerMid: string;
    let nextPerMin: string;
    let nextPerMax: string;
    let nextConf: 'LOW' | 'MED' | 'HIGH' = 'LOW';

    if (bbt.confirmed && bbt.date) {
        // Driven by Luteal
        nextPerMid = addDays(bbt.date, stats.medianLutealLength);
        nextPerMin = addDays(bbt.date, stats.medianLutealLength - 1);
        nextPerMax = addDays(bbt.date, stats.medianLutealLength + 1);
        nextConf = 'HIGH';
    } else {
        // Cycle Length statistics
        // If Peak exists, use Peak + 1 + LL
        if (latestPeak) {
            nextPerMid = addDays(latestPeak, 1 + stats.medianLutealLength);
            nextConf = 'MED';
        } else {
            nextPerMid = addDays(currentStart, stats.medianCycleLength);
            nextConf = 'LOW';
        }
        // Use SD for range
        const u = stats.stdDevCycleLength;
        nextPerMin = addDays(nextPerMid, -Math.round(u));
        nextPerMax = addDays(nextPerMid, Math.round(u));
    }

    return {
        startDate: currentStart,
        day: daysSinceStart,
        state,
        ovulationConfirmedDate: bbt.confirmed ? bbt.date : undefined,
        coverline: bbt.coverline,
        coverlineProvisional: !bbt.confirmed && cycleEntries.filter(e => e.temperature).length >= 6, // Show dashed if enough data
        lhPeaks: lhPeaks,
        activePeak: latestPeak,

        ovulationPred: {
            mid: ovDateMid,
            earliest: ovDateMin,
            latest: ovDateMax,
            confidence: ovConf
        },
        nextPeriodPred: {
            mid: nextPerMid,
            earliest: nextPerMin,
            latest: nextPerMax,
            confidence: nextConf
        }
    };
}


// --- 4. Multi-Month Prediction ---

function predictFuture(
    currentAnalysis: CyclePhaseState,
    stats: CycleStatistics,
    count: number = 6
): FutureCycle[] {
    const predictions: FutureCycle[] = [];

    // Start from the END of the current cycle
    let lastPeriodStartMid = currentAnalysis.nextPeriodPred?.mid ||
        addDays(currentAnalysis.startDate, stats.medianCycleLength);

    // Accumulate uncertainty
    let varianceSum = stats.stdDevCycleLength * stats.stdDevCycleLength;

    // If current cycle is confirmed, uncertainty resets for next start?
    // No, standard deviation applies to future cycles.

    for (let k = 0; k < count; k++) {
        const uncertainty = Math.sqrt(varianceSum);

        // Cycle Start
        const cMid = lastPeriodStartMid;
        const cLow = addDays(cMid, -Math.floor(uncertainty));
        const cHigh = addDays(cMid, Math.ceil(uncertainty));

        // Ovulation in this future cycle
        // Ovu = Start + (CL - LL)
        const ovuOffset = stats.medianCycleLength - stats.medianLutealLength;
        const oMid = addDays(cMid, ovuOffset);
        const oLow = addDays(oMid, -Math.floor(uncertainty)); // Uncertainty from start propagates
        const oHigh = addDays(oMid, Math.ceil(uncertainty));

        // Fertile Window
        // [Ovu - 5, Ovu + 1]
        const fStart = addDays(oMid, -5);
        const fEnd = addDays(oMid, 1);

        predictions.push({
            cycleStart: cMid,
            cycleStartLow: cLow,
            cycleStartHigh: cHigh,
            ovulationDate: oMid,
            ovulationLow: oLow,
            ovulationHigh: oHigh,
            fertileStart: fStart,
            fertileEnd: fEnd
        });

        // Next Step
        lastPeriodStartMid = addDays(lastPeriodStartMid, stats.medianCycleLength);
        varianceSum += stats.stdDevCycleLength * stats.stdDevCycleLength;
    }

    return predictions;
}


// --- Main Engine ---

export function runEngine(data: CycleData): EngineResult {
    const todayStr = toLocalISO();

    // 1. Analyze History & Stats
    const { stats, cycleStarts } = analyzeHistory(data.entries);
    const lastStart = cycleStarts.length > 0 ? cycleStarts[cycleStarts.length - 1] : todayStr;

    // 2. Analyze Current Cycle (State Machine)
    const currentAnalysis = analyzeCurrent(data.entries, lastStart, stats, todayStr);

    // 3. Predict Future
    const futureCycles = predictFuture(currentAnalysis, stats);

    // 4. Today's Fertility/Status Calculation
    let todayPhase: DailyPrediction['phase'] = 'follicular';
    let isFertile = false;
    let fertilityLevel: 0 | 1 | 2 | 3 = 0;

    if (currentAnalysis.state === 'MENSTRUATION') {
        todayPhase = 'menstruation';

    } else if (currentAnalysis.state === 'OVU_CONFIRMED') {
        // Past ovulation
        todayPhase = 'luteal';

    } else {
        // Pre-Ovu / Fertile
        // Map State to Level
        if (currentAnalysis.state === 'PEAK_LH') {
            todayPhase = 'ovulatory';
            isFertile = true;
            fertilityLevel = 3;
        } else if (currentAnalysis.state === 'FERTILE_MID') {
            todayPhase = 'ovulatory';
            isFertile = true;
            fertilityLevel = 2;
        } else if (currentAnalysis.state === 'POST_OVU_PENDING') {
            todayPhase = 'ovulatory'; // Waiting for confirmation
            isFertile = true; // Still potentially fertile window
            fertilityLevel = 2;
        } else {
            // Statistical Window (Low Confidence Forecast)
            if (currentAnalysis.ovulationPred) {
                const oMid = currentAnalysis.ovulationPred.mid;
                const dDiff = diffDays(todayStr, oMid);
                if (dDiff >= -5 && dDiff <= 1) {
                    todayPhase = 'ovulatory';
                    isFertile = true;
                    fertilityLevel = 1;
                }
            }
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


// --- Legacy Compatibility ---

export function calculatePredictions(data: CycleData) {
    const engine = runEngine(data);
    const current = engine.currentCycle;
    const stats = engine.statistics;

    const op = current.ovulationPred!;
    const np = current.nextPeriodPred!;

    return {
        nextPeriodStart: new Date(np.mid),
        ovulationNext: new Date(op.mid),
        fertileWindowStart: addDays(op.mid, -5),
        fertileWindowEnd: new Date(op.mid), // Old UI expected Date logic?

        currentPhase: engine.predictions.today.phase,
        isOvulationConfirmed: !!current.ovulationConfirmedDate,

        cycleDay: current.day,
        stats: stats,
        engineResult: engine
    };
}
