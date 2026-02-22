// AI Memory System ("Patientenakte")
// Persistent knowledge base extracted from conversations

import { generateSummary, getApiKey } from '@/lib/gemini-client';

const MEMORY_KEY = 'cycletrack_ai_memory';
const MEMORY_CHAT_COUNT_KEY = 'cycletrack_ai_memory_chat_count';
const RESTRUCTURE_INTERVAL = 10; // Restructure every N chats

// --- Storage ---

export function getMemory(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(MEMORY_KEY) || '';
}

export function setMemory(text: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(MEMORY_KEY, text);
}

function getChatCount(): number {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem(MEMORY_CHAT_COUNT_KEY) || '0', 10);
}

function incrementChatCount(): number {
    const count = getChatCount() + 1;
    localStorage.setItem(MEMORY_CHAT_COUNT_KEY, count.toString());
    return count;
}

// --- Fact Extraction ---

const EXTRACT_SYSTEM_PROMPT = `Du bist ein Assistent der wichtige Fakten aus Gesprächen extrahiert.
Analysiere die Unterhaltung und extrahiere NEUE wichtige persönliche Informationen.

Wichtig sind:
- Persönliche Infos (Kinderwunsch, Partner, Vorerkrankungen, Medikamente, Supplemente)
- Beobachtungen über den Zyklus (Muster, Besonderheiten, Symptome)
- Wünsche und Präferenzen der Nutzerin
- Gesundheitsrelevante Fakten

NICHT extrahieren:
- Allgemeine Zyklusdaten (die kommen automatisch aus der App)
- Smalltalk oder irrelevante Infos

Antwortformat: Stichpunkte mit "- " Prefix.
Falls es KEINE neuen wichtigen Fakten gibt, antworte NUR mit dem Wort: KEINE`;

export async function extractNewFacts(
    conversation: { role: string; text: string }[],
    currentMemory: string
): Promise<string | null> {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    const chatText = conversation
        .map(m => `${m.role === 'user' ? 'Nutzerin' : 'Assistent'}: ${m.text}`)
        .join('\n');

    const userPrompt = currentMemory
        ? `Aktuelle Patientenakte:\n${currentMemory}\n\n---\nNeue Unterhaltung:\n${chatText}\n\nGibt es NEUE Fakten die noch nicht in der Akte stehen?`
        : `Unterhaltung:\n${chatText}\n\nExtrahiere wichtige Fakten.`;

    const result = await generateSummary(apiKey, EXTRACT_SYSTEM_PROMPT, userPrompt);

    if (!result.text || result.text.trim().toUpperCase() === 'KEINE') {
        return null;
    }

    return result.text.trim();
}

// --- Memory Update ---

export async function updateMemoryAfterChat(
    conversation: { role: string; text: string }[]
): Promise<void> {
    const currentMemory = getMemory();
    const newFacts = await extractNewFacts(conversation, currentMemory);

    if (newFacts) {
        const today = new Date().toLocaleDateString('de-DE', {
            day: 'numeric', month: 'short', year: 'numeric'
        });

        const updatedMemory = currentMemory
            ? `${currentMemory}\n\n--- Aktualisiert: ${today} ---\n${newFacts}`
            : `=== PATIENTENAKTE ===\nErstellt: ${today}\n\n${newFacts}`;

        setMemory(updatedMemory);
    }

    // Check if restructuring is needed
    const chatCount = incrementChatCount();
    if (chatCount > 0 && chatCount % RESTRUCTURE_INTERVAL === 0) {
        await restructureMemory();
    }
}

// --- Restructuring ---

const RESTRUCTURE_SYSTEM_PROMPT = `Du strukturierst eine Patientenakte für eine Zyklus-Tracking App.
Organisiere die Informationen in klare Kategorien:

=== PERSÖNLICHE NOTIZEN ===
(Kinderwunsch, Partner, Lebenssituation)

=== GESUNDHEIT ===
(Vorerkrankungen, Medikamente, Supplemente)

=== ZYKLUSMUSTER ===
(Beobachtungen über den Zyklus)

=== BEOBACHTUNGEN & WÜNSCHE ===
(Präferenzen, Symptome, sonstiges)

Regeln:
- Entferne Duplikate
- Aktualisiere veraltete Infos (neuere überschreiben ältere)
- Halte es kompakt (Stichpunkte)
- Bewahre ALLE wichtigen Fakten
- Keine Überschriften weglassen, auch wenn eine Kategorie leer ist (dann "- keine Angaben")`;

export async function restructureMemory(): Promise<void> {
    const apiKey = getApiKey();
    const currentMemory = getMemory();
    if (!apiKey || !currentMemory || currentMemory.length < 100) return;

    const result = await generateSummary(
        apiKey,
        RESTRUCTURE_SYSTEM_PROMPT,
        `Bitte strukturiere diese Patientenakte:\n\n${currentMemory}`
    );

    if (result.text && result.text.length > 50) {
        setMemory(result.text.trim());
    }
}

// --- Prompt Integration ---

export function getMemoryPromptSection(): string {
    const memory = getMemory();
    if (!memory) return '';
    return `\nHier ist die Patientenakte der Nutzerin (persönliche Notizen aus früheren Gesprächen):\n${memory}\n`;
}
