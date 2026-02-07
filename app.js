// CycleTrack - Zyklus Tracker App

// Data Storage
const STORAGE_KEY = 'cycletrack_data';

// Initialize
let currentData = loadData();
let currentView = 'home';
let selectedDate = new Date().toISOString().split('T')[0];
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
    updateHomeDisplay();
}

function showAddEntry() {
    hideAllViews();
    document.getElementById('addEntryView').classList.remove('hidden');
    updateNav('entry');
    
    // Set today's date
    document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];
    
    // Load existing data for today if any
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

function hideAllViews() {
    document.getElementById('homeView').classList.add('hidden');
    document.getElementById('addEntryView').classList.add('hidden');
    document.getElementById('chartView').classList.add('hidden');
    document.getElementById('importExportView').classList.add('hidden');
}

function showImportExport() {
    hideAllViews();
    document.getElementById('importExportView').classList.remove('hidden');
    updateNav('import');
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

// Import/Export Handler
function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        document.getElementById('importText').value = content;
        importFromText();
    };

    if (file.name.endsWith('.json')) {
        reader.readAsText(file);
    } else {
        reader.readAsText(file);
    }
}

function importFromText() {
    const text = document.getElementById('importText').value.trim();
    if (!text) {
        alert('Bitte gib CSV-Daten ein oder wähle eine Datei aus');
        return;
    }

    let importedCount = 0;
    const resultDiv = document.getElementById('importResult');

    try {
        if (text.startsWith('{')) {
            // JSON Import
            importedCount = ImportExport.importFromJSON(text);
        } else {
            // CSV Import (automatische Format-Erkennung)
            importedCount = ImportExport.importFromCSV(text);
        }

        if (importedCount > 0) {
            showSaved();
            resultDiv.innerHTML = `
                <div style="background: #E8F5E9; border-left: 4px solid #4CAF50; padding: 15px; border-radius: 5px;">
                    <strong>✅ Import erfolgreich!</strong><br>
                    ${importedCount} Einträge wurden importiert.
                </div>
            `;
            resultDiv.style.display = 'block';
            document.getElementById('importText').value = '';
            
            // Nach 3 Sekunden zur Startseite
            setTimeout(() => {
                showHome();
            }, 3000);
        } else {
            resultDiv.innerHTML = `
                <div style="background: #FFF3E0; border-left: 4px solid #FF9800; padding: 15px; border-radius: 5px;">
                    <strong>⚠️ Keine Einträge importiert</strong><br>
                    Bitte prüfe das Format der Daten.
                </div>
            `;
            resultDiv.style.display = 'block';
        }
    } catch (e) {
        resultDiv.innerHTML = `
            <div style="background: #FFEBEE; border-left: 4px solid #F44336; padding: 15px; border-radius: 5px;">
                <strong>❌ Fehler beim Import</strong><br>
                ${e.message}
            </div>
        `;
        resultDiv.style.display = 'block';
        console.error(e);
    }
}

