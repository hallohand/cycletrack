// CycleTrack - Zyklus Tracker App

// Data Storage
const STORAGE_KEY = 'cycletrack_data';

// Initialize
let currentData = loadData();
let currentChart = null;
let currentMonth = new Date();

// Load data from localStorage
function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        return JSON.parse(stored);
    }
    return {
        entries: {},
        cycleLength: 28,
        periodLength: 5,
        lutealPhase: 14
    };
}

// Save data to localStorage
function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
}

// Show saved indicator
function showSaved() {
    const indicator = document.getElementById('savedIndicator');
    indicator.classList.add('show');
    setTimeout(() => {
        indicator.classList.remove('show');
    }, 2000);
}

// Navigation
function showHome() {
    hideAllViews();
    document.getElementById('homeView').classList.remove('hidden');
    updateNav('home');
    updateDashboard();
}

function showAddEntry() {
    hideAllViews();
    document.getElementById('addEntryView').classList.remove('hidden');
    updateNav('entry');
    document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];
    loadEntryForDate(new Date().toISOString().split('T')[0]);
}

function showChart() {
    hideAllViews();
    document.getElementById('chartView').classList.remove('hidden');
    updateNav('chart');
    setTimeout(() => {
        renderChart();
        renderCalendar();
    }, 100);
}

function showImportExport() {
    hideAllViews();
    document.getElementById('importExportView').classList.remove('hidden');
    updateNav('import');
}

function hideAllViews() {
    document.getElementById('homeView').classList.add('hidden');
    document.getElementById('addEntryView').classList.add('hidden');
    document.getElementById('chartView').classList.add('hidden');
    document.getElementById('importExportView').classList.add('hidden');
}

function updateNav(view) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const navItems = document.querySelectorAll('.nav-item');
    if (view === 'home') navItems[0].classList.add('active');
    if (view === 'entry') navItems[1].classList.add('active');
    if (view === 'chart') navItems[2].classList.add('active');
    if (view === 'import') navItems[3].classList.add('active');
}

