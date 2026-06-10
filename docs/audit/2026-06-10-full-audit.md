# CycleTrack — Komplettes Code-Audit (2026-06-10)

Multi-Agent-Audit über 7 Dimensionen mit adversarialer Verifikation. **66 bestätigte Funde**, 1 verworfen.

## [1] CRITICAL · data · Korrupte Hauptdaten zerstören binnen Minuten alle 4 Datenkopien (Main, Backup 1+2, Cloud-Gist) ohne Nutzeraktion

**Datei:** `src/components/CycleContext.tsx:34-61`

Beim Laden wird JSON.parse-Fehler nur geloggt und stillschweigend mit DEFAULT_CYCLE_DATA (leer) weitergemacht. Der Persist-Effekt (deps [data, isLoaded]) feuert aber schon durch setIsLoaded(true) beim App-Start erneut — d.h. allein das ÖFFNEN der App (ohne jede Eingabe) überschreibt cycletrack_data mit den leeren Default-Daten, ruft rotateLocalBackup(leer) auf (backup_1 = leer, backup_2 = letztes gutes Backup) und plant debouncedCloudSync(leer), der nach 60s das GitHub-Gist mit {entries:{}} überschreibt. Beim zweiten App-Start ist auch backup_2 leer. Ergebnis: Ein einziger korrupter LocalStorage-Wert + zwei App-Starts vernichten alle Gesundheitsdaten inkl. Cloud-Backup, ohne dass die Nutzerin etwas tut oder gewarnt wird. Es gibt keinen Recovery-Versuch über getLocalBackups() und der korrupte Roh-String wird nicht gesichert, sondern sofort überschrieben.

**Beleg:** `CycleContext.tsx:44-47: `} catch (e) { console.error('Failed to parse cycle data', e); } setIsLoaded(true);` — danach Persist-Effekt Z.52-61: `localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); rotateLocalBackup(data); debouncedCloudSync(data);` läuft beim zweiten Effekt-Durchlauf nach dem Mou`

**Fix:** 1) Bei Parse-Fehler den korrupten Roh-String unter z.B. cycletrack_data_corrupt sichern, automatisch getLocalBackups()/Gist als Recovery anbieten und isLoaded NICHT auf einen Zustand setzen, der Persist erlaubt (z.B. Read-only-Fehlermodus). 2) Persist-Effekt nur ausführen, wenn sich data tatsächlich gegenüber dem geladenen Stand geändert hat (Dirty-Flag statt isInitialLoad-Ref). 3) Cloud-Sync und Backup-Rotation nie mit leeren entries ausführen, wenn vorher Daten existierten (Sanity-Check: neue Entry-Anzahl >= 50% der alten, sonst Bestätigung verlangen).

## [2] CRITICAL · logic · Persist-Effekt rotiert Backups bei jedem App-Start und kann nach Parse-Fehler alle Daten + alle Backups (inkl. Cloud) zerstören

**Datei:** `src/components/CycleContext.tsx:52`

Der Persist-Effekt läuft nicht nur bei Nutzeränderungen, sondern bei JEDEM App-Start: Beim Mount setzt der Load-Effekt data+isLoaded, dadurch feuert der Persist-Effekt (das isInitialLoad-Ref fängt nur den allerersten Aufruf mit Default-Daten ab) und ruft rotateLocalBackup() + debouncedCloudSync() mit unveränderten Daten auf. Folgen: (1) Nach zwei App-Starts enthalten beide Backup-Slots (backup_1, backup_2) identisch den aktuellen Stand — die 2-Generationen-Sicherung schützt vor nichts. (2) Worst Case: Schlägt JSON.parse des Hauptschlüssels fehl (korrupter LocalStorage), bleibt data=DEFAULT_CYCLE_DATA (leer), isLoaded wird trotzdem true → der Effekt ÜBERSCHREIBT den Hauptschlüssel mit leeren Daten, rotiert backup_1←leer, und debouncedCloudSync überschreibt nach 60s auch das Gist mit leeren Daten. Beim nächsten Start wird backup_2←leer. Alle Gesundheitsdaten samt aller drei Backup-Ebenen sind ohne jede Nutzeraktion vernichtet. Gleicher Mechanismus nach clearAllData(): ein weiterer App-Start zerstört das letzte gute Backup.

**Beleg:** `useEffect(() => {
    if (isInitialLoad.current) { isInitialLoad.current = false; return; }
    if (!isLoaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    rotateLocalBackup(data);
    debouncedCloudSync(data);
}, [data, isLoaded]);
// Load-Effekt: catch (e) { console.err`

**Fix:** Persistieren nur bei echten Änderungen (z.B. Vergleich mit zuletzt geladenem Snapshot oder Persist nur aus den Mutations-Callbacks heraus). rotateLocalBackup zeitlich gaten (z.B. max. 1 Rotation pro 24h via BACKUP_TIMESTAMP_KEY) und niemals rotieren, wenn entries leer sind aber das vorhandene Backup Einträge hat. Bei Parse-Fehler den korrupten Rohwert sichern und NICHT zurückschreiben/syncen (isLoaded=true nur bei Erfolg bzw. Schreibsperre setzen).

## [3] CRITICAL · pwa · Deployter Service Worker ist ein veraltetes Build-Artefakt mit falschen Pfaden — SW-Installation schlägt in Produktion komplett fehl

**Datei:** `.github/workflows/deploy.yml:46`

Der Deploy-Workflow nutzt actions/configure-pages@v5 mit static_site_generator: next. Diese Action unterstützt nur next.config.{js,cjs,mjs} (verifiziert im Action-Quellcode: SUPPORTED_FILE_EXTENSIONS = ['.js', '.cjs', '.mjs']). Da das Repo nur next.config.ts hat, erzeugt die Action eine eigene blanke next.config.js mit output:'export', basePath:'/cycletrack', images.unoptimized. Next.js bevorzugt next.config.js vor next.config.ts — der gesamte Inhalt von next.config.ts inkl. des withPWA-Wrappers wird im CI-Build IGNORIERT. Folge: next-pwa läuft im CI nie, public/sw.js wird nicht regeneriert, sondern die eingecheckte (lokal gebaute, veraltete) Version 1:1 nach out/ kopiert. Live verifiziert: Der deployte sw.js auf hallohand.github.io/cycletrack/sw.js enthält die alte Build-ID QuUrZp9m-LG4jcnmYmLAW (identisch mit der committeten Datei) und precacht root-relative URLs wie /_next/static/chunks/framework-465e55eb0345138a.js — diese liefern auf GitHub Pages 404 (mit /cycletrack/-Präfix: 200). Workbox bricht die Installation bei 404-Precache-Responses ab (bad-precaching-response) → der SW installiert sich in Produktion NIE erfolgreich. Damit gibt es weder Offline-Funktion noch Caching, obwohl die README 'Offline-First: Die App funktioniert vollständig ohne Internetverbindung' verspricht. Zusätzlich referenziert die deployte index.html ganz andere Chunk-Hashes (z.B. webpack-71f3203582a3ac69.js) als der sw.js-Precache (webpack-0eadced908230166.js) — Beweis, dass SW und App-Bundle aus verschiedenen Builds stammen.

**Beleg:** `curl https://hallohand.github.io/_next/static/chunks/framework-465e55eb0345138a.js → 404; curl https://hallohand.github.io/cycletrack/_next/static/chunks/framework-465e55eb0345138a.js → 200. Deployter sw.js: precacheAndRoute([{url:"/_next/static/QuUrZp9m-LG4jcnmYmLAW/_buildManifest.js",...}]) — Buil`

**Fix:** next.config.ts in next.config.mjs umwandeln (ESM, default export), damit configure-pages das echte Config-File patcht und withPWA im CI läuft. Alternativ: basePath '/cycletrack' und output:'export' fest in der eigenen Config setzen und den Setup-Pages-Schritt ohne static_site_generator nutzen. Danach prüfen, dass der generierte sw.js /cycletrack/-präfixierte Precache-URLs enthält.

## [4] CRITICAL · security · Gist-Cloud-Backup ist komplett unverschlüsselt — alle Gesundheitsdaten gehen im Klartext zu GitHub

**Datei:** `src/lib/backup.ts:187`

Entgegen der Feature-Beschreibung ('verschlüsselt via GitHub Gist') existiert im gesamten src/ keinerlei Verschlüsselung (kein crypto.subtle, kein AES, keine Key-Derivation — per grep verifiziert). syncToGist() serialisiert den vollständigen CycleData-Datensatz (Basaltemperaturen, Periodendaten, Notizen, Symptome) als JSON und lädt ihn unverändert in ein 'secret' Gist hoch. Secret Gists sind nicht privat im kryptographischen Sinn: Jeder mit der URL/Gist-ID kann den Raw-Inhalt ohne Authentifizierung lesen, GitHub-Mitarbeiter und jede App mit gist-Scope haben Zugriff, und da jeder debounced Sync (alle 60s nach Änderung) eine neue Gist-Revision erzeugt, bleibt die komplette Datenhistorie auch nach 'Löschung' in der Revisionshistorie erhalten. Angriffspfad: Gist-ID leakt (Browser-Sync, geteiltes Gerät, GitHub-API-Listing der eigenen Gists) → vollständige Gesundheitsdaten-Historie lesbar.

**Beleg:** `const content = JSON.stringify(data, null, 2); ... body: JSON.stringify({ description: `CycleTrack Backup — ...`, public: false, files: { [filename]: { content } } })`

**Fix:** Client-seitige Verschlüsselung vor dem Upload: Passphrase des Nutzers → PBKDF2 (≥600k Iterationen, zufälliges Salt) oder Argon2id → AES-256-GCM mit zufälligem 12-Byte-IV pro Sync (IV+Salt im Payload mitspeichern, niemals wiederverwenden). GCM liefert AEAD/Integritätsschutz. Beim Restore entschlüsseln und erst dann validateImportData() aufrufen. Zusätzlich UI-Hinweis entfernen/korrigieren, solange unverschlüsselt.

## [5] HIGH · a11y · Phasenfarben-Text auf hellen Phasenflächen massiv unter WCAG AA (1.67–2.68:1)

**Datei:** `src/app/globals.css:103-110`

Die Kombinationen Phasenfarbe-als-Text auf Phasen-Light-Hintergrund werden überall für zentrale Statusinformationen genutzt und verfehlen AA (4.5:1) drastisch: #F0A870 auf #FBE8D8 = 1.67:1 (Ovulation), #5BA8C8 auf #D6EDF7 = 2.20:1 (fruchtbar), #9B8EC4 auf #E8E4F3 = 2.38:1 (Luteal), #E8668B auf #FDE8EF = 2.68:1 (Periode). Zusätzlich weißer Text auf Ovulations-Orange #F0A870 = 1.99:1 für den markierten Eisprungtag im Kalender. Betroffen: Kalender-Tagesmarkierungen (src/app/calendar/page.tsx:215-221), Status-Pill auf dem Dashboard (src/components/dashboard/Dashboard.tsx:47-55), Statistik-Karten (src/app/history/page.tsx:53-60), Info-Pills im Chart (src/app/chart/page.tsx:436-455). Die wichtigsten Zyklusinformationen der App sind für sehbehinderte Nutzerinnen praktisch unlesbar.

**Beleg:** `calendar/page.tsx:219: ovulation: "bg-[var(--phase-ovulation)] text-white rounded-full font-bold glow-ovulation" → Weiß auf #F0A870 = 1.99:1; Dashboard.tsx:51: 'PEAK_LH': { ... bg: 'bg-[var(--phase-ovulation-light)]', text: 'text-[var(--phase-ovulation)]' } → 1.67:1`

