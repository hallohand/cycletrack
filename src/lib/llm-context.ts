// LLM Context Builder for CycleTrack
// Builds system prompts and data context from cycle data + engine results

import { CycleData, EngineResult } from '@/lib/types';
import { CycleGroup, groupCycles } from '@/lib/history-utils';

interface CycleContext {
    heute: string;
    zyklusTag: number;
    phase: string;
    fruchtbarkeit: string;
    temperaturHeute?: number;
    coverline?: number;
    eisprungBestätigt?: string;
    nächstePeriode?: { datum: string; konfidenz: string };
    eisprungPrognose?: { datum: string; konfidenz: string };
    statistiken: {
        zykluslänge: number;
        periodenlänge: number;
        stdAbweichung: number;
        anzahlZyklen: number;
    };
    letzteTemperaturen: number[];
    auffälligkeiten: string[];
}

const PHASE_NAMES: Record<string, string> = {
    menstruation: 'Menstruation',
    follicular: 'Follikelphase',
    ovulatory: 'Eisprungphase',
    luteal: 'Lutealphase',
};

const FERTILITY_NAMES: Record<number, string> = {
    0: 'niedrig',
    1: 'beobachten',
    2: 'fruchtbar',
    3: 'hochfruchtbar (Eisprung)',
};

function getRecentTemps(data: CycleData, days: number = 7): number[] {
    const today = new Date();
    const temps: number[] = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().split('T')[0];
        const entry = data.entries?.[iso];
        if (entry?.temperature) {
            temps.push(entry.temperature);
        }
    }
    return temps;
}

function detectAnomalies(engine: EngineResult, cycles: CycleGroup[]): string[] {
    const anomalies: string[] = [];
    const stats = engine.statistics;

    // Check cycle regularity
    if (stats.stdDevCycleLength > 4) {
        anomalies.push(`Zyklen sind unregelmäßig (Standardabweichung: ${stats.stdDevCycleLength.toFixed(1)} Tage)`);
    }

    // Check if ovulation was confirmed
    const cc = engine.currentCycle;
    if (cc.ovulationConfirmedDate) {
        anomalies.push(`Eisprung am ${formatDateDE(cc.ovulationConfirmedDate)} durch Temperaturanstieg bestätigt`);
    }

    // Check coverline
    if (cc.coverline) {
        anomalies.push(`Coverline bei ${cc.coverline.toFixed(2)}°C`);
    }

    // Check very short or long cycles
    const completedCycles = cycles.filter((_, i) => i > 0);
    const shortCycles = completedCycles.filter(c => (c.length || 0) < 21);
    const longCycles = completedCycles.filter(c => (c.length || 0) > 35);
    if (shortCycles.length > 0) {
        anomalies.push(`${shortCycles.length} Zyklus(en) kürzer als 21 Tage`);
    }
    if (longCycles.length > 0) {
        anomalies.push(`${longCycles.length} Zyklus(en) länger als 35 Tage`);
    }

    return anomalies;
}

function formatDateDE(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

export function buildCycleContext(data: CycleData, engine: EngineResult): CycleContext {
    const cc = engine.currentCycle;
    const today = new Date().toISOString().split('T')[0];
    const prediction = engine.predictions.today;
    const cycles = groupCycles(data.entries || {});
    const temps = getRecentTemps(data, 10);

    // Get today's temperature
    const todayEntry = data.entries?.[today];
    const tempToday = todayEntry?.temperature;

    const context: CycleContext = {
        heute: today,
        zyklusTag: cc.day,
        phase: PHASE_NAMES[prediction.phase] || prediction.phase,
        fruchtbarkeit: FERTILITY_NAMES[prediction.fertilityLevel] || 'unbekannt',
        statistiken: {
            zykluslänge: engine.statistics.medianCycleLength,
            periodenlänge: data.periodLength || 5,
            stdAbweichung: Math.round(engine.statistics.stdDevCycleLength * 10) / 10,
            anzahlZyklen: engine.statistics.historyCount,
        },
        letzteTemperaturen: temps,
        auffälligkeiten: detectAnomalies(engine, cycles),
    };

    if (tempToday) context.temperaturHeute = tempToday;
    if (cc.coverline) context.coverline = cc.coverline;
    if (cc.ovulationConfirmedDate) context.eisprungBestätigt = cc.ovulationConfirmedDate;

    if (cc.nextPeriodPred) {
        context.nächstePeriode = {
            datum: formatDateDE(cc.nextPeriodPred.mid),
            konfidenz: cc.nextPeriodPred.confidence,
        };
    }

    if (cc.ovulationPred && !cc.ovulationConfirmedDate) {
        context.eisprungPrognose = {
            datum: formatDateDE(cc.ovulationPred.mid),
            konfidenz: cc.ovulationPred.confidence,
        };
    }

    return context;
}

export function buildSystemPrompt(data: CycleData, engine: EngineResult): string {
    const context = buildCycleContext(data, engine);

    const roleDefinition = `Du bist eine einfühlsame Beraterin für Zyklusgesundheit und Schwangerschaftsplanung in der App CycleTrack. Du analysierst Zyklusdaten und gibst hilfreiche, evidenzbasierte Tipps zu Fruchtbarkeit, Eisprung-Timing, Schwangerschaftschancen, und allgemeiner Zyklusgesundheit.
Antworte auf Deutsch, kurz und verständlich. Verwende Emojis sparsam.`;

    const dataContext = `Hier sind die aktuellen Zyklusdaten der Nutzerin:
${JSON.stringify(context, null, 2)}`;

    const instructions = `Beziehe dich auf die Daten. Nenne konkrete Zahlen wenn hilfreich.
Halte Antworten unter 200 Wörtern. Formatiere mit kurzen Absätzen.`;

    return `${roleDefinition}\n\n${dataContext}\n\n${instructions}`;
}

export function buildSummaryPrompt(): string {
    return `Erstelle eine kurze, persönliche Zusammenfassung (max 3 Sätze) zum aktuellen Zyklusstatus. Berücksichtige die aktuelle Phase, Fruchtbarkeit, Schwangerschaftschancen, und nächste Prognosen. Sei warm und ermutigend. Keine Überschriften, kein Markdown — nur Fließtext.`;
}

/**
 * Simple hash for change detection
 */
export function hashEntries(entries: Record<string, unknown>): string {
    const str = JSON.stringify(entries);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return hash.toString(36);
}
