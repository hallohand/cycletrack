'use client';

import { useCycleData } from '@/hooks/useCycleData';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { runEngine } from '@/lib/cycle-calculations';
import { groupCycles } from '@/lib/history-utils';
import { useState, useMemo, useRef, useCallback } from 'react';
import { de } from 'date-fns/locale';
import { addMonths, subMonths } from 'date-fns';
import { Info, Heart, Thermometer, Droplet, Activity, Plus, Pencil } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { EntryDrawer } from '@/components/entry/EntryDrawer';

export default function CalendarPage() {
    const { data, isLoaded } = useCycleData();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [month, setMonth] = useState<Date>(new Date());
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Swipe animation state
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    // Swipe handling
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    }, []);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;
        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
            const direction = deltaX < 0 ? 'left' : 'right';
            // Trigger slide-out animation
            setSlideDirection(direction);
            setIsAnimating(true);

            // After slide-out, change month and slide-in
            setTimeout(() => {
                if (direction === 'left') {
                    setMonth(prev => addMonths(prev, 1));
                } else {
                    setMonth(prev => subMonths(prev, 1));
                }
                setSlideDirection(direction === 'left' ? 'right' : 'left'); // Enter from opposite side

                setTimeout(() => {
                    setSlideDirection(null);
                    setIsAnimating(false);
                }, 200);
            }, 150);
        }
    }, []);

    const engine = useMemo(() => isLoaded ? runEngine(data) : null, [data, isLoaded]);
    const historyCycles = useMemo(() => isLoaded ? groupCycles(data.entries) : [], [data, isLoaded]);

    const toLocalISO = (d: Date) => {
        const offset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - (offset * 60000));
        return local.toISOString().split('T')[0];
    };

    const safeSelectedDateStr = date ? toLocalISO(date) : '';
    const selectedEntry = safeSelectedDateStr ? data.entries[safeSelectedDateStr] : null;

    const modifiers = useMemo(() => {
        if (!engine) return {};

        const m: Record<string, Date[]> = {
            period: [],
            predicted_period: [],
            fertile: [],
            predicted_fertile: [],
            ovulation: [],
            predicted_ovulation: [],
            spotting: [],
            sex: [],
        };

        const parseDate = (dString: string) => {
            const [y, mo, da] = dString.split('-').map(Number);
            return new Date(y, mo - 1, da);
        };

        historyCycles.forEach(cycle => {
            cycle.days.forEach(day => {
                const localDate = parseDate(day.date);
                if (day.isPeriod) m.period.push(localDate);
                if (day.isFertile) m.fertile.push(localDate);
                if (day.isOvulation) m.ovulation.push(localDate);
                if (day.isSpotting) m.spotting.push(localDate);
                if (day.hasSex) m.sex.push(localDate);
            });
        });

        engine.predictions.futureCycles.forEach(cycle => {
            const parse = (iso: string) => {
                const [y, mo, da] = iso.split('-').map(Number);
                return new Date(y, mo - 1, da);
            };

            const pStart = parse(cycle.cycleStart);
            for (let i = 0; i < (data.periodLength || 5); i++) {
                const d = new Date(pStart);
                d.setDate(d.getDate() + i);
                m.predicted_period.push(d);
            }

            const fStart = parse(cycle.fertileStart);
            const fEnd = parse(cycle.fertileEnd);
            let cur = new Date(fStart);
            while (cur <= fEnd) {
                m.predicted_fertile.push(new Date(cur));
                cur.setDate(cur.getDate() + 1);
            }

            m.predicted_ovulation.push(parse(cycle.ovulationDate));
        });

        return m;
    }, [engine, historyCycles, data.periodLength]);

    const handleDaySelect = (d: Date | undefined) => {
        setDate(d);
        if (d) setIsDetailsOpen(true);
    };

    if (!isLoaded) return <div className="p-8 text-center text-muted-foreground animate-pulse">Laden...</div>;

    const todayPrediction = engine?.predictions.today;
    const phaseLabel = todayPrediction
        ? todayPrediction.phase === 'luteal' ? 'Lutealphase'
            : todayPrediction.phase === 'follicular' ? 'Follikelphase'
                : todayPrediction.phase === 'menstruation' ? 'Periode'
                    : 'Eisprungphase'
        : '';

    // Slide animation classes
    const getSlideClass = () => {
        if (!slideDirection) return 'translate-x-0 opacity-100';
        if (isAnimating && slideDirection === 'left') return '-translate-x-8 opacity-0';
        if (isAnimating && slideDirection === 'right') return 'translate-x-8 opacity-0';
        return 'translate-x-0 opacity-100';
    };

    return (
        <div className="flex flex-col h-[calc(100dvh-210px)]">
            {/* Calendar with swipe + animation */}
            <div
                className="px-2 flex-1 min-h-0 overflow-x-hidden"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <div className={`transition-all duration-200 ease-out h-full ${getSlideClass()}`}>
                    <Calendar
                        mode="single"
                        selected={date}
                        month={month}
                        onMonthChange={setMonth}
                        onSelect={handleDaySelect}
                        locale={de}
                        className="w-full h-full [--cell-size:clamp(28px,8vw,36px)]"
                        modifiers={modifiers}
                        modifiersClassNames={{
                            period: "bg-rose-100 text-rose-700 font-semibold rounded-md",
                            predicted_period: "bg-rose-50 text-rose-400 rounded-md border border-dashed border-rose-200",
                            fertile: "bg-sky-100 text-sky-700 rounded-md",
                            predicted_fertile: "bg-sky-50 text-sky-400 rounded-md border border-dashed border-sky-200",
                            ovulation: "ring-2 ring-amber-400 ring-offset-1 bg-amber-50 text-amber-700 rounded-full font-bold",
                            predicted_ovulation: "ring-2 ring-amber-300 ring-offset-1 bg-amber-50/50 text-amber-400 rounded-full",
                            spotting: "bg-orange-50 text-orange-600 rounded-md",
                            sex: "after:content-['❤️'] after:absolute after:-top-1 after:-right-1 after:text-[8px] after:z-10",
                        }}
                    />
                </div>
            </div>

            {/* Bottom Summary — compact, shrink-0 */}
            <div className="border-t bg-muted/30 px-4 py-2 shrink-0">
                {/* Legend */}
                <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground mb-1.5 flex-wrap">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-rose-200 border border-rose-300"></div> Periode</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-sky-200 border border-sky-300"></div> Fruchtbar</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full ring-2 ring-amber-400 bg-amber-50"></div> Eisprung</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-rose-50 border border-dashed border-rose-300"></div> Prognose</div>
                </div>

                {/* Today Info */}
                <div className="flex items-baseline gap-2">
                    <span className="text-xs text-muted-foreground">
                        Heute, {new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
                    </span>
                    {todayPrediction ? (
                        <span className="text-sm font-semibold">
                            ZT {todayPrediction.cycleDay} · {phaseLabel}
                        </span>
                    ) : (
                        <span className="text-sm font-semibold text-muted-foreground">Keine Daten</span>
                    )}
                </div>
            </div>

            {/* Details Sheet */}
            <Sheet open={isDetailsOpen && !!date} onOpenChange={setIsDetailsOpen}>
                <SheetContent side="bottom" className="rounded-t-2xl">
                    <SheetHeader className="pb-4">
                        <SheetTitle>
                            {date?.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </SheetTitle>
                        <SheetDescription>
                            Tagesdetails
                        </SheetDescription>
                    </SheetHeader>

                    {selectedEntry ? (
                        <div className="grid grid-cols-2 gap-3 px-1">
                            <div className="bg-muted/50 p-3 rounded-xl flex flex-col items-center gap-1">
                                <Thermometer className="w-5 h-5 text-rose-500" />
                                <span className="text-sm font-semibold">{selectedEntry.temperature ? `${selectedEntry.temperature}°C` : '–'}</span>
                                <span className="text-[10px] text-muted-foreground">Temperatur</span>
                            </div>
                            <div className="bg-muted/50 p-3 rounded-xl flex flex-col items-center gap-1">
                                <Activity className="w-5 h-5 text-purple-500" />
                                <span className="text-sm font-semibold">{selectedEntry.lhTest === 'peak' ? 'PEAK' : selectedEntry.lhTest === 'positive' ? '+' : '–'}</span>
                                <span className="text-[10px] text-muted-foreground">LH Test</span>
                            </div>
                            <div className="bg-muted/50 p-3 rounded-xl flex flex-col items-center gap-1">
                                <Droplet className="w-5 h-5 text-blue-500" />
                                <span className="text-sm font-semibold capitalize">{selectedEntry.period === 'spotting' ? 'Schmier' : selectedEntry.period || '–'}</span>
                                <span className="text-[10px] text-muted-foreground">Blutung</span>
                            </div>
                            <div className="bg-muted/50 p-3 rounded-xl flex flex-col items-center gap-1">
                                <Heart className={cn("w-5 h-5", selectedEntry.sex ? "text-red-500 fill-red-500" : "text-muted-foreground")} />
                                <span className="text-sm font-semibold">{selectedEntry.sex ? 'Ja' : 'Nein'}</span>
                                <span className="text-[10px] text-muted-foreground">GV</span>
                            </div>

                            {selectedEntry.notes && (
                                <div className="col-span-2 bg-amber-50 p-3 rounded-xl border border-amber-200 text-sm italic text-amber-800">
                                    "{selectedEntry.notes}"
                                </div>
                            )}

                            {/* Edit button */}
                            <div className="col-span-2 pt-1">
                                <EntryDrawer prefillDate={safeSelectedDateStr} onDeleted={() => setIsDetailsOpen(false)}>
                                    <Button variant="outline" className="w-full">
                                        <Pencil className="w-4 h-4 mr-2" />
                                        Eintrag bearbeiten
                                    </Button>
                                </EntryDrawer>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-3">
                            <Info className="w-8 h-8 opacity-30" />
                            <p className="text-sm">Keine Einträge für diesen Tag.</p>
                            <EntryDrawer prefillDate={safeSelectedDateStr}>
                                <Button variant="outline" size="sm">
                                    <Plus className="w-4 h-4 mr-1" />
                                    Eintrag hinzufügen
                                </Button>
                            </EntryDrawer>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
