// CycleTrack - Zyklus Tracker App v1.2.0
// Modularer Aufbau für bessere Wartbarkeit

const STORAGE_KEY = 'cycletrack_data';
const APP_VERSION = '1.2.0';

// Global state
let currentData = loadData();
let currentChart = null;
let currentMonth = new Date();

// ============================================
// DATA MANAGEMENT
// ============================================
function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        const data = JSON.parse(stored);
        // Migration: Ensure lutealPhase exists
        if (!data.lutealPhase) data.lutealPhase = 14;
        if (!data.periodLength) data.periodLength = 5;
        return data;
    }
    return {
        entries: {},
        cycleLength: 28,
        periodLength: 5,
        lutealPhase: 14
    };
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
}

// ============================================
// NAVIGATION
// ============================================
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
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('entryDate').value = today;
    loadEntryForDate(today);
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

function showSettings() {
    hideAllViews();
    document.getElementById('settingsView').classList.remove('hidden');
    updateNav('settings');
}

function hideAllViews() {
    const views = ['homeView', 'addEntryView', 'chartView', 'settingsView'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

function updateNav(activeView) {
    document.querySelectorAll('.nav-item').forEach((item, index) => {
        item.classList.remove('active');
    });
    
    const viewMap = { 'home': 0, 'entry': 1, 'chart': 2, 'settings': 3 };
    const navItems = document.querySelectorAll('.nav-item');
    const index = viewMap[activeView];
    if (index !== undefined && navItems[index]) {
        navItems[index].classList.add('active');
    }
}

// ============================================
// DASHBOARD
// ============================================
function updateDashboard() {
    const dashboard = document.getElementById('dashboardContent');
    if (!dashboard) return;
    
    const allEntries = Object.values(currentData.entries);
    const hasData = allEntries.length > 0;
    
    if (!hasData) {
        dashboard.innerHTML = `
            <div class="welcome-card">
                <h2>Willkommen bei CycleTrack</h2>
                <p>Beginne damit, deine ersten Zyklusdaten einzugeben.</p>
                <button class="btn" onclick="showAddEntry()">Ersten Eintrag erstellen</button>
            </div>
        `;
        return;
    }
    
    const today = new Date();
    const periodEntries = allEntries.filter(e => e.period).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    const lastPeriod = periodEntries.length > 0 ? periodEntries[periodEntries.length - 1] : null;
    let cycleDay = 0;
    if (lastPeriod) {
        cycleDay = Math.floor((today - new Date(lastPeriod.date)) / (1000 * 60 * 60 * 24)) + 1;
    }
    
    // Simple period prediction
    let nextPeriodText = '-';
    if (lastPeriod) {
        const avgCycle = calculateAverageCycleLength();
        const nextPeriod = new Date(lastPeriod.date);
        nextPeriod.setDate(nextPeriod.getDate() + avgCycle);
        const daysToPeriod = Math.ceil((nextPeriod - today) / (1000 * 60 * 60 * 24));
        nextPeriodText = daysToPeriod === 0 ? 'Heute' : 
                        daysToPeriod === 1 ? 'Morgen' : 
                        daysToPeriod < 0 ? `Vor ${Math.abs(daysToPeriod)} Tagen` :
                        `In ${daysToPeriod} Tagen`;
    }
    
    dashboard.innerHTML = `
        <div class="dashboard-grid">
            <div class="dashboard-card main-status">
                <div class="status-icon">🎭</div>
                <div class="status-title">CycleTrack</div>
                <div class="status-subtitle">v${APP_VERSION}</div>
            </div>
            <div class="dashboard-card">
                <div class="card-label">Zyklustag</div>
                <div class="card-value">${cycleDay > 0 ? cycleDay : '-'}</div>
            </div>
            <div class="dashboard-card">
                <div class="card-label">Nächste Periode</div>
                <div class="card-value">${nextPeriodText}</div>
            </div>
            <div class="dashboard-card">
                <div class="card-label">Einträge</div>
                <div class="card-value">${allEntries.length}</div>
            </div>
        </div>
        <button class="btn" onclick="showAddEntry()" style="margin-top: 16px;">+ Tagesdaten eingeben</button>
    `;
}

function calculateAverageCycleLength() {
    const periodEntries = Object.values(currentData.entries)
        .filter(e => e.period)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (periodEntries.length < 2) return 28;
    
    let total = 0, count = 0;
    for (let i = 1; i < periodEntries.length; i++) {
        const days = Math.floor((new Date(periodEntries[i].date) - new Date(periodEntries[i-1].date)) / (1000 * 60 * 60 * 24));
        if (days > 20 && days < 40) {
            total += days;
            count++;
        }
    }
    return count > 0 ? Math.round(total / count) : 28;
}

// ============================================
// ENTRY FORM
// ============================================
let currentSelections = { cervix: null, lh: null, sex: null, mood: null, symptoms: [] };

function selectOption(element, type) {
    const parent = element.parentElement;
    parent.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
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
    
    // Reset form
    document.getElementById('temperature').value = '';
    document.getElementById('periodFlow').value = '';
    document.getElementById('notes').value = '';
    document.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
    currentSelections = { cervix: null, lh: null, sex: null, mood: null, symptoms: [] };
    
    if (!entry) return;
    
    if (entry.temperature) document.getElementById('temperature').value = entry.temperature;
    if (entry.period) document.getElementById('periodFlow').value = entry.period;
    if (entry.notes) document.getElementById('notes').value = entry.notes;
    if (entry.cervix) {
        const el = document.querySelector(`.option-item[data-value="${entry.cervix}"]`);
        if (el) {
            el.classList.add('selected');
            currentSelections.cervix = entry.cervix;
        }
    }
    if (entry.lhTest) {
        const el = document.querySelector(`[onclick="selectOption(this, 'lh')"][data-value="${entry.lhTest}"]`);
        if (el) {
            el.classList.add('selected');
            currentSelections.lh = entry.lhTest;
        }
    }
    if (entry.sex) {
        const el = document.querySelector(`[onclick="selectOption(this, 'sex')"][data-value="${entry.sex}"]`);
        if (el) {
            el.classList.add('selected');
            currentSelections.sex = entry.sex;
        }
    }
    if (entry.mood) {
        const el = document.querySelector(`[onclick="selectOption(this, 'mood')"][data-value="${entry.mood}"]`);
        if (el) {
            el.classList.add('selected');
            currentSelections.mood = entry.mood;
        }
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
    
    showHome();
}

// ============================================
// CHART & CALENDAR
// ============================================
function renderChart() {
    const ctx = document.getElementById('tempChart')?.getContext('2d');
    if (!ctx) return;
    
    const allEntries = Object.values(currentData.entries).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    const periodEntries = allEntries.filter(e => e.period);
    if (periodEntries.length === 0) {
        if (currentChart) currentChart.destroy();
        return;
    }
    
    const lastPeriod = periodEntries[periodEntries.length - 1];
    const cycleStart = new Date(lastPeriod.date);
    
    const days = [];
    const temps = [];
    const pointColors = [];
    
    for (let i = 0; i < 32; i++) {
        const date = new Date(cycleStart);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        days.push(`ZT ${i + 1}`);
        
        const entry = currentData.entries[dateStr];
        if (entry?.temperature) {
            temps.push(entry.temperature);
            pointColors.push(entry.period ? '#C2185B' : '#E91E63');
        } else {
            temps.push(null);
            pointColors.push('#E91E63');
        }
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
                pointBackgroundColor: pointColors,
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

function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const monthEl = document.getElementById('currentMonth');
    if (monthEl) {
        monthEl.textContent = new Date(year, month).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    }
    
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
    
    calendarEl.innerHTML = '';
    
    const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    weekdays.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.textContent = day;
        calendarEl.appendChild(header);
    });
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Empty cells
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
        calendarEl.appendChild(document.createElement('div'));
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // Get predictions
    const predictions = calculatePredictions();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const entry = currentData.entries[dateStr];
        const currentDate = new Date(dateStr);
        
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.innerHTML = `<div>${day}</div>`;
        
        if (dateStr === today) dayEl.classList.add('today');
        
        // Check predictions
        if (isDateInRange(currentDate, predictions.nextPeriodStart, predictions.nextPeriodEnd)) {
            dayEl.classList.add('predicted-period');
        } else if (isDateInRange(currentDate, predictions.period2Start, predictions.period2End)) {
            dayEl.classList.add('predicted-period-2');
        } else if (isDateInRange(currentDate, predictions.fertile1Start, predictions.fertile1End)) {
            dayEl.classList.add('predicted-fertile');
            if (isSameDate(currentDate, predictions.ovulation1)) {
                dayEl.classList.add('predicted-ovulation');
            }
        } else if (isDateInRange(currentDate, predictions.fertile2Start, predictions.fertile2End)) {
            dayEl.classList.add('predicted-fertile-2');
            if (isSameDate(currentDate, predictions.ovulation2)) {
                dayEl.classList.add('predicted-ovulation');
            }
        }
        
        // Real data
        if (entry) {
            if (entry.period) dayEl.classList.add('period');
            else if (entry.cervix === 'eggwhite' || entry.lhTest === 'positive') dayEl.classList.add('ovulation');
            else if (entry.cervix === 'watery') dayEl.classList.add('fertile');
            
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

function calculatePredictions() {
    const result = {
        nextPeriodStart: null, nextPeriodEnd: null,
        period2Start: null, period2End: null,
        fertile1Start: null, fertile1End: null, ovulation1: null,
        fertile2Start: null, fertile2End: null, ovulation2: null
    };
    
    const allEntries = Object.values(currentData.entries);
    const periodEntries = allEntries.filter(e => e.period).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    if (periodEntries.length === 0) return result;
    
    const lastPeriod = new Date(periodEntries[periodEntries.length - 1].date);
    const avgCycle = calculateAverageCycleLength();
    const lutealPhase = currentData.lutealPhase || 14;
    const periodLength = currentData.periodLength || 5;
    
    // Next period
    const nextPeriod = new Date(lastPeriod);
    nextPeriod.setDate(nextPeriod.getDate() + avgCycle);
    result.nextPeriodStart = nextPeriod;
    result.nextPeriodEnd = new Date(nextPeriod);
    result.nextPeriodEnd.setDate(result.nextPeriodEnd.getDate() + periodLength - 1);
    
    // Period 2
    const period2 = new Date(result.nextPeriodEnd);
    period2.setDate(period2.getDate() + 1 + avgCycle - periodLength);
    result.period2Start = period2;
    result.period2End = new Date(period2);
    result.period2End.setDate(result.period2End.getDate() + periodLength - 1);
    
    // Fertile window 1
    result.ovulation1 = new Date(nextPeriod);
    result.ovulation1.setDate(result.ovulation1.getDate() - lutealPhase);
    result.fertile1Start = new Date(result.ovulation1);
    result.fertile1Start.setDate(result.fertile1Start.getDate() - 5);
    result.fertile1End = result.ovulation1;
    
    // Fertile window 2
    result.ovulation2 = new Date(period2);
    result.ovulation2.setDate(result.ovulation2.getDate() - lutealPhase);
    result.fertile2Start = new Date(result.ovulation2);
    result.fertile2Start.setDate(result.fertile2Start.getDate() - 5);
    result.fertile2End = result.ovulation2;
    
    return result;
}

function isDateInRange(date, start, end) {
    if (!start || !end) return false;
    return date >= start && date <= end;
}

function isSameDate(d1, d2) {
    if (!d1 || !d2) return false;
    return d1.getTime() === d2.getTime();
}

function changeMonth(delta) {
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    renderCalendar();
}

// ============================================
// IMPORT/EXPORT
// ============================================
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
    
    try {
        let count = 0;
        if (text.startsWith('{')) {
            count = ImportExport.importFromJSON(text);
        } else {
            count = ImportExport.importFromCSV(text);
        }
        
        const resultDiv = document.getElementById('importResult');
        if (count > 0) {
            resultDiv.innerHTML = `<div style="color: #4CAF50; font-weight: 500;">${count} Einträge importiert</div>`;
            document.getElementById('importText').value = '';
            showHome();
        } else {
            resultDiv.innerHTML = `<div style="color: #FF9800;">Keine Einträge gefunden</div>`;
        }
        resultDiv.style.display = 'block';
    } catch (e) {
        console.error(e);
        alert('Fehler beim Import: ' + e.message);
    }
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const headerDate = document.getElementById('headerDate');
    if (headerDate) {
        headerDate.textContent = today.toLocaleDateString('de-DE', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }
    
    showHome();
});
