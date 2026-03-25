'use client';
import { useCycleData } from '@/hooks/useCycleData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Plus, Calendar as CalendarIcon, Activity, Droplets, Thermometer, ChevronRight, AlertCircle, CheckCircle2, Leaf, Siren } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Progress } from "@/components/ui/progress"
import { AiSummaryCard } from '@/components/dashboard/AiSummaryCard';

export default function Dashboard() {
    const { data, isLoaded, engine } = useCycleData();
    const [today, setToday] = useState<Date | null>(null);

    useEffect(() => {
        setToday(new Date());
    }, []);

    if (!isLoaded || !today || !engine) return <div className="p-8 text-center text-muted-foreground animate-pulse">Lade CycleTrack Engine...</div>;

    const current = engine.currentCycle;
    const prediction = engine.predictions.today;
    const stats = engine.statistics;

    // Helpers
    let nextPeriodStr = engine.predictions.futureCycles[0]?.cycleStart;
    if (!nextPeriodStr && current.state === 'OVU_CONFIRMED' && current.ovulationConfirmedDate) {
        // Fallback if prediction array empty but confirmed
        const d = new Date(current.ovulationConfirmedDate);
        d.setDate(d.getDate() + stats.medianLutealLength);
        nextPeriodStr = d.toISOString().split('T')[0];
    }

    const daysToPeriod = nextPeriodStr ? Math.ceil((new Date(nextPeriodStr).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : '?';

    // Status Logic Mapping
    let status = { title: 'Lutealphase', subtitle: 'Nach Eisprung', color: 'bg-[var(--phase-luteal-light)]', text: 'text-[var(--phase-luteal)]', icon: Activity };

    if (current.state === 'MENSTRUATION') {
        status = { title: 'Periode', subtitle: `Zyklustag ${current.day}`, color: 'bg-primary/10', text: 'text-primary', icon: Droplets };
    } else if (current.state === 'PRE_FERTILE') {
        status = { title: 'Follikelphase', subtitle: `Zyklustag ${current.day}`, color: 'bg-accent', text: 'text-accent-foreground', icon: Leaf };
    } else if (current.state === 'FERTILE_MID') {
        status = { title: 'Fruchtbar', subtitle: 'Beginn', color: 'bg-[var(--phase-fertile-light)]', text: 'text-[var(--phase-fertile)]', icon: Thermometer };
    } else if (current.state === 'PEAK_LH') {
        status = { title: 'Maximale Fruchtbarkeit', subtitle: 'Eisprung steht bevor', color: 'bg-[var(--phase-ovulation-light)]', text: 'text-[var(--phase-ovulation)]', icon: Siren };
    } else if (current.state === 'POST_OVU_PENDING') {
        status = { title: 'Eisprung möglich', subtitle: 'Warte auf Temp-Anstieg', color: 'bg-[var(--phase-ovulation-light)]', text: 'text-[var(--phase-ovulation)]', icon: Activity };
    } else if (current.state === 'OVU_CONFIRMED') {
        status = { title: 'Lutealphase', subtitle: 'Eisprung bestätigt', color: 'bg-[var(--phase-luteal-light)]', text: 'text-[var(--phase-luteal)]', icon: CheckCircle2 };
    } else if (current.state === 'ANOVULATORY_SUSPECTED') {
        status = { title: 'Unklar', subtitle: 'Kein eindeutiger Temp-Anstieg', color: 'bg-muted', text: 'text-muted-foreground', icon: AlertCircle };
    }

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

    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: prefersReducedMotion ? 0 : 0.05 } }
    };
    const item = prefersReducedMotion ? { hidden: {}, show: {} } : {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 pb-24">

            {/* AI Summary Card */}
            <motion.div variants={item} className="col-span-2">
                <AiSummaryCard />
            </motion.div>
            {/* 1. Main Status Card */}
            <motion.div variants={item} className="col-span-1 row-span-1">
                <Card className={`h-full border-none shadow-sm transition-transform active:scale-[0.98] ${status.color}`}>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className={status.text}>{status.title}</CardDescription>
                        <CardTitle className={`text-xl font-bold font-serif ${status.text} leading-tight`}>{status.subtitle}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <status.icon className={`h-8 w-8 ${status.text} opacity-80`} />
                    </CardContent>
                </Card>
            </motion.div>

            {/* 2. Quick Action / Prediction */}
            <motion.div variants={item} className="col-span-1 row-span-1">
                <Card className="h-full shadow-sm border p-4 flex flex-col justify-between transition-transform active:scale-[0.98]">
                    <div className="text-xs text-muted-foreground uppercase">Nächste Periode</div>
                    <div className="text-2xl font-bold text-primary">
                        {daysToPeriod} <span className="text-sm font-normal text-muted-foreground">Tage</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {nextPeriodStr ? new Date(nextPeriodStr).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }) : '-'}
                        {engine.predictions.futureCycles[0] && (
                            <span className="block text-[10px] text-muted-foreground mt-1 opacity-70">
                                ± {Math.round(stats.stdDevCycleLength)} Tage (Unsicherheit)
                            </span>
                        )}
                    </div>
                </Card>
            </motion.div>

            {/* 3. Suggestion / Warning Box */}
            {suggestion && (
                <motion.div variants={item} className="col-span-2">
                    <div className={`p-3 rounded-xl border flex items-start gap-3 ${current.state === 'OVU_CONFIRMED' ? 'bg-[var(--phase-luteal-light)] border-[var(--phase-luteal)]/30 text-[var(--phase-luteal)]' : 'bg-[var(--phase-fertile-light)] border-[var(--phase-fertile)]/30 text-[var(--phase-fertile)]'}`}>
                        {current.state === 'OVU_CONFIRMED' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                        <span className="text-sm font-medium">{suggestion}</span>
                    </div>
                </motion.div>
            )}

            {/* 4. Cycle Progress & Stats */}
            <motion.div variants={item} className="col-span-2">
                <Card className="shadow-sm border-none bg-card">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-base font-serif flex justify-between">
                            <span>Zyklus-Statistik</span>
                            <span className="text-muted-foreground font-normal">Tag {current.day}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-3">
                        <Progress value={Math.min(((current.day) / (stats.medianCycleLength || 28)) * 100, 100)} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Ø {Math.round(stats.medianCycleLength)} Tage</span>
                            <span>Luteal: {Math.round(stats.medianLutealLength)} Tage</span>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

        </motion.div>
    );
}
