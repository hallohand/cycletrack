'use client';
import { useCycleData } from '@/hooks/useCycleData';
import { motion } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import { Droplets, Thermometer, Activity, CheckCircle2, Leaf, Siren, AlertCircle, Calendar, TrendingUp, Heart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AiSummaryCard } from '@/components/dashboard/AiSummaryCard';
import { CycleRing, Blob } from '@/components/ui/blob';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { EntryDrawer } from '@/components/entry/EntryDrawer';

const StatCard = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) => (
    <div className="flex-shrink-0 w-32 bg-card rounded-2xl p-3 shadow-soft border border-border/50 transition-transform active:scale-[0.97]">
        <Icon className="w-4 h-4 text-primary mb-2" />
        <div className="text-base font-bold text-foreground font-sans">{value}</div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
);

export default function Dashboard() {
    const { data, isLoaded, engine } = useCycleData();
    const [today, setToday] = useState<Date | null>(null);

    useEffect(() => {
        setToday(new Date());
    }, []);

    if (!isLoaded || !today || !engine) return <DashboardSkeleton />;

    const current = engine.currentCycle;
    const prediction = engine.predictions.today;
    const stats = engine.statistics;

    // Helpers
    let nextPeriodStr = engine.predictions.futureCycles[0]?.cycleStart;
    if (!nextPeriodStr && current.state === 'OVU_CONFIRMED' && current.ovulationConfirmedDate) {
        const d = new Date(current.ovulationConfirmedDate);
        d.setDate(d.getDate() + stats.medianLutealLength);
        nextPeriodStr = d.toISOString().split('T')[0];
    }

    const daysToPeriod = nextPeriodStr ? Math.ceil((new Date(nextPeriodStr).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : '?';

    // Phase style mapping
    type PhaseStyle = { title: string; bg: string; text: string; icon: LucideIcon };

    const phaseStyles: Record<string, PhaseStyle> = {
        'MENSTRUATION': { title: 'Periode', bg: 'bg-primary/10', text: 'text-primary', icon: Droplets },
        'PRE_FERTILE': { title: 'Follikelphase', bg: 'bg-accent', text: 'text-accent-foreground', icon: Leaf },
        'FERTILE_MID': { title: 'Fruchtbar', bg: 'bg-[var(--phase-fertile-light)]', text: 'text-[var(--phase-fertile)]', icon: Thermometer },
        'PEAK_LH': { title: 'Hochfruchtbar', bg: 'bg-[var(--phase-ovulation-light)]', text: 'text-[var(--phase-ovulation)]', icon: Siren },
        'POST_OVU_PENDING': { title: 'Eisprung möglich', bg: 'bg-[var(--phase-ovulation-light)]', text: 'text-[var(--phase-ovulation)]', icon: Activity },
        'OVU_CONFIRMED': { title: 'Lutealphase', bg: 'bg-[var(--phase-luteal-light)]', text: 'text-[var(--phase-luteal)]', icon: CheckCircle2 },
        'ANOVULATORY_SUSPECTED': { title: 'Unklar', bg: 'bg-muted', text: 'text-muted-foreground', icon: AlertCircle },
    };

    const phaseStyle = phaseStyles[current.state] || { title: 'Lutealphase', bg: 'bg-[var(--phase-luteal-light)]', text: 'text-[var(--phase-luteal)]', icon: Activity };

    // Suggestion Text
    let suggestion = "";
    if (current.state === 'OVU_CONFIRMED' && current.ovulationConfirmedDate) {
        const daysSince = Math.floor((today.getTime() - new Date(current.ovulationConfirmedDate).getTime()) / 86400000);
        suggestion = `Temperaturhochlage seit ${daysSince} Tagen. Fruchtbares Fenster geschlossen.`;
    } else if (current.state === 'PEAK_LH') {
        suggestion = "LH-Peak erkannt! Eisprung voraussichtlich in 24-36h. Beste Zeit für GV.";
    } else if (prediction.fertilityLevel > 0) {
        suggestion = "Fruchtbare Tage. Beobachte deinen Zervixschleim.";
    }

    // Animation
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: prefersReducedMotion ? 0 : 0.08 } }
    };
    const item = prefersReducedMotion
        ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
        : { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 25 } } };

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="flex flex-col items-center gap-5 pb-28 px-4 pt-2 overflow-hidden"
        >
            {/* Blob decorations + CycleRing */}
            <motion.div variants={item} className="relative flex items-center justify-center" style={{ minHeight: 220 }}>
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
            </motion.div>

            {/* Status Pill */}
            <motion.div variants={item}>
                <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full shadow-soft ${phaseStyle.bg}`}>
                    <phaseStyle.icon className={`w-4 h-4 ${phaseStyle.text}`} />
                    <span className={`text-sm font-semibold ${phaseStyle.text}`}>{phaseStyle.title} · Tag {current.day}</span>
                </div>
            </motion.div>

            {/* AI Summary Card */}
            <motion.div variants={item} className="w-full">
                <AiSummaryCard />
            </motion.div>

            {/* Quick Stats Row */}
            <motion.div variants={item} className="w-full">
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
                    <StatCard icon={Calendar} label="Nächste Periode" value={`${daysToPeriod} Tage`} />
                    <StatCard icon={TrendingUp} label="Zykluslänge" value={`Ø ${Math.round(stats.medianCycleLength)} Tage`} />
                    <StatCard icon={Activity} label="Lutealphase" value={`${Math.round(stats.medianLutealLength)} Tage`} />
                </div>
            </motion.div>

            {/* CTA Button */}
            <motion.div variants={item} className="w-full">
                <EntryDrawer>
                    <button className="w-full py-4 bg-gradient-to-r from-primary to-coral text-white font-semibold rounded-2xl shadow-soft-lg active:scale-[0.98] transition-transform text-base">
                        Wie geht es dir heute?
                    </button>
                </EntryDrawer>
            </motion.div>

            {/* Suggestion text */}
            {suggestion && (
                <motion.div variants={item}>
                    <p className="text-sm text-muted-foreground text-center px-4">{suggestion}</p>
                </motion.div>
            )}
        </motion.div>
    );
}
