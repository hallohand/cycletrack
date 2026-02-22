'use client';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useCycleData } from '@/hooks/useCycleData';
import { runEngine } from '@/lib/cycle-calculations';
import { streamChat, getApiKey, ChatMessage } from '@/lib/gemini-client';
import { buildSystemPrompt } from '@/lib/llm-context';
import { updateMemoryAfterChat, getMemory, setMemory } from '@/lib/ai-memory';
import { Send, Sparkles, AlertTriangle, Settings, Trash2, BookOpen, X } from 'lucide-react';
import Link from 'next/link';

const CHAT_STORAGE_KEY = 'cycletrack_ai_chat';
const SLIDING_WINDOW = 6; // Send only last N messages to API

const QUICK_ACTIONS = [
    { label: '💬 Wie ist mein Zyklus?', prompt: 'Wie ist mein aktueller Zyklusstatus? Gib mir eine Zusammenfassung.' },
    { label: '🌸 Fruchtbare Tage?', prompt: 'Wann sind meine fruchtbaren Tage und wann ist der beste Zeitpunkt für eine Schwangerschaft?' },
    { label: '🤰 Schwangerschaftschancen?', prompt: 'Wie stehen meine Schwangerschaftschancen aktuell basierend auf meinen Daten?' },
    { label: '📅 Nächste Periode?', prompt: 'Wann kommt voraussichtlich meine nächste Periode?' },
    { label: '🔍 Auffälligkeiten?', prompt: 'Gibt es Auffälligkeiten in meinen Zyklusdaten die ich beachten sollte?' },
];

interface DisplayMessage {
    role: 'user' | 'assistant';
    text: string;
    isStreaming?: boolean;
}