// DASHBOARD - Neue Funktion
function updateDashboard() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Sortiere alle Einträge nach Datum
    const allEntries = Object.values(currentData.entries).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    if (allEntries.length === 0) {
        document.getElementById('dashboardContent').innerHTML = `
            <div class="welcome-card">
                <h2>Willkommen bei CycleTrack</h2>
                <p>Beginne damit, deine ersten Zyklusdaten einzugeben.</p>
                <button class="btn" onclick="showAddEntry()">Ersten Eintrag erstellen</button>
            </div>
        `;
        return;
    }
    
    // Finde letzte Periode
    const periodEntries = allEntries.filter(e => e.period);
    const lastPeriod = periodEntries.length > 0 ? periodEntries[periodEntries.length - 1] : null;
    
    // Berechne aktuellen Zyklustag
    let cycleDay = 0;

    if (lastPeriod) {
        const lastPeriodDate = new Date(lastPeriod.date);
        cycleDay = Math.floor((today - lastPeriodDate) / (1000 * 60 * 60 * 24)) + 1;
    }

    // Heutiger Eintrag - MUSS vor getFertilityStatus definiert werden
    const todayEntry = currentData.entries[todayStr];
    
    // Get period predictions using new function
    const periodPrediction = calculateNextPeriods(allEntries);
    
    // Finde Eisprung (Temperaturanstieg) - global für getFertilityStatus
    const ovulationInfo = findOvulation(allEntries);
    
    // Berechne nächsten Eisprung basierend auf individueller Lutealphase
    let nextOvulationDate = null;
    let daysToNextOvulation = null;
    let ovulationConfidence = 'low';
    
    if (lastPeriod && periodPrediction.nextPeriod) {
        // Verwende individuelle Lutealphase (nicht fix 14 Tage)
        const lutealPhase = calculateIndividualLutealPhase();
        nextOvulationDate = new Date(periodPrediction.nextPeriod);
        nextOvulationDate.setDate(nextOvulationDate.getDate() - lutealPhase);
        daysToNextOvulation = Math.ceil((nextOvulationDate - today) / (1000 * 60 * 60 * 24));
        
        // Wenn wir historische Lutealphase-Daten haben, ist die Vorhersage besser
        ovulationConfidence = currentData.lutealPhaseHistory && currentData.lutealPhaseHistory.length > 0 ? 'medium' : 'low';
    }
    
    // Fruchtbarkeitsstatus - nur anzeigen wenn wir genug Daten haben
    const fertilityStatus = getFertilityStatus(cycleDay, daysToNextOvulation, ovulationConfidence, todayEntry, periodPrediction.nextPeriod, ovulationInfo);
    
    // Dashboard HTML erstellen
    let html = `
        <div class="dashboard-grid">
            <!-- Hauptstatus Karte -->
            <div class="dashboard-card main-status ${fertilityStatus.class}">
                <div class="status-icon">${fertilityStatus.icon}</div>
                <div class="status-title">${fertilityStatus.title}</div>
                <div class="status-subtitle">${fertilityStatus.subtitle}</div>
            </div>
            
            <!-- Zyklustag -->
            <div class="dashboard-card">
                <div class="card-label">Zyklustag</div>
                <div class="card-value">${cycleDay > 0 ? cycleDay : '-'}</div>
                <div class="card-hint">${lastPeriod ? 'Seit letzter Periode' : 'Noch keine Daten'}</div>
            </div>
            
            <!-- Nächste Periode -->
            <div class="dashboard-card ${periodPrediction.daysToNext <= 3 ? 'urgent' : ''}">
                <div class="card-label">Nächste Periode</div>
                <div class="card-value">${periodPrediction.daysToNext !== null ? formatDays(periodPrediction.daysToNext) : '-'}</div>
                <div class="card-hint">${periodPrediction.nextPeriod ? formatDate(periodPrediction.nextPeriod) : ''}</div>
            </div>
            
            <!-- Nächster Eisprung -->
            <div class="dashboard-card ${daysToNextOvulation >= -2 && daysToNextOvulation <= 2 ? 'highlight' : ''}">
                <div class="card-label">Nächster Eisprung</div>
                <div class="card-value">${daysToNextOvulation !== null ? formatDays(daysToNextOvulation) : '-'}</div>
                <div class="card-hint">${nextOvulationDate ? formatDate(nextOvulationDate) : ''}</div>
            </div>
    `;
    
    // Letzter Eisprung (wenn vorhanden)
    if (ovulationInfo.lastOvulation) {
        const daysSinceOvulation = Math.floor((today - new Date(ovulationInfo.lastOvulation.date)) / (1000 * 60 * 60 * 24));
        html += `
            <div class="dashboard-card">
                <div class="card-label">Letzter Eisprung</div>
                <div class="card-value">${daysSinceOvulation} Tage</div>
                <div class="card-hint">${formatDate(new Date(ovulationInfo.lastOvulation.date))}</div>
            </div>
        `;
    }
    
    // Durchschnittlicher Zyklus
    const avgCycle = calculateAverageCycleLength();
    if (avgCycle > 0) {
        html += `
            <div class="dashboard-card">
                <div class="card-label">Ø Zykluslänge</div>
                <div class="card-value">${avgCycle} Tage</div>
                <div class="card-hint">Berechnet aus ${periodEntries.length} Perioden</div>
            </div>
        `;
    }
    
    // Heutige Daten
    if (todayEntry) {
        html += `
            <div class="dashboard-card today-data">
                <div class="card-label">Heute eingetragen</div>
                <div class="today-items">
                    ${todayEntry.temperature ? `<span class="today-item">${todayEntry.temperature}°C</span>` : ''}
                    ${todayEntry.period ? `<span class="today-item period">Periode: ${todayEntry.period}</span>` : ''}
                    ${todayEntry.cervix ? `<span class="today-item">${mapCervix(todayEntry.cervix)}</span>` : ''}
                </div>
            </div>
        `;
    }
    
    html += `</div>`;
    
    document.getElementById('dashboardContent').innerHTML = html;
}

