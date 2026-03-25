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
import { CycleEntry, MoodType } from "@/lib/types"
import { toLocalISO } from "@/lib/utils"
import { Trash2, Flame, Zap, Heart, ShieldCheck, Droplets, ChevronDown, Minus, Plus } from "lucide-react"
import { motion } from "framer-motion"

// --- Maps for summaries ---
const periodMap: Record<string, string> = { light: 'Leicht', medium: 'Mittel', heavy: 'Stark', spotting: 'Schmier' };
const painMap: Record<string, string> = { light: 'Leicht', medium: 'Mittel', strong: 'Stark', extreme: 'Extrem' };
const lhMap: Record<string, string> = { peak: 'Peak', positive: 'Positiv', negative: 'Negativ' };
const cervixMap: Record<string, string> = { dry: 'Trocken', sticky: 'Klebrig', creamy: 'Cremig', watery: 'Wässrig', eggwhite: 'Spinnbar' };

// --- CollapsibleSection ---
const CollapsibleSection = ({ title, summary, children, defaultOpen = false }: {
    title: string; summary?: string; children: React.ReactNode; defaultOpen?: boolean;
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border border-border/50 rounded-2xl overflow-hidden bg-card">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 active:bg-muted/50 transition-colors"
            >
                <span className="font-serif font-semibold text-sm">{title}</span>
                <div className="flex items-center gap-2">
                    {!isOpen && summary && (
                        <span className="text-xs text-muted-foreground truncate max-w-[150px]">{summary}</span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>
            <motion.div
                initial={false}
                animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="overflow-hidden"
            >
                <div className="px-4 pb-4 pt-1 space-y-3">
                    {children}
                </div>
            </motion.div>
        </div>
    );
};

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

    const handleOptionSelect = (key: keyof CycleEntry, value: string | boolean | null) => {
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

    const toggleMood = (mood: MoodType) => {
        const current = entry.mood || [];
        if (current.includes(mood)) {
            setEntry(prev => ({ ...prev, mood: current.filter(m => m !== mood) }));
        } else {
            setEntry(prev => ({ ...prev, mood: [...current, mood] }));
        }
    };

    const hasExistingEntry = !!(data.entries[date] && Object.keys(data.entries[date]).length > 1);

    // Symptom & Mood options
    const symptoms = ['Krämpfe', 'Kopfschmerzen', 'Brustschmerzen', 'Rückenschmerzen', 'Übelkeit', 'Blähungen', 'Müdigkeit', 'Akne'];
    const moods = [
        { key: 'happy', label: 'Gut' },
        { key: 'energetic', label: 'Energisch' },
        { key: 'tired', label: 'Müde' },
        { key: 'sad', label: 'Traurig' },
        { key: 'anxious', label: 'Ängstlich' },
        { key: 'irritated', label: 'Gereizt' },
        { key: 'moodswings', label: 'Schwankungen' },
    ];

    // --- Summaries ---
    const bleedingSummary = [
        entry.period && periodMap[entry.period],
        entry.pain && `Schmerz: ${painMap[entry.pain]}`,
    ].filter(Boolean).join(' · ') || undefined;

    const fertilitySummary = [
        entry.lhTest && `LH: ${lhMap[entry.lhTest]}`,
        entry.cervix && cervixMap[entry.cervix],
    ].filter(Boolean).join(' · ') || undefined;

    const wellbeingSummary = [
        (entry.mood?.length || 0) > 0 && `${entry.mood!.length} Stimmung${entry.mood!.length > 1 ? 'en' : ''}`,
        (entry.symptoms?.length || 0) > 0 && `${entry.symptoms!.length} Symptom${entry.symptoms!.length > 1 ? 'e' : ''}`,
    ].filter(Boolean).join(' · ') || undefined;

    const otherSummary = [
        entry.sex === 'unprotected' && 'GV (ungesch.)',
        entry.sex === 'protected' && 'GV (gesch.)',
        entry.notes && 'Notiz',
    ].filter(Boolean).join(' · ') || undefined;

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                {children}
            </DrawerTrigger>
            <DrawerContent className="max-h-[85vh]">
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <DrawerTitle className="text-lg">{hasExistingEntry ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</DrawerTitle>
                            <Input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-auto text-xs h-8 px-2 rounded-lg"
                            />
                        </div>
                        <DrawerDescription className="text-xs">
                            {date ? new Date(date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Heute'}
                        </DrawerDescription>
                    </DrawerHeader>

                    <div className="px-4 pb-4 space-y-3 overflow-y-auto max-h-[70vh]">

                        {/* Temperature — always visible */}
                        <div className="bg-card rounded-2xl p-4 border border-border/50 space-y-3">
                            <Label className="font-serif font-semibold text-sm">Temperatur</Label>
                            <div className="flex items-center justify-center gap-4">
                                <button
                                    className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform"
                                    onClick={() => {
                                        const current = entry.temperature || 36.5;
                                        setEntry(prev => ({ ...prev, temperature: Math.round((current - 0.05) * 100) / 100 }));
                                    }}
                                >
                                    <Minus className="w-4 h-4" />
                                </button>
                                <div className="text-center">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={entry.temperature || ''}
                                        onChange={(e) => setEntry(prev => ({ ...prev, temperature: e.target.value ? parseFloat(e.target.value) : null }))}
                                        placeholder="36.50"
                                        className={`text-3xl font-bold text-center w-28 bg-transparent outline-none font-sans tabular-nums ${entry.excludeTemp ? 'opacity-40 line-through' : ''}`}
                                    />
                                    <span className="text-xs text-muted-foreground">°C</span>
                                </div>
                                <button
                                    className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform"
                                    onClick={() => {
                                        const current = entry.temperature || 36.5;
                                        setEntry(prev => ({ ...prev, temperature: Math.round((current + 0.05) * 100) / 100 }));
                                    }}
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <Switch
                                    id="exclude-temp"
                                    checked={entry.excludeTemp || false}
                                    onCheckedChange={(checked) => setEntry(prev => ({ ...prev, excludeTemp: checked }))}
                                />
                                <Label htmlFor="exclude-temp" className="text-xs text-muted-foreground">Störfaktor</Label>
                            </div>
                        </div>

                        {/* Bleeding & Pain */}
                        <CollapsibleSection title="Blutung & Schmerz" summary={bleedingSummary} defaultOpen={!!(entry.period || entry.pain)}>
                            <Label className="text-xs text-muted-foreground">Blutungsstärke</Label>
                            <div className="flex gap-3 justify-center">
                                {[
                                    { val: 'light', label: 'Leicht' },
                                    { val: 'medium', label: 'Mittel' },
                                    { val: 'heavy', label: 'Stark' },
                                    { val: 'spotting', label: 'Schmier' },
                                ].map(t => (
                                    <button key={t.val}
                                        onClick={() => handleOptionSelect('period', t.val)}
                                        className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${entry.period === t.val ? 'scale-110' : ''}`}
                                    >
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${entry.period === t.val ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-border text-muted-foreground'}`}>
                                            <Droplets className="w-5 h-5" />
                                        </div>
                                        <span className="text-[10px] font-medium">{t.label}</span>
                                    </button>
                                ))}
                            </div>

                            <Label className="text-xs text-muted-foreground pt-2">Schmerzen</Label>
                            <div className="flex gap-3 justify-center">
                                {[
                                    { val: 'light', label: 'Leicht', icon: <Zap className="w-5 h-5" /> },
                                    { val: 'medium', label: 'Mittel', icon: <><Zap className="w-4 h-4" /><Zap className="w-4 h-4" /></> },
                                    { val: 'strong', label: 'Stark', icon: <Flame className="w-5 h-5" /> },
                                    { val: 'extreme', label: 'Extrem', icon: <Flame className="w-5 h-5 text-destructive" /> },
                                ].map(p => (
                                    <button key={p.val}
                                        onClick={() => handleOptionSelect('pain', p.val)}
                                        className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${entry.pain === p.val ? 'scale-110' : ''}`}
                                    >
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${entry.pain === p.val ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-border text-muted-foreground'}`}>
                                            {p.icon}
                                        </div>
                                        <span className="text-[10px] font-medium">{p.label}</span>
                                    </button>
                                ))}
                            </div>
                        </CollapsibleSection>

                        {/* Fertility Signs */}
                        <CollapsibleSection title="Fruchtbarkeitszeichen" summary={fertilitySummary}>
                            <Label className="text-xs text-muted-foreground">LH-Test (Ovulationstest)</Label>
                            <div className="flex gap-2 justify-center">
                                {[
                                    { val: 'peak', label: 'Peak' },
                                    { val: 'positive', label: 'Positiv' },
                                    { val: 'negative', label: 'Negativ' },
                                ].map(opt => (
                                    <button key={opt.val}
                                        onClick={() => handleOptionSelect('lhTest', opt.val)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95 border ${entry.lhTest === opt.val ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-border text-muted-foreground'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            <Label className="text-xs text-muted-foreground pt-2">Zervixschleim</Label>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {[
                                    { val: 'dry', label: 'Trocken' },
                                    { val: 'sticky', label: 'Klebrig' },
                                    { val: 'creamy', label: 'Cremig' },
                                    { val: 'watery', label: 'Wässrig' },
                                    { val: 'eggwhite', label: 'Spinnbar' },
                                ].map(opt => (
                                    <button key={opt.val}
                                        onClick={() => handleOptionSelect('cervix', opt.val)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95 border ${entry.cervix === opt.val ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-border text-muted-foreground'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </CollapsibleSection>

                        {/* Wellbeing */}
                        <CollapsibleSection title="Wohlbefinden" summary={wellbeingSummary}>
                            <Label className="text-xs text-muted-foreground">Stimmung</Label>
                            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                                {moods.map(m => (
                                    <button key={m.key}
                                        onClick={() => toggleMood(m.key as MoodType)}
                                        className={`flex-shrink-0 flex flex-col items-center gap-1 transition-all active:scale-95 ${(entry.mood || []).includes(m.key as MoodType) ? 'scale-110' : ''}`}
                                    >
                                        <div className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-colors text-xs font-bold ${(entry.mood || []).includes(m.key as MoodType) ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-border text-muted-foreground'}`}>
                                            {m.label.charAt(0)}
                                        </div>
                                        <span className="text-[10px] font-medium whitespace-nowrap">{m.label}</span>
                                    </button>
                                ))}
                            </div>

                            <Label className="text-xs text-muted-foreground pt-2">Symptome</Label>
                            <div className="flex flex-wrap gap-1.5">
                                {symptoms.map(s => (
                                    <button key={s}
                                        onClick={() => toggleSymptom(s)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 border ${(entry.symptoms || []).includes(s) ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-border text-muted-foreground'}`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </CollapsibleSection>

                        {/* GV + Notes */}
                        <CollapsibleSection title="GV & Notizen" summary={otherSummary}>
                            <Label className="text-xs text-muted-foreground">Geschlechtsverkehr</Label>
                            <div className="flex gap-2 justify-center">
                                <button
                                    onClick={() => handleOptionSelect('sex', 'unprotected')}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95 border ${entry.sex === 'unprotected' ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-border text-muted-foreground'}`}
                                >
                                    <Heart className="w-4 h-4" /> Ungeschützt
                                </button>
                                <button
                                    onClick={() => handleOptionSelect('sex', 'protected')}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95 border ${entry.sex === 'protected' ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-border text-muted-foreground'}`}
                                >
                                    <ShieldCheck className="w-4 h-4" /> Geschützt
                                </button>
                            </div>

                            <Label className="text-xs text-muted-foreground pt-2">Notizen</Label>
                            <textarea
                                value={entry.notes || ''}
                                onChange={(e) => setEntry(prev => ({ ...prev, notes: e.target.value }))}
                                className="w-full p-3 text-sm border border-border/50 rounded-xl resize-none focus:ring-2 focus:ring-primary/20 outline-none bg-transparent"
                                rows={3}
                                placeholder="Optionale Notizen..."
                            />
                        </CollapsibleSection>

                    </div>

                    <DrawerFooter className="pt-2">
                        <Button
                            onClick={handleSave}
                            className="w-full bg-gradient-to-r from-primary to-coral text-white rounded-xl h-12 text-base font-semibold shadow-soft active:scale-[0.98] transition-transform"
                        >
                            Speichern
                        </Button>
                        <div className="flex gap-2">
                            <DrawerClose asChild>
                                <Button variant="outline" className="flex-1 rounded-xl">Abbrechen</Button>
                            </DrawerClose>
                            {hasExistingEntry && (
                                <Button variant="destructive" size="icon" className="rounded-xl" onClick={handleDelete}>
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
