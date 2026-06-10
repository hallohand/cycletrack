'use client';

import { useState, useRef, useEffect } from 'react';
import { useCycleData } from '@/hooks/useCycleData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { parseFemometerCSV } from '@/lib/importer';
import { APP_VERSION, BUILD_DATE } from '@/lib/version';
import { Trash2, RotateCcw, Cloud, Download, Upload, Shield, Sparkles, Sun, Moon, Monitor, Lock } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
    getGistConfig, setGistConfig, clearGistConfig,
    syncToGist, restoreFromGist,
    getLocalBackups,
    getBackupPassphrase, setBackupPassphrase,
} from '@/lib/backup';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const NUMBER_FIELDS = {
    cycleLength: { label: 'Durchschnittliche Zykluslänge (Tage)', min: 21, max: 45 },
    periodLength: { label: 'Periodendauer (Tage)', min: 2, max: 10 },
    lutealPhase: { label: 'Lutealphase (Tage)', min: 9, max: 16 },
} as const;

type NumberField = keyof typeof NUMBER_FIELDS;

type PendingRestore =
    | { kind: 'cloud' }
    | { kind: 'local'; which: 1 | 2 }
    | { kind: 'file'; json: string };

export default function SettingsPage() {
    const { data, updateSettings, importData, mergeEntries, clearAllData } = useCycleData();
    const { theme, setTheme } = useTheme();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);
    const [mounted, setMounted] = useState(false);
    const [gistToken, setGistToken] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    // Updated State for new Backup Format
    const [localBackups, setLocalBackups] = useState<ReturnType<typeof getLocalBackups>>({ backup1: null, backup2: null });

    const [hasGistToken, setHasGistToken] = useState(false);

    // Backup Encryption State
    const [passphraseInput, setPassphraseInput] = useState('');
    const [hasPassphrase, setHasPassphrase] = useState(false);

    // App Lock State
    const [isAppLockActive, setIsAppLockActive] = useState(false);

    // AI Assistant State
    const [aiApiKey, setAiApiKey] = useState('');
    const [hasAiKey, setHasAiKey] = useState(false);

    // Restore confirmation (cloud, local auto-backup, or backup file)
    const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);

    // Cycle settings drafts: committed on blur/Enter, validated against min/max
    const [draftValues, setDraftValues] = useState<Record<NumberField, string>>({
        cycleLength: '', periodLength: '', lutealPhase: '',
    });
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<NumberField, string>>>({});

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        const config = getGistConfig();
        setGistToken(config.token || '');
        setHasGistToken(!!config.token);
        setLocalBackups(getLocalBackups());

        const passphrase = getBackupPassphrase();
        setPassphraseInput(passphrase || '');
        setHasPassphrase(!!passphrase);

        // Check App Lock
        // Dynamically import to avoid server-side issues if any
        import('@/lib/auth').then(mod => {
            setIsAppLockActive(mod.isAppLockEnabled());
        });

        // Load AI Key
        const storedAiKey = localStorage.getItem('cycletrack_gemini_key') || '';
        setAiApiKey(storedAiKey);
        setHasAiKey(!!storedAiKey);
    }, []);

    // Sync drafts whenever the stored settings change (initial load, import,
    // restore). Felder mit anstehender Fehlermeldung bleiben unangetastet —
    // sonst verwirft der Commit eines ANDEREN Feldes die ungespeicherte
    // Eingabe samt Fehlermeldung.
    useEffect(() => {
        setDraftValues(prev => ({
            cycleLength: fieldErrors.cycleLength ? prev.cycleLength : String(data.cycleLength),
            periodLength: fieldErrors.periodLength ? prev.periodLength : String(data.periodLength),
            lutealPhase: fieldErrors.lutealPhase ? prev.lutealPhase : String(data.lutealPhase),
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.cycleLength, data.periodLength, data.lutealPhase]);

    const commitNumberField = (field: NumberField) => {
        const { min, max } = NUMBER_FIELDS[field];
        const raw = draftValues[field].trim();
        const parsed = Number.parseInt(raw, 10);
        if (raw === '' || Number.isNaN(parsed) || parsed < min || parsed > max) {
            setFieldErrors(prev => ({
                ...prev,
                [field]: `Bitte einen Wert zwischen ${min} und ${max} eingeben.`,
            }));
            return;
        }
        setFieldErrors(prev => ({ ...prev, [field]: undefined }));
        setDraftValues(prev => ({ ...prev, [field]: String(parsed) }));
        updateSettings({ [field]: parsed });
    };

    const handleToggleAppLock = async () => {
        const auth = await import('@/lib/auth');
        if (isAppLockActive) {
            // Disable
            auth.disableAppLock();
            setIsAppLockActive(false);
            toast.success('App-Sperre deaktiviert');
        } else {
            // Enable
            const success = await auth.registerPasskey();
            if (success) {
                setIsAppLockActive(true);
                toast.success('App-Sperre aktiviert (Face ID / Touch ID)');
            } else {
                toast.error('Konnte Biometrie nicht einrichten. Wird es von diesem Gerät unterstützt?');
            }
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result;
            if (typeof text !== 'string') {
                toast.error('Fehler beim Lesen der Datei');
                return;
            }
            setPendingRestore({ kind: 'file', json: text });
        };
        reader.onerror = () => toast.error('Fehler beim Lesen der Datei');
        reader.readAsText(file);
    };

    const handleFemometerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (!file.name.endsWith('.csv')) {
            toast.error('Bitte eine .csv-Datei auswählen');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const csvText = event.target?.result as string;
                const { entries, skippedRows } = parseFemometerCSV(csvText);
                const count = Object.keys(entries).length;

                if (count > 0) {
                    mergeEntries(entries);
                    toast.success(`${count} Einträge erfolgreich importiert!`);
                    if (skippedRows > 0) {
                        toast.warning(`${skippedRows} Zeile(n) mit ungültigen Werten übersprungen.`);
                    }
                } else {
                    toast.warning('Keine Einträge gefunden oder Format nicht erkannt.');
                }
            } catch (err) {
                console.error(err);
                toast.error('Fehler beim Importieren der CSV.');
            }
        };
        reader.readAsText(file);
    };

    const exportData = () => {
        const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
            JSON.stringify(data)
        )}`;
        const link = document.createElement('a');
        link.href = jsonString;
        link.download = `cycletrack-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    };

    const handleClearData = () => {
        clearAllData();
        toast.success('Alle Daten gelöscht.');
    };

    const handleSaveToken = () => {
        if (!gistToken.trim()) {
            clearGistConfig();
            setHasGistToken(false);
            toast.success('Cloud-Backup deaktiviert');
            return;
        }
        setGistConfig(gistToken.trim());
        setHasGistToken(true);
        toast.success('Token gespeichert — automatischer Sync aktiv');
    };

    const handleSavePassphrase = () => {
        const passphrase = passphraseInput.trim();
        setBackupPassphrase(passphrase);
        setHasPassphrase(!!passphrase);
        toast.success(passphrase
            ? 'Passphrase gespeichert — Cloud-Backups werden verschlüsselt'
            : 'Passphrase entfernt — Cloud-Backups werden im Klartext gesichert');
    };

    const handleManualSync = async () => {
        setIsSyncing(true);
        const result = await syncToGist(data);
        setIsSyncing(false);
        if (result.success) {
            toast.success('Cloud-Backup erfolgreich!');
        } else {
            toast.error(`Sync fehlgeschlagen: ${result.error}`);
        }
    };

    // Runs after the user confirmed the restore dialog. Restores always
    // REPLACE the current entries (backup semantics), never merge.
    const executeRestore = async () => {
        const pending = pendingRestore;
        setPendingRestore(null);
        if (!pending) return;

        if (pending.kind === 'cloud') {
            setIsRestoring(true);
            const result = await restoreFromGist();
            setIsRestoring(false);
            if (result.json) {
                const imported = importData(result.json, 'replace');
                if (imported.count > 0) {
                    toast.success('Daten aus der Cloud wiederhergestellt!');
                } else {
                    toast.error(imported.warnings[0] || 'Wiederherstellung fehlgeschlagen');
                }
            } else {
                toast.error(`Wiederherstellung fehlgeschlagen: ${result.error}`);
            }
            return;
        }

        if (pending.kind === 'local') {
            const backups = getLocalBackups();
            const backup = pending.which === 1 ? backups.backup1 : backups.backup2;
            if (backup && backup.data) {
                const imported = importData(JSON.stringify(backup.data), 'replace');
                if (imported.count > 0) {
                    toast.success(`Lokales Backup ${pending.which} wiederhergestellt!`);
                } else {
                    toast.error(imported.warnings[0] || 'Wiederherstellung fehlgeschlagen');
                }
            } else {
                toast.error('Kein Backup verfügbar');
            }
            return;
        }

        // kind === 'file'
        const result = importData(pending.json, 'replace');
        if (result.count > 0) {
            toast.success(`${result.count} Einträge wiederhergestellt`);
            if (result.warnings.length > 0) {
                toast.warning(result.warnings[0]);
            }
        } else {
            toast.error(result.warnings[0] || 'Wiederherstellung fehlgeschlagen');
        }
    };

    const restoreSourceLabel = pendingRestore?.kind === 'cloud'
        ? 'aus der Cloud'
        : pendingRestore?.kind === 'local'
            ? `aus dem lokalen Backup ${pendingRestore.which}`
            : 'aus der gewählten Datei';

    const handleForceUpdate = async () => {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
            }
            window.location.reload();
        } else {
            window.location.reload();
        }
    };

    return (
        <div className="space-y-6 pb-24 px-4 pt-6">
            <h2 className="text-2xl font-bold tracking-tight font-serif">Einstellungen</h2>

            {/* Restore confirmation (shared by cloud, local backups and file restore) */}
            <AlertDialog open={pendingRestore !== null} onOpenChange={(open) => { if (!open) setPendingRestore(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Backup wiederherstellen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Das Backup {restoreSourceLabel} wird wiederhergestellt und ersetzt alle aktuellen Einträge.
                            Dieser Schritt kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={executeRestore}>
                            Wiederherstellen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Appearance */}
            <Card className="border-none shadow-soft bg-card rounded-3xl">
                <CardHeader>
                    <CardTitle className="font-serif flex items-center gap-2">
                        <Sun className="w-5 h-5" />
                        Darstellung
                    </CardTitle>
                    <CardDescription>Wähle das Erscheinungsbild der App.</CardDescription>
                </CardHeader>
                <CardContent>
                    {mounted && (
                        <div className="flex gap-2">
                            {[
                                { value: 'light', label: 'Hell', icon: Sun },
                                { value: 'dark', label: 'Dunkel', icon: Moon },
                                { value: 'system', label: 'System', icon: Monitor },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setTheme(opt.value)}
                                    className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                        theme === opt.value
                                            ? 'border-primary bg-secondary'
                                            : 'border-border/50 bg-card hover:bg-muted/50'
                                    }`}
                                >
                                    <opt.icon className={`w-5 h-5 ${theme === opt.value ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <span className={`text-xs font-medium ${theme === opt.value ? 'text-primary' : 'text-muted-foreground'}`}>{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Cycle Settings */}
            <Card className="border-none shadow-soft bg-card rounded-3xl">
                <CardHeader>
                    <CardTitle className="font-serif">Zyklus-Einstellungen</CardTitle>
                    <CardDescription>Passe die App an deinen Körper an.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {(Object.keys(NUMBER_FIELDS) as NumberField[]).map((field) => {
                        const cfg = NUMBER_FIELDS[field];
                        const error = fieldErrors[field];
                        return (
                            <div key={field} className="space-y-2">
                                <Label htmlFor={field}>{cfg.label}</Label>
                                <Input
                                    id={field}
                                    type="number"
                                    inputMode="numeric"
                                    min={cfg.min}
                                    max={cfg.max}
                                    value={draftValues[field]}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setDraftValues(prev => ({ ...prev, [field]: value }));
                                    }}
                                    onBlur={() => commitNumberField(field)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') e.currentTarget.blur();
                                    }}
                                    aria-invalid={!!error}
                                    aria-describedby={error ? `${field}-error` : undefined}
                                />
                                {error && (
                                    <p id={`${field}-error`} role="alert" className="text-xs text-destructive">
                                        {error}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            {/* Security Settings */}
            <Card className="border-none shadow-soft bg-card rounded-3xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-serif">
                        <Shield className="w-5 h-5" />
                        Sicherheit
                    </CardTitle>
                    <CardDescription>Schütze die App vor Zugriffen.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="appLock" className="flex flex-col gap-1">
                            <span>App-Sperre (Face ID / Touch ID)</span>
                            <span className="font-normal text-xs text-muted-foreground">
                                Beim Starten der App entsperren.
                            </span>
                        </Label>
                        <Switch
                            id="appLock"
                            checked={isAppLockActive}
                            onCheckedChange={() => handleToggleAppLock()}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* AI Assistant */}
            <Card className="border-none shadow-soft bg-card rounded-3xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-serif">
                        <Sparkles className="w-5 h-5" />
                        Clara
                    </CardTitle>
                    <CardDescription>Zyklusanalyse und Tipps mit Gemini AI.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="aiApiKey">Gemini API-Key</Label>
                        <Input
                            id="aiApiKey"
                            type="password"
                            value={aiApiKey}
                            onChange={(e) => setAiApiKey(e.target.value)}
                            placeholder="AIza..."
                        />
                        <p className="text-xs text-muted-foreground">
                            Kostenlos erstellen bei{' '}
                            <a
                                href="https://aistudio.google.com/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline"
                            >
                                Google AI Studio →
                            </a>
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => {
                            if (aiApiKey.trim()) {
                                localStorage.setItem('cycletrack_gemini_key', aiApiKey.trim());
                                setHasAiKey(true);
                                toast.success('API-Key gespeichert — Clara ist aktiv');
                            } else {
                                localStorage.removeItem('cycletrack_gemini_key');
                                setHasAiKey(false);
                                toast.success('Clara deaktiviert');
                            }
                        }}
                    >
                        <Sparkles className="w-4 h-4" />
                        {hasAiKey ? 'Key aktualisieren' : 'Key speichern'}
                    </Button>
                    {hasAiKey && (
                        <p className="text-xs text-[var(--phase-fertile)] flex items-center gap-1">
                            Clara ist aktiv
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Data Management */}
            <Card className="border-none shadow-soft bg-card rounded-3xl">
                <CardHeader>
                    <CardTitle className="font-serif">Datenverwaltung</CardTitle>
                    <CardDescription>Sicherung und Import.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Button variant="outline" onClick={exportData} className="w-full gap-2">
                            <Download className="w-4 h-4" />
                            Backup
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full gap-2"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="w-4 h-4" />
                            Wiederherstellen
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".json"
                            className="sr-only"
                            aria-label="Backup-Datei (.json) zum Wiederherstellen auswählen"
                            tabIndex={-1}
                        />
                    </div>

                    {/* Local Auto-Backup Restore */}
                    {(localBackups.backup1 || localBackups.backup2) && (
                        <div className="border-t pt-4 space-y-3">
                            <Label className="text-xs text-muted-foreground block mb-2">
                                Lokale Auto-Backups
                            </Label>
                            <div className="grid grid-cols-1 gap-2">
                                {localBackups.backup1 && (
                                    <div className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded-md border">
                                        <div className="flex flex-col">
                                            <span className="font-medium">Backup 1 (Neuestes)</span>
                                            <span className="text-xs text-muted-foreground">
                                                {localBackups.backup1.timestamp === 'Legacy'
                                                    ? 'Datum unbekannt'
                                                    : new Date(localBackups.backup1.timestamp).toLocaleString('de-DE')}
                                            </span>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setPendingRestore({ kind: 'local', which: 1 })}>
                                            <RotateCcw className="w-3 h-3 mr-1" /> Laden
                                        </Button>
                                    </div>
                                )}
                                {localBackups.backup2 && (
                                    <div className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded-md border">
                                        <div className="flex flex-col">
                                            <span className="font-medium">Backup 2 (Älter)</span>
                                            <span className="text-xs text-muted-foreground">
                                                {localBackups.backup2.timestamp === 'Legacy'
                                                    ? 'Datum unbekannt'
                                                    : new Date(localBackups.backup2.timestamp).toLocaleString('de-DE')}
                                            </span>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setPendingRestore({ kind: 'local', which: 2 })}>
                                            <RotateCcw className="w-3 h-3 mr-1" /> Laden
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Femometer Import */}
                    <div className="border-t pt-4">
                        <Label className="mb-2 block">Femometer-Import (.csv)</Label>
                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={() => csvInputRef.current?.click()}
                        >
                            CSV-Datei auswählen
                        </Button>
                        <input
                            type="file"
                            ref={csvInputRef}
                            onChange={handleFemometerUpload}
                            accept=".csv"
                            className="sr-only"
                            aria-label="Femometer-CSV-Datei zum Import auswählen"
                            tabIndex={-1}
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                            Exportiere deine Daten aus der Femometer-App als CSV. Vorhandene Einträge werden feldweise ergänzt.
                        </p>
                    </div>

                    {/* Delete All */}
                    <div className="border-t pt-4">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="w-full flex items-center gap-2">
                                    <Trash2 className="w-4 h-4" /> Alle Daten löschen
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Alle Daten löschen?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Alle Zyklusdaten, Einträge und Einstellungen werden unwiderruflich gelöscht.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleClearData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Endgültig löschen
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>

            {/* Cloud Backup */}
            <Card className="border-none shadow-soft bg-card rounded-3xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-serif">
                        <Cloud className="w-5 h-5" />
                        Cloud-Backup
                    </CardTitle>
                    <CardDescription>
                        Automatisch als privates GitHub Gist sichern.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="gistToken">GitHub Token</Label>
                        <Input
                            id="gistToken"
                            type="password"
                            value={gistToken}
                            onChange={(e) => setGistToken(e.target.value)}
                            placeholder="ghp_..."
                        />
                        <p className="text-xs text-muted-foreground">
                            github.com/settings/tokens → Scope &quot;gist&quot;
                        </p>
                    </div>
                    <Button variant="outline" onClick={handleSaveToken} className="w-full gap-2">
                        <Shield className="w-4 h-4" />
                        Token speichern
                    </Button>

                    {/* Backup Encryption */}
                    <div className="space-y-2 border-t pt-3">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="backupPassphrase">Backup-Passphrase</Label>
                            {hasPassphrase ? (
                                <Badge variant="secondary" className="gap-1">
                                    <Lock /> verschlüsselt
                                </Badge>
                            ) : (
                                <span className="text-xs text-muted-foreground">nicht gesetzt</span>
                            )}
                        </div>
                        <Input
                            id="backupPassphrase"
                            type="password"
                            value={passphraseInput}
                            onChange={(e) => setPassphraseInput(e.target.value)}
                            placeholder="Passphrase (optional)"
                            autoComplete="new-password"
                        />
                        <p className="text-xs text-muted-foreground">
                            Mit Passphrase wird dein Cloud-Backup Ende-zu-Ende verschlüsselt (AES-GCM).
                            Ohne Passphrase wird im Klartext gesichert.
                        </p>
                        <Button variant="outline" onClick={handleSavePassphrase} className="w-full gap-2">
                            <Lock className="w-4 h-4" />
                            Passphrase speichern
                        </Button>
                    </div>

                    {hasGistToken && (
                        <div className="grid grid-cols-2 gap-2 border-t pt-3">
                            <Button variant="outline" onClick={handleManualSync} disabled={isSyncing} className="gap-2">
                                <Cloud className="w-4 h-4" />
                                {isSyncing ? 'Synchronisiere…' : 'Jetzt sichern'}
                            </Button>
                            <Button variant="outline" onClick={() => setPendingRestore({ kind: 'cloud' })} disabled={isRestoring} className="gap-2">
                                <Download className="w-4 h-4" />
                                {isRestoring ? 'Lade…' : 'Aus Cloud'}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* App Info */}
            <Card className="border-none shadow-soft bg-muted/30 rounded-3xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-serif">App-Info & Updates</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                    <div className="flex justify-between items-center">
                        <span>Version:</span>
                        <span className="font-mono">{APP_VERSION}{BUILD_DATE ? ` (${BUILD_DATE})` : ''}</span>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleForceUpdate}
                        className="w-full gap-2 mt-2 bg-card hover:bg-muted text-foreground border-border"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Update erzwingen
                    </Button>
                </CardContent>
            </Card>

            <div className="text-center text-xs text-muted-foreground pt-4">
                CycleTrack v{APP_VERSION}{BUILD_DATE ? ` • ${BUILD_DATE}` : ''}
            </div>
        </div>
    );
}
