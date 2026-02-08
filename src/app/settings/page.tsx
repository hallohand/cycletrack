'use client';
import { useCycleData } from '@/hooks/useCycleData';
import { useState } from 'react';
import { Trash2, Download, Upload, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function SettingsPage() {
    const { data, importData, updateSettings } = useCycleData();
    const [importText, setImportText] = useState('');

    const handleExportJSON = () => {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cycletrack-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Backup heruntergeladen");
    };

    const handleImport = () => {
        if (!importText) return;
        try {
            const count = importData(importText);
            toast.success(`${count} Einträge erfolgreich importiert.`);
            setImportText('');
        } catch (e) {
            toast.error("Fehler beim Importieren. Überprüfe das Format.");
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="text-center py-4">
                <h2 className="text-2xl font-bold tracking-tight">Einstellungen</h2>
                <p className="text-muted-foreground text-sm">Verwalte deine Daten & Präferenzen</p>
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg">Zyklus-Parameter</CardTitle>
                    <CardDescription>Passe die Berechnungen an deinen Körper an.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Lutealphase (Tage)</Label>
                        <Input
                            type="number"
                            value={data.lutealPhase || 14}
                            onChange={(e) => updateSettings({ lutealPhase: parseInt(e.target.value) || 14 })}
                        />
                        <p className="text-xs text-muted-foreground">Standard ist 14 Tage. Ändere dies nur, wenn du deine genaue Lutealphase kennst.</p>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg">Daten-Verwaltung</CardTitle>
                    <CardDescription>Deine Daten gehören dir. Exportiere oder importiere sie jederzeit.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={handleExportJSON}>
                        <Download className="w-4 h-4" /> Backup herunterladen (JSON)
                    </Button>

                    <div className="pt-4 border-t">
                        <Label className="mb-2 block">Import</Label>
                        <Textarea
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            className="mb-2 font-mono text-xs"
                            placeholder='Füge hier den Inhalt deiner Backup-Datei ein...'
                            rows={4}
                        />
                        <Button className="w-full gap-2" onClick={handleImport} disabled={!importText}>
                            <Upload className="w-4 h-4" /> Daten importieren
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="text-center text-xs text-muted-foreground pt-8">
                CycleTrack v2.1 • Privacy First
            </div>
        </div>
    );
}
