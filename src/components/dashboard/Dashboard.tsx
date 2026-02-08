'use client';
import { useCycleData } from '@/hooks/useCycleData';
import { runEngine } from '@/lib/cycle-calculations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Plus, Calendar as CalendarIcon, Activity, Droplets, Thermometer, ChevronRight, AlertCircle, CheckCircle2, Leaf, Siren } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Progress } from "@/components/ui/progress"

export default function Dashboard() {
    const { data, isLoaded } = useCycleData();
    const [today, setToday] = useState<Date | null>(null);

    useEffect(() => {
        setToday(new Date());
    }, []);

    if (!isLoaded || !today) return <div className="p-8 text-center text-muted-foreground animate-pulse">Lade CycleTrack Engine...</div>;

    // Use the new Engine directly
    const engine = runEngine(data);
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
    let status = { title: 'Lutealphase', subtitle: 'Nach Eisprung', color: 'bg-orange-50', text: 'text-orange-700', icon: Activity };

    if (current.state === 'MENSTRUATION') {
        status = { title: 'Periode', subtitle: `Zyklustag ${current.day}`, color: 'bg-rose-100', text: 'text-rose-700', icon: Droplets };
    } else if (current.state === 'PRE_FERTILE') {
        status = { title: 'Follikelphase', subtitle: `Zyklustag ${current.day}`, color: 'bg-blue-50', text: 'text-blue-700', icon: Leaf };
    } else if (current.state === 'FERTILE_MID') {
        status = { title: 'Fruchtbar', subtitle: 'Beginn', color: 'bg-green-100', text: 'text-green-700', icon: Thermometer };
    } else if (current.state === 'PEAK_LH') {
        status = { title: 'Maximale Fruchtbarkeit', subtitle: 'Eisprung steht bevor', color: 'bg-purple-100', text: 'text-purple-700', icon: Siren };
    } else if (current.state === 'POST_OVU_PENDING') {
        status = { title: 'Eisprung möglich', subtitle: 'Warte auf Temp-Anstieg', color: 'bg-yellow-50', text: 'text-yellow-700', icon: Activity };
    } else if (current.state === 'OVU_CONFIRMED') {
        status = { title: 'Lutealphase', subtitle: 'Eisprung bestätigt ✅', color: 'bg-green-50', text: 'text-green-800', icon: CheckCircle2 };
    } else if (current.state === 'ANOVULATORY_SUSPECTED') {
        status = { title: 'Unklar', subtitle: 'Kein eindeutiger Temp-Anstieg', color: 'bg-gray-100', text: 'text-gray-700', icon: AlertCircle };
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

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.05 } }
    };
    const item = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 pb-24">

            {/* 1. Main Status Card */}
            <motion.div variants={item} className="col-span-1 row-span-1">
                <Card className={`h-full border-none shadow-sm ${status.color}`}>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className={status.text}>{status.title}</CardDescription>
                        <CardTitle className={`text-xl font-bold ${status.text} leading-tight`}>{status.subtitle}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <status.icon className={`h-8 w-8 ${status.text} opacity-80`} />
                    </CardContent>
                </Card>
            </motion.div>

            {/* 2. Quick Action / Prediction */}
            <motion.div variants={item} className="col-span-1 row-span-1">
                <Card className="h-full shadow-sm border p-4 flex flex-col justify-between">
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
                    <div className={`p-3 rounded-xl border flex items-start gap-3 ${current.state === 'OVU_CONFIRMED' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                        {current.state === 'OVU_CONFIRMED' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                        <span className="text-sm font-medium">{suggestion}</span>
                    </div>
                </motion.div>
            )}

            {/* 4. Cycle Progress & Stats */}
            <motion.div variants={item} className="col-span-2">
                <Card className="shadow-sm border-none bg-white">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-base flex justify-between">
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

            {/* Debug / Pro Info */}
            <div className="col-span-2 text-[10px] text-center text-muted-foreground mt-2">
                Engine Confidence: {stats.historyCount > 2 ? 'High' : 'Low (Building History)'} • State: {current.state}
            </div>

        </motion.div>
    );
}
