import { z } from 'zod';

// --- Zod Schemas for import validation ---

const PeriodFlowSchema = z.enum(['light', 'medium', 'heavy', 'spotting']);
const CervixSchema = z.enum(['dry', 'sticky', 'creamy', 'watery', 'eggwhite']);
const LHTestSchema = z.enum(['negative', 'positive', 'peak']);
const SexSchema = z.enum(['protected', 'unprotected', 'none']);
const MoodSchema = z.enum(['happy', 'sad', 'anxious', 'irritated', 'energetic', 'tired']);

const CycleEntrySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss YYYY-MM-DD Format haben'),
    temperature: z.number().min(34).max(42).nullable().optional(),
    excludeTemp: z.boolean().optional(),
    period: PeriodFlowSchema.nullable().optional(),
    cervix: CervixSchema.nullable().optional(),
    lhTest: LHTestSchema.nullable().optional(),
    sex: SexSchema.nullable().optional(),
    symptoms: z.array(z.string()).optional(),
    mood: z.array(MoodSchema).optional(),
    notes: z.string().max(1000).optional(),
    isOvulation: z.boolean().optional(),
}).passthrough(); // Allow unknown fields for forward compatibility

const CycleDataSchema = z.object({
    entries: z.record(z.string(), CycleEntrySchema),
    cycleLength: z.number().int().min(15).max(60).optional().default(28),
    periodLength: z.number().int().min(1).max(15).optional().default(5),
    lutealPhase: z.number().int().min(5).max(25).optional().default(14),
}).passthrough();

export type ValidationResult = {
    success: true;
    data: z.infer<typeof CycleDataSchema>;
    warnings: string[];
} | {
    success: false;
    error: string;
    details: string[];
};

export function validateImportData(jsonString: string): ValidationResult {
    const warnings: string[] = [];

    // Step 1: Parse JSON
    let raw: any;
    try {
        raw = JSON.parse(jsonString);
    } catch (e) {
        return { success: false, error: 'Ungültiges JSON', details: [(e as Error).message] };
    }

    // Step 2: Check basic structure
    if (!raw || typeof raw !== 'object') {
        return { success: false, error: 'Kein gültiges Objekt', details: [] };
    }
    if (!raw.entries || typeof raw.entries !== 'object') {
        return { success: false, error: 'Kein "entries" Feld gefunden', details: [] };
    }

    // Step 3: Validate with Zod (lenient — skip invalid entries)
    const cleanEntries: Record<string, z.infer<typeof CycleEntrySchema>> = {};
    let skippedCount = 0;

    for (const [key, value] of Object.entries(raw.entries)) {
        const result = CycleEntrySchema.safeParse(value);
        if (result.success) {
            cleanEntries[key] = result.data;
        } else {
            skippedCount++;
            warnings.push(`Eintrag "${key}" übersprungen: ${result.error.issues[0]?.message || 'Validierungsfehler'}`);
        }
    }

    if (skippedCount > 0) {
        warnings.unshift(`${skippedCount} von ${Object.keys(raw.entries).length} Einträgen wurden übersprungen (ungültig).`);
    }

    if (Object.keys(cleanEntries).length === 0 && Object.keys(raw.entries).length > 0) {
        return { success: false, error: 'Alle Einträge waren ungültig', details: warnings };
    }

    // Step 4: Validate metadata
    const metaResult = CycleDataSchema.safeParse({ ...raw, entries: cleanEntries });
    if (!metaResult.success) {
        return { success: false, error: 'Metadaten ungültig', details: metaResult.error.issues.map(i => i.message) };
    }

    return { success: true, data: metaResult.data, warnings };
}