// Entry Form Handling
function selectCervix(element) {
    document.querySelectorAll('.cervix-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
}

function selectLH(element) {
    document.querySelectorAll('.lh-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
}

function selectSex(element) {
    document.querySelectorAll('.sex-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
}

function selectMood(element) {
    document.querySelectorAll('.mood-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
}

function toggleSymptom(element) {
    element.classList.toggle('selected');
}

function loadEntryForDate(date) {
    const entry = currentData.entries[date];
    if (!entry) return;
    
    // Load temperature
    if (entry.temperature) {
        document.getElementById('temperature').value = entry.temperature;
    }
    
    // Load period
    if (entry.period) {
        document.getElementById('periodFlow').value = entry.period;
    }
    
    // Load cervix
    if (entry.cervix) {
        document.querySelectorAll('.cervix-option').forEach(el => {
            if (el.dataset.value === entry.cervix) {
                el.classList.add('selected');
            }
        });
    }
    
    // Load LH test
    if (entry.lhTest) {
        document.querySelectorAll('.lh-option').forEach(el => {
            if (el.dataset.value === entry.lhTest) {
                el.classList.add('selected');
            }
        });
    }
    
    // Load sex
    if (entry.sex) {
        document.querySelectorAll('.sex-option').forEach(el => {
            if (el.dataset.value === entry.sex) {
                el.classList.add('selected');
            }
        });
    }
    
    // Load mood
    if (entry.mood) {
        document.querySelectorAll('.mood-option').forEach(el => {
            if (el.dataset.value === entry.mood) {
                el.classList.add('selected');
            }
        });
    }
    
    // Load symptoms
    if (entry.symptoms) {
        document.querySelectorAll('.symptom-item').forEach(el => {
            if (entry.symptoms.includes(el.dataset.value)) {
                el.classList.add('selected');
            }
        });
    }
    
    // Load notes
    if (entry.notes) {
        document.getElementById('notes').value = entry.notes;
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
        cervix: document.querySelector('.cervix-option.selected')?.dataset.value || null,
        lhTest: document.querySelector('.lh-option.selected')?.dataset.value || null,
        sex: document.querySelector('.sex-option.selected')?.dataset.value || null,
        mood: document.querySelector('.mood-option.selected')?.dataset.value || null,
        symptoms: Array.from(document.querySelectorAll('.symptom-item.selected')).map(el => el.dataset.value),
        notes: document.getElementById('notes').value || null
    };
    
    currentData.entries[date] = entry;
    saveData();
    
    // Clear form
    clearForm();
    
    showSaved();
    showHome();
}

function clearForm() {
    document.getElementById('temperature').value = '';
    document.getElementById('periodFlow').value = '';
    document.getElementById('notes').value = '';
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
}

// Home Display Updates
function updateHomeDisplay() {
    const today = new Date().toISOString().split('T')[0];
    const cycleInfo = calculateCycleInfo();
    
    // Update cycle day
    document.getElementById('cycleDay').textContent = cycleInfo.cycleDay || '-';
    
    // Update fertility status
    const fertilityEl = document.getElementById('fertilityStatus');
    if (cycleInfo.isFertile) {
        fertilityEl.textContent = '🌱 Fruchtbar';
        document.getElementById('fertilityCard').classList.add('active');
    } else if (cycleInfo.isPeriod) {
        fertilityEl.textContent = '🩸 Periode';
        document.getElementById('fertilityCard').classList.remove('active');
    } else {
        fertilityEl.textContent = '😌 Nicht fruchtbar';
        document.getElementById('fertilityCard').classList.remove('active');
    }
    
    // Update next period prediction
    const nextPeriod = predictNextPeriod();
    if (nextPeriod) {
        const daysUntil = Math.ceil((new Date(nextPeriod) - new Date()) / (1000 * 60 * 60 * 24));
        document.getElementById('nextPeriod').textContent = daysUntil <= 0 ? 'Heute' : `in ${daysUntil} Tagen`;
    } else {
        document.getElementById('nextPeriod').textContent = '-';
    }
}

function calculateCycleInfo() {
    const entries = Object.values(currentData.entries);
    if (entries.length === 0) {
        return { cycleDay: null, isFertile: false, isPeriod: false };
    }
    
    // Sort by date
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Find last period
    const lastPeriod = entries.filter(e => e.period).pop();
    if (!lastPeriod) {
        return { cycleDay: null, isFertile: false, isPeriod: false };
    }
    
    const lastPeriodDate = new Date(lastPeriod.date);
    const today = new Date();
    const cycleDay = Math.floor((today - lastPeriodDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // Check if currently on period
    const todayEntry = currentData.entries[today.toISOString().split('T')[0]];
    const isPeriod = todayEntry && todayEntry.period;
    
    // Calculate fertile window (days 10-16 in a 28-day cycle)
    const isFertile = cycleDay >= 10 && cycleDay <= 16 && !isPeriod;
    
    return { cycleDay, isFertile, isPeriod };
}

function predictNextPeriod() {
    const entries = Object.values(currentData.entries);
    if (entries.length === 0) return null;
    
    // Find last period
    const periodEntries = entries.filter(e => e.period);
    if (periodEntries.length === 0) return null;
    
    const lastPeriod = periodEntries[periodEntries.length - 1];
    const lastPeriodDate = new Date(lastPeriod.date);
    
    // Add average cycle length
    const nextPeriod = new Date(lastPeriodDate);
    nextPeriod.setDate(nextPeriod.getDate() + (currentData.cycleLength || 28));
    
    return nextPeriod.toISOString().split('T')[0];
}

// Chart Rendering
function renderChart() {
    const ctx = document.getElementById('tempChart').getContext('2d');
    
    // Get last 30 days of data
    const days = [];
    const temps = [];
    const coverlineValues = [];
    const periodDays = [];
    
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        days.push(date.getDate());
        
        const entry = currentData.entries[dateStr];
        if (entry && entry.temperature) {
            temps.push(entry.temperature);
            if (entry.period) {
                periodDays.push(temps.length - 1);
            }
        } else {
            temps.push(null);
        }
    }
    
    // Calculate Coverline according to Fertility Awareness Method
    // 1. Find temperature rise (3 consecutive days above a threshold)
    // 2. Take the highest of the 6 temps before the rise
    // 3. Draw coverline 0.1°C above that
    
    const validTempIndices = [];
    const validTempValues = [];
    
    temps.forEach((temp, idx) => {
        if (temp !== null) {
            validTempIndices.push(idx);
            validTempValues.push(temp);
        }
    });
    
    let coverlineValue = null;
    
    if (validTempValues.length >= 9) { // Need at least 6 before + 3 after
        // Find temperature rise (3 consecutive days that are higher)
        let riseIndex = -1;
        
        for (let i = 6; i < validTempValues.length - 2; i++) {
            const prev6 = validTempValues.slice(i - 6, i);
            const next3 = validTempValues.slice(i, i + 3);
            
            const maxPrev6 = Math.max(...prev6);
            const minNext3 = Math.min(...next3);
            
            // Rise is valid if next 3 are all higher than max of previous 6
            if (minNext3 > maxPrev6) {
                riseIndex = i;
                break;
            }
        }
        
        if (riseIndex > 0) {
            // Get 6 temperatures before the rise
            const prev6Temps = validTempValues.slice(Math.max(0, riseIndex - 6), riseIndex);
            const highestOf6 = Math.max(...prev6Temps);
            
            // Coverline is 0.1°C above the highest of the 6
            coverlineValue = highestOf6 + 0.1;
        }
    }
    
    // Fill coverline array
    for (let i = 0; i < temps.length; i++) {
        coverlineValues.push(coverlineValue);
    }
    
    if (currentChart) {
        currentChart.destroy();
    }
    
    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'Temperatur',
                    data: temps,
                    borderColor: '#FF6B9D',
                    backgroundColor: 'rgba(255, 107, 157, 0.1)',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: temps.map((t, i) => periodDays.includes(i) ? '#E91E63' : '#FF6B9D'),
                    tension: 0.3,
                    spanGaps: true
                },
                {
                    label: 'Coverline',
                    data: coverlineValues,
                    borderColor: '#4CAF50',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: (items) => `Tag ${items[0].label}`
                    }
                }
            },
            scales: {
                y: {
                    min: 35.5,
                    max: 37.5,
                    title: {
                        display: true,
                        text: '°C'
                    }
                }
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
    
    // Weekday headers
    const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    weekdays.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.textContent = day;
        calendarEl.appendChild(header);
    });
    
    // Empty cells before first day
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
        const empty = document.createElement('div');
        calendarEl.appendChild(empty);
    }
    
    // Days
    const today = new Date().toISOString().split('T')[0];
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const entry = currentData.entries[dateStr];
        
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.innerHTML = `<div>${day}</div>`;
        
        if (dateStr === today) {
            dayEl.classList.add('today');
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

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    showHome();
    
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker failed', err));
    }
});

// Handle date change in entry form
document.getElementById('entryDate')?.addEventListener('change', (e) => {
    clearForm();
    loadEntryForDate(e.target.value);
});