// Hilfsfunktionen für Dashboard
function calculateAverageCycleLength() {
    const periodEntries = Object.values(currentData.entries)
        .filter(e => e.period)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (periodEntries.length < 2) return 28; // Default

    let totalDays = 0;
    let count = 0;

    for (let i = 1; i < periodEntries.length; i++) {
        const prev = new Date(periodEntries[i - 1].date);
        const curr = new Date(periodEntries[i].date);
        const days = Math.floor((curr - prev) / (1000 * 60 * 60 * 24));
        if (days > 20 && days < 40) { // Plausibilitätscheck
            totalDays += days;
            count++;
        }
    }

    return count > 0 ? Math.round(totalDays / count) : 28;
}

function calculateNextPeriods(allEntries) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = {
        nextPeriod: null,
        nextPeriod2: null, // Second period prediction
        daysToNext: null,
        daysToNext2: null
    };

    // Get individual luteal phase
    const lutealPhase = calculateIndividualLutealPhase();
    const avgCycle = calculateAverageCycleLength();

    // Find last period
    const periodEntries = allEntries.filter(e => e.period).sort((a, b) =>
        new Date(a.date) - new Date(b.date)
    );

    if (periodEntries.length === 0) return result;

    const lastPeriod = new Date(periodEntries[periodEntries.length - 1].date);

    // Calculate next period (start date)
    const nextPeriod = new Date(lastPeriod);
    nextPeriod.setDate(nextPeriod.getDate() + avgCycle);
    result.nextPeriod = nextPeriod;
    result.daysToNext = Math.ceil((nextPeriod - today) / (1000 * 60 * 60 * 24));

    // Calculate second period - starts AFTER next period ends + cycle length
    // Predicted period is always 5 days
    const nextPeriodEnd = new Date(nextPeriod);
    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 4); // +4 days = 5 days total (day 0,1,2,3,4)
    
    const nextPeriod2 = new Date(nextPeriodEnd);
    nextPeriod2.setDate(nextPeriod2.getDate() + avgCycle);
    result.nextPeriod2 = nextPeriod2;
    result.daysToNext2 = Math.ceil((nextPeriod2 - today) / (1000 * 60 * 60 * 24));

    // Calculate fertile windows (5 days before ovulation until ovulation day)
    // Ovulation = period start - luteal phase
    
    // First fertile window
    const ovulation1 = new Date(nextPeriod);
    ovulation1.setDate(ovulation1.getDate() - lutealPhase);
    const fertileWindow1Start = new Date(ovulation1);
    fertileWindow1Start.setDate(fertileWindow1Start.getDate() - 5); // 5 days before
    result.fertileWindow1 = {
        start: fertileWindow1Start,
        ovulation: ovulation1,
        end: ovulation1 // ends on ovulation day
    };
    
    // Second fertile window
    const ovulation2 = new Date(nextPeriod2);
    ovulation2.setDate(ovulation2.getDate() - lutealPhase);
    const fertileWindow2Start = new Date(ovulation2);
    fertileWindow2Start.setDate(fertileWindow2Start.getDate() - 5); // 5 days before
    result.fertileWindow2 = {
        start: fertileWindow2Start,
        ovulation: ovulation2,
        end: ovulation2
    };

    return result;
}

function calculateIndividualLutealPhase() {
    // Simplified: use stored value or default
    return currentData.lutealPhase || 14;
}

