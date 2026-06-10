
'use client';

import { useState, useEffect } from 'react';
import { useCycleData } from '@/components/CycleContext';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { de } from 'date-fns/locale';
import { ArrowRight, Check, Droplet, CalendarDays, Clock, Hand } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toLocalISO } from '@/lib/utils';

export function OnboardingWizard() {
    const { data, isLoaded, updateSettings, updateEntry } = useCycleData();
    const [step, setStep] = useState(1);

    // Form State
    const [cycleLength, setCycleLength] = useState(28);
    const [periodLength, setPeriodLength] = useState(5);
    const [lastPeriodDate, setLastPeriodDate] = useState<Date | undefined>(undefined);

    const hasEntries = Object.keys(data.entries).length > 0;
    // Sichtbarkeit wird direkt aus den Daten abgeleitet (kein open-State):
    // Wizard nur für wirklich neue Nutzerinnen ohne Einträge.
    const open = isLoaded && data.onboardingCompleted === false && !hasEntries;

    useEffect(() => {
        // Migration: Bestandsdaten ohne Flag -> Flag setzen, Wizard überspringen.
        if (isLoaded && data.onboardingCompleted === false && hasEntries) {
            updateSettings({ onboardingCompleted: true });
        }
    }, [isLoaded, data.onboardingCompleted, hasEntries, updateSettings]);

    const handleNext = () => {
        setStep(prev => prev + 1);
    };

    const handleFinish = () => {
        // Save Settings
        const newSettings = {
            cycleLength,
            periodLength,
            onboardingCompleted: true
        };
        updateSettings(newSettings);

        // Save Last Period if selected
        if (lastPeriodDate) {
            // Create period entries for the duration
            const startDate = new Date(lastPeriodDate);

            for (let i = 0; i < periodLength; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                const isoDate = toLocalISO(d);

                // Determine flow based on day (heuristic)
                let flow: 'light' | 'medium' | 'heavy' = 'medium';
                if (i === 0 || i === 1) flow = 'heavy';
                if (i >= periodLength - 2) flow = 'light';

                updateEntry(isoDate, {
                    date: isoDate,
                    period: flow
                });
            }
        }
        // Kein setOpen nötig: onboardingCompleted=true schließt den Dialog abgeleitet.
    };

    if (!open) return null;

    return (
        <Dialog open={open} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-[425px] [&>button]:hidden text-center" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>

                {step === 1 && (
                    <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4"><Hand className="w-8 h-8 text-primary" /></div>
                        <DialogHeader>
                            <DialogTitle className="text-xl text-center font-serif">Willkommen bei CycleTrack</DialogTitle>
                            <DialogDescription className="text-center">
                                Lass uns kurz deinen Zyklus einrichten, damit die Vorhersagen stimmen.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-6">
                            <p className="text-sm text-muted-foreground">Das dauert nur 30 Sekunden.</p>
                        </div>
                        <Button className="w-full bg-primary hover:bg-primary/90 text-white" onClick={handleNext}>
                            Los geht&apos;s <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                )}

                {step === 2 && (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-8 duration-300">
                        <DialogHeader>
                            <DialogTitle className="text-center flex items-center justify-center gap-2 font-serif">
                                <Clock className="w-5 h-5 text-primary" /> Zykluslänge
                            </DialogTitle>
                            <DialogDescription className="text-center">
                                Wie viele Tage liegen durchschnittlich zwischen deinen Perioden?
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4 space-y-6">
                            <div className="text-4xl font-bold text-primary text-center font-mono">
                                {cycleLength} <span className="text-base font-normal text-muted-foreground">Tage</span>
                            </div>
                            <Slider
                                value={[cycleLength]}
                                onValueChange={(v) => setCycleLength(v[0])}
                                min={21}
                                max={45}
                                step={1}
                                aria-label="Durchschnittliche Zykluslänge in Tagen"
                                className="w-full"
                            />
                            <p className="text-xs text-muted-foreground text-center">
                                Standard sind oft 28 Tage. Du kannst das später ändern.
                            </p>
                        </div>

                        <Button onClick={handleNext} className="w-full">Weiter</Button>
                    </div>
                )}

                {step === 3 && (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-8 duration-300">
                        <DialogHeader>
                            <DialogTitle className="text-center flex items-center justify-center gap-2 font-serif">
                                <Droplet className="w-5 h-5 text-primary" /> Periodendauer
                            </DialogTitle>
                            <DialogDescription className="text-center">
                                Wie viele Tage blutest du üblicherweise?
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4 space-y-6">
                            <div className="text-4xl font-bold text-primary text-center font-mono">
                                {periodLength} <span className="text-base font-normal text-muted-foreground">Tage</span>
                            </div>
                            <Slider
                                value={[periodLength]}
                                onValueChange={(v) => setPeriodLength(v[0])}
                                min={2}
                                max={10}
                                step={1}
                                aria-label="Periodendauer in Tagen"
                                className="w-full"
                            />
                        </div>

                        <Button onClick={handleNext} className="w-full">Weiter</Button>
                    </div>
                )}

                {step === 4 && (
                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-8 duration-300">
                        <DialogHeader>
                            <DialogTitle className="text-center flex items-center justify-center gap-2 font-serif">
                                <CalendarDays className="w-5 h-5 text-primary" /> Letzte Periode
                            </DialogTitle>
                            <DialogDescription className="text-center">
                                Wann hat deine letzte Periode <b>begonnen</b>?
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex justify-center p-2 bg-muted/30 rounded-xl border">
                            <Calendar
                                mode="single"
                                selected={lastPeriodDate}
                                onSelect={setLastPeriodDate}
                                disabled={(date) => date > new Date() || date < new Date('2024-01-01')}
                                initialFocus
                                locale={de}
                                className="rounded-md border-none shadow-none"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Du kannst das auch überspringen, aber dann gibt es noch keine Vorhersage.
                        </p>

                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={handleFinish}>Überspringen</Button>
                            <Button className="flex-1 bg-primary hover:bg-primary/90 text-white" onClick={handleFinish} disabled={!lastPeriodDate}>
                                Fertig <Check className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
