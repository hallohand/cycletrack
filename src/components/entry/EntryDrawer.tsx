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
import { useState, useEffect } from "react"
import { useCycleData } from "@/hooks/useCycleData"
import { toast } from "sonner"
import { CycleEntry } from "@/lib/types"
import { toLocalISO } from "@/lib/utils"
import { Trash2 } from "lucide-react"

interface EntryDrawerProps {
    children: React.ReactNode;
    prefillDate?: string;
    onDeleted?: () => void;
}

export function EntryDrawer({ children, prefillDate, onDeleted }: EntryDrawerProps) {
    const { data, updateEntry, deleteEntry, isLoaded } = useCycleData();
    const [date, setDate] = useState<string>(prefillDate || toLocalISO());
    const [entry, setEntry] = useState<Partial<CycleEntry>>({});
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (prefillDate) setDate(prefillDate);
    }, [prefillDate]);

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

    const handleDelete = () => {
        deleteEntry(date);
        toast.success("Eintrag gelöscht");
        setOpen(false);
        onDeleted?.();
    };

    const handleOptionSelect = (key: keyof CycleEntry, value: any) => {
        setEntry(prev => ({ ...prev, [key]: prev[key] === value ? null : value }));
    };

    const toggleSymptom = (symptom: string) => {
        const current = entry.symptoms || [];
        if (current.includes(symptom)) {
            setEntry(prev => ({ ...prev, symptoms: current.filter(s => s !== symptom) }));
        } else {
            setEntry(prev => ({ ...prev, symptoms: [...current, symptom] }));
        }
    };

    const toggleMood = (mood: string) => {
        const current = entry.mood || [];
        if (current.includes(mood as any)) {
            setEntry(prev => ({ ...prev, mood: current.filter(m => m !== mood) as any }));
        } else {
            setEntry(prev => ({ ...prev, mood: [...current, mood] as any }));
        }
    };

    const hasExistingEntry = !!(data.entries[date] && Object.keys(data.entries[date]).length > 1);

    // Symptom & Mood options
    const symptoms = ['Krämpfe', 'Kopfschmerzen', 'Brustschmerzen', 'Rückenschmerzen', 'Übelkeit', 'Blähungen', 'Müdigkeit', 'Akne'];
    const moods = [
        { key: 'happy', label: '😊 Gut' },
        { key: 'energetic', label: '⚡ Energisch' },
        { key: 'tired', label: '😴 Müde' },
        { key: 'sad', label: '😢 Traurig' },
        { key: 'anxious', label: '😰 Ängstlich' },
        { key: 'irritated', label: '😤 Gereizt' },
        { key: 'moodswings', label: '🎢 Schwankungen' },
    ];

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                {children}
            </DrawerTrigger>
            <DrawerContent className="max-h-[90vh]">
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>Eintrag {hasExistingEntry ? 'bearbeiten' : 'hinzufügen'}</DrawerTitle>
                        <DrawerDescription>Logge deine Daten für {date ? new Date(date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' }) : 'heute'}.</DrawerDescription>
                    </DrawerHeader>

                    <div className="p-4 space-y-5 overflow-y-auto max-h-[55vh]">
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


                        {/* Period & Pain */}
                        <div className="space-y-4 border-b pb-4">
                            <Label className="text-base font-semibold">Blutung & Schmerz</Label>

                            {/* Period Flow */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Blutungsstärke</Label>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { val: 'light', label: 'Leicht' },
                                        { val: 'medium', label: 'Mittel' },
                                        { val: 'heavy', label: 'Stark' },
                                    ].map(t => (
                                        <Button
                                            key={t.val}
                                            variant={entry.period === t.val ? "default" : "outline"}
                                            size="sm"
                                            className={entry.period === t.val ? 'bg-rose-500 hover:bg-rose-600 text-white' : ''}
                                            onClick={() => handleOptionSelect('period', t.val)}
                                        >
                                            {t.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Period Pain */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Schmerzen</Label>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { val: 'light', label: 'Leicht', icon: '⚡' },
                                        { val: 'medium', label: 'Mittel', icon: '⚡⚡' },
                                        { val: 'strong', label: 'Stark', icon: '🔥' },
                                        { val: 'extreme', label: 'Extrem', icon: '🚑' },
                                    ].map(p => (
                                        <Button
                                            key={p.val}
                                            variant={entry.pain === p.val ? "default" : "outline"}
                                            size="sm"
                                            className={entry.pain === p.val ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}
                                            onClick={() => handleOptionSelect('pain', p.val)}
                                        >
                                            <span className="mr-1">{p.icon}</span> {p.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* LH Test */}
                        <div className="space-y-2">
                            <Label>LH-Test (Ovulationstest)</Label>
                            <div className="flex gap-2 flex-wrap">
                                <Button
                                    variant={entry.lhTest === 'peak' ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleOptionSelect('lhTest', 'peak')}
                                    className={entry.lhTest === 'peak' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
                                >
                                    Peak (Max)
                                </Button>
                                <Button
                                    variant={entry.lhTest === 'positive' ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleOptionSelect('lhTest', 'positive')}
                                    className={entry.lhTest === 'positive' ? 'bg-indigo-500 hover:bg-indigo-600 text-white' : ''}
                                >
                                    Positiv
                                </Button>
                                <Button
                                    variant={entry.lhTest === 'negative' ? "secondary" : "outline"}
                                    size="sm"
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
                                    size="sm"
                                    onClick={() => handleOptionSelect('sex', 'unprotected')}
                                    className={entry.sex === 'unprotected' ? 'bg-rose-500 hover:bg-rose-600 text-white' : ''}
                                >
                                    ❤️ Ungeschützt
                                </Button>
                                <Button
                                    variant={entry.sex === 'protected' ? "default" : "outline"}
                                    size="sm"
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
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { val: 'dry', label: 'Trocken' },
                                    { val: 'sticky', label: 'Klebrig' },
                                    { val: 'creamy', label: 'Cremig' },
                                    { val: 'watery', label: 'Wässrig' },
                                    { val: 'eggwhite', label: 'Spinnbar' },
                                ].map(opt => (
                                    <Button
                                        key={opt.val}
                                        variant={entry.cervix === opt.val ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => handleOptionSelect('cervix', opt.val)}
                                    >
                                        {opt.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Symptoms */}
                        <div className="space-y-2">
                            <Label>Symptome</Label>
                            <div className="flex flex-wrap gap-1.5">
                                <Button
                                    variant={entry.period === 'spotting' ? "default" : "outline"}
                                    size="sm"
                                    className={entry.period === 'spotting' ? 'bg-orange-500 hover:bg-orange-600 text-white text-xs' : 'text-xs'}
                                    onClick={() => handleOptionSelect('period', 'spotting')}
                                >
                                    🩸 Schmierblutung
                                </Button>
                                {symptoms.map(s => (
                                    <Button
                                        key={s}
                                        variant={(entry.symptoms || []).includes(s) ? "default" : "outline"}
                                        size="sm"
                                        className="text-xs"
                                        onClick={() => toggleSymptom(s)}
                                    >
                                        {s}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Mood */}
                        <div className="space-y-2">
                            <Label>Stimmung</Label>
                            <div className="flex flex-wrap gap-1.5">
                                {moods.map(m => (
                                    <Button
                                        key={m.key}
                                        variant={(entry.mood || []).includes(m.key as any) ? "default" : "outline"}
                                        size="sm"
                                        className="text-xs"
                                        onClick={() => toggleMood(m.key)}
                                    >
                                        {m.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label>Notizen</Label>
                            <textarea
                                value={entry.notes || ''}
                                onChange={(e) => setEntry(prev => ({ ...prev, notes: e.target.value }))}
                                className="w-full p-2 text-sm border rounded-lg resize-none focus:ring-2 focus:ring-primary/20 outline-none"
                                rows={2}
                                placeholder="Optionale Notizen..."
                            />
                        </div>
                    </div>

                    <DrawerFooter>
                        <Button onClick={handleSave}>Speichern</Button>
                        <div className="flex gap-2">
                            <DrawerClose asChild>
                                <Button variant="outline" className="flex-1">Abbrechen</Button>
                            </DrawerClose>
                            {hasExistingEntry && (
                                <Button variant="destructive" size="icon" onClick={handleDelete}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
