import { CycleData, CycleEntry, PeriodFlow, CervixType, LHTestResult, SexType } from './types';

export function parseFemometerCSV(csvText: string): Record<string, CycleEntry> {
    const lines = csvText.trim().split('\n');
    const entries: Record<string, CycleEntry> = {};

    // Skip header (line 0)
    for (let i = 1; i < lines.length; i++) {
        // Handle potential quoted fields containing newlines (simplified CSV split)
        // For this specific CSV structure, simple split by comma might fail if "Symptome" contains commas within quotes.
        // But looking at the sample: "Krämpfe, Brustschmerzen" is quoted.

        const row = parseCSVLine(lines[i]);
        if (row.length < 2) continue; // Empty line

        // Indices based on header:
        // 0: Datum, 1: Zyklustag, 2: Periodentag, 3: Farbe, 4: Flussmenge, 5: Schmerzen, 
        // 6: Basaltemp, 7: Sex, 8: Ovulation, 9: Zervix, 10: Schmier, 11: Stimmung, 12: Symptome, 13: LH

        const dateStr = row[0];
        const periodDay = row[2];
        const flow = row[4];
        const tempStr = row[6];
        const sexStr = row[7];
        const mucusStr = row[9];
        const spottingStr = row[10];
        const symptomsStr = row[12];
        const lhStr = row[13];

        // Parse Date: DD.MM.YYYY -> YYYY-MM-DD
        const [d, m, y] = dateStr.split('.');
        const isoDate = `${y}-${m}-${d}`;

        const entry: CycleEntry = { date: isoDate };

        // Parse Temp ('36.86°C' -> 36.86)
        if (tempStr) {
            const t = parseFloat(tempStr.replace('°C', '').replace(',', '.')); // Handle German decimal comma just in case
            if (!isNaN(t)) entry.temperature = t;
        }

        // Parse Period
        if (periodDay) {
            // Check flow
            if (flow === 'Viel') entry.period = 'heavy';
            else if (flow === 'Mittel') entry.period = 'medium';
            else if (flow === 'Wenig') entry.period = 'light';
            else entry.period = 'medium'; // Default if day exists but no flow
        }
        // Spotting column?
        if (spottingStr || flow === 'Schmierblutung') {
            entry.period = 'spotting';
        }

        // Parse Sex
        if (sexStr) {
            if (sexStr.toLowerCase().includes('ungeschützt')) entry.sex = 'unprotected';
            else if (sexStr.toLowerCase().includes('geschützt')) entry.sex = 'protected';
        }

        // Parse LH
        if (lhStr) {
            if (lhStr === 'Hoch') entry.lhTest = 'positive'; // Or peak? Usually 'Hoch' is positive.
            if (lhStr === 'Maximum' || lhStr === 'Peak') entry.lhTest = 'peak';
        }

        // Parse Mucus
        if (mucusStr) {
            if (mucusStr.includes('Eiweiß')) entry.cervix = 'eggwhite';
            else if (mucusStr.includes('Wässrig')) entry.cervix = 'watery';
            else if (mucusStr.includes('Cremig')) entry.cervix = 'creamy';
            else if (mucusStr.includes('Klebrig')) entry.cervix = 'sticky';
            else if (mucusStr.includes('Trocken')) entry.cervix = 'dry';
        }

        entries[isoDate] = entry;
    }

    return entries;
}

// Simple CSV parser handling quotes
function parseCSVLine(text: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (const char of text) {
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            result.push(cur);
            cur = '';
        } else {
            cur += char;
        }
    }
    result.push(cur);
    return result.map(s => s.trim().replace(/^"|"$/g, ''));
}