export default function AssistantPage() {
    const { data, isLoaded } = useCycleData();
    const [messages, setMessages] = useState<DisplayMessage[]>(() => {
        if (typeof window === 'undefined') return [];
        try {
            const stored = localStorage.getItem(CHAT_STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch { return []; }
    });
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [showMemory, setShowMemory] = useState(false);
    const [memoryText, setMemoryText] = useState('');

    const apiKey = useMemo(() => getApiKey(), []);

    const engine = useMemo(() => {
        if (!data?.entries || Object.keys(data.entries).length === 0) return null;
        return runEngine(data);
    }, [data]);

    const systemPrompt = useMemo(() => {
        if (!data || !engine) return '';
        return buildSystemPrompt(data, engine);
    }, [data, engine]);

    // Check privacy notice
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const accepted = localStorage.getItem('cycletrack_ai_privacy_accepted');
        if (!accepted && apiKey) {
            setShowPrivacyNotice(true);
        }
    }, [apiKey]);

    // Save messages to localStorage whenever they change (skip streaming)
    useEffect(() => {
        const completed = messages.filter(m => !m.isStreaming);
        if (completed.length > 0) {
            localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(completed));
        }
    }, [messages]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || !apiKey || isLoading) return;

        const userMsg: DisplayMessage = { role: 'user', text: text.trim() };
        const assistantMsg: DisplayMessage = { role: 'assistant', text: '', isStreaming: true };

        setMessages(prev => [...prev, userMsg, assistantMsg]);
        setInput('');
        setIsLoading(true);

        // Build chat history for API — sliding window of last N messages
        const allMessages = [
            ...messages.filter(m => !m.isStreaming).map(m => ({
                role: m.role === 'user' ? 'user' as const : 'model' as const,
                text: m.text,
            })),
            { role: 'user' as const, text: text.trim() },
        ];
        const chatHistory: ChatMessage[] = allMessages.slice(-SLIDING_WINDOW);

        let fullText = '';

        await streamChat(
            apiKey,
            systemPrompt,
            chatHistory,
            (chunk) => {
                fullText += chunk;
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'assistant', text: fullText, isStreaming: true };
                    return updated;
                });
            },
            () => {
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'assistant', text: fullText, isStreaming: false };
                    return updated;
                });
                setIsLoading(false);

                // Extract facts for memory (async, non-blocking)
                const recentForMemory = [
                    ...messages.filter(m => !m.isStreaming).slice(-4).map(m => ({
                        role: m.role, text: m.text,
                    })),
                    { role: 'user', text: text.trim() },
                    { role: 'assistant', text: fullText },
                ];
                updateMemoryAfterChat(recentForMemory).catch(() => { });
            },
            (error) => {
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'assistant', text: `⚠️ ${error}`, isStreaming: false };
                    return updated;
                });
                setIsLoading(false);
            }
        );
    }, [apiKey, systemPrompt, messages, isLoading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    const acceptPrivacy = () => {
        localStorage.setItem('cycletrack_ai_privacy_accepted', 'true');
        setShowPrivacyNotice(false);
    };

    if (!isLoaded) return <div className="p-8 text-center text-muted-foreground animate-pulse">Laden...</div>;

    // No API key set
    if (!apiKey) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100dvh-200px)] px-6 text-center">
                <Sparkles className="w-12 h-12 text-rose-300 mb-4" />
                <h2 className="text-xl font-bold mb-2">KI-Assistent</h2>
                <p className="text-muted-foreground text-sm mb-6 max-w-xs">
                    Um den Assistenten zu nutzen, hinterlege deinen Gemini API-Key in den Einstellungen.
                    Du kannst ihn kostenlos bei Google AI Studio erstellen.
                </p>
                <Link
                    href="/settings"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-rose-400 text-white rounded-full text-sm font-medium hover:bg-rose-500 transition-colors"
                >
                    <Settings className="w-4 h-4" /> Zu den Einstellungen
                </Link>
                <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 text-xs text-rose-400 underline"
                >
                    API-Key bei Google AI Studio erstellen →
                </a>
            </div>
        );
    }

    // Privacy notice
    if (showPrivacyNotice) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100dvh-200px)] px-6 text-center">
                <AlertTriangle className="w-10 h-10 text-amber-400 mb-4" />
                <h2 className="text-lg font-bold mb-2">Datenschutzhinweis</h2>
                <p className="text-muted-foreground text-sm mb-4 max-w-xs">
                    Der Assistent sendet deine Zyklusdaten (Temperaturen, Phasen, Prognosen)
                    an die Google Gemini API zur Analyse. Deine Daten werden laut Google nicht
                    gespeichert und nicht zum Training verwendet.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={acceptPrivacy}
                        className="px-4 py-2 bg-rose-400 text-white rounded-full text-sm font-medium hover:bg-rose-500 transition-colors"
                    >
                        Verstanden & Fortfahren
                    </button>
                    <Link
                        href="/"
                        className="px-4 py-2 bg-muted text-muted-foreground rounded-full text-sm font-medium hover:bg-muted/80 transition-colors"
                    >
                        Abbrechen
                    </Link>
                </div>
            </div>
        );
    }

    const clearChat = () => {
        setMessages([]);
        localStorage.removeItem(CHAT_STORAGE_KEY);
    };

    const openMemory = () => {
        setMemoryText(getMemory() || '(Noch keine Einträge)');
        setShowMemory(true);
    };

    const saveMemory = () => {
        const text = memoryText === '(Noch keine Einträge)' ? '' : memoryText;
        setMemory(text);
        setShowMemory(false);
    };

    return (
        <div className="flex flex-col h-[calc(100dvh-200px)] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2 shrink-0 border-b border-border/30">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-rose-400" />
                        <h2 className="text-base font-bold">Zyklusassistent</h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={openMemory} className="text-muted-foreground hover:text-foreground p-1" title="Gedächtnis">
                            <BookOpen className="w-4 h-4" />
                        </button>
                        {messages.length > 0 && (
                            <button onClick={clearChat} className="text-muted-foreground hover:text-foreground p-1" title="Chat löschen">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
                {engine && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        Basierend auf deinen Daten · Zyklustag {engine.currentCycle.day}
                    </p>
                )}
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide">
                {messages.length === 0 && (
                    <div className="text-center py-8">
                        <Sparkles className="w-8 h-8 text-rose-200 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground mb-1">Frag mich etwas über deinen Zyklus!</p>
                        <p className="text-[10px] text-muted-foreground">Oder nutze die Vorschläge unten</p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                                ? 'bg-rose-400 text-white rounded-br-md'
                                : 'bg-muted text-foreground rounded-bl-md'
                                }`}
                        >
                            {msg.text}
                            {msg.isStreaming && (
                                <span className="inline-block w-1.5 h-4 bg-rose-400 ml-0.5 animate-pulse rounded-full" />
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions — always visible */}
            <div className="px-4 py-1.5 shrink-0">
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {QUICK_ACTIONS.map((action, i) => (
                        <button
                            key={i}
                            onClick={() => sendMessage(action.prompt)}
                            disabled={isLoading}
                            className="shrink-0 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-full text-xs font-medium hover:bg-rose-100 transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="px-4 py-2 shrink-0 border-t border-border/30">
                <div className="flex items-center gap-2 bg-muted rounded-full px-3 py-1.5">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Frage stellen..."
                        disabled={isLoading}
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="w-8 h-8 bg-rose-400 text-white rounded-full flex items-center justify-center shrink-0 disabled:opacity-30 hover:bg-rose-500 transition-colors"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>

            {/* Memory Viewer Modal */}
            {showMemory && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
                    <div className="bg-background w-full max-w-md rounded-t-2xl p-4 max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-200">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-rose-400" />
                                <h3 className="text-sm font-bold">Patientenakte</h3>
                            </div>
                            <button onClick={() => setShowMemory(false)} className="p-1">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <textarea
                            value={memoryText}
                            onChange={(e) => setMemoryText(e.target.value)}
                            className="flex-1 min-h-[200px] text-xs font-mono bg-muted rounded-xl p-3 outline-none resize-none"
                        />
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={saveMemory}
                                className="flex-1 px-3 py-2 bg-rose-400 text-white rounded-full text-sm font-medium hover:bg-rose-500 transition-colors"
                            >
                                Speichern
                            </button>
                            <button
                                onClick={() => setShowMemory(false)}
                                className="px-3 py-2 bg-muted text-muted-foreground rounded-full text-sm font-medium"
                            >
                                Abbrechen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