function findOvulation(entries) {
    // Finde Temperaturanstieg (3 aufeinanderfolgende Tage über 0,2°C höher als vorher)
    const tempEntries = entries.filter(e => e.temperature);
    
    for (let i = 6; i < tempEntries.length - 2; i++) {
        const prev6 = tempEntries.slice(i - 6, i).map(e => e.temperature);
        const next3 = tempEntries.slice(i, i + 3).map(e => e.temperature);
        
        const maxPrev6 = Math.max(...prev6);
        const minNext3 = Math.min(...next3);
        
        if (minNext3 > maxPrev6 + 0.2) {
            return { lastOvulation: tempEntries[i] };
        }
    }
    
    return { lastOvulation: null };
}

function getFertilityStatus(cycleDay, daysToOvulation, confidence, todayEntry, nextPeriodDate, ovulationInfo) {
    const today = new Date();
    
    // Periode hat Priorität
    if (cycleDay <= 5) {
        return { 
            class: 'period', 
            icon: '🩸', 
            title: 'Periode', 
            subtitle: 'Menstruationsphase' 
        };
    }
    
    // Wenn wir einen LH-Test haben, der positiv ist -> Peak Fruchtbarkeit
    if (todayEntry && todayEntry.lhTest === 'positive') {
        return { 
            class: 'ovulation', 
            icon: '🔥', 
            title: 'Peak-Fruchtbarkeit', 
            subtitle: 'LH-Anstieg erkannt' 
        };
    }
    
    // Wenn Eisprung durch Temperatur bestätigt wurde
    if (ovulationInfo.lastOvulation) {
        const daysSinceOvulation = Math.floor((today - new Date(ovulationInfo.lastOvulation.date)) / (1000 * 60 * 60 * 24));
        if (daysSinceOvulation >= 0 && daysSinceOvulation <= 2) {
            return { 
                class: 'ovulation', 
                icon: '🥚', 
                title: 'Eisprung bestätigt', 
                subtitle: 'Temperaturanstieg erkannt' 
            };
        }
        if (daysSinceOvulation > 2) {
            return { 
                class: 'normal', 
                icon: '😌', 
                title: 'Nicht fruchtbar', 
                subtitle: 'Nach Eisprung' 
            };
        }
    }
    
    // Nur "fruchtbar" anzeigen wenn wir gute Daten haben
    if (confidence === 'medium' || confidence === 'high') {
        if (daysToOvulation >= -1 && daysToOvulation <= 1) {
            return { 
                class: 'ovulation', 
                icon: '🥚', 
                title: 'Eisprung wahrscheinlich', 
                subtitle: 'Höchste Fruchtbarkeit' 
            };
        }
        if (daysToOvulation >= -5 && daysToOvulation <= 2) {
            return { 
                class: 'fertile', 
                icon: '🌱', 
                title: 'Fruchtbar', 
                subtitle: 'Fruchtbare Phase' 
            };
        }
    }
    
    // Bei niedriger Konfidenz: eher unbekannt/unbestimmt anzeigen
    if (confidence === 'low' || daysToOvulation === null) {
        return { 
            class: 'unknown', 
            icon: '❓', 
            title: 'Unbekannt', 
            subtitle: 'Nicht genug Daten' 
        };
    }
    
    return { 
        class: 'normal', 
        icon: '😌', 
        title: 'Nicht fruchtbar', 
        subtitle: 'Infertile Phase' 
    };
}

function formatDays(days) {
    if (days === 0) return 'Heute';
    if (days === 1) return 'Morgen';
    if (days === -1) return 'Gestern';
    if (days < 0) return `Vor ${Math.abs(days)} Tagen`;
    return `In ${days} Tagen`;
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('de-DE', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
    });
}

function mapCervix(value) {
    const map = {
        'dry': 'Trocken',
        'sticky': 'Klebrig',
        'creamy': 'Cremig',
        'watery': 'Wässrig',
        'eggwhite': 'Eiweißartig'
    };
    return map[value] || value;
}

// Entry Form Functions
let currentSelections = {
    cervix: null,
    lh: null,
    sex: null,
    mood: null,
    symptoms: []
};

