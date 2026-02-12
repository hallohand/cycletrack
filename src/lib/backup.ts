import { CycleData, DEFAULT_CYCLE_DATA } from './types';

const BACKUP_KEY_1 = 'cycletrack_backup_1';
const BACKUP_KEY_2 = 'cycletrack_backup_2';
const BACKUP_TIMESTAMP_KEY = 'cycletrack_backup_timestamp';
const GIST_ID_KEY = 'cycletrack_gist_id';
const GIST_TOKEN_KEY = 'cycletrack_gist_token';
const DB_NAME = 'cycletrack_backups';
const DB_STORE = 'snapshots';
const MAX_SNAPSHOTS = 30;

// --- Local Rotation Backup ---

interface BackupSlot {
    timestamp: string;
    data: CycleData;
}

export function rotateLocalBackup(currentJson: string) {
    try {
        const now = new Date().toISOString();
        const currentData = JSON.parse(currentJson); // Validate & parse

        // Get previous backup 1
        const prev1Raw = localStorage.getItem(BACKUP_KEY_1);

        if (prev1Raw) {
            // Move 1 to 2
            localStorage.setItem(BACKUP_KEY_2, prev1Raw);
        }

        // Save new 1
        const newSlot: BackupSlot = { timestamp: now, data: currentData };
        localStorage.setItem(BACKUP_KEY_1, JSON.stringify(newSlot));

        // Remove old global timestamp key as it's deprecated
        localStorage.removeItem(BACKUP_TIMESTAMP_KEY);
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
            // Does it have "entries"? Then it's likely CycleData
            if (parsed.entries) {
                // Approximate timestamp? No, just use "Unknown" or null.
                // Or try to recover from the deprecated global key if it's backup 1?
                // Let's just return it with "Legacy" timestamp.
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

// --- IndexedDB Snapshots (for larger/persistent backups) ---

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(DB_STORE)) {
                const store = db.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp');
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveIndexedDBSnapshot(data: CycleData): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);

        store.add({
            timestamp: new Date().toISOString(),
            data: JSON.stringify(data),
        });

        // Prune old snapshots beyond MAX_SNAPSHOTS
        const countReq = store.count();
        countReq.onsuccess = () => {
            if (countReq.result > MAX_SNAPSHOTS) {
                const cursorReq = store.openCursor();
                let deleted = 0;
                const toDelete = countReq.result - MAX_SNAPSHOTS;
                cursorReq.onsuccess = () => {
                    const cursor = cursorReq.result;
                    if (cursor && deleted < toDelete) {
                        cursor.delete();
                        deleted++;
                        cursor.continue();
                    }
                };
            }
        };

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn('IndexedDB snapshot failed:', e);
    }
}

export async function getIndexedDBSnapshots(): Promise<Array<{ id: number; timestamp: string; data: string }>> {
    try {
        const db = await openDB();
        const tx = db.transaction(DB_STORE, 'readonly');
        const store = tx.objectStore(DB_STORE);
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch {
        return [];
    }
}

export async function restoreFromIndexedDB(id: number): Promise<CycleData | null> {
    try {
        const db = await openDB();
        const tx = db.transaction(DB_STORE, 'readonly');
        const store = tx.objectStore(DB_STORE);
        const request = store.get(id);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                if (request.result) {
                    resolve(JSON.parse(request.result.data));
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    } catch {
        return null;
    }
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

export async function syncToGist(data: CycleData): Promise<{ success: boolean; gistId?: string; error?: string }> {
    const { token, gistId } = getGistConfig();
    if (!token) return { success: false, error: 'Kein GitHub Token konfiguriert' };

    const content = JSON.stringify(data, null, 2);
    const filename = 'cycletrack_backup.json';

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
                    files: { [filename]: { content } },
                }),
            });

            if (!res.ok) {
                if (res.status === 404) {
                    // Gist was deleted, create a new one
                    localStorage.removeItem(GIST_ID_KEY);
                    return syncToGist(data);
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
                    files: { [filename]: { content } },
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
    } catch (e: any) {
        return { success: false, error: e.message || 'Netzwerkfehler' };
    }
}

export async function restoreFromGist(): Promise<{ data: CycleData | null; error?: string }> {
    const { token, gistId } = getGistConfig();
    if (!token || !gistId) return { data: null, error: 'Kein GitHub Token oder Gist ID konfiguriert' };

    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) {
            return { data: null, error: `HTTP ${res.status}` };
        }

        const gist = await res.json();
        const file = gist.files['cycletrack_backup.json'];
        if (!file) return { data: null, error: 'Backup-Datei nicht im Gist gefunden' };

        const parsed = JSON.parse(file.content);
        if (!parsed.entries) return { data: null, error: 'Ungültiges Backup-Format' };

        return { data: { ...DEFAULT_CYCLE_DATA, ...parsed } };
    } catch (e: any) {
        return { data: null, error: e.message || 'Netzwerkfehler' };
    }
}

// --- Debounced Cloud Sync ---

let syncTimeout: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 60 * 1000; // 1 minute debounce

export function debouncedCloudSync(data: CycleData) {
    const { token } = getGistConfig();
    if (!token) return; // No token configured, skip

    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
        syncToGist(data).then(result => {
            if (!result.success) {
                console.warn('Cloud sync failed:', result.error);
            }
        });
    }, SYNC_DEBOUNCE_MS);
}
