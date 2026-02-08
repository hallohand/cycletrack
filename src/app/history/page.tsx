'use client';
import { useCycleData } from '@/hooks/useCycleData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { calculateAverageCycleLength } from '@/lib/cycle-calculations';

export default function HistoryPage() {
    const { data, isLoaded } = useCycleData();

    if (!isLoaded) return <div className="p-8 text-center text-muted-foreground">Laden...</div>;

    const entries = Object.values(data.entries).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Group by Cycles
    // Logic: A cycle starts with the first day of period.
    // We need to iterate backwards.

    interface CycleGroup {
        startDate: string;
        endDate?: string;
        length?: number;
        entries: typeof entries;
    }

    const cycles: CycleGroup[] = [];
    let currentCycle: CycleGroup | null = null;

    // Simple heuristic: Period start marks new cycle.
    // Since we are iterating backwards (newest first), a period start marks the END of the previous cycle we processed (which is chronologically older).
    // Actually, iterating forwards (oldest first) is easier to group.

    const sortedEntries = [...entries].reverse(); // Oldest first

    let tempCycle: CycleGroup = { startDate: sortedEntries[0]?.date || '', entries: [] };

    let inPeriod = false;

    sortedEntries.forEach((e, i) => {
        // Detect start of period (current has period, previous didn't or was long ago)
        const isPeriodStart = e.period && (!sortedEntries[i - 1]?.period || (new Date(e.date).getTime() - new Date(sortedEntries[i - 1].date).getTime() > 1000 * 60 * 60 * 24 * 5));

        if (isPeriodStart && tempCycle.entries.length > 0) {
            // Finish previous cycle
            tempCycle.endDate = sortedEntries[i - 1]?.date;
            tempCycle.length = Math.floor((new Date(e.date).getTime() - new Date(tempCycle.startDate).getTime()) / (1000 * 60 * 60 * 24));
            cycles.push(tempCycle);

            // Start new cycle
            tempCycle = { startDate: e.date, entries: [] };
        }
        tempCycle.entries.push(e);
    });
    cycles.push(tempCycle); // Push current/last cycle

    const displayCycles = [...cycles].reverse(); // Newest first

    return (
        <div className="space-y-4 pb-20">
            <h2 className="text-2xl font-bold tracking-tight px-2">Verlauf</h2>

            <div className="grid grid-cols-2 gap-4 px-2 mb-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
                    <div className="text-2xl font-bold text-primary">{calculateAverageCycleLength(data.entries)}</div>
                    <div className="text-xs text-muted-foreground uppercase">Ø Tage / Zyklus</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
                    <div className="text-2xl font-bold">{data.periodLength || 5}</div>
                    <div className="text-xs text-muted-foreground uppercase">Ø Tage / Periode</div>
                </div>
            </div>

            <ScrollArea className="h-[60vh]">
                <div className="space-y-3 px-2">
                    {displayCycles.map((cycle, i) => (
                        <Card key={i} className="overflow-hidden border-none shadow-sm bg-white hover:bg-muted/30 transition-colors">
                            <CardHeader className="p-4 bg-muted/20 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-medium">
                                        {new Date(cycle.startDate).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                                    </CardTitle>
                                    <div className="text-xs text-muted-foreground">
                                        {new Date(cycle.startDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                                        {cycle.endDate ? ` - ${new Date(cycle.endDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}` : ' - Heute'}
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-muted-foreground/50">
                                    {cycle.length ? cycle.length : '...'}
                                </div>
                            </CardHeader>
                            {/* <CardContent className="p-4 text-xs text-muted-foreground">
                        {cycle.entries.filter(e => e.period).length} Tage Blutung
                    </CardContent> */}
                        </Card>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
