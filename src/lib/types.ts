export type PeriodFlow = 'light' | 'medium' | 'heavy' | 'spotting';
export type PeriodPain = 'light' | 'medium' | 'strong' | 'extreme';
export type CervixType = 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggwhite';
export type LHTestResult = 'negative' | 'positive' | 'peak';
export type SexType = 'protected' | 'unprotected' | 'none';
export type MoodType = 'happy' | 'sad' | 'anxious' | 'irritated' | 'energetic' | 'tired';

// NFP State Machine States
export type CycleState =
    | 'PRE_FERTILE'           // No signs yet
    | 'FERTILE_MID'           // First signs (LH mid/high or calc)
    | 'PEAK_LH'              // LH Peak recently detected
    | 'POST_OVU_PENDING'      // Peak passed, waiting for temp confirmation
    | 'OVU_CONFIRMED'         // Temperature shift confirmed ovulation
    | 'ANOVULATORY_SUSPECTED' // Peak but no temp shift after X days
    | 'MENSTRUATION';         // Bleeding

export interface CycleEntry {
    date: string; // YYYY-MM-DD
    temperature?: number | null;
    excludeTemp?: boolean;
    period?: PeriodFlow | null;
    pain?: PeriodPain | null;
    cervix?: CervixType | null;
    lhTest?: LHTestResult | null;
    sex?: SexType | null;
    symptoms?: string[];
    mood?: MoodType[];
    notes?: string;
    // Legacy/Manual overrides
    isOvulation?: boolean;
}

export interface CycleData {
    entries: Record<string, CycleEntry>;
    cycleLength: number; // Fallback / User Setting
    periodLength: number; // Fallback
    lutealPhase: number; // Fallback
}

export const DEFAULT_CYCLE_DATA: CycleData = {
    entries: {},
    cycleLength: 28,
    periodLength: 5,
    lutealPhase: 14,
};

// --- Analysis & Prediction Types ---

export interface CycleStatistics {
    avgCycleLength: number;
    medianCycleLength: number;
    stdDevCycleLength: number;

    avgLutealLength: number;
    medianLutealLength: number; // Based on confirmed cycles
    // Number of cycles analyzed
    historyCount: number;
}

export interface DailyPrediction {
    date: string;
    phase: 'menstruation' | 'follicular' | 'ovulatory' | 'luteal';
    fertilityLevel: 0 | 1 | 2 | 3; // 0=low, 1=monitor, 2=fertile, 3=peak
    isFertile: boolean;
    isPeriod: boolean;
    isOvulation: boolean; // Predicted or Confirmed
    isConfirmed: boolean; // True if ovulation confirmed by BBT
    cycleDay: number;
}

export interface FutureCycle {
    cycleStart: string;
    cycleStartLow: string; // Uncertainty range start
    cycleStartHigh: string; // Uncertainty range end

    ovulationDate: string;
    ovulationLow: string;
    ovulationHigh: string;

    fertileStart: string;
    fertileEnd: string;
}


export interface DateRangePrediction {
    mid: string;
    earliest: string;
    latest: string;
    confidence: 'LOW' | 'MED' | 'HIGH';
}

export interface CyclePhaseState {
    startDate: string;
    day: number;
    state: CycleState;

    // Predictions for THIS cycle
    ovulationPred?: DateRangePrediction;
    nextPeriodPred?: DateRangePrediction;

    // Confirmed Data
    ovulationConfirmedDate?: string;
    coverline?: number;
    lhPeaks: string[];
    activePeak?: string;
    coverlineProvisional?: boolean;
}

export interface EngineResult {
    statistics: CycleStatistics;
    currentCycle: CyclePhaseState;
    predictions: {
        today: DailyPrediction;
        futureCycles: FutureCycle[];
    };
}
