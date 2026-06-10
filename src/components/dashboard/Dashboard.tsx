'use client';
import { useCycleData } from '@/hooks/useCycleData';
import { m, useReducedMotion } from 'framer-motion';
import { useSyncExternalStore } from 'react';
import { Droplets, Thermometer, Activity, CheckCircle2, Leaf, Siren, AlertCircle, Calendar, TrendingUp, Heart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AiSummaryCard } from '@/components/dashboard/AiSummaryCard';
import { CycleRing, Blob } from '@/components/ui/blob';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { EntryDrawer } from '@/components/entry/EntryDrawer';
import { toLocalISO } from '@/lib/utils';
import { diffDays } from '@/lib/date-utils';

const StatCard = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) => (
    <div className="pressable flex-shrink-0 w-32 bg-card rounded-2xl p-3 shadow-soft border border-border/50">
        <Icon className="w-4 h-4 text-primary mb-2" aria-hidden="true" />
        <div className="text-base font-bold text-foreground font-sans">{value}</div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
);

// Client-only "heute" ohne setState-im-Effekt: useSyncExternalStore ist der
// sanktionierte Weg für Werte, die auf dem Server nicht existieren. Der
// Snapshot (lokaler Datums-String) ist innerhalb eines Tages stabil.
const emptySubscribe = () => () => {};
function useTodayISO(): string | null {
    return useSyncExternalStore(emptySubscribe, () => toLocalISO(), () => null);
}

