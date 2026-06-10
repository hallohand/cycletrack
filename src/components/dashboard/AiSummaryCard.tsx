'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useCycleData } from '@/hooks/useCycleData';
import { generateSummary, getApiKey } from '@/lib/gemini-client';
import { buildSystemPrompt, buildSummaryPrompt, hashEntries } from '@/lib/llm-context';
import { Sparkles, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const CACHE_KEY = 'cycletrack_ai_summary_v4';
const HASH_KEY = 'cycletrack_ai_summary_hash_v4';
const PRIVACY_KEY = 'cycletrack_ai_privacy_accepted';

interface CachedSummary {
    text: string;
    timestamp: string;
}

export function AiSummaryCard() {
    const { data, isLoaded, engine } = useCycleData();
    const [hydrated, setHydrated] = useState(false);
    const [apiKey, setApiKeyState] = useState('');
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const [summary, setSummary] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    // Stale-Guard: nur die Antwort der letzten Anfrage darf Anzeige + Cache schreiben
    const requestTokenRef = useRef(0);

    const currentHash = useMemo(() => {
        if (!data?.entries) return '';
        return hashEntries(data.entries);
    }, [data?.entries]);

    // Hydration: localStorage (API-Key, Privacy-Flag, Cache) erst nach Mount lesen,
    // damit Server-HTML und erster Client-Render übereinstimmen (statischer Export).
    useEffect(() => {
        setApiKeyState(getApiKey());
        setPrivacyAccepted(localStorage.getItem(PRIVACY_KEY) === 'true');
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
        setHydrated(true);
    }, []);

    // Generate summary when data changes — nur mit akzeptiertem Datenschutzhinweis
    useEffect(() => {
        if (!hydrated || !apiKey || !privacyAccepted || !data || !engine || !currentHash || !isLoaded) return;

        const storedHash = localStorage.getItem(HASH_KEY);
        if (storedHash === currentHash) return; // No changes

        const token = ++requestTokenRef.current;

        const generate = async () => {
            setIsGenerating(true);
            try {
                const systemPrompt = buildSystemPrompt(data, engine);
                const userPrompt = buildSummaryPrompt();

                const result = await generateSummary(apiKey, systemPrompt, userPrompt);

                if (token !== requestTokenRef.current) return; // stale response — verwerfen

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
            } catch (e) {
                if (token === requestTokenRef.current) {
                    console.warn('AI summary generation failed:', e);
                }
            } finally {
                if (token === requestTokenRef.current) {
                    setIsGenerating(false);
                }
            }
        };

        generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hydrated, apiKey, privacyAccepted, currentHash, isLoaded]);

    // Vor Hydration nichts rendern (Server-HTML = erster Client-Render)
    if (!hydrated || !isLoaded) return null;

    // Don't render if no API key
    if (!apiKey) return null;

    // Privacy-Gate: ohne akzeptierten Datenschutzhinweis keine API-Aufrufe
    if (!privacyAccepted) {
        return (
            <div className="bg-gradient-to-br from-secondary to-[var(--phase-ovulation-light)] rounded-2xl p-4 relative">
                <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-primary">KI-Zusammenfassung</span>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">
                    Um die KI-Zusammenfassung zu aktivieren, akzeptiere zuerst den
                    Datenschutzhinweis im Assistenten.
                </p>
                <div className="flex justify-end mt-2">
                    <Link
                        href="/assistant"
                        className="inline-flex items-center gap-0.5 py-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                        Zum Assistenten <ChevronRight className="w-3 h-3" />
                    </Link>
                </div>
            </div>
        );
    }

    // Don't render if no summary and not generating
    if (!summary && !isGenerating) return null;

    return (
        <div className="bg-gradient-to-br from-secondary to-[var(--phase-ovulation-light)] rounded-2xl p-4 relative">
            <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-primary">Dein aktueller Status</span>
            </div>

            {isGenerating && !summary ? (
                <div className="flex items-center gap-2 py-2" role="status">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-xs text-muted-foreground ml-1">Analysiere deine Daten...</span>
                </div>
            ) : (
                <>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                        {summary}
                    </p>
                    {isGenerating && (
                        <p className="text-[10px] text-primary mt-1 animate-pulse" role="status">Aktualisiere...</p>
                    )}
                </>
            )}

            <div className="flex items-center justify-between mt-2">
                {lastUpdated && (
                    <span className="text-[10px] text-muted-foreground">{lastUpdated}</span>
                )}
                <Link
                    href="/assistant"
                    className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                    Mehr erfahren <ChevronRight className="w-3 h-3" />
                </Link>
            </div>
        </div>
    );
}
