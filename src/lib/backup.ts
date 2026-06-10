import { CycleData } from './types';
import { validateImportData } from './schemas';

const BACKUP_KEY_1 = 'cycletrack_backup_1';
const BACKUP_KEY_2 = 'cycletrack_backup_2';
const BACKUP_TIMESTAMP_KEY = 'cycletrack_backup_timestamp';
const GIST_ID_KEY = 'cycletrack_gist_id';
const GIST_TOKEN_KEY = 'cycletrack_gist_token';
const BACKUP_PASSPHRASE_KEY = 'cycletrack_backup_passphrase';
const ROTATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // promote a generation at most once per day

// --- Local Rotation Backup ---
// Two-tier design: slot 1 always mirrors the latest persisted state,
// slot 2 holds a generation that is at least ROTATION_INTERVAL_MS old.
// Without the time gate both slots converge to the current state after
// two writes and protect against nothing.

interface BackupSlot {
    timestamp: string;
    data: CycleData;
}

function entryCount(data: CycleData | undefined | null): number {
    return data?.entries ? Object.keys(data.entries).length : 0;
}

export function rotateLocalBackup(currentData: CycleData) {
    try {
        const { backup1, backup2 } = getLocalBackups();
        const curCount = entryCount(currentData);
        const prevCount = entryCount(backup1?.data);

        // Guard 1: never replace a backup that has entries with an empty state.
        // An empty state after a failed load or clearAllData must not be able
        // to destroy the last good copy.
        if (curCount === 0 && prevCount > 0) {
            return;
        }

        const now = Date.now();
        const lastRotation = parseInt(localStorage.getItem(BACKUP_TIMESTAMP_KEY) || '0', 10);

        // Guard 2: a drastically shrunken state (e.g. first entry after a
        // corrupt load) must not silently overwrite the last good generation —
        // promote it to slot 2 first, regardless of the time gate.
        const shrunkDrastically = prevCount >= 10 && curCount < prevCount / 2;
        // Guard 3: never promote a small slot 1 over a much richer slot 2.
        const promotionSafe = !(entryCount(backup2?.data) >= 10 && prevCount < entryCount(backup2?.data) / 2);

        if (backup1 && (now - lastRotation > ROTATION_INTERVAL_MS || shrunkDrastically) && promotionSafe) {
            localStorage.setItem(BACKUP_KEY_2, JSON.stringify(backup1));
            localStorage.setItem(BACKUP_TIMESTAMP_KEY, String(now));
        } else if (!localStorage.getItem(BACKUP_TIMESTAMP_KEY)) {
            localStorage.setItem(BACKUP_TIMESTAMP_KEY, String(now));
        }

        const newSlot: BackupSlot = { timestamp: new Date().toISOString(), data: currentData };
        localStorage.setItem(BACKUP_KEY_1, JSON.stringify(newSlot));
    } catch (e) {
        console.warn('Backup rotation failed:', e);
    }
}

export function getLocalBackups(): {
    backup1: { data: CycleData; timestamp: string } | null;
    backup2: { data: CycleData; timestamp: string } | null;
} {
    const parseSlot = (key: string): { data: CycleData; timestamp: string } | null => {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;

            const parsed = JSON.parse(raw);

            // Check if it's the new format
            if (parsed.timestamp && parsed.data) {
                return parsed;
            }

            // Fallback: Old format (raw CycleData)
            if (parsed.entries) {
                return { data: parsed, timestamp: 'Legacy' };
            }
            return null;
        } catch {
            return null;
        }
    };

    return {
        backup1: parseSlot(BACKUP_KEY_1),
        backup2: parseSlot(BACKUP_KEY_2),
    };
}

// --- Encryption (AES-GCM, key derived via PBKDF2-SHA256) ---
// The gist backup leaves the device; health data must never travel in
// plaintext. The passphrase stays on the device (the device already holds
// the plaintext data — the threat model is the remote copy).

const ENCRYPTED_FORMAT = 'cycletrack-encrypted-v1';
const PBKDF2_ITERATIONS = 310_000;

export interface EncryptedPayload {
    format: typeof ENCRYPTED_FORMAT;
    kdf: 'PBKDF2-SHA256';
    iterations: number;
    salt: string; // base64
    iv: string; // base64
    ciphertext: string; // base64
}

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

function b64ToBuf(b64: string): Uint8Array {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptBackup(plaintext: string, passphrase: string): Promise<EncryptedPayload> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(plaintext)
    );
    return {
        format: ENCRYPTED_FORMAT,
        kdf: 'PBKDF2-SHA256',
        iterations: PBKDF2_ITERATIONS,
        salt: bufToB64(salt),
        iv: bufToB64(iv),
        ciphertext: bufToB64(ciphertext),
    };
}

export async function decryptBackup(payload: EncryptedPayload, passphrase: string): Promise<string> {
    const key = await deriveKey(passphrase, b64ToBuf(payload.salt), payload.iterations);
    const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64ToBuf(payload.iv) as BufferSource },
        key,
        b64ToBuf(payload.ciphertext) as BufferSource
    );
    return new TextDecoder().decode(plain);
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
    return !!value && typeof value === 'object'
        && (value as EncryptedPayload).format === ENCRYPTED_FORMAT
        && typeof (value as EncryptedPayload).ciphertext === 'string';
}

export function getBackupPassphrase(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(BACKUP_PASSPHRASE_KEY);
}

