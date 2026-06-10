'use client';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useCycleData } from '@/hooks/useCycleData';
import { streamChat, getApiKey, ChatMessage } from '@/lib/gemini-client';
import { buildSystemPrompt } from '@/lib/llm-context';
import { updateMemoryAfterChat, getMemory, setMemory } from '@/lib/ai-memory';
import { Send, Sparkles, AlertTriangle, Settings, Trash2, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const CHAT_STORAGE_KEY = 'cycletrack_ai_chat';
const PRIVACY_KEY = 'cycletrack_ai_privacy_accepted';
const SLIDING_WINDOW = 6; // Send only last N messages to API

const QUICK_ACTIONS = [
    { label: 'Mein Zyklus', prompt: 'Wie ist mein aktueller Zyklusstatus? Gib mir eine Zusammenfassung.' },
    { label: 'Fruchtbare Tage', prompt: 'Wann sind meine fruchtbaren Tage und wann ist der beste Zeitpunkt für eine Schwangerschaft?' },
    { label: 'Optimales Timing', prompt: 'Wann wäre basierend auf meinen Daten der optimale Zeitpunkt für Geschlechtsverkehr?' },
    { label: 'Nächste Periode', prompt: 'Wann kommt voraussichtlich meine nächste Periode?' },
    { label: 'Auffälligkeiten', prompt: 'Gibt es Auffälligkeiten in meinen Zyklusdaten die ich beachten sollte?' },
];

interface DisplayMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    isStreaming?: boolean;
}

/** Eindeutige Message-ID (für gezielte Streaming-Updates statt Index-Zugriff) */
function makeId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Lightweight markdown renderer for chat messages */
function renderMarkdown(text: string): React.ReactNode {
    // Split into lines for list handling
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, lineIdx) => {
        // Bullet list items
        const listMatch = line.match(/^[\-\*]\s+(.+)/);
        if (listMatch) {
            elements.push(
                <div key={lineIdx} className="flex gap-1.5 ml-1">
                    <span className="shrink-0">•</span>
                    <span>{formatInline(listMatch[1])}</span>
                </div>
            );
            return;
        }

        // Empty line = paragraph break
        if (line.trim() === '') {
            elements.push(<div key={lineIdx} className="h-2" />);
            return;
        }

        // Normal text with inline formatting
        elements.push(
            <div key={lineIdx}>{formatInline(line)}</div>
        );
    });

    return <>{elements}</>;
}

/** Format inline markdown: **bold**, *italic*, `code` */
function formatInline(text: string): React.ReactNode {
    // Split by markdown patterns, preserve delimiters
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/);

    return parts.map((part, i) => {
        // **bold**
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        // *italic*
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={i}>{part.slice(1, -1)}</em>;
        }
        // `code`
        if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={i} className="bg-black/10 px-1 rounded text-xs">{part.slice(1, -1)}</code>;
        }
        return part;
    });
}

