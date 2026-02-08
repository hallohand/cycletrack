'use client';
import { useCycleData } from '@/hooks/useCycleData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine } from 'recharts';
import { useEffect, useState } from 'react';
import { calculatePredictions } from '@/lib/cycle-calculations';

export default function ChartPage() {
    const { data, isLoaded } = useCycleData();
    const [chartData, setChartData] = useState<any[]>([]);
    const [analysis, setAnalysis] = useState<any>(null);

    useEffect(() => {
        if (!isLoaded) return;

        const entries = Object.values(data.entries).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Logic: Find last cycle start
        // We need to look at Period Starts, but Cycle Analysis logic is better.
        // Let's reimplement a simplified version of analyzeCycles here or rely on the hook if we exposed it.
        // For chart, we generally want the CURRENT cycle or selectable.
        // Let's stick to "Current Cycle" for now.

        const periodEntries = entries.filter(e => e.period && (!entries.find(prev => prev.date < e.date && new Date(e.date).getTime() - new Date(prev.date).getTime() < 5 * 24 * 60 * 60 * 1000 && prev.period)));
        // Simplify: Last period entry that has a gap before it

        let lastPeriodStart = entries[0]?.date;
        for (let i = entries.length - 1; i >= 0; i--) {
            const e = entries[i];
            if (e.period) {
                const prev = entries[i - 1];
                if (!prev || !prev.period || (new Date(e.date).getTime() - new Date(prev.date).getTime() > 5 * 86400000)) {
                    lastPeriodStart = e.date;
                    break;
                }
            }
        }

        if (!lastPeriodStart) {
            setChartData([]);
            return;
        }

        const startDate = new Date(lastPeriodStart);
        const relevantEntries = entries.filter(e => new Date(e.date) >= startDate);

        // Run predictions to get advanced data (coverline, ovu)
        // Note: calculatePredictions does analysis internally for the *last* cycle.
        const preds = calculatePredictions(data);
        setAnalysis(preds);

        const formattedData = relevantEntries.map(e => {
            const dayDiff = Math.floor((new Date(e.date).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            return {
                day: dayDiff,
                date: new Date(e.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }),
                temp: e.excludeTemp ? null : e.temperature || null, // Respect excludeTemp
                rawTemp: e.temperature, // For tooltip
                isPeriod: !!e.period,
                lh: e.lhTest,
                sex: e.sex
            };
        });

        setChartData(formattedData);

    }, [data, isLoaded]);

    if (!isLoaded) return <div className="p-8 text-center text-muted-foreground animate-pulse">Laden...</div>;

    return (
        <div className="space-y-4 h-[calc(100vh-160px)] flex flex-col">
            <Card className="flex-1 flex flex-col border-none shadow-sm h-full">
                <CardHeader className="pb-2">
                    <CardTitle>Temperaturkurve</CardTitle>
                    <CardDescription>
                        {analysis?.isOvulationConfirmed ? 'Eisprung bestätigt ✅' : 'Warte auf Anstieg...'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 pl-0 pb-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                            <XAxis
                                dataKey="day"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                padding={{ left: 10, right: 10 }}
                                type="number"
                                domain={['dataMin', 'dataMax']}
                                allowDataOverflow={false}
                            />
                            <YAxis
                                domain={['auto', 'auto']}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                width={35}
                                scale="linear"
                                type="number"
                                allowDataOverflow={true}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                labelStyle={{ color: 'var(--muted-foreground)' }}
                                formatter={(value: any, name: any, props: any) => {
                                    if (name === 'temp') return [`${value}°C`, 'Temp'];
                                    return [value, name];
                                }}
                            />

                            {/* Fertile Window Area (if known) */}
                            {analysis?.fertileWindowStart && analysis?.fertileWindowEnd && (
                                // We need to map dates to days. This is tricky without x-axis being dates. 
                                // But we have prediction result which is mostly dates.
                                // Simplified: Highlignt ovuation day if known
                                <ReferenceLine x={analysis.cycleDay - (analysis.daysToNextPeriod ? 0 : 0)} stroke="orange" strokeDasharray="3 3" />
                                // Actually, mapping date to "day index" is hard here without reprocessing.
                                // Let's skip complex areas for now and focus on Line.
                            )}

                            {/* Coverline would be a ReferenceLine y={...} if we had it calculated/stored in cycle data */}
                            {/* <ReferenceLine y={36.5} stroke="red" strokeDasharray="3 3" label="Coverline" /> */}

                            <Line
                                type="monotone"
                                dataKey="temp"
                                stroke="var(--primary)"
                                strokeWidth={3}
                                dot={(props: any) => {
                                    const { cx, cy, payload } = props;
                                    if (payload.sex) {
                                        return <circle cx={cx} cy={cy} r={4} fill="var(--rose-500)" stroke="pink" strokeWidth={2} />
                                    }
                                    if (payload.lh === 'peak' || payload.lh === 'positive') {
                                        return <circle cx={cx} cy={cy} r={4} fill="var(--purple-500)" stroke="white" strokeWidth={2} />
                                    }
                                    return <circle cx={cx} cy={cy} r={3} fill="var(--primary)" stroke="none" />
                                }}
                                connectNulls
                            />
                        </LineChart>
                    </ResponsiveContainer>

                    {/* Legend overlay */}
                    <div className="absolute top-2 right-4 flex flex-col gap-1 text-[10px] text-muted-foreground bg-white/80 p-2 rounded-lg backdrop-blur-sm">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"></div> LH Positiv</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"></div> GV</div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