function selectOption(element, type) {
    // Remove selected from all in group
    const parent = element.parentElement;
    parent.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
    
    // Add to current
    element.classList.add('selected');
    currentSelections[type] = element.dataset.value;
}

function toggleSymptom(element) {
    element.classList.toggle('selected');
    const value = element.dataset.value;
    
    if (element.classList.contains('selected')) {
        if (!currentSelections.symptoms.includes(value)) {
            currentSelections.symptoms.push(value);
        }
    } else {
        currentSelections.symptoms = currentSelections.symptoms.filter(s => s !== value);
    }
}

function loadEntryForDate(date) {
    const entry = currentData.entries[date];
    if (!entry) {
        // Reset form
        document.getElementById('temperature').value = '';
        document.getElementById('periodFlow').value = '';
        document.getElementById('notes').value = '';
        document.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
        currentSelections = { cervix: null, lh: null, sex: null, mood: null, symptoms: [] };
        return;
    }
    
    if (entry.temperature) document.getElementById('temperature').value = entry.temperature;
    if (entry.period) document.getElementById('periodFlow').value = entry.period;
    if (entry.notes) document.getElementById('notes').value = entry.notes;
    
    // Restore selections
    if (entry.cervix) {
        document.querySelector(`.option-item[data-value="${entry.cervix}"]`).classList.add('selected');
        currentSelections.cervix = entry.cervix;
    }
    if (entry.lhTest) {
        document.querySelector(`[onclick="selectOption(this, 'lh')"][data-value="${entry.lhTest}"]`).classList.add('selected');
        currentSelections.lh = entry.lhTest;
    }
    if (entry.sex) {
        document.querySelector(`[onclick="selectOption(this, 'sex')"][data-value="${entry.sex}"]`).classList.add('selected');
        currentSelections.sex = entry.sex;
    }
    if (entry.mood) {
        document.querySelector(`[onclick="selectOption(this, 'mood')"][data-value="${entry.mood}"]`).classList.add('selected');
        currentSelections.mood = entry.mood;
    }
    if (entry.symptoms) {
        entry.symptoms.forEach(sym => {
            const el = document.querySelector(`[onclick="toggleSymptom(this)"][data-value="${sym}"]`);
            if (el) {
                el.classList.add('selected');
                currentSelections.symptoms.push(sym);
            }
        });
    }
}

function saveEntry() {
    const date = document.getElementById('entryDate').value;
    if (!date) {
        alert('Bitte wähle ein Datum aus');
        return;
    }
    
    const entry = {
        date: date,
        temperature: parseFloat(document.getElementById('temperature').value) || null,
        period: document.getElementById('periodFlow').value || null,
        cervix: currentSelections.cervix,
        lhTest: currentSelections.lh,
        sex: currentSelections.sex,
        mood: currentSelections.mood,
        symptoms: currentSelections.symptoms,
        notes: document.getElementById('notes').value || null
    };
    
    currentData.entries[date] = entry;
    saveData();
    
    // Reset form
    document.getElementById('temperature').value = '';
    document.getElementById('periodFlow').value = '';
    document.getElementById('notes').value = '';
    document.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
    currentSelections = { cervix: null, lh: null, sex: null, mood: null, symptoms: [] };
    
    showSaved();
    showHome();
}

