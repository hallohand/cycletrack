'use client';
import { useCycleData } from '@/hooks/useCycleData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { groupCycles } from '@/lib/history-utils';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Heart } from 'lucide-react';

import { APP_VERSION } from '@/lib/version';

import { PDFExportButton } from '@/components/history/PDFExportButton';

export default function HistoryPage() {
    const { data, isLoaded } = useCycleData();

    const cycles = useMemo(() => {
        if (!data?.entries) return [];
        return groupCycles(data.entries);
    }, [data?.entries]);

    if (!isLoaded) return <div className="p-8 text-center text-muted-foreground">Laden...</div>;

    return (
        <div className="space-y-6 pb-24 px-4 pt-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Meine Zyklen</h2>
                <PDFExportButton cycles={cycles} />
            </div>

            <div className="space-y-4">
                {cycles.map((cycle, i) => (
                    <Card key={cycle.id} className="border-none shadow-sm bg-white overflow-hidden">
                        <CardHeader className="p-4 pb-2 flex flex-row items-baseline justify-between space-y-0">
                            <div className="space-y-1">
                                <CardTitle className="text-base font-semibold">
                                    {i === 0 ? 'Aktueller Zyklus' :
                                        `${new Date(cycle.startDate).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })}. - ${cycle.endDate ? new Date(cycle.endDate).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' }) + '.' : 'Heute'}`
                                    }
                                </CardTitle>
                                <p className="text-xs text-muted-foreground">{cycle.periodLength}-tägiger Zeitraum</p>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-lg font-bold">{cycle.length} Tage</span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                            {/* Cycle Bar Visualization */}
                            <div className="flex flex-wrap gap-1.5">
                                {cycle.days.map((day, idx) => {
                                    // Determine Color
                                    let colorClass = "bg-gray-200"; // Luteal/Normal
                                    if (day.isPeriod) colorClass = "bg-rose-400"; // Period
                                    else if (day.isSpotting) colorClass = "bg-yellow-700/50"; // Spotting (Brownish)
                                    else if (day.isOvulation) colorClass = "bg-yellow-400 border border-yellow-500 scale-110"; // Ovulation (Pop)
                                    else if (day.isFertile) colorClass = "bg-cyan-300"; // Fertile

                                    return (
                                        <div key={day.date} className="relative group">
                                            <div className={cn("w-3 h-3 rounded-full transition-all", colorClass)} />
                                            {day.hasSex && (
                                                <Heart className="w-2 h-2 text-rose-600 absolute -top-1 -right-1 fill-rose-600 stroke-[1px]" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-4 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-400"></div> Periode</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-700/50"></div> Schmier</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-300"></div> Fruchtbar</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-400"></div> Eisprung</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-gray-200"></div> Unfruchtbar</div>
            </div>
        </div>
    );
}
