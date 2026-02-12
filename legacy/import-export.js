// CycleTrack - Import/Export Funktionen

// CSV Import/Export Funktionen
const ImportExport = {
    
    // Exportiere alle Daten als CSV
    exportToCSV: function() {
        const entries = Object.values(currentData.entries);
        if (entries.length === 0) {
            alert('Keine Daten zum Exportieren vorhanden');
            return;
        }
        
        // CSV Header
        let csv = 'Datum,Temperatur,Periode,Zervix,LH-Test,Geschlechtsverkehr,Stimmung,Symptome,Notizen\n';
        
        // Sortiere nach Datum
        entries.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        entries.forEach(entry => {
            const symptoms = entry.symptoms ? entry.symptoms.join(';') : '';
            const line = [
                entry.date,
                entry.temperature || '',
                entry.period || '',
                entry.cervix || '',
                entry.lhTest || '',
                entry.sex || '',
                entry.mood || '',
                symptoms,
                entry.notes || ''
            ].map(field => `"${field}"`).join(',');
            
            csv += line + '\n';
        });
        
        // Download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `cycletrack_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    },
    
    // CSV Import mit Format-Erkennung
    importFromCSV: function(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        // Prüfe ob es das Femometer-Format ist
        const isFemometerFormat = headers.includes('Datum') && headers.includes('Zyklustag');
        
        if (isFemometerFormat) {
            return this.importFemometerCSV(csvText);
        }
        
        // Standard CSV Import
        let importedCount = 0;
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Parse CSV line (einfache Version)
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            
            const entry = {
                date: values[0],
                temperature: values[1] ? parseFloat(values[1]) : null,
                period: values[2] || null,
                cervix: values[3] || null,
                lhTest: values[4] || null,
                sex: values[5] || null,
                mood: values[6] || null,
                symptoms: values[7] ? values[7].split(';') : [],
                notes: values[8] || null
            };
            
            if (entry.date) {
                currentData.entries[entry.date] = entry;
                importedCount++;
            }
        }
        
        saveData();
        return importedCount;
    },
    
    // Femometer CSV Import (spezielles Format)
    importFemometerCSV: function(csvText) {
        const lines = csvText.trim().split('\n');
        let importedCount = 0;
        let errors = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            try {
                // Parse CSV mit Anführungszeichen-Handling
                const values = this.parseCSVLine(line);
                
                // Datum konvertieren (DD.MM.YYYY -> YYYY-MM-DD)
                const dateStr = values[0];
                const dateParts = dateStr.split('.');
                const date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
                
                // Temperatur extrahieren (36.86°C -> 36.86)
                const tempStr = values[6];
                const temperature = tempStr ? parseFloat(tempStr.replace('°C', '').trim()) : null;
                
                // Periode bestimmen
                const periodDay = values[2];
                const flowAmount = values[4];
                let period = null;
                if (periodDay && periodDay !== '') {
                    // Map Flussmenge zu Perioden-Stärke
                    const flowMap = {
                        'Wenig': 'light',
                        'Mittel': 'medium',
                        'Viel': 'heavy'
                    };
                    period = flowMap[flowAmount] || 'medium';
                }
                
                // Zervixschleim
                const cervixRaw = values[9];
                const cervixMap = {
                    'Trocken': 'dry',
                    'Klebrig': 'sticky',
                    'Cremig': 'creamy',
                    'Wässrig': 'watery',
                    'Eiweiß': 'eggwhite',
                    'Eiweißartig': 'eggwhite'
                };
                const cervix = cervixMap[cervixRaw] || null;
                
                // Sex
                const sexRaw = values[7];
                let sex = null;
                if (sexRaw && sexRaw.includes('Ungeschützt')) {
                    sex = 'unprotected';
                } else if (sexRaw && sexRaw.includes('Geschützt')) {
                    sex = 'protected';
                }
                
                // LH Test
                const lhRaw = values[13];
                let lhTest = null;
                if (lhRaw === 'Hoch') {
                    lhTest = 'positive';
                }
                
                // Stimmung
                const moodRaw = values[11];
                const moodMap = {
                    'Traurig': 'sad',
                    'Gefühlvoll': 'emotional',
                    'Glücklich': 'happy',
                    'Energiegeladen': 'energetic',
                    'Ängstlich': 'anxious',
                    'Gereizt': 'irritable'
                };
                const mood = moodMap[moodRaw] || null;
                
                // Symptome parsen
                const symptomsRaw = values[12];
                let symptoms = [];
                if (symptomsRaw) {
                    symptoms = symptomsRaw.split(',').map(s => {
                        // Map deutsche Symptome zu internen Keys
                        const symptomMap = {
                            'Krämpfe': 'cramps',
                            'Empfindliche Brüste': 'tender',
                            'Brustschmerzen': 'tender',
                            'Wunde Nippel': 'tender',
                            'Schmerzen im rechten Unterbauch': 'cramps',
                            'Ovulationsschmerzen': 'cramps',
                            'Erkältung': 'headache',
                            'Blähungen': 'bloating',
                            'Kopfschmerzen': 'headache',
                            'Rückenschmerzen': 'backache',
                            'Müdigkeit': 'fatigue',
                            'Hautunreinheiten': 'acne',
                            'Übelkeit': 'nausea'
                        };
                        return symptomMap[s.trim()] || s.trim();
                    }).filter(s => s);
                }
                
                // Notizen (inkl. Schmerzen)
                const painRaw = values[5];
                const notes = painRaw && painRaw !== '' ? `Schmerzen: ${painRaw}` : null;
                
                // Entry erstellen
                const entry = {
                    date: date,
                    temperature: temperature,
                    period: period,
                    cervix: cervix,
                    lhTest: lhTest,
                    sex: sex,
                    mood: mood,
                    symptoms: symptoms,
                    notes: notes
                };
                
                // Nur speichern wenn wir Daten haben
                if (date && (temperature || period || cervix || sex || symptoms.length > 0 || notes)) {
                    currentData.entries[date] = entry;
                    importedCount++;
                }
            } catch (e) {
                errors.push(`Zeile ${i + 1}: ${e.message}`);
            }
        }
        
        saveData();
        console.log('Import errors:', errors);
        return importedCount;
    },
    
    // Hilfsfunktion zum Parsen von CSV-Zeilen
    parseCSVLine: function(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        return values;
    },
    
    // Femometer-ähnliches Format Import
    importFromFemometerFormat: function(data) {
        // Format aus der Femometer-App
        let importedCount = 0;
        
        data.forEach(record => {
            const entry = {
                date: record.date,
                temperature: record.temperature ? parseFloat(record.temperature) : null,
                period: this.mapFemometerPeriod(record.period),
                cervix: this.mapFemometerCervix(record.cervicalMucus),
                lhTest: record.ovulationTest || null,
                sex: record.intercourse || null,
                mood: record.mood || null,
                symptoms: record.symptoms ? record.symptoms.split(',').map(s => s.trim()) : [],
                notes: record.note || null
            };
            
            if (entry.date) {
                currentData.entries[entry.date] = entry;
                importedCount++;
            }
        });
        
        saveData();
        return importedCount;
    },
    
    // Mapping Funktionen für Femometer-Werte
    mapFemometerPeriod: function(value) {
        if (!value) return null;
        const map = {
            'light': 'light',
            'medium': 'medium',
            'heavy': 'heavy',
            'spotting': 'spotting',
            'Leicht': 'light',
            'Mittel': 'medium',
            'Stark': 'heavy',
            'Schmierblutung': 'spotting'
        };
        return map[value] || value;
    },
    
    mapFemometerCervix: function(value) {
        if (!value) return null;
        const map = {
            'dry': 'dry',
            'sticky': 'sticky',
            'creamy': 'creamy',
            'watery': 'watery',
            'eggwhite': 'eggwhite',
            'Trocken': 'dry',
            'Klebrig': 'sticky',
            'Cremig': 'creamy',
            'Wässrig': 'watery',
            'Eiweißartig': 'eggwhite'
        };
        return map[value] || value;
    },
    
    // JSON Export (komplettes Backup)
    exportToJSON: function() {
        const dataStr = JSON.stringify(currentData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `cycletrack_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    },
    
    // JSON Import (komplettes Backup)
    importFromJSON: function(jsonText) {
        try {
            const data = JSON.parse(jsonText);
            if (data.entries) {
                currentData = data;
                saveData();
                return Object.keys(currentData.entries).length;
            }
            return 0;
        } catch (e) {
            console.error('JSON Parse Error:', e);
            return 0;
        }
    },
    
    // Manuelle Dateneingabe Hilfe
    showManualImportHelp: function() {
        const helpText = `
So importierst du deine Daten aus Femometer:

1. Öffne die Femometer-App
2. Gehe zu Einstellungen → Daten exportieren
3. Wähle CSV oder Excel-Format
4. Speichere die Datei auf deinem Handy

Oder: Gib die Daten manuell ein:
- Datum: YYYY-MM-DD Format
- Temperatur: 36.50 (mit Punkt)
- Periode: light/medium/heavy/spotting
- Zervix: dry/sticky/creamy/watery/eggwhite

Die App akzeptiert folgende Formate:
- CSV (Komma-getrennt)
- JSON (Backup-Datei)
- Manuelle Eingabe
        `;
        
        alert(helpText);
    }
};

// Datenmigrations-Helper für spezifische Formate
const DataMigration = {
    
    // Konvertiere Temperatur (Celsius/Fahrenheit)
    convertTemperature: function(temp, fromUnit) {
        if (fromUnit === 'F') {
            // Fahrenheit zu Celsius
            return ((temp - 32) * 5 / 9).toFixed(2);
        }
        return temp;
    },
    
    // Normalisiere Datum
    normalizeDate: function(dateStr) {
        // Verschiedene Formate unterstützen
        const formats = [
            /(\d{4})-(\d{2})-(\d{2})/,  // YYYY-MM-DD
            /(\d{2})\.(\d{2})\.(\d{4})/,  // DD.MM.YYYY
            /(\d{2})\/(\d{2})\/(\d{4})/,  // MM/DD/YYYY
        ];
        
        for (let format of formats) {
            const match = dateStr.match(format);
            if (match) {
                if (dateStr.includes('-')) {
                    return dateStr; // Bereits im richtigen Format
                } else if (dateStr.includes('.')) {
                    // DD.MM.YYYY zu YYYY-MM-DD
                    return `${match[3]}-${match[2]}-${match[1]}`;
                } else if (dateStr.includes('/')) {
                    // MM/DD/YYYY zu YYYY-MM-DD
                    return `${match[3]}-${match[1]}-${match[2]}`;
                }
            }
        }
        return dateStr;
    },
    
    // Batch-Import mit Validierung
    batchImport: function(records) {
        let success = 0;
        let errors = [];
        
        records.forEach((record, index) => {
            try {
                const normalizedDate = this.normalizeDate(record.date);
                
                const entry = {
                    date: normalizedDate,
                    temperature: record.temperature ? parseFloat(record.temperature) : null,
                    period: record.period || null,
                    cervix: record.cervicalMucus || record.cervix || null,
                    lhTest: record.ovulationTest || record.lhTest || null,
                    sex: record.intercourse || record.sex || null,
                    mood: record.mood || null,
                    symptoms: this.parseSymptoms(record.symptoms),
                    notes: record.note || record.notes || null
                };
                
                // Validierung
                if (entry.temperature && (entry.temperature < 35 || entry.temperature > 40)) {
                    errors.push(`Zeile ${index + 1}: Ungültige Temperatur ${entry.temperature}`);
                }
                
                if (entry.date) {
                    currentData.entries[entry.date] = entry;
                    success++;
                }
            } catch (e) {
                errors.push(`Zeile ${index + 1}: ${e.message}`);
            }
        });
        
        saveData();
        return { success, errors };
    },
    
    parseSymptoms: function(symptomsStr) {
        if (!symptomsStr) return [];
        if (Array.isArray(symptomsStr)) return symptomsStr;
        return symptomsStr.split(/[,;]/).map(s => s.trim()).filter(s => s);
    }
};

// Für globale Verwendung verfügbar machen
window.ImportExport = ImportExport;
window.DataMigration = DataMigration;