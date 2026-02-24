'use client';
import { useCycleData } from '@/hooks/useCycleData';
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

    if (!isLoaded) return <div className="p-8 text-center text-muted-foreground animate-pulse">Laden...</div>;

    // Filter current cycle data for the overview bar temp curve
    const currentCycleTemps = useMemo(() => {
        if (!engine) return [];
        const startDate = engine.currentCycle.startDate;
        return chartData
            .filter(d => d.dateStr >= startDate && d.temp !== null)
            .map(d => d.temp as number);
    }, [chartData, engine]);

    // Auto-scroll to the right (newest data) on load
    useEffect(() => {
        if (chartData.length > 0 && scrollRef.current) {
            setTimeout(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
                }
            }, 100);
        }
    }, [chartData]);

    // SSR-safe window width
    const [windowWidth, setWindowWidth] = useState(375);
    useEffect(() => {
        setWindowWidth(window.innerWidth);
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const chartWidth = Math.max(windowWidth, chartData.length * 40);

    return (
        <div className="flex flex-col h-[calc(100vh-160px)] px-2">
            {/* Title */}
            <div className="pb-1 pt-1">
                <h2 className="text-lg font-semibold">Temperaturkurve</h2>
                <p className="text-xs text-muted-foreground">Historie & Phasenverlauf</p>
            </div>

            {/* Chart */}
            <div className="flex-1 min-h-0 w-full overflow-hidden">
                <div ref={scrollRef} className="h-full w-full overflow-x-auto overflow-y-hidden scrollbar-hide">
                    <div style={{ width: chartWidth, height: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
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
                                        return <text x={props.x} y={Number(props.y) + 12} textAnchor="middle" fill="var(--muted-foreground)" fontSize={9}>{item.displayDate}</text>
                                    }}
                                    padding={{ left: 5, right: 5 }}
                                    type="number"
                                    domain={['dataMin', 'dataMax']}
                                />

                                <YAxis
                                    domain={[35.5, 37.5]}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                                    width={30}
                                    scale="linear"
                                    type="number"
                                    allowDataOverflow={true}
                                />

                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    labelStyle={{ color: 'var(--muted-foreground)' }}
                                    labelFormatter={(value) => chartData[value]?.displayDate}
                                    formatter={(value: any, name: any) => {
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
                                        y2={35.5}
                                        fill={`url(#${area.type === 'period' ? 'periodGradient' : area.type === 'fertile' ? 'fertileGradient' : 'purpleGradient'})`}
                                        fillOpacity={1}
                                        label={{
                                            value: area.type === 'purple' ? '' : area.label,
                                            position: 'insideBottom',
                                            fill: area.type === 'period' ? '#ef4444' : area.type === 'fertile' ? '#3b82f6' : '#a855f7',
                                            fontSize: 9,
                                            dy: 8
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
                                                stroke="#eab308"
                                                strokeDasharray="3 3"
                                                label={{ value: '🌼', position: 'top', fill: '#eab308', fontSize: 11 }}
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
                                            value: `${engine.currentCycle.coverline.toFixed(2)}°`,
                                            position: 'right',
                                            fill: engine.currentCycle.coverlineProvisional ? '#9ca3af' : '#ef4444',
                                            fontSize: 9,
                                        }}
                                    />
                                )}

                                <Line
                                    type="monotone"
                                    dataKey="temp"
                                    stroke="var(--primary)"
                                    strokeWidth={2.5}
                                    dot={(props: any) => {
                                        const { cx, cy, payload } = props;
                                        if (payload.sex) return <circle cx={cx} cy={cy} r={3} fill="var(--rose-500)" stroke="pink" strokeWidth={1.5} />;
                                        if (payload.lh === 'peak' || payload.lh === 'positive') return <circle cx={cx} cy={cy} r={3} fill="var(--purple-500)" stroke="white" strokeWidth={1.5} />;
                                        if (payload.isOvulation) return <circle cx={cx} cy={cy} r={4} fill="#eab308" stroke="white" strokeWidth={1.5} />;
                                        return <circle cx={cx} cy={cy} r={2} fill="var(--primary)" stroke="none" />;
                                    }}
                                    connectNulls
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Zyklusübersicht */}
            {engine && (() => {
                const cc = engine.currentCycle;
                const stats = engine.statistics;
                const estLen = stats.medianCycleLength || 28;
                const today = cc.day;
                const pct = (day: number) => Math.min(100, Math.max(0, ((day - 1) / (estLen - 1)) * 100));

                const periodEnd = data.periodLength || 5;
                const fertileStart = cc.ovulationPred ? Math.max(1, Math.round((new Date(cc.ovulationPred.earliest).getTime() - new Date(cc.startDate).getTime()) / 86400000) - 4) : Math.round(estLen * 0.35);
                const fertileEnd = cc.ovulationPred ? Math.round((new Date(cc.ovulationPred.latest).getTime() - new Date(cc.startDate).getTime()) / 86400000) + 2 : Math.round(estLen * 0.55);
                const ovuDay = cc.ovulationConfirmedDate
                    ? Math.round((new Date(cc.ovulationConfirmedDate).getTime() - new Date(cc.startDate).getTime()) / 86400000) + 1
                    : cc.ovulationPred
                        ? Math.round((new Date(cc.ovulationPred.mid).getTime() - new Date(cc.startDate).getTime()) / 86400000) + 1
                        : null;

                const formatDate = (d: string) => new Date(d).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });

                // Build SVG polyline for temperature curve inside the bar
                const barH = 48; // h-12 = 48px
                // Use actual data range with padding for better readability
                const dataMin = currentCycleTemps.length > 0 ? Math.min(...currentCycleTemps) : 36.0;
                const dataMax = currentCycleTemps.length > 0 ? Math.max(...currentCycleTemps) : 37.0;
                const tempRange = Math.max(dataMax - dataMin, 0.2); // at least 0.2° range
                const tempMin = dataMin - tempRange * 0.15; // 15% padding below
                const tempMax = dataMax + tempRange * 0.15; // 15% padding above
                const todayPct = pct(today);

                // Build smooth SVG path for temperature curve
                const svgPath = (() => {
                    if (currentCycleTemps.length < 2) return '';
                    const pts = currentCycleTemps.map((t, i) => ({
                        x: (i / (currentCycleTemps.length - 1)) * todayPct,
                        y: barH - ((t - tempMin) / (tempMax - tempMin)) * barH,
                    }));

                    // Catmull-Rom to cubic bezier smooth path
                    let d = `M${pts[0].x},${pts[0].y}`;
                    const tension = 0.3;
                    for (let i = 0; i < pts.length - 1; i++) {
                        const p0 = pts[Math.max(0, i - 1)];
                        const p1 = pts[i];
                        const p2 = pts[i + 1];
                        const p3 = pts[Math.min(pts.length - 1, i + 2)];

                        const cp1x = p1.x + (p2.x - p0.x) * tension;
                        const cp1y = p1.y + (p2.y - p0.y) * tension;
                        const cp2x = p2.x - (p3.x - p1.x) * tension;
                        const cp2y = p2.y - (p3.y - p1.y) * tension;

                        d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
                    }
                    return d;
                })();

                return (
                    <div className="px-2 pb-1 shrink-0">
                        {/* Phase Bar */}
                        <div className="relative h-12 rounded-xl overflow-hidden bg-purple-100/30 border border-border/40">
                            {/* Period */}
                            <div
                                className="absolute top-0 bottom-0 rounded-l-xl bg-rose-300/40"
                                style={{ left: '0%', width: `${pct(periodEnd + 1)}%` }}
                            />
                            {/* Fertile Window */}
                            <div
                                className="absolute top-0 bottom-0 bg-sky-300/35"
                                style={{ left: `${pct(fertileStart)}%`, width: `${pct(fertileEnd + 1) - pct(fertileStart)}%` }}
                            />
                            {/* Temperature curve overlay */}
                            {svgPath && (
                                <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 100 ${barH}`} preserveAspectRatio="none">
                                    <path
                                        d={svgPath}
                                        fill="none"
                                        stroke="var(--primary)"
                                        strokeWidth="1.5"
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                </svg>
                            )}
                            {/* Ovulation marker */}
                            {ovuDay && (
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-amber-400 border-2 border-amber-600 shadow-sm z-10"
                                    style={{ left: `calc(${pct(ovuDay)}% - 10px)` }}
                                    title={cc.ovulationConfirmedDate ? 'Eisprung bestätigt' : 'Eisprung (geschätzt)'}
                                />
                            )}
                            {/* Today marker */}
                            <div
                                className="absolute top-0 bottom-0 w-0.5 bg-foreground z-20"
                                style={{ left: `${pct(today)}%` }}
                            >
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-foreground" />
                            </div>
                        </div>

                        {/* Day Labels */}
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5 px-1">
                            <span>Tag 1</span>
                            <span className="font-semibold text-foreground">Tag {today}</span>
                            <span>~{estLen} Tage</span>
                        </div>

                        {/* Info Pills */}
                        <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                                📍 Zyklustag {today}/{estLen}
                            </span>
                            {cc.nextPeriodPred && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-[10px] font-medium text-rose-600 border border-rose-200/60">
                                    🩸 ~{formatDate(cc.nextPeriodPred.mid)}
                                </span>
                            )}
                            {cc.ovulationPred && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cc.ovulationConfirmedDate
                                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                                    : 'bg-amber-50/50 text-amber-600 border-amber-200/60'
                                    }`}>
                                    {cc.ovulationConfirmedDate ? '✅' : '🌼'} {cc.ovulationConfirmedDate ? 'Eisprung ✓' : `~${formatDate(cc.ovulationPred.mid)}`}
                                </span>
                            )}
                            {cc.coverline && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cc.coverlineProvisional
                                    ? 'bg-gray-50 text-gray-500 border-gray-200 border-dashed'
                                    : 'bg-red-50 text-red-600 border-red-200'
                                    }`}>
                                    📏 {cc.coverline.toFixed(2)}°C{cc.coverlineProvisional ? ' (vorl.)' : ''}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Legend */}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-3 py-1 flex-wrap shrink-0">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 bg-primary rounded"></div>
                    Temperatur
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm bg-rose-200/60"></div>
                    Periode
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm bg-sky-200/60"></div>
                    Fruchtbar
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-300 border border-amber-500"></div>
                    Eisprung
                </div>
                {engine?.currentCycle.coverline && (
                    <div className="flex items-center gap-1">
                        <div className={`w-3 h-0 border-t-[1.5px] ${engine.currentCycle.coverlineProvisional ? 'border-dashed border-gray-400' : 'border-solid border-red-500'}`}></div>
                        Coverline{engine.currentCycle.coverlineProvisional ? ' (vorl.)' : ''}
                    </div>
                )}
            </div>
        </div>
    );
}
