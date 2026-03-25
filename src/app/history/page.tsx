'use client';
import { useCycleData } from '@/hooks/useCycleData';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { PDFExportButton } from '@/components/history/PDFExportButton';
import { Skeleton } from '@/components/ui/skeleton';

export default function HistoryPage() {
    const { data, isLoaded, engine, cycles } = useCycleData();
    const [tab, setTab] = useState<'history' | 'forecast'>('history');
    const [expandedCycle, setExpandedCycle] = useState<string | null>(null);

    if (!isLoaded) return (
        <div className="flex flex-col px-4 gap-4 pt-6">
            <Skeleton className="w-48 h-7" />
            <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
            </div>
            <Skeleton className="w-32 h-5" />
            {[1,2,3,4].map(i => <Skeleton key={i} className="w-full h-12 rounded-xl" />)}
        </div>
    );

    const stats = engine?.statistics;
    const medianLen = stats?.medianCycleLength || data.cycleLength || 28;
    const periodLen = data.periodLength || 5;

    // Find the longest completed cycle for proportional bar widths
    const completedCycles = cycles.filter((_, i) => i > 0); // skip current (index 0)
    const maxCycleLen = Math.max(medianLen, ...completedCycles.map(c => c.length || 0), ...(cycles[0]?.length ? [cycles[0].length] : []));

    // Determine if a cycle is irregular (>25% deviation from median) — only for completed cycles
    const isIrregular = (len: number | undefined, isCurrentCycle: boolean) => {
        if (isCurrentCycle) return false; // never mark current cycle
        if (!len || !medianLen) return false;
        return Math.abs(len - medianLen) / medianLen > 0.25;
    };

    // Future cycles for forecast tab
    const futureCycles = engine?.predictions.futureCycles || [];

    return (
        <div className="flex flex-col px-4 overflow-hidden" style={{ height: 'calc(100dvh - 52px - 32px - 112px)' }}>
            {/* Header */}
            <div className="flex justify-between items-center mb-3 shrink-0">
                <h2 className="text-xl font-bold tracking-tight font-serif">Periode & Ovulation</h2>
                <PDFExportButton cycles={cycles} />
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 mb-4 shrink-0">
                <div className="bg-[var(--phase-period-light)] rounded-3xl shadow-soft p-4 flex flex-col items-start relative overflow-hidden">
                    <span className="text-2xl font-bold text-[var(--phase-period)]">{periodLen} Tage</span>
                    <span className="text-xs text-[var(--phase-period)]/70 mt-0.5">Periodenlänge</span>
                </div>
                <div className="bg-[var(--phase-ovulation-light)] rounded-3xl shadow-soft p-4 flex flex-col items-start relative overflow-hidden">
                    <span className="text-2xl font-bold text-[var(--phase-ovulation)]">{medianLen} Tage</span>
                    <span className="text-xs text-[var(--phase-ovulation)]/70 mt-0.5">Zykluslänge</span>
                </div>
            </div>

            {/* Section Title + Tabs */}
            <div className="mb-3 shrink-0">
                <h3 className="text-base font-semibold mb-2 font-serif">Meine Zyklen</h3>
                <div className="flex bg-muted rounded-full p-0.5">
                    <button
                        onClick={() => setTab('history')}
                        className={`flex-1 py-1.5 text-sm font-medium rounded-full transition-all ${tab === 'history'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Verlauf
                    </button>
                    <button
                        onClick={() => setTab('forecast')}
                        className={`flex-1 py-1.5 text-sm font-medium rounded-full transition-all ${tab === 'forecast'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Prognose
                    </button>
                </div>
            </div>

            {/* Cycle List — only this scrolls */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-2 scrollbar-hide">
                {tab === 'history' ? (
                    cycles.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm py-8">Noch keine Zyklusdaten vorhanden.</p>
                    ) : (
                        cycles.map((cycle, i) => {
                            const len = cycle.length || 0;
                            const pLen = cycle.periodLength;
                            const isCurrentCycle = i === 0;
                            const irregular = isIrregular(len, isCurrentCycle);

                            // Find ovulation and fertile window
                            const ovuIdx = cycle.days.findIndex(d => d.isOvulation);
                            const fertileStart = cycle.days.findIndex(d => d.isFertile);
                            const fertileEnd = cycle.days.length - 1 - [...cycle.days].reverse().findIndex(d => d.isFertile);

                            // Bar proportions relative to longest cycle
                            const barWidthPct = maxCycleLen > 0 ? (len / maxCycleLen) * 100 : 100;
                            const periodPct = len > 0 ? (pLen / len) * 100 : 20;
                            const ovuPct = ovuIdx >= 0 && len > 0 ? ((ovuIdx + 0.5) / len) * 100 : -1;
                            const fertStartPct = fertileStart >= 0 && len > 0 ? (fertileStart / len) * 100 : -1;
                            const fertWidthPct = fertileStart >= 0 && fertileEnd >= fertileStart && len > 0
                                ? ((fertileEnd - fertileStart + 1) / len) * 100 : 0;

                            const startStr = new Date(cycle.startDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
                            const endStr = cycle.endDate
                                ? new Date(cycle.endDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
                                : 'Heute';

                            return (
                                <div key={cycle.id} className="space-y-1">
                                    <button
                                        onClick={() => setExpandedCycle(expandedCycle === cycle.id ? null : cycle.id)}
                                        className="w-full text-left transition-transform active:scale-[0.99]"
                                    >
                                        {/* Date range + irregular badge */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">
                                                {startStr} – {endStr}
                                            </span>
                                            {irregular && (
                                                <span className="text-[10px] font-medium text-[var(--phase-ovulation)] flex items-center gap-0.5">
                                                    Unregelmäßig
                                                </span>
                                            )}
                                        </div>

                                        {/* Cycle Bar */}
                                        <div className="flex items-center gap-2 mt-1">
                                            {/* Bar — width proportional to longest cycle */}
                                            <div className="relative h-10 rounded-full overflow-hidden bg-muted" style={{ width: `${barWidthPct}%` }}>
                                                {/* Period segment */}
                                                <div
                                                    className="absolute top-0 bottom-0 left-0 rounded-full bg-[var(--phase-period)] flex items-center justify-center"
                                                    style={{ width: `${periodPct}%`, minWidth: '24px' }}
                                                >
                                                    <span className="text-[10px] font-bold text-white">{pLen}</span>
                                                </div>

                                                {/* Fertile window */}
                                                {fertStartPct >= 0 && fertWidthPct > 0 && (
                                                    <div
                                                        className="absolute top-0 bottom-0 rounded-full bg-[var(--phase-fertile)]/40"
                                                        style={{ left: `${fertStartPct}%`, width: `${fertWidthPct}%` }}
                                                    />
                                                )}

                                                {/* Ovulation marker — thick vertical line */}
                                                {ovuPct >= 0 && (
                                                    <div
                                                        className="absolute top-0.5 bottom-0.5 w-1 bg-[var(--phase-ovulation)] rounded-full z-10"
                                                        style={{ left: `calc(${ovuPct}% - 2px)` }}
                                                    />
                                                )}
                                            </div>

                                            {/* Cycle length */}
                                            <span className="text-xs font-bold text-foreground shrink-0">
                                                {len}
                                            </span>
                                        </div>
                                    </button>

                                    {/* Expanded details */}
                                    {expandedCycle === cycle.id && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-soft space-y-2 mt-2">
                                                <div className="grid grid-cols-3 gap-3 text-center">
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">Periodenlänge</div>
                                                        <div className="text-base font-bold font-sans">{pLen} Tage</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">Zykluslänge</div>
                                                        <div className="text-base font-bold font-sans">{len} Tage</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">Eisprung</div>
                                                        <div className="text-base font-bold font-sans">{ovuIdx >= 0 ? `Tag ${ovuIdx + 1}` : '–'}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            );
                        })
                    )
                ) : (
                    /* Prognose Tab */
                    futureCycles.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm py-8">Noch nicht genug Daten für eine Prognose.</p>
                    ) : (
                        futureCycles.map((fc, i) => {
                            const startStr = new Date(fc.cycleStart).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
                            const endDate = new Date(fc.cycleStart);
                            endDate.setDate(endDate.getDate() + (medianLen - 1));
                            const endStr = endDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });

                            const barWidthPct = maxCycleLen > 0 ? (medianLen / maxCycleLen) * 100 : 100;
                            const periodPct = (periodLen / medianLen) * 100;

                            // Ovulation position
                            const ovuDate = new Date(fc.ovulationDate);
                            const ovuDayIdx = Math.round((ovuDate.getTime() - new Date(fc.cycleStart).getTime()) / 86400000);
                            const ovuPct = (ovuDayIdx / medianLen) * 100;

                            // Fertile window
                            const fertStart = new Date(fc.fertileStart);
                            const fertEnd = new Date(fc.fertileEnd);
                            const fertStartIdx = Math.round((fertStart.getTime() - new Date(fc.cycleStart).getTime()) / 86400000);
                            const fertEndIdx = Math.round((fertEnd.getTime() - new Date(fc.cycleStart).getTime()) / 86400000);
                            const fertPctStart = (fertStartIdx / medianLen) * 100;
                            const fertPctWidth = ((fertEndIdx - fertStartIdx + 1) / medianLen) * 100;

                            return (
                                <div key={i} className="space-y-1 opacity-70 transition-transform active:scale-[0.99]">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                            {startStr} – {endStr}
                                        </span>
                                        <span className="text-[10px] font-medium text-[var(--phase-fertile)] italic">Prognose</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="relative h-10 rounded-full overflow-hidden bg-muted/50 border border-dashed border-border pulse-prediction" style={{ width: `${barWidthPct}%` }}>
                                            {/* Predicted period */}
                                            <div
                                                className="absolute top-0 bottom-0 left-0 rounded-full bg-[var(--phase-period)]/30 flex items-center justify-center"
                                                style={{ width: `${periodPct}%`, minWidth: '24px' }}
                                            >
                                                <span className="text-[10px] font-bold text-[var(--phase-period)]/70">{periodLen}</span>
                                            </div>

                                            {/* Predicted fertile window */}
                                            <div
                                                className="absolute top-0 bottom-0 rounded-full bg-[var(--phase-fertile)]/30"
                                                style={{ left: `${fertPctStart}%`, width: `${fertPctWidth}%` }}
                                            />

                                            {/* Predicted ovulation — thick line */}
                                            <div
                                                className="absolute top-0.5 bottom-0.5 w-1 bg-[var(--phase-ovulation)]/60 rounded-full z-10"
                                                style={{ left: `calc(${ovuPct}% - 2px)` }}
                                            />
                                        </div>

                                        <span className="text-xs font-bold text-muted-foreground shrink-0">
                                            {medianLen}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )
                )}
            </div>

            {/* Legend — fixed at bottom, above navbar */}
            <div className="flex justify-center gap-3 text-[10px] text-muted-foreground py-2 shrink-0 border-t border-border/30">
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[var(--phase-period)]"></div> Periode</div>
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-[var(--phase-fertile)]"></div> Fruchtbar</div>
                <div className="flex items-center gap-1"><div className="w-1 h-3 rounded-full bg-[var(--phase-ovulation)]"></div> Eisprung</div>
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-muted border border-border"></div> Luteal</div>
            </div>
        </div>
    );
}
