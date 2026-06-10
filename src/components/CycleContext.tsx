
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CycleData, DEFAULT_CYCLE_DATA, CycleEntry, EngineResult } from '@/lib/types';
import { rotateLocalBackup, debouncedCloudSync, cancelPendingCloudSync } from '@/lib/backup';
import { validateImportData } from '@/lib/schemas';
import { runEngine } from '@/lib/cycle-calculations';
import { groupCycles, CycleGroup } from '@/lib/history-utils';
import { toast } from 'sonner';

const STORAGE_KEY = 'cycletrack_data';
const CORRUPT_RESCUE_KEY = 'cycletrack_data_corrupt';

export type ImportMode = 'merge' | 'replace';

interface CycleContextType {
    data: CycleData;
    isLoaded: boolean;
    engine: EngineResult | null;
    cycles: CycleGroup[];
    updateEntry: (date: string, entry: Partial<CycleEntry>) => void;
    setAllEntries: (newEntries: Record<string, CycleEntry>) => void;
    mergeEntries: (newEntries: Record<string, CycleEntry>) => void;
    deleteEntry: (date: string) => void;
    updateSettings: (settings: Partial<Omit<CycleData, 'entries'>>) => void;
    importData: (jsonData: string, mode?: ImportMode) => { count: number; warnings: string[] };
    clearAllData: () => void;
}

const CycleContext = createContext<CycleContextType | undefined>(undefined);

/** Apply only the settings keys that are actually present, so a backup
 *  without settings does not silently reset them to schema defaults. */
function presentSettings(parsed: Partial<CycleData>): Partial<CycleData> {
    const out: Partial<CycleData> = {};
    if (typeof parsed.cycleLength === 'number') out.cycleLength = parsed.cycleLength;
    if (typeof parsed.periodLength === 'number') out.periodLength = parsed.periodLength;
    if (typeof parsed.lutealPhase === 'number') out.lutealPhase = parsed.lutealPhase;
    if (typeof parsed.onboardingCompleted === 'boolean') out.onboardingCompleted = parsed.onboardingCompleted;
    return out;
}

