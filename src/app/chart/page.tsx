'use client';
import { useCycleData } from '@/hooks/useCycleData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine } from 'recharts';
import { useEffect, useState } from 'react';
import { calculatePredictions, runEngine } from '@/lib/cycle-calculations';

export default function ChartPage() {
    const { data, isLoaded } = useCycleData();
    const [chartData, setChartData] = useState<any[]>([]);
    const [analysis, setAnalysis] = useState<any>(null);

    useEffect(() => {
        if (!isLoaded) return;

        const entries = Object.values(data.entries).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Find relevant cycle start
        // We want to show the current cycle or the last finished one if current is empty.
        const engine = runEngine(data);
        const currentStart = engine.currentCycle.startDate;

        // Filter entries from currentStart
        const relevantEntries = entries.filter(e => e.date >= currentStart);

        setAnalysis(engine);

        const formattedData = relevantEntries.map(e => {
            const dayDiff = Math.floor((new Date(e.date).getTime() - new Date(currentStart).getTime()) / (1000 * 60 * 60 * 24)) + 1;
            return {
                day: dayDiff,
                date: new Date(e.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }),
                temp: e.excludeTemp ? null : e.temperature || null,
                rawTemp: e.temperature,
                isPeriod: !!e.period && e.period !== 'spotting',
                isSpotting: e.period === 'spotting',
                lh: e.lhTest,
                sex: e.sex
            };
        });

        setChartData(formattedData);

    }, [data, isLoaded]);

    if (!isLoaded) return <div className="p-8 text-center text-muted-foreground animate-pulse">Laden...</div>;

    const current = analysis?.currentCycle;

    return (
        <div className="space-y-4 h-[calc(100vh-160px)] flex flex-col">
            <Card className="flex-1 flex flex-col border-none shadow-sm h-full">
                <CardHeader className="pb-2">
                    <CardTitle>Temperaturkurve</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                        {current?.state === 'OVU_CONFIRMED' ? (
                            <span className="text-green-600 font-medium">Eisprung bestätigt ✅</span>
                        ) : (
                            <span>Warte auf Anstieg...</span>
                        )}
                        {current?.coverline && <span className="text-xs text-muted-foreground">(Coverline: {current.coverline.toFixed(2)}°C)</span>}
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
                                domain={[35.5, 37.5]}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                width={35}
                                scale="linear"
                                type="number"
                                allowDataOverflow={false} // Allow clipping if outside range? Or fit? User said "skala von 35,5 bis 37,5". So fixed.
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                labelStyle={{ color: 'var(--muted-foreground)' }}
                                formatter={(value: any, name: any, props: any) => {
                                    if (name === 'temp') return [`${value}°C`, 'Temp'];
                                    return [value, name];
                                }}
                            />

                            {/* Coverline Visualization */}
                            {current?.coverline && (
                                <ReferenceLine
                                    y={current.coverline + 0.2}
                                    stroke="green"
                                    strokeDasharray="3 3"
                                    label={{ value: 'Hilfslinie', position: 'right', fill: 'green', fontSize: 10 }}
                                />
                            )}
                            {current?.coverline && (
                                <ReferenceLine
                                    y={current.coverline}
                                    stroke="gray"
                                    strokeDasharray="3 3"
                                    label={{ value: 'Basis', position: 'right', fill: 'gray', fontSize: 10 }}
                                />
                            )}

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
