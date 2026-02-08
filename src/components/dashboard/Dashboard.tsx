'use client';
import { useCycleData } from '@/hooks/useCycleData';
import { calculatePredictions, formatDays, calculateAverageCycleLength } from '@/lib/cycle-calculations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Plus, Calendar as CalendarIcon, Activity, Droplets, Thermometer, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Progress } from "@/components/ui/progress"

export default function Dashboard() {
    const { data, isLoaded } = useCycleData();
    const [today, setToday] = useState<Date | null>(null);

    useEffect(() => {
        setToday(new Date());
    }, []);

    if (!isLoaded || !today) return <div className="p-8 text-center text-muted-foreground animate-pulse">Lade CycleTrack...</div>;

    // --- Calculations (Same as before) ---
    const predictions = calculatePredictions(data);
    const todaysDateStr = today.toISOString().split('T')[0];
    const todayEntry = data.entries[todaysDateStr];

    const periodEntries = Object.values(data.entries)
        .filter(e => e.period)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const lastPeriod = periodEntries.length > 0 ? periodEntries[periodEntries.length - 1] : null;

    let cycleDay = 0;
    if (lastPeriod) {
        cycleDay = Math.floor((today.getTime() - new Date(lastPeriod.date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    const daysToPeriod = predictions.nextPeriodStart
        ? Math.ceil((predictions.nextPeriodStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null;

    const daysToOvulation = predictions.ovulationNext
        ? Math.ceil((predictions.ovulationNext.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null;

    // Status Logic
    let status = { title: 'Zyklus-Phase', subtitle: 'Normal', color: 'bg-secondary', text: 'text-secondary-foreground', icon: Activity };

    if (cycleDay > 0 && cycleDay <= 5) {
        status = { title: 'Periode', subtitle: `Tag ${cycleDay}`, color: 'bg-primary/10', text: 'text-primary', icon: Droplets };
    } else if (daysToOvulation !== null && daysToOvulation > -2 && daysToOvulation <= 1) {
        status = { title: 'Eisprung', subtitle: 'Steht bevor', color: 'bg-chart-4/20', text: 'text-chart-4', icon: Thermometer };
    } else if (daysToOvulation !== null && daysToOvulation > 1 && daysToOvulation <= 5) {
        status = { title: 'Fruchtbar', subtitle: 'Hohe Chance', color: 'bg-chart-2/20', text: 'text-chart-2', icon: Activity };
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

            {/* 1. Main Status Card (Square, Top Left) */}
            <motion.div variants={item} className="col-span-1 row-span-1">
                <Card className={`h-full border-none shadow-sm ${status.color}`}>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className={status.text}>{status.title}</CardDescription>
                        <CardTitle className={`text-2xl font-bold ${status.text}`}>{status.subtitle}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <status.icon className={`h-8 w-8 ${status.text} opacity-80`} />
                    </CardContent>
                </Card>
            </motion.div>

            {/* 2. Quick Action (Square, Top Right) */}
            <motion.div variants={item} className="col-span-1 row-span-1">
                <Link href="/entry">
                    <Card className="h-full border-dashed border-2 shadow-none hover:bg-muted/50 transition-colors flex flex-col items-center justify-center p-4 cursor-pointer active:scale-95 transition-transform">
                        <div className="bg-primary/10 p-3 rounded-full mb-2">
                            <Plus className="h-6 w-6 text-primary" />
                        </div>
                        <span className="font-medium text-sm text-muted-foreground">Eintrag</span>
                    </Card>
                </Link>
            </motion.div>

            {/* 3. Cycle Progress (Wide) */}
            <motion.div variants={item} className="col-span-2">
                <Card className="shadow-sm border-none bg-white">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                        <div className="space-y-1">
                            <CardTitle className="text-base">Nächste Periode</CardTitle>
                            <CardDescription>
                                {predictions.nextPeriodStart ? predictions.nextPeriodStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }) : 'Keine Daten'}
                            </CardDescription>
                        </div>
                        <div className="text-2xl font-bold text-primary">
                            {daysToPeriod !== null ? daysToPeriod : '?'} <span className="text-xs font-normal text-muted-foreground">Tage</span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${Math.min(((cycleDay) / (data.cycleLength || 28)) * 100, 100)}%` }}
                            />
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* 4. Stats Grid (2 items) */}
            <motion.div variants={item} className="col-span-1">
                <Card className="shadow-sm p-3">
                    <div className="text-xs text-muted-foreground uppercase">Zyklustag</div>
                    <div className="text-xl font-bold">{cycleDay || '-'}</div>
                </Card>
            </motion.div>
            <motion.div variants={item} className="col-span-1">
                <Card className="shadow-sm p-3">
                    <div className="text-xs text-muted-foreground uppercase">Ø Länge</div>
                    <div className="text-xl font-bold">{calculateAverageCycleLength(data.entries)}</div>
                </Card>
            </motion.div>

            {/* 5. Today's Log Summary (If exists) */}
            {todayEntry && (
                <motion.div variants={item} className="col-span-2">
                    <Card className="bg-muted/30 border-none">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-sm font-medium">Heute</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 flex gap-2 overflow-x-auto">
                            {todayEntry.temperature && <Badge variant="outline" className="bg-background">{todayEntry.temperature}°C</Badge>}
                            {todayEntry.period && <Badge variant="secondary" className="bg-primary/20 text-primary hover:bg-primary/30">{todayEntry.period}</Badge>}
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* 6. Calendar Teaser (Wide) */}
            <motion.div variants={item} className="col-span-2 mt-2">
                <Link href="/calendar">
                    <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-border/50 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-lg">
                                <CalendarIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <div className="font-semibold text-sm">Kalender öffnen</div>
                                <div className="text-xs text-muted-foreground">Details & Verlauf</div>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                </Link>
            </motion.div>

        </motion.div>
    );
}