export function CycleProvider({ children }: { children: React.ReactNode }) {
    const [data, setData] = useState<CycleData>(DEFAULT_CYCLE_DATA);
    const [isLoaded, setIsLoaded] = useState(false);
    // Serialized form of the last state we read from or wrote to localStorage.
    // Persisting only when the serialization differs prevents the load cycle
    // from re-writing (and re-backing-up, re-syncing) unchanged data on every
    // app start — and from overwriting good data after a failed load.
    const lastPersistedRef = useRef<string | null>(null);
    // Set when the stored payload could not be parsed. Blocks persistence
    // until the user makes an explicit change, so a transient parse failure
    // can never bulldoze the stored data with defaults.
    const loadFailedRef = useRef(false);

    // Load on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (!parsed || typeof parsed !== 'object' || typeof parsed.entries !== 'object') {
                    throw new Error('Unerwartete Datenstruktur');
                }
                const next: CycleData = {
                    ...DEFAULT_CYCLE_DATA,
                    ...parsed,
                    entries: parsed.entries || {},
                };
                lastPersistedRef.current = JSON.stringify(next);
                setData(next);
            } catch (e) {
                console.error('Failed to parse cycle data', e);
                loadFailedRef.current = true;
                // Preserve the corrupt payload for manual recovery instead of
                // letting the next persist cycle overwrite it.
                try {
                    localStorage.setItem(CORRUPT_RESCUE_KEY, stored);
                } catch { /* rescue copy is best-effort */ }
                toast.error('Gespeicherte Daten konnten nicht gelesen werden', {
                    description: 'Eine Sicherungskopie wurde angelegt. Prüfe die Backups in den Einstellungen.',
                    duration: Infinity,
                });
            }
        }
        setIsLoaded(true);
    }, []);

    // Listen for changes from other tabs so two open tabs do not
    // overwrite each other with stale whole-object writes.
    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key !== STORAGE_KEY) return;
            // event.newValue ist nur ein Snapshot zum Versandzeitpunkt — bis
            // zur Zustellung kann DIESER Tab bereits neuer geschrieben haben.
            // Deshalb immer den aktuellen Stand frisch lesen statt den
            // (potenziell stalen) Event-Payload zu übernehmen.
            const current = localStorage.getItem(STORAGE_KEY);
            if (current === null || current === lastPersistedRef.current) return;
            try {
                const parsed = JSON.parse(current);
                if (!parsed || typeof parsed !== 'object' || typeof parsed.entries !== 'object') return;
                lastPersistedRef.current = current;
                setData({ ...DEFAULT_CYCLE_DATA, ...parsed, entries: parsed.entries || {} });
            } catch {
                // ignore malformed cross-tab payloads
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    // Persist whenever data actually changed
    useEffect(() => {
        if (!isLoaded) return;
        if (loadFailedRef.current) return; // blocked until an explicit user change
        const serialized = JSON.stringify(data);
        if (serialized === lastPersistedRef.current) return;
        try {
            localStorage.setItem(STORAGE_KEY, serialized);
            lastPersistedRef.current = serialized;
        } catch (e) {
            console.error('Persist failed', e);
            toast.error('Speichern fehlgeschlagen', {
                description: 'Der lokale Speicher ist voll. Exportiere deine Daten und lösche alte Backups.',
            });
            return;
        }
        rotateLocalBackup(data);
        debouncedCloudSync(data);
    }, [data, isLoaded]);

    // Any explicit mutation lifts the corrupt-load write block: the user is
    // knowingly starting fresh, and the rescue copy is already preserved.
    const unblockPersistence = useCallback(() => {
        loadFailedRef.current = false;
    }, []);

    // Memoized computed values
    const engine = useMemo(() => {
        if (!data?.entries || Object.keys(data.entries).length === 0) return null;
        return runEngine(data);
    }, [data]);

    const cycles = useMemo(() => {
        if (!data?.entries) return [];
        return groupCycles(data.entries);
    }, [data?.entries]);

    const updateEntry = useCallback((date: string, entry: Partial<CycleEntry>) => {
        unblockPersistence();
        setData(prev => {
            const newEntries = { ...prev.entries };
            const existing = newEntries[date] || { date };
            newEntries[date] = { ...existing, ...entry };
            return { ...prev, entries: newEntries };
        });
    }, [unblockPersistence]);

    const setAllEntries = useCallback((newEntries: Record<string, CycleEntry>) => {
        unblockPersistence();
        setData(prev => ({ ...prev, entries: { ...prev.entries, ...newEntries } }));
    }, [unblockPersistence]);

    // Per-date deep merge: an imported entry only adds/overrides the fields it
    // brings instead of replacing an existing entry wholesale.
    const mergeEntries = useCallback((newEntries: Record<string, CycleEntry>) => {
        unblockPersistence();
        setData(prev => {
            const merged = { ...prev.entries };
            for (const [date, entry] of Object.entries(newEntries)) {
                merged[date] = { ...merged[date], ...entry };
            }
            return { ...prev, entries: merged };
        });
    }, [unblockPersistence]);

    const deleteEntry = useCallback((date: string) => {
        unblockPersistence();
        setData(prev => {
            const newEntries = { ...prev.entries };
            delete newEntries[date];
            return { ...prev, entries: newEntries };
        });
    }, [unblockPersistence]);

    const updateSettings = useCallback((settings: Partial<Omit<CycleData, 'entries'>>) => {
        unblockPersistence();
        setData(prev => ({ ...prev, ...settings }));
    }, [unblockPersistence]);

    const importData = useCallback((jsonData: string, mode: ImportMode = 'merge') => {
        const result = validateImportData(jsonData);
        if (!result.success) {
            return { count: 0, warnings: [result.error, ...result.details] };
        }
        // Ein Replace auf einen leeren Datenbestand ist nie gewollt — das
        // wäre ein vollständiger Daten-Wipe durch ein leeres/kaputtes Backup.
        // Explizites Löschen gibt es separat über clearAllData().
        if (mode === 'replace' && Object.keys(result.data.entries).length === 0) {
            return { count: 0, warnings: ['Das Backup enthält keine Einträge — Wiederherstellung abgebrochen, deine Daten bleiben unverändert.'] };
        }
        unblockPersistence();
        const settings = presentSettings(result.data);
        if (mode === 'replace') {
            // Restore semantics: the backup becomes the new truth. Entries
            // added after the backup was taken are removed (that is the point
            // of a restore); settings fall back to current values when the
            // backup does not carry them.
            setData(prev => ({ ...prev, ...settings, entries: result.data.entries }));
        } else {
            setData(prev => ({ ...prev, ...settings, entries: { ...prev.entries, ...result.data.entries } }));
        }
        return { count: Object.keys(result.data.entries).length, warnings: result.warnings };
    }, [unblockPersistence]);

    const clearAllData = useCallback(() => {
        unblockPersistence();
        // A pending debounced sync would push the now-empty state to the
        // cloud backup 60s later — cancel it; cloud wipe must be explicit.
        cancelPendingCloudSync();
        setData({ ...DEFAULT_CYCLE_DATA, entries: {} });
    }, [unblockPersistence]);

    const contextValue = useMemo(() => ({
        data, isLoaded, engine, cycles, updateEntry, setAllEntries, mergeEntries, deleteEntry,
        updateSettings, importData, clearAllData
    }), [data, isLoaded, engine, cycles, updateEntry, setAllEntries, mergeEntries, deleteEntry,
        updateSettings, importData, clearAllData]);

    return (
        <CycleContext.Provider value={contextValue}>
            {children}
        </CycleContext.Provider>
    );
}

export function useCycleData() {
    const context = useContext(CycleContext);
    if (context === undefined) {
        throw new Error('useCycleData must be used within a CycleProvider');
    }
    return context;
}
