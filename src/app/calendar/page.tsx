
'use client';

import { useCycleData } from '@/hooks/useCycleData';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { de } from 'date-fns/locale';
import { addMonths, subMonths } from 'date-fns';
import { Info, Heart, Thermometer, Droplet, Activity, Plus, Pencil, Zap, LucideIcon } from 'lucide-react';
import { cn, toLocalISO } from '@/lib/utils';
import { EntryDrawer } from '@/components/entry/EntryDrawer';
import { CycleEntry } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

interface DetailItemProps {
    icon: LucideIcon;
    label: string;
    value: string;
    color: string;
}

const DetailItem = ({ icon: Icon, label, value, color }: DetailItemProps) => (
    <div className="flex flex-col items-center bg-card p-3 rounded-2xl border border-border/50 shadow-soft">
        <Icon className={`w-5 h-5 mb-1.5 ${color}`} />
        <span className="text-xs font-bold text-center leading-tight truncate w-full">{value}</span>
        <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
    </div>
);

export default function CalendarPage() {
    const { data, isLoaded, engine, cycles: historyCycles } = useCycleData();
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

        // Add current cycle predictions
        if (engine.currentCycle) {
            const parse = (iso: string) => {
                const [y, mo, da] = iso.split('-').map(Number);
                return new Date(y, mo - 1, da);
            };

            // Current cycle next period prediction
            if (engine.currentCycle.nextPeriodPred) {
                const pStart = parse(engine.currentCycle.nextPeriodPred.mid);
                for (let i = 0; i < (data.periodLength || 5); i++) {
                    const d = new Date(pStart);
                    d.setDate(d.getDate() + i);
                    m.predicted_period.push(d);
                }
            }

            // Current cycle ovulation & fertile window prediction
            // Only show prediction if not already confirmed
            if (!engine.currentCycle.ovulationConfirmedDate && engine.currentCycle.ovulationPred) {
                const oMid = engine.currentCycle.ovulationPred.mid;
                const oDate = parse(oMid);
                m.predicted_ovulation.push(oDate);

                // Fertile window: Ovu - 5 to Ovu + 1
                const fStart = new Date(oDate);
                fStart.setDate(fStart.getDate() - 5);

                const fEnd = new Date(oDate);
                fEnd.setDate(fEnd.getDate() + 1);

                let cur = new Date(fStart);
                while (cur <= fEnd) {
                    m.predicted_fertile.push(new Date(cur));
                    cur.setDate(cur.getDate() + 1);
                }
            }
        }

        return m;
    }, [engine, historyCycles, data.periodLength]);

    const handleDaySelect = (d: Date | undefined) => {
        setDate(d);
    };

    if (!isLoaded) return (
        <div className="flex flex-col gap-3 px-2 pt-2">
            <Skeleton className="w-full h-[320px] rounded-2xl" />
            <Skeleton className="w-full h-32 rounded-2xl" />
        </div>
    );

    const getSlideClass = () => {
        if (!slideDirection) return 'translate-x-0 opacity-100';
        if (isAnimating && slideDirection === 'left') return '-translate-x-8 opacity-0';
        if (isAnimating && slideDirection === 'right') return 'translate-x-8 opacity-0';
        return 'translate-x-0 opacity-100';
    };

    const periodMap: Record<string, string> = { light: 'Leicht', medium: 'Mittel', heavy: 'Stark', spotting: 'Schmier' };
    const painMap: Record<string, string> = { light: 'Leicht', medium: 'Mittel', strong: 'Stark', extreme: 'Extrem' };
    const cervixMap: Record<string, string> = { dry: 'Trocken', sticky: 'Klebrig', creamy: 'Cremig', watery: 'Wässrig', eggwhite: 'Spinnbar' };

    return (
        <div className="flex flex-col h-full bg-background overflow-y-auto">
            {/* Calendar Container */}
            <div className="px-1 pt-0 pb-2 shrink-0">
                <div
                    className="overflow-hidden"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className={`transition-all duration-200 ease-out ${getSlideClass()}`}>
                        <Calendar
                            mode="single"
                            fixedWeeks
                            selected={date}
                            month={month}
                            onMonthChange={setMonth}
                            onSelect={handleDaySelect}
                            locale={de}
                            className="w-full h-full [--cell-size:clamp(30px,9vw,40px)] bg-transparent border-none shadow-none rounded-2xl"
                            modifiers={modifiers}
                            modifiersClassNames={{
                                period: "bg-[var(--phase-period)] text-white font-semibold rounded-xl",
                                predicted_period: "bg-[var(--phase-period-light)] text-[var(--phase-period)] rounded-xl",
                                fertile: "bg-[var(--phase-fertile-light)] text-[var(--phase-fertile)] rounded-xl",
                                predicted_fertile: "bg-[var(--phase-fertile-light)]/60 text-[var(--phase-fertile)]/60 rounded-xl",
                                ovulation: "bg-[var(--phase-ovulation)] text-white rounded-full font-bold glow-ovulation",
                                predicted_ovulation: "bg-[var(--phase-ovulation-light)] text-[var(--phase-ovulation)] rounded-full",
                                spotting: "bg-[var(--phase-ovulation-light)] text-[var(--phase-ovulation)] rounded-xl",
                                sex: "after:content-['♥'] after:absolute after:-top-1 after:-right-1 after:text-[8px] after:text-primary after:z-10",
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Selected Date Details (Inline) */}
            <div className="flex-1 px-4 py-4 bg-muted/30 border-t min-h-0 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-serif font-semibold text-xl text-foreground">
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
                                color="text-primary"
                            />
                            <DetailItem
                                icon={Droplet}
                                label="Blutung"
                                value={selectedEntry.period === 'spotting' ? 'Schmier' : (selectedEntry.period ? (periodMap[selectedEntry.period] || selectedEntry.period) : '–')}
                                color="text-[var(--phase-fertile)]"
                            />
                            <DetailItem
                                icon={Zap}
                                label="Schmerz"
                                value={selectedEntry.pain ? (painMap[selectedEntry.pain] || selectedEntry.pain) : '–'}
                                color="text-[var(--phase-ovulation)]"
                            />
                            <DetailItem
                                icon={Heart}
                                label="GV"
                                value={selectedEntry.sex ? 'Ja' : '–'}
                                color={selectedEntry.sex ? "text-primary" : "text-muted-foreground"}
                            />
                        </div>

                        {/* Symptoms & Mood Tags */}
                        {(selectedEntry.symptoms && selectedEntry.symptoms.length > 0) || (selectedEntry.mood && selectedEntry.mood.length > 0) ? (
                            <div className="bg-card p-3 rounded-xl border shadow-sm">
                                <span className="text-xs font-semibold text-muted-foreground block mb-2">Symptome & Stimmung</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedEntry.symptoms?.map(s => (
                                        <span key={s} className="px-2 py-1 bg-muted text-foreground text-xs rounded-md border border-border">{s}</span>
                                    ))}
                                    {selectedEntry.mood?.map(m => {
                                        const moodLabels: Record<string, string> = {
                                            happy: 'Gut', energetic: 'Energisch', tired: 'Müde',
                                            sad: 'Traurig', anxious: 'Ängstlich', irritated: 'Gereizt',
                                            moodswings: 'Schwankungen'
                                        };
                                        return (
                                            <span key={m} className="px-2 py-1 bg-accent text-accent-foreground text-xs rounded-md border border-accent/50">{moodLabels[m] || m}</span>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}

                        {/* LH / Cervix Row */}
                        <div className="grid grid-cols-2 gap-2">
                            {(selectedEntry.lhTest) && (
                                <div className="bg-card p-3 rounded-xl border shadow-sm flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">LH Test</span>
                                    <span className="text-sm font-semibold text-[var(--phase-luteal)] uppercase">{selectedEntry.lhTest === 'peak' ? 'PEAK' : selectedEntry.lhTest === 'positive' ? 'Positiv' : 'Negativ'}</span>
                                </div>
                            )}
                            {(selectedEntry.cervix) && (
                                <div className="bg-card p-3 rounded-xl border shadow-sm flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">Zervix</span>
                                    <span className="text-sm font-semibold text-[var(--phase-fertile)]">
                                        {cervixMap[selectedEntry.cervix] || selectedEntry.cervix}
                                    </span>
                                </div>
                            )}
                        </div>

                        {selectedEntry.notes && (
                            <div className="bg-[var(--phase-ovulation-light)] p-3 rounded-2xl border border-[var(--phase-ovulation)]/20 text-sm text-foreground italic shadow-soft">
                                "{selectedEntry.notes}"
                            </div>
                        )}
                    </div>
                ) : (
                    date && (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                                <Info className="w-6 h-6 stroke-1" />
                            </div>
                            <p className="text-sm font-medium">Keine Einträge</p>
                            <EntryDrawer prefillDate={safeSelectedDateStr}>
                                <Button variant="outline" className="rounded-xl">
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