// Chart Rendering - Zeigt aktuellen Zyklus ab Zyklustag 1
function renderChart() {
    const ctx = document.getElementById('tempChart').getContext('2d');
    
    // Finde den Beginn des aktuellen Zyklus (letzte Periode)
    const allEntries = Object.values(currentData.entries).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    const periodEntries = allEntries.filter(e => e.period);
    if (periodEntries.length === 0) {
        // Keine Perioden - zeige letzte 30 Tage
        renderDefaultChart(ctx);
        return;
    }
    
    // Letzter Zyklusbeginn (erster Tag mit Periode)
    const lastPeriodStart = periodEntries[periodEntries.length - 1];
    const cycleStartDate = new Date(lastPeriodStart.date);
    
    // Sammle alle Daten ab Zyklusbeginn (max 32 Tage)
    const days = [];
    const temps = [];
    const pointColors = [];
    const pointSizes = [];
    
    const maxDays = 32;
    for (let i = 0; i < maxDays; i++) {
        const date = new Date(cycleStartDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        days.push(`ZT ${i + 1}`);
        
        const entry = currentData.entries[dateStr];
        if (entry && entry.temperature) {
            temps.push(entry.temperature);
            // Markiere Periodentage
            if (entry.period) {
                pointColors.push('#C2185B'); // Dunkelrot für Periode
                pointSizes.push(6);
            } else {
                pointColors.push('#E91E63');
                pointSizes.push(4);
            }
        } else {
            temps.push(null);
            pointColors.push('#E91E63');
            pointSizes.push(0);
        }
    }
    
    // Berechne Coverline nach NFP-Regeln
    // 1. Finde Temperaturanstieg (3 aufeinanderfolgende Tage höher als vorherige 6)
    // 2. Höchste der 6 Temps vor Anstieg + 0,1°C
    
    let coverlineValue = null;
    let ovulationDay = null;
    
    // Alle gültigen Temperaturen sammeln
    const tempData = temps.map((t, i) => ({ temp: t, day: i })).filter(d => d.temp !== null);
    
    console.log('Temperaturdaten:', tempData.length, 'Werte');
    
    if (tempData.length >= 9) { // Mindestens 6 vor + 3 nach
        for (let i = 6; i < tempData.length - 2; i++) {
            const prev6 = tempData.slice(i - 6, i).map(d => d.temp);
            const next3 = tempData.slice(i, i + 3).map(d => d.temp);
            
            const maxPrev6 = Math.max(...prev6);
            const minNext3 = Math.min(...next3);
            
            console.log(`Tag ${tempData[i].day}: maxPrev6=${maxPrev6.toFixed(2)}, minNext3=${minNext3.toFixed(2)}`);
            
            // Prüfe: Sind alle 3 nächsten Tage höher als alle 6 vorherigen?
            if (minNext3 > maxPrev6) {
                // Zusätzlich: 3. Tag muss mindestens 0,2°C höher sein als maxPrev6
                if (next3[2] > maxPrev6 + 0.2) {
                    ovulationDay = tempData[i].day;
                    coverlineValue = maxPrev6 + 0.1;
                    console.log('Eisprung erkannt an Tag', ovulationDay, 'Coverline:', coverlineValue.toFixed(2));
                    break;
                }
            }
        }
    }
    
    // Fallback: Wenn keine Ovulation erkannt, aber genug Daten
    // Zeige eine vorläufige Coverline basierend auf den 6 niedrigsten Temperaturen
    if (coverlineValue === null && tempData.length >= 6) {
        const allTemps = tempData.map(d => d.temp);
        const sorted = [...allTemps].sort((a, b) => a - b);
        const sixLowest = sorted.slice(0, 6);
        const highestOfSix = Math.max(...sixLowest);
        coverlineValue = highestOfSix + 0.1;
        console.log('Fallback Coverline:', coverlineValue.toFixed(2));
    }
    
    // Erstelle Coverline-Array (nur ab Ovulation oder für alle Tage)
    const coverlineData = temps.map(() => coverlineValue);
    
    if (currentChart) {
        currentChart.destroy();
    }
    
    const datasets = [{
        label: 'Temperatur',
        data: temps,
        borderColor: '#E91E63',
        backgroundColor: 'rgba(233, 30, 99, 0.1)',
        borderWidth: 2,
        pointRadius: pointSizes,
        pointBackgroundColor: pointColors,
        pointBorderColor: pointColors,
        tension: 0.3,
        spanGaps: true
    }];
    
    // Füge Coverline hinzu wenn berechnet
    if (coverlineValue !== null) {
        datasets.push({
            label: 'Coverline',
            data: coverlineData,
            borderColor: '#4CAF50',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
    }
    
    currentChart = new Chart(ctx, {
        type: 'line',
        data: { labels: days, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: { 
                    display: true,
                    position: 'top',
                    labels: { usePointStyle: true }
                },
                annotation: ovulationDay !== null ? {
                    annotations: {
                        ovulation: {
                            type: 'line',
                            xMin: ovulationDay,
                            xMax: ovulationDay,
                            borderColor: '#FF9800',
                            borderWidth: 2,
                            label: { content: 'Eisprung', enabled: true }
                        }
                    }
                } : {}
            },
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 10,
                        font: { size: 10 }
                    }
                },
                y: {
                    min: 35.5,
                    max: 37.5,
                    title: { display: true, text: '°C' }
                }
            }
        }
    });
}