export default function AssistantPage() {
    const { data, isLoaded, engine } = useCycleData();
    const [hydrated, setHydrated] = useState(false);
    const [apiKey, setApiKeyState] = useState('');
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    // Session-Token: macht laufende Streams nach "Chat löschen" wirkungslos
    const streamSessionRef = useRef(0);
    const [showMemory, setShowMemory] = useState(false);
    const [memoryText, setMemoryText] = useState('');

    const systemPrompt = useMemo(() => {
        if (!data || !engine) return '';
        return buildSystemPrompt(data, engine);
    }, [data, engine]);

    // Hydration: localStorage (API-Key, Chat-Verlauf, Privacy-Flag) erst nach Mount lesen,
    // damit Server-HTML und erster Client-Render übereinstimmen (statischer Export).
    useEffect(() => {
        const key = getApiKey();
        // eslint-disable-next-line react-hooks/set-state-in-effect -- einmalige Hydration aus localStorage, kein kaskadierender Effekt
        setApiKeyState(key);
        try {
            const stored = localStorage.getItem(CHAT_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as { role: 'user' | 'assistant'; text: string }[];
                if (Array.isArray(parsed)) {
                    setMessages(parsed
                        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
                        .map(m => ({ id: makeId(), role: m.role, text: m.text })));
                }
            }
        } catch { /* ignore parse errors */ }
        if (key && localStorage.getItem(PRIVACY_KEY) !== 'true') {
            setShowPrivacyNotice(true);
        }
        setHydrated(true);
    }, []);

    // Chat persistieren: fertige Nachrichten sofort (damit die Nutzerfrage
    // einen App-Kill während des Streamings überlebt), streamende Nachrichten
    // werden herausgefiltert statt das Speichern komplett zu überspringen —
    // so wird trotzdem nicht pro Chunk der volle Streamtext geschrieben.
    useEffect(() => {
        if (!hydrated) return;
        const completed = messages.filter(m => !m.isStreaming);
        if (completed.length > 0) {
            localStorage.setItem(
                CHAT_STORAGE_KEY,
                JSON.stringify(completed.map(({ role, text }) => ({ role, text })))
            );
        }
    }, [messages, hydrated]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || !apiKey || isLoading) return;

        const session = streamSessionRef.current;
        const assistantId = makeId();
        const userMsg: DisplayMessage = { id: makeId(), role: 'user', text: text.trim() };
        const assistantMsg: DisplayMessage = { id: assistantId, role: 'assistant', text: '', isStreaming: true };

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
                if (streamSessionRef.current !== session) return; // Chat wurde gelöscht
                fullText += chunk;
                setMessages(prev => prev.map(m =>
                    m.id === assistantId ? { ...m, text: fullText, isStreaming: true } : m
                ));
            },
            () => {
                if (streamSessionRef.current !== session) return; // Chat wurde gelöscht
                setMessages(prev => prev.map(m =>
                    m.id === assistantId ? { ...m, text: fullText, isStreaming: false } : m
                ));
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
                if (streamSessionRef.current !== session) return; // Chat wurde gelöscht
                setMessages(prev => prev.map(m =>
                    m.id === assistantId ? { ...m, text: `${error}`, isStreaming: false } : m
                ));
                setIsLoading(false);
            }
        );
    }, [apiKey, systemPrompt, messages, isLoading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    const acceptPrivacy = () => {
        localStorage.setItem(PRIVACY_KEY, 'true');
        setShowPrivacyNotice(false);
    };

    const clearChat = () => {
        streamSessionRef.current += 1; // laufenden Stream wirkungslos machen
        setMessages([]);
        setIsLoading(false);
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

    if (!isLoaded || !hydrated) return (
        <div className="flex flex-col gap-4 px-4 pt-6 animate-in fade-in duration-300">
            <Skeleton className="w-32 h-6 rounded-xl" />
            <Skeleton className="w-full h-[200px] rounded-2xl" />
            <Skeleton className="w-48 h-10 rounded-2xl" />
        </div>
    );

    // No API key set
    if (!apiKey) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100dvh-200px)] px-6 text-center">
                <Sparkles className="w-12 h-12 text-primary/50 mb-4" />
                <h2 className="text-xl font-bold mb-2">Clara</h2>
                <p className="text-muted-foreground text-sm mb-6 max-w-xs">
                    Um den Assistenten zu nutzen, hinterlege deinen Gemini API-Key in den Einstellungen.
                    Du kannst ihn kostenlos bei Google AI Studio erstellen.
                </p>
                <Link
                    href="/settings"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                    <Settings className="w-4 h-4" /> Zu den Einstellungen
                </Link>
                <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 text-xs text-primary underline"
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
                <AlertTriangle className="w-10 h-10 text-[var(--phase-ovulation)] mb-4" />
                <h2 className="text-lg font-bold mb-2">Datenschutzhinweis</h2>
                <p className="text-muted-foreground text-sm mb-4 max-w-xs">
                    Der Assistent sendet deine Zyklusdaten (Temperaturen, Phasen, Prognosen),
                    deine Patientenakte (das KI-Gedächtnis) sowie deinen Chat-Verlauf
                    an die Google Gemini API zur Analyse. Deine Daten werden laut Google nicht
                    gespeichert und nicht zum Training verwendet.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={acceptPrivacy}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

    return (
        <div className="flex flex-col h-[calc(100dvh-200px)] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2 shrink-0 border-b border-border/30 shadow-soft">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        <h2 className="text-base font-bold font-serif">Clara</h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={openMemory}
                            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Gedächtnis"
                            aria-label="Gedächtnis anzeigen"
                        >
                            <BookOpen className="w-5 h-5" />
                        </button>
                        {messages.length > 0 && (
                            <button
                                onClick={clearChat}
                                className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                title="Chat löschen"
                                aria-label="Chat löschen"
                            >
                                <Trash2 className="w-5 h-5" />
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
            <div
                ref={scrollRef}
                role="log"
                aria-live="polite"
                className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide"
            >
                {messages.length === 0 && (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="w-8 h-8 text-primary" />
                        </div>
                        <p className="text-base font-serif font-semibold mb-1">Frag mich alles!</p>
                        <p className="text-xs text-muted-foreground">Ich analysiere deine Zyklusdaten</p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[85%] px-3 py-2 text-sm leading-relaxed shadow-soft ${msg.role === 'user'
                                ? 'bg-primary text-primary-foreground rounded-3xl rounded-br-lg'
                                : 'bg-muted text-foreground rounded-3xl rounded-bl-lg'
                                }`}
                        >
                            {msg.role === 'assistant' ? renderMarkdown(msg.text) : msg.text}
                            {msg.isStreaming && (
                                <span
                                    role="status"
                                    aria-label="Clara antwortet"
                                    className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse rounded-full"
                                />
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions — always visible */}
            <div className="px-4 py-1.5 shrink-0">
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
                    {QUICK_ACTIONS.map((action, i) => (
                        <button
                            key={i}
                            onClick={() => sendMessage(action.prompt)}
                            disabled={isLoading}
                            className="flex-shrink-0 w-36 bg-card border border-border/50 rounded-2xl p-3 text-left shadow-soft active:scale-[0.97] transition-transform disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <span className="text-xs font-medium text-foreground leading-tight line-clamp-2">{action.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="px-4 py-2 shrink-0 border-t border-border/30">
                <div className="flex items-center gap-2 bg-card border border-border/50 rounded-2xl px-4 py-1.5 shadow-soft">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Frage stellen..."
                        disabled={isLoading}
                        className="flex-1 bg-transparent text-base outline-none rounded-md focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        aria-label="Nachricht senden"
                        className="w-11 h-11 bg-primary text-primary-foreground rounded-xl flex items-center justify-center shrink-0 disabled:opacity-30 hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>

            {/* Memory Viewer Sheet */}
            <Sheet open={showMemory} onOpenChange={setShowMemory}>
                <SheetContent side="bottom" className="max-h-[80vh] rounded-t-3xl">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2 font-serif">
                            <BookOpen className="w-4 h-4 text-primary" />
                            Patientenakte
                        </SheetTitle>
                    </SheetHeader>
                    <textarea
                        value={memoryText}
                        onChange={(e) => setMemoryText(e.target.value)}
                        aria-label="Patientenakte (KI-Gedächtnis) bearbeiten"
                        className="flex-1 min-h-[200px] w-full text-xs font-mono bg-muted rounded-xl p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none mt-4"
                    />
                    <SheetFooter className="mt-4 flex gap-2">
                        <Button
                            onClick={saveMemory}
                            className="flex-1 bg-gradient-to-r from-primary to-coral text-white rounded-xl"
                        >
                            Speichern
                        </Button>
                        <Button variant="outline" onClick={() => setShowMemory(false)} className="rounded-xl">
                            Abbrechen
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
}