**Fix:** Dunklere Textvarianten der Phasenfarben einführen (z.B. --phase-ovulation-text: #9A5B1F, --phase-fertile-text: #2A6A85, --phase-period-text: #B23A63) und für Text auf den Light-Flächen verwenden; für den Eisprungtag im Kalender dunklen Text (#2D2438) statt Weiß nutzen.

## [6] HIGH · a11y · primary-foreground auf primary verfehlt WCAG AA (3.13:1)

**Datei:** `src/app/globals.css:80-81`

Weißer Text (#FFFFFF) auf der Primärfarbe #E8668B erreicht nur 3.13:1 statt der geforderten 4.5:1 für normalen Text. Betroffen sind alle Primary-Buttons, ausgewählte Options-Chips im EntryDrawer (text-sm/text-xs), User-Chat-Bubbles (src/app/assistant/page.tsx:334), aktive Tabs (src/app/history/page.tsx:69-79) und Perioden-Tage im Kalender (calendar/page.tsx:215). Außerdem text-primary (#E8668B) auf Background (#FFF8F9) = 2.99:1, genutzt für die aktiven Nav-Labels in 10px-Schrift (src/components/layout/Layout.tsx:24).

**Beleg:** `--primary: #E8668B; --primary-foreground: #FFFFFF; → Kontrast 3.13:1 (rechnerisch). Layout.tsx:24: text-[10px] ... 'text-primary' auf --background = 2.99:1`

**Fix:** Primärfarbe für Light-Mode auf ca. #C94A72 oder dunkler absenken (Weiß darauf ≥4.5:1) oder primary-foreground auf einen dunklen Ton umstellen; für die 10px-Nav-Labels eine dunklere Textvariante der Primärfarbe verwenden.

## [7] HIGH · a11y · Weißer Text auf Primary-zu-Coral-Gradient (bis 2.53:1)

**Datei:** `src/components/entry/EntryDrawer.tsx:368`

Die wichtigsten CTAs der App nutzen weißen Text auf einem Gradient von --primary (#E8668B, 3.13:1) zu --coral (#F4845F, 2.53:1). Am Coral-Ende ist der Kontrast mit 2.53:1 weit unter AA. Betroffen: Speichern-Button im EntryDrawer (Z. 368), Dashboard-CTA "Wie geht es dir heute?" (src/components/dashboard/Dashboard.tsx:127), Speichern-Button im Gedächtnis-Sheet (src/app/assistant/page.tsx:402).

**Beleg:** `className="w-full bg-gradient-to-r from-primary to-coral text-white ..." — Weiß auf #F4845F = 2.53:1`

**Fix:** Gradient-Endfarben abdunkeln (z.B. to-[#D9663E]) oder dunklen Text verwenden; mindestens 4.5:1 gegen die hellste Stelle des Gradients sicherstellen.

## [8] HIGH · a11y · Icon-only Buttons ohne zugänglichen Namen (Temperatur +/-, Eintrag löschen, Senden)

**Datei:** `src/components/entry/EntryDrawer.tsx:185-213`

Mehrere rein ikonische Buttons haben kein aria-label und damit keinen Namen für Screenreader: die Minus-/Plus-Buttons zur Temperatureingabe (EntryDrawer.tsx:185-193 und 205-213), der Löschen-Button mit Trash2-Icon im DrawerFooter (EntryDrawer.tsx:377-379 — löscht den kompletten Tageseintrag ohne Bestätigung!) und der Senden-Button im Chat (src/app/assistant/page.tsx:375-381). Screenreader lesen nur "Schaltfläche" vor; die Kernfunktionen Temperatur erfassen, Eintrag löschen und Nachricht senden sind nicht identifizierbar.

**Beleg:** `<button className="w-10 h-10 rounded-full bg-muted ..." onClick={...}><Minus className="w-4 h-4" /></button> — kein aria-label; ebenso <Button variant="destructive" size="icon" ... onClick={handleDelete}><Trash2 .../></Button>`

**Fix:** aria-label ergänzen: "Temperatur verringern", "Temperatur erhöhen", "Eintrag löschen", "Nachricht senden". Für den Lösch-Button zusätzlich einen Bestätigungsdialog (AlertDialog wie in Settings) erwägen.

## [9] HIGH · a11y · Auswahl-Chips kommunizieren ihren Zustand nicht (kein aria-pressed im gesamten Code)

**Datei:** `src/components/entry/EntryDrawer.tsx:235-331`

Sämtliche Toggle-/Auswahl-Buttons der App exponieren ihren Auswahlzustand ausschließlich über Farbe: Blutungsstärke (Z.235), Schmerzen (Z.255), LH-Test (Z.277), Zervixschleim (Z.295), Stimmung (Z.310), Symptome (Z.325) im EntryDrawer; Theme-Auswahl (src/app/settings/page.tsx:248-259); Verlauf/Prognose-Tabs (src/app/history/page.tsx:67-84). Ein Grep über src/app und src/components (ohne ui/) findet kein einziges aria-pressed, aria-selected oder role="tab". Screenreader-Nutzerinnen können nicht erkennen, welche Werte erfasst sind — die zentrale Dateneingabe ist damit nicht nutzbar (WCAG 4.1.2). Zusätzlich verletzt die rein farbliche Kennzeichnung WCAG 1.4.1 (Use of Color).

**Beleg:** `grep -rn "aria-pressed|aria-expanded|aria-selected|aria-current|aria-live|role=" über src/app + src/components (ohne ui/) → 0 Treffer; Chip-Beispiel: className={`... ${entry.lhTest === opt.val ? 'bg-primary ...' : 'bg-card ...'}`} ohne Zustands-Attribut`

**Fix:** aria-pressed={isSelected} auf alle Toggle-Buttons setzen; die Tabs in history/page.tsx als role="tablist"/"tab" mit aria-selected umsetzen; Gruppen mit fieldset/legend oder role="group" + aria-label strukturieren.

## [10] HIGH · data · Backup-Rotation bei jedem App-Start/jeder Änderung — 2-Slot-Backup bietet faktisch keinen Schutz

**Datei:** `src/lib/backup.ts:20-33`

rotateLocalBackup wird im Persist-Effekt bei JEDER Datenänderung und sogar bei jedem App-Start (siehe Finding 1) aufgerufen. Damit sind backup_1 und backup_2 immer nur Sekunden bis Minuten alt bzw. identisch mit dem aktuellen Stand. Konkretes Szenario: Nutzerin löscht versehentlich Einträge oder bestätigt 'Alle Daten löschen' → Persist schreibt leer, backup_1 = leer; eine weitere Eingabe oder ein App-Neustart später ist auch backup_2 leer. Die als Sicherheitsnetz gedachte IndexedDB-Snapshot-Schicht (MAX_SNAPSHOTS=30, saveIndexedDBSnapshot/getIndexedDBSnapshots/restoreFromIndexedDB) ist toter Code — sie wird nirgendwo im Projekt aufgerufen (grep über src/ bestätigt: keine Aufrufstelle außerhalb von backup.ts). Es existiert also kein zeitlich gestaffeltes Backup.

**Beleg:** `CycleContext.tsx:58-59 ruft `rotateLocalBackup(data)` bei jedem Persist auf. backup.ts:88-124 (saveIndexedDBSnapshot) hat keinerlei Call-Sites: `grep -rn saveIndexedDBSnapshot src/` liefert nur die Definition in lib/backup.ts.`

**Fix:** saveIndexedDBSnapshot tatsächlich anbinden (z.B. max. 1 Snapshot pro Tag, gedrosselt im Persist-Effekt) und in den Einstellungen eine Restore-UI für die IndexedDB-Snapshots ergänzen. Die LocalStorage-Rotation zeitlich drosseln (z.B. backup_2 nur überschreiben, wenn backup_1 älter als 24h ist).

## [11] HIGH · data · 'Alle Daten löschen' überschreibt 60s später unangekündigt auch das Cloud-Backup mit leeren Daten

**Datei:** `src/components/CycleContext.tsx:108-110`

clearAllData setzt nur den State auf DEFAULT_CYCLE_DATA, löscht aber den Gist-Token nicht. Der Persist-Effekt feuert mit den leeren Daten und ruft debouncedCloudSync auf — 60 Sekunden nach der Bestätigung des Lösch-Dialogs wird das GitHub-Gist per PATCH mit {entries:{}} überschrieben. Der AlertDialog (settings/page.tsx:474-477) spricht nur von lokalen 'Zyklusdaten, Einträgen und Einstellungen'; dass das Cloud-BACKUP (das viele genau für diesen Fall anlegen) mitvernichtet wird, wird nicht erwähnt. Wer nach dem Löschen 'Aus Cloud' wiederherstellen will, bekommt leere Daten zurück. Dasselbe gilt für jedes Gerät mit veraltetem Datenstand: bloßes Öffnen der App auf einem alten Zweitgerät überschreibt nach 60s das aktuelle Gist mit den alten Daten (kein Konflikt-/Versions-Check im Sync).

**Beleg:** `CycleContext.tsx:108-110: `const clearAllData = useCallback(() => { setData({ ...DEFAULT_CYCLE_DATA, entries: {} }); }, []);` → Persist-Effekt Z.58-60 inkl. `debouncedCloudSync(data)`. backup.ts:183-246 syncToGist hat keinerlei Prüfung, ob die hochzuladenden Daten leerer/älter als der Gist-Inhalt si`

**Fix:** In clearAllData den anstehenden Sync-Timeout canceln und Cloud-Sync für leere Daten blockieren. Im Lösch-Dialog explizit abfragen, ob auch das Cloud-Backup überschrieben werden soll. syncToGist um einen Guard erweitern (z.B. updated_at/Entry-Count des Gists vor PATCH lesen und bei drastischem Datenrückgang Bestätigung verlangen).

## [12] HIGH · data · Kein Multi-Tab-Handling: Ganz-Objekt last-writer-wins überschreibt Eingaben anderer Tabs

**Datei:** `src/components/CycleContext.tsx:34-61`

Die Daten werden genau einmal beim Mount aus LocalStorage gelesen und bei jeder Änderung als komplettes Objekt zurückgeschrieben. Es gibt im gesamten src/ keinen 'storage'-Event-Listener (grep bestätigt). Szenario PWA-typisch: installierte PWA-Instanz und Browser-Tab gleichzeitig offen (oder zwei Tabs). Tab A trägt Temperatur+Periode ein → LocalStorage aktualisiert. Tab B hält noch den alten Snapshot im React-State; sobald in Tab B irgendetwas geändert wird (oder dessen Persist-Effekt feuert), wird das KOMPLETTE Objekt aus Tab Bs veraltetem State geschrieben — alle Eingaben aus Tab A sind weg. Da die Rotation-Backups bei jedem Persist mitrotieren, sind sie kurz darauf ebenfalls überschrieben.

**Beleg:** `CycleContext.tsx:35 `const stored = localStorage.getItem(STORAGE_KEY)` nur im Mount-Effekt; Z.58 `localStorage.setItem(STORAGE_KEY, JSON.stringify(data))` schreibt das Gesamtobjekt. `grep -rn "addEventListener('storage'" src/` → keine Treffer.`

**Fix:** window.addEventListener('storage', …) registrieren und bei Fremdänderung den State neu laden bzw. mergen; alternativ vor jedem setItem den aktuellen Storage-Stand lesen und auf Entry-Ebene mergen (oder BroadcastChannel/Web Locks für Tab-Koordination nutzen).

## [13] HIGH · data · Persist ohne try/catch: QuotaExceededError crasht die App; ErrorBoundary bietet localStorage.clear() ohne Bestätigung

**Datei:** `src/components/CycleContext.tsx:58`

localStorage.setItem im Persist-Effekt ist ungeschützt (rotateLocalBackup hat try/catch, der Haupt-Save nicht; ebenso ungeschützt: assistant/page.tsx:123 Chat-Save). Da Main-Daten + backup_1 + backup_2 jeweils Vollkopien sind, liegt der Storage-Bedarf beim ~3-fachen der Datenmenge — QuotaExceeded ist bei jahrelanger Nutzung plus Chat-Verlauf realistisch. Ein Throw im useEffect propagiert in React zur ErrorBoundary: die gesamte App unmountet bei jeder Eingabe, ungespeicherte Änderungen gehen verloren. Die ErrorBoundary bietet dann als dritten Button 'Daten löschen & neu starten' an, der OHNE jede Rückfrage localStorage.clear() ausführt — das löscht nicht nur cycletrack_data, sondern auch beide Rotation-Backups, den Gemini-Key, den Gist-TOKEN und die Gist-ID. Da es in den Einstellungen keine Möglichkeit gibt, eine Gist-ID manuell einzugeben (handleSaveToken setzt nur den Token, restoreFromGist verlangt token UND gistId), ist das Cloud-Backup danach aus der App heraus unerreichbar; der nächste Auto-Sync legt ein neues, leeres Gist an und verwaist das alte.

**Beleg:** `CycleContext.tsx:58: `localStorage.setItem(STORAGE_KEY, JSON.stringify(data));` ohne try/catch. ErrorBoundary.tsx:60-63: `onClick={() => { localStorage.clear(); window.location.reload(); }}` ohne Confirm. backup.ts:250: `if (!token || !gistId) return { data: null, error: … }`; settings/page.tsx:171:`

**Fix:** setItem in try/catch wrappen und bei Quota-Fehler einen Toast + Export-Aufforderung zeigen statt zu crashen. Den Lösch-Button der ErrorBoundary mit window.confirm absichern und vor dem clear() einen automatischen JSON-Export auslösen. Gist-ID-Eingabefeld in den Einstellungen ergänzen, damit ein bestehendes Cloud-Backup nach einem Reset wieder verbunden werden kann.

## [14] HIGH · logic · addDays: Off-by-one über DST-Umstellung (UTC-Parsing + lokales setDate + UTC-toISOString)

**Datei:** `src/lib/cycle-calculations.ts:18`

addDays parst 'YYYY-MM-DD' als UTC-Mitternacht, mutiert dann mit lokalem setDate/getDate (erhält die lokale Uhrzeit) und konvertiert mit toISOString zurück nach UTC. Kreuzt der Zeitraum die Sommerzeit-Umstellung (Europa: Ende März), ist das Ergebnis einen Tag zu früh. Empirisch verifiziert mit Node: TZ=Europe/Berlin → addDays('2026-03-25', 7) = '2026-03-31' (erwartet '2026-04-01'); addDays('2026-03-28', 28) = '2026-04-24' (erwartet '2026-04-25'); TZ=America/Halifax → addDays('2026-03-01', 60) = '2026-04-29' (erwartet '2026-04-30'). Betroffen: nextPeriodPred, ovulationPred, predictFuture (6 Zukunftszyklen — kreuzen die Umstellung fast immer) sowie identischer Code in src/lib/history-utils.ts:41 (dort verschiebt es zusätzlich das Tagesraster der Historie: entriesMap[iso]-Lookups treffen den falschen Tag, Perioden-/Eisprung-Marker rutschen um einen Tag, ein Datum kann doppelt erzeugt werden). Für eine NFP-App ist ein um einen Tag falsches fruchtbares Fenster ein Kernfehler.

**Beleg:** `function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);        // UTC-Mitternacht
    d.setDate(d.getDate() + days);      // LOKALE Mutation
    return d.toISOString().split('T')[0]; // zurück nach UTC
}`

**Fix:** Konsequent in UTC rechnen: d.setUTCDate(d.getUTCDate() + days). Gleiche Korrektur in history-utils.ts addDays. Alternativ eine gemeinsame Datums-Helper-Datei mit UTC-only-Arithmetik für alle 'YYYY-MM-DD'-Operationen.

## [15] HIGH · logic · Backup-Restore (Cloud + lokal) merged statt zu ersetzen — Wiederherstellung kann fehlerhafte Einträge nicht entfernen

**Datei:** `src/components/CycleContext.tsx:104`

handleCloudRestore und handleRestoreLocalBackup (src/app/settings/page.tsx:192, 204) laufen über importData(), das entries per Spread MERGED: { ...prev.entries, ...result.data.entries }. Ein Restore eines älteren Backups entfernt also niemals Einträge, die nach dem Backup hinzukamen. Konkretes Szenario: Nutzerin importiert versehentlich eine falsche Femometer-CSV (hunderte falsche Einträge) und will per 'Aus Cloud wiederherstellen' zurück zum gestrigen Stand — der Toast meldet 'Daten aus Cloud wiederhergestellt!', aber alle falschen Einträge bleiben erhalten. Die einzige Rollback-Funktion der App erfüllt ihre Restore-Semantik nicht.

**Beleg:** `const importData = useCallback((jsonData: string) => {
    ...
    setData(prev => ({ ...prev, ...result.data, entries: { ...prev.entries, ...result.data.entries } }));
}, []);
// settings/page.tsx:192: importData(JSON.stringify(result.data)); // 'Daten aus Cloud wiederhergestellt!'`

**Fix:** Restore vom Import trennen: eine replaceAllData(data)-Funktion, die entries vollständig ersetzt (setData({ ...DEFAULT_CYCLE_DATA, ...validated })), und diese in handleCloudRestore/handleRestoreLocalBackup verwenden. importData (Datei-Import) kann weiter mergen, sollte das dem Nutzer aber anzeigen.

## [16] HIGH · react · Temperatur-Eingabe als controlled input verschluckt Dezimaltrennzeichen — Dezimalwerte nicht eintippbar

**Datei:** `src/components/entry/EntryDrawer.tsx:196`

Das Temperaturfeld ist ein controlled input, dessen onChange sofort parseFloat anwendet und dessen value aus der geparsten Zahl zurückgerendert wird. Tippt die Nutzerin '36.' wird parseFloat('36.') zu 36, der Re-Render setzt das Feld auf '36' und der Punkt verschwindet — die nächste Ziffer ergibt '365' statt '36.5'. Mit inputMode="decimal" liefert die deutsche Mobiltastatur zudem ein Komma ('36,5' → parseFloat = 36, gleicher Effekt). Die Basaltemperatur ist das Kernfeature der NFP-Auswertung; per Tastatur sind Dezimalwerte faktisch nicht eingebbar, nur die ±0.05-Buttons funktionieren. Falsche ganzzahlige Werte (365) können unbemerkt gespeichert werden und korrumpieren Coverline/Ovulationserkennung. Dasselbe Muster existiert in src/app/entry/page.tsx:66-67 (Legacy-Seite).

**Beleg:** `<input type="text" inputMode="decimal" value={entry.temperature || ''} onChange={(e) => setEntry(prev => ({ ...prev, temperature: e.target.value ? parseFloat(e.target.value) : null }))} ...`

**Fix:** Eingabe als String-State führen (z.B. const [tempText, setTempText]), Komma zu Punkt normalisieren, erst beim Speichern/Blur parsen und validieren (Bereich 35.0–38.5). Beim Öffnen des Drawers tempText aus entry.temperature initialisieren.

## [17] HIGH · react · Persist-Effekt rotiert Backups bei jedem App-Start und jedem Keystroke — 2-Slot-Backup-Sicherheitsnetz wirkungslos

**Datei:** `src/components/CycleContext.tsx:52`

Der isInitialLoad-Ref-Guard verfehlt sein Ziel: Beim Mount läuft der Persist-Effekt zuerst mit DEFAULT-Daten (verbraucht den Ref), danach setzt der Load-Effekt die gespeicherten Daten → der Persist-Effekt läuft erneut und ruft rotateLocalBackup(data) auf. Folge: Bei JEDEM App-Start wird backup2 mit backup1 (= aktuellem Stand) überschrieben. Zusätzlich rotiert jedes einzelne Daten-Update (auch jeder Keystroke in den Settings-Inputs, siehe separater Fund) die Slots. Konkretes Datenverlust-Szenario: Nutzerin löscht versehentlich alle Daten (clearAllData) → backup1 = leer, backup2 = letzter guter Stand. Beim nächsten App-Start (oder nächsten Eintrag) wird backup2 ebenfalls mit dem leeren Stand überschrieben — der gute Stand ist unwiederbringlich weg, genau in dem Moment, wo das Backup gebraucht würde. Außerdem wird debouncedCloudSync bei jedem Start ausgelöst (unnötiger Gist-Write nach 60s ohne Änderung).

**Beleg:** `useEffect(() => { if (isInitialLoad.current) { isInitialLoad.current = false; return; } if (!isLoaded) return; localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); rotateLocalBackup(data); debouncedCloudSync(data); }, [data, isLoaded]); — rotateLocalBackup (backup.ts:20) verschiebt bedingungslos`

**Fix:** rotateLocalBackup nur rotieren lassen, wenn backup1 älter als ein Zeitfenster ist (z.B. 6–24h, Timestamp im Slot prüfen), statt bei jedem Aufruf. Zusätzlich im Provider den initialen Persist sauber unterbinden, z.B. Persist-Effekt erst ausführen, wenn isLoaded true ist UND sich data gegenüber dem geladenen Snapshot (Ref auf geladene Daten) tatsächlich geändert hat.

## [18] MEDIUM · a11y · muted-foreground auf background/muted verfehlt WCAG AA (4.31:1 / 4.00:1)

**Datei:** `src/app/globals.css:86-87`

--muted-foreground #7B7388 erreicht auf --background #FFF8F9 nur 4.31:1 und auf --muted #F5F0EE nur 4.00:1 (AA: 4.5:1). Die Farbe wird flächendeckend für sekundäre Texte in text-xs/text-sm und sogar text-[10px] genutzt (StatCards, Beschriftungen im EntryDrawer, Legenden, Hinweistexte). Nur auf weißen Cards (4.52:1) wird AA knapp erreicht. Dark-Mode ist in Ordnung (6.09:1).

**Beleg:** `--muted-foreground: #7B7388; auf --background: #FFF8F9 → 4.31:1; auf --muted: #F5F0EE → 4.00:1`

**Fix:** --muted-foreground im Light-Mode auf ca. #6E6680 oder dunkler setzen, damit auch auf --muted ≥4.5:1 erreicht wird.

## [19] MEDIUM · a11y · CollapsibleSection: kein aria-expanded, eingeklappter Inhalt bleibt per Tab erreichbar

**Datei:** `src/components/entry/EntryDrawer.tsx:36-59`

Der Aufklapp-Button hat kein aria-expanded und keine aria-controls-Verknüpfung. Schwerwiegender: Das motion.div animiert nur height auf 0 mit overflow-hidden — die enthaltenen Buttons/Textareas bleiben im DOM fokussierbar. Tastatur-Nutzer tabben durch unsichtbare Controls aller vier zugeklappten Sektionen (Blutung, Fruchtbarkeitszeichen, Wohlbefinden, GV & Notizen); der Fokus verschwindet visuell komplett (Fokus-Falle im Sinne von WCAG 2.4.3/2.4.7).

**Beleg:** `<motion.div initial={false} animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }} ... className="overflow-hidden"> — kein inert, kein display:none, kein visibility:hidden bei isOpen=false; Button ohne aria-expanded`

**Fix:** aria-expanded={isOpen} und aria-controls auf den Button; auf dem Inhalts-Container inert={!isOpen} (oder visibility:hidden nach Animationsende via onAnimationComplete) setzen.

## [20] MEDIUM · a11y · Datei-Import nur per Maus bedienbar (unsichtbares Input über dekorativem Button)

**Datei:** `src/app/settings/page.tsx:389-401`

"Wiederherstellen" (Z.389-401) und "CSV Datei auswählen" (Z.448-458) legen ein input[type=file] mit opacity-0 über einen Button ohne onClick. Per Maus trifft der Klick das Input, per Tastatur ist der sichtbare Button ein toter Tab-Stopp (Enter tut nichts) und das eigentliche Input erhält Fokus, ist aber unsichtbar — kein sichtbarer Fokusindikator (WCAG 2.4.7), Backup-Restore und CSV-Import sind per Tastatur faktisch nicht auffindbar. Die Inputs haben zudem kein Label/aria-label.

**Beleg:** `<Button variant="outline" className="w-full gap-2"><Upload .../>Wiederherstellen</Button><input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="absolute inset-0 opacity-0 cursor-pointer" />`

**Fix:** Pattern umdrehen: sichtbarer Button mit onClick={() => fileInputRef.current?.click()} und verstecktes Input mit className="sr-only" + aria-label (z.B. "Backup-Datei auswählen"); alternativ <label>-Element um das Input stylen.

## [21] MEDIUM · a11y · outline-none ohne Ersatz-Fokusindikator auf Eingabefeldern

**Datei:** `src/components/entry/EntryDrawer.tsx:201`

Drei Eingabefelder entfernen den Browser-Fokusring per outline-none ohne jeden Ersatz: das Temperatur-Eingabefeld im EntryDrawer (Z.201), das Chat-Eingabefeld (src/app/assistant/page.tsx:373) und die Gedächtnis-Textarea (src/app/assistant/page.tsx:397). Tastatur-Nutzer sehen nicht, wo der Fokus steht (WCAG 2.4.7). (Die Notizen-Textarea Z.357 hat immerhin focus:ring-2 als Ersatz.)

**Beleg:** `className={`text-3xl font-bold text-center w-28 bg-transparent outline-none ...`} — kein focus:/focus-visible:-Stil vorhanden`

**Fix:** focus-visible:ring-2 focus-visible:ring-ring (bzw. outline-Stil) ergänzen, analog zu den shadcn-Inputs.

## [22] MEDIUM · a11y · Formularfelder ohne programmatische Label-Zuordnung im EntryDrawer und Assistant

**Datei:** `src/components/entry/EntryDrawer.tsx:167-172`

Das Datums-Input im Drawer-Header (Z.167-172) hat weder Label noch aria-label. Das Temperatur-Input (Z.195-202) hat zwar visuell ein <Label>Temperatur</Label> (Z.183), aber ohne htmlFor/id-Verknüpfung — Accessible Name ist nur der Placeholder "36.50". Gleiches bei der Notizen-Textarea (Z.354-360, Label Z.353 ohne htmlFor) und der Gedächtnis-Textarea im Sheet (src/app/assistant/page.tsx:394-398, gar kein Label). Screenreader können den Zweck der Felder nicht benennen (WCAG 1.3.1/3.3.2).

**Beleg:** `<Input type="date" value={date} onChange={...} className="w-auto text-xs h-8 px-2 rounded-lg" /> — kein label/aria-label; <Label className="font-serif font-semibold text-sm">Temperatur</Label> ohne htmlFor`

**Fix:** id/htmlFor-Paare ergänzen (z.B. id="entry-date" + aria-label="Datum des Eintrags"; id="temperature" am Input, htmlFor am Label; id="notes"; aria-label="Gedächtnis bearbeiten" auf der Sheet-Textarea).

## [23] MEDIUM · a11y · Onboarding-Slider ohne zugänglichen Namen

**Datei:** `src/components/onboarding/OnboardingWizard.tsx:122-129`

Die beiden Radix-Slider für Zykluslänge (Z.122-129) und Periodendauer (Z.154-161) haben kein aria-label und keine Label-Verknüpfung. Der Thumb bekommt role="slider" mit Wert, aber ohne Namen — Screenreader melden nur "Schieberegler 28" ohne Kontext, und das in einem Pflicht-Dialog, der weder per Escape noch Outside-Click verlassen werden kann (Z.87).

**Beleg:** `<Slider value={[cycleLength]} onValueChange={(v) => setCycleLength(v[0])} min={21} max={45} step={1} className="w-full" /> — kein aria-label`

**Fix:** aria-label="Durchschnittliche Zykluslänge in Tagen" bzw. "Periodendauer in Tagen" auf die Slider setzen (Radix Slider.Thumb akzeptiert aria-label via Prop-Durchreichung oder direkt im ui/slider.tsx als Prop exponieren).

## [24] MEDIUM · a11y · Button in Link verschachtelt (ungültige Interaktiv-Verschachtelung) im Header

**Datei:** `src/components/layout/Layout.tsx:48-57`

Die Header-Icons für KI-Assistent und Einstellungen rendern <Link><Button>…</Button></Link> → <a> mit verschachteltem <button>. Das ist invalides HTML und erzeugt zwei Tab-Stopps pro Ziel; Screenreader melden widersprüchliche Rollen (Link enthält Schaltfläche). Außerdem trägt das aria-label nur der innere Button, nicht der Link.

**Beleg:** `<Link href="/assistant"><Button aria-label="KI-Assistent" variant="ghost" size="icon" ...><Sparkles .../></Button></Link>`

**Fix:** Button mit asChild verwenden: <Button asChild variant="ghost" size="icon" aria-label="…"><Link href="/assistant"><Sparkles/></Link></Button>, sodass nur ein <a>-Element gerendert wird.

## [25] MEDIUM · a11y · Touch-Targets deutlich unter 44px (teils nur 24px)

**Datei:** `src/app/assistant/page.tsx:298-304`

Mehrere häufig genutzte Bedienelemente unterschreiten die 44px-Empfehlung deutlich: Gedächtnis- und Chat-löschen-Buttons im Assistant-Header sind nur ~24px (p-1 + 16px-Icon, Z.298-304) — das tangiert sogar das WCAG-2.2-Minimum von 24px; der Senden-Button ist 32px (w-8 h-8, Z.378); die Symptom-Chips im EntryDrawer ~28px hoch (px-3 py-1.5 text-xs, src/components/entry/EntryDrawer.tsx:325-331); LH-/Zervix-Chips ~36px (px-4 py-2 text-sm, Z.277-301).

**Beleg:** `<button onClick={openMemory} className="text-muted-foreground hover:text-foreground p-1" ...><BookOpen className="w-4 h-4" /></button> → 24×24px`

**Fix:** Mindestens 44×44px Trefferfläche herstellen, z.B. p-2.5 + w-5 h-5 Icons für die Header-Buttons, w-11 h-11 für den Senden-Button, py-2.5/min-h-[44px] für die Chips (visuelle Größe kann via innerem Element kleiner bleiben).

## [26] MEDIUM · a11y · KI-Chat-Antworten ohne aria-live — Streaming für Screenreader stumm

**Datei:** `src/app/assistant/page.tsx:316-345`

Der Nachrichtenbereich des Chats hat keine Live-Region. Eintreffende bzw. streamende Antworten von Clara werden Screenreader-Nutzerinnen nicht angekündigt; sie erfahren nie, dass/wann eine Antwort vorliegt. Auch der Lade-Status ("Analysiere deine Daten..." in AiSummaryCard, src/components/dashboard/AiSummaryCard.tsx:96-102) ist nicht als Status markiert.

**Beleg:** `<div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide"> — kein aria-live/role="log"`

**Fix:** Auf den Nachrichten-Container role="log" + aria-live="polite" setzen (Ankündigung erst nach Streaming-Ende, z.B. separate visually-hidden Live-Region, die die fertige Antwort einmalig erhält); Ladeindikatoren mit role="status" versehen.

## [27] MEDIUM · data · Geladene LocalStorage-Daten werden nie zod-validiert — semantisch korrupte Einträge führen zu Crash-Loop beim Start

**Datei:** `src/components/CycleContext.tsx:38-43`

validateImportData (zod) wird nur bei Datei-Import und Gist-Restore benutzt. Der Haupt-Ladepfad spreaded das geparste Objekt ungeprüft in den State: `{...DEFAULT_CYCLE_DATA, ...parsed, entries: parsed.entries || {}}`. Strukturell falsche Werte (temperature als String, entries-Werte null, date fehlt, period mit unbekanntem Wert) landen direkt in runEngine/groupCycles, die u.a. `e.temperature`, `new Date(a.date).getTime()` und Sortierungen darauf ausführen. Wirft die Engine, rendert die ErrorBoundary bei JEDEM App-Start erneut (der korrupte Wert bleibt ja im Storage) — die einzige angebotene Auswege sind Reload (crasht wieder) oder 'Daten löschen'. Die Schemas selbst decken zwar alle CycleEntry-Felder aus types.ts ab (date, temperature, excludeTemp, period, pain, cervix, lhTest, sex, symptoms, mood, notes, isOvulation), werden hier aber schlicht nicht angewendet. Außerdem prüft validateImportData nicht, dass der Record-Key dem entry.date entspricht (schemas.ts:68-71 `cleanEntries[key] = result.data`); Engine und groupCycles mischen aber Key-Lookups (`entries[todayStr]`, `entriesMap[iso]`) mit Object.values(...).sort(by date) — bei Key≠date-Importen werden Einträge in Statistiken gezählt, sind aber in der Tages-/Chartansicht unsichtbar (inkonsistente Daten).

**Beleg:** `CycleContext.tsx:38-43: `const parsed = JSON.parse(stored); setData({ ...DEFAULT_CYCLE_DATA, ...parsed, entries: parsed.entries || {} });` — kein safeParse. cycle-calculations.ts:216 `entries[todayStr]` vs. Z.44 `Object.values(entries).sort(...)`; history-utils.ts:121 `entriesMap[iso]` vs. Z.49 `Obj`

**Fix:** Beim Laden CycleEntrySchema.safeParse pro Eintrag anwenden (lenient: ungültige Einträge in einen Quarantäne-Key verschieben statt verwerfen) und in validateImportData erzwingen, dass key === value.date (sonst auf value.date umschlüsseln).

## [28] MEDIUM · data · Cloud-/Backup-Restore ohne Bestätigungsdialog; Import setzt Nutzer-Einstellungen still auf zod-Defaults zurück

**Datei:** `src/app/settings/page.tsx:187-209`

handleCloudRestore und handleRestoreLocalBackup führen den Restore sofort beim Klick aus — anders als 'Alle Daten löschen' gibt es keinen AlertDialog. Ein Fehlklick auf 'Aus Cloud' mit einem alten Gist überschreibt sofort gleich-datierte Einträge und alle Einstellungen. Zweites Problem: importData spreaded `...result.data` in den State, und CycleDataSchema vergibt Defaults (`cycleLength .default(28)`, `periodLength .default(5)`, `lutealPhase .default(14)`). Importiert man eine JSON-Datei, die nur `{entries: {...}}` enthält (z.B. handgebaut oder aus Drittquelle), werden individuell eingestellte Zyklus-/Perioden-/Lutealwerte kommentarlos auf 28/5/14 zurückgesetzt. Zudem verwirft restoreFromGist die Validierungs-Warnings komplett (backup.ts:265-269 gibt nur data zurück) — beim Cloud-Restore still übersprungene (ungültige) Einträge werden der Nutzerin nie angezeigt.

**Beleg:** `settings/page.tsx:187-197 `handleCloudRestore` und 199-209 `handleRestoreLocalBackup` ohne AlertDialog. CycleContext.tsx:104: `setData(prev => ({ ...prev, ...result.data, entries: { ...prev.entries, ...result.data.entries } }))` — result.data enthält durch schemas.ts:29-31 immer cycleLength/periodLe`

**Fix:** Restore-Buttons in AlertDialogs mit Vorschau (Entry-Anzahl, Zeitstempel des Backups) wrappen. In importData Settings nur übernehmen, wenn sie im Quellobjekt tatsächlich vorhanden waren (raw-Check statt zod-Defaults), und Warnings aus restoreFromGist bis zur UI durchreichen.

## [29] MEDIUM · data · Femometer-CSV-Import umgeht die zod-Validierung und ersetzt bestehende Einträge gleichen Datums vollständig

**Datei:** `src/lib/importer.ts:42-52`

parseFemometerCSV baut CycleEntry-Objekte direkt und wird via setAllEntries ohne Schema-Validierung persistiert. Konkrete Korruptionsvektoren: (1) Temperatur wird nur per parseFloat geprüft — ein Fahrenheit-Export ('97.7°F' → 97.7) oder Messfehler landet ungebremst im Datensatz, obwohl das Schema 34-42°C verlangt; die Coverline-/Eisprungberechnung wird dadurch unbrauchbar. (2) Das Datum wird nur per Regex geprüft — '31.02.2025' wird zu '2025-02-31' und passiert /^\d{4}-\d{2}-\d{2}$/. (3) setAllEntries merged per Spread auf Entry-Ebene: ein bereits manuell gepflegter Eintrag desselben Datums (Notizen, Stimmung, Symptome) wird komplett durch den schmaleren CSV-Eintrag ERSETZT, ohne Warnung. Folgeschaden: Beim nächsten Gist-Restore werden die schema-ungültigen CSV-Einträge (z.B. Temp 97.7) von validateImportData still übersprungen — d.h. die per CSV importierten Daten verschwinden beim Restore lautlos.

**Beleg:** `importer.ts:50-52: `const t = parseFloat(tempStr.replace('°C','')…); if (!isNaN(t)) entry.temperature = t;` — keine Bereichsprüfung. importer.ts:42-45: `const isoDate = `${y}-${m}-${d}`; if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) continue;` — keine Kalender-Validierung. settings/page.tsx:136 `setAllE`

**Fix:** CSV-Ergebnis vor dem Persistieren durch CycleEntrySchema.safeParse schicken (gleiches lenient-Verfahren wie JSON-Import, mit Warnungs-Toast), Datums-Plausibilität via Date-Roundtrip prüfen und bei Datums-Kollisionen feldweise mergen (vorhandene manuelle Felder behalten) statt zu ersetzen.

## [30] MEDIUM · data · Cloud-Backup ist entgegen der Spezifikation unverschlüsselt (Klartext-Gesundheitsdaten im GitHub-Gist)

**Datei:** `src/lib/backup.ts:187`

Die App-Beschreibung nennt 'Backups … verschlüsselt via GitHub Gist'. Tatsächlich serialisiert syncToGist die kompletten Zyklusdaten (Temperaturen, Periode, Sex, Stimmungen, Notizen) als Klartext-JSON und lädt sie in ein 'privates' Gist hoch. Private Gists sind nur unaufgelistet — jeder mit der URL und jeder mit dem Token (der selbst im Klartext in LocalStorage liegt, GIST_TOKEN_KEY) kann die sensiblen Gesundheitsdaten lesen und manipulieren. Integritätsaspekt: manipulierte Gist-Inhalte werden beim Restore zwar zod-validiert, aber gezielt veränderte gültige Werte (z.B. verfälschte Temperaturen) sind nicht erkennbar (keine Signatur/MAC).

**Beleg:** `backup.ts:187: `const content = JSON.stringify(data, null, 2);` — keinerlei Verschlüsselung vor dem Upload (Z.199-202 bzw. 226-230 senden content direkt an api.github.com).`

**Fix:** Vor dem Upload mit WebCrypto verschlüsseln (AES-GCM, Key per PBKDF2/Argon2 aus einer Nutzer-Passphrase abgeleitet, Salt+IV im Payload); beim Restore entschlüsseln und erst dann validateImportData anwenden. Alternativ die Beschreibung/UI korrigieren, solange keine Verschlüsselung existiert.

## [31] MEDIUM · data · PDF-Export weicht vom Datenmodell ab: ignoriert BBT-bestätigten Eisprung und manuelle isOvulation-Flags

**Datei:** `src/components/history/PDFExportButton.tsx:36-60`

Der PDF-Bericht (gedacht u.a. für Arztbesuche) zieht 'Eisprung' und 'Lutealphase' aus CycleGroup.days, das in groupCycles per Heuristik gefüllt wird: erster LH-Test 'positive' ODER 'peak' + 1 Tag, sonst Fallback Zykluslänge−14. Das Engine-Datenmodell (cycle-calculations.ts) bestimmt den Eisprung dagegen über die Basaltemperatur-Bestätigung (confirmOvulationBBT → ovulationConfirmedDate, coverline), und genau das zeigt die Chart-Seite an ('Eisprung bestätigt', chart/page.tsx:333-334, 411). Das manuelle Override-Feld CycleEntry.isOvulation wird von groupCycles und damit vom PDF komplett ignoriert. Konsequenz: Der exportierte Bericht kann einen anderen Eisprungtag und eine andere Lutealphasenlänge ausweisen als die in der App als 'bestätigt' angezeigten Werte — bei einem Gesundheitsdokument eine echte Datenintegritäts-Diskrepanz. Zusätzlich behandelt die Heuristik bereits den ERSTEN 'positive' LH-Test wie einen Peak (history-utils.ts:85), obwohl die Engine positive/peak unterscheidet.

**Beleg:** `PDFExportButton.tsx:37: `const ovuDay = c.days.find((d: any) => d.isOvulation);` + Lutealphase aus ovuIndex. history-utils.ts:85-92: `if (entry?.lhTest === 'peak' || entry?.lhTest === 'positive') { … ovuDayIndex = i + 1; }` und Z.98-116 Fallback `length - 14 - 1` — kein Zugriff auf ovulationConfirme`

**Fix:** groupCycles (oder den PDF-Export direkt) um die Engine-Daten erweitern: pro Zyklus zuerst entry.isOvulation (manueller Override), dann BBT-bestätigtes Datum, erst danach die LH-/Längen-Heuristik verwenden — und im PDF kennzeichnen, ob der Eisprung 'bestätigt (BBT)' oder 'geschätzt' ist, analog zur Chart-Seite.

## [32] MEDIUM · logic · FERTILE_MID-Fenster um einen Tag verschoben: 1-basierter Zyklustag mit 0-basiertem Ovulations-Offset verglichen

**Datei:** `src/lib/cycle-calculations.ts:240`

daysSinceStart ist 1-basiert (Starttag = 1), estOvu ist aber ein 0-basierter Tages-Offset: Die eigene Prognose setzt ovDateMid = addDays(currentStart, estOvu), d.h. Eisprung liegt auf Zyklustag estOvu+1. Die Bedingung daysSinceStart in [estOvu−5, estOvu+1] ergibt damit die Tage [Ovu−6, Ovu] statt des kommentierten Fensters [Ovu−5, Ovu+1]. Konkret (CL=28, LL=14, estOvu=14): FERTILE_MID gilt für Zyklustage 9–15, prognostizierter Eisprung ist Tag 15 → Tag 9 (Ovu−6) wird fälschlich als fruchtbar (Level 2) markiert, Tag 16 (Ovu+1, laut eigener Definition noch fruchtbar) fällt aus FERTILE_MID heraus und bekommt über den Fallback in runEngine (Z. 434–441, dort korrekt dDiff ∈ [−5, +1] relativ zu oMid) nur Level 1. Zustand und Prognose widersprechen sich um genau einen Tag.

**Beleg:** `const daysSinceStart = diffDays(todayStr, currentStart) + 1; // 1-basiert
...
const estOvu = stats.medianCycleLength - stats.medianLutealLength;
// Fertile: Ovu - 5 to Ovu + 1
if (daysSinceStart >= estOvu - 5 && daysSinceStart <= estOvu + 1) { state = 'FERTILE_MID'; }
// aber: ovDateMid = addDays(cu`

**Fix:** Auf dieselbe Basis bringen: if (daysSinceStart >= estOvu - 4 && daysSinceStart <= estOvu + 2) — oder sauberer: const dDiff = diffDays(todayStr, addDays(currentStart, estOvu)); if (dDiff >= -5 && dDiff <= 1) state = 'FERTILE_MID'; (identisch zur Fallback-Logik in runEngine).

## [33] MEDIUM · logic · BBT 3-über-6-Regel arbeitet auf Mess-Indizes statt auf aufeinanderfolgenden Tagen

**Datei:** `src/lib/cycle-calculations.ts:157`

confirmOvulationBBT filtert nur vorhandene Temperaturen (validTemps) und wendet das Sliding Window auf Array-Indizes an. Bei Messlücken sind 'prev6' und 'next3' nicht 6 bzw. 3 aufeinanderfolgende TAGE, sondern beliebig weit auseinanderliegende Messungen. Konkretes Szenario: Temperaturen nur Mo/Mi/Fr gemessen — die '3 hohen Werte' können sich über eine Woche verteilen; die NFP-Regel verlangt aber 3 konsekutive Tage über der Coverline. Zusätzlich wird das Ovulationsdatum als addDays(validTemps[i].date, -1) gesetzt: Liegt zwischen letzter tiefer und erster hoher Messung eine Lücke (z.B. Messungen an ZT 10 und 14, Anstieg real an ZT 12), wird der Eisprung auf ZT 13 datiert und damit um Tage verfehlt — das verschiebt nextPeriodPred (bbt.date + Lutealphase) und die retrospektive Lutealphasen-Statistik in analyzeHistory gleich mit.

**Beleg:** `const validTemps = cycleEntries.filter(e => e.temperature && !e.excludeTemp);
...
for (let i = 6; i < validTemps.length - 2; i++) {
    const prev6 = validTemps.slice(i - 6, i);
    const next3 = validTemps.slice(i, i + 3);
    ...
    date: addDays(validTemps[i].date, -1), // Ovulation is day befor`

**Fix:** Vor Anwendung der Regel prüfen, dass next3 (und idealerweise prev6) auf aufeinanderfolgenden Kalendertagen liegen (diffDays(next3[2].date, next3[0].date) === 2), bzw. maximal kleine Lücken erlauben und die Konfidenz herabstufen. Bei Lücke vor dem ersten Hochwert das Ovulationsdatum als Bereich statt Punktdatum behandeln.

## [34] MEDIUM · logic · Historie: Eisprung-Fallback um einen Tag falsch und wird auch auf den laufenden Zyklus angewandt (wandernder Eisprung-Marker)

**Datei:** `src/lib/history-utils.ts:115`

Zwei Probleme in groupCycles/finishCycle: (1) Der Fallback setzt ovuDayIndex = length − 14 − 1. Für einen abgeschlossenen 28-Tage-Zyklus markiert das Index 13 (Zyklustag 14), während die Engine den Eisprung auf start + (CL − LL) = Index 14 (Zyklustag 15) legt — Historie und Dashboard/Prognose widersprechen sich um einen Tag, das fruchtbare Fenster im Kalender ist entsprechend mitverschoben. Standardkonvention 'Eisprung ≈ 14 Tage vor nächstem Periodenstart' ergäbe ebenfalls Index length−14. (2) Der Fallback greift bei length >= 20 auch für den LAUFENDEN Zyklus, wo length = (heute − Start + 1) ist: Ein 'Eisprung'-Marker erscheint immer 15 Tage vor HEUTE und wandert jeden Tag einen Tag weiter — bei einem laufenden 35-Tage-Zyklus zeigt die Historie eine frei erfundene, täglich wechselnde Ovulation samt Fruchtbarkeitsfenster. Zusätzlich nutzt die LH-Regel hier den ERSTEN positiven Test +1 (Z. 85–94), die Engine den LETZTEN Peak +1 — bei 'positive' am ZT 13 und 'peak' am ZT 14 zeigt die Historie Eisprung ZT 14, die Engine prognostiziert ZT 15.

**Beleg:** `if (ovuDayIndex === -1 && length >= 20) {
    ...
    ovuDayIndex = length - 14 - 1;
}
// finishCycle(undefined, undefined) für den laufenden Zyklus: length = diffDays(today, currentStart) + 1`

**Fix:** Fallback nur für abgeschlossene Zyklen anwenden (nextStart vorhanden) und auf ovuDayIndex = length − 14 korrigieren (konsistent zur Engine: start + CL − LL). Für die LH-Regel die gleiche Konvention wie die Engine verwenden (letzter Peak + 1).

## [35] MEDIUM · logic · UTC-"heute" statt lokalem Datum: KI-Kontext und Historie greifen abends/nachts auf den falschen Tag zu

**Datei:** `src/lib/llm-context.ts:97`

Die Engine und alle Entry-Keys nutzen toLocalISO() (lokales Datum), aber llm-context.ts (Z. 48 in getRecentTemps und Z. 97 für 'today') sowie history-utils.ts:66 (Zykluslänge des laufenden Zyklus) verwenden new Date().toISOString().split('T')[0] — das UTC-Datum. Konkretes Szenario (Nutzerin in Kanada, UTC−3, E-Mail-Domain .ca): um 22:00 Ortszeit liefert toISOString bereits den morgigen Tag → 'heute' im LLM-Kontext ist falsch, temperaturHeute = entries['morgen'] existiert nicht (heutige Temperatur fehlt im Kontext), das 7/10-Tage-Temperaturfenster ist verschoben und der Zyklustag der Engine widerspricht dem 'heute' im selben Prompt. In Deutschland tritt der Fehler zwischen 00:00 und 01:00/02:00 Ortszeit auf (UTC-Datum = gestern). history-utils berechnet damit zudem die Länge des laufenden Zyklus um ±1 Tag falsch. Die App besitzt mit toLocalISO bereits genau dafür den richtigen Helper (Kommentar in utils.ts warnt explizit vor diesem Muster).

**Beleg:** `// llm-context.ts:97
const today = new Date().toISOString().split('T')[0];
// llm-context.ts:48
const iso = d.toISOString().split('T')[0];
// history-utils.ts:66
const today = new Date().toISOString().split('T')[0];`

**Fix:** Überall toLocalISO() aus src/lib/utils.ts verwenden: const today = toLocalISO(); bzw. const iso = toLocalISO(d);. Ebenso formatDateDE (llm-context.ts:92) auf timezonesicheres Parsing umstellen (new Date(iso + 'T12:00:00') oder Intl mit timeZone:'UTC'), sonst zeigt es westlich von UTC den Vortag an.

## [36] MEDIUM · logic · Patientenakte-Restrukturierung kann Memory dauerhaft kürzen: maxOutputTokens=400 bei Komplett-Ersetzung

**Datei:** `src/lib/ai-memory.ts:131`

restructureMemory ersetzt die komplette Patientenakte durch die Gemini-Antwort, generateSummary ist aber hart auf maxOutputTokens: 400 begrenzt (gemini-client.ts:144). Sobald die Akte länger als ~400 Tokens ist (nach einigen Wochen Nutzung normal), wird die Antwort mitten im Text abgeschnitten und der Guard 'result.text.length > 50' verhindert nichts — setMemory überschreibt die vollständige Akte mit der trunkierten Version. Da die Restrukturierung automatisch alle 10 Chats läuft, gehen gesundheitsrelevante Fakten (Medikamente, Vorerkrankungen, Kinderwunsch) still und unwiederbringlich verloren. Zusätzlich fragil: extractNewFacts prüft auf exakt 'KEINE' — antwortet das Modell 'KEINE.' o.ä., wird das als neuer Fakt in die Akte geschrieben.

**Beleg:** `// ai-memory.ts
if (result.text && result.text.length > 50) {
    setMemory(result.text.trim());
}
// gemini-client.ts generateSummary:
maxOutputTokens: 400`

**Fix:** Für die Restrukturierung ein deutlich höheres Token-Limit verwenden (Parameter an generateSummary) und vor setMemory prüfen, ob finishReason !== 'MAX_TOKENS' bzw. ob das Ergebnis nicht deutlich kürzer als das Original ist (z.B. < 50% Länge → verwerfen). KEINE-Check tolerant machen: /^keine\b/i auf den getrimmten Text.

## [37] MEDIUM · perf · Settings-Inputs feuern pro Tastendruck kompletten Engine-Rerun + 3-fache Volldaten-Serialisierung

**Datei:** `src/app/settings/page.tsx:279`

Die Number-Inputs für Zyklus-/Periodenlänge rufen bei jedem Tastendruck updateSettings() auf. Das erzeugt ein neues data-Objekt im CycleContext, wodurch (1) der useMemo-Engine-Rerun (runEngine: Sortierung aller Einträge + pro Zyklus ein Filter über ALLE Einträge, O(Zyklen × Einträge) mit Date-Allokationen in jedem sort-Comparator, siehe cycle-calculations.ts:109-126) und (2) der Persist-Effekt in CycleContext.tsx:52-61 ausgelöst wird, der den gesamten Datenbestand synchron dreifach serialisiert (localStorage.setItem + rotateLocalBackup). Bei mehrjährigen Daten (~1000 Einträge, 150-300 KB JSON) sind das pro Tastendruck mehrere hundert KB synchrone String-I/O plus zweistellige ms Engine-Rechenzeit auf dem Main-Thread — spürbare Input-Latenz auf Mobilgeräten. Zusätzlich re-rendern alle Context-Konsumenten (Settings-Seite, EntryDrawer im Layout, OnboardingWizard) pro Tastendruck.

**Beleg:** `settings/page.tsx:279: onChange={(e) => updateSettings({ cycleLength: parseInt(e.target.value) || 28 })} (analog :288 für periodLength). CycleContext.tsx:58-60: localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); rotateLocalBackup(data); debouncedCloudSync(data); — läuft bei jeder data-Änderung`

**Fix:** Inputs auf lokalen useState umstellen und erst bei onBlur/Enter committen, oder updateSettings mit ~300ms Debounce aufrufen. Zusätzlich engine-Memo von Settings-only-Änderungen entkoppeln ist nicht möglich (cycleLength beeinflusst Prognose), daher ist Commit-on-blur der richtige Fix.

## [38] MEDIUM · perf · framer-motion (37,4 KB gzip / 115 KB raw) liegt im Shared First-Load-Bundle jeder Route

**Datei:** `src/components/layout/Layout.tsx:10`

Build-verifiziert: Chunk 802-f26c50c472de85de.js (115.260 B raw, 37.447 B gzip) enthält framer-motion und wird in jeder Seiten-HTML referenziert (auch index.html), weil das Root-Layout (Layout.tsx, PageTransition.tsx) den vollen `motion`-Import nutzt. Das sind ~12% des gesamten First-Load JS (~306 KB gzip) — für eine PWA mit statischem Export zahlt jeder Erstaufruf Download + Parse/Eval dieses Chunks, obwohl nur einfache opacity/transform-Animationen (Nav-Indikator, Page-Fade, Stagger im Dashboard) genutzt werden. jspdf ist dagegen bereits korrekt dynamisch importiert (Klick-Chunk, 104 KB gz) und recharts korrekt route-gesplittet (nur /chart, 117,8 KB gz) — dort kein Handlungsbedarf im Hauptbundle.

**Beleg:** `Layout.tsx:10 / PageTransition.tsx:2 / Dashboard.tsx:3 / EntryDrawer.tsx:23 / history/page.tsx:4: import { motion } from 'framer-motion'. Build-Output: 802-f26c50c472de85de.js raw=115260 gzip=37447, enthält motion/AnimatePresence/MotionConfig-Marker und ist in out/index.html als Script jeder Route g`

**Fix:** Auf LazyMotion umstellen: einmal <LazyMotion features={domAnimation} strict> im Root-Layout, überall `m.div` statt `motion.div` — reduziert auf ~5-6 KB gz initial (features optional per dynamic import). Alternativ Nav-Indikator (layoutId) und PageTransition durch CSS-Transitions ersetzen; Einsparung ~25-30 KB gzip First Load.

## [39] MEDIUM · perf · KI-Chat: pro Streaming-Chunk Voll-Serialisierung des Chats in localStorage + Markdown-Re-Parse aller Nachrichten

**Datei:** `src/app/assistant/page.tsx:120`

Während des Token-Streamings wird setMessages pro Chunk aufgerufen (oft 10-50×/s). Dadurch läuft der Persist-Effekt (Zeile 120-125) bei JEDEM Chunk: er filtert, serialisiert ALLE abgeschlossenen Nachrichten per JSON.stringify und schreibt sie synchron in localStorage — obwohl sich die abgeschlossenen Nachrichten während des Streams gar nicht ändern. Zusätzlich rendert die Liste alle Nachrichten neu und renderMarkdown() (Zeile 338) parst pro Chunk das Markdown JEDER historischen Assistant-Nachricht erneut (split + Regex pro Zeile). Bei längerer Chat-Historie (unbegrenzt, da nie gekappt) führt das zu sichtbarem Ruckeln/Stottern während des Streamens auf Mobilgeräten.

**Beleg:** `assistant/page.tsx:120-125: useEffect(() => { const completed = messages.filter(m => !m.isStreaming); if (completed.length > 0) { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(completed)); } }, [messages]); — läuft pro Stream-Chunk, da messages bei jedem Chunk neu gesetzt wird (Zeile 162-166`

**Fix:** Persist nur ausführen, wenn kein Stream aktiv ist (if (messages.some(m => m.isStreaming)) return;) bzw. nur im onComplete-Callback speichern. Nachrichten-Bubble in eine React.memo-Komponente auslagern, damit renderMarkdown nur für die streamende Nachricht läuft. Chunk-Updates per requestAnimationFrame batchen statt pro Netzwerk-Chunk setState.

## [40] MEDIUM · pwa · UpdateNotification ist totes Code: 'waiting'-Event feuert wegen skipWaiting:true nie, und window.workbox existiert im Produktions-Build nicht

**Datei:** `src/components/UpdateNotification.tsx:18`

Der Update-Flow kann nie funktionieren — aus zwei unabhängigen Gründen: (1) next.config.ts setzt workboxOptions.skipWaiting: true, im generierten sw.js steht entsprechend self.skipWaiting() — ein neuer SW geht damit nie in den 'waiting'-Zustand, das workbox-window-Event 'waiting' (Zeile 18) feuert nie, der Update-Toast erscheint nie, und wb.messageSkipWaiting() (Zeile 27) ist wirkungslos. (2) window.workbox wird nur vom sw-entry-Skript von @ducanh2912/next-pwa injiziert — das im aktuellen CI-Build gar nicht läuft (Finding 1), d.h. in Produktion ist window.workbox undefined und der gesamte useEffect-Body wird übersprungen (Guard in Zeile 13). Zusätzliche Auswirkung von skipWaiting+clientsClaim ohne controllerchange-Reload: Updates aktivieren sich stillschweigend, während offene Tabs altes HTML/alte Chunks weiterverwenden — nach cleanupOutdatedCaches() können Lazy-Chunks des alten Builds fehlschlagen (stale App-Version / ChunkLoadError statt kontrolliertem Reload). Die Kommentare in Zeile 34-39 ('we might need to hook into it manually', 'is injected ... if configured correctly?') dokumentieren bereits die Unsicherheit.

**Beleg:** `next.config.ts: workboxOptions: { skipWaiting: true, clientsClaim: true }. public/sw.js: importScripts(),self.skipWaiting(),e.clientsClaim(). UpdateNotification.tsx:13: if (... && window.workbox !== undefined) — window.workbox wird nur in node_modules/@ducanh2912/next-pwa/dist/sw-entry.js gesetzt, d`

**Fix:** workboxOptions.skipWaiting: false setzen, damit der neue SW im 'waiting'-Zustand bleibt und der Toast-Flow (messageSkipWaiting + 'controlling' → reload) greift. Alternativ skipWaiting beibehalten und stattdessen navigator.serviceWorker 'controllerchange' mit einmaligem Reload-Guard (Flag gegen Reload-Schleifen) nutzen und die Komponente auf navigator.serviceWorker.getRegistration() statt window.workbox umstellen.

## [41] MEDIUM · pwa · Hardcodierte /cycletrack/-Pfade ohne basePath in next.config.ts + doppelte, konfliktäre SW-Registrierung

**Datei:** `src/app/layout.tsx:59`

layout.tsx registriert den SW manuell unter '/cycletrack/sw.js' mit scope '/cycletrack/', und manifest.json setzt id/start_url/scope/shortcuts auf '/cycletrack/...'. next.config.ts enthält aber KEIN basePath — der lokale Build erzeugt root-relative Assets. Konsequenzen: (a) In jedem lokalen Production-Test (npx serve out) schlägt die manuelle Registrierung mit 404 auf /cycletrack/sw.js fehl; (b) sobald Finding 1 gefixt ist und next-pwa wieder im Build läuft, registriert dessen Auto-Register-Skript (register default: true, sw-entry.js: window.workbox.register() auf origin + '/sw.js') ZUSÄTZLICH einen zweiten SW unter /sw.js mit scope / — zwei konkurrierende Registrierungen mit unterschiedlichen Scopes. Auf der deployten Site liefert https://hallohand.github.io/sw.js 404 (verifiziert), d.h. die Auto-Registrierung würde dort dauerhaft Konsolen-Fehler werfen. Der gesamte /cycletrack-Präfix existiert nur, weil configure-pages ihn im CI heimlich injiziert — lokal und in der eigenen Config ist er nirgends deklariert.

**Beleg:** `layout.tsx:59: navigator.serviceWorker.register('/cycletrack/sw.js', { scope: '/cycletrack/' }); next.config.ts: kein basePath/assetPrefix (grep bestätigt); node_modules/@ducanh2912/next-pwa/dist/sw-entry.js: window.workbox = new Workbox(window.location.origin + __PWA_SW__ ...), __PWA_ENABLE_REGISTE`

**Fix:** basePath: '/cycletrack' explizit in der eigenen Next-Config setzen (oder via env-Variable für lokal/CI). Entweder die manuelle Registrierung in layout.tsx entfernen und next-pwa registrieren lassen (es respektiert basePath via scope/sw-Option), oder register: false in der next-pwa-Config setzen und nur die manuelle Registrierung behalten — nicht beides.

## [42] MEDIUM · pwa · Keine HTML-Routen im Precache und kein Offline-Fallback — Routen sind offline nur nach vorherigem Besuch verfügbar

**Datei:** `next.config.ts:2`

Der generierte Precache enthält ausschließlich JS/CSS/Icons — null HTML-Dokumente (grep -c 'html' public/sw.js → 0). Bei output:'export' liegen die HTML-Dateien in out/ und werden von @ducanh2912/next-pwa nicht precacht. Navigationen laufen über die Runtime-Route 'pages' (NetworkFirst), d.h. eine Route ist offline nur verfügbar, wenn sie online schon einmal besucht wurde; eine fallbacks-Option (Offline-Seite) ist nicht konfiguriert. Zusätzlich matcht die generierte start-url-Route registerRoute("/", ...) unter dem Pages-basePath nie, da die echte Start-URL '/cycletrack/' ist. Selbst nach Behebung von Finding 1 hält das README-Versprechen 'funktioniert vollständig ohne Internetverbindung' also nur für bereits besuchte Routen — ein Kaltstart offline auf z.B. /cycletrack/chart ohne vorherigen Besuch schlägt fehl. (Die Gemini-Offline-Behandlung selbst ist sauber: src/lib/gemini-client.ts fängt Netzwerkfehler ab und liefert deutsche Fehlermeldungen, POSTs werden vom SW nicht gecacht — dort kein Befund.)

**Beleg:** `grep -c 'html' public/sw.js → 0; sw.js Runtime-Route: e.registerRoute(({url:{pathname:e},sameOrigin:s})=>s&&!e.startsWith("/api/"),new e.NetworkFirst({cacheName:"pages",...})); keine fallbacks-Konfiguration in next.config.ts; README.md: 'Offline-First: Die App funktioniert vollständig ohne Internetv`

**Fix:** In der next-pwa-Config die exportierten HTML-Seiten zusätzlich precachen (z.B. via workboxOptions.additionalManifestEntries für /, /entry, /chart, /calendar, /history, /settings, /assistant mit Build-ID als revision) oder mindestens fallbacks: { document: '/offline' } mit einer Offline-Seite konfigurieren.

## [43] MEDIUM · react · Gemini-Streaming: Callbacks schreiben blind auf das letzte Array-Element, kein Abort — Antwortverlust bei 'Chat löschen' während des Streams

**Datei:** `src/app/assistant/page.tsx:162`

onChunk/onDone/onError ersetzen stets updated[updated.length - 1]. Der 'Chat löschen'-Button (Trash) ist während des Streamings klickbar; clearChat setzt messages auf []. Der nächste Chunk schreibt dann auf Index -1 (updated[-1] = …, eine Array-Property, kein Element) — die laufende Antwort geht verloren und isLoading bleibt bis onDone hängen, ohne sichtbare Streaming-Bubble. Zudem gibt es keinen AbortController: Navigiert die Nutzerin während des Streams weg, läuft der Fetch im Hintergrund weiter, updateMemoryAfterChat feuert zusätzliche API-Calls, und da der Persist-Effekt nach Unmount nicht mehr läuft, wird die Assistentenantwort nie in localStorage gespeichert — beim Zurückkehren steht die Nutzerfrage ohne Antwort im Verlauf.

**Beleg:** `setMessages(prev => { const updated = [...prev]; updated[updated.length - 1] = { role: 'assistant', text: fullText, isStreaming: true }; return updated; }); — clearChat (Z.272) setzt setMessages([]) und ist während isLoading nicht deaktiviert.`

**Fix:** In den Callbacks gezielt die Streaming-Message ersetzen (prev.map mit isStreaming-Flag bzw. einer Message-ID) statt per Index; Trash-Button bei isLoading disablen; AbortController an streamChat durchreichen und im useEffect-Cleanup abbrechen.

## [44] MEDIUM · react · Dashboard zeigt für Nutzerinnen ohne Einträge dauerhaft das Lade-Skeleton (Leer- und Ladezustand vermischt)

**Datei:** `src/components/dashboard/Dashboard.tsx:28`

CycleContext liefert engine === null, sobald entries leer ist (CycleContext.tsx:64-67). Das Dashboard rendert bei !engine das DashboardSkeleton. Konkretes Szenario: Neue Nutzerin durchläuft das Onboarding und wählt bei 'Letzte Periode' den Button 'Überspringen' (legt keine Einträge an) → die Startseite zeigt für immer ein pulsierendes Lade-Skeleton statt eines Empty-States. Gleiches passiert nach 'Alle Daten löschen' in den Settings. Die App wirkt kaputt/hängend, obwohl sie nur keine Daten hat.

**Beleg:** `if (!isLoaded || !today || !engine) return <DashboardSkeleton />; — kombiniert mit CycleContext: if (!data?.entries || Object.keys(data.entries).length === 0) return null;`

**Fix:** Nach isLoaded && today zwischen engine === null (Empty-State mit CTA 'Ersten Eintrag anlegen' / EntryDrawer) und echtem Laden unterscheiden: if (!isLoaded || !today) return <DashboardSkeleton />; if (!engine) return <EmptyState />.

## [45] MEDIUM · react · Veraltetes 'Heute' in langlebigen PWA-Sessions: EntryDrawer-Default-Datum und Dashboard-today nur beim Mount gesetzt

**Datei:** `src/components/entry/EntryDrawer.tsx:72`

Der EntryDrawer im Bottom-Dock (Layout.tsx:73) wird einmal beim App-Start gemountet; useState(prefillDate || toLocalISO()) friert das Default-Datum auf den Mount-Tag ein. PWAs bleiben typischerweise tagelang im Hintergrund am Leben: Öffnet die Nutzerin die App am nächsten Morgen aus dem App-Switcher und tippt '+', ist still das gestrige Datum vorausgefüllt — die Basaltemperatur landet auf dem falschen Tag und verfälscht die NFP-Auswertung, ohne dass es auffällt. Analog setzt Dashboard.tsx:24-26 today nur einmal per Effekt; nach Mitternacht stimmen 'Zyklustag' und 'Nächste Periode in X Tagen' nicht mehr.

**Beleg:** `const [date, setDate] = useState<string>(prefillDate || toLocalISO()); — toLocalISO() wird nur beim ersten Render der dauerhaft gemounteten Dock-Instanz ausgewertet.`

**Fix:** Im bestehenden open-Effekt beim Öffnen das Datum aktualisieren: if (open) setDate(prefillDate || toLocalISO()). Im Dashboard today bei visibilitychange/focus oder per Intervall um Mitternacht aktualisieren.

## [46] MEDIUM · react · Settings-Inputs schreiben pro Keystroke in den CycleContext: runEngine + groupCycles + komplette localStorage-Serialisierung je Tastendruck

**Datei:** `src/app/settings/page.tsx:275`

Die Felder Zykluslänge/Periodendauer rufen onChange direkt updateSettings auf. Jeder Tastendruck erzeugt ein neues data-Objekt → beide useMemos im Provider rechnen neu (runEngine über alle Einträge, groupCycles), der Persist-Effekt serialisiert den gesamten Datenbestand per JSON.stringify in localStorage und rotiert die Backups (siehe High-Fund). Bei mehreren Jahren Daten (~1000 Einträge) ist das spürbarer Jank pro Tastendruck auf Mobilgeräten. Zusätzlich: parseInt(e.target.value) || 28 macht das Feld beim Leeren sofort wieder zu '28' — man kann den Wert nicht normal löschen und neu tippen. Zur Context-Frage generell: contextValue ist korrekt memoisiert (Identität nur bei data/isLoaded-Änderung), Consumer sind nur die gemountete Route + EntryDrawer/Onboarding — das Re-Render-Verhalten pro Eintrag-Save ist in Ordnung; das Problem ist allein der ungedrosselte Schreibpfad pro Keystroke.

**Beleg:** `onChange={(e) => updateSettings({ cycleLength: parseInt(e.target.value) || 28 })} — triggert in CycleContext: engine-useMemo (runEngine(data)), Persist-Effekt mit JSON.stringify(data), rotateLocalBackup, debouncedCloudSync.`

**Fix:** Lokalen String-State für die Felder verwenden und erst onBlur (oder debounced) validiert in updateSettings schreiben; leeres Feld zulassen statt || 28 beim Tippen zu erzwingen.

## [47] MEDIUM · security · Dashboard-AI-Karte sendet Gesundheitsdaten an Google BEVOR der Datenschutzhinweis akzeptiert wurde; Hinweis unterschlägt Patientenakte und Chat-Verlauf

**Datei:** `src/components/dashboard/AiSummaryCard.tsx:46`

Der Consent-Gate ('cycletrack_ai_privacy_accepted') wird ausschließlich in src/app/assistant/page.tsx:111-117 geprüft. AiSummaryCard auf dem Dashboard feuert generateSummary() automatisch, sobald ein API-Key existiert und sich der Entries-Hash ändert — ohne jede Consent-Prüfung. Realer Ablauf: Nutzerin trägt den Key in den Einstellungen ein, kehrt zum Dashboard zurück → Temperaturen, Zyklusphasen, Prognosen UND die komplette 'Patientenakte' (via buildSystemPrompt → getMemoryPromptSection: Kinderwunsch, Vorerkrankungen, Medikamente) gehen sofort an Google, bevor der Datenschutzhinweis je angezeigt wurde. Zusätzlich beschreibt der Hinweis selbst (assistant/page.tsx:250-253) nur 'Temperaturen, Phasen, Prognosen' — verschweigt aber, dass auch der Chat-Verlauf erneut zur Faktenextraktion gesendet wird (ai-memory.ts updateMemoryAfterChat) und die Patientenakte in jedem System-Prompt mitgeht.

**Beleg:** `useEffect(() => { if (!apiKey || !data || !engine || !currentHash || !isLoaded) return; ... const result = await generateSummary(apiKey, systemPrompt, userPrompt); ... }, [apiKey, currentHash, isLoaded]); — keine Prüfung von 'cycletrack_ai_privacy_accepted'`

**Fix:** Consent-Check zentralisieren (z.B. isAiConsentGiven() in gemini-client.ts) und in AiSummaryCard vor dem useEffect-Aufruf prüfen; alternativ Consent-Dialog direkt beim Speichern des API-Keys in den Einstellungen erzwingen. Den Hinweistext um Patientenakte und Chat-Verlauf ergänzen.

## [48] MEDIUM · security · App-Lock entsperrt nur beim App-Start: kein Re-Lock bei Hintergrund/Timeout, Deaktivierung ohne Re-Authentifizierung

**Datei:** `src/components/guard/AppLock.tsx:34`

Der Lock-Zustand ist lokaler React-State, der nur einmal beim Mount geprüft wird. Es existiert kein visibilitychange/pagehide-Listener und kein Inaktivitäts-Timeout (per grep über src/ verifiziert). Bei einer installierten PWA auf dem Smartphone bleibt die App nach einmaligem Entsperren tage-/wochenlang im Speicher und damit dauerhaft entsperrt — der Lock schützt faktisch nur Kaltstarts. Verschärfend: handleToggleAppLock in src/app/settings/page.tsx:76-81 ruft disableAppLock() direkt auf, ohne erneute WebAuthn-Authentifizierung. Angriffspfad: Person nimmt das entsperrte Telefon (App noch im Speicher), öffnet Einstellungen, schaltet den Lock mit einem Tap dauerhaft ab — unbemerkt und ohne Biometrie. Zusätzlich gibt authenticatePasskey() bei fehlendem Credential-Eintrag true zurück (src/lib/auth.ts:68), d.h. das Löschen eines einzigen localStorage-Keys deaktiviert den Lock vollständig (Daten-Lesbarkeit ist by design, aber der Lock bietet keinerlei kryptographische Bindung an die Daten).

**Beleg:** `AppLock.tsx: const [isLocked, setIsLocked] = useState(true); ... useEffect(() => { checkLock(); }, []); — settings/page.tsx:80: auth.disableAppLock(); setIsAppLockActive(false); — auth.ts:68: if (!storedId) return true;`

**Fix:** Re-Lock implementieren: document.addEventListener('visibilitychange', ...) → bei hidden isLocked=true setzen (ggf. mit kurzer Grace-Period), plus optionales Inaktivitäts-Timeout. Vor disableAppLock() in den Einstellungen ein erfolgreiches authenticatePasskey() verlangen.

## [49] LOW · a11y · framer-motion-Animationen ignorieren prefers-reduced-motion teilweise

**Datei:** `src/components/entry/EntryDrawer.tsx:50-55`

Der CSS-Block in globals.css:247-258 wirkt nur auf CSS-Animationen/-Transitions, nicht auf framer-motions JS-getriebene Spring-Animationen. PageTransition und Dashboard prüfen matchMedia manuell, aber drei Stellen nicht: die Höhen-Spring-Animation der CollapsibleSection (EntryDrawer.tsx:50-55), der layoutId-Spring des Nav-Indikators (src/components/layout/Layout.tsx:16-20) und die Expand-Animation der Zyklusdetails (src/app/history/page.tsx:174-179). Nutzerinnen mit Bewegungsempfindlichkeit erhalten dort weiterhin volle Animationen (WCAG 2.3.3).

**Beleg:** `globals.css reduced-motion-Block setzt nur animation-/transition-duration; EntryDrawer: transition={{ type: 'spring', stiffness: 300, damping: 30 }} ohne Reduced-Motion-Check`

**Fix:** App in <MotionConfig reducedMotion="user"> wrappen (z.B. im RootLayout/AppLayout) — damit respektieren alle framer-motion-Komponenten die OS-Einstellung zentral.

## [50] LOW · a11y · Verwaiste /entry-Seite: hartkodierte Light-Farben (im Dark Mode kaputt) und unverknüpfte Labels

**Datei:** `src/app/entry/page.tsx:50-56`

Die Route /entry ist eine ältere Duplikat-Version des EntryDrawers und wird weiterhin gebaut/ausgeliefert (statischer Export). Sie nutzt hartkodierte Farben (bg-white, text-gray-700, bg-pink-100, border-gray-300) statt Theme-Tokens — im Dark Mode entstehen weiße Karten mit hellgrauem Text auf dunklem Hintergrund und ein inkonsistentes Erscheinungsbild. Alle <label>-Elemente (Z.51, 61, 73, 96, 120, 138) haben kein htmlFor; die Options-Buttons haben wie im Drawer kein aria-pressed.

**Beleg:** `<div className="bg-white p-4 rounded-2xl shadow-sm"><label className="block text-sm font-medium text-gray-700 mb-2">Datum</label><input type="date" ... /></div>`

**Fix:** Seite entfernen (Funktionalität existiert vollständig im EntryDrawer) oder auf Theme-Tokens + htmlFor/id und aria-pressed migrieren.

## [51] LOW · a11y · Navigation ohne aria-current und mit Auswahlanzeige nur über Farbe

**Datei:** `src/components/layout/Layout.tsx:12-26`

NavItem markiert die aktive Seite nur visuell (Farbwechsel + Indikator-Pille), setzt aber kein aria-current="page". Screenreader-Nutzerinnen erfahren nicht, auf welcher der fünf Seiten sie sich befinden. Betrifft Bottom-Dock und Desktop-Sidebar.

**Beleg:** `<Link href={href} aria-label={label} className="flex flex-col ..."> — kein aria-current={isActive ? 'page' : undefined}`

**Fix:** aria-current={isActive ? 'page' : undefined} auf den Link setzen; die <nav>-Elemente zusätzlich mit aria-label="Hauptnavigation" versehen.

## [52] LOW · a11y · Englische/fehlerhafte UI-Texte in der ansonsten deutschen Oberfläche

**Datei:** `src/components/layout/Layout.tsx:93`

Inkonsistente Sprache: Desktop-Sidebar zeigt "Settings" (Z.93), während mobil "Einstellungen" (aria-label Z.54) und die Seitenüberschrift "Einstellungen" verwendet werden. In den Settings heißt der Sync-Status "Synce..." (src/app/settings/page.tsx:525) — kein deutsches Wort. Auch "App Lock" (settings/page.tsx:306) mischt Englisch in deutsche Sätze ("App Lock deaktiviert").

**Beleg:** `<NavItem href="/settings" icon={Settings} label="Settings" ... />; {isSyncing ? 'Synce...' : 'Jetzt sichern'}`

**Fix:** "Settings" → "Einstellungen" (bzw. gekürzt "Optionen"), "Synce..." → "Synchronisiere…", "App Lock" → "App-Sperre".

## [53] LOW · a11y · Zyklus-Einstellungen ohne Validierung/min-max — stilles Zurücksetzen statt Fehlermeldung

**Datei:** `src/app/settings/page.tsx:274-289`

Die Number-Inputs für Zykluslänge und Periodendauer haben keine min/max-Attribute und keine Fehlermeldungen. Leeren des Feldes setzt den Wert kommentarlos auf 28 bzw. 5 (parseInt(...) || 28); unsinnige Werte wie 0, 1 oder 999 werden direkt gespeichert und fließen in die Vorhersage ein. Es gibt keinerlei zugängliche Fehlerausgabe (kein aria-invalid, kein aria-describedby, keine Meldung).

**Beleg:** `<Input id="cycleLength" type="number" value={data.cycleLength} onChange={(e) => updateSettings({ cycleLength: parseInt(e.target.value) || 28 })} /> — keine min/max-Props, keine Fehlermeldung`

**Fix:** min={21} max={45} (bzw. 2–10 für Periodendauer) setzen, ungültige Eingaben mit sichtbarer + per aria-describedby verknüpfter Fehlermeldung und aria-invalid kennzeichnen statt still zu überschreiben.

## [54] LOW · logic · Femometer-Import: Spotting-Spalte überschreibt echten Periodenfluss → Zyklusstart kann verloren gehen

**Datei:** `src/lib/importer.ts:64`

Nach dem Setzen von entry.period aus Periodentag/Flussmenge überschreibt die Spotting-Prüfung den Wert bedingungslos: Hat eine Zeile sowohl einen Periodentag (z.B. Tag 1, 'Wenig') als auch einen Eintrag in der Schmier-Spalte, wird der Tag als 'spotting' importiert. Da sowohl analyzeHistory als auch groupCycles Spotting explizit NICHT als Zyklusstart werten, verschiebt sich der erkannte Zyklusbeginn auf den nächsten Flusstag (oder der Zyklus wird ganz übersehen) — Zykluslängen-Statistik, Zyklustag und alle Prognosen sind dann für diese Zyklen falsch. Zusätzlich wird row[12] (Symptome) zwar gelesen (symptomsStr), aber nie auf entry.symptoms gemappt — Symptomdaten gehen beim Import kommentarlos verloren (ebenso Schmerzen row[5] und Stimmung row[11], obwohl das Datenmodell pain/mood unterstützt).

**Beleg:** `if (periodDay) {
    if (flow === 'Viel') entry.period = 'heavy';
    ...
}
// Spotting column?
if (spottingStr || flow === 'Schmierblutung') {
    entry.period = 'spotting';
}
...
const symptomsStr = row[12]; // wird nie verwendet`

**Fix:** Spotting nur setzen, wenn kein echter Periodenfluss vorliegt: if (!entry.period && (spottingStr || flow === 'Schmierblutung')) entry.period = 'spotting';. symptomsStr in entry.symptoms übernehmen (Split an Kommas innerhalb des gequoteten Felds) und pain/mood-Spalten mappen.

## [55] LOW · logic · IndexedDB-Snapshot-System ist toter Code — die 30-Snapshot-Sicherung wird nie erstellt

**Datei:** `src/lib/backup.ts:88`

saveIndexedDBSnapshot, getIndexedDBSnapshots und restoreFromIndexedDB werden nirgendwo in der App aufgerufen (grep über src/ liefert außer backup.ts keine Treffer; auch settings/page.tsx importiert sie nicht). Die als Feature beschriebene mehrstufige lokale Sicherung (bis zu 30 Snapshots) existiert damit nur im Code — real gibt es nur die zwei LocalStorage-Slots, die (siehe kritischer Befund) bei jedem App-Start rotiert werden. Die Nutzerin hat faktisch keine historischen Wiederherstellungspunkte, obwohl die Architektur sie vorsieht.

**Beleg:** `grep -rn 'saveIndexedDBSnapshot|getIndexedDBSnapshots|restoreFromIndexedDB' src --include='*.ts*' → Treffer ausschließlich in src/lib/backup.ts (Definitionen)`

**Fix:** saveIndexedDBSnapshot z.B. einmal täglich (zeitgegated) aus dem Persist-Pfad in CycleContext aufrufen und in den Einstellungen eine Snapshot-Liste mit Restore-Button (über die neue replaceAllData-Funktion) anbieten — oder den toten Code entfernen.

## [56] LOW · perf · Jede Datenänderung serialisiert den gesamten Datenbestand dreifach synchron (Persist + Backup-Rotation)

**Datei:** `src/components/CycleContext.tsx:52`

Der Persist-Effekt läuft bei jeder data-Änderung (jedes Speichern eines Eintrags, jede Settings-Änderung) und schreibt synchron auf dem Main-Thread: (1) JSON.stringify(data) + setItem für den Hauptdatensatz, (2) rotateLocalBackup kopiert den kompletten Backup-1-String nach Backup-2 (getItem + setItem) und (3) serialisiert data erneut für Backup-1. Effektiv ~3× Voll-Serialisierung/Schreiben pro Update. localStorage ist synchron; bei 150-300 KB Datenbestand blockiert das pro Save spürbar (Tap-Feedback im EntryDrawer verzögert sich), und es skaliert linear mit der Datenmenge. Ein Rotations-Backup pro Tastendruck/Update hat zudem keinen Mehrwert — beide Slots enthalten nach 2 Updates praktisch identische Stände.

**Beleg:** `CycleContext.tsx:58-59: localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); rotateLocalBackup(data); — backup.ts:23-28: const prev1Raw = localStorage.getItem(BACKUP_KEY_1); if (prev1Raw) { localStorage.setItem(BACKUP_KEY_2, prev1Raw); } ... localStorage.setItem(BACKUP_KEY_1, JSON.stringify(newS`

**Fix:** Hauptpersist debouncen (z.B. 500ms, mit flush bei visibilitychange/pagehide). rotateLocalBackup entkoppeln: nur einmal pro Session oder max. 1×/Tag rotieren (Timestamp-Check), oder komplett auf die bereits vorhandenen asynchronen IndexedDB-Snapshots (saveIndexedDBSnapshot) umstellen.

## [57] LOW · perf · Chart-Seite: abgeleitete Daten via useEffect+setState (Doppel-Render) und ungedrosselter Resize-Listener rendert kompletten recharts-Baum neu

**Datei:** `src/app/chart/page.tsx:37`

chartData und phaseAreas werden in einem useEffect berechnet und per setState gesetzt statt mit useMemo abgeleitet. Folge: bei jedem data-Change rendert die Seite zweimal komplett (erst mit alten Daten, dann nach Effekt+setState erneut) — und der recharts-Baum ist hier teuer: bis zu ~180 Datenpunkte (6 Monate) in einem bis zu 7200px breiten SVG (chartWidth = chartData.length * 40, Zeile 153) mit Custom-Dot-Renderfunktion pro Punkt, mehreren ReferenceAreas und ReferenceLines. Zusätzlich setzt der Resize-Listener (Zeile 146-151) windowWidth bei JEDEM resize-Event ohne Debounce — auf Mobile feuert resize bei URL-Bar-Ein-/Ausblenden und Tastatur, wodurch der gesamte Chart inkl. aller Dots pro Event neu gerendert wird (sichtbarer Jank beim Scrollen/Rotieren). Der ResponsiveContainer ist zudem überflüssig, da der Parent bereits eine feste Pixelbreite hat, und kostet einen zusätzlichen Mount-Render via ResizeObserver.

**Beleg:** `chart/page.tsx:37-122: useEffect(() => { ... setChartData(formattedData); ... setPhaseAreas(newPhaseAreas); }, [data, isLoaded, historyCycles]); — chart/page.tsx:147-150: const handleResize = () => setWindowWidth(window.innerWidth); window.addEventListener('resize', handleResize); — chart/page.tsx:1`

**Fix:** chartData/phaseAreas mit useMemo aus [data.entries, historyCycles] ableiten (kein setState, kein Doppel-Render). Resize-Handler mit ~150ms Debounce/rAF drosseln. ResponsiveContainer entfernen und LineChart direkt width={chartWidth} height geben. Optional: Custom-Dot nur für Punkte mit Marker rendern (dot={false} + separate Scatter-Punkte) und Zeitraum-Umschalter (1/3/6 Monate), um die SVG-Knotenzahl zu senken.

## [58] LOW · perf · framer-motion animiert 'height: auto/0' (nicht compositor-fähig) in EntryDrawer-Akkordeons und History-Details

**Datei:** `src/components/entry/EntryDrawer.tsx:50`

Die CollapsibleSections im EntryDrawer und die aufklappbaren Zyklus-Details in der History animieren die CSS-Property height per Spring. height ist nicht compositor-fähig: framer-motion setzt den Wert pro Frame, was bei 60fps einen Layout-Reflow des gesamten Drawer-Inhalts (4 Sections, Button-Grids) bzw. der Zyklusliste pro Frame auslöst. Im vaul-Drawer, der gleichzeitig selbst transformiert/gestured wird, führt das auf schwächeren Geräten zu sichtbarem Ruckeln beim Auf-/Zuklappen der Sektionen — genau im häufigsten Interaktionspfad der App (täglicher Eintrag).

**Beleg:** `EntryDrawer.tsx:50-55: <motion.div initial={false} animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}> — gleiches Muster in history/page.tsx:174-179: animate={{ height: 'auto', opacity: 1 }}.`

**Fix:** CSS grid-template-rows: 0fr/1fr-Transition (mit min-height:0 im Kind) oder interpolate-size/calc-size nutzen — bzw. wenn framer bleiben soll: Inhalt mit clip-path/opacity + transform animieren. Für die Akkordeons reicht meist eine kurze CSS-Transition (200ms ease-out) statt Spring auf height.

## [59] LOW · pwa · Build-Artefakte public/sw.js, workbox-*.js, swe-worker-*.js sind in git eingecheckt statt ignoriert — die unkommittete sw.js-Änderung ist ein Build-Artefakt

**Datei:** `public/sw.js:1`

public/sw.js, public/workbox-f1770938.js und public/swe-worker-5c72df51bb1f6ee0.js sind von @ducanh2912/next-pwa generierte Build-Artefakte, stehen aber unter git-Versionierung (git ls-files bestätigt) und fehlen in .gitignore. Die unkommittete 1-Zeilen-Änderung an public/sw.js ist eindeutig ein Build-Artefakt eines lokalen `next build`: Der Diff zeigt eine neue Build-ID (QuUrZp9m-LG4jcnmYmLAW → m6EbTMjqfPme0FJDUb92x) und komplett neue Chunk-Hashes (z.B. app/layout-86d04600287fb8d7.js → app/layout-c9e47de517f6af7a.js) — keine manuelle Änderung. Wegen Finding 1 (CI regeneriert sw.js nicht) wird exakt die committete Datei deployed: Jeder lokale Build-Stand, der zufällig committet wird, landet als Service Worker in Produktion — mit Precache-URLs ohne basePath, die dort nie funktionieren. Die next-pwa-Doku empfiehlt explizit, diese Dateien zu ignorieren.

**Beleg:** `git diff public/sw.js: -.../_next/static/QuUrZp9m-LG4jcnmYmLAW/_buildManifest.js → +.../_next/static/m6EbTMjqfPme0FJDUb92x/_buildManifest.js (neue Build-ID + neue Chunk-Hashes). git ls-files public: public/sw.js, public/swe-worker-5c72df51bb1f6ee0.js, public/workbox-f1770938.js. .gitignore enthält k`

**Fix:** In .gitignore aufnehmen: public/sw.js, public/sw.js.map, public/workbox-*.js, public/workbox-*.js.map, public/swe-worker-*.js — und mit `git rm --cached` aus dem Index entfernen. Die unkommittete Änderung verwerfen (Artefakt). Setzt voraus, dass Finding 1 gefixt ist, damit CI den sw.js selbst generiert.

## [60] LOW · pwa · theme_color inkonsistent: metadata.themeColor wird von Next 16 ignoriert, gerendert wird nur #FFF8F9 — Manifest sagt #FF6B9D

**Datei:** `src/app/layout.tsx:14`

layout.tsx definiert themeColor: '#FF6B9D' (und viewport) im metadata-Export — beides wird seit Next 14 nicht mehr unterstützt (gehört in den separaten viewport-Export) und in Next 16 stillschweigend verworfen. Gleichzeitig steht in <head> ein manuelles <meta name="theme-color" content="#FFF8F9"> (Zeile 47). Live verifiziert: Die deployte index.html enthält NUR content="#FFF8F9" — der Wert #FF6B9D aus metadata taucht nirgends auf. Das Manifest deklariert aber theme_color: '#FF6B9D' (Pink). Effekt: Browser-UI/Statusleiste im Browser-Tab (#FFF8F9, fast weiß) weicht von der installierten PWA (#FF6B9D, Pink, aus dem Manifest) ab; metadata.themeColor und metadata.viewport sind tote Konfiguration.

**Beleg:** `curl der deployten Seite: <meta name="theme-color" content="#FFF8F9"/> (nur einmal, #FF6B9D fehlt). layout.tsx:14: themeColor: '#FF6B9D' im Metadata-Export; layout.tsx:47: <meta name="theme-color" content="#FFF8F9" />; manifest.json:13: "theme_color": "#FF6B9D"`

**Fix:** themeColor und viewport aus dem metadata-Export entfernen und einen `export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '...' }` anlegen; das manuelle <meta>-Tag in Zeile 47 löschen und einen einheitlichen Wert wählen, der zum Manifest passt (oder beide bewusst auf denselben Wert setzen).

## [61] LOW · pwa · BUILD_DATE zeigt Laufzeit- statt Build-Zeitpunkt und verursacht Hydration-Mismatch auf der Settings-Seite

**Datei:** `src/lib/version.ts:4`

APP_VERSION '0.8.0' ist konsistent mit package.json (0.8.0) — kein Problem. Aber BUILD_DATE = new Date().toISOString() wird beim Modul-Load im Browser ausgewertet: Die Settings-Seite (settings/page.tsx:544 und 559) zeigt damit als 'Build-Datum' immer den aktuellen Zeitpunkt des Nutzers an — die Angabe ist nutzlos/irreführend. Zusätzlich entsteht ein React-Hydration-Mismatch: Im statisch exportierten HTML steht der Build-Zeitpunkt, beim Hydrieren wird ein neuer ISO-String berechnet (inkl. Millisekunden, praktisch nie identisch). Der Code-Kommentar in version.ts dokumentiert das Problem selbst, der vorgeschlagene NEXT_PUBLIC_BUILD_DATE-Workaround ist aber nirgends umgesetzt (weder lokal noch in deploy.yml).

**Beleg:** `src/lib/version.ts: export const BUILD_DATE = new Date().toISOString(); // 'NOTE: This evaluates at module load time, not build time.' — verwendet in src/app/settings/page.tsx:544: <span className="font-mono">{APP_VERSION} ({BUILD_DATE})</span> und Zeile 559`

**Fix:** BUILD_DATE über env zur Build-Zeit injizieren: in next.config env: { NEXT_PUBLIC_BUILD_DATE: new Date().toISOString() } (wird beim Build eingefroren) und version.ts auf process.env.NEXT_PUBLIC_BUILD_DATE ?? 'dev' umstellen; alternativ die Datumsanzeige entfernen.

## [62] LOW · react · AiSummaryCard: parallele Generierungen ohne Stale-Guard — veraltete Antwort kann Anzeige und Hash-Cache überschreiben

**Datei:** `src/components/dashboard/AiSummaryCard.tsx:46`

Der Generate-Effekt startet bei jeder currentHash-Änderung einen neuen API-Call, ohne den vorherigen abzubrechen oder dessen Ergebnis zu verwerfen. Szenario: Nutzerin speichert einen Eintrag (Generierung A startet, dauert 2-5s), korrigiert direkt danach einen Wert (Generierung B startet). Kommt A nach B an, zeigt die Karte die veraltete Zusammenfassung A, während HASH_KEY den Hash von A trägt — gecachter Text und tatsächlicher Datenstand passen nicht zusammen. Außerdem setzt das finally der ersten Generierung isGenerating auf false, während B noch läuft (Indikator 'Aktualisiere...' verschwindet zu früh). setState nach Unmount ist in React 19 zwar ein No-op, aber der Fetch läuft unnötig weiter.

**Beleg:** `useEffect(() => { ... const generate = async () => { setIsGenerating(true); ... const result = await generateSummary(...); if (result.text) { setSummary(result.text); ... localStorage.setItem(HASH_KEY, currentHash); } ... }; generate(); }, [apiKey, currentHash, isLoaded]);`

**Fix:** Stale-Guard im Effekt: let cancelled = false + Cleanup (return () => { cancelled = true; }) und vor jedem setState/localStorage-Write prüfen; alternativ AbortController bzw. nach dem await currentHash gegen den aktuellen Hash vergleichen.

## [63] LOW · react · Fehlendes suppressHydrationWarning auf <html> trotz next-themes (attribute="class") — Hydration-Mismatch bei jedem Laden mit Dark/System-Theme

**Datei:** `src/app/layout.tsx:45`

next-themes injiziert vor der Hydration ein Script, das class (z.B. 'dark') und style="color-scheme:…" am <html>-Element setzt. Das statisch exportierte HTML enthält nur className="h-[100dvh]" — beim ersten Client-Render meldet React 19 daher einen Hydration-Mismatch (Konsolen-Error mit Diff, Dev-Overlay in Next 16), sobald Dark- oder System-Theme aktiv ist. Die next-themes-Doku verlangt explizit suppressHydrationWarning auf <html>. In Produktion werden Attribut-Mismatches zwar nicht gepatcht, aber die Dev-Konsole wird bei jeder Session mit Fehlern geflutet, was echte Hydration-Probleme maskiert.

**Beleg:** `<html lang="de" className="h-[100dvh]"> … <ThemeProvider attribute="class" defaultTheme="system" enableSystem …> — kein suppressHydrationWarning im gesamten src/ (grep-verifiziert).`

**Fix:** <html lang="de" className="h-[100dvh]" suppressHydrationWarning> setzen (offizielle next-themes-Anforderung; unterdrückt nur Mismatches auf genau diesem Element).

## [64] LOW · security · GitHub-Token im Klartext in localStorage; gist-Scope erlaubt Zugriff auf ALLE Gists des Accounts

**Datei:** `src/lib/backup.ts:173`

Das GitHub-PAT wird unverschlüsselt unter dem Key 'cycletrack_gist_token' in localStorage abgelegt und überlebt dort unbegrenzt. Die Settings-UI (src/app/settings/page.tsx:513) leitet den Nutzer explizit zu einem Classic-Token mit Scope 'gist' an — ein solches Token gewährt Lese-/Schreibzugriff auf sämtliche (auch fremde, nicht-CycleTrack) Gists des GitHub-Accounts. Jedes Script im Origin (XSS, kompromittierte Dependency, Browser-Extension mit Storage-Zugriff) oder jede Person mit kurzem Gerätezugriff kann das Token auslesen; die CSP erlaubt connect-src https://api.github.com, d.h. Missbrauch des Tokens ist direkt aus der App heraus möglich. Im Unterschied zu den Gesundheitsdaten (lokal by design) ist das Token ein Credential für einen externen Dienst mit deutlich größerem Blast-Radius als die Backup-Funktion benötigt.

**Beleg:** `export function setGistConfig(token: string, gistId?: string) { localStorage.setItem(GIST_TOKEN_KEY, token); ... } — UI-Hinweis: github.com/settings/tokens → Scope "gist"`

**Fix:** Nutzer in der UI auf Fine-grained PATs mit minimaler Berechtigung (nur Gists, kurze Laufzeit) hinweisen statt Classic-Token mit gist-Scope. Token optional mit der gleichen Passphrase wie das Backup verschlüsseln (AES-GCM, Key nur im Speicher) oder zumindest sessionStorage als Option anbieten; bei Deaktivierung des Cloud-Backups Token-Widerruf empfehlen.

## [65] LOW · security · Service Worker cached GitHub-API-Antworten (kompletten Backup-Datensatz) ungeschützt im Cache Storage

**Datei:** `next.config.ts:3`

@ducanh2912/next-pwa wird mit Default-Runtime-Caching verwendet; der generierte public/sw.js enthält die Default-Regel ({sameOrigin: e}) => !e → NetworkFirst, cacheName 'cross-origin', maxAgeSeconds 3600. Der GET-Request von restoreFromGist() auf https://api.github.com/gists/{id} liefert den vollständigen unverschlüsselten Gesundheitsdatensatz und wird damit zusätzlich im Cache Storage persistiert — außerhalb von localStorage/IndexedDB, am App-Lock vorbei lesbar und auch nach clearGistConfig()/Datenlöschung bis zu Ablauf/Verdrängung vorhanden. Die Gemini-Aufrufe sind POST und daher nicht betroffen.

**Beleg:** `public/sw.js (generiert): ({sameOrigin:e})=>!e, new e.NetworkFirst({cacheName:"cross-origin", networkTimeoutSeconds:10, plugins:[new e.ExpirationPlugin({maxEntries:32, maxAgeSeconds:3600})]})`

**Fix:** In next.config.ts workboxOptions.runtimeCaching überschreiben und für api.github.com (und generativelanguage.googleapis.com) explizit NetworkOnly konfigurieren bzw. die Default-cross-origin-Regel ersetzen; zusätzlich beim 'Alle Daten löschen'-Flow caches.delete('cross-origin') aufrufen.

## [66] LOW · security · CSP erlaubt 'unsafe-inline' für Skripte — kombiniert mit Klartext-Credentials in localStorage und erlaubtem Exfil-Endpunkt

**Datei:** `src/app/layout.tsx:52`

Die Meta-Tag-CSP setzt script-src 'self' 'unsafe-inline'. Damit ist die CSP als zweite Verteidigungslinie gegen injizierte Inline-Skripte wirkungslos. Das ist relevant, weil im Origin zwei externe Credentials im Klartext liegen (GitHub-PAT, Gemini-Key) und connect-src https://api.github.com erlaubt — ein Angreifer-Skript kann gestohlene Daten per eigenem Token in ein eigenes Gist schreiben, vollständig CSP-konform. Aktuell wurde kein konkreter Injection-Vektor gefunden (React-Escaping, einziges dangerouslySetInnerHTML ist das statische SW-Registrierungs-Snippet in layout.tsx:54-64), daher nur low — aber 'unsafe-inline' ist bei statischem Export vermeidbar. base-uri fehlt ebenfalls (fällt nicht auf default-src zurück).

**Beleg:** `content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' https://generativelanguage.googleapis.com https://api.github.com; ..."`

**Fix:** Das eigene Inline-Script (SW-Registrierung) in eine eigene .js-Datei unter public/ auslagern; für die von Next.js generierten Inline-Bootstrap-Skripte SHA-256-Hashes im Build erzeugen und in die CSP eintragen (oder, falls Hosting es erlaubt, CSP als HTTP-Header mit Hashes ausliefern). 'base-uri 'self'' ergänzen.
