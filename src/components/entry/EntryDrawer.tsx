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
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect } from "react"
import { useCycleData } from "@/hooks/useCycleData"
import { toast } from "sonner"
import { CycleEntry, SexType, CervixType, LHTestResult } from "@/lib/types"
import { toLocalISO } from "@/lib/utils"

export function EntryDrawer({ children }: { children: React.ReactNode }) {
    const { data, updateEntry, isLoaded } = useCycleData();
    const [date, setDate] = useState<string>(toLocalISO());
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
            <DrawerContent className="max-h-[90vh]">
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>Eintrag hinzufügen</DrawerTitle>
                        <DrawerDescription>Logge deine Daten für {new Date(date).toLocaleDateString()}.</DrawerDescription>
                    </DrawerHeader>

                    <div className="p-4 space-y-6 overflow-y-auto max-h-[60vh]">
                        {/* Date */}
                        <div className="space-y-2">
                            <Label>Datum</Label>
                            <Input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>

                        {/* Temperature */}
                        <div className="space-y-2">
                            <Label className="flex justify-between">
                                Temperatur
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="exclude-temp"
                                        checked={entry.excludeTemp || false}
                                        onCheckedChange={(checked) => setEntry(prev => ({ ...prev, excludeTemp: checked }))}
                                    />
                                    <Label htmlFor="exclude-temp" className="text-xs font-normal text-muted-foreground">Störfaktor?</Label>
                                </div>
                            </Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={entry.temperature || ''}
                                    onChange={(e) => setEntry(prev => ({ ...prev, temperature: e.target.value ? parseFloat(e.target.value) : null }))}
                                    placeholder="36.50"
                                    className={entry.excludeTemp ? 'opacity-50' : ''}
                                />
                                <span className="text-sm text-muted-foreground">°C</span>
                            </div>
                        </div>

                        {/* Period */}
                        <div className="space-y-2">
                            <Label>Periode</Label>
                            <div className="flex flex-wrap gap-2">
                                {['light', 'medium', 'heavy', 'spotting'].map(t => (
                                    <Button
                                        key={t}
                                        variant={entry.period === t ? "default" : "outline"}
                                        size="sm"
                                        className={entry.period === t ? 'bg-primary text-primary-foreground' : ''}
                                        onClick={() => handleOptionSelect('period', t)}
                                    >
                                        {t === 'light' ? 'Leicht' : t === 'medium' ? 'Mittel' : t === 'heavy' ? 'Stark' : 'Schmier'}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* LH Test */}
                        <div className="space-y-2">
                            <Label>LH-Test (Ovulationstest)</Label>
                            <div className="flex gap-2 flex-wrap">
                                <Button
                                    variant={entry.lhTest === 'peak' ? "default" : "outline"}
                                    onClick={() => handleOptionSelect('lhTest', 'peak')}
                                    className={entry.lhTest === 'peak' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
                                >
                                    Peak (Max)
                                </Button>
                                <Button
                                    variant={entry.lhTest === 'positive' ? "default" : "outline"}
                                    onClick={() => handleOptionSelect('lhTest', 'positive')}
                                    className={entry.lhTest === 'positive' ? 'bg-indigo-500 hover:bg-indigo-600 text-white' : ''}
                                >
                                    Positiv
                                </Button>
                                <Button
                                    variant={entry.lhTest === 'negative' ? "secondary" : "outline"}
                                    onClick={() => handleOptionSelect('lhTest', 'negative')}
                                >
                                    Negativ
                                </Button>
                            </div>
                        </div>

                        {/* Sex */}
                        <div className="space-y-2">
                            <Label>Geschlechtsverkehr</Label>
                            <div className="flex gap-2">
                                <Button
                                    variant={entry.sex === 'unprotected' ? "default" : "outline"}
                                    onClick={() => handleOptionSelect('sex', 'unprotected')}
                                    className={entry.sex === 'unprotected' ? 'bg-rose-500 hover:bg-rose-600 text-white' : ''}
                                >
                                    ❤️ Ungeschützt
                                </Button>
                                <Button
                                    variant={entry.sex === 'protected' ? "default" : "outline"}
                                    onClick={() => handleOptionSelect('sex', 'protected')}
                                    className={entry.sex === 'protected' ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''}
                                >
                                    🛡️ Geschützt
                                </Button>
                            </div>
                        </div>

                        {/* Cervix */}
                        <div className="space-y-2">
                            <Label>Zervixschleim</Label>
                            <Select value={entry.cervix || ''} onValueChange={(v) => handleOptionSelect('cervix', v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Auswählen..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="dry">Trocken (t)</SelectItem>
                                    <SelectItem value="sticky">Klebrig/Feucht (Ø)</SelectItem>
                                    <SelectItem value="creamy">Cremig (S)</SelectItem>
                                    <SelectItem value="watery">Wässrig (S+)</SelectItem>
                                    <SelectItem value="eggwhite">Eiweißartig/Spinnbar (S+)</SelectItem>
                                </SelectContent>
                            </Select>
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