export function setBackupPassphrase(passphrase: string) {
    if (passphrase) localStorage.setItem(BACKUP_PASSPHRASE_KEY, passphrase);
    else localStorage.removeItem(BACKUP_PASSPHRASE_KEY);
}

// --- GitHub Gist Cloud Backup ---

export function getGistConfig(): { token: string | null; gistId: string | null } {
    return {
        token: localStorage.getItem(GIST_TOKEN_KEY),
        gistId: localStorage.getItem(GIST_ID_KEY),
    };
}

export function setGistConfig(token: string, gistId?: string) {
    localStorage.setItem(GIST_TOKEN_KEY, token);
    if (gistId) localStorage.setItem(GIST_ID_KEY, gistId);
}

export function clearGistConfig() {
    localStorage.removeItem(GIST_TOKEN_KEY);
    localStorage.removeItem(GIST_ID_KEY);
}

const GIST_FILENAME = 'cycletrack_backup.json';

export async function syncToGist(data: CycleData, retryCount = 0): Promise<{ success: boolean; gistId?: string; error?: string }> {
    const { token, gistId } = getGistConfig();
    if (!token) return { success: false, error: 'Kein GitHub Token konfiguriert' };

    let content: string;
    const passphrase = getBackupPassphrase();
    if (passphrase) {
        try {
            content = JSON.stringify(await encryptBackup(JSON.stringify(data), passphrase), null, 2);
        } catch (e) {
            return { success: false, error: 'Verschlüsselung fehlgeschlagen: ' + (e instanceof Error ? e.message : String(e)) };
        }
    } else {
        content = JSON.stringify(data, null, 2);
    }

    try {
        if (gistId) {
            // Update existing Gist
            const res = await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: `CycleTrack Backup — ${new Date().toLocaleString('de-DE')}`,
                    files: { [GIST_FILENAME]: { content } },
                }),
            });

            if (!res.ok) {
                if (res.status === 404) {
                    if (retryCount > 0) {
                        return { success: false, error: 'Gist konnte nicht erstellt werden' };
                    }
                    localStorage.removeItem(GIST_ID_KEY);
                    return syncToGist(data, retryCount + 1);
                }
                const err = await res.json();
                return { success: false, error: err.message || `HTTP ${res.status}` };
            }

            return { success: true, gistId };
        } else {
            // Create new Gist
            const res = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: `CycleTrack Backup — ${new Date().toLocaleString('de-DE')}`,
                    public: false,
                    files: { [GIST_FILENAME]: { content } },
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                return { success: false, error: err.message || `HTTP ${res.status}` };
            }

            const gist = await res.json();
            localStorage.setItem(GIST_ID_KEY, gist.id);
            return { success: true, gistId: gist.id };
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Netzwerkfehler';
        return { success: false, error: message };
    }
}

// Liefert das validierte Backup als ROH-JSON-String (nicht mit Defaults
// angereichert): der Konsument gibt ihn an importData weiter, das fehlende
// Settings-Felder erkennen muss, um Nutzerwerte nicht zurückzusetzen.
export async function restoreFromGist(): Promise<{ json: string | null; error?: string }> {
    const { token, gistId } = getGistConfig();
    if (!token || !gistId) return { json: null, error: 'Kein GitHub Token oder Gist ID konfiguriert' };

    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) {
            return { json: null, error: `HTTP ${res.status}` };
        }

        const gist = await res.json();
        const file = gist.files[GIST_FILENAME];
        if (!file) return { json: null, error: 'Backup-Datei nicht im Gist gefunden' };

        // The gist API truncates file contents > 1 MB — fetch raw if needed.
        let content: string = file.content;
        if (file.truncated && file.raw_url) {
            const rawRes = await fetch(file.raw_url);
            if (!rawRes.ok) return { json: null, error: `Backup unvollständig (HTTP ${rawRes.status})` };
            content = await rawRes.text();
        }

        // Transparently decrypt the new encrypted format.
        try {
            const maybeEncrypted = JSON.parse(content);
            if (isEncryptedPayload(maybeEncrypted)) {
                const passphrase = getBackupPassphrase();
                if (!passphrase) {
                    return { json: null, error: 'Backup ist verschlüsselt — bitte Passphrase in den Einstellungen hinterlegen.' };
                }
                try {
                    content = await decryptBackup(maybeEncrypted, passphrase);
                } catch {
                    return { json: null, error: 'Entschlüsselung fehlgeschlagen — falsche Passphrase?' };
                }
            }
        } catch {
            // not JSON at all — fall through to validation, which will report it
        }

        const validation = validateImportData(content);
        if (!validation.success) {
            return { json: null, error: 'Backup-Daten ungültig: ' + validation.error };
        }
        return { json: content };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Netzwerkfehler';
        return { json: null, error: message };
    }
}

// --- Debounced Cloud Sync ---

let syncTimeout: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 60 * 1000; // 1 minute debounce

export function debouncedCloudSync(data: CycleData) {
    const { token } = getGistConfig();
    if (!token) return; // No token configured, skip

    // Never auto-sync an empty state over a cloud backup — an explicit
    // "Jetzt sichern" in the settings is required for that.
    if (entryCount(data) === 0) return;

    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
        syncToGist(data).then(result => {
            if (!result.success) {
                console.warn('Cloud sync failed:', result.error);
            }
        });
    }, SYNC_DEBOUNCE_MS);
}

export function cancelPendingCloudSync() {
    if (syncTimeout) {
        clearTimeout(syncTimeout);
        syncTimeout = null;
    }
}
