'use client';
import { useCycleData } from '@/hooks/useCycleData';
import { groupCycles } from '@/lib/history-utils';
import { runEngine } from '@/lib/cycle-calculations';
import { useMemo, useState } from 'react';
import { PDFExportButton } from '@/components/history/PDFExportButton';

export default function HistoryPage() {
    const { data, isLoaded } = useCycleData();
    const [tab, setTab] = useState<'history' | 'forecast'>('history');

    const cycles = useMemo(() => {
        if (!data?.entries) return [];
        return groupCycles(data.entries);
    }, [data?.entries]);

    const engine = useMemo(() => {
        if (!data?.entries || Object.keys(data.entries).length === 0) return null;
        return runEngine(data);
    }, [data]);

    if (!isLoaded) return <div className="p-8 text-center text-muted-foreground animate-pulse">Laden...</div>;

    const stats = engine?.statistics;
    const medianLen = stats?.medianCycleLength || data.cycleLength || 28;
    const periodLen = data.periodLength || 5;

    // Determine if a cycle is irregular (>25% deviation from median)
    const isIrregular = (len: number | undefined) => {
        if (!len || !medianLen) return false;
        return Math.abs(len - medianLen) / medianLen > 0.25;
    };

    // Future cycles for forecast tab
    const futureCycles = engine?.predictions.futureCycles || [];

    return (
        <div className="flex flex-col h-[calc(100vh-160px)] px-4 pt-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-bold tracking-tight">Periode & Ovulation</h2>
                <PDFExportButton cycles={cycles} />
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-rose-50 rounded-2xl p-4 flex flex-col items-start relative overflow-hidden">
                    <span className="absolute top-3 right-3 text-rose-300 text-xl">🩸</span>
                    <span className="text-2xl font-bold text-rose-700">{periodLen} Tage</span>
                    <span className="text-xs text-rose-500 mt-0.5">Periodenlänge</span>
                </div>
                <div className="bg-amber-50 rounded-2xl p-4 flex flex-col items-start relative overflow-hidden">
                    <span className="absolute top-3 right-3 text-amber-300 text-xl">🔄</span>
                    <span className="text-2xl font-bold text-amber-700">{medianLen} Tage</span>
                    <span className="text-xs text-amber-500 mt-0.5">Zykluslänge</span>
                </div>
            </div>

            {/* Section Title + Tabs */}
            <div className="mb-3">
                <h3 className="text-base font-semibold mb-2">Meine Zyklen</h3>
                <div className="flex bg-muted rounded-full p-0.5">
                    <button
                        onClick={() => setTab('history')}
                        className={`flex-1 py-1.5 text-sm font-medium rounded-full transition-all ${tab === 'history'
                                ? 'bg-rose-400 text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Verlauf
                    </button>
                    <button
                        onClick={() => setTab('forecast')}
                        className={`flex-1 py-1.5 text-sm font-medium rounded-full transition-all ${tab === 'forecast'
                                ? 'bg-rose-400 text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Prognose
                    </button>
                </div>
            </div>

            {/* Cycle List */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pb-4 scrollbar-hide">
                {tab === 'history' ? (
                    cycles.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm py-8">Noch keine Zyklusdaten vorhanden.</p>
                    ) : (
                        cycles.map((cycle, i) => {
                            const len = cycle.length || 0;
                            const pLen = cycle.periodLength;
                            const irregular = isIrregular(len);

                            // Find ovulation day index
                            const ovuIdx = cycle.days.findIndex(d => d.isOvulation);

                            // Bar proportions
                            const periodPct = len > 0 ? (pLen / len) * 100 : 20;
                            const ovuPct = ovuIdx >= 0 && len > 0 ? ((ovuIdx + 0.5) / len) * 100 : -1;

                            const startStr = new Date(cycle.startDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
                            const endStr = cycle.endDate
                                ? new Date(cycle.endDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
                                : 'Heute';

                            return (
                                <div key={cycle.id} className="space-y-1">
                                    {/* Date range + irregular badge */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                            {startStr} – {endStr}
                                        </span>
                                        {irregular && (
                                            <span className="text-[10px] font-medium text-orange-600 flex items-center gap-0.5">
                                                ⚠ Unregelmäßig
                                            </span>
                                        )}
                                    </div>

                                    {/* Cycle Bar */}
                                    <div className="flex items-center gap-2">
                                        {/* Period length badge */}
                                        <span className="text-xs font-bold text-rose-600 bg-rose-100 rounded-full w-7 h-7 flex items-center justify-center shrink-0">
                                            {pLen}
                                        </span>

                                        {/* Bar */}
                                        <div className="flex-1 relative h-7 rounded-full overflow-hidden bg-gray-100">
                                            {/* Period segment */}
                                            <div
                                                className="absolute top-0 bottom-0 left-0 rounded-l-full bg-rose-300"
                                                style={{ width: `${periodPct}%` }}
                                            />
                                            {/* Ovulation marker */}
                                            {ovuPct >= 0 && (
                                                <div
                                                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-amber-400 border-2 border-amber-500 z-10"
                                                    style={{ left: `calc(${ovuPct}% - 8px)` }}
                                                />
                                            )}
                                        </div>

                                        {/* Cycle length */}
                                        <span className="text-xs font-bold text-foreground w-7 text-right shrink-0">
                                            {len}
                                        </span>
                                    </div>
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
                                <div key={i} className="space-y-1 opacity-70">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                            {startStr} – {endStr}
                                        </span>
                                        <span className="text-[10px] font-medium text-sky-500 italic">Prognose</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-rose-400 bg-rose-50 rounded-full w-7 h-7 flex items-center justify-center shrink-0 border border-dashed border-rose-200">
                                            {periodLen}
                                        </span>

                                        <div className="flex-1 relative h-7 rounded-full overflow-hidden bg-gray-50 border border-dashed border-gray-200">
                                            {/* Predicted period */}
                                            <div
                                                className="absolute top-0 bottom-0 left-0 rounded-l-full bg-rose-200/60"
                                                style={{ width: `${periodPct}%` }}
                                            />
                                            {/* Predicted fertile window */}
                                            <div
                                                className="absolute top-0 bottom-0 bg-sky-200/40"
                                                style={{ left: `${fertPctStart}%`, width: `${fertPctWidth}%` }}
                                            />
                                            {/* Predicted ovulation */}
                                            <div
                                                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-amber-300/70 border-2 border-dashed border-amber-400 z-10"
                                                style={{ left: `calc(${ovuPct}% - 8px)` }}
                                            />
                                        </div>

                                        <span className="text-xs font-bold text-muted-foreground w-7 text-right shrink-0">
                                            {medianLen}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )
                )}
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-3 text-[10px] text-muted-foreground py-2 shrink-0">
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-rose-300"></div> Periode</div>
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div> Eisprung</div>
                {tab === 'forecast' && (
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-sky-200/60"></div> Fruchtbar</div>
                )}
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-gray-100 border border-gray-300"></div> Luteal</div>
            </div>
        </div>
    );
}