export default function Dashboard() {
    const { isLoaded, engine } = useCycleData();
    const todayISO = useTodayISO();
    const reducedMotion = useReducedMotion();

    if (!isLoaded || !todayISO) return <DashboardSkeleton />;

    // Geladen, aber keine Einträge → freundlicher Leerzustand statt Dauer-Skeleton
    if (!engine) {
        return (
            <div className="relative flex flex-col items-center justify-center gap-5 px-6 pb-28 pt-2 text-center overflow-hidden h-[calc(100vh-200px)]">
                <Blob variant="corner" className="w-64 h-64 -top-20 -right-20 z-0" color="var(--phase-period)" />
                <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center relative z-10">
                    <Heart className="w-10 h-10 text-primary" aria-hidden="true" />
                </div>
                <div className="relative z-10">
                    <h2 className="text-xl font-serif font-semibold mb-2">Schön, dass du da bist!</h2>
                    <p className="text-sm text-muted-foreground max-w-xs">
                        Du hast noch keine Einträge. Lege deinen ersten Eintrag über den Plus-Button an — oder starte direkt hier.
                    </p>
                </div>
                <div className="w-full relative z-10">
                    <EntryDrawer>
                        <button className="pressable w-full py-4 bg-primary text-primary-foreground font-semibold rounded-2xl shadow-soft-lg text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            Ersten Eintrag anlegen
                        </button>
                    </EntryDrawer>
                </div>
            </div>
        );
    }

    const current = engine.currentCycle;
    const prediction = engine.predictions.today;
    const stats = engine.statistics;

    // Helpers
    const nextPeriodStr = engine.predictions.futureCycles[0]?.cycleStart;
    const daysToPeriod = nextPeriodStr ? Math.max(diffDays(nextPeriodStr, todayISO), 0) : null;

    // Phase style mapping — -text-Token erfüllen WCAG AA auf den -light-Flächen
    type PhaseStyle = { title: string; bg: string; text: string; icon: LucideIcon };

    const phaseStyles: Record<string, PhaseStyle> = {
        'MENSTRUATION': { title: 'Periode', bg: 'bg-[var(--phase-period-light)]', text: 'text-[var(--phase-period-text)]', icon: Droplets },
        'PRE_FERTILE': { title: 'Follikelphase', bg: 'bg-accent', text: 'text-accent-foreground', icon: Leaf },
        'FERTILE_MID': { title: 'Fruchtbar', bg: 'bg-[var(--phase-fertile-light)]', text: 'text-[var(--phase-fertile-text)]', icon: Thermometer },
        'PEAK_LH': { title: 'Hochfruchtbar', bg: 'bg-[var(--phase-ovulation-light)]', text: 'text-[var(--phase-ovulation-text)]', icon: Siren },
        'POST_OVU_PENDING': { title: 'Eisprung möglich', bg: 'bg-[var(--phase-ovulation-light)]', text: 'text-[var(--phase-ovulation-text)]', icon: Activity },
        'OVU_CONFIRMED': { title: 'Lutealphase', bg: 'bg-[var(--phase-luteal-light)]', text: 'text-[var(--phase-luteal-text)]', icon: CheckCircle2 },
        'ANOVULATORY_SUSPECTED': { title: 'Unklar', bg: 'bg-muted', text: 'text-muted-foreground', icon: AlertCircle },
    };

    const phaseStyle = phaseStyles[current.state] || { title: 'Lutealphase', bg: 'bg-[var(--phase-luteal-light)]', text: 'text-[var(--phase-luteal-text)]', icon: Activity };

    // Suggestion Text
    let suggestion = "";
    if (current.state === 'OVU_CONFIRMED' && current.ovulationConfirmedDate) {
        const daysSince = diffDays(todayISO, current.ovulationConfirmedDate);
        suggestion = `Temperaturhochlage seit ${daysSince} Tagen. Fruchtbares Fenster geschlossen.`;
    } else if (current.state === 'PEAK_LH') {
        suggestion = "LH-Peak erkannt! Eisprung voraussichtlich in 24-36h. Beste Zeit für GV.";
    } else if (prediction.fertilityLevel > 0) {
        suggestion = "Fruchtbare Tage. Beobachte deinen Zervixschleim.";
    }

    // Einstiegs-Stagger: 60ms Versatz, dezentes Y, kräftiges ease-out.
    // MotionConfig reducedMotion="user" neutralisiert die Transforms,
    // die Varianten degradieren dann zu reinem Fade.
    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: reducedMotion ? 0 : 0.06 } }
    };
    const item = {
        hidden: { opacity: 0, y: reducedMotion ? 0 : 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] as const } }
    };

    return (
        <m.div
            variants={container}
            initial="hidden"
            animate="show"
            className="flex flex-col items-center gap-5 pb-28 px-4 pt-2 overflow-hidden"
        >
            {/* Blob decorations + CycleRing */}
            <m.div variants={item} className="relative flex items-center justify-center" style={{ minHeight: 220 }}>
                <Blob variant="hero" className="w-72 h-72 -top-10 -left-16 z-0" color="var(--phase-period)" />
                <Blob variant="accent" className="w-56 h-56 -top-4 -right-12 z-0" color="var(--phase-luteal)" />
                <div className="relative z-10">
                    <CycleRing
                        day={current.day}
                        totalDays={stats.medianCycleLength || 28}
                        phase={current.state}
                        size={192}
                    />
                </div>
            </m.div>

            {/* Status Pill */}
            <m.div variants={item}>
                <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full shadow-soft ${phaseStyle.bg}`}>
                    <phaseStyle.icon className={`w-4 h-4 ${phaseStyle.text}`} aria-hidden="true" />
                    <span className={`text-sm font-semibold ${phaseStyle.text}`}>{phaseStyle.title} · Tag {current.day}</span>
                </div>
            </m.div>

            {/* AI Summary Card */}
            <m.div variants={item} className="w-full">
                <AiSummaryCard />
            </m.div>

            {/* Quick Stats Row */}
            <m.div variants={item} className="w-full">
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
                    <StatCard icon={Calendar} label="Nächste Periode" value={daysToPeriod !== null ? `${daysToPeriod} Tage` : '–'} />
                    <StatCard icon={TrendingUp} label="Zykluslänge" value={`Ø ${Math.round(stats.medianCycleLength)} Tage`} />
                    <StatCard icon={Activity} label="Lutealphase" value={`${Math.round(stats.medianLutealLength)} Tage`} />
                </div>
            </m.div>

            {/* CTA Button */}
            <m.div variants={item} className="w-full">
                <EntryDrawer>
                    <button className="pressable w-full py-4 bg-primary text-primary-foreground font-semibold rounded-2xl shadow-soft-lg text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        Wie geht es dir heute?
                    </button>
                </EntryDrawer>
            </m.div>

            {/* Suggestion text */}
            {suggestion && (
                <m.div variants={item}>
                    <p className="text-sm text-muted-foreground text-center px-4">{suggestion}</p>
                </m.div>
            )}
        </m.div>
    );
}
