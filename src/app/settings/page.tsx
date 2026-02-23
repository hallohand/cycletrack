'use client';

import { useState, useRef, useEffect } from 'react';
import { useCycleData } from '@/hooks/useCycleData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { parseFemometerCSV } from '@/lib/importer';
import { APP_VERSION, BUILD_DATE } from '@/lib/version';
import { Trash2, RotateCcw, Cloud, Download, Upload, Shield, Sparkles } from 'lucide-react';
import {
    getGistConfig, setGistConfig, clearGistConfig,
    syncToGist, restoreFromGist,
    getLocalBackups
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

export default function SettingsPage() {
    const { data, updateSettings, importData, setAllEntries, clearAllData } = useCycleData();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [gistToken, setGistToken] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    // Updated State for new Backup Format
    const [localBackups, setLocalBackups] = useState<{
        backup1: { data: any; timestamp: string } | null;
        backup2: { data: any; timestamp: string } | null;
    }>({ backup1: null, backup2: null });

    const [hasGistToken, setHasGistToken] = useState(false);

    // App Lock State
    const [isAppLockActive, setIsAppLockActive] = useState(false);

    // AI Assistant State
    const [aiApiKey, setAiApiKey] = useState('');
    const [hasAiKey, setHasAiKey] = useState(false);

    useEffect(() => {
        const config = getGistConfig();
        setGistToken(config.token || '');
        setHasGistToken(!!config.token);
        setLocalBackups(getLocalBackups());

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

    const handleToggleAppLock = async () => {
        const auth = await import('@/lib/auth');
        if (isAppLockActive) {
            // Disable
            auth.disableAppLock();
            setIsAppLockActive(false);
            toast.success('App Lock deaktiviert');
        } else {
            // Enable
            const success = await auth.registerPasskey();
            if (success) {
                setIsAppLockActive(true);
                toast.success('App Lock aktiviert (Face ID / Touch ID)');
            } else {
                toast.error('Konnte Biometrie nicht einrichten. Wird es von diesem Gerät unterstützt?');
            }
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const result = importData(text);
                if (result.count > 0) {
                    toast.success(`${result.count} Einträge importiert`);
                    if (result.warnings.length > 0) {
                        toast.warning(result.warnings[0]);
                    }
                } else {
                    toast.error(result.warnings[0] || 'Import fehlgeschlagen');
                }
            } catch (err) {
                toast.error('Fehler beim Lesen der Datei');
            }
        };
        reader.readAsText(file);
    };

    const handleFemometerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.csv')) {
            toast.error('Bitte .csv Datei auswählen');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const csvText = event.target?.result as string;
                const entries = parseFemometerCSV(csvText);
                const count = Object.keys(entries).length;

                if (count > 0) {
                    setAllEntries(entries);
                    toast.success(`${count} Einträge erfolgreich importiert!`);
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

    const handleCloudRestore = async () => {
        setIsRestoring(true);
        const result = await restoreFromGist();
        setIsRestoring(false);
        if (result.data) {
            importData(JSON.stringify(result.data));
            toast.success('Daten aus Cloud wiederhergestellt!');
        } else {
            toast.error(`Wiederherstellung fehlgeschlagen: ${result.error}`);
        }
    };

    const handleRestoreLocalBackup = (which: 1 | 2) => {
        const backups = getLocalBackups();
        const backup = which === 1 ? backups.backup1 : backups.backup2;
        // Updated to handle wrapped data structure
        if (backup && backup.data) {
            importData(JSON.stringify(backup.data));
            toast.success(`Lokales Backup ${which} wiederhergestellt!`);
        } else {
            toast.error('Kein Backup verfügbar');
        }
    };

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
            <h2 className="text-2xl font-bold tracking-tight">Einstellungen</h2>

            {/* Cycle Settings */}
            <Card className="border-none shadow-sm bg-white">
                <CardHeader>
                    <CardTitle>Zyklus-Einstellungen</CardTitle>
                    <CardDescription>Passe die App an deinen Körper an.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="cycleLength">Durchschnittliche Zykluslänge (Tage)</Label>
                        <Input
                            id="cycleLength"
                            type="number"
                            value={data.cycleLength}
                            onChange={(e) => updateSettings({ cycleLength: parseInt(e.target.value) || 28 })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="periodLength">Periodendauer (Tage)</Label>
                        <Input
                            id="periodLength"
                            type="number"
                            value={data.periodLength}
                            onChange={(e) => updateSettings({ periodLength: parseInt(e.target.value) || 5 })}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Security Settings */}
            <Card className="border-none shadow-sm bg-white">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        Sicherheit
                    </CardTitle>
                    <CardDescription>Schütze die App vor Zugriffen.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="appLock" className="flex flex-col gap-1">
                            <span>App Lock (Face ID / Touch ID)</span>
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
            <Card className="border-none shadow-sm bg-white">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
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
                                className="text-rose-400 underline"
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
                        <p className="text-xs text-green-600 flex items-center gap-1">
                            ✅ Clara ist aktiv
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Data Management */}
            <Card className="border-none shadow-sm bg-white">
                <CardHeader>
                    <CardTitle>Datenverwaltung</CardTitle>
                    <CardDescription>Sicherung und Import.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Button variant="outline" onClick={exportData} className="w-full gap-2">
                            <Download className="w-4 h-4" />
                            Backup
                        </Button>
                        <div className="relative">
                            <Button variant="outline" className="w-full gap-2">
                                <Upload className="w-4 h-4" />
                                Wiederherstellen
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".json"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                        </div>
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
                                        <Button variant="ghost" size="sm" onClick={() => handleRestoreLocalBackup(1)}>
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
                                        <Button variant="ghost" size="sm" onClick={() => handleRestoreLocalBackup(2)}>
                                            <RotateCcw className="w-3 h-3 mr-1" /> Laden
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Femometer Import */}
                    <div className="border-t pt-4">
                        <Label className="mb-2 block">Femometer Import (.csv)</Label>
                        <div className="relative">
                            <Button variant="secondary" className="w-full">
                                CSV Datei auswählen
                            </Button>
                            <input
                                type="file"
                                onChange={handleFemometerUpload}
                                accept=".csv"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Exportiere deine Daten aus der Femometer App als CSV.
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
            <Card className="border-none shadow-sm bg-white">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
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

                    {hasGistToken && (
                        <div className="grid grid-cols-2 gap-2 border-t pt-3">
                            <Button variant="outline" onClick={handleManualSync} disabled={isSyncing} className="gap-2">
                                <Cloud className="w-4 h-4" />
                                {isSyncing ? 'Synce...' : 'Jetzt sichern'}
                            </Button>
                            <Button variant="outline" onClick={handleCloudRestore} disabled={isRestoring} className="gap-2">
                                <Download className="w-4 h-4" />
                                {isRestoring ? 'Lade...' : 'Aus Cloud'}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* App Info */}
            <Card className="border-none shadow-sm bg-muted/30">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">App Info & Updates</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                    <div className="flex justify-between items-center">
                        <span>Version:</span>
                        <span className="font-mono">{APP_VERSION} ({BUILD_DATE})</span>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleForceUpdate}
                        className="w-full gap-2 mt-2 bg-white hover:bg-gray-100 text-foreground border-gray-200"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Update erzwingen
                    </Button>
                </CardContent>
            </Card>

            <div className="text-center text-xs text-muted-foreground pt-4">
                CycleTrack v{APP_VERSION} • {BUILD_DATE}
            </div>
        </div>
    );
}