// Fallback wenn keine Periodendaten
function renderDefaultChart(ctx) {
    const days = [];
    const temps = [];
    
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        days.push(date.getDate() + '.');
        
        const entry = currentData.entries[dateStr];
        temps.push(entry && entry.temperature ? entry.temperature : null);
    }
    
    if (currentChart) currentChart.destroy();
    
    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'Temperatur',
                data: temps,
                borderColor: '#E91E63',
                backgroundColor: 'rgba(233, 30, 99, 0.1)',
                borderWidth: 2,
                pointRadius: 4,
                tension: 0.3,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { min: 35.5, max: 37.5, title: { display: true, text: '°C' } }
            }
        }
    });
}

// Calendar Rendering
function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    document.getElementById('currentMonth').textContent =
        new Date(year, month).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarEl = document.getElementById('calendar');
    calendarEl.innerHTML = '';

    const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    weekdays.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.textContent = day;
        calendarEl.appendChild(header);
    });

    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
        calendarEl.appendChild(document.createElement('div'));
    }

    const today = new Date().toISOString().split('T')[0];

    // Get period predictions
    const allEntries = Object.values(currentData.entries);
    const periodPrediction = calculateNextPeriods(allEntries);

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const entry = currentData.entries[dateStr];

        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.innerHTML = `<div>${day}</div>`;

        if (dateStr === today) {
            dayEl.classList.add('today');
        }

        // Track what type of day this is (to prevent overlapping styles)
        let dayType = null;
        
        // Check if this day is within a predicted period window (5 days) - PRIORITY 1
        if (periodPrediction.nextPeriod) {
            const nextPeriodStart = new Date(periodPrediction.nextPeriod);
            const nextPeriodEnd = new Date(nextPeriodStart);
            nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 4); // 5 days total
            
            const currentDate = new Date(dateStr);
            if (currentDate >= nextPeriodStart && currentDate <= nextPeriodEnd) {
                dayEl.classList.add('predicted-period');
                dayType = 'period';
            }
        }

        if (!dayType && periodPrediction.nextPeriod2) {
            const nextPeriod2Start = new Date(periodPrediction.nextPeriod2);
            const nextPeriod2End = new Date(nextPeriod2Start);
            nextPeriod2End.setDate(nextPeriod2End.getDate() + 4); // 5 days total
            
            const currentDate = new Date(dateStr);
            if (currentDate >= nextPeriod2Start && currentDate <= nextPeriod2End) {
                dayEl.classList.add('predicted-period-2');
                dayType = 'period2';
            }
        }

        // Check if this day is within a predicted fertile window (pastel blue) - PRIORITY 2
        if (!dayType && periodPrediction.fertileWindow1) {
            const fw1Start = new Date(periodPrediction.fertileWindow1.start);
            const fw1End = new Date(periodPrediction.fertileWindow1.end);
            const fw1Ovulation = new Date(periodPrediction.fertileWindow1.ovulation);
            const currentDate = new Date(dateStr);
            
            if (currentDate >= fw1Start && currentDate <= fw1End) {
                dayEl.classList.add('predicted-fertile');
                dayType = 'fertile';
                if (currentDate.getTime() === fw1Ovulation.getTime()) {
                    dayEl.classList.add('predicted-ovulation');
                    dayEl.innerHTML += `<div class="ov-label">🥚</div>`;
                }
            }
        }

        if (!dayType && periodPrediction.fertileWindow2) {
            const fw2Start = new Date(periodPrediction.fertileWindow2.start);
            const fw2End = new Date(periodPrediction.fertileWindow2.end);
            const fw2Ovulation = new Date(periodPrediction.fertileWindow2.ovulation);
            const currentDate = new Date(dateStr);
            
            if (currentDate >= fw2Start && currentDate <= fw2End) {
                dayEl.classList.add('predicted-fertile-2');
                dayType = 'fertile2';
                if (currentDate.getTime() === fw2Ovulation.getTime()) {
                    dayEl.classList.add('predicted-ovulation');
                    dayEl.innerHTML += `<div class="ov-label">🥚</div>`;
                }
            }
        }

        if (entry) {
            if (entry.period) {
                dayEl.classList.add('period');
            } else if (entry.cervix === 'eggwhite' || entry.lhTest === 'positive') {
                dayEl.classList.add('ovulation');
            } else if (entry.cervix === 'watery') {
                dayEl.classList.add('fertile');
            }

            if (entry.temperature) {
                dayEl.innerHTML += `<div class="temp">${entry.temperature.toFixed(1)}°</div>`;
            }
        }

        dayEl.onclick = () => {
            document.getElementById('entryDate').value = dateStr;
            showAddEntry();
            loadEntryForDate(dateStr);
        };

        calendarEl.appendChild(dayEl);
    }
}

