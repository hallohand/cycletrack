'use client';
import { useState, useEffect } from 'react';
import { useCycleData } from '@/hooks/useCycleData';
import { CycleEntry, CervixType, LHTestResult, SexType, MoodType } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { toLocalISO } from '@/lib/utils';

export default function EntryPage() {
    const router = useRouter();
    const { data, updateEntry, isLoaded } = useCycleData();
    const [date, setDate] = useState<string>('');
    const [entry, setEntry] = useState<Partial<CycleEntry>>({});

    useEffect(() => {
        // Default to today
        const today = toLocalISO();
        setDate(today);
    }, []);

    useEffect(() => {
        if (isLoaded && date) {
            const existing = data.entries[date] || {};
            setEntry(existing);
        }
    }, [date, isLoaded, data.entries]);

    const handleSave = () => {
        if (!date) return;
        updateEntry(date, entry);
        router.push('/');
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

    if (!isLoaded) return <div className="p-8 text-center">Laden...</div>;

    return (
        <div className="space-y-6 pb-20">
            <div className="bg-white p-4 rounded-2xl shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">Datum</label>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
                />
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">Temperatur (°C)</label>
                <input
                    type="number"
                    step="0.01"
                    placeholder="36.50"
                    value={entry.temperature || ''}
                    onChange={(e) => setEntry(prev => ({ ...prev, temperature: e.target.value ? parseFloat(e.target.value) : null }))}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
                />
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">Periode</label>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { val: 'light', label: 'Leicht' },
                        { val: 'medium', label: 'Mittel' },
                        { val: 'heavy', label: 'Stark' },
                        { val: 'spotting', label: 'Schmierblutung' }
                    ].map((opt) => (
                        <button
                            key={opt.val}
                            onClick={() => handleOptionSelect('period', opt.val)}
                            className={`p-3 rounded-xl border text-sm font-medium transition-colors ${entry.period === opt.val
                                ? 'bg-pink-100 border-pink-500 text-pink-700'
                                : 'border-gray-200 hover:border-pink-300'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">Zervixschleim</label>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { val: 'dry', label: 'Trocken' },
                        { val: 'sticky', label: 'Klebrig' },
                        { val: 'creamy', label: 'Cremig' },
                        { val: 'watery', label: 'Wässrig' },
                        { val: 'eggwhite', label: 'Eiweißartig' }
                    ].map((opt) => (
                        <button
                            key={opt.val}
                            onClick={() => handleOptionSelect('cervix', opt.val)}
                            className={`p-3 rounded-xl border text-sm font-medium transition-colors ${entry.cervix === opt.val
                                ? 'bg-blue-100 border-blue-500 text-blue-700'
                                : 'border-gray-200 hover:border-blue-300'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">LH-Test</label>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => handleOptionSelect('lhTest', 'negative')}
                        className={`p-3 rounded-xl border text-sm font-medium ${entry.lhTest === 'negative' ? 'bg-gray-200 border-gray-400' : 'border-gray-200'}`}
                    >
                        Negativ
                    </button>
                    <button
                        onClick={() => handleOptionSelect('lhTest', 'positive')}
                        className={`p-3 rounded-xl border text-sm font-medium ${entry.lhTest === 'positive' ? 'bg-orange-100 border-orange-500 text-orange-700' : 'border-gray-200'}`}
                    >
                        Positiv
                    </button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notizen</label>
                <textarea
                    value={entry.notes || ''}
                    onChange={(e) => setEntry(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
                    rows={3}
                />
            </div>

            <button
                onClick={handleSave}
                className="w-full bg-pink-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-pink-200 active:scale-95 transition-transform"
            >
                Speichern
            </button>
        </div>
    );
}
