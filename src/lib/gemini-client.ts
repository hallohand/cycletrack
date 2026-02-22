// Gemini API Client for CycleTrack
// Uses Google Generative AI REST API directly (no SDK needed for static export)

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-3-flash-preview';

interface GeminiContent {
    role: string;
    parts: { text: string }[];
}

function buildContents(systemPrompt: string, messages: ChatMessage[]): GeminiContent[] {
    const contents: GeminiContent[] = [];

    // System instruction is handled separately in the API
    for (const msg of messages) {
        contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        });
    }

    return contents;
}

/**
 * Stream a chat response from Gemini API
 */
export async function streamChat(
    apiKey: string,
    systemPrompt: string,
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (error: string) => void
): Promise<void> {
    const url = `${GEMINI_API_BASE}/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const contents = buildContents(systemPrompt, messages);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: systemPrompt }],
                },
                contents,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2000,
                    topP: 0.9,
                    thinkingConfig: {
                        thinkingBudget: 512,
                    },
                },
            }),
        });

        if (!res.ok) {
            const errBody = await res.text();
            if (res.status === 401 || res.status === 403) {
                onError('Ungültiger API-Key. Bitte überprüfe deinen Gemini API-Key in den Einstellungen.');
            } else if (res.status === 429) {
                onError('Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.');
            } else {
                onError(`API-Fehler (${res.status}): ${errBody.substring(0, 200)}`);
            }
            return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
            onError('Streaming nicht unterstützt.');
            return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr || jsonStr === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(jsonStr);
                        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            onChunk(text);
                        }
                    } catch {
                        // Skip malformed JSON chunks
                    }
                }
            }
        }

        onDone();
    } catch (err) {
        if (err instanceof TypeError && err.message.includes('fetch')) {
            onError('Keine Internetverbindung. Bitte überprüfe deine Verbindung.');
        } else {
            onError(`Verbindungsfehler: ${(err as Error).message}`);
        }
    }
}

/**
 * Generate a one-shot summary (non-streaming, for dashboard card)
 */
export async function generateSummary(
    apiKey: string,
    systemPrompt: string,
    userPrompt: string
): Promise<{ text: string; error?: string }> {
    const url = `${GEMINI_API_BASE}/${MODEL}:generateContent?key=${apiKey}`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: systemPrompt }],
                },
                contents: [
                    { role: 'user', parts: [{ text: userPrompt }] },
                ],
                generationConfig: {
                    temperature: 0.6,
                    maxOutputTokens: 400,
                    topP: 0.9,
                    thinkingConfig: {
                        thinkingBudget: 0,
                    },
                },
            }),
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                return { text: '', error: 'Ungültiger API-Key.' };
            }
            if (res.status === 429) {
                return { text: '', error: 'Rate-Limit erreicht.' };
            }
            return { text: '', error: `API-Fehler (${res.status})` };
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return { text: text.trim() };
    } catch {
        return { text: '', error: 'Keine Internetverbindung.' };
    }
}

/**
 * Helper to get/set API key from localStorage
 */
export function getApiKey(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('cycletrack_gemini_key') || '';
}

export function setApiKey(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('cycletrack_gemini_key', key);
}

export function isAssistantEnabled(): boolean {
    return !!getApiKey();
}
