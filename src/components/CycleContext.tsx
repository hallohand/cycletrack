
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CycleData, DEFAULT_CYCLE_DATA, CycleEntry, EngineResult } from '@/lib/types';
import { rotateLocalBackup, debouncedCloudSync } from '@/lib/backup';
import { validateImportData } from '@/lib/schemas';
import { runEngine } from '@/lib/cycle-calculations';
import { groupCycles, CycleGroup } from '@/lib/history-utils';

const STORAGE_KEY = 'cycletrack_data';

interface CycleContextType {
    data: CycleData;
    isLoaded: boolean;
    engine: EngineResult | null;
    cycles: CycleGroup[];
    updateEntry: (date: string, entry: Partial<CycleEntry>) => void;
    setAllEntries: (newEntries: Record<string, CycleEntry>) => void;
    deleteEntry: (date: string) => void;
    updateSettings: (settings: Partial<Omit<CycleData, 'entries'>>) => void;
    importData: (jsonData: string) => { count: number; warnings: string[] };
    clearAllData: () => void;
}

const CycleContext = createContext<CycleContextType | undefined>(undefined);

export function CycleProvider({ children }: { children: React.ReactNode }) {
    const [data, setData] = useState<CycleData>(DEFAULT_CYCLE_DATA);
    const [isLoaded, setIsLoaded] = useState(false);
    const isInitialLoad = useRef(true);

    // Load on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setData({
                    ...DEFAULT_CYCLE_DATA,
                    ...parsed,
                    entries: parsed.entries || {},
                });
            } catch (e) {
                console.error('Failed to parse cycle data', e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Persist whenever data changes (but not on initial load)
    useEffect(() => {
        if (isInitialLoad.current) {
            isInitialLoad.current = false;
            return;
        }
        if (!isLoaded) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        rotateLocalBackup(data);
        debouncedCloudSync(data);
    }, [data, isLoaded]);

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
        setData(prev => {
            const newEntries = { ...prev.entries };
            const existing = newEntries[date] || { date };
            newEntries[date] = { ...existing, ...entry };
            return { ...prev, entries: newEntries };
        });
    }, []);

    const setAllEntries = useCallback((newEntries: Record<string, CycleEntry>) => {
        setData(prev => ({ ...prev, entries: { ...prev.entries, ...newEntries } }));
    }, []);

    const deleteEntry = useCallback((date: string) => {
        setData(prev => {
            const newEntries = { ...prev.entries };
            delete newEntries[date];
            return { ...prev, entries: newEntries };
        });
    }, []);

    const updateSettings = useCallback((settings: Partial<Omit<CycleData, 'entries'>>) => {
        setData(prev => ({ ...prev, ...settings }));
    }, []);

    const importData = useCallback((jsonData: string) => {
        const result = validateImportData(jsonData);
        if (!result.success) {
            return { count: 0, warnings: [result.error, ...result.details] };
        }
        setData(prev => ({ ...prev, ...result.data, entries: { ...prev.entries, ...result.data.entries } }));
        return { count: Object.keys(result.data.entries).length, warnings: result.warnings };
    }, []);

    const clearAllData = useCallback(() => {
        setData({ ...DEFAULT_CYCLE_DATA, entries: {} });
    }, []);

    const contextValue = useMemo(() => ({
        data, isLoaded, engine, cycles, updateEntry, setAllEntries, deleteEntry,
        updateSettings, importData, clearAllData
    }), [data, isLoaded, engine, cycles, updateEntry, setAllEntries, deleteEntry,
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
