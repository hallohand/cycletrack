# Masterplan: Audit-Fixes + Design-Überarbeitung (2026-06-10)

Basiert auf dem Multi-Agent-Audit (66 bestätigte Funde, siehe `2026-06-10-full-audit.md`).

## Stage 1 — Kern-Fixes (Datenintegrität, Engine, Sicherheit, PWA/Deploy)

| Bereich | Fixes |
|---|---|
| `src/lib/date-utils.ts` (neu) | Gemeinsame UTC-sichere `addDays`/`diffDays` (DST-Bug [14]) |
| `cycle-calculations.ts` | DST-addDays, FERTILE_MID-Off-by-one [32], BBT-Regel auf Kalendertagen [33] |
| `history-utils.ts` | DST-addDays, Eisprung-Fallback nur für abgeschlossene Zyklen + Index-Korrektur, LH-Regel konsistent zur Engine [34] |
| `CycleContext.tsx` | Persist nur bei echten Änderungen (Snapshot-Vergleich) [1,2,17], Schreibsperre + Rettungskopie bei korruptem JSON, zod-Validierung beim Laden [27], try/catch + Toast bei Quota [13], storage-Event für Multi-Tab [12], `importData` mit merge/replace-Modus [15], `mergeEntries` für CSV-Import [29] |
| `backup.ts` | Rotation max. 1×/24h + Leer-Guard [10], Cloud-Sync-Guard gegen leere Daten [11], AES-GCM-Verschlüsselung (PBKDF2) für Gist [4,30], truncated-Gist-Handling |
| `ErrorBoundary.tsx` | Bestätigung + Rettungskopie vor localStorage.clear() [13] |
| `importer.ts` | Spotting überschreibt Periodenfluss nicht mehr [54], zod-Validierung [29], tote Importe |
| `llm-context.ts` | Lokales Datum statt UTC [35], TZ-sichere Datumsformatierung |
| `ai-memory.ts` | Restrukturierung mit ausreichend Tokens + Längen-Guard [36] |
| `gemini-client.ts` | API-Key im Header statt URL, alle Antwort-Parts lesen |
| PWA/Deploy | deploy.yml ohne config-Injektion + expliziter basePath via env [3,41], Build-Artefakte aus git [59], SW-Doppelregistrierung beseitigt, viewport/themeColor Next-16-konform [60], UpdateNotification (toter Code) entfernt [40], BUILD_DATE [61], suppressHydrationWarning [63] |
| Aufräumen | Verwaiste `/entry`-Seite löschen [50], IndexedDB-Snapshot-Totcode [55] |

## Stage 2 — UI-Korrektheit + A11y (parallel, dateipartitioniert)

- **EntryDrawer.tsx**: Dezimaleingabe Temperatur [16], aria-pressed/Labels/Fokusringe [8,9,21,22], aria-expanded+inert [19], Touch-Targets, "Heute"-Refresh [45]
- **settings/page.tsx**: Datei-Input-Pattern [20], min/max-Validierung [53], Restore mit Bestätigung+Replace [28], Settings-Inputs entkoppelt (kein Engine-Rerun pro Keystroke) [37,46], deutsche Texte [52], Passphrase-UI für Cloud-Verschlüsselung
- **assistant/page.tsx + AiSummaryCard.tsx**: Hydration-Fixes, Streaming-Guards [43,62], aria-live [26], Touch-Targets [25], Privacy-Gate vor KI-Aufrufen [47]
- **Layout/Onboarding/Chart**: Button-asChild [24], aria-current [51], Slider-Labels [23], Chart-Perf [57], Dashboard-Leerzustand [44], AppLock Re-Lock [48]

## Stage 3 — Design-Überarbeitung (emil-design-eng)

- Farbtoken mit WCAG-AA-Kontrast [5,6,7,18]
- Fonts selbst gehostet via next/font (offline-fähig, kein Render-Blocking)
- MotionConfig reducedMotion="user" [49]
- Animationen: Springs, Micro-Interactions, Page-Transitions, Einstiegs-Stagger
- framer-motion via LazyMotion schlank [38]

## Stage 4 — Verifikation

vitest + tsc + eslint + next build, Browser-Smoke-Test aller Routen, Code-Review-Pass.

## Status (abgeschlossen 2026-06-10)

Alle Stages umgesetzt. Zusätzliches adversariales Abschluss-Review (3 Reviewer) fand 12 weitere Probleme in den eigenen Fixes — alle behoben, u.a.: BBT-Gap-Regel verhinderte Bestätigungen (jetzt Lückenmitte-Datierung), stale storage-Events, Replace-Import-Leer-Wipe, Rotation-Shrink-Guard, presentSettings vs. zod-Defaults, LazyMotion domMax für layoutId.

Endstand: 48 Tests grün, tsc + ESLint sauber, Produktions-Build ok (lokal + basePath-Simulation), Browser-Smoke-Tests aller Routen + EntryDrawer-Interaktionsflow fehlerfrei (hell/dunkel/leer).