function changeMonth(delta) {
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    renderCalendar();
}

// Import/Export
function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('importText').value = e.target.result;
        importFromText();
    };
    reader.readAsText(file);
}

function importFromText() {
    const text = document.getElementById('importText').value.trim();
    if (!text) {
        alert('Bitte gib CSV-Daten ein');
        return;
    }

    let importedCount = 0;

    try {
        if (text.startsWith('{')) {
            importedCount = ImportExport.importFromJSON(text);
        } else {
            importedCount = ImportExport.importFromCSV(text);
        }

        const resultDiv = document.getElementById('importResult');
        if (importedCount > 0) {
            resultDiv.innerHTML = `<div style="color: #4CAF50; font-weight: 500;">${importedCount} Einträge importiert</div>`;
            resultDiv.style.display = 'block';
            document.getElementById('importText').value = '';
            showSaved();
        } else {
            resultDiv.innerHTML = `<div style="color: #FF9800;">Keine Einträge gefunden</div>`;
            resultDiv.style.display = 'block';
        }
    } catch (e) {
        console.error(e);
        alert('Fehler beim Import: ' + e.message);
    }
}

// Update Funktion
let newWorker = null;

function checkForUpdates() {
    if (!('serviceWorker' in navigator)) return;
    
    navigator.serviceWorker.register('sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
            newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Neue Version verfügbar
                    document.getElementById('updateNotification').style.display = 'flex';
                }
            });
        });
    });
    
    // Prüfe alle 60 Sekunden auf Updates
    setInterval(() => {
        navigator.serviceWorker.ready.then(reg => {
            reg.update();
        });
    }, 60000);
}

function updateApp() {
    if (newWorker) {
        newWorker.postMessage('skipWaiting');
        window.location.reload();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Set today's date in header
    const today = new Date();
    document.getElementById('headerDate').textContent = today.toLocaleDateString('de-DE', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    showHome();
    
    // Register service worker und prüfe auf Updates
    checkForUpdates();
    
    // Date change listener
    document.getElementById('entryDate').addEventListener('change', (e) => {
        loadEntryForDate(e.target.value);
    });
});