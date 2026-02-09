'use client';
import { useCycleData } from '@/hooks/useCycleData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine } from 'recharts';
import { useEffect, useRef, useState, useMemo } from 'react';
import { runEngine } from '@/lib/cycle-calculations';

import { groupCycles } from '@/lib/history-utils'; // Need to import this

export default function ChartPage() {
    const { data, isLoaded } = useCycleData();
    const [chartData, setChartData] = useState<any[]>([]);
    const [phaseAreas, setPhaseAreas] = useState<any[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Run engine to get coverline
    const engine = useMemo(() => {
        if (!data?.entries || Object.keys(data.entries).length === 0) return null;
        return runEngine(data);
    }, [data]);

    useEffect(() => {
        if (!isLoaded) return;

        const entries = Object.values(data.entries).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Data Range: Last 6 months (approx 180 days)
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 6);
        const relevantEntries = entries.filter(e => new Date(e.date) >= startDate);

        // 1. Analyze History to get Phase Info (Fertile/Period/Ovulation) for ALL dates
        const cycles = groupCycles(data.entries);
        const dayInfoMap = new Map<string, { isPeriod: boolean, isFertile: boolean, isOvulation: boolean }>();
        cycles.forEach(c => {
            c.days.forEach(d => {
                dayInfoMap.set(d.date, {
                    isPeriod: !!d.isPeriod,
                    isFertile: !!d.isFertile,
                    isOvulation: !!d.isOvulation
                });
            });
        });

        // 2. Prepare Chart Data (Linear Index for XAxis)
        const formattedData = relevantEntries.map((e, index) => {
            const info = dayInfoMap.get(e.date) || { isPeriod: !!e.period && e.period !== 'spotting', isFertile: false, isOvulation: false };
            return {
                index, // XAxis Key
                dateStr: e.date,
                displayDate: new Date(e.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }),
                temp: e.excludeTemp ? null : e.temperature || null,
                rawTemp: e.temperature,
                isPeriod: info.isPeriod,
                isFertile: info.isFertile,
                isOvulation: info.isOvulation,
                isSpotting: e.period === 'spotting',
                lh: e.lhTest,
                sex: e.sex
            };
        });
        setChartData(formattedData);

        // 3. Calculate Phase Blocks
        const newPhaseAreas: any[] = [];
        if (formattedData.length > 0) {
            let currentType: 'period' | 'fertile' | 'purple' = 'purple'; // Default
            let startIndex = 0;

            const getType = (d: any) => {
                if (d.isPeriod) return 'period';
                if (d.isFertile) return 'fertile';
                return 'purple';
            };

            currentType = getType(formattedData[0]);

            formattedData.forEach((d, i) => {
                const type = getType(d);
                // Check for break in continuity (date gap > 1 day) or type change
                const prev = formattedData[i - 1];
                const dateGap = prev ? (new Date(d.dateStr).getTime() - new Date(prev.dateStr).getTime()) > 86400000 * 1.5 : false;

                if (type !== currentType || dateGap) {
                    // Push previous block
                    newPhaseAreas.push({
                        x1: startIndex,
                        x2: i, // Overlap by 1 to eliminate white gaps between transitions
                        type: currentType,
                        label: currentType === 'period' ? 'Periode' : currentType === 'fertile' ? 'Fruchtbar' : ''
                    });

                    // Start new block
                    currentType = type;
                    startIndex = i;
                }
            });
            // Push final block
            newPhaseAreas.push({
                x1: startIndex,
                x2: formattedData.length - 1,
                type: currentType,
                label: currentType === 'period' ? 'Periode' : currentType === 'fertile' ? 'Fruchtbar' : ''
            });
        }
        setPhaseAreas(newPhaseAreas);

    }, [data, isLoaded]);

    // Auto-scroll to the right (newest data) on load
    useEffect(() => {
        if (chartData.length > 0 && scrollRef.current) {
            // Small delay to ensure the chart has rendered
            setTimeout(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
                }
            }, 100);
        }
    }, [chartData]);

    // SSR-safe window width (must be before any early return — Rules of Hooks)
    const [windowWidth, setWindowWidth] = useState(375);
    useEffect(() => {
        setWindowWidth(window.innerWidth);
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (!isLoaded) return <div className="p-8 text-center text-muted-foreground animate-pulse">Laden...</div>;

    const chartWidth = Math.max(windowWidth, chartData.length * 40);

    return (
        <div className="flex flex-col h-[calc(100vh-160px)]">
            <Card className="flex-1 flex flex-col border-none shadow-sm h-full overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle>Temperaturkurve</CardTitle>
                    <CardDescription>
                        Historie & Phasenverlauf
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 pl-0 pb-0 relative overflow-hidden">
                    {/* Scroll Container */}
                    <div ref={scrollRef} className="h-full w-full overflow-x-auto overflow-y-hidden scrollbar-hide">
                        <div style={{ width: chartWidth, height: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 30 }}>
                                    <defs>
                                        <linearGradient id="periodGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#fca5a5" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="#fca5a5" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="fertileGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#93c5fd" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="#93c5fd" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#d8b4fe" stopOpacity={0.2} />
                                            <stop offset="100%" stopColor="#d8b4fe" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>

                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />

                                    <XAxis
                                        dataKey="index"
                                        tickLine={false}
                                        axisLine={false}
                                        tick={(props) => {
                                            const payload = props.payload;
                                            const item = chartData[payload.value];
                                            if (!item) return null;
                                            return <text x={props.x} y={Number(props.y) + 15} textAnchor="middle" fill="var(--muted-foreground)" fontSize={10}>{item.displayDate}</text>
                                        }}
                                        padding={{ left: 10, right: 10 }}
                                        type="number"
                                        domain={['dataMin', 'dataMax']}
                                        interval={0} // Show all ticks? No, maybe interval calculation needed.
                                    // ticks={...} ? Let Recharts handle it but use custom tick renderer to show date
                                    />

                                    <YAxis
                                        domain={[35.5, 37.5]}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                        width={35}
                                        scale="linear"
                                        type="number"
                                        allowDataOverflow={true} // Fixed scale
                                    />

                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        labelStyle={{ color: 'var(--muted-foreground)' }}
                                        labelFormatter={(value) => chartData[value]?.displayDate}
                                        formatter={(value: any, name: any, props: any) => {
                                            if (name === 'temp') return [`${value}°C`, 'Temp'];
                                            return [value, name];
                                        }}
                                    />

                                    {/* Phase Backgrounds */}
                                    {phaseAreas.map((area, idx) => (
                                        <ReferenceArea
                                            key={idx}
                                            x1={area.x1}
                                            x2={area.x2}
                                            y1={37.5}
                                            y2={35.5} // Cover whole height
                                            fill={`url(#${area.type === 'period' ? 'periodGradient' : area.type === 'fertile' ? 'fertileGradient' : 'purpleGradient'})`}
                                            fillOpacity={1}
                                            label={{
                                                value: area.type === 'purple' ? '' : area.label,
                                                position: 'insideBottom',
                                                fill: area.type === 'period' ? '#ef4444' : area.type === 'fertile' ? '#3b82f6' : '#a855f7',
                                                fontSize: 10,
                                                dy: 10
                                            }}
                                        />
                                    ))}

                                    {/* Ovulation Markers */}
                                    {chartData.map((item, idx) => {
                                        if (item.isOvulation) {
                                            return (
                                                <ReferenceLine
                                                    key={`ovu-${idx}`}
                                                    x={item.index}
                                                    stroke="#eab308" // Yellow/Gold
                                                    strokeDasharray="3 3"
                                                    label={{ value: '🌼', position: 'top', fill: '#eab308', fontSize: 12 }}
                                                />
                                            );
                                        }
                                        return null;
                                    })}

                                    {/* Coverline */}
                                    {engine?.currentCycle.coverline && (
                                        <ReferenceLine
                                            y={engine.currentCycle.coverline}
                                            stroke={engine.currentCycle.coverlineProvisional ? '#9ca3af' : '#ef4444'}
                                            strokeDasharray={engine.currentCycle.coverlineProvisional ? '6 4' : '0'}
                                            strokeWidth={engine.currentCycle.coverlineProvisional ? 1.5 : 2}
                                            label={{
                                                value: `${engine.currentCycle.coverline.toFixed(2)}° ${engine.currentCycle.coverlineProvisional ? '(vorläufig)' : 'Coverline'}`,
                                                position: 'right',
                                                fill: engine.currentCycle.coverlineProvisional ? '#9ca3af' : '#ef4444',
                                                fontSize: 10,
                                            }}
                                        />
                                    )}

                                    <Line
                                        type="monotone"
                                        dataKey="temp"
                                        stroke="var(--primary)"
                                        strokeWidth={3}
                                        dot={(props: any) => {
                                            const { cx, cy, payload } = props;
                                            if (payload.sex) return <circle cx={cx} cy={cy} r={4} fill="var(--rose-500)" stroke="pink" strokeWidth={2} />;
                                            if (payload.lh === 'peak' || payload.lh === 'positive') return <circle cx={cx} cy={cy} r={4} fill="var(--purple-500)" stroke="white" strokeWidth={2} />;
                                            if (payload.isOvulation) return <circle cx={cx} cy={cy} r={5} fill="#eab308" stroke="white" strokeWidth={2} />; // Gold dot for Ovu
                                            return <circle cx={cx} cy={cy} r={3} fill="var(--primary)" stroke="none" />;
                                        }}
                                        connectNulls
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground px-4 py-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 bg-primary rounded"></div>
                    Temperatur
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-rose-200/60"></div>
                    Periode
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-sky-200/60"></div>
                    Fruchtbar
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-amber-300 border-2 border-amber-500"></div>
                    Eisprung
                </div>
                {engine?.currentCycle.coverline && (
                    <div className="flex items-center gap-1.5">
                        <div className={`w-4 h-0 border-t-2 ${engine.currentCycle.coverlineProvisional ? 'border-dashed border-gray-400' : 'border-solid border-red-500'}`}></div>
                        Coverline{engine.currentCycle.coverlineProvisional ? ' (vorl.)' : ''}
                    </div>
                )}
            </div>
        </div>
    );
}
