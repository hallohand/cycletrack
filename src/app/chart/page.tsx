'use client';
import { useCycleData } from '@/hooks/useCycleData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from 'recharts';
import { useEffect, useState } from 'react';

export default function ChartPage() {
    const { data, isLoaded } = useCycleData();
    const [chartData, setChartData] = useState<any[]>([]);

    useEffect(() => {
        if (!isLoaded) return;

        const entries = Object.values(data.entries).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Logic: Find last cycle start
        const periodEntries = entries.filter(e => e.period);
        const lastPeriod = periodEntries[periodEntries.length - 1];

        if (!lastPeriod) {
            setChartData([]);
            return;
        }

        const startDate = new Date(lastPeriod.date);
        const relevantEntries = entries.filter(e => new Date(e.date) >= startDate);

        const formattedData = relevantEntries.map(e => {
            const dayDiff = Math.floor((new Date(e.date).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            return {
                day: dayDiff,
                date: new Date(e.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }),
                temp: e.temperature || null,
                isPeriod: !!e.period
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
                    <CardDescription>Aktueller Zyklus</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 pl-0 pb-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                            <XAxis
                                dataKey="day"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                padding={{ left: 10, right: 10 }}
                            />
                            <YAxis
                                domain={[35.5, 37.5]}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                width={30}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                labelStyle={{ color: 'var(--muted-foreground)' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="temp"
                                stroke="var(--primary)"
                                strokeWidth={3}
                                dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 0 }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                                connectNulls
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
