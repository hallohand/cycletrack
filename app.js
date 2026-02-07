// CycleTrack - Zyklus Tracker App v1.2.0
// Modularer Aufbau für bessere Wartbarkeit

const STORAGE_KEY = 'cycletrack_data';
const APP_VERSION = '1.2.2';

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
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayEntry = currentData.entries[todayStr];
    
    if (!hasData) {
        dashboard.innerHTML = `
            <div class="welcome-card">
                <h2>Willkommen bei CycleTrack</h2>
                <p>Beginne damit, deine ersten Zyklusdaten einzugeben.</p>
            </div>
        `;
        return;
    }
    
    const periodEntries = allEntries.filter(e => e.period).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    const lastPeriod = periodEntries.length > 0 ? periodEntries[periodEntries.length - 1] : null;
    let cycleDay = 0;
    if (lastPeriod) {
        cycleDay = Math.floor((today - new Date(lastPeriod.date)) / (1000 * 60 * 60 * 24)) + 1;
    }
    
    // Advanced predictions
    const predictions = calculatePredictions();
    const fertilityStatus = getFertilityStatus(cycleDay, predictions, todayEntry, today);
    
    // Next period text
    let nextPeriodText = '-';
    let nextPeriodDate = '';
    if (predictions.nextPeriodStart) {
        const daysTo = Math.ceil((predictions.nextPeriodStart - today) / (1000 * 60 * 60 * 24));
        nextPeriodText = formatDays(daysTo);
        nextPeriodDate = predictions.nextPeriodStart.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
    }
    
    // Next ovulation text (always use ovulationNext which is guaranteed to be in the future)
    let nextOvulationText = '-';
    let nextOvulationDate = '';
    if (predictions.ovulationNext) {
        const daysTo = Math.ceil((predictions.ovulationNext - today) / (1000 * 60 * 60 * 24));
        nextOvulationText = formatDays(daysTo);
        nextOvulationDate = predictions.ovulationNext.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
    }
    
    // Build dashboard HTML
    let html = `
        <div class="dashboard-grid">
            <!-- Main Status Card -->
            <div class="dashboard-card main-status ${fertilityStatus.class}">
                <div class="status-icon">${fertilityStatus.icon}</div>
                <div class="status-title">${fertilityStatus.title}</div>
                <div class="status-subtitle">${fertilityStatus.subtitle}</div>
            </div>
            
            <!-- Cycle Day -->
            <div class="dashboard-card">
                <div class="card-label">Zyklustag</div>
                <div class="card-value">${cycleDay > 0 ? cycleDay : '-'}</div>
                <div class="card-hint">${lastPeriod ? 'Seit letzter Periode' : 'Noch keine Daten'}</div>
            </div>
            
            <!-- Next Period -->
            <div class="dashboard-card ${predictions.nextPeriodStart && Math.ceil((predictions.nextPeriodStart - today) / (1000 * 60 * 60 * 24)) <= 3 ? 'urgent' : ''}">
                <div class="card-label">Nächste Periode</div>
                <div class="card-value">${nextPeriodText}</div>
                <div class="card-hint">${nextPeriodDate}</div>
            </div>
            
            <!-- Next Ovulation -->
            <div class="dashboard-card ${predictions.ovulation1 && Math.ceil((predictions.ovulation1 - today) / (1000 * 60 * 60 * 24)) >= -2 && Math.ceil((predictions.ovulation1 - today) / (1000 * 60 * 60 * 24)) <= 2 ? 'highlight' : ''}">
                <div class="card-label">Nächster Eisprung</div>
                <div class="card-value">${nextOvulationText}</div>
                <div class="card-hint">${nextOvulationDate}</div>
            </div>
            
            <!-- Luteal Phase -->
            <div class="dashboard-card">
                <div class="card-label">Lutealphase</div>
                <div class="card-value">${currentData.lutealPhase || 14} Tage</div>
                <div class="card-hint">Individueller Wert</div>
            </div>
    `;
    
    // Average cycle length
    const avgCycle = calculateAverageCycleLength();
    if (avgCycle > 0) {
        html += `
            <div class="dashboard-card">
                <div class="card-label">Ø Zykluslänge</div>
                <div class="card-value">${avgCycle} Tage</div>
                <div class="card-hint">Aus ${periodEntries.length} Perioden</div>
            </div>
        `;
    }
    
    // Last ovulation (if detected from BBT)
    const lastOvulation = findLastOvulation(allEntries);
    if (lastOvulation) {
        const daysSince = Math.floor((today - lastOvulation) / (1000 * 60 * 60 * 24));
        html += `
            <div class="dashboard-card">
                <div class="card-label">Letzter Eisprung</div>
                <div class="card-value">${daysSince} Tage</div>
                <div class="card-hint">${lastOvulation.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })} (BBT)</div>
            </div>
        `;
    }
    
    // Today's data
    if (todayEntry) {
        html += `
            <div class="dashboard-card today-data">
                <div class="card-label">Heute eingetragen</div>
                <div class="today-items">
                    ${todayEntry.temperature ? `<span class="today-item">${todayEntry.temperature}°C</span>` : ''}
                    ${todayEntry.period ? `<span class="today-item period">Periode: ${todayEntry.period}</span>` : ''}
                    ${todayEntry.lhTest ? `<span class="today-item lh-${todayEntry.lhTest}">LH: ${todayEntry.lhTest === 'positive' ? 'Positiv' : 'Negativ'}</span>` : ''}
                    ${todayEntry.cervix ? `<span class="today-item">${mapCervixValue(todayEntry.cervix)}</span>` : ''}
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    
    dashboard.innerHTML = html;
}

function getFertilityStatus(cycleDay, predictions, todayEntry, today) {
    // Period has priority
    if (cycleDay > 0 && cycleDay <= 5) {
        return { class: 'period', icon: '🩸', title: 'Periode', subtitle: 'Menstruationsphase' };
    }
    
    // LH test positive = peak fertility
    if (todayEntry?.lhTest === 'positive') {
        return { class: 'ovulation', icon: '🔥', title: 'Peak-Fruchtbarkeit', subtitle: 'LH-Anstieg erkannt' };
    }
    
    // Check if in fertile window (use ovulationNext which is always in the future)
    if (predictions.ovulationNext) {
        const daysToOv = Math.ceil((predictions.ovulationNext - today) / (1000 * 60 * 60 * 24));
        
        if (daysToOv >= -1 && daysToOv <= 1) {
            return { class: 'ovulation', icon: '🥚', title: 'Eisprung nahe', subtitle: 'Höchste Fruchtbarkeit' };
        }
        if (daysToOv >= 1 && daysToOv <= 5) {
            return { class: 'fertile', icon: '🌱', title: 'Fruchtbar', subtitle: `Eisprung in ${daysToOv} Tagen` };
        }
        if (daysToOv > 5) {
            return { class: 'normal', icon: '😌', title: 'Niedrige Fruchtbarkeit', subtitle: `Eisprung in ${daysToOv} Tagen` };
        }
    }
    
    // Cervical mucus indicators
    if (todayEntry?.cervix === 'eggwhite') {
        return { class: 'fertile', icon: '💧', title: 'Hohe Fruchtbarkeit', subtitle: 'Eiweißartiger Zervixschleim' };
    }
    if (todayEntry?.cervix === 'watery') {
        return { class: 'fertile', icon: '💦', title: 'Steigende Fruchtbarkeit', subtitle: 'Wässriger Zervixschleim' };
    }
    
    return { class: 'normal', icon: '😌', title: 'Niedrige Fruchtbarkeit', subtitle: 'Prä-ovulatorische Phase' };
}

function findLastOvulation(entries) {
    const tempEntries = entries.filter(e => e.temperature).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    for (let i = 6; i < tempEntries.length - 2; i++) {
        const prev6 = tempEntries.slice(i - 6, i).map(e => e.temperature);
        const next3 = tempEntries.slice(i, i + 3).map(e => e.temperature);
        
        const maxPrev6 = Math.max(...prev6);
        const minNext3 = Math.min(...next3);
        
        if (minNext3 > maxPrev6 + 0.2) {
            return new Date(tempEntries[i].date);
        }
    }
    return null;
}

function formatDays(days) {
    if (days === 0) return 'Heute';
    if (days === 1) return 'Morgen';
    if (days === -1) return 'Gestern';
    if (days < 0) return `Vor ${Math.abs(days)} Tagen`;
    return `In ${days} Tagen`;
}

function mapCervixValue(value) {
    const map = { dry: 'Trocken', sticky: 'Klebrig', creamy: 'Cremig', watery: 'Wässrig', eggwhite: 'Eiweißartig' };
    return map[value] || value;
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
        
        // Check predictions - Periods (priority 1)
        if (isDateInRange(currentDate, predictions.nextPeriodStart, predictions.nextPeriodEnd)) {
            dayEl.classList.add('predicted-period');
        } else if (isDateInRange(currentDate, predictions.period2Start, predictions.period2End)) {
            dayEl.classList.add('predicted-period-2');
        }
        // Fertile windows (priority 2) - show all fertile windows
        else if (isDateInRange(currentDate, predictions.fertile1Start, predictions.fertile1End)) {
            dayEl.classList.add('predicted-fertile');
            if (isSameDate(currentDate, predictions.ovulation1)) {
                dayEl.classList.add('predicted-ovulation');
                dayEl.innerHTML += `<div class="ov-label">🥚</div>`;
            }
        } else if (isDateInRange(currentDate, predictions.fertile2Start, predictions.fertile2End)) {
            dayEl.classList.add('predicted-fertile-2');
            if (isSameDate(currentDate, predictions.ovulation2)) {
                dayEl.classList.add('predicted-ovulation');
                dayEl.innerHTML += `<div class="ov-label">🥚</div>`;
            }
        }
        // Mark ovulationNext specially if not in fertile window (shouldn't happen but just in case)
        if (predictions.ovulationNext && isSameDate(currentDate, predictions.ovulationNext)) {
            if (!dayEl.classList.contains('predicted-fertile') && !dayEl.classList.contains('predicted-fertile-2')) {
                dayEl.classList.add('predicted-ovulation');
                dayEl.innerHTML += `<div class="ov-label">🥚</div>`;
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
        fertile2Start: null, fertile2End: null, ovulation2: null,
        ovulationNext: null, ovulationNextAfter: null
    };
    
    const today = new Date();
    const allEntries = Object.values(currentData.entries);
    const periodEntries = allEntries.filter(e => e.period).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    if (periodEntries.length === 0) return result;
    
    const lastPeriod = new Date(periodEntries[periodEntries.length - 1].date);
    const avgCycle = calculateAverageCycleLength();
    const lutealPhase = currentData.lutealPhase || 14;
    const periodLength = currentData.periodLength || 5;
    
    // Calculate periods
    const nextPeriod = new Date(lastPeriod);
    nextPeriod.setDate(nextPeriod.getDate() + avgCycle);
    result.nextPeriodStart = nextPeriod;
    result.nextPeriodEnd = new Date(nextPeriod);
    result.nextPeriodEnd.setDate(result.nextPeriodEnd.getDate() + periodLength - 1);
    
    const period2 = new Date(result.nextPeriodEnd);
    period2.setDate(period2.getDate() + 1 + avgCycle - periodLength);
    result.period2Start = period2;
    result.period2End = new Date(period2);
    result.period2End.setDate(result.period2End.getDate() + periodLength - 1);
    
    // Calculate ovulations for both cycles
    const ovulation1 = new Date(nextPeriod);
    ovulation1.setDate(ovulation1.getDate() - lutealPhase);
    
    const ovulation2 = new Date(period2);
    ovulation2.setDate(ovulation2.getDate() - lutealPhase);
    
    const period3 = new Date(result.period2End);
    period3.setDate(period3.getDate() + 1 + avgCycle - periodLength);
    const ovulation3 = new Date(period3);
    ovulation3.setDate(ovulation3.getDate() - lutealPhase);
    
    // Determine which ovulation is the NEXT one (in the future)
    if (ovulation1 >= today) {
        // First ovulation is still in the future
        result.ovulationNext = ovulation1;
        result.ovulationNextAfter = ovulation2;
        result.ovulation1 = ovulation1;
        result.fertile1Start = new Date(ovulation1);
        result.fertile1Start.setDate(result.fertile1Start.getDate() - 5);
        result.fertile1End = ovulation1;
    } else if (ovulation2 >= today) {
        // First ovulation is past, second is next
        result.ovulationNext = ovulation2;
        result.ovulationNextAfter = ovulation3;
        result.ovulation1 = ovulation1; // Keep for calendar display
        result.fertile1Start = new Date(ovulation1);
        result.fertile1Start.setDate(result.fertile1Start.getDate() - 5);
        result.fertile1End = ovulation1;
    } else {
        // Both are past, use third
        result.ovulationNext = ovulation3;
        result.ovulationNextAfter = null;
        result.ovulation1 = ovulation1;
        result.fertile1Start = new Date(ovulation1);
        result.fertile1Start.setDate(result.fertile1Start.getDate() - 5);
        result.fertile1End = ovulation1;
    }
    
    // Always set ovulation2 and fertile2 for calendar display
    result.ovulation2 = ovulation2;
    result.fertile2Start = new Date(ovulation2);
    result.fertile2Start.setDate(result.fertile2Start.getDate() - 5);
    result.fertile2End = ovulation2;
    
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
