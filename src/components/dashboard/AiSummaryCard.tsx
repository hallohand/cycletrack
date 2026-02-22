'use client';
import { useState, useEffect, useMemo } from 'react';
import { useCycleData } from '@/hooks/useCycleData';
import { runEngine } from '@/lib/cycle-calculations';
import { generateSummary, getApiKey } from '@/lib/gemini-client';
import { buildSystemPrompt, buildSummaryPrompt, hashEntries } from '@/lib/llm-context';
import { Sparkles, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const CACHE_KEY = 'cycletrack_ai_summary';
const HASH_KEY = 'cycletrack_ai_summary_hash';

interface CachedSummary {
    text: string;
    timestamp: string;
}

export function AiSummaryCard() {
    const { data, isLoaded } = useCycleData();
    const [summary, setSummary] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>('');

    const apiKey = useMemo(() => getApiKey(), []);

    const engine = useMemo(() => {
        if (!data?.entries || Object.keys(data.entries).length === 0) return null;
        return runEngine(data);
    }, [data]);

    const currentHash = useMemo(() => {
        if (!data?.entries) return '';
        return hashEntries(data.entries);
    }, [data?.entries]);

    // Load cached summary on mount
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed: CachedSummary = JSON.parse(cached);
                setSummary(parsed.text);
                setLastUpdated(parsed.timestamp);
            }
        } catch {
            // ignore parse errors
        }
    }, []);

    // Generate summary when data changes
    useEffect(() => {
        if (!apiKey || !data || !engine || !currentHash || !isLoaded) return;

        const storedHash = localStorage.getItem(HASH_KEY);
        if (storedHash === currentHash) return; // No changes

        const generate = async () => {
            setIsGenerating(true);
            const systemPrompt = buildSystemPrompt(data, engine);
            const userPrompt = buildSummaryPrompt();

            const result = await generateSummary(apiKey, systemPrompt, userPrompt);

            if (result.text) {
                const now = new Date().toLocaleString('de-DE', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                });

                setSummary(result.text);
                setLastUpdated(now);

                // Cache
                localStorage.setItem(CACHE_KEY, JSON.stringify({ text: result.text, timestamp: now }));
                localStorage.setItem(HASH_KEY, currentHash);
            }
            // If error, keep showing old cached summary

            setIsGenerating(false);
        };

        generate();
    }, [apiKey, data, engine, currentHash, isLoaded]);

    // Don't render if no API key
    if (!apiKey || !isLoaded) return null;

    // Don't render if no summary and not generating
    if (!summary && !isGenerating) return null;

    return (
        <div className="bg-gradient-to-br from-rose-50 to-amber-50 rounded-2xl p-4 relative">
            <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-semibold text-rose-600">Dein aktueller Status</span>
            </div>

            {isGenerating && !summary ? (
                <div className="flex items-center gap-2 py-2">
                    <div className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-xs text-muted-foreground ml-1">Analysiere deine Daten...</span>
                </div>
            ) : (
                <>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                        {summary}
                    </p>
                    {isGenerating && (
                        <p className="text-[10px] text-rose-400 mt-1 animate-pulse">Aktualisiere...</p>
                    )}
                </>
            )}

            <div className="flex items-center justify-between mt-2">
                {lastUpdated && (
                    <span className="text-[10px] text-muted-foreground">{lastUpdated}</span>
                )}
                <Link
                    href="/assistant"
                    className="inline-flex items-center gap-0.5 text-xs font-medium text-rose-500 hover:text-rose-600 transition-colors"
                >
                    Mehr erfahren <ChevronRight className="w-3 h-3" />
                </Link>
            </div>
        </div>
    );
}
