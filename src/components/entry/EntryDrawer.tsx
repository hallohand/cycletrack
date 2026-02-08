'use client';

import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { useCycleData } from "@/hooks/useCycleData"
import { toast } from "sonner"
import { CycleEntry } from "@/lib/types"

export function EntryDrawer({ children }: { children: React.ReactNode }) {
    const { data, updateEntry, isLoaded } = useCycleData();
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [entry, setEntry] = useState<Partial<CycleEntry>>({});
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (open && isLoaded && date) {
            setEntry(data.entries[date] || {});
        }
    }, [open, date, isLoaded, data.entries]);

    const handleSave = () => {
        updateEntry(date, entry);
        toast.success("Eintrag gespeichert");
        setOpen(false);
    };

    const handleOptionSelect = (key: keyof CycleEntry, value: any) => {
        setEntry(prev => ({ ...prev, [key]: prev[key] === value ? null : value }));
    };

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                {children}
            </DrawerTrigger>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>Eintrag hinzufügen</DrawerTitle>
                        <DrawerDescription>Logge deine Daten für {new Date(date).toLocaleDateString()}.</DrawerDescription>
                    </DrawerHeader>

                    <div className="p-4 space-y-6 overflow-y-auto max-h-[60vh]">
                        <div className="space-y-2">
                            <Label>Datum</Label>
                            <Input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Temperatur</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={entry.temperature || ''}
                                    onChange={(e) => setEntry(prev => ({ ...prev, temperature: e.target.value ? parseFloat(e.target.value) : null }))}
                                    placeholder="36.50"
                                />
                                <span className="text-sm text-muted-foreground">°C</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Periode</Label>
                            <div className="flex flex-wrap gap-2">
                                {['light', 'medium', 'heavy', 'spotting'].map(t => (
                                    <Button
                                        key={t}
                                        variant={entry.period === t ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => handleOptionSelect('period', t)}
                                    >
                                        {t === 'light' ? 'Leicht' : t === 'medium' ? 'Mittel' : t === 'heavy' ? 'Stark' : 'Schmier'}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>LH-Test</Label>
                            <div className="flex gap-2">
                                <Button
                                    variant={entry.lhTest === 'positive' ? "default" : "outline"}
                                    onClick={() => handleOptionSelect('lhTest', 'positive')}
                                    className={entry.lhTest === 'positive' ? 'bg-orange-500 hover:bg-orange-600' : ''}
                                >
                                    Positiv (+ LH)
                                </Button>
                                <Button
                                    variant={entry.lhTest === 'negative' ? "secondary" : "outline"}
                                    onClick={() => handleOptionSelect('lhTest', 'negative')}
                                >
                                    Negativ
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DrawerFooter>
                        <Button onClick={handleSave}>Speichern</Button>
                        <DrawerClose asChild>
                            <Button variant="outline">Abbrechen</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
