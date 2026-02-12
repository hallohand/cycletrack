
'use client';

import { useCycleData } from '@/hooks/useCycleData';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { runEngine } from '@/lib/cycle-calculations';
import { groupCycles } from '@/lib/history-utils';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { de } from 'date-fns/locale';
import { addMonths, subMonths } from 'date-fns';
import { Info, Heart, Thermometer, Droplet, Activity, Plus, Pencil, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EntryDrawer } from '@/components/entry/EntryDrawer';
import { CycleEntry } from '@/lib/types';

export default function CalendarPage() {
    const { data, isLoaded } = useCycleData();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [month, setMonth] = useState<Date>(new Date());

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
            setSlideDirection(direction);
            setIsAnimating(true);

            setTimeout(() => {
                if (direction === 'left') {
                    setMonth(prev => addMonths(prev, 1));
                } else {
                    setMonth(prev => subMonths(prev, 1));
                }
                setSlideDirection(direction === 'left' ? 'right' : 'left');

                setTimeout(() => {
                    setSlideDirection(null);
                    setIsAnimating(false);
                }, 200);
            }, 150);
        }
    }, []);

    // Force re-render engine when data changes
    const engine = useMemo(() => isLoaded ? runEngine(data) : null, [data, isLoaded]);
    const historyCycles = useMemo(() => isLoaded ? groupCycles(data.entries) : [], [data, isLoaded]);

    const toLocalISO = (d: Date) => {
        const offset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - (offset * 60000));
        return local.toISOString().split('T')[0];
    };

    const safeSelectedDateStr = date ? toLocalISO(date) : '';
    const selectedEntry = safeSelectedDateStr ? data.entries[safeSelectedDateStr] : null;

    // --- Modifiers Logic ---
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
    };

    if (!isLoaded) return <div className="p-8 text-center text-muted-foreground animate-pulse">Laden...</div>;

    const getSlideClass = () => {
        if (!slideDirection) return 'translate-x-0 opacity-100';
        if (isAnimating && slideDirection === 'left') return '-translate-x-8 opacity-0';
        if (isAnimating && slideDirection === 'right') return 'translate-x-8 opacity-0';
        return 'translate-x-0 opacity-100';
    };

    // --- Detail View Components ---
    const DetailItem = ({ icon: Icon, label, value, color }: any) => (
        <div className="flex flex-col items-center bg-white p-2.5 rounded-xl border shadow-sm">
            <Icon className={`w-5 h-5 mb-1 ${color}`} />
            <span className="text-xs font-semibold text-center leading-tight truncate w-full">{value}</span>
            <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-background overflow-y-auto">
            {/* Calendar Container */}
            <div className="p-2 shrink-0">
                <div
                    className="overflow-hidden"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className={`transition-all duration-200 ease-out ${getSlideClass()}`}>
                        <Calendar
                            mode="single"
                            selected={date}
                            month={month}
                            onMonthChange={setMonth}
                            onSelect={handleDaySelect}
                            locale={de}
                            className="w-full border rounded-xl shadow-sm bg-white [--cell-size:38px]"
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
            </div>

            {/* Selected Date Details (Inline) */}
            <div className="flex-1 px-4 py-4 bg-muted/30 border-t min-h-0 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg text-primary">
                        {date ? date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Kein Datum gewählt'}
                    </h3>

                    {date && (
                        <EntryDrawer prefillDate={safeSelectedDateStr} onDeleted={() => { }}>
                            <Button variant="outline" size="sm" className="h-8">
                                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                Bearbeiten
                            </Button>
                        </EntryDrawer>
                    )}
                </div>

                {selectedEntry ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-2">
                            <DetailItem
                                icon={Thermometer}
                                label="Temp"
                                value={selectedEntry.temperature ? `${selectedEntry.temperature}°` : '–'}
                                color="text-rose-500"
                            />
                            <DetailItem
                                icon={Droplet}
                                label="Blutung"
                                value={selectedEntry.period === 'spotting' ? 'Schmier' : (selectedEntry.period || '–')}
                                color="text-blue-500"
                            />
                            <DetailItem
                                icon={Zap}
                                label="Schmerz"
                                value={selectedEntry.pain ? selectedEntry.pain : '–'}
                                color="text-orange-500"
                            />
                            <DetailItem
                                icon={Heart}
                                label="GV"
                                value={selectedEntry.sex ? 'Ja' : '–'}
                                color={selectedEntry.sex ? "text-red-500" : "text-gray-400"}
                            />
                        </div>

                        {/* Symptoms & Mood Tags */}
                        {(selectedEntry.symptoms && selectedEntry.symptoms.length > 0) || (selectedEntry.mood && selectedEntry.mood.length > 0) ? (
                            <div className="bg-white p-3 rounded-xl border shadow-sm">
                                <span className="text-xs font-semibold text-muted-foreground block mb-2">Symptome & Stimmung</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedEntry.symptoms?.map(s => (
                                        <span key={s} className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-md border border-slate-200">{s}</span>
                                    ))}
                                    {selectedEntry.mood?.map(m => (
                                        <span key={m} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-md border border-indigo-100 capitalize">{m}</span>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {/* LH / Cervix Row */}
                        <div className="grid grid-cols-2 gap-2">
                            {(selectedEntry.lhTest) && (
                                <div className="bg-white p-3 rounded-xl border shadow-sm flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">LH Test</span>
                                    <span className="text-sm font-semibold text-purple-600 uppercase">{selectedEntry.lhTest}</span>
                                </div>
                            )}
                            {(selectedEntry.cervix) && (
                                <div className="bg-white p-3 rounded-xl border shadow-sm flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">Zervix</span>
                                    <span className="text-sm font-semibold text-teal-600 capitalize">{selectedEntry.cervix}</span>
                                </div>
                            )}
                        </div>

                        {selectedEntry.notes && (
                            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-sm text-amber-900 italic">
                                "{selectedEntry.notes}"
                            </div>
                        )}
                    </div>
                ) : (
                    date && (
                        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-4 opacity-60">
                            <Info className="w-10 h-10 stroke-1" />
                            <p className="text-sm">Keine Einträge für diesen Tag.</p>
                            <EntryDrawer prefillDate={safeSelectedDateStr}>
                                <Button variant="outline">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Eintrag erstellen
                                </Button>
                            </EntryDrawer>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
