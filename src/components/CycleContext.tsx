
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { CycleData, DEFAULT_CYCLE_DATA, CycleEntry } from '@/lib/types';
import { rotateLocalBackup, saveIndexedDBSnapshot, debouncedCloudSync } from '@/lib/backup';
import { validateImportData } from '@/lib/schemas';

const STORAGE_KEY = 'cycletrack_data';
const LAST_SNAPSHOT_KEY = 'cycletrack_last_snapshot';

interface CycleContextType {
    data: CycleData;
    isLoaded: boolean;
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
    const saveCount = useRef(0);

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

    const updateEntry = useCallback((date: string, entry: Partial<CycleEntry>) => {
        setData(prev => {
            const newEntries = { ...prev.entries };
            const existing = newEntries[date] || { date };
            newEntries[date] = { ...existing, ...entry };
            const newData = { ...prev, entries: newEntries };

            // Side Effects
            const json = JSON.stringify(newData);
            localStorage.setItem(STORAGE_KEY, json);
            rotateLocalBackup(json);
            debouncedCloudSync(newData);

            return newData;
        });
    }, []);

    const setAllEntries = useCallback((newEntries: Record<string, CycleEntry>) => {
        setData(prev => {
            const updatedData = { ...prev, entries: { ...prev.entries, ...newEntries } };
            // Side Effects
            const json = JSON.stringify(updatedData);
            localStorage.setItem(STORAGE_KEY, json);
            rotateLocalBackup(json);
            debouncedCloudSync(updatedData);
            return updatedData;
        });
    }, []);

    const deleteEntry = useCallback((date: string) => {
        setData(prev => {
            const newEntries = { ...prev.entries };
            delete newEntries[date];
            const newData = { ...prev, entries: newEntries };

            // Side Effects
            const json = JSON.stringify(newData);
            localStorage.setItem(STORAGE_KEY, json);
            rotateLocalBackup(json);
            debouncedCloudSync(newData);

            return newData;
        });
    }, []);

    const updateSettings = useCallback((settings: Partial<Omit<CycleData, 'entries'>>) => {
        setData(prev => {
            const newData = { ...prev, ...settings };
            // Side Effects
            const json = JSON.stringify(newData);
            localStorage.setItem(STORAGE_KEY, json);
            rotateLocalBackup(json);
            debouncedCloudSync(newData);
            return newData;
        });
    }, []);

    const importData = useCallback((jsonData: string) => {
        const result = validateImportData(jsonData);
        if (!result.success) {
            return { count: 0, warnings: [result.error, ...result.details] };
        }
        setData(prev => {
            const newData = { ...prev, ...result.data, entries: { ...prev.entries, ...result.data.entries } };
            // Side Effects
            const json = JSON.stringify(newData);
            localStorage.setItem(STORAGE_KEY, json);
            rotateLocalBackup(json);
            debouncedCloudSync(newData);
            return newData;
        });
        return { count: Object.keys(result.data.entries).length, warnings: result.warnings };
    }, []);

    const clearAllData = useCallback(() => {
        const newData = { ...DEFAULT_CYCLE_DATA, entries: {} };
        setData(newData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    }, []);

    return (
        <CycleContext.Provider value={{
            data,
            isLoaded,
            updateEntry,
            setAllEntries,
            deleteEntry,
            updateSettings,
            importData,
            clearAllData
        }}>
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
