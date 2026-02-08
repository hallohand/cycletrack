'use client';
import { useCycleData } from '@/hooks/useCycleData';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { calculatePredictions } from '@/lib/cycle-calculations';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { de } from 'date-fns/locale';

export default function CalendarPage() {
    const { data } = useCycleData();
    const [date, setDate] = useState<Date | undefined>(new Date());

    const predictions = calculatePredictions(data);
    const selectedDateStr = date?.toISOString().split('T')[0];
    const selectedEntry = selectedDateStr ? data.entries[selectedDateStr] : null;

    // Modifiers for coloring the calendar
    const periodDays: Date[] = [];
    const fertileDays: Date[] = [];
    const ovulationDays: Date[] = [];

    // Populate from history
    Object.values(data.entries).forEach(e => {
        const d = new Date(e.date);
        if (e.period) periodDays.push(d);
    });

    // Populate from predictions (future)
    if (predictions.nextPeriodStart) {
        // Just a simple estimation for visualization: next 5 days
        for (let i = 0; i < 5; i++) {
            const d = new Date(predictions.nextPeriodStart);
            d.setDate(d.getDate() + i);
            periodDays.push(d);
        }
    }
    if (predictions.ovulationNext) {
        ovulationDays.push(predictions.ovulationNext);
        // Fertile window approx -4 days
        for (let i = 1; i <= 4; i++) {
            const d = new Date(predictions.ovulationNext);
            d.setDate(d.getDate() - i);
            fertileDays.push(d);
        }
    }

    return (
        <div className="space-y-4">
            <Card className="border-none shadow-sm">
                <CardContent className="p-0 flex justify-center">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        locale={de}
                        modifiers={{
                            period: periodDays,
                            fertile: fertileDays,
                            ovulation: ovulationDays
                        }}
                        modifiersClassNames={{
                            period: 'bg-primary/20 text-primary font-bold',
                            fertile: 'bg-green-100 text-green-700 font-bold',
                            ovulation: 'bg-green-200 text-green-800 font-bold border-2 border-green-500 rounded-full'
                        }}
                        className="rounded-xl border shadow-sm p-4 bg-white"
                    />
                </CardContent>
            </Card>

            {/* Detail View for Selected Date */}
            <Card className="border-none bg-muted/30">
                <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base font-medium">
                        {date?.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    {selectedEntry ? (
                        <div className="flex flex-wrap gap-2">
                            {selectedEntry.temperature && <Badge variant="outline" className="bg-background">{selectedEntry.temperature}°C</Badge>}
                            {selectedEntry.period && <Badge className="bg-primary/20 text-primary hover:bg-primary/30">Periode: {selectedEntry.period}</Badge>}
                            {selectedEntry.lhTest && <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200">LH: {selectedEntry.lhTest}</Badge>}
                            {selectedEntry.cervix && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">{selectedEntry.cervix}</Badge>}
                            {selectedEntry.notes && <p className="w-full text-sm text-muted-foreground mt-2 bg-white/50 p-2 rounded-lg">{selectedEntry.notes}</p>}
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground text-center py-4">Keine Einträge für diesen Tag.</div>
                    )}
                </CardContent>
            </Card>

            <div className="flex gap-4 justify-center text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-primary/20 rounded-full"></div> Periode</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-100 rounded-full"></div> Fruchtbar</div>
            </div>
        </div>
    );
}